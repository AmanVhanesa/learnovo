const MockPaymentGateway = require('./MockPaymentGateway');
const RazorpayGateway = require('./RazorpayGateway');
const ICICIOrangeGateway = require('./ICICIOrangeGateway');

/**
 * GatewayFactory — resolves the correct payment gateway for a tenant.
 *
 * Reads the tenant's `paymentGateway` config and returns an instance of
 * the appropriate gateway class. Falls back to MockPaymentGateway in
 * development when no real gateway is configured.
 */

// Cache gateway instances per tenant to avoid re-creating on every request
const gatewayCache = new Map();

function getGateway(tenant) {
  if (!tenant) {
    return new MockPaymentGateway();
  }

  const tenantId = tenant._id.toString();
  const pgConfig = tenant.paymentGateway;

  // No gateway configured or not active → mock in dev, throw in prod
  if (!pgConfig || !pgConfig.isActive || pgConfig.provider === 'none') {
    if (process.env.NODE_ENV === 'production') {
      return null; // Caller should check and return "payment gateway not configured"
    }
    return new MockPaymentGateway();
  }

  // Check cache — invalidate if provider changed
  const cached = gatewayCache.get(tenantId);
  if (cached && cached.provider === pgConfig.provider) {
    return cached.instance;
  }

  let instance;

  switch (pgConfig.provider) {
  case 'icici_orange': {
    // ICICI Orange (PG Direct) gateway. The class loads with the
    // merchantId/aggregatorId/secureHashKey provisioned per-tenant.
    // returnURL is computed from BACKEND_URL + the tenant's schoolCode
    // so multiple tenants can share a single backend deployment without
    // colliding on callback routing.
    const cfg = pgConfig.iciciOrange || {};
    if (!cfg.merchantId) {
      console.warn(`ICICI Orange gateway for tenant ${tenantId} has no merchantId — returning null.`);
      return null;
    }
    // returnURL must match the URL whitelisted with ICICI for this
    // tenant. SPIS was registered with the path under the tenant
    // subdomain (spis.learnovoportal.com), which the VPS nginx proxies
    // through to the backend's webhook route — the same route handles
    // both legacy passive callbacks and the new PG Direct returnURL
    // post-back.
    const returnURL = `https://${tenant.schoolCode}.learnovoportal.com/api/fee-payments/webhook/icici-orange/${tenant.schoolCode}`;
    try {
      instance = new ICICIOrangeGateway({
        merchantId: cfg.merchantId,
        aggregatorId: cfg.aggregatorId,
        secureHashKey: cfg.secureHashKey,
        environment: cfg.environment || 'production',
        tenantCode: tenant.schoolCode,
        returnURL
      });
    } catch (err) {
      console.error(`ICICI Orange gateway construction failed for tenant ${tenantId}: ${err.message}`);
      return null;
    }
    break;
  }

  case 'razorpay': {
    instance = new RazorpayGateway({
      keyId: pgConfig.razorpay.keyId,
      keySecret: pgConfig.razorpay.keySecret,
      webhookSecret: pgConfig.razorpay.webhookSecret || ''
    });
    break;
  }

  case 'mock':
    instance = new MockPaymentGateway();
    break;

  default:
    console.warn(`Unknown payment gateway provider: ${pgConfig.provider} for tenant ${tenantId}`);
    return new MockPaymentGateway();
  }

  // Cache it
  gatewayCache.set(tenantId, { provider: pgConfig.provider, instance });
  return instance;
}

/**
 * Clear the cached gateway for a tenant (call after admin updates gateway config).
 */
function clearCache(tenantId) {
  gatewayCache.delete(tenantId.toString());
}

/**
 * Clear all cached gateways.
 */
function clearAllCaches() {
  gatewayCache.clear();
}

module.exports = { getGateway, clearCache, clearAllCaches };
