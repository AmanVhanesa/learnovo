const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  // Multi-tenant support
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true
  },

  name: {
    type: String,
    required: false,
    trim: true,
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  fullName: {
    type: String,
    trim: true
  },
  firstName: {
    type: String,
    trim: true
  },
  middleName: {
    type: String,
    trim: true
  },
  lastName: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    required: false, // Optional — employees can be created with phone only
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  role: {
    type: String,
    enum: ['admin', 'teacher', 'student', 'parent', 'accountant', 'staff'],
    required: [true, 'Role is required']
  },
  phone: {
    type: String,
    trim: true,
    validate: {
      validator: function (v) {
        if (!v || v.trim() === '') return true;
        return /^[\+]?[1-9][\d]{5,15}$/.test(v);
      },
      message: 'Please enter a valid phone number (e.g., +919876543210 or 9876543210)'
    },
    required: false
  },
  avatar: {
    type: String,
    default: null
  },
  photo: {
    type: String,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date,
    default: null
  },

  // ── Employee-specific fields ──────────────────────────────────────
  employeeId: {
    type: String,
    trim: true,
    sparse: true
  },
  loginEnabled: {
    type: Boolean,
    default: false
  },
  forcePasswordChange: {
    type: Boolean,
    default: false
  },
  designation: {
    type: String,
    trim: true
  },
  department: {
    type: String,
    trim: true
  },
  salary: {
    type: Number,
    min: 0
  },
  leaveDeductionPerDay: {
    type: Number,
    min: 0
  },
  dateOfJoining: {
    type: Date
  },
  fatherOrHusbandName: {
    type: String,
    trim: true
  },
  dateOfBirth: {
    type: Date
  },
  nationalId: {
    type: String,
    trim: true
  },
  education: {
    type: String,
    trim: true
  },
  experience: {
    type: Number,
    min: 0
  },
  homeAddress: {
    type: String,
    trim: true
  },
  bankName: {
    type: String,
    trim: true
  },
  accountNumber: {
    type: String,
    trim: true
  },
  ifscCode: {
    type: String,
    trim: true
  },
  inactiveReason: {
    type: String,
    trim: true
  },
  inactivatedAt: {
    type: Date
  },
  inactivatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // ── Teacher fields ────────────────────────────────────────────────
  subjects: [{
    type: String,
    trim: true
  }],
  qualifications: {
    type: String,
    trim: true
  },
  assignedClasses: [{
    type: String,
    trim: true
  }],
  classTeacher: {
    type: String,
    trim: true
  },

  // ── Parent fields ─────────────────────────────────────────────────
  children: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],

  // ── Student fields ────────────────────────────────────────────────
  studentId: {
    type: String,
    sparse: true
  },
  admissionNumber: {
    type: String,
    trim: true,
    sparse: true,
    index: true
  },
  rollNumber: {
    type: String,
    trim: true
  },
  class: {
    type: String,
    trim: true
  },
  section: {
    type: String,
    trim: true
  },
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class'
  },
  sectionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Section'
  },
  academicYear: {
    type: String,
    trim: true
  },
  gender: {
    type: String,
    trim: true
  },
  bloodGroup: {
    type: String,
    trim: true
  },
  category: {
    type: String,
    trim: true
  },
  religion: {
    type: String,
    trim: true
  },
  penNumber: {
    type: String,
    trim: true
  },
  udiseCode: {
    type: String,
    trim: true
  },
  subDepartment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubDepartment'
  },
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver'
  },
  transportMode: {
    type: String,
    trim: true
  },
  admissionDate: {
    type: Date
  },
  guardianName: {
    type: String,
    trim: true
  },
  guardianPhone: {
    type: String,
    trim: true
  },
  address: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Index for better performance
userSchema.index({ email: 1, tenantId: 1 }, { unique: true, sparse: true }); // Email unique per tenant, sparse allows null emails
userSchema.index({ role: 1, tenantId: 1 });
userSchema.index({ tenantId: 1 });
userSchema.index({ tenantId: 1, admissionNumber: 1 });

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Note: Admission number and student ID generation moved to routes for proper async handling

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Get user without sensitive data
userSchema.methods.toJSON = function () {
  const user = this.toObject();
  delete user.password;
  return user;
};

module.exports = mongoose.model('User', userSchema);
