/**
 * Learnovo Subscription Plan Configuration
 *
 * Single source of truth for all plan tiers, prices, limits, and features.
 * Used by planGate middleware to enforce feature/limit access control.
 *
 * Plan IDs used in DB: free_trial | basic | pro | enterprise
 * (Note: 'premium' is aliased to 'pro' for backward compatibility)
 */

const PLANS = {
    free_trial: {
        name: 'Free Trial',
        price: 0,             // INR per month
        billingPeriod: '14 days',
        durationDays: 14,
        limits: {
            students: 50,
            teachers: 5,
            storage: 512 // MB
        },
        features: {
            // Core
            coreAcademics: true,
            attendanceTracking: true,
            timetable: true,
            homework: true,
            notices: true,
            // Grades / Exams
            grades: false,
            exams: false,
            resultCards: false,
            // Finance
            feesFinance: false,
            feeReceipts: false,
            // Communication
            notifications: true,
            // Analytics
            basicReports: false,
            advancedAnalytics: false,
            customReports: false,
            // Integrations
            csvImport: false,
            apiAccess: false,
            customIntegrations: false,
            // Support
            emailSupport: true,
            prioritySupport: false,
            phoneSupport: false,
            dedicatedSupport: false
        }
    },

    basic: {
        name: 'Basic',
        price: 2499,          // INR per month
        billingPeriod: 'month',
        limits: {
            students: 500,
            teachers: 30,
            storage: 5120 // MB
        },
        features: {
            coreAcademics: true,
            attendanceTracking: true,
            timetable: true,
            homework: true,
            notices: true,
            grades: true,
            exams: true,
            resultCards: true,
            feesFinance: true,
            feeReceipts: true,
            notifications: true,
            basicReports: true,
            advancedAnalytics: false,
            customReports: false,
            csvImport: true,
            apiAccess: false,
            customIntegrations: false,
            emailSupport: true,
            prioritySupport: false,
            phoneSupport: false,
            dedicatedSupport: false
        }
    },

    pro: {
        name: 'Pro',
        price: 5999,          // INR per month
        billingPeriod: 'month',
        limits: {
            students: 2000,
            teachers: 100,
            storage: 20480 // MB
        },
        features: {
            coreAcademics: true,
            attendanceTracking: true,
            timetable: true,
            homework: true,
            notices: true,
            grades: true,
            exams: true,
            resultCards: true,
            feesFinance: true,
            feeReceipts: true,
            notifications: true,
            basicReports: true,
            advancedAnalytics: true,
            customReports: true,
            csvImport: true,
            apiAccess: true,
            customIntegrations: false,
            emailSupport: true,
            prioritySupport: true,
            phoneSupport: true,
            dedicatedSupport: false
        }
    },

    // Legacy alias – 'premium' maps to 'pro' config
    premium: null, // resolved below

    enterprise: {
        name: 'Enterprise',
        price: null,          // Custom pricing
        billingPeriod: 'year',
        limits: {
            students: Infinity,
            teachers: Infinity,
            storage: Infinity
        },
        features: {
            coreAcademics: true,
            attendanceTracking: true,
            timetable: true,
            homework: true,
            notices: true,
            grades: true,
            exams: true,
            resultCards: true,
            feesFinance: true,
            feeReceipts: true,
            notifications: true,
            basicReports: true,
            advancedAnalytics: true,
            customReports: true,
            csvImport: true,
            apiAccess: true,
            customIntegrations: true,
            emailSupport: true,
            prioritySupport: true,
            phoneSupport: true,
            dedicatedSupport: true
        }
    }
};

// Resolve 'premium' alias to 'pro'
PLANS.premium = { ...PLANS.pro, name: 'Premium' };

// Plan tier order (lowest → highest)
const PLAN_TIER_ORDER = ['free_trial', 'basic', 'pro', 'enterprise'];

/**
 * Get plan configuration for a given plan name.
 * Returns null for unknown plans.
 */
const getPlanConfig = (planName) => {
    return PLANS[planName] || null;
};

/**
 * Find the minimum plan that has a specific feature enabled.
 */
const getFeatureRequiredPlan = (featureName) => {
    for (const planName of PLAN_TIER_ORDER) {
        const plan = PLANS[planName];
        if (plan && plan.features[featureName] === true) {
            return planName;
        }
    }
    return null;
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
