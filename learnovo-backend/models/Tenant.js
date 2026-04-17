const mongoose = require('mongoose');
const { encrypt, decrypt } = require('../utils/encryption');

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
    required: false, // Not required — auto-generated from schoolCode on registration if omitted
    unique: true,
    sparse: true, // Allow multiple null values
    lowercase: true,
    trim: true,
    validate: {
      validator: function(v) {
        if (!v) return true; // null/undefined is fine (sparse)
        // Must be a valid URL-safe slug: lowercase alphanumeric + hyphens, 3-63 chars
        return /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/.test(v);
      },
      message: 'Subdomain must be 3-63 characters, lowercase alphanumeric and hyphens only, cannot start/end with a hyphen'
    }
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

  // Payment Gateway Configuration (per-tenant)
  paymentGateway: {
    provider: {
      type: String,
      enum: ['none', 'mock', 'icici_orange', 'razorpay'],
      default: 'none'
    },
    // ICICI Orange credentials. Issued by ICICI when a current account
    // is opened. Full field shape will be tightened once the MID kit /
    // integration spec is received from the bank. The HTTP Basic Auth
    // credentials used on the inbound callback live in env vars
    // (ICICI_ORANGE_<TENANT>_CALLBACK_*), not in the DB, so they
    // cannot be exfiltrated via a Tenant read.
    iciciOrange: {
      merchantId: { type: String, default: '' },
      terminalId: { type: String, default: '' },
      // Outbound API key/secret if ICICI provides one for initiating
      // payments from our backend. Encrypted at rest (see hooks below).
      apiKey: { type: String, default: '' },
      apiSecret: { type: String, default: '' }
    },
    // Razorpay credentials
    razorpay: {
      keyId: { type: String, default: '' },
      keySecret: { type: String, default: '' },
      webhookSecret: { type: String, default: '' }
    },
    isActive: {
      type: Boolean,
      default: false
    }
  },

  // Status and metadata
  isActive: {
    type: Boolean,
    default: true
  },
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
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

// ── Payment gateway credential encryption helpers ──
const SENSITIVE_ICICI_ORANGE_FIELDS = ['merchantId', 'terminalId', 'apiKey', 'apiSecret'];
const SENSITIVE_RAZORPAY_FIELDS = ['keyId', 'keySecret', 'webhookSecret'];

function isAlreadyEncrypted(value) {
  // Encrypted format is iv:authTag:ciphertext (hex values separated by colons)
  return typeof value === 'string' && value.split(':').length === 3;
}

function encryptGatewayCredentials(pg) {
  if (!pg) return;
  if (pg.iciciOrange) {
    for (const field of SENSITIVE_ICICI_ORANGE_FIELDS) {
      if (pg.iciciOrange[field] && !isAlreadyEncrypted(pg.iciciOrange[field])) {
        pg.iciciOrange[field] = encrypt(pg.iciciOrange[field]);
      }
    }
  }
  if (pg.razorpay) {
    for (const field of SENSITIVE_RAZORPAY_FIELDS) {
      if (pg.razorpay[field] && !isAlreadyEncrypted(pg.razorpay[field])) {
        pg.razorpay[field] = encrypt(pg.razorpay[field]);
      }
    }
  }
}

function decryptGatewayCredentials(pg) {
  if (!pg) return;
  if (pg.iciciOrange) {
    for (const field of SENSITIVE_ICICI_ORANGE_FIELDS) {
      if (pg.iciciOrange[field]) pg.iciciOrange[field] = decrypt(pg.iciciOrange[field]);
    }
  }
  if (pg.razorpay) {
    for (const field of SENSITIVE_RAZORPAY_FIELDS) {
      if (pg.razorpay[field]) pg.razorpay[field] = decrypt(pg.razorpay[field]);
    }
  }
}

// Pre-save middleware
tenantSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  // Auto-populate subdomain from schoolCode if not explicitly set
  if (!this.subdomain && this.schoolCode) {
    this.subdomain = this.schoolCode.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  }
  // Encrypt payment gateway credentials before persisting
  if (this.isModified('paymentGateway') && this.paymentGateway) {
    encryptGatewayCredentials(this.paymentGateway);
  }
  next();
});

// Decrypt payment gateway credentials after loading from DB
function decryptAfterLoad(doc) {
  if (doc && doc.paymentGateway) {
    decryptGatewayCredentials(doc.paymentGateway);
  }
}

tenantSchema.post('findOne', decryptAfterLoad);
tenantSchema.post('findOneAndUpdate', decryptAfterLoad);
tenantSchema.post('save', decryptAfterLoad);
tenantSchema.post('find', (docs) => {
  if (Array.isArray(docs)) docs.forEach(decryptAfterLoad);
});

module.exports = mongoose.model('Tenant', tenantSchema);
