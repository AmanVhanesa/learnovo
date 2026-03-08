const mongoose = require('mongoose');

const tenantSchema = new mongoose.Schema({
  // Basic school information
  schoolName: {
    type: String,
    required: true,
    trim: true
  },
  schoolCode: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  subdomain: {
    type: String,
    required: false, // Not required - only used for subdomain routing if implemented
    unique: true,
    sparse: true, // Allow multiple null values
    lowercase: true,
    trim: true
  },

  // Contact information
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  address: {
    street: String,
    city: String,
    state: String,
    country: String,
    zipCode: String
  },

  // School branding
  logo: {
    type: String,
    default: null
  },
  primaryColor: {
    type: String,
    default: '#3B82F6'
  },
  secondaryColor: {
    type: String,
    default: '#1E40AF'
  },

  // Subscription and billing
  subscription: {
    plan: {
      type: String,
      enum: ['free', 'basic', 'pro', 'enterprise'],
      default: 'free'
    },
    status: {
      type: String,
      enum: ['active', 'trial', 'suspended', 'cancelled'],
      default: 'trial'
    },
    trialEndsAt: {
      type: Date,
      default: () => new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14 days trial
    },
    billingCycle: {
      type: String,
      enum: ['monthly', 'yearly'],
      default: 'monthly'
    },
    startDate: {
      type: Date
    },
    endDate: {
      type: Date
    },
    maxStudents: {
      type: Number,
      default: 100 // Free plan limit
    },
    maxTeachers: {
      type: Number,
      default: 10 // Free plan limit
    },
    price: {
      type: Number,
      default: 0
    },
    paymentId: {
      type: String
    }
  },

  // Settings
  settings: {
    timezone: {
      type: String,
      default: 'UTC'
    },
    dateFormat: {
      type: String,
      default: 'MM/DD/YYYY'
    },
    currency: {
      type: String,
      default: 'USD'
    },
    academicYear: {
      type: String,
      default: new Date().getFullYear().toString()
    },
    features: {
      attendance: { type: Boolean, default: true },
      assignments: { type: Boolean, default: true },
      grades: { type: Boolean, default: true },
      reports: { type: Boolean, default: true },
      notifications: { type: Boolean, default: true },
      parentPortal: { type: Boolean, default: false },
      mobileApp: { type: Boolean, default: false }
    }
  },

  // Status and metadata
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for performance
tenantSchema.index({ schoolCode: 1 });
tenantSchema.index({ subdomain: 1 });
tenantSchema.index({ email: 1 });
tenantSchema.index({ 'subscription.status': 1 });

// Virtual for full address
tenantSchema.virtual('fullAddress').get(function() {
  const addr = this.address;
  if (!addr) return '';
  return [addr.street, addr.city, addr.state, addr.country, addr.zipCode]
    .filter(Boolean)
    .join(', ');
});

// Pre-save middleware
tenantSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Tenant', tenantSchema);
