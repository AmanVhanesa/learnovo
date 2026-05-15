const mongoose = require('mongoose');

const activityProgramSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true
  },

  name: {
    type: String,
    required: [true, 'Activity name is required'],
    trim: true,
    maxlength: 120
  },

  description: {
    type: String,
    trim: true,
    maxlength: 1000
  },

  category: {
    type: String,
    enum: ['Sports', 'Music', 'Dance', 'Arts', 'Academic', 'Other'],
    default: 'Other',
    index: true
  },

  monthlyFee: {
    type: Number,
    required: [true, 'Monthly fee is required'],
    min: [0, 'Monthly fee cannot be negative']
  },

  instructor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  schedule: {
    type: String,
    trim: true,
    maxlength: 200
  },

  capacity: {
    type: Number,
    min: 0,
    default: 0
  },

  photo: {
    type: String,
    trim: true
  },

  isActive: {
    type: Boolean,
    default: true,
    index: true
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

activityProgramSchema.index({ tenantId: 1, isActive: 1 });
activityProgramSchema.index(
  { tenantId: 1, name: 1 },
  {
    unique: true,
    collation: { locale: 'en', strength: 2 },
    name: 'unique_activity_name_per_tenant'
  }
);

module.exports = mongoose.model('ActivityProgram', activityProgramSchema);
