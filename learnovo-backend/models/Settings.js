const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  // Multi-tenant support
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    unique: true
  },

  // Institution Information
  institution: {
    name: {
      type: String,
      required: [true, 'Institution name is required'],
      trim: true
    },
    tagline: {
      type: String,
      trim: true,
      default: ''
    },
    address: {
      street: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      pincode: { type: String, trim: true },
      country: { type: String, default: 'India', trim: true }
    },
    contact: {
      phone: { type: String, trim: true },
      email: { type: String, trim: true },
      website: { type: String, trim: true }
    },
    logo: {
      type: String,
      default: null
    },
    establishedYear: {
      type: Number,
      min: 1800,
      max: new Date().getFullYear()
    }
  },
  // Currency Settings
  currency: {
    default: {
      type: String,
      required: true,
      default: 'INR',
      uppercase: true
    },
    symbol: {
      type: String,
      default: '₹'
    },
    position: {
      type: String,
      enum: ['before', 'after'],
      default: 'before'
    },
    decimalPlaces: {
      type: Number,
      default: 2,
      min: 0,
      max: 4
    },
    thousandSeparator: {
      type: String,
      default: ','
    },
    decimalSeparator: {
      type: String,
      default: '.'
    }
  },
  // Academic Settings
  academic: {
    currentYear: {
      type: String,
      required: true,
      default: () => {
        const year = new Date().getFullYear();
        return `${year}-${year + 1}`;
      }
    },
    terms: [{
      name: { type: String, required: true },
      startDate: { type: Date, required: true },
      endDate: { type: Date, required: true },
      isActive: { type: Boolean, default: false }
    }],
    classes: [{
      name: { type: String, required: true },
      level: { type: Number, required: true },
      maxStudents: { type: Number, default: 40 },
      isActive: { type: Boolean, default: true }
    }],
    subjects: [{
      name: { type: String, required: true },
      code: { type: String, required: true },
      isActive: { type: Boolean, default: true }
    }]
  },
  // Admission Settings
  admission: {
    mode: {
      type: String,
      enum: ['AUTO', 'CUSTOM'],
      default: 'AUTO'
    },
    prefix: {
      type: String,
      uppercase: true,
      trim: true,
      sparse: true
    },
    yearFormat: {
      type: String,
      enum: ['YY', 'YYYY'],
      default: 'YYYY'
    },
    counterPadding: {
      type: Number,
      default: 4,
      min: 3,
      max: 6
    },
    startFrom: {
      type: Number,
      default: 1
    },
    resetEachYear: {
      type: Boolean,
      default: false
    }
  },
  // Marks Grading Settings
  grading: {
    rules: [{
      gradeName: {
        type: String,
        required: true,
        trim: true
      },
      percentageFrom: {
        type: Number,
        required: true,
        min: 0,
        max: 100
      },
      percentageTo: {
        type: Number,
        required: true,
        min: 0,
        max: 100
      },
      status: {
        type: String,
        enum: ['PASS', 'FAIL'],
        required: true
      },
      order: {
        type: Number,
        default: 0
      }
    }],
    isActive: {
      type: Boolean,
      default: true
    }
  },
  // Bank Account Details
  bankAccounts: [{
    bankName: {
      type: String,
      required: true,
      trim: true
    },
    bankLogo: {
      type: String,
      default: null
    },
    accountNumber: {
      type: String,
      required: true,
      trim: true
    },
    branch: {
      type: String,
      trim: true
    },
    address: {
      type: String,
      trim: true
    },
    instructions: {
      type: String,
      trim: true
    },
    isDefault: {
      type: Boolean,
      default: false
    },
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  // Rules and Regulations
  rulesAndRegulations: {
    content: {
      type: String,
      default: ''
    },
    version: {
      type: Number,
      default: 1
    },
    lastUpdatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    lastUpdatedAt: {
      type: Date,
      default: Date.now
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  // Account Settings
  account: {
    timezone: {
      type: String,
      default: 'Asia/Kolkata'
    },
    dateFormat: {
      type: String,
      enum: ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'],
      default: 'DD/MM/YYYY'
    },
    timeFormat: {
      type: String,
      enum: ['12h', '24h'],
      default: '12h'
    }
  },
  // Fee Settings
  fees: {
    lateFeePercentage: {
      type: Number,
      default: 5,
      min: 0,
      max: 100
    },
    lateFeeGracePeriod: {
      type: Number,
      default: 7, // days
      min: 0
    },
    autoGenerateFees: {
      type: Boolean,
      default: false
    },
    feeStructure: [{
      class: { type: String, required: true },
      feeType: { type: String, required: true },
      amount: { type: Number, required: true },
      term: { type: String, required: true },
      isActive: { type: Boolean, default: true }
    }]
  },
  // Notification Settings
  notifications: {
    email: {
      enabled: { type: Boolean, default: true },
      reminderDays: [Number], // Days before due date to send reminders
      overdueReminderDays: [Number], // Days after due date to send overdue reminders
      templates: {
        feeReminder: { type: String, default: 'Your fee payment is due on {dueDate}' },
        feeOverdue: { type: String, default: 'Your fee payment is overdue. Please pay immediately.' },
        admissionApproved: { type: String, default: 'Congratulations! Your admission has been approved.' },
        admissionRejected: { type: String, default: 'We regret to inform you that your admission has been rejected.' }
      }
    },
    sms: {
      enabled: { type: Boolean, default: false },
      apiKey: { type: String, trim: true },
      apiSecret: { type: String, trim: true },
      senderId: { type: String, trim: true }
    },
    dashboard: {
      enabled: { type: Boolean, default: true },
      showOverdueFees: { type: Boolean, default: true },
      showUpcomingFees: { type: Boolean, default: true }
    }
  },
  // System Settings
  system: {
    maintenanceMode: {
      type: Boolean,
      default: false
    },
    maintenanceMessage: {
      type: String,
      trim: true
    },
    maxFileSize: {
      type: Number,
      default: 5242880, // 5MB in bytes
      min: 1048576 // 1MB minimum
    },
    allowedFileTypes: [{
      type: String,
      enum: ['jpg', 'jpeg', 'png', 'pdf', 'doc', 'docx']
    }],
    sessionTimeout: {
      type: Number,
      default: 3600, // 1 hour in seconds
      min: 300 // 5 minutes minimum
    },
    passwordPolicy: {
      minLength: { type: Number, default: 8, min: 6 },
      requireUppercase: { type: Boolean, default: true },
      requireLowercase: { type: Boolean, default: true },
      requireNumbers: { type: Boolean, default: true },
      requireSpecialChars: { type: Boolean, default: false }
    }
  },
  // Theme Settings
  theme: {
    mode: {
      type: String,
      enum: ['light', 'dark'],
      default: 'light'
    },
    primaryColor: {
      type: String,
      default: '#3EC4B1'
    },
    secondaryColor: {
      type: String,
      default: '#2355A6'
    },
    language: {
      type: String,
      default: 'en'
    },
    logo: {
      type: String,
      default: null
    },
    favicon: {
      type: String,
      default: null
    }
  },
  // Backup Settings
  backup: {
    autoBackup: {
      type: Boolean,
      default: false
    },
    backupFrequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly'],
      default: 'weekly'
    },
    backupRetention: {
      type: Number,
      default: 30, // days
      min: 7
    }
  }
}, {
  timestamps: true
});

// Get or create settings for a tenant
settingsSchema.statics.getSettings = async function (tenantId) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  let settings = await this.findOne({ tenantId });
  if (!settings) {
    // Get tenant data to populate settings
    const Tenant = mongoose.model('Tenant');
    const tenant = await Tenant.findById(tenantId);

    // Create default settings with required fields, populated from tenant if available
    settings = new this({
      tenantId,
      institution: {
        name: tenant?.schoolName || 'School',
        address: tenant?.address ? {
          street: tenant.address.street || '',
          city: tenant.address.city || '',
          state: tenant.address.state || '',
          pincode: tenant.address.zipCode || '',
          country: tenant.address.country || 'India'
        } : {
          street: '',
          city: '',
          state: '',
          pincode: '',
          country: 'India'
        },
        contact: {
          phone: tenant?.phone || '',
          email: tenant?.email || '',
          website: ''
        }
      },
      currency: {
        default: tenant?.settings?.currency || 'INR',
        symbol: tenant?.settings?.currency === 'INR' ? '₹' :
          tenant?.settings?.currency === 'USD' ? '$' :
            tenant?.settings?.currency === 'EUR' ? '€' :
              tenant?.settings?.currency === 'GBP' ? '£' : '₹'
      },
      academic: {
        currentYear: new Date().getFullYear() + '-' + (new Date().getFullYear() + 1)
      }
    });
    try {
      await settings.save();
    } catch (saveError) {
      // If save fails, try to find existing again (might have been created concurrently)
      settings = await this.findOne({ tenantId });
      if (!settings) {
        throw saveError;
      }
    }
  }
  return settings;
};

// Method to update currency settings
settingsSchema.methods.updateCurrency = function (currency, symbol, position = 'before') {
  this.currency = {
    default: currency.toUpperCase(),
    symbol: symbol,
    position: position,
    decimalPlaces: this.currency.decimalPlaces,
    thousandSeparator: this.currency.thousandSeparator,
    decimalSeparator: this.currency.decimalSeparator
  };
  return this.save();
};

// Method to add new class
settingsSchema.methods.addClass = function (name, level, maxStudents = 40) {
  this.academic.classes.push({
    name,
    level,
    maxStudents,
    isActive: true
  });
  return this.save();
};

// Method to add new subject
settingsSchema.methods.addSubject = function (name, code) {
  this.academic.subjects.push({
    name,
    code,
    isActive: true
  });
  return this.save();
};

// Method to add fee structure
settingsSchema.methods.addFeeStructure = function (class_, feeType, amount, term) {
  this.fees.feeStructure.push({
    class: class_,
    feeType,
    amount,
    term,
    isActive: true
  });
  return this.save();
};

module.exports = mongoose.model('Settings', settingsSchema);
