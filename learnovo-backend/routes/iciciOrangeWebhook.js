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
const { logger } = require('../middleware/errorHandler');
const Tenant = require('../models/Tenant');
const ICICIOrangeWebhookLog = require('../models/ICICIOrangeWebhookLog');

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
    const doc = await ICICIOrangeWebhookLog.findOneAndUpdate(
      { tenantCode, bodyHash },
      {
        $setOnInsert: {
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
          authPassed,
          receivedAt: new Date()
        }
      },
      { upsert: true, new: false, setDefaultsOnInsert: true }
    );
    // findOneAndUpdate with new:false returns the pre-update doc.
    // null pre-doc means this was a fresh insert (not a duplicate).
    return { duplicate: Boolean(doc), logId: doc ? doc._id : null };
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

router.get('/:tenantCode', (req, res) => {
  const tenantCode = normaliseTenantCode(req.params.tenantCode);
  if (!ALLOWED_TENANT_CODES.has(tenantCode)) {
    return res.status(404).json({ success: false, message: 'Not found' });
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

  // 2. HTTP Basic Auth verification. We persist BOTH successful and
  //    failed attempts (the log row carries authPassed) so we can
  //    spot misconfigured ICICI test fires and recon attempts.
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
  return res.status(200).json({
    status: 'OK',
    message: duplicate ? 'Duplicate (already received)' : 'Callback received',
    requestId
  });
});

module.exports = router;
