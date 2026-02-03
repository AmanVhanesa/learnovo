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

  // Identity - Primary name field
  fullName: {
    type: String,
    required: function () { return this.role === 'student'; },
    trim: true
  },
  // Optional name parts for backward compatibility
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
  name: { // Keeping for backward compatibility & display
    type: String,
    trim: true
  },
  email: {
    type: String,
    required: function () {
      // Email required only for admin and teacher roles
      return ['admin', 'teacher'].includes(this.role);
    },
    lowercase: true,
    trim: true,
    sparse: true,
    validate: {
      validator: function (v) {
        // Skip validation if email is not provided
        if (!v || v.trim() === '') return true;
        // Validate email format only if provided
        return /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(v);
      },
      message: 'Please enter a valid email'
    }
  },
  password: {
    type: String,
    required: function () {
      // Password required only if email exists and it's a new record
      return this.email && this.isNew;
    },
    validate: {
      validator: function (v) {
        // Skip validation if password is not provided
        if (!v) return true;
        // Validate password length only if provided
        return v.length >= 6;
      },
      message: 'Password must be at least 6 characters'
    },
    select: false
  },
  role: {
    type: String,
    enum: ['admin', 'teacher', 'student', 'parent'],
    required: [true, 'Role is required']
  },
  phone: {
    type: String,
    trim: true,
    validate: {
      validator: function (v) {
        // Only validate if phone is provided
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
  isActive: {
    type: Boolean,
    default: true
  },
  // Student Removal/Exit Tracking
  removalDate: {
    type: Date,
    default: null
  },
  removalReason: {
    type: String,
    enum: ['Graduated', 'Transferred', 'Withdrawn', 'Expelled', 'Other', ''],
    default: ''
  },
  removalNotes: {
    type: String,
    trim: true,
    default: ''
  },
  // Legacy fields (kept for backward compatibility)
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
  // Login Management
  hasLogin: {
    type: Boolean,
    default: false
  },
  loginCreatedAt: {
    type: Date
  },
  loginCreatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  lastLogin: {
    type: Date,
    default: null
  },
  loginEnabled: {
    type: Boolean,
    default: true
  },
  forcePasswordChange: {
    type: Boolean,
    default: false
  },
  // For teachers
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
  // For employees (teachers, admin, staff, accountant)
  employeeId: {
    type: String,
    sparse: true,
    index: true
  },
  salary: {
    type: Number,
    min: 0
  },
  dateOfJoining: {
    type: Date
  },
  designation: {
    type: String,
    trim: true
  },
  department: {
    type: String,
    trim: true
  },
  fatherOrHusbandName: {
    type: String,
    trim: true
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other', ''],
    default: ''
  },
  // dateOfBirth already exists for students
  // religion already exists for students
  // bloodGroup already exists for students
  nationalId: {
    type: String,
    trim: true // Aadhaar, SSN, etc.
  },
  education: {
    type: String,
    trim: true
  },
  experience: {
    type: Number, // years
    min: 0
  },
  homeAddress: {
    type: String,
    trim: true
  },
  // Bank Details (for employees)
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
    trim: true,
    uppercase: true
  },
  // Leave deduction settings
  leaveDeductionPerDay: {
    type: Number,
    min: 0,
    default: 0
  },
  // For parents
  children: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  // For students - Basic Info
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
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class'
  },
  admissionDate: {
    type: Date
  },
  admissionClass: {
    type: String,
    trim: true
  },
  admissionSection: {
    type: String,
    trim: true
  },
  // Legacy Fields
  penNumber: {
    type: String,
    trim: true,
    sparse: true,
    index: true
  },
  subDepartment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubDepartment',
    sparse: true
  },
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver',
    sparse: true,
    index: true
  },
  udiseCode: {
    type: String,
    trim: true
  },
  // Personal Details
  dateOfBirth: {
    type: Date
  },
  bloodGroup: {
    type: String,
    enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', ''],
    default: ''
  },
  religion: {
    type: String,
    trim: true
  },
  category: {
    type: String,
    enum: ['General', 'SC', 'ST', 'OBC', 'Other', ''],
    default: ''
  },
  identificationMark: {
    type: String,
    trim: true
  },
  isOrphan: {
    type: Boolean,
    default: false
  },
  // Academic Background
  previousSchool: {
    type: String,
    trim: true
  },
  previousBoard: {
    type: String,
    trim: true
  },
  previousRollNumber: {
    type: String,
    trim: true
  },
  transferNotes: {
    type: String,
    trim: true
  },
  // Medical Information
  medicalConditions: {
    type: String,
    trim: true
  },
  allergies: {
    type: String,
    trim: true
  },
  // Additional Student Info
  siblingCount: {
    type: Number,
    default: 0
  },
  familyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Family'
  },
  photo: {
    type: String // URL to photo
  },
  notes: {
    type: String,
    trim: true
  },
  // Academic Details
  academicYear: {
    type: String, // e.g. "2025-2026"
    required: function () { return this.role === 'student'; }
  },
  section: {
    type: String, // e.g. "A", "B"
    trim: true
  },
  sectionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Section',
    index: true
  },
  board: {
    type: String, // e.g. "CBSE"
    trim: true
  },
  // Guardian Details
  guardians: [{
    relation: { type: String, enum: ['Father', 'Mother', 'Guardian'], required: true },
    name: { type: String, required: true },
    phone: String,
    email: String,
    isPrimary: { type: Boolean, default: false }
  }],
  credentialsSent: {
    type: Boolean,
    default: false
  },
  address: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Index for better performance
// Email unique per tenant (only when email exists)
userSchema.index(
  { email: 1, tenantId: 1 },
  {
    unique: true,
    partialFilterExpression: { email: { $exists: true, $ne: null, $ne: '' } }
  }
);
userSchema.index({ role: 1, tenantId: 1 });
userSchema.index({ tenantId: 1 });

// Unique Admission Number per Tenant
userSchema.index(
  { admissionNumber: 1, tenantId: 1 },
  { unique: true, partialFilterExpression: { admissionNumber: { $exists: true } } }
);

// Unique Roll Number per Class + Section + Academic Year + Tenant
userSchema.index(
  { rollNumber: 1, class: 1, section: 1, academicYear: 1, tenantId: 1 },
  { unique: true, partialFilterExpression: { rollNumber: { $exists: true }, role: 'student' } }
);

// Unique Employee ID per Tenant
userSchema.index(
  { employeeId: 1, tenantId: 1 },
  { unique: true, partialFilterExpression: { employeeId: { $exists: true } } }
);

// Unique Phone per Tenant
userSchema.index(
  { phone: 1, tenantId: 1 },
  { unique: true, partialFilterExpression: { phone: { $exists: true, $ne: '' } } }
);

// Unique PEN Number per Tenant
userSchema.index(
  { penNumber: 1, tenantId: 1 },
  { unique: true, partialFilterExpression: { penNumber: { $exists: true, $ne: '' } } }
);

// Auto-generate fullName and handle name parts
userSchema.pre('validate', function (next) {
  // Priority 1: If fullName exists, use it as primary
  // Priority 2: If name parts exist but no fullName, generate fullName
  // Priority 3: If fullName exists but no parts, optionally split (for backward compat)

  if (!this.fullName && (this.firstName || this.lastName || this.name)) {
    // Generate fullName from available parts
    if (this.firstName || this.lastName) {
      const parts = [this.firstName, this.middleName, this.lastName].filter(Boolean);
      this.fullName = parts.join(' ');
    } else if (this.name) {
      this.fullName = this.name;
    }
  }

  // Auto-populate legacy 'name' field for backward compatibility
  if (this.fullName && !this.name) {
    this.name = this.fullName;
  } else if (!this.name && this.firstName && this.lastName) {
    this.name = `${this.firstName} ${this.middleName ? this.middleName + ' ' : ''}${this.lastName}`;
  }

  // Optional: Auto-split fullName into parts if parts are missing (best-effort)
  if (this.fullName && !this.firstName && !this.lastName) {
    const parts = this.fullName.trim().split(/\s+/);
    if (parts.length === 1) {
      this.firstName = parts[0];
      this.lastName = '';
    } else if (parts.length === 2) {
      this.firstName = parts[0];
      this.lastName = parts[1];
    } else if (parts.length >= 3) {
      this.firstName = parts[0];
      this.lastName = parts[parts.length - 1];
      this.middleName = parts.slice(1, -1).join(' ');
    }
  }

  next();
});

// Hash password before saving and set hasLogin flag
userSchema.pre('save', async function (next) {
  // Auto-set hasLogin flag based on email and password
  if (this.email && this.password) {
    this.hasLogin = true;
  } else if (!this.email || !this.password) {
    this.hasLogin = false;
  }

  // Skip password hashing if no password or password not modified
  if (!this.password || !this.isModified('password')) return next();

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
