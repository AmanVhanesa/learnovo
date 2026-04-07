/**
 * ICICI Orange payment gateway callback / webhook.
 *
 * SCOPE: SPIS production tenant only.
 *
 * Status: SCAFFOLD. ICICI's dev team has provisioned a current account for
 * SP International School and requested a callback URL + Basic Auth
 * credentials. The actual payload format and signature scheme have NOT
 * been shared yet. This file gives ICICI a live, authenticated endpoint
 * to test connectivity against, and captures every incoming request to
 * a structured log so we can reverse-engineer the payload shape from
 * their first test posts. Payment-status processing will be implemented
 * once their integration spec arrives.
 *
 * Authentication: HTTP Basic Auth. ICICI sends:
 *     Authorization: Basic base64(domainId:password)
 * We verify against env vars (per-tenant), using a constant-time compare
 * to avoid leaking timing information.
 *
 * Required env vars (set on the production VPS only — never committed):
 *     ICICI_ORANGE_SPIS_CALLBACK_USER
 *     ICICI_ORANGE_SPIS_CALLBACK_PASS
 *
 * URL pattern:
 *     POST /api/fee-payments/webhook/icici-orange/:tenantCode
 *
 * Currently only :tenantCode === 'spis' is accepted. Any other value
 * returns 404 so we don't accidentally expose this to other tenants
 * before their own credentials are provisioned.
 */

const express = require('express');
const crypto = require('crypto');
const { logger } = require('../middleware/errorHandler');

const router = express.Router();

// Tenants permitted to use the ICICI Orange callback. Add more entries
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
 * POST /api/fee-payments/webhook/icici-orange/:tenantCode
 *
 * Public endpoint (no JWT) — authentication is HTTP Basic Auth via env
 * vars provisioned to ICICI during onboarding. The route is mounted
 * BEFORE the generic /api/fee-payments router in server.js so this path
 * is matched first.
 */
router.post('/:tenantCode', (req, res) => {
  const { tenantCode } = req.params;
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

  // 2. HTTP Basic Auth verification.
  if (!verifyBasicAuth(req, tenantCode)) {
    logger.warn('ICICI Orange callback auth failed', {
      requestId,
      tenantCode,
      ip: req.ip,
      hasAuthHeader: Boolean(req.headers.authorization)
    });
    res.set('WWW-Authenticate', 'Basic realm="ICICI Orange Callback"');
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  // 3. Capture the full incoming payload for analysis.
  //    Until ICICI shares the integration spec, we do NOT attempt to
  //    parse fields or update payment records. We log everything so the
  //    first real callbacks can be inspected to determine the schema.
  logger.info('ICICI Orange callback received', {
    requestId,
    tenantCode,
    contentType: req.headers['content-type'],
    method: req.method,
    query: req.query,
    bodyKeys: req.body && typeof req.body === 'object' ? Object.keys(req.body) : null,
    body: req.body,
    rawBody: req.rawBody || null,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  });

  // 4. Acknowledge. Most Indian bank gateways expect a plain 200 OK to
  //    consider the callback delivered. We return JSON for our own
  //    debugging; if ICICI's spec later requires a specific response
  //    body or content-type, change this once.
  return res.status(200).json({
    success: true,
    message: 'Callback received',
    requestId
  });
});

module.exports = router;
