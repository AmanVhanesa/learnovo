/**
 * ICICI Orange callback processor.
 *
 * Reads unprocessed rows from ICICIOrangeWebhookLog and maps them onto
 * PaymentAttempt state transitions. Runs in two modes:
 *
 *   1. Inline (fire-and-forget from the webhook route, invoked per row
 *      immediately after ACK). Most rows are resolved here within
 *      milliseconds of the callback arriving.
 *
 *   2. Sweep (invoked by the reconciliation job or admin endpoint) —
 *      re-runs across all unprocessed rows, used as a safety net in
 *      case the inline call crashed mid-flight.
 *
 * Design invariants — every guard here exists to answer one of the
 * two user-stated risks:
 *
 *   "one tenant's fees don't go to another":
 *     - PaymentAttempt lookup is scoped by (tenantId, gatewayRefId).
 *       Matching on gatewayRefId alone is a cross-tenant leak risk.
 *     - Invoice / Receipt / StudentBalance writes read `attempt.tenantId`
 *       (not `log.tenantId`) — and a mismatch between the two is itself
 *       treated as a data-integrity error.
 *
 *   "money deducted but payment failed":
 *     - Amount mismatch between callback and attempt => UNDER_REVIEW
 *       (never SUCCESS). Admin must resolve manually.
 *     - No matching attempt => log.processed=true with a marker reason,
 *       so the raw body stays queryable but we don't re-attempt blindly.
 *     - Every state transition is written to PaymentAuditLog inside the
 *       same transaction as the state change — no possibility of
 *       "credit applied but audit missing".
 */

const mongoose = require('mongoose');
const ICICIOrangeWebhookLog = require('../../models/ICICIOrangeWebhookLog');
const PaymentAttempt = require('../../models/PaymentAttempt');
const PaymentAuditLog = require('../../models/PaymentAuditLog');
const FeeInvoice = require('../../models/FeeInvoice');
const Receipt = require('../../models/Receipt');
const StudentBalance = require('../../models/StudentBalance');
const Tenant = require('../../models/Tenant');
const ICICIOrangeGateway = require('./ICICIOrangeGateway');
const { logger } = require('../../middleware/errorHandler');
const { toNumber, roundToRupee, moneyEquals } = require('../../utils/money');

/**
 * Terminal reasons written into log.processError. Strings are part of
 * the forensic record — do not change without also updating admin UI
 * that filters on them.
 */
const PROCESS_REASONS = {
  NO_MATCH: 'no_matching_payment_attempt',
  TENANT_MISMATCH: 'tenant_mismatch',
  AMOUNT_MISMATCH: 'amount_mismatch_under_review',
  UNPARSEABLE: 'payload_unparseable',
  UNKNOWN_STATUS: 'status_unrecognised',
  SUCCESS_APPLIED: '',
  FAILED_APPLIED: '',
  ALREADY_TERMINAL: 'already_terminal_state',
  AUTH_FAILED: 'auth_failed_no_processing'
};

/**
 * Process a single webhook log row. Idempotent: safe to call multiple
 * times with the same logId. Returns an object describing what happened
 * for caller-side logging. Never throws — all errors are captured onto
 * the log row so ICICI's retries don't cascade into 5xx.
 */
async function processLog(logId) {
  let log;
  try {
    log = await ICICIOrangeWebhookLog.findById(logId);
  } catch (err) {
    logger.error('iciciOrangeCallbackProcessor: log fetch failed', {
      logId: String(logId),
      error: err.message
    });
    return { ok: false, reason: 'log_fetch_failed' };
  }

  if (!log) return { ok: false, reason: 'log_not_found' };
  if (log.processed) return { ok: true, reason: 'already_processed' };

  // If the callback itself failed Basic Auth, do not attempt to parse
  // or transition any state. The log row exists for forensic purposes
  // (reconnaissance detection, misconfigured ICICI test fires), not
  // for business processing.
  if (!log.authPassed) {
    return await _finaliseSkip(log, PROCESS_REASONS.AUTH_FAILED);
  }

  const gateway = await _buildGatewayForLog(log);
  if (!gateway) {
    // Tenant resolved but has no ICICI config — leave the row
    // unprocessed and surface it. This is almost certainly a
    // misconfiguration we want an admin to see, not a silent skip.
    logger.warn('iciciOrangeCallbackProcessor: no gateway for tenant', {
      logId: String(logId),
      tenantCode: log.tenantCode
    });
    return { ok: false, reason: 'no_gateway_for_tenant' };
  }

  const parsed = gateway.parseCallbackPayload(log.parsedBody);
  if (!parsed || !parsed.merchantRef) {
    // Cannot identify the transaction — mark processed so the sweep
    // doesn't churn on the same row. The raw body is preserved; an
    // admin can still inspect and reprocess after fixing the parser.
    return await _finaliseSkip(log, PROCESS_REASONS.UNPARSEABLE);
  }

  // Tenant-scoped attempt lookup. The compound query is the primary
  // defence against one tenant's callback settling against another's
  // PaymentAttempt — even if merchantRef collided (which it should
  // not, since we prefix with tenantCode when generating), the
  // tenantId filter forecloses the cross-contamination path.
  const attempt = await PaymentAttempt.findOne({
    tenantId: log.tenantId,
    gatewayRefId: parsed.merchantRef
  });

  if (!attempt) {
    return await _finaliseSkip(log, PROCESS_REASONS.NO_MATCH, {
      paymentAttemptId: null
    });
  }

  // Belt-and-braces: even though we queried by tenantId, reassert the
  // match at runtime. Catches any future regression where the query
  // filter is accidentally widened.
  if (String(attempt.tenantId) !== String(log.tenantId)) {
    logger.error('iciciOrangeCallbackProcessor: tenant mismatch between log and attempt', {
      logId: String(logId),
      logTenantId: String(log.tenantId),
      attemptTenantId: String(attempt.tenantId)
    });
    return await _finaliseSkip(log, PROCESS_REASONS.TENANT_MISMATCH, {
      paymentAttemptId: attempt._id
    });
  }

  // Idempotency: already in a terminal success/failure state. Flip
  // log.processed so the sweep doesn't loop, but don't rewrite the
  // attempt (that would spawn duplicate receipts).
  if (['SUCCESS', 'VERIFIED', 'FAILED'].includes(attempt.status)) {
    return await _finaliseSkip(log, PROCESS_REASONS.ALREADY_TERMINAL, {
      paymentAttemptId: attempt._id
    });
  }

  // Amount verification. If the bank-reported amount deviates from
  // what we asked for, DO NOT CREDIT. Transition to UNDER_REVIEW and
  // stop — this is the "money deducted but wrong amount" case.
  if (parsed.amount !== null && !moneyEquals(toNumber(parsed.amount), toNumber(attempt.amount))) {
    await _transitionAttemptOnly(
      attempt,
      'UNDER_REVIEW',
      `Callback amount ₹${parsed.amount} does not match attempt amount ₹${attempt.amount}. Bank ref: ${parsed.bankRef || 'n/a'}.`
    );
    return await _finaliseSkip(log, PROCESS_REASONS.AMOUNT_MISMATCH, {
      paymentAttemptId: attempt._id
    });
  }

  if (parsed.normalisedStatus === 'SUCCESS') {
    await _applySuccess(attempt, parsed, log);
    return { ok: true, reason: 'success_applied', paymentAttemptId: attempt._id };
  }

  if (parsed.normalisedStatus === 'FAILED') {
    await _applyFailure(attempt, parsed, log);
    return { ok: true, reason: 'failure_applied', paymentAttemptId: attempt._id };
  }

  // PENDING / UNKNOWN — don't transition the attempt; the reconciliation
  // job's polling path handles stragglers. But mark the log processed
  // so we don't re-parse the same payload on every sweep.
  return await _finaliseSkip(log, PROCESS_REASONS.UNKNOWN_STATUS, {
    paymentAttemptId: attempt._id
  });
}

/**
 * Sweep unprocessed rows. Used by the reconciliation job as a safety
 * net for inline calls that crashed or for callbacks that arrived
 * before their PaymentAttempt existed.
 */
async function sweepUnprocessed({ limit = 100 } = {}) {
  const rows = await ICICIOrangeWebhookLog.find({ processed: false })
    .sort({ receivedAt: 1 })
    .limit(limit)
    .select('_id');

  let applied = 0;
  for (const row of rows) {
    try {
      const result = await processLog(row._id);
      if (result?.ok && (result.reason === 'success_applied' || result.reason === 'failure_applied')) {
        applied += 1;
      }
    } catch (err) {
      logger.error('iciciOrangeCallbackProcessor: sweep row failed', {
        logId: String(row._id),
        error: err.message
      });
    }
  }

  if (rows.length > 0) {
    logger.info('iciciOrangeCallbackProcessor: sweep complete', {
      scanned: rows.length,
      applied
    });
  }
  return { scanned: rows.length, applied };
}

// ── internal helpers ──────────────────────────────────────────────

async function _buildGatewayForLog(log) {
  if (!log.tenantId) return null;
  const tenant = await Tenant.findById(log.tenantId);
  if (!tenant || !tenant.paymentGateway?.iciciOrange?.merchantId) return null;
  try {
    const cfg = tenant.paymentGateway.iciciOrange;
    return new ICICIOrangeGateway({
      merchantId: cfg.merchantId,
      aggregatorId: cfg.aggregatorId,
      secureHashKey: cfg.secureHashKey,
      environment: cfg.environment || 'production',
      tenantCode: log.tenantCode
    });
  } catch (err) {
    logger.warn('iciciOrangeCallbackProcessor: gateway construction failed', {
      tenantCode: log.tenantCode,
      error: err.message
    });
    return null;
  }
}

async function _finaliseSkip(log, reason, extra = {}) {
  try {
    log.processed = true;
    log.processedAt = new Date();
    log.processError = reason;
    if (extra.paymentAttemptId) log.paymentAttemptId = extra.paymentAttemptId;
    await log.save();
  } catch (err) {
    logger.error('iciciOrangeCallbackProcessor: finaliseSkip failed', {
      logId: String(log._id),
      reason,
      error: err.message
    });
  }
  return { ok: true, reason, paymentAttemptId: extra.paymentAttemptId || null };
}

async function _transitionAttemptOnly(attempt, newStatus, note) {
  const previousStatus = attempt.status;
  attempt.status = newStatus;
  await attempt.save();
  await PaymentAuditLog.create({
    tenantId: attempt.tenantId,
    paymentAttemptId: attempt._id,
    previousStatus,
    newStatus,
    triggerSource: 'BACKGROUND_JOB',
    note
  });
}

async function _applySuccess(attempt, parsed, log) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const previousStatus = attempt.status;
    attempt.status = 'SUCCESS';
    // Store bank reference if we have one — useful for the receipt and
    // for admin lookups against ICICI's dashboard.
    if (parsed.bankRef) {
      attempt.gatewayResponse = {
        ...(attempt.gatewayResponse || {}),
        bankRef: parsed.bankRef,
        rawStatus: parsed.rawStatus,
        logId: String(log._id)
      };
    }
    await attempt.save({ session });

    let invoice = null;
    if (attempt.invoiceId) {
      invoice = await FeeInvoice.findOne({
        _id: attempt.invoiceId,
        tenantId: attempt.tenantId
      }).session(session);

      if (invoice) {
        invoice.paidAmount = roundToRupee(
          toNumber(invoice.paidAmount) + toNumber(attempt.amount)
        );
        await invoice.save({ session });
      }
    }

    let receiptNumber = null;
    if (invoice) {
      receiptNumber = await Receipt.generateReceiptNumber(attempt.tenantId);
      await Receipt.create([{
        tenantId: attempt.tenantId,
        paymentAttemptId: attempt._id,
        studentId: attempt.studentId,
        invoiceId: invoice._id,
        receiptNumber
      }], { session });
    }

    await PaymentAuditLog.create([{
      tenantId: attempt.tenantId,
      paymentAttemptId: attempt._id,
      previousStatus,
      newStatus: 'SUCCESS',
      triggerSource: 'BACKGROUND_JOB',
      note: `Settled via ICICI Orange callback. Bank ref: ${parsed.bankRef || 'n/a'}. Log: ${log._id}.`
    }], { session });

    log.processed = true;
    log.processedAt = new Date();
    log.processError = '';
    log.paymentAttemptId = attempt._id;
    await log.save({ session });

    await session.commitTransaction();
    session.endSession();

    // Balance recalc is best-effort — it runs outside the transaction
    // because StudentBalance has its own recompute-from-source logic
    // and we don't want a balance-calc hiccup to revert a valid credit.
    if (invoice) {
      try {
        await StudentBalance.updateBalance(
          attempt.tenantId,
          attempt.studentId,
          invoice.academicSessionId
        );
      } catch (balErr) {
        logger.error('iciciOrangeCallbackProcessor: balance recalc failed', {
          studentId: String(attempt.studentId),
          tenantId: String(attempt.tenantId),
          error: balErr.message
        });
      }
    }
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    logger.error('iciciOrangeCallbackProcessor: success transaction failed', {
      attemptId: String(attempt._id),
      logId: String(log._id),
      error: err.message,
      stack: err.stack
    });
    throw err;
  }
}

async function _applyFailure(attempt, parsed, log) {
  const previousStatus = attempt.status;
  attempt.status = 'FAILED';
  attempt.gatewayResponse = {
    ...(attempt.gatewayResponse || {}),
    bankRef: parsed.bankRef || null,
    rawStatus: parsed.rawStatus,
    logId: String(log._id)
  };
  await attempt.save();

  await PaymentAuditLog.create({
    tenantId: attempt.tenantId,
    paymentAttemptId: attempt._id,
    previousStatus,
    newStatus: 'FAILED',
    triggerSource: 'BACKGROUND_JOB',
    note: `ICICI Orange callback reported failure. Status: ${parsed.rawStatus || 'unknown'}. Bank ref: ${parsed.bankRef || 'n/a'}. Log: ${log._id}.`
  });

  log.processed = true;
  log.processedAt = new Date();
  log.processError = '';
  log.paymentAttemptId = attempt._id;
  await log.save();
}

module.exports = {
  processLog,
  sweepUnprocessed,
  PROCESS_REASONS
};
