/**
 * planGate middleware
 *
 * Usage: router.get('/route', auth, planGate('featureName'), handler)
 *
 * Checks that the authenticated user's tenant has the given feature enabled
 * in their plan. If not, returns 403 with an upgrade message.
 */

const { getPlanConfig, getFeatureRequiredPlan, getPlanDisplayName } = require('../utils/planConfig');

/**
 * Returns Express middleware that gates a route behind a plan feature.
 * @param {string} featureName - Key from PLANS[plan].features
 */
const planGate = (featureName) => (req, res, next) => {
    try {
        const tenant = req.tenant;

        if (!tenant) {
            return res.status(401).json({
                success: false,
                message: 'Tenant context not found. Ensure getTenantFromRequest ran first.'
            });
        }

        const plan = tenant.subscription?.plan || 'free_trial';
        const status = tenant.subscription?.status;

        // Always allow super admins through
        if (req.user?.role === 'superadmin') {
            return next();
        }

        // Expired trial or suspended — block everything
        if (status === 'suspended') {
            return res.status(403).json({
                success: false,
                message: 'Your school subscription is suspended. Please contact support.',
                code: 'SUBSCRIPTION_SUSPENDED'
            });
        }

        if (status === 'trial' && new Date() > new Date(tenant.subscription.trialEndsAt)) {
            return res.status(403).json({
                success: false,
                message: 'Your trial has expired. Please upgrade to continue.',
                code: 'TRIAL_EXPIRED'
            });
        }

        // Check custom override limits if feature is a limit check
        // (handled separately in route — this middleware handles boolean feature flags)

        const planConfig = getPlanConfig(plan);
        if (!planConfig) {
            return res.status(403).json({
                success: false,
                message: 'Unknown subscription plan. Please contact support.',
                code: 'UNKNOWN_PLAN'
            });
        }

        const hasFeature = planConfig.features[featureName];

        if (!hasFeature) {
            const requiredPlan = getFeatureRequiredPlan(featureName);
            const requiredPlanName = getPlanDisplayName(requiredPlan);
            const currentPlanName = getPlanDisplayName(plan);

            return res.status(403).json({
                success: false,
                message: `This feature is not available on your current plan (${currentPlanName}).`,
                upgrade: {
                    requiredPlan,
                    requiredPlanName,
                    currentPlan: plan,
                    currentPlanName
                },
                code: 'PLAN_LIMIT_EXCEEDED'
            });
        }

        next();
    } catch (err) {
        next(err);
    }
};

/**
 * Limit gate — checks that usage doesn't exceed plan/custom limits.
 * @param {string} limitKey - 'students' or 'teachers'
 * @param {Function} getCount - async fn(req) => currentCount
 */
const limitGate = (limitKey, getCount) => async (req, res, next) => {
    try {
        const tenant = req.tenant;
        if (!tenant) return next();

        // Super admin bypass
        if (req.user?.role === 'superadmin') return next();

        const plan = tenant.subscription?.plan || 'free_trial';
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
                message: `You have reached the maximum ${limitKey} limit (${limit}) for your plan.`,
                currentCount,
                limit,
                code: 'USAGE_LIMIT_EXCEEDED',
                upgrade: {
                    currentPlan: plan,
                    currentPlanName: getPlanDisplayName(plan),
                }
            });
        }

        next();
    } catch (err) {
        next(err);
    }
};

module.exports = { planGate, limitGate };
