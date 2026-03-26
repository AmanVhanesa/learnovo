const mongoose = require('mongoose');

const platformSettingsSchema = new mongoose.Schema({
  // Singleton — only one document should exist
  _id: { type: String, default: 'platform_settings' },

  // General
  general: {
    platformName: { type: String, default: 'Learnovo' },
    tagline: { type: String, default: 'School Management Made Simple' },
    logo: { type: String, default: null },
    favicon: { type: String, default: null },
    primaryDomain: { type: String, default: '' },
    supportEmail: { type: String, default: '' },
    supportPhone: { type: String, default: '' },
    socialLinks: {
      facebook: { type: String, default: '' },
      twitter: { type: String, default: '' },
      linkedin: { type: String, default: '' },
      instagram: { type: String, default: '' }
    }
  },

  // Branding defaults for tenants
  branding: {
    primaryColor: { type: String, default: '#3EC4B1' },
    secondaryColor: { type: String, default: '#2355A6' },
    accentColor: { type: String, default: '#F59E0B' },
    defaultLogoPlacement: { type: String, enum: ['left', 'center'], default: 'left' },
    emailHeaderTemplate: { type: String, default: '' },
    emailFooterTemplate: { type: String, default: '' }
  },

  // Academic defaults
  academics: {
    defaultAcademicYearFormat: { type: String, default: 'April-March' },
    defaultGradingSystem: { type: String, enum: ['percentage', 'gpa', 'letter_grade'], default: 'percentage' },
    defaultAttendanceRules: { type: String, default: '' },
    defaultClassNaming: { type: String, default: 'Class 1, Class 2...' }
  },

  // Email configuration
  email: {
    provider: { type: String, default: 'smtp' },
    host: { type: String, default: '' },
    port: { type: Number, default: 587 },
    secure: { type: Boolean, default: false },
    username: { type: String, default: '' },
    password: { type: String, default: '', select: false },
    senderName: { type: String, default: 'Learnovo' },
    senderEmail: { type: String, default: '' },
    dailyLimit: { type: Number, default: 500 }
  },

  // SMS configuration
  sms: {
    provider: { type: String, default: '' },
    apiKey: { type: String, default: '', select: false },
    senderId: { type: String, default: '' },
    dailyLimit: { type: Number, default: 100 },
    dltTemplateIds: { type: mongoose.Schema.Types.Mixed, default: {} }
  },

  // Payment gateway
  payment: {
    gateway: { type: String, enum: ['razorpay', 'stripe', 'payu', 'instamojo', 'none'], default: 'razorpay' },
    razorpay: {
      keyId: { type: String, default: '', select: false },
      keySecret: { type: String, default: '', select: false },
      webhookSecret: { type: String, default: '', select: false }
    },
    stripe: {
      publishableKey: { type: String, default: '', select: false },
      secretKey: { type: String, default: '', select: false },
      webhookSecret: { type: String, default: '', select: false }
    },
    testMode: { type: Boolean, default: true }
  },

  // Storage
  storage: {
    provider: { type: String, enum: ['cloudinary', 'aws_s3', 'gcs', 'local'], default: 'cloudinary' },
    maxStoragePerPlan: { type: mongoose.Schema.Types.Mixed, default: {} }, // { basic: 5120, pro: 20480 }
    maxFileSize: { type: Number, default: 10 }, // MB
    allowedFileTypes: [{ type: String }]
  },

  // Localization
  localization: {
    defaultLanguage: { type: String, default: 'en' },
    defaultTimezone: { type: String, default: 'Asia/Kolkata' },
    defaultCurrency: { type: String, default: 'INR' },
    defaultDateFormat: { type: String, default: 'DD/MM/YYYY' },
    defaultNumberFormat: { type: String, default: 'en-IN' }
  },

  // Maintenance
  maintenance: {
    isEnabled: { type: Boolean, default: false },
    message: { type: String, default: 'We are currently performing maintenance. Please try again later.' },
    estimatedDowntime: { type: String, default: '' },
    perTenantMaintenance: { type: mongoose.Schema.Types.Mixed, default: {} } // { tenantId: true }
  },

  // Legal
  legal: {
    termsOfService: { type: String, default: '' },
    privacyPolicy: { type: String, default: '' },
    refundPolicy: { type: String, default: '' },
    cookiePolicy: { type: String, default: '' },
    lastUpdated: { type: Date }
  }
}, { timestamps: true });

module.exports = mongoose.model('PlatformSettings', platformSettingsSchema);
