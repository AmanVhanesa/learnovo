const Tenant = require('../models/Tenant');

// Middleware to extract tenant from subdomain or school code
const getTenantFromRequest = async(req, res, next) => {
  try {
    let tenant = null;

    // Method 1: Extract from subdomain (e.g., schoolname.mysms.com)
    const host = req.get('host');
    if (host && host.includes('.')) {
      const subdomain = host.split('.')[0];
      if (subdomain !== 'www' && subdomain !== 'localhost') {
        tenant = await Tenant.findOne({
          subdomain: subdomain,
          isActive: true
        });
      }
    }

    // Method 2: Extract from school code in request body/query
    if (!tenant && (req.body.schoolCode || req.query.schoolCode)) {
      const schoolCode = req.body.schoolCode || req.query.schoolCode;
      tenant = await Tenant.findOne({
        schoolCode: schoolCode,
        isActive: true
      });
    }

    // Method 3: Extract from JWT token (if user is already authenticated)
    if (!tenant && req.user && req.user.tenantId) {
      tenant = await Tenant.findById(req.user.tenantId);
    }

    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'School not found or inactive'
      });
    }

    // Check subscription status
    if (tenant.subscription.status === 'suspended') {
      return res.status(403).json({
        success: false,
        message: 'School subscription is suspended. Please contact support.'
      });
    }

    // Check trial expiry
    if (tenant.subscription.status === 'trial' && new Date() > tenant.subscription.trialEndsAt) {
      return res.status(403).json({
        success: false,
        message: 'Trial period has expired. Please upgrade your subscription.'
      });
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
  if (req.user.tenantId.toString() !== req.tenant._id.toString()) {
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
  addTenantFilter
};
