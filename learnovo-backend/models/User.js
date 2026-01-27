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

  // Identity
  firstName: {
    type: String,
    required: function () { return this.role === 'student'; },
    trim: true
  },
  middleName: {
    type: String,
    trim: true
  },
  lastName: {
    type: String,
    required: function () { return this.role === 'student'; },
    trim: true
  },
  name: { // Keeping for backward compatibility & display
    type: String,
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
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
  // Status Management (for students)
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
userSchema.index({ email: 1, tenantId: 1 }, { unique: true }); // Email unique per tenant
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

// Auto-generate full name if missing but parts exist
userSchema.pre('validate', function (next) {
  if (this.firstName && this.lastName && !this.name) {
    this.name = `${this.firstName} ${this.middleName ? this.middleName + ' ' : ''}${this.lastName}`;
  }
  // If name exists but parts missing (backward compat), try to split (naive)
  if (this.name && !this.firstName) {
    const parts = this.name.split(' ');
    this.firstName = parts[0];
    this.lastName = parts.length > 1 ? parts[parts.length - 1] : '';
  }
  next();
});

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
