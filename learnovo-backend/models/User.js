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
    enum: ['admin', 'teacher', 'student', 'parent', 'accountant', 'staff', 'librarian', 'driver', 'support_staff', 'principal', 'vice_principal'],
    required: [true, 'Role is required']
  },
  phone: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        if (!v || v.trim() === '') return true;
        return /^[+]?[1-9][\d]{5,15}$/.test(v);
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
  // Coordinator flag — a teacher with school-wide view-only access to all
  // students and employees (but no access to fees/finance data).
  isCoordinator: {
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
    trim: true,
    uppercase: true
  },

  // ── Employee emergency contact ──────────────────────────────────
  emergencyContact: {
    name: { type: String, trim: true },
    phone: { type: String, trim: true },
    relation: { type: String, trim: true }
  },

  // ── Employee leave balance ──────────────────────────────────────
  leaveBalance: {
    casual: { type: Number, default: 12, min: 0 },
    sick: { type: Number, default: 12, min: 0 },
    earned: { type: Number, default: 15, min: 0 }
  },

  // ── Employee joining letter ─────────────────────────────────────
  joiningLetter: {
    type: String,
    trim: true
  },

  // ── Service Book fields ─────────────────────────────────────────
  maritalStatus: {
    type: String,
    enum: ['', 'single', 'married', 'divorced', 'widowed'],
    default: ''
  },
  employmentType: {
    type: String,
    enum: ['', 'permanent', 'probation', 'contract', 'temporary', 'visiting'],
    default: ''
  },
  appointmentOrderNo: {
    type: String,
    trim: true
  },
  probationEndDate: {
    type: Date
  },
  reportingTo: {
    type: String,
    trim: true
  },
  specialization: {
    type: String,
    trim: true
  },
  previousEmployer: {
    type: String,
    trim: true
  },
  previousDesignation: {
    type: String,
    trim: true
  },
  certifications: [{
    type: String,
    trim: true
  }],
  educationalQualifications: [{
    degree: { type: String, trim: true },
    boardOrUniversity: { type: String, trim: true },
    yearOfPassing: { type: String, trim: true },
    division: { type: String, trim: true },
    percentage: { type: String, trim: true }
  }],
  postings: [{
    fromDate: { type: Date },
    toDate: { type: Date },
    post: { type: String, trim: true },
    location: { type: String, trim: true },
    remarks: { type: String, trim: true }
  }],
  promotions: [{
    date: { type: Date },
    fromDesignation: { type: String, trim: true },
    toDesignation: { type: String, trim: true },
    orderNo: { type: String, trim: true },
    remarks: { type: String, trim: true }
  }],
  trainings: [{
    name: { type: String, trim: true },
    fromDate: { type: Date },
    toDate: { type: Date },
    institute: { type: String, trim: true },
    remarks: { type: String, trim: true }
  }],
  awards: [{
    name: { type: String, trim: true },
    date: { type: Date },
    description: { type: String, trim: true }
  }],
  serviceRemarks: {
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
  admissionClass: {
    type: String,
    trim: true
  },
  admissionSection: {
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
  motherTongue: {
    type: String,
    trim: true
  },
  aadhaarNumber: {
    type: String,
    trim: true
  },
  penNumber: {
    type: String,
    trim: true
  },
  apaarId: {
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
  isImported: {
    type: Boolean,
    default: false
  },
  studentType: {
    type: String,
    enum: ['old', 'new']
  },
  admissionFeePaid: {
    type: Boolean,
    default: false
  },
  guardians: [{
    relation: {
      type: String,
      trim: true
    },
    name: {
      type: String,
      trim: true
    },
    phone: {
      type: String,
      trim: true
    },
    email: {
      type: String,
      trim: true
    },
    occupation: {
      type: String,
      trim: true
    },
    aadhaarNumber: {
      type: String,
      trim: true
    },
    isPrimary: {
      type: Boolean,
      default: false
    }
  }],
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
  },

  // ── Student subject preferences ────────────────────────────────────
  // Subjects this student has opted out of (only optional subjects).
  // Marks for skipped subjects are excluded from results/report cards
  // but never deleted — they are simply ignored in calculations.
  skippedSubjects: [{
    type: String,
    trim: true
  }],

  // ── Student additional fields ──────────────────────────────────────
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
  identificationMark: {
    type: String,
    trim: true
  },
  isOrphan: {
    type: Boolean,
    default: false
  },
  nationality: {
    type: String,
    trim: true
  },
  medicalConditions: {
    type: String,
    trim: true
  },
  allergies: {
    type: String,
    trim: true
  },
  doctorName: {
    type: String,
    trim: true
  },
  doctorPhone: {
    type: String,
    trim: true
  },
  notes: {
    type: String
  },
  removalDate: {
    type: Date
  },
  removalReason: {
    type: String,
    enum: ['', 'Graduated', 'Transferred', 'Withdrawn', 'Expelled', 'Other'],
    default: ''
  },
  removalNotes: {
    type: String,
    trim: true
  },

  // ── Student documents (Aadhaar, TC, Birth Certificate, etc.) ────
  documents: [{
    type: {
      type: String,
      enum: ['student_aadhaar', 'tc', 'birth_certificate', 'guardian_aadhaar'],
      required: true
    },
    name: { type: String, trim: true },
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    resourceType: { type: String, enum: ['image', 'raw'], default: 'image' },
    format: { type: String, trim: true },
    bytes: { type: Number },
    guardianIndex: { type: Number, min: 0 },
    uploadedAt: { type: Date, default: Date.now },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    // When a guardian_aadhaar is linked from a sibling instead of re-uploaded,
    // these track the source so we can avoid duplicate Cloudinary storage and
    // skip Cloudinary deletion while any sibling still references the asset.
    linkedFromStudentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    linkedFromDocId: { type: mongoose.Schema.Types.ObjectId }
  }],

  // ── Password reset fields ────────────────────────────────────────
  resetPasswordToken: {
    type: String,
    select: false
  },
  resetPasswordExpire: {
    type: Date,
    select: false
  }
}, {
  timestamps: true
});

// Index for better performance
// Email unique per tenant — partial filter (not sparse) so null/missing emails
// are excluded entirely. Sparse indexes still index explicit null values, which
// causes E11000 duplicate-key errors on bulk import of students without emails.
userSchema.index(
  { email: 1, tenantId: 1 },
  { unique: true, partialFilterExpression: { email: { $type: 'string' } } }
);
userSchema.index({ role: 1, tenantId: 1 });
userSchema.index({ tenantId: 1 });
userSchema.index({ tenantId: 1, admissionNumber: 1 });
// Student query optimization indexes
userSchema.index({ tenantId: 1, role: 1, class: 1, section: 1 });
userSchema.index({ tenantId: 1, rollNumber: 1 });
userSchema.index({ tenantId: 1, penNumber: 1 }, { sparse: true });
userSchema.index({ tenantId: 1, apaarId: 1 }, { sparse: true });
userSchema.index({ tenantId: 1, classId: 1 });
userSchema.index({ tenantId: 1, driverId: 1 }, { sparse: true });
// Employee query optimization indexes
userSchema.index({ tenantId: 1, employeeId: 1 }, { sparse: true });
userSchema.index({ tenantId: 1, isActive: 1 });
// Backs the Students page "Recent Admission" toggle. Admission numbers are
// stored as strings, so sorting them descending gives lexicographic order
// ("812" > "6424") — confusing for users on tenants with unpadded numbers
// like SPIS. The students route remaps sortBy=admissionNumber to createdAt
// so newest admissions actually appear first; this index keeps that sort
// O(log n) and avoids the in-memory sort path that crashed SPIS on 2026-05-21.
userSchema.index({ tenantId: 1, role: 1, createdAt: -1 });

// Hash password before saving
userSchema.pre('save', async function(next) {
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
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Get user without sensitive data
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  return user;
};

module.exports = mongoose.model('User', userSchema);
