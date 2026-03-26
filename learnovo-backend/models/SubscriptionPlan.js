const mongoose = require('mongoose');

const subscriptionPlanSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  description: { type: String, trim: true, default: '' },
  price: {
    monthly: { type: Number, default: 0 },
    yearly: { type: Number, default: 0 },
    custom: { type: Number, default: null }
  },
  billingCycle: { type: String, enum: ['monthly', 'yearly', 'custom'], default: 'monthly' },

  // Limits
  limits: {
    students: { type: Number, default: 50 },
    teachers: { type: Number, default: 5 },
    admins: { type: Number, default: 1 },
    storage: { type: Number, default: 512 }, // MB
    smsCredits: { type: Number, default: 0 },
    emailCredits: { type: Number, default: 100 }
  },

  // Modules included (array of module slugs)
  modules: [{ type: String, trim: true }],

  // Feature flags
  features: {
    customBranding: { type: Boolean, default: false },
    prioritySupport: { type: Boolean, default: false },
    apiAccess: { type: Boolean, default: false },
    whiteLabel: { type: Boolean, default: false },
    advancedAnalytics: { type: Boolean, default: false },
    csvImport: { type: Boolean, default: false },
    customReports: { type: Boolean, default: false }
  },

  // Display
  isPopular: { type: Boolean, default: false },
  sortOrder: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  subscriberCount: { type: Number, default: 0 }
}, { timestamps: true });

subscriptionPlanSchema.index({ slug: 1 });
subscriptionPlanSchema.index({ isActive: 1, sortOrder: 1 });

module.exports = mongoose.model('SubscriptionPlan', subscriptionPlanSchema);
