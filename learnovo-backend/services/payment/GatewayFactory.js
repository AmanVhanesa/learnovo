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
    // ICICI Orange gateway. The class loads with whatever credentials
    // the tenant has configured — if the MID kit is incomplete
    // (terminalId/apiKey/apiSecret still empty), outbound methods
    // throw SpecPendingError and callers can render a clean "online
    // payments pending setup" message. The inbound callback path is
    // already live and reconciles through the processor regardless of
    // whether outbound is wired yet.
    const cfg = pgConfig.iciciOrange || {};
    if (!cfg.merchantId) {
      console.warn(`ICICI Orange gateway for tenant ${tenantId} has no merchantId — returning null.`);
      return null;
    }
    try {
      instance = new ICICIOrangeGateway({
        merchantId: cfg.merchantId,
        terminalId: cfg.terminalId,
        apiKey: cfg.apiKey,
        apiSecret: cfg.apiSecret,
        tenantCode: tenant.schoolCode
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
