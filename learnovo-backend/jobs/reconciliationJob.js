const mongoose = require('mongoose');
const FeeInvoice = require('../models/FeeInvoice');
const PaymentAttempt = require('../models/PaymentAttempt');
const PaymentAuditLog = require('../models/PaymentAuditLog');
const Receipt = require('../models/Receipt');
const StudentBalance = require('../models/StudentBalance');
const Tenant = require('../models/Tenant');
const { getGateway } = require('../services/payment/GatewayFactory');
const iciciOrangeCallbackProcessor = require('../services/payment/iciciOrangeCallbackProcessor');
const { logger } = require('../middleware/errorHandler');
const { toNumber, roundToRupee } = require('../utils/money');

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
    status: { $in: ['PENDING', 'PROCESSING'] }
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
          logger.error('Reconciliation: checkStatus failed', {
            attemptId: String(attempt._id),
            tenantId: tenantIdStr,
            error: err.message
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

async function _applyReconciledSuccess(attempt, previousStatus) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    attempt.status = 'SUCCESS';
    await attempt.save({ session });

    // Tenant-scoped invoice lookup — never settle an invoice that
    // belongs to a different tenant even if invoiceId were somehow
    // copied across (defence-in-depth).
    const invoice = await FeeInvoice.findOne({
      _id: attempt.invoiceId,
      tenantId: attempt.tenantId
    }).session(session);

    if (invoice) {
      invoice.paidAmount = roundToRupee(toNumber(invoice.paidAmount) + toNumber(attempt.amount));
      await invoice.save({ session });

      const receiptNum = await Receipt.generateReceiptNumber(attempt.tenantId);
      await Receipt.create([{
        tenantId: attempt.tenantId,
        paymentAttemptId: attempt._id,
        studentId: attempt.studentId,
        invoiceId: invoice._id,
        receiptNumber: receiptNum
      }], { session });
    }

    await PaymentAuditLog.create([{
      tenantId: attempt.tenantId,
      paymentAttemptId: attempt._id,
      previousStatus,
      newStatus: 'SUCCESS',
      triggerSource: 'BACKGROUND_JOB',
      note: 'Status reconciled from gateway polling.'
    }], { session });

    await session.commitTransaction();
    session.endSession();

    if (invoice) {
      try {
        await StudentBalance.updateBalance(
          attempt.tenantId,
          attempt.studentId,
          invoice.academicSessionId
        );
      } catch (balErr) {
        logger.error(`Balance update failed for student ${attempt.studentId}`, balErr);
      }
    }
  } catch (txErr) {
    await session.abortTransaction();
    session.endSession();
    throw txErr;
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
  const INTERVAL_MS = 5 * 60 * 1000;
  setInterval(runReconciliation, INTERVAL_MS);
  logger.info('Reconciliation Job scheduled to run every 5 minutes');
}

module.exports = { startJob, runReconciliation };
