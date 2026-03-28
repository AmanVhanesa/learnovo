/**
 * Plan gating middleware for Learnovo.
 *
 * Provides three types of access control:
 * 1. requireActiveSubscription — blocks expired trials & suspended accounts
 * 2. requireFeature(featureName)  — blocks if plan doesn't include a feature
 * 3. limitGate(limitKey, getCount) — blocks when usage limit reached
 *
 * Convenience exports for common gates (checkStudentLimit, checkGrades, etc.)
 */

const { getPlanConfig, getFeatureRequiredPlan, getPlanDisplayName, hasFeature } = require('../utils/planConfig');
const Tenant = require('../models/Tenant');

/**
 * Resolve the tenant from req.tenant or req.user.tenantId.
 * Some routes set req.tenant via tenant middleware, others only have req.user.tenantId via protect.
 */
async function resolveTenant(req) {
  if (req.tenant) return req.tenant;
  if (req.user?.tenantId) {
    const tenant = await Tenant.findById(req.user.tenantId).lean();
    if (tenant) {
      req.tenant = tenant; // cache for subsequent middleware
    }
    return tenant;
  }
  return null;
}

// ─── CHECK 1: Subscription status ──────────────────────────────────────
const requireActiveSubscription = async(req, res, next) => {
  try {
    // Skip if no user context yet (protect middleware will handle auth)
    if (!req.user) return next();

    const tenant = await resolveTenant(req);
    if (!tenant) {
      return res.status(403).json({ success: false, message: 'Tenant not found' });
    }

    // Super admin bypass
    if (req.user?.role === 'superadmin') return next();

    const { status, trialEndsAt } = tenant.subscription || {};

    if (status === 'trial' && trialEndsAt && new Date() > new Date(trialEndsAt)) {
      return res.status(403).json({
        success: false,
        code: 'TRIAL_EXPIRED',
        message: 'Your 14-day free trial has expired. Please upgrade to continue.',
        upgradeUrl: '/pricing'
      });
    }

    if (status === 'suspended') {
      return res.status(403).json({
        success: false,
        code: 'SUBSCRIPTION_SUSPENDED',
        message: 'Your subscription has been suspended. Please contact support.'
      });
    }

    if (status === 'cancelled') {
      return res.status(403).json({
        success: false,
        code: 'SUBSCRIPTION_CANCELLED',
        message: 'Your subscription has been cancelled. Please renew to continue.',
        upgradeUrl: '/pricing'
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};

// ─── CHECK 2: Feature gate ─────────────────────────────────────────────
const requireFeature = (featureName) => {
  return async(req, res, next) => {
    try {
      // Skip if no user context yet (protect middleware will handle auth)
      if (!req.user) return next();

      const tenant = await resolveTenant(req);
      if (!tenant) {
        return res.status(403).json({ success: false, message: 'Tenant not found' });
      }

      // Super admin bypass
      if (req.user?.role === 'superadmin') return next();

      const plan = tenant.subscription?.plan || 'free';

      if (!hasFeature(plan, featureName)) {
        const planConfig = getPlanConfig(plan);
        const requiredPlan = getFeatureRequiredPlan(featureName);

        return res.status(403).json({
          success: false,
          code: 'FEATURE_NOT_IN_PLAN',
          message: `This feature is not available on your ${planConfig.name} plan.`,
          feature: featureName,
          currentPlan: plan,
          currentPlanName: planConfig.name,
          requiredPlan: requiredPlan || 'enterprise',
          requiredPlanName: getPlanDisplayName(requiredPlan || 'enterprise'),
          upgradeUrl: '/pricing'
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

// ─── CHECK 3: Usage limit gate ─────────────────────────────────────────
const limitGate = (limitKey, getCount) => {
  return async(req, res, next) => {
    try {
      // Skip if no user context yet
      if (!req.user) return next();

      const tenant = await resolveTenant(req);
      if (!tenant) return next();

      // Super admin bypass
      if (req.user?.role === 'superadmin') return next();

      const plan = tenant.subscription?.plan || 'free';
      const planConfig = getPlanConfig(plan);

      // Check custom override first, then plan default
      const limit = tenant.subscription?.customLimits?.[limitKey]
                ?? planConfig?.limits?.[limitKey]
                ?? Infinity;

      if (limit === Infinity) return next();

      const currentCount = await getCount(req);

      if (currentCount >= limit) {
        return res.status(403).json({
          success: false,
          code: 'USAGE_LIMIT_EXCEEDED',
          message: `You have reached the maximum of ${limit} ${limitKey} on your ${planConfig.name} plan.`,
          currentCount,
          limit,
          currentPlan: plan,
          currentPlanName: planConfig.name,
          upgradeUrl: '/pricing'
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

// ─── Convenience: Student limit ────────────────────────────────────────
const checkStudentLimit = limitGate('students', async(req) => {
  const User = require('../models/User');
  return User.countDocuments({
    tenantId: req.tenant._id,
    role: 'student',
    isActive: true
  });
});

// ─── Convenience: Teacher limit ────────────────────────────────────────
const checkTeacherLimit = async(req, res, next) => {
  // Only enforce for teacher-type roles
  const teacherRoles = ['teacher', 'principal', 'vice_principal'];
  const role = req.body?.role;
  if (role && !teacherRoles.includes(role)) {
    return next(); // Not a teacher role, skip
  }

  const gate = limitGate('teachers', async(r) => {
    const User = require('../models/User');
    return User.countDocuments({
      tenantId: r.tenant._id,
      role: { $in: ['teacher', 'principal', 'vice_principal'] },
      isActive: true
    });
  });

  return gate(req, res, next);
};

// ─── Convenience: Feature gates ────────────────────────────────────────
const checkGrades = requireFeature('grades');
const checkExams = requireFeature('exams');
const checkGradesAndExams = requireFeature('grades'); // grades + exams are gated together
const checkFeesAndFinance = requireFeature('feesFinance');
const checkCsvImport = requireFeature('csvImport');
const checkParentPortal = requireFeature('parentPortal');
const checkPaymentGateway = requireFeature('paymentGateway');
const checkBasicReports = requireFeature('basicReports');
const checkAdvancedAnalytics = requireFeature('advancedAnalytics');
const checkCustomReports = requireFeature('customReports');
const checkSmsWhatsapp = requireFeature('smsWhatsappAlerts');
const checkApiAccess = requireFeature('apiAccess');

module.exports = {
  requireActiveSubscription,
  requireFeature,
  limitGate,
  checkStudentLimit,
  checkTeacherLimit,
  checkGrades,
  checkExams,
  checkGradesAndExams,
  checkFeesAndFinance,
  checkCsvImport,
  checkParentPortal,
  checkPaymentGateway,
  checkBasicReports,
  checkAdvancedAnalytics,
  checkCustomReports,
  checkSmsWhatsapp,
  checkApiAccess
};
