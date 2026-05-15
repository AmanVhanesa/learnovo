const mongoose = require('mongoose');

const activityEnrollmentSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true
  },

  activityProgram: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ActivityProgram',
    required: true,
    index: true
  },

  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  academicSession: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AcademicSession',
    required: true,
    index: true
  },

  // Fee snapshot at enrollment time so changes to program fee don't rewrite history.
  monthlyFee: {
    type: Number,
    required: true,
    min: 0
  },

  discountType: {
    type: String,
    enum: ['none', 'percent', 'fixed'],
    default: 'none'
  },

  discountValue: {
    type: Number,
    min: 0,
    default: 0
  },

  enrolledFrom: {
    type: Date,
    required: true,
    default: Date.now
  },

  enrolledTo: {
    type: Date,
    default: null
  },

  status: {
    type: String,
    enum: ['active', 'paused', 'completed', 'cancelled'],
    default: 'active',
    index: true
  },

  notes: {
    type: String,
    trim: true,
    maxlength: 500
  },

  withdrawnAt: {
    type: Date
  },

  withdrawalReason: {
    type: String,
    trim: true,
    maxlength: 300
  },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// One active enrollment per (student, activity)
activityEnrollmentSchema.index(
  { tenantId: 1, activityProgram: 1, student: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'active' },
    name: 'unique_active_enrollment_per_student_activity'
  }
);

activityEnrollmentSchema.index({ tenantId: 1, student: 1, status: 1 });
activityEnrollmentSchema.index({ tenantId: 1, activityProgram: 1, status: 1 });
activityEnrollmentSchema.index({ tenantId: 1, academicSession: 1, status: 1 });

activityEnrollmentSchema.virtual('effectiveMonthlyFee').get(function() {
  const fee = Number(this.monthlyFee) || 0;
  if (this.discountType === 'percent') {
    const pct = Math.min(Math.max(Number(this.discountValue) || 0, 0), 100);
    return Math.max(0, Math.round((fee * (100 - pct)) / 100));
  }
  if (this.discountType === 'fixed') {
    return Math.max(0, fee - (Number(this.discountValue) || 0));
  }
  return fee;
});

activityEnrollmentSchema.methods.isActiveOnDate = function(date) {
  if (this.status !== 'active' && this.status !== 'paused') return false;
  const d = new Date(date);
  const from = new Date(this.enrolledFrom);
  if (d < from) return false;
  if (this.enrolledTo && d > new Date(this.enrolledTo)) return false;
  return true;
};

module.exports = mongoose.model('ActivityEnrollment', activityEnrollmentSchema);
