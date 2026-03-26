const mongoose = require('mongoose');

const assignmentSchema = new mongoose.Schema({
  // Multi-tenant support
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true
  },

  // Assignment details
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true
  },
  
  // Assignment metadata
  subject: {
    type: String,
    required: [true, 'Subject is required'],
    trim: true
  },
  class: {
    type: String,
    required: [true, 'Class is required'],
    trim: true
  },
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class'
  },

  // Teacher information
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Students assigned (can be specific students or entire class)
  assignedTo: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],

  // Due date
  dueDate: {
    type: Date,
    required: [true, 'Due date is required']
  },

  // Assignment status
  status: {
    type: String,
    enum: ['active', 'completed', 'cancelled'],
    default: 'active'
  },

  // Attachments
  attachments: [{
    fileName: String,
    fileUrl: String,
    fileSize: Number,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Points/Marks
  totalMarks: {
    type: Number,
    default: 100
  },

  // Instructions
  instructions: {
    type: String,
    trim: true
  },

  // Additional metadata
  isVisible: {
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

// Indexes for better query performance
assignmentSchema.index({ tenantId: 1, class: 1 });
assignmentSchema.index({ tenantId: 1, teacher: 1 });
assignmentSchema.index({ tenantId: 1, assignedTo: 1 });
assignmentSchema.index({ tenantId: 1, status: 1 });
assignmentSchema.index({ dueDate: 1 });

// Pre-save middleware
assignmentSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Assignment', assignmentSchema);

