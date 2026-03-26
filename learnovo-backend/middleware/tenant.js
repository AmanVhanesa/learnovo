const Tenant = require('../models/Tenant');
const cache = require('../utils/cache');

/**
 * Base domains for subdomain extraction.
 * The first segment before any of these is treated as the tenant slug.
 * e.g. greenwood.learnovoportal.com → "greenwood"
 */
const BASE_DOMAINS = [
  'learnovoportal.com',
  'learnovo.app',
  'localhost',
];

/**
 * Segments that are never treated as a tenant subdomain.
 */
const RESERVED_SUBDOMAINS = new Set([
  'www', 'api', 'admin', 'app', 'mail', 'ftp', 'staging', 'dev',
]);

/**
 * Extract the tenant subdomain slug from a hostname.
 * Returns null when the request is on the root/naked domain or a reserved prefix.
 *
 * Examples:
 *   greenwood.learnovoportal.com  → "greenwood"
 *   www.learnovoportal.com        → null
 *   learnovoportal.com            → null
 *   greenwood.localhost            → "greenwood"  (local dev)
 *   localhost                      → null
 *   greenwood.localhost:3000       → "greenwood"  (port is stripped)
 */
function extractSubdomain(hostname) {
  if (!hostname) return null;

  // Strip port if present (e.g. greenwood.localhost:3000)
  const host = hostname.split(':')[0].toLowerCase();

  // Check against each known base domain
  for (const base of BASE_DOMAINS) {
    if (host === base) return null; // naked domain
    if (host.endsWith(`.${base}`)) {
      const prefix = host.slice(0, -(base.length + 1)); // everything before .base
      // prefix could be "greenwood" or "greenwood.us-east-1" — take first segment
      const slug = prefix.split('.')[0];
      if (!slug || RESERVED_SUBDOMAINS.has(slug)) return null;
      return slug;
    }
  }

  // Fallback: for any unknown domain with 3+ parts, treat first segment as subdomain
  // e.g. greenwood.custom-domain.com → "greenwood"
  const parts = host.split('.');
  if (parts.length >= 3) {
    const slug = parts[0];
    if (!RESERVED_SUBDOMAINS.has(slug)) return slug;
  }

  return null;
}

/**
 * Middleware to extract tenant from subdomain, X-Tenant-Subdomain header,
 * school code, or JWT.
 * Tenant documents are cached for 10 minutes to avoid repeated DB lookups.
 */
const getTenantFromRequest = async (req, res, next) => {
  try {
    let tenant = null;

    // Method 1: Extract from subdomain in Host header
    const subdomain = extractSubdomain(req.get('host'));
    if (subdomain) {
      tenant = await getCachedTenant({ subdomain, isActive: true }, `tenant:sub:${subdomain}`);
    }

    // Method 1b: Frontend can also send subdomain via header (useful when
    // the API is on a different domain than the frontend, e.g. api.learnovoportal.com)
    if (!tenant) {
      const headerSubdomain = req.get('X-Tenant-Subdomain');
      if (headerSubdomain) {
        const slug = headerSubdomain.toLowerCase().trim();
        if (slug && !RESERVED_SUBDOMAINS.has(slug)) {
          tenant = await getCachedTenant({ subdomain: slug, isActive: true }, `tenant:sub:${slug}`);
        }
      }
    }

    // Method 2: Extract from school code in request body/query
    if (!tenant && (req.body.schoolCode || req.query.schoolCode)) {
      const schoolCode = req.body.schoolCode || req.query.schoolCode;
      tenant = await getCachedTenant({ schoolCode, isActive: true }, `tenant:code:${schoolCode}`);
    }

    // Method 3: Extract from JWT token (if user is already authenticated)
    if (!tenant && req.user && req.user.tenantId) {
      tenant = await getCachedTenant({ _id: req.user.tenantId }, `tenant:id:${req.user.tenantId}`);
    }

    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'School not found or inactive'
      });
    }

    // Check subscription status
    if (tenant.subscription && tenant.subscription.status === 'suspended') {
      // Allow certain endpoints even when suspended (auth, payments, health)
      const allowedWhenSuspended = ['/api/auth/login', '/api/auth/logout', '/api/auth/me', '/api/payments/plans', '/api/payments/create-order', '/api/payments/verify', '/api/payments/subscription', '/api/fee-payments/create-order', '/api/fee-payments/verify', '/api/fee-payments/webhook', '/health'];
      const isAllowed = allowedWhenSuspended.some(path => req.path.startsWith(path) || req.originalUrl.startsWith(path));
      if (!isAllowed) {
        return res.status(403).json({
          success: false,
          code: 'SUBSCRIPTION_SUSPENDED',
          message: 'School subscription is suspended. Please contact support.',
          upgradeUrl: '/pricing',
        });
      }
    }

    // Check trial expiry
    if (tenant.subscription && tenant.subscription.status === 'trial') {
      const now = new Date();
      const trialEnd = tenant.subscription.trialEndsAt ? new Date(tenant.subscription.trialEndsAt) : null;

      if (trialEnd && now > trialEnd) {
        // Auto-update status to 'suspended' in database (fire and forget)
        Tenant.findByIdAndUpdate(tenant._id, { 'subscription.status': 'suspended' }).catch(() => {});
        // Invalidate cache for this tenant
        cache.del(`tenant:sub:${tenant.subdomain}`);
        cache.del(`tenant:code:${tenant.schoolCode}`);
        cache.del(`tenant:id:${tenant._id}`);

        // Allow certain endpoints through even after expiry
        const allowedAfterExpiry = ['/api/auth/login', '/api/auth/logout', '/api/auth/me', '/api/payments/plans', '/api/payments/create-order', '/api/payments/verify', '/api/payments/subscription', '/api/fee-payments/create-order', '/api/fee-payments/verify', '/api/fee-payments/webhook', '/health'];
        const isAllowed = allowedAfterExpiry.some(path => req.path.startsWith(path) || req.originalUrl.startsWith(path));

        if (!isAllowed) {
          const daysExpired = Math.floor((now - trialEnd) / (1000 * 60 * 60 * 24));
          return res.status(403).json({
            success: false,
            code: 'TRIAL_EXPIRED',
            message: 'Your 14-day free trial has expired. Please upgrade to continue.',
            trialEndedAt: trialEnd,
            daysExpired,
            upgradeUrl: '/pricing',
          });
        }
      }

      // Add trial info to request for use in responses
      if (trialEnd) {
        req.trialDaysRemaining = Math.max(0, Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24)));
      }
    }

    req.tenant = tenant;
    next();
  } catch (error) {
    console.error('Tenant middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while identifying school'
    });
  }
};

/**
 * Look up tenant with a cache layer (TTL 10 min).
 * Uses .lean() for speed since middleware only reads the document.
 */
async function getCachedTenant(filter, cacheKey) {
  return cache.getOrSet(
    cacheKey,
    () => Tenant.findOne(filter).lean(),
    600 // 10 minutes
  );
}

// Middleware to ensure user belongs to the correct tenant
const validateTenantAccess = (req, res, next) => {
  if (!req.user || !req.tenant) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  // Super admin can access any tenant (for platform management)
  if (req.user.role === 'superadmin') {
    return next();
  }

  // Check if user belongs to the tenant
  const tenantId = req.tenant._id ? req.tenant._id.toString() : req.tenant.toString();
  if (req.user.tenantId.toString() !== tenantId) {
    return res.status(403).json({
      success: false,
      message: 'Access denied: You do not belong to this school'
    });
  }

  next();
};

// Middleware to add tenant filter to queries
const addTenantFilter = (req, res, next) => {
  if (req.tenant) {
    req.tenantFilter = { tenantId: req.tenant._id };
  }
  next();
};

module.exports = {
  getTenantFromRequest,
  validateTenantAccess,
  addTenantFilter,
  extractSubdomain, // exported for testing and reuse
};
