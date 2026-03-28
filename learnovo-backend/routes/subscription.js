const express = require('express');
const { protect } = require('../middleware/auth');
const { getTenantFromRequest, validateTenantAccess } = require('../middleware/tenant');
const User = require('../models/User');
const { getPlanConfig, PLAN_TIER_ORDER } = require('../utils/planConfig');

const router = express.Router();

// @desc    Get subscription status with limits, usage, and features
// @route   GET /api/subscription/status
// @access  Private
router.get('/status', protect, getTenantFromRequest, validateTenantAccess, async(req, res) => {
  try {
    const tenant = req.tenant;
    const plan = tenant.subscription?.plan || 'free';
    const status = tenant.subscription?.status || 'trial';
    const planConfig = getPlanConfig(plan);

    // Count current usage in parallel
    const [studentCount, teacherCount] = await Promise.all([
      User.countDocuments({ tenantId: tenant._id, role: 'student', isActive: true }),
      User.countDocuments({
        tenantId: tenant._id,
        role: { $in: ['teacher', 'principal', 'vice_principal'] },
        isActive: true
      })
    ]);

    // Calculate limits (respect custom overrides)
    const maxStudents = tenant.subscription?.customLimits?.students ?? planConfig.limits.students;
    const maxTeachers = tenant.subscription?.customLimits?.teachers ?? planConfig.limits.teachers;

    const studentPercentage = maxStudents === Infinity ? 0 : Math.round((studentCount / maxStudents) * 1000) / 10;
    const teacherPercentage = maxTeachers === Infinity ? 0 : Math.round((teacherCount / maxTeachers) * 1000) / 10;

    // Trial info
    let trialDaysRemaining = null;
    if (status === 'trial' && tenant.subscription?.trialEndsAt) {
      const now = new Date();
      const trialEnd = new Date(tenant.subscription.trialEndsAt);
      trialDaysRemaining = Math.max(0, Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24)));
    }

    // Find the next tier up
    const currentTierIdx = PLAN_TIER_ORDER.indexOf(plan);
    let nextPlan = null;
    if (currentTierIdx >= 0 && currentTierIdx < PLAN_TIER_ORDER.length - 1) {
      const nextSlug = PLAN_TIER_ORDER[currentTierIdx + 1];
      const nextConfig = getPlanConfig(nextSlug);
      if (nextConfig) {
        // Find features the next plan adds
        const additionalFeatures = [];
        const featureLabels = {
          grades: 'Grades & Exams',
          exams: 'Grades & Exams',
          feesFinance: 'Fees & Finance',
          basicReports: 'Basic Reports',
          csvImport: 'CSV Import',
          parentPortal: 'Parent Portal',
          advancedAnalytics: 'Advanced Analytics',
          customReports: 'Custom Reports',
          apiAccess: 'API Access',
          paymentGateway: 'Payment Gateway',
          smsWhatsappAlerts: 'SMS & WhatsApp',
          customIntegrations: 'Custom Integrations',
          whiteLabel: 'White-label',
          onPremise: 'On-premise'
        };
        for (const [key, label] of Object.entries(featureLabels)) {
          if (nextConfig.features[key] && !planConfig.features[key]) {
            additionalFeatures.push(label);
          }
        }
        // Deduplicate
        const uniqueFeatures = [...new Set(additionalFeatures)];

        nextPlan = {
          name: nextConfig.name,
          slug: nextSlug,
          price: nextConfig.price,
          additionalFeatures: uniqueFeatures
        };
      }
    }

    res.json({
      success: true,
      data: {
        plan,
        planName: planConfig.name,
        status,
        trialDaysRemaining,
        trialEndsAt: tenant.subscription?.trialEndsAt || null,
        limits: {
          students: {
            max: maxStudents === Infinity ? -1 : maxStudents,
            current: studentCount,
            percentage: studentPercentage
          },
          teachers: {
            max: maxTeachers === Infinity ? -1 : maxTeachers,
            current: teacherCount,
            percentage: teacherPercentage
          }
        },
        features: planConfig.features,
        nextPlan
      }
    });
  } catch (error) {
    console.error('Get subscription status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subscription status'
    });
  }
});

module.exports = router;
