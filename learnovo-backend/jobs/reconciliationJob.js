const mongoose = require('mongoose');
const PaymentAttempt = require('../models/PaymentAttempt');
const PaymentAuditLog = require('../models/PaymentAuditLog');
const Tenant = require('../models/Tenant');
const { getGateway } = require('../services/payment/GatewayFactory');
const iciciOrangeCallbackProcessor = require('../services/payment/iciciOrangeCallbackProcessor');
const { logger } = require('../middleware/errorHandler');
const {
  settleSuccessfulAttempt,
  runPostSettlementSideEffects
} = require('../services/paymentSettlementService');

// Prevent overlapping runs
let isRunning = false;

/**
 * Reconciliation job.
 *
 * Two independent sweeps run each tick:
 *
 *   1. PaymentAttempt sweep — polls the correct gateway per tenant for
 *      stuck PENDING / PROCESSING attempts. Stuck > 24h => DISPUTED for
 *      admin attention.
 *
 *   2. ICICI Orange webhook-log sweep — safety net for inline processor
 *      runs that crashed mid-flight, or for callbacks whose matching
 *      PaymentAttempt didn't exist at receive time.
 *
 * Safety: attempts are grouped by tenant and each tenant's gateway is
 * resolved via GatewayFactory. The previous version of this file used
 * a single MockPaymentGateway for *all* tenants, which meant the mock's
 * 85%-SUCCESS heuristic could fake-credit real Razorpay / ICICI
 * invoices. That is fixed here.
 */
async function runReconciliation() {
  if (isRunning) {
    logger.info('Reconciliation Job skipped — previous run still in progress.');
    return;
  }

  isRunning = true;

  try {
    await _sweepPaymentAttempts();
    await _sweepIciciOrangeWebhookLogs();
  } catch (e) {
    logger.error('Fatal error in reconciliation job wrapper', e);
  } finally {
    isRunning = false;
  }
}

async function _sweepPaymentAttempts() {
  const stuckAttempts = await PaymentAttempt.find({
    status: { $in: ['INITIATED', 'PENDING', 'PROCESSING'] }
  }).limit(500); // Cap batch size to prevent memory issues

  if (stuckAttempts.length === 0) return;

  logger.info(`Reconciliation Job found ${stuckAttempts.length} stuck payments.`);

  const now = new Date();
  const msIn24Hours = 24 * 60 * 60 * 1000;

  // Group by tenant so we resolve each tenant's gateway once per tick.
  const byTenant = new Map();
  for (const attempt of stuckAttempts) {
    const key = String(attempt.tenantId);
    if (!byTenant.has(key)) byTenant.set(key, []);
    byTenant.get(key).push(attempt);
  }

  for (const [tenantIdStr, attempts] of byTenant.entries()) {
    let tenant;
    try {
      tenant = await Tenant.findById(tenantIdStr);
    } catch (err) {
      logger.error('Reconciliation: tenant fetch failed', {
        tenantId: tenantIdStr,
        error: err.message
      });
      continue;
    }
    if (!tenant) continue;

    const gateway = getGateway(tenant);

    for (const attempt of attempts) {
      try {
        // If stuck for over 24 hours, escalate to DISPUTED so an admin
        // picks it up. This branch applies regardless of gateway type
        // — even for ICICI where we can't poll, the 24h rule surfaces
        // the attempt.
        if (now.getTime() - attempt.createdAt.getTime() > msIn24Hours) {
          const previousStatus = attempt.status;
          attempt.status = 'DISPUTED';
          await attempt.save();

          await PaymentAuditLog.create({
            tenantId: attempt.tenantId,
            paymentAttemptId: attempt._id,
            previousStatus,
            newStatus: 'DISPUTED',
            triggerSource: 'BACKGROUND_JOB',
            note: 'Automatically disputed after 24 hours without gateway resolution.'
          });

          continue;
        }

        // Skip manual payments (no gatewayRefId) — admin verifies those.
        if (!attempt.gatewayRefId) continue;

        // No gateway available for this tenant (misconfigured or
        // subscription lapsed) — don't touch the attempt.
        if (!gateway) continue;

        let gwResult;
        try {
          gwResult = await gateway.checkStatus(attempt.gatewayRefId);
        } catch (err) {
          // ICICI Orange throws SpecPendingError until the MID kit is
          // wired — that's not an error, just "polling is not yet a
          // capability for this gateway". The webhook-log sweep below
          // is how ICICI-side reconciliation happens for now.
          if (err?.code === 'ICICI_ORANGE_SPEC_PENDING') continue;
          logger.error('Reconciliation: checkStatus failed', err, {
            attemptId: String(attempt._id),
            tenantId: tenantIdStr,
            gatewayRefId: attempt.gatewayRefId,
            provider: gateway?.constructor?.name
          });
          continue;
        }

        if (gwResult.status !== attempt.status && ['SUCCESS', 'FAILED'].includes(gwResult.status)) {
          const previousStatus = attempt.status;

          if (gwResult.status === 'SUCCESS') {
            await _applyReconciledSuccess(attempt, previousStatus);
          } else {
            attempt.status = gwResult.status;
            await attempt.save();

            await PaymentAuditLog.create({
              tenantId: attempt.tenantId,
              paymentAttemptId: attempt._id,
              previousStatus,
              newStatus: gwResult.status,
              triggerSource: 'BACKGROUND_JOB',
              note: 'Status reconciled from gateway polling.'
            });
          }
        }
      } catch (err) {
        logger.error(`Reconciliation failed for attempt ${attempt._id}`, err);
      }
    }
  }
}

async function _applyReconciledSuccess(attempt, _previousStatus) {
  const session = await mongoose.startSession();
  session.startTransaction();

  let result;
  try {
    result = await settleSuccessfulAttempt(attempt, session, {
      paymentMode: 'ONLINE',
      paymentDate: new Date(),
      transactionRefId: attempt.gatewayRefId || null,
      initiatedBy: 'student',
      triggerSource: 'BACKGROUND_JOB',
      note: 'Status reconciled from gateway polling.'
    });

    await session.commitTransaction();
  } catch (txErr) {
    await session.abortTransaction();
    throw txErr;
  } finally {
    session.endSession();
  }

  if (result && !result.alreadySettled) {
    await runPostSettlementSideEffects(attempt, result.invoices, {
      receipts: result.receipts,
      paymentMode: 'Online',
      paymentDate: new Date(),
      transactionRefId: attempt.gatewayRefId || null
    });
  }
}

async function _sweepIciciOrangeWebhookLogs() {
  try {
    await iciciOrangeCallbackProcessor.sweepUnprocessed({ limit: 100 });
  } catch (err) {
    logger.error('Reconciliation: ICICI Orange log sweep failed', {
      error: err.message,
      stack: err.stack
    });
  }
}

/**
 * Start the polling interval
 */
function startJob() {
  const INTERVAL_MS = 90 * 1000;
  // Kick off an immediate sweep so a server restart doesn't add a full
  // interval of latency for any payments that landed during the restart.
  setTimeout(runReconciliation, 5 * 1000);
  setInterval(runReconciliation, INTERVAL_MS);
  logger.info('Reconciliation Job scheduled to run every 90 seconds');
}

module.exports = { startJob, runReconciliation };
