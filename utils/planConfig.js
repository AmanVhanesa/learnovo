/**
 * Learnovo Subscription Plan Configuration
 *
 * Defines all plan tiers with their features and limits.
 * Used by planGate middleware to enforce feature/limit access control.
 */

const PLANS = {
    free_trial: {
        name: 'Free Trial',
        price: 0,
        durationDays: 14,
        limits: {
            students: 100,
            teachers: 10
        },
        features: {
            attendanceTracking: true, // basic only
            grades: false,
            advancedAnalytics: false,
            customReports: false,
            basicReports: false,
            apiAccess: false,
            csvImport: false,
            emailSupport: true,
            prioritySupport: false,
            phoneSupport: false,
            dedicatedSupport: false,
            customIntegrations: false,
            onPremise: false,
            slaGuarantee: false
        }
    },
    basic: {
        name: 'Basic',
        price: 29,
        limits: {
            students: 500,
            teachers: 25
        },
        features: {
            attendanceTracking: true,
            grades: true,
            advancedAnalytics: false,
            customReports: false,
            basicReports: true,
            apiAccess: false,
            csvImport: true,
            emailSupport: true,
            prioritySupport: true,
            phoneSupport: false,
            dedicatedSupport: false,
            customIntegrations: false,
            onPremise: false,
            slaGuarantee: false
        }
    },
    premium: {
        name: 'Premium',
        price: 79,
        limits: {
            students: 2000,
            teachers: 100
        },
        features: {
            attendanceTracking: true,
            grades: true,
            advancedAnalytics: true,
            customReports: true,
            basicReports: true,
            apiAccess: true,
            csvImport: true,
            emailSupport: true,
            prioritySupport: true,
            phoneSupport: true,
            dedicatedSupport: false,
            customIntegrations: false,
            onPremise: false,
            slaGuarantee: false
        }
    },
    enterprise: {
        name: 'Enterprise',
        price: null, // custom pricing
        limits: {
            students: Infinity,
            teachers: Infinity
        },
        features: {
            attendanceTracking: true,
            grades: true,
            advancedAnalytics: true,
            customReports: true,
            basicReports: true,
            apiAccess: true,
            csvImport: true,
            emailSupport: true,
            prioritySupport: true,
            phoneSupport: true,
            dedicatedSupport: true,
            customIntegrations: true,
            onPremise: true,
            slaGuarantee: true
        }
    }
};

// Order of plans from lowest to highest tier (used for upgrade message)
const PLAN_TIER_ORDER = ['free_trial', 'basic', 'premium', 'enterprise'];

/**
 * Get plan configuration for a given plan name.
 * Returns null for unknown plans.
 */
const getPlanConfig = (planName) => {
    return PLANS[planName] || null;
};

/**
 * Find the minimum plan name that has a specific feature enabled.
 * Used to generate meaningful upgrade messages.
 */
const getFeatureRequiredPlan = (featureName) => {
    for (const planName of PLAN_TIER_ORDER) {
        const plan = PLANS[planName];
        if (plan && plan.features[featureName] === true) {
            return planName;
        }
    }
    return null; // Feature doesn't exist in any plan
};

/**
 * Get the display name of a plan.
 */
const getPlanDisplayName = (planName) => {
    return PLANS[planName]?.name || planName;
};

module.exports = {
    PLANS,
    PLAN_TIER_ORDER,
    getPlanConfig,
    getFeatureRequiredPlan,
    getPlanDisplayName
};
