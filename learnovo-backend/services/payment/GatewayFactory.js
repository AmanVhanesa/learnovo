const MockPaymentGateway = require('./MockPaymentGateway');
const ICICIEazypayGateway = require('./ICICIEazypayGateway');
const RazorpayGateway = require('./RazorpayGateway');

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
  case 'icici_eazypay': {
    const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5001}`;
    instance = new ICICIEazypayGateway({
      merchantId: pgConfig.icici.merchantId,
      encryptionKey: pgConfig.icici.encryptionKey,
      subMerchantId: pgConfig.icici.subMerchantId,
      paymode: pgConfig.icici.paymode || '9',
      returnUrl: `${backendUrl}/api/student-fees/payment/icici-return`
    });
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
