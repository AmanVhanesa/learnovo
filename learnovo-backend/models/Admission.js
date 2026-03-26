const mongoose = require('mongoose');

const admissionSchema = new mongoose.Schema({
  applicationNumber: {
    type: String,
    unique: true,
    required: true
  },
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  // Personal Information
  personalInfo: {
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true
    },
    dateOfBirth: {
      type: Date,
      required: [true, 'Date of birth is required']
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other'],
      required: [true, 'Gender is required']
    },
    bloodGroup: {
      type: String,
      enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
      required: false
    },
    nationality: {
      type: String,
      default: 'Indian',
      trim: true
    }
  },
  // Contact Information
  contactInfo: {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true
    },
    phone: {
      type: String,
      required: [true, 'Phone is required'],
      trim: true
    },
    address: {
      street: { type: String, required: true, trim: true },
      city: { type: String, required: true, trim: true },
      state: { type: String, required: true, trim: true },
      pincode: { type: String, required: true, trim: true },
      country: { type: String, default: 'India', trim: true }
    }
  },
  // Guardian Information
  guardianInfo: {
    fatherName: {
      type: String,
      required: [true, 'Father name is required'],
      trim: true
    },
    fatherOccupation: {
      type: String,
      trim: true
    },
    fatherPhone: {
      type: String,
      trim: true
    },
    motherName: {
      type: String,
      required: [true, 'Mother name is required'],
      trim: true
    },
    motherOccupation: {
      type: String,
      trim: true
    },
    motherPhone: {
      type: String,
      trim: true
    },
    guardianRelation: {
      type: String,
      enum: ['father', 'mother', 'grandfather', 'grandmother', 'uncle', 'aunt', 'other'],
      default: 'father'
    },
    emergencyContact: {
      name: { type: String, trim: true },
      relation: { type: String, trim: true },
      phone: { type: String, trim: true }
    }
  },
  // Academic Information
  academicInfo: {
    classApplied: {
      type: String,
      required: [true, 'Class applied for is required'],
      trim: true
    },
    previousSchool: {
      type: String,
      trim: true
    },
    previousClass: {
      type: String,
      trim: true
    },
    previousMarks: {
      type: Number,
      min: 0,
      max: 100
    },
    previousBoard: {
      type: String,
      trim: true
    },
    subjects: [{
      type: String,
      trim: true
    }],
    extraCurricular: [{
      type: String,
      trim: true
    }]
  },
  // Documents
  documents: {
    photo: {
      type: String,
      required: [true, 'Photo is required']
    },
    birthCertificate: {
      type: String,
      required: [true, 'Birth certificate is required']
    },
    previousMarksheet: {
      type: String,
      required: false
    },
    transferCertificate: {
      type: String,
      required: false
    },
    aadharCard: {
      type: String,
      required: false
    },
    otherDocuments: [{
      name: { type: String, trim: true },
      file: { type: String }
    }]
  },
  // Application Status
  status: {
    type: String,
    enum: ['pending', 'under_review', 'approved', 'rejected', 'waitlisted'],
    default: 'pending'
  },
  // Review Information
  reviewInfo: {
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reviewedAt: {
      type: Date
    },
    comments: {
      type: String,
      trim: true
    },
    rejectionReason: {
      type: String,
      trim: true
    }
  },
  // Admission Information
  admissionInfo: {
    admissionDate: {
      type: Date
    },
    admissionFee: {
      type: Number,
      min: 0
    },
    admissionFeePaid: {
      type: Boolean,
      default: false
    },
    admissionFeePaidDate: {
      type: Date
    },
    rollNumber: {
      type: String,
      unique: true,
      sparse: true
    },
    studentId: {
      type: String,
      unique: true,
      sparse: true
    }
  },
  // Additional Information
  additionalInfo: {
    medicalConditions: {
      type: String,
      trim: true
    },
    allergies: {
      type: String,
      trim: true
    },
    transportRequired: {
      type: Boolean,
      default: false
    },
    transportRoute: {
      type: String,
      trim: true
    },
    hostelRequired: {
      type: Boolean,
      default: false
    },
    specialNeeds: {
      type: String,
      trim: true
    }
  },
  // Application Timeline
  timeline: [{
    status: {
      type: String,
      required: true
    },
    date: {
      type: Date,
      default: Date.now
    },
    notes: {
      type: String,
      trim: true
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }]
}, {
  timestamps: true
});

// Indexes
admissionSchema.index({ applicationNumber: 1 });
admissionSchema.index({ status: 1 });
admissionSchema.index({ 'contactInfo.email': 1 });
admissionSchema.index({ 'contactInfo.phone': 1 });
admissionSchema.index({ 'academicInfo.classApplied': 1 });

// Generate application number before saving
admissionSchema.pre('save', function(next) {
  if (this.isNew && !this.applicationNumber) {
    const year = new Date().getFullYear();
    const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    this.applicationNumber = `APP${year}${month}${random}`;
  }
  next();
});

// Add to timeline when status changes
admissionSchema.pre('save', function(next) {
  if (this.isModified('status') && !this.isNew) {
    this.timeline.push({
      status: this.status,
      date: new Date(),
      notes: this.reviewInfo?.comments || '',
      updatedBy: this.reviewInfo?.reviewedBy
    });
  }
  next();
});

// Method to approve admission
admissionSchema.methods.approve = function(reviewedBy, comments = '') {
  this.status = 'approved';
  this.reviewInfo = {
    reviewedBy,
    reviewedAt: new Date(),
    comments
  };
  this.admissionInfo.admissionDate = new Date();
  return this.save();
};

// Method to reject admission
admissionSchema.methods.reject = function(reviewedBy, reason, comments = '') {
  this.status = 'rejected';
  this.reviewInfo = {
    reviewedBy,
    reviewedAt: new Date(),
    comments,
    rejectionReason: reason
  };
  return this.save();
};

// Static method to get admission statistics
admissionSchema.statics.getStatistics = function() {
  return this.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);
};

module.exports = mongoose.model('Admission', admissionSchema);
