/**
 * ICICI Orange (PG Direct) returnURL handler.
 *
 * After the customer pays on the bank-hosted page, ICICI POSTs the
 * transaction response to this URL with a secureHash field signed by
 * the merchant's HMAC key. We:
 *
 *   1. Resolve the tenant by schoolCode (path param), build a gateway
 *      and verify the secureHash. A bad signature is treated like a
 *      404 — never reveal that the path exists with a different shape.
 *   2. Look up the PaymentAttempt by (tenantId, gatewayRefId=merchantTxnNo).
 *      Tenant scoping prevents one school's callback from settling
 *      another school's attempt even if merchantTxnNo collided.
 *   3. Verify amount equality. Mismatch → UNDER_REVIEW (no credit).
 *   4. Apply success / failure inside a transaction, then redirect the
 *      browser to the frontend's /payment/status page with the attempt
 *      ID. The student sees their result there.
 *
 * Both POST and GET are accepted on the same path. ICICI's spec
 * advertises POST, but some intermediate redirectors/browser back-buttons
 * can downgrade to GET — we handle either.
 */

const express = require('express');
const mongoose = require('mongoose');
const { logger } = require('../middleware/errorHandler');
const Tenant = require('../models/Tenant');
const PaymentAttempt = require('../models/PaymentAttempt');
const PaymentAuditLog = require('../models/PaymentAuditLog');
const FeeInvoice = require('../models/FeeInvoice');
const Receipt = require('../models/Receipt');
const StudentBalance = require('../models/StudentBalance');
const ICICIOrangeGateway = require('../services/payment/ICICIOrangeGateway');
const { toNumber, roundToRupee, moneyEquals } = require('../utils/money');

const router = express.Router();

function frontendStatusUrl(tenantSubdomain, status, extras = {}) {
  // Pick the first configured frontend origin and append the tenant
  // subdomain. If FRONTEND_ORIGIN isn't set, fall back to the marketing
  // domain — better to land somewhere visible than to redirect to nowhere.
  const origins = (process.env.FRONTEND_ORIGIN || process.env.FRONTEND_URL || 'https://learnovoportal.com')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  let base = origins[0];

  // If the configured origin is a base domain (no subdomain), prepend
  // the tenant subdomain so the redirect lands on the school's portal.
  try {
    const u = new URL(base);
    const host = u.host;
    if (tenantSubdomain && !host.startsWith(`${tenantSubdomain}.`)) {
      const parts = host.split('.');
      // Only prepend if base is a 2-part apex (foo.com) — leaves localhost,
      // existing subdomains, and IP addresses untouched.
      if (parts.length === 2) {
        u.host = `${tenantSubdomain}.${host}`;
        base = u.toString().replace(/\/+$/, '');
      }
    }
  } catch (_err) { /* leave base as-is */ }

  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (extras.attemptId) params.set('attemptId', String(extras.attemptId));
  if (extras.ref) params.set('ref', String(extras.ref));
  if (extras.bankRef) params.set('bankRef', String(extras.bankRef));
  if (extras.amount !== undefined && extras.amount !== null) {
    params.set('amount', String(extras.amount));
  }
  if (extras.message) params.set('message', String(extras.message));
  return `${base.replace(/\/+$/, '')}/payment/status?${params.toString()}`;
}

/**
 * Resolve the inbound payload from either body (POST) or query (GET).
 * ICICI may send either application/json or application/x-www-form-urlencoded
 * — Express has parsed both into req.body by the time we get here.
 */
function extractPayload(req) {
  if (req.method === 'POST' && req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
    return req.body;
  }
  if (req.query && Object.keys(req.query).length > 0) {
    return { ...req.query };
  }
  return null;
}

/**
 * Apply a SUCCESS callback inside a transaction: flip the attempt,
 * credit the invoice, mint a receipt, write the audit log. Mirrors
 * iciciOrangeCallbackProcessor._applySuccess.
 */
async function applySuccess(attempt, parsed) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const previousStatus = attempt.status;
    attempt.status = 'SUCCESS';
    attempt.gatewayResponse = {
      ...(attempt.gatewayResponse || {}),
      bankRef: parsed.bankRef || null,
      rawStatus: parsed.rawStatus,
      source: 'returnURL'
    };
    await attempt.save({ session });

    let invoice = null;
    if (attempt.invoiceId) {
      invoice = await FeeInvoice.findOne({
        _id: attempt.invoiceId,
        tenantId: attempt.tenantId
      }).session(session);
      if (invoice) {
        invoice.paidAmount = roundToRupee(toNumber(invoice.paidAmount) + toNumber(attempt.amount));
        await invoice.save({ session });
      }
    }

    if (invoice) {
      const receiptNumber = await Receipt.generateReceiptNumber(attempt.tenantId);
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
      triggerSource: 'GATEWAY_RETURN',
      note: `ICICI Orange returnURL settled. Bank ref: ${parsed.bankRef || 'n/a'}.`
    }], { session });

    await session.commitTransaction();
    session.endSession();

    if (invoice) {
      try {
        await StudentBalance.updateBalance(attempt.tenantId, attempt.studentId, invoice.academicSessionId);
      } catch (balErr) {
        logger.error('iciciOrangeReturn: balance recalc failed', {
          tenantId: String(attempt.tenantId),
          studentId: String(attempt.studentId),
          error: balErr.message
        });
      }
    }
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
}

async function applyFailure(attempt, parsed) {
  const previousStatus = attempt.status;
  attempt.status = 'FAILED';
  attempt.gatewayResponse = {
    ...(attempt.gatewayResponse || {}),
    bankRef: parsed.bankRef || null,
    rawStatus: parsed.rawStatus,
    source: 'returnURL'
  };
  await attempt.save();

  await PaymentAuditLog.create({
    tenantId: attempt.tenantId,
    paymentAttemptId: attempt._id,
    previousStatus,
    newStatus: 'FAILED',
    triggerSource: 'GATEWAY_RETURN',
    note: `ICICI Orange returnURL reported failure. Status: ${parsed.rawStatus || 'unknown'}.`
  });
}

async function applyAmountMismatch(attempt, parsed) {
  const previousStatus = attempt.status;
  attempt.status = 'UNDER_REVIEW';
  attempt.gatewayResponse = {
    ...(attempt.gatewayResponse || {}),
    bankRef: parsed.bankRef || null,
    rawStatus: parsed.rawStatus,
    callbackAmount: parsed.amount,
    source: 'returnURL'
  };
  await attempt.save();

  await PaymentAuditLog.create({
    tenantId: attempt.tenantId,
    paymentAttemptId: attempt._id,
    previousStatus,
    newStatus: 'UNDER_REVIEW',
    triggerSource: 'GATEWAY_RETURN',
    note: `Amount mismatch on returnURL: callback ₹${parsed.amount} vs attempt ₹${attempt.amount}. Bank ref: ${parsed.bankRef || 'n/a'}.`
  });
}

async function handleReturn(req, res) {
  const tenantCode = String(req.params.tenantCode || '').trim().toLowerCase();
  if (!tenantCode) {
    return res.status(404).send('Not found');
  }

  // 1. Resolve tenant
  const tenant = await Tenant.findOne({ schoolCode: tenantCode });
  if (!tenant || tenant.paymentGateway?.provider !== 'icici_orange') {
    logger.warn('iciciOrangeReturn: unknown tenant or provider mismatch', {
      tenantCode,
      requestId: req.requestId
    });
    return res.status(404).send('Not found');
  }

  const cfg = tenant.paymentGateway.iciciOrange || {};
  if (!cfg.merchantId || !cfg.secureHashKey) {
    logger.error('iciciOrangeReturn: tenant has incomplete ICICI config', {
      tenantCode,
      requestId: req.requestId
    });
    return res.redirect(302, frontendStatusUrl(tenant.subdomain, 'error', { message: 'Gateway not configured' }));
  }

  // 2. Build gateway and verify the inbound signature
  const gateway = new ICICIOrangeGateway({
    merchantId: cfg.merchantId,
    aggregatorId: cfg.aggregatorId,
    secureHashKey: cfg.secureHashKey,
    environment: cfg.environment || 'production',
    tenantCode
  });

  const payload = extractPayload(req);
  if (!payload) {
    logger.warn('iciciOrangeReturn: empty payload', { tenantCode, requestId: req.requestId, method: req.method });
    return res.redirect(302, frontendStatusUrl(tenant.subdomain, 'error', { message: 'No payload received' }));
  }

  const verified = gateway.verifyReturnPayload(payload);
  if (!verified.valid) {
    logger.warn('iciciOrangeReturn: secureHash verification failed', {
      tenantCode,
      requestId: req.requestId,
      hasHash: Boolean(payload.secureHash),
      keys: Object.keys(payload)
    });
    return res.redirect(302, frontendStatusUrl(tenant.subdomain, 'error', { message: 'Signature verification failed' }));
  }

  if (!verified.merchantRef) {
    logger.warn('iciciOrangeReturn: payload missing merchantTxnNo', { tenantCode, requestId: req.requestId });
    return res.redirect(302, frontendStatusUrl(tenant.subdomain, 'error', { message: 'Could not identify transaction' }));
  }

  // 3. Look up the originating attempt — tenant-scoped
  const attempt = await PaymentAttempt.findOne({
    tenantId: tenant._id,
    gatewayRefId: verified.merchantRef
  });

  if (!attempt) {
    logger.warn('iciciOrangeReturn: no matching PaymentAttempt', {
      tenantCode,
      merchantRef: verified.merchantRef,
      requestId: req.requestId
    });
    return res.redirect(302, frontendStatusUrl(tenant.subdomain, 'error', { message: 'Transaction not found' }));
  }

  const baseExtras = {
    attemptId: attempt._id,
    ref: verified.merchantRef,
    bankRef: verified.bankRef,
    amount: attempt.amount
  };

  // Idempotent: if already settled, just redirect — do not re-credit.
  if (['SUCCESS', 'VERIFIED', 'FAILED'].includes(attempt.status)) {
    const status = attempt.status === 'FAILED' ? 'failed' : 'success';
    return res.redirect(302, frontendStatusUrl(tenant.subdomain, status, baseExtras));
  }

  // 4. Amount verification — mismatch never credits.
  if (verified.amount !== null && !moneyEquals(toNumber(verified.amount), toNumber(attempt.amount))) {
    try {
      await applyAmountMismatch(attempt, verified);
    } catch (err) {
      logger.error('iciciOrangeReturn: amount-mismatch transition failed', { error: err.message });
    }
    return res.redirect(302, frontendStatusUrl(tenant.subdomain, 'error', {
      ...baseExtras,
      message: 'Amount mismatch — under review by school office'
    }));
  }

  // 5. Apply success or failure
  try {
    if (verified.normalisedStatus === 'SUCCESS') {
      await applySuccess(attempt, verified);
      return res.redirect(302, frontendStatusUrl(tenant.subdomain, 'success', baseExtras));
    }
    if (verified.normalisedStatus === 'FAILED') {
      await applyFailure(attempt, verified);
      return res.redirect(302, frontendStatusUrl(tenant.subdomain, 'failed', {
        ...baseExtras,
        message: verified.rawStatus || 'Payment was not completed'
      }));
    }
    // PENDING / UNKNOWN — leave attempt as PROCESSING so the
    // reconciliation job's STATUS poll picks it up.
    return res.redirect(302, frontendStatusUrl(tenant.subdomain, 'error', {
      ...baseExtras,
      message: 'Payment is still being processed. Check back shortly.'
    }));
  } catch (err) {
    logger.error('iciciOrangeReturn: settlement failed', {
      tenantCode,
      attemptId: String(attempt._id),
      error: err.message,
      stack: err.stack
    });
    return res.redirect(302, frontendStatusUrl(tenant.subdomain, 'error', {
      ...baseExtras,
      message: 'Could not finalise payment'
    }));
  }
}

router.post('/:tenantCode', handleReturn);
router.get('/:tenantCode', handleReturn);

module.exports = router;
