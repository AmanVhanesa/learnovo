/**
 * ICICI Orange payment gateway callback / webhook.
 *
 * SCOPE: SPIS production tenant only.
 *
 * Status: PASSIVE RECEIVER. ICICI's "Orange" product is not publicly
 * documented anywhere we could find — no PDF, no GitHub sample, no
 * blog post. Based on the onboarding pattern (callback URL + HTTP
 * Basic Auth credentials issued to ICICI), this is almost certainly
 * a receive-only webhook from ICICI's Corporate API Suite collections
 * stack: ICICI POSTs credit notifications to us, no initiation from
 * our side.
 *
 * Until ICICI shares the integration spec, we capture every inbound
 * request verbatim into ICICIOrangeWebhookLog, dedupe via SHA-256 of
 * the raw body, and return a clean ACK. A downstream worker will
 * later read those rows, parse fields once we know the schema, and
 * map them onto Payment / FeeInvoice / Receipt records.
 *
 * Authentication: HTTP Basic Auth. ICICI sends:
 *     Authorization: Basic base64(domainId:password)
 * We verify against env vars (per-tenant), using a constant-time
 * compare to avoid leaking timing information.
 *
 * Required env vars (set on the production VPS only — never committed):
 *     ICICI_ORANGE_SPIS_CALLBACK_USER
 *     ICICI_ORANGE_SPIS_CALLBACK_PASS
 *
 * Body parsing: server.js mounts text/xml + application/xml + text/plain
 * via express.text() on this path prefix. JSON and form-encoded bodies
 * are handled by the global parsers, which also preserve req.rawBody
 * for this path. The handler treats all three uniformly via req.rawBody.
 *
 * URL pattern:
 *     POST /api/fee-payments/webhook/icici-orange/:tenantCode  (live)
 *     GET  /api/fee-payments/webhook/icici-orange/:tenantCode  (verification)
 *
 * Currently only :tenantCode === 'spis' is accepted on POST. Any other
 * value returns 404 so the path's existence is not advertised.
 */

const express = require('express');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { logger } = require('../middleware/errorHandler');
const Tenant = require('../models/Tenant');
const ICICIOrangeWebhookLog = require('../models/ICICIOrangeWebhookLog');
const PaymentAttempt = require('../models/PaymentAttempt');
const PaymentAuditLog = require('../models/PaymentAuditLog');
const FeeInvoice = require('../models/FeeInvoice');
const Receipt = require('../models/Receipt');
const StudentBalance = require('../models/StudentBalance');
const ICICIOrangeGateway = require('../services/payment/ICICIOrangeGateway');
const iciciOrangeCallbackProcessor = require('../services/payment/iciciOrangeCallbackProcessor');
const { toNumber, roundToRupee, moneyEquals } = require('../utils/money');

const router = express.Router();

// Tenants permitted to use the ICICI Orange callback. Add entries
// here only after that tenant's credentials have been provisioned and
// stored as env vars following the same naming convention.
const ALLOWED_TENANT_CODES = new Set(['spis']);

// Env-var lookup table per tenant. Keep keys in sync with ALLOWED_TENANT_CODES.
const TENANT_CREDENTIAL_ENV = {
  spis: {
    userVar: 'ICICI_ORANGE_SPIS_CALLBACK_USER',
    passVar: 'ICICI_ORANGE_SPIS_CALLBACK_PASS'
  }
};

/**
 * Constant-time string comparison. Returns false on length mismatch
 * without leaking the actual length via timing.
 */
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const aBuf = Buffer.from(a, 'utf8');
  const bBuf = Buffer.from(b, 'utf8');
  if (aBuf.length !== bBuf.length) {
    // Still run a compare against a same-length buffer to equalise timing
    crypto.timingSafeEqual(aBuf, aBuf);
    return false;
  }
  return crypto.timingSafeEqual(aBuf, bBuf);
}

/**
 * Parse and verify the Authorization: Basic header against the
 * configured credentials for the given tenant code.
 */
function verifyBasicAuth(req, tenantCode) {
  const header = req.headers.authorization || '';
  if (!header.toLowerCase().startsWith('basic ')) return false;

  const envKeys = TENANT_CREDENTIAL_ENV[tenantCode];
  if (!envKeys) return false;

  const expectedUser = process.env[envKeys.userVar];
  const expectedPass = process.env[envKeys.passVar];
  if (!expectedUser || !expectedPass) {
    logger.error('ICICI Orange callback credentials not configured', {
      tenantCode,
      missing: [
        !expectedUser && envKeys.userVar,
        !expectedPass && envKeys.passVar
      ].filter(Boolean)
    });
    return false;
  }

  let decoded;
  try {
    decoded = Buffer.from(header.slice(6).trim(), 'base64').toString('utf8');
  } catch (_err) {
    return false;
  }

  const sepIdx = decoded.indexOf(':');
  if (sepIdx === -1) return false;
  const providedUser = decoded.slice(0, sepIdx);
  const providedPass = decoded.slice(sepIdx + 1);

  // Compare both fields with constant-time. AND must run both branches
  // every time to avoid short-circuit timing leaks.
  const userOk = safeEqual(providedUser, expectedUser);
  const passOk = safeEqual(providedPass, expectedPass);
  return userOk && passOk;
}

/**
 * Build the canonical raw-body string from whichever shape Express
 * managed to parse. The text parser stores the raw XML in req.body
 * as a string; the json/urlencoded parsers store the parsed object
 * but the global verify hook also writes req.rawBody. Always prefer
 * req.rawBody; fall back to a JSON serialisation only if the rawBody
 * was not captured.
 */
function getRawBody(req) {
  if (typeof req.rawBody === 'string' && req.rawBody.length > 0) {
    return req.rawBody;
  }
  if (typeof req.body === 'string') return req.body;
  if (req.body && typeof req.body === 'object') {
    try {
      return JSON.stringify(req.body);
    } catch (_err) {
      return '';
    }
  }
  return '';
}

/**
 * SHA-256 hex digest of the raw body. Used as the idempotency key for
 * dedup against ICICIOrangeWebhookLog. If ICICI retries the exact same
 * payload, the second insert hits the unique (tenantCode, bodyHash)
 * index and we ack-without-reprocessing.
 */
function hashBody(rawBody) {
  return crypto.createHash('sha256').update(rawBody || '').digest('hex');
}

/**
 * Persist a log row for an inbound webhook. Returns { duplicate: bool,
 * logId: string|null }. Never throws — a logging failure must not
 * cause us to return a non-2xx to ICICI (which would trigger retries).
 */
async function persistWebhookLog(req, tenantCode, authPassed) {
  const rawBody = getRawBody(req);
  const bodyHash = hashBody(rawBody);

  // Best-effort tenantId resolution — don't fail the whole request if
  // the tenant lookup errors out.
  let tenantId = null;
  try {
    const tenant = await Tenant.findOne({ schoolCode: tenantCode })
      .select('_id')
      .lean();
    if (tenant) tenantId = tenant._id;
  } catch (err) {
    logger.warn('ICICI Orange tenant lookup failed during log persist', {
      requestId: req.requestId,
      tenantCode,
      error: err.message
    });
  }

  // Curated header subset — full dump would risk persisting bearer
  // tokens or cookies that don't belong to ICICI but might land here
  // from a misrouted request.
  const safeHeaders = {
    contentType: req.headers['content-type'] || '',
    userAgent: req.headers['user-agent'] || '',
    forwardedFor: req.headers['x-forwarded-for'] || '',
    host: req.headers.host || ''
  };

  try {
    // Use new:true + rawResult:true so we get:
    //   - the actual persisted document (for logId on fresh inserts)
    //   - lastErrorObject.updatedExisting to distinguish duplicate vs new
    // The previous revision used new:false and inferred duplicate from
    // a truthy pre-doc, but that returned logId=null for genuinely new
    // callbacks — which broke downstream fire-and-forget processing.
    //
    // Auth-flag handling: ICICI's passive-callback retry pattern fires
    // an unauthenticated probe first, then retries with Basic Auth.
    // Using $setOnInsert for `authPassed` would freeze the row at the
    // first hit's value and refuse to ever process it. Promote the flag
    // when a later retry succeeds and re-queue the row for the
    // processor by clearing `processed`. We only ever upgrade
    // false→true, never downgrade, so an unauthenticated probe arriving
    // after an authenticated hit cannot un-settle the row.
    const setOnInsert = {
      tenantId,
      tenantCode,
      bodyHash,
      rawBody,
      parsedBody:
        typeof req.body === 'object' && req.body !== null ? req.body : null,
      contentType: safeHeaders.contentType,
      method: req.method,
      path: req.originalUrl,
      query: req.query || null,
      sourceIp: req.ip || safeHeaders.forwardedFor || '',
      userAgent: safeHeaders.userAgent,
      requestId: req.requestId || '',
      receivedAt: new Date()
    };
    const update = { $setOnInsert: setOnInsert };
    if (authPassed) {
      update.$set = {
        authPassed: true,
        lastAuthPassedAt: new Date(),
        processed: false,
        processError: null,
        processedAt: null
      };
    } else {
      setOnInsert.authPassed = false;
    }
    const result = await ICICIOrangeWebhookLog.findOneAndUpdate(
      { tenantCode, bodyHash },
      update,
      { upsert: true, new: true, setDefaultsOnInsert: true, rawResult: true }
    );
    const doc = result?.value || null;
    const duplicate = Boolean(result?.lastErrorObject?.updatedExisting);
    return { duplicate, logId: doc ? doc._id : null };
  } catch (err) {
    logger.error('ICICI Orange webhook log persist failed', {
      requestId: req.requestId,
      tenantCode,
      bodyHash,
      error: err.message,
      stack: err.stack
    });
    return { duplicate: false, logId: null };
  }
}

/**
 * GET /api/fee-payments/webhook/icici-orange/:tenantCode
 *
 * Self-identifying verification response. Banks doing anti-fraud /
 * domain verification often open the callback URL in a browser; if
 * that returns "Route not found" they will (reasonably) flag it as
 * suspicious. This handler returns a clean JSON descriptor that names
 * the operator, the merchant, and the endpoint contract — without
 * revealing any credentials, payload format, or auth secrets.
 *
 * No auth required: the response carries no sensitive information.
 */
/**
 * Normalise a tenantCode path param. Strips surrounding whitespace
 * (including stray %0A / %0D / %20 from copy-paste mishaps in test
 * tools like Postman or Insomnia) and lowercases. The whitelist is
 * stored lowercase, so this guarantees a deterministic match.
 */
function normaliseTenantCode(raw) {
  if (typeof raw !== 'string') return '';
  return raw.trim().toLowerCase();
}

router.get('/:tenantCode', async(req, res) => {
  const tenantCode = normaliseTenantCode(req.params.tenantCode);
  if (!ALLOWED_TENANT_CODES.has(tenantCode)) {
    return res.status(404).json({ success: false, message: 'Not found' });
  }

  // PG Direct returnURL "submitAsGet" fallback. ICICI's status-redirect
  // page wires the manual "click here" link to submit the form via GET
  // (data-click="submitAsGet" in their merchantResp.js). When the
  // browser-side auto-POST is gated off (their "isSuccess":false flag),
  // this GET is the only way the customer reaches us. We treat it
  // identically to the POST: verify secureHash, settle, redirect.
  if (typeof req.query?.secureHash === 'string' && req.query.secureHash.length > 0) {
    try {
      const tenant = await Tenant.findOne({ schoolCode: tenantCode });
      if (!tenant || tenant.paymentGateway?.provider !== 'icici_orange') {
        logger.warn('iciciOrangeReturn: provider mismatch (GET)', { tenantCode, requestId: req.requestId });
        return res.status(404).send('Not found');
      }
      // Persist for audit. persistWebhookLog and handlePgDirectReturn
      // both read req.body — swap query into body for the duration of
      // the call.
      const originalBody = req.body;
      req.body = { ...req.query };
      try {
        await persistWebhookLog(req, tenantCode, true);
      } catch (_) { /* never block redirect on logging */ }
      const redirectPath = await handlePgDirectReturn(req, tenantCode, tenant);
      req.body = originalBody;
      return res.redirect(302, redirectPath);
    } catch (err) {
      logger.error('iciciOrangeReturn: GET handler threw', {
        tenantCode,
        requestId: req.requestId,
        error: err.message,
        stack: err.stack
      });
      return res.redirect(302, '/payment/status?status=error&message=Could+not+finalise+payment');
    }
  }

  // Challenge for Basic Auth on GET too. This is intentional: the bank
  // verifies the callback URL by opening it in a browser and entering the
  // credentials into the browser's native popup. Without a 401 +
  // WWW-Authenticate challenge, the browser shows no popup at all.
  const authPassed = verifyBasicAuth(req, tenantCode);
  if (!authPassed) {
    res.set('WWW-Authenticate', 'Basic realm="ICICI Orange Callback"');
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  // Per-tenant descriptor. The legal merchant on ICICI's books is the
  // society (Sardar Patel Educational Society for SPIS), with the school
  // as the operating unit. Bank fraud-checks that browse this URL must
  // see the same legal name that ICICI has on file for the merchant
  // account, otherwise the name mismatch can trip their KYC.
  const TENANT_DESCRIPTORS = {
    spis: {
      merchant: 'Sardar Patel Educational Society',
      operatingUnit: 'SP International School'
    }
  };
  const descriptor = TENANT_DESCRIPTORS[tenantCode];
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Payment Callback Endpoint — ${descriptor.operatingUnit}</title>
  <style>
    body { font-family: Arial, sans-serif; background: #f4f6f9; margin: 0; padding: 40px 20px; }
    .card { background: #fff; border-radius: 8px; max-width: 560px; margin: 0 auto; padding: 36px 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.10); }
    .badge { display: inline-block; background: #22c55e; color: #fff; font-size: 12px; font-weight: 700; letter-spacing: 1px; padding: 3px 10px; border-radius: 12px; margin-bottom: 20px; text-transform: uppercase; }
    h1 { font-size: 22px; color: #1a1a2e; margin: 0 0 4px; }
    h2 { font-size: 15px; color: #555; font-weight: 400; margin: 0 0 28px; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    td { padding: 10px 0; border-bottom: 1px solid #eee; vertical-align: top; }
    td:first-child { color: #888; width: 44%; }
    td:last-child { color: #1a1a2e; font-weight: 500; }
    tr:last-child td { border-bottom: none; }
    .footer { margin-top: 28px; font-size: 12px; color: #aaa; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">&#10003; Active</div>
    <h1>${descriptor.operatingUnit}</h1>
    <h2>${descriptor.merchant}</h2>
    <table>
      <tr><td>Merchant Name</td><td>${descriptor.merchant}</td></tr>
      <tr><td>School / Unit</td><td>${descriptor.operatingUnit}</td></tr>
      <tr><td>Platform</td><td>Learnovo School Management</td></tr>
      <tr><td>Callback Type</td><td>ICICI Orange Payment Notification</td></tr>
      <tr><td>Authentication</td><td>HTTP Basic Auth</td></tr>
      <tr><td>Endpoint Status</td><td>Active &amp; Accepting</td></tr>
      <tr><td>Accepted Methods</td><td>POST (live notifications)</td></tr>
    </table>
    <div class="footer">This endpoint receives payment callbacks from ICICI Bank securely over HTTPS.</div>
  </div>
</body>
</html>`;
  return res.status(200).set('Content-Type', 'text/html').send(html);
});

/**
 * POST /api/fee-payments/webhook/icici-orange/:tenantCode
 *
 * Public endpoint (no JWT) — authentication is HTTP Basic Auth via env
 * vars provisioned to ICICI during onboarding. The route is mounted
 * BEFORE the generic /api/fee-payments router in server.js so this path
 * is matched first.
 */
/**
 * Detect a PG Direct returnURL post-back. The bank's customer-facing
 * redirect always carries `merchantTxnNo` (and usually `merchantId`),
 * but the secureHash is sometimes absent — observed on cancelled
 * transactions and on the manual "click here" redirect from
 * pgpay.icicibank.com/pg/api/statusCheckRedirect. We discriminate on
 * merchantTxnNo, and trust the body only when the secureHash verifies
 * (otherwise we fall back to a signed server-to-server STATUS check).
 *
 * Also handles GET (with query params) and form-encoded POST.
 */
function isPgDirectReturn(req) {
  const body = req.body;
  const query = req.query || {};
  const haveTxnNo = (body && typeof body === 'object' && typeof body.merchantTxnNo === 'string' && body.merchantTxnNo.length > 0)
    || (typeof query.merchantTxnNo === 'string' && query.merchantTxnNo.length > 0);
  return haveTxnNo;
}

/**
 * Build the canonical return-payload object from whichever transport
 * the bank used (form POST → req.body, GET redirect → req.query).
 */
function getReturnPayload(req) {
  if (req.body && typeof req.body === 'object' && req.body.merchantTxnNo) return req.body;
  if (req.query && req.query.merchantTxnNo) return req.query;
  return req.body || req.query || {};
}

/**
 * Build the redirect URL back to the SPA's /payment/status page on the
 * SAME host the request arrived on. ICICI's returnURL is the tenant
 * subdomain (e.g. spis.learnovoportal.com), and that's also where the
 * frontend SPA lives, so a relative redirect lands in the right place.
 */
function buildStatusRedirect(status, extras = {}) {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (extras.attemptId) params.set('attemptId', String(extras.attemptId));
  if (extras.ref) params.set('ref', String(extras.ref));
  if (extras.bankRef) params.set('bankRef', String(extras.bankRef));
  if (extras.amount !== undefined && extras.amount !== null) {
    params.set('amount', String(extras.amount));
  }
  if (extras.message) params.set('message', String(extras.message));
  return `/payment/status?${params.toString()}`;
}

async function applyReturnSuccess(attempt, parsed) {
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

async function applyReturnFailure(attempt, parsed) {
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

async function applyReturnAmountMismatch(attempt, parsed) {
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

/**
 * Handle the PG Direct returnURL post-back. Verifies the secureHash,
 * settles the PaymentAttempt, then 302-redirects the customer's browser
 * back to the SPA's /payment/status page.
 *
 * Returns the redirect path (caller wires the response).
 */
async function handlePgDirectReturn(req, tenantCode, tenant) {
  const cfg = tenant.paymentGateway?.iciciOrange || {};
  if (!cfg.merchantId || !cfg.secureHashKey) {
    logger.error('iciciOrangeReturn: tenant has incomplete ICICI config', {
      tenantCode,
      requestId: req.requestId
    });
    return buildStatusRedirect('error', { message: 'Gateway not configured' });
  }

  const gateway = new ICICIOrangeGateway({
    merchantId: cfg.merchantId,
    aggregatorId: cfg.aggregatorId,
    secureHashKey: cfg.secureHashKey,
    environment: cfg.environment || 'production',
    tenantCode
  });

  const payload = getReturnPayload(req);
  const merchantRef = typeof payload.merchantTxnNo === 'string' && payload.merchantTxnNo.length > 0
    ? payload.merchantTxnNo
    : null;

  if (!merchantRef) {
    logger.warn('iciciOrangeReturn: payload missing merchantTxnNo', { tenantCode, requestId: req.requestId });
    return buildStatusRedirect('error', { message: 'Could not identify transaction' });
  }

  // Tenant-scoped attempt lookup. We always look this up first so we
  // can redirect the customer to a meaningful status page even if the
  // body verification or STATUS call fails.
  const attempt = await PaymentAttempt.findOne({
    tenantId: tenant._id,
    gatewayRefId: merchantRef
  });

  if (!attempt) {
    logger.warn('iciciOrangeReturn: no matching PaymentAttempt', {
      tenantCode,
      merchantRef,
      requestId: req.requestId
    });
    return buildStatusRedirect('error', { ref: merchantRef, message: 'Transaction not found' });
  }

  const baseExtras = {
    attemptId: attempt._id,
    ref: merchantRef,
    amount: attempt.amount
  };

  // Idempotent: already terminal — just redirect.
  if (['SUCCESS', 'VERIFIED', 'FAILED'].includes(attempt.status)) {
    const settled = attempt.status === 'FAILED' ? 'failed' : 'success';
    return buildStatusRedirect(settled, baseExtras);
  }

  // Decide the trust source for the outcome. The body is trustworthy
  // ONLY when its secureHash verifies. Otherwise fall back to a signed
  // server-to-server STATUS call — this is the bank's recommended way
  // to confirm an ambiguous returnURL post.
  let outcome = null;          // { normalisedStatus, rawStatus, bankRef, amount, source }
  const bodyVerified = gateway.verifyReturnPayload(payload);
  if (bodyVerified.valid) {
    outcome = {
      normalisedStatus: bodyVerified.normalisedStatus,
      rawStatus: bodyVerified.rawStatus,
      bankRef: bodyVerified.bankRef,
      amount: bodyVerified.amount,
      source: 'returnURL'
    };
  } else {
    logger.warn('iciciOrangeReturn: body secureHash invalid/missing — falling back to STATUS query', {
      tenantCode,
      requestId: req.requestId,
      merchantRef,
      hasHash: Boolean(payload.secureHash),
      bodyKeys: Object.keys(payload)
    });
    try {
      const status = await gateway.checkStatus(merchantRef);
      outcome = {
        normalisedStatus: status.status,
        rawStatus: status.raw?.txnStatus || status.raw?.responseCode,
        bankRef: status.raw?.txnID || status.raw?.txnAuthID || null,
        amount: status.raw?.amount !== undefined ? Number(status.raw.amount) : null,
        source: 'statusCheck'
      };
    } catch (statusErr) {
      logger.error('iciciOrangeReturn: STATUS query failed', {
        tenantCode,
        requestId: req.requestId,
        merchantRef,
        error: statusErr.message
      });
      // Best the customer can see: a "pending" page. The reconciliation
      // job will keep trying to settle this attempt asynchronously.
      return buildStatusRedirect('error', {
        ...baseExtras,
        message: 'Payment is being verified. You will see the final status on your fee page shortly.'
      });
    }
  }

  baseExtras.bankRef = outcome.bankRef;

  // Amount mismatch never credits — under review.
  if (outcome.normalisedStatus === 'SUCCESS'
      && outcome.amount !== null
      && !moneyEquals(toNumber(outcome.amount), toNumber(attempt.amount))) {
    try {
      await applyReturnAmountMismatch(attempt, outcome);
    } catch (err) {
      logger.error('iciciOrangeReturn: amount-mismatch transition failed', { error: err.message });
    }
    return buildStatusRedirect('error', { ...baseExtras, message: 'Amount mismatch — under review by school office' });
  }

  try {
    if (outcome.normalisedStatus === 'SUCCESS') {
      await applyReturnSuccess(attempt, outcome);
      return buildStatusRedirect('success', baseExtras);
    }
    if (outcome.normalisedStatus === 'FAILED') {
      await applyReturnFailure(attempt, outcome);
      return buildStatusRedirect('failed', { ...baseExtras, message: outcome.rawStatus || 'Payment was not completed' });
    }
    return buildStatusRedirect('error', { ...baseExtras, message: 'Payment is still being processed. Check back shortly.' });
  } catch (err) {
    logger.error('iciciOrangeReturn: settlement failed', {
      tenantCode,
      attemptId: String(attempt._id),
      error: err.message,
      stack: err.stack
    });
    return buildStatusRedirect('error', { ...baseExtras, message: 'Could not finalise payment' });
  }
}

router.post('/:tenantCode', async(req, res) => {
  const tenantCode = normaliseTenantCode(req.params.tenantCode);
  const requestId = req.requestId;

  // 1. Tenant gate — only whitelisted tenants are accepted. Return 404
  //    (not 403) so the path's existence is not advertised to scanners.
  if (!ALLOWED_TENANT_CODES.has(tenantCode)) {
    logger.warn('ICICI Orange callback hit for non-whitelisted tenant', {
      requestId,
      tenantCode,
      ip: req.ip
    });
    return res.status(404).json({ success: false, message: 'Not found' });
  }

  // 2a. PG Direct returnURL flow — the bank POSTs the txn response with
  //     a secureHash field (no Basic Auth). Verify, settle, redirect the
  //     customer to /payment/status. This is the live path for SPIS.
  if (isPgDirectReturn(req)) {
    const tenant = await Tenant.findOne({ schoolCode: tenantCode });
    if (!tenant || tenant.paymentGateway?.provider !== 'icici_orange') {
      logger.warn('iciciOrangeReturn: provider mismatch', { tenantCode, requestId });
      return res.status(404).send('Not found');
    }
    // Persist the inbound payload for audit (no Basic Auth on this flow,
    // so authPassed is true by virtue of secureHash verification, which
    // happens inside handlePgDirectReturn).
    try {
      await persistWebhookLog(req, tenantCode, true);
    } catch (_) {
      /* swallow — never block the customer redirect on a logging error */
    }

    const redirectPath = await handlePgDirectReturn(req, tenantCode, tenant);
    return res.redirect(302, redirectPath);
  }

  // 2b. Legacy passive callback flow — HTTP Basic Auth.
  const authPassed = verifyBasicAuth(req, tenantCode);

  // 3. Persist the inbound request to the forensic log. Idempotent
  //    via (tenantCode, bodyHash) unique index — same payload retried
  //    by ICICI is recorded once.
  const { duplicate, logId } = await persistWebhookLog(req, tenantCode, authPassed);

  if (!authPassed) {
    logger.warn('ICICI Orange callback auth failed', {
      requestId,
      tenantCode,
      ip: req.ip,
      hasAuthHeader: Boolean(req.headers.authorization),
      logId
    });

    // Customer-browser fallback. ICICI's status-redirect page
    // (pgpay.icicibank.com/pg/api/statusCheckRedirect) sometimes posts
    // a stripped-down payload — without secureHash and without Basic
    // Auth — when the customer clicks the manual "click here" link.
    // For those requests, returning 401 + WWW-Authenticate triggers a
    // browser credential popup the customer can't satisfy, leaving
    // them stranded. Detect the browser by Accept/Sec-Fetch headers,
    // look up the PaymentAttempt by merchantTxnNo, and redirect them
    // to /payment/status with the current settled state. Server-to-
    // server callbacks (the real ICICI notification host) keep the
    // 401 challenge — they're expected to send proper credentials.
    const looksLikeBrowser =
      typeof req.headers.accept === 'string' && req.headers.accept.includes('text/html')
      || typeof req.headers['sec-fetch-mode'] === 'string';
    const merchantRef =
      typeof req.body?.merchantTxnNo === 'string' ? req.body.merchantTxnNo : null;

    if (looksLikeBrowser) {
      const baseExtras = merchantRef ? { ref: merchantRef } : {};
      if (merchantRef) {
        try {
          const attempt = await PaymentAttempt.findOne({
            gatewayRefId: merchantRef
          });
          if (attempt) {
            const settledStatus =
              attempt.status === 'SUCCESS' || attempt.status === 'VERIFIED'
                ? 'success'
                : attempt.status === 'FAILED'
                  ? 'failed'
                  : 'pending';
            return res.redirect(
              302,
              buildStatusRedirect(settledStatus, {
                attemptId: attempt._id,
                ref: merchantRef,
                amount: attempt.amount
              })
            );
          }
        } catch (lookupErr) {
          logger.error('iciciOrangeReturn: browser-fallback lookup failed', {
            requestId,
            tenantCode,
            merchantRef,
            error: lookupErr.message
          });
        }
      }
      return res.redirect(
        302,
        buildStatusRedirect('pending', {
          ...baseExtras,
          message: 'Payment is being verified. You will see the updated status on your fee page shortly.'
        })
      );
    }

    res.set('WWW-Authenticate', 'Basic realm="ICICI Orange Callback"');
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  // 4. Structured live-tail log so the integration team can `pm2 logs`
  //    while ICICI is testing. The full payload is in Mongo via logId.
  logger.info('ICICI Orange callback received', {
    requestId,
    tenantCode,
    logId,
    duplicate,
    contentType: req.headers['content-type'],
    bodyKeys:
      req.body && typeof req.body === 'object' && !Array.isArray(req.body)
        ? Object.keys(req.body)
        : null,
    rawBodyLength: typeof req.rawBody === 'string' ? req.rawBody.length : 0
  });

  // 5. Acknowledge. Most Indian bank gateways expect a plain 200 with
  //    a short JSON ACK. We return {status:"OK"} per the integration
  //    research recommendation; if ICICI's spec later requires a
  //    different shape, change this once.
  res.status(200).json({
    status: 'OK',
    message: duplicate ? 'Duplicate (already received)' : 'Callback received',
    requestId
  });

  // 6. Fire-and-forget: map the log into a PaymentAttempt state
  //    transition AFTER we've acked. Running async guarantees ICICI
  //    never sees a 5xx if the processor hits an unexpected error —
  //    any failure is captured onto the log row itself (processError)
  //    so the sweep can retry and an admin can inspect. Duplicate
  //    logs short-circuit inside the processor (processed=true), so
  //    calling it on a duplicate is safe.
  if (logId) {
    setImmediate(async() => {
      try {
        const result = await iciciOrangeCallbackProcessor.processLog(logId);
        logger.info('ICICI Orange callback processed', {
          requestId,
          tenantCode,
          logId,
          processorReason: result?.reason,
          paymentAttemptId: result?.paymentAttemptId ? String(result.paymentAttemptId) : null
        });
      } catch (err) {
        logger.error('ICICI Orange callback processor threw', {
          requestId,
          tenantCode,
          logId,
          error: err.message,
          stack: err.stack
        });
      }
    });
  }
});

module.exports = router;
