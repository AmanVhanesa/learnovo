/**
 * Learnovo Subscription Plan Configuration
 *
 * Single source of truth for all plan tiers, prices, limits, and features.
 * Used by planGate middleware to enforce feature/limit access control.
 *
 * Plan IDs used in DB: free | basic | pro | enterprise
 * (Note: 'free_trial' and 'premium' are aliases for backward compatibility)
 */

const PLANS = {
    free: {
        name: 'Free Trial',
        slug: 'free',
        price: 0,
        billingPeriod: '14 days',
        durationDays: 14,
        limits: {
            students: 50,
            teachers: 5,
            admins: 1,
            storage: 1024, // MB (1 GB)
            smsCredits: 0,
            emailCredits: 100,
        },
        features: {
            // Core — available on free
            coreAcademics: true,
            attendanceTracking: true,
            timetable: true,
            homework: true,
            notices: true,
            notifications: true,

            // Grades / Exams — NOT on free
            grades: false,
            exams: false,
            resultCards: false,

            // Finance — NOT on free
            feesFinance: false,
            feeReceipts: false,

            // Reports — NOT on free
            basicReports: false,
            advancedAnalytics: false,
            customReports: false,

            // Integrations — NOT on free
            csvImport: false,
            parentPortal: false,
            apiAccess: false,
            paymentGateway: false,
            smsWhatsappAlerts: false,
            customIntegrations: false,
            whiteLabel: false,
            onPremise: false,

            // Support
            emailSupport: true,
            prioritySupport: false,
            phoneSupport: false,
            dedicatedSupport: false,
        },
    },

    basic: {
        name: 'Basic',
        slug: 'basic',
        price: 2999,            // INR per month
        yearlyPrice: Math.round(2999 * 12 * 0.8), // 20% yearly discount
        billingPeriod: 'month',
        limits: {
            students: 500,
            teachers: 30,
            admins: 3,
            storage: 10240, // MB (10 GB)
            smsCredits: 0,
            emailCredits: 1000,
        },
        features: {
            coreAcademics: true,
            attendanceTracking: true,
            timetable: true,
            homework: true,
            notices: true,
            notifications: true,
            grades: true,
            exams: true,
            resultCards: true,
            feesFinance: true,
            feeReceipts: true,
            basicReports: true,
            csvImport: true,
            parentPortal: true,

            // NOT on basic
            advancedAnalytics: false,
            customReports: false,
            apiAccess: false,
            paymentGateway: false,
            smsWhatsappAlerts: false,
            customIntegrations: false,
            whiteLabel: false,
            onPremise: false,
            emailSupport: true,
            prioritySupport: false,
            phoneSupport: false,
            dedicatedSupport: false,
        },
    },

    pro: {
        name: 'Pro',
        slug: 'pro',
        price: 6999,            // INR per month
        yearlyPrice: Math.round(6999 * 12 * 0.8),
        billingPeriod: 'month',
        limits: {
            students: 2000,
            teachers: 100,
            admins: 10,
            storage: 51200, // MB (50 GB)
            smsCredits: 500,
            emailCredits: 5000,
        },
        features: {
            coreAcademics: true,
            attendanceTracking: true,
            timetable: true,
            homework: true,
            notices: true,
            notifications: true,
            grades: true,
            exams: true,
            resultCards: true,
            feesFinance: true,
            feeReceipts: true,
            basicReports: true,
            csvImport: true,
            parentPortal: true,
            advancedAnalytics: true,
            customReports: true,
            apiAccess: true,
            paymentGateway: true,
            smsWhatsappAlerts: true,
            emailSupport: true,
            prioritySupport: true,
            phoneSupport: true,

            // NOT on pro
            customIntegrations: false,
            whiteLabel: false,
            onPremise: false,
            dedicatedSupport: false,
        },
    },

    enterprise: {
        name: 'Enterprise',
        slug: 'enterprise',
        price: null,            // Custom pricing
        billingPeriod: 'year',
        limits: {
            students: Infinity,
            teachers: Infinity,
            admins: Infinity,
            storage: Infinity,
            smsCredits: Infinity,
            emailCredits: Infinity,
        },
        features: {
            coreAcademics: true,
            attendanceTracking: true,
            timetable: true,
            homework: true,
            notices: true,
            notifications: true,
            grades: true,
            exams: true,
            resultCards: true,
            feesFinance: true,
            feeReceipts: true,
            basicReports: true,
            csvImport: true,
            parentPortal: true,
            advancedAnalytics: true,
            customReports: true,
            apiAccess: true,
            paymentGateway: true,
            smsWhatsappAlerts: true,
            customIntegrations: true,
            whiteLabel: true,
            onPremise: true,
            emailSupport: true,
            prioritySupport: true,
            phoneSupport: true,
            dedicatedSupport: true,
        },
    },
};

// Backward-compatibility aliases
PLANS.free_trial = PLANS.free;
PLANS.premium = { ...PLANS.pro, name: 'Premium' };

// Plan tier order (lowest → highest)
const PLAN_TIER_ORDER = ['free', 'basic', 'pro', 'enterprise'];

/**
 * Get plan configuration for a given plan name.
 * Falls back to free plan for unknown slugs.
 */
const getPlanConfig = (planName) => {
    return PLANS[planName] || PLANS.free;
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

/**
 * Check if a plan has a specific feature.
 */
const hasFeature = (planName, featureName) => {
    const plan = getPlanConfig(planName);
    return plan.features[featureName] === true;
};

/**
 * Get a specific limit for a plan.
 */
const getLimit = (planName, limitName) => {
    const plan = getPlanConfig(planName);
    return plan.limits[limitName] ?? 0;
};

module.exports = {
    PLANS,
    PLAN_TIER_ORDER,
    getPlanConfig,
    getFeatureRequiredPlan,
    getPlanDisplayName,
    hasFeature,
    getLimit,
};
