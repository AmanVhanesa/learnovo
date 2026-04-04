const express = require('express');
const crypto = require('crypto');
const { body } = require('express-validator');
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const { protect, generateToken } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');
const { getTenantFromRequest } = require('../middleware/tenant');
const upload = require('../middleware/upload');
const cloudinaryService = require('../services/cloudinaryService');
const emailService = require('../services/emailService');
const rateLimit = require('express-rate-limit');

const router = express.Router();

// Rate limiter for password reset: 5 requests per 15 minutes per IP
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: false, message: 'Too many password reset attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

// @desc    Register user (within a tenant)
// @route   POST /api/auth/register
// @access  Private (Admin only)
router.post('/register', protect, getTenantFromRequest, [
  body('name').trim().isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
  body('role').isIn(['admin', 'teacher', 'student', 'parent']).withMessage('Invalid role'),
  body('phone').optional().isMobilePhone().withMessage('Please provide a valid phone number'),
  handleValidationErrors
], async(req, res) => {
  try {
    // Only admins can register new users
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can register new users'
      });
    }

    const { name, email, password, role, phone } = req.body;

    // Check if user already exists in this tenant
    const existingUser = await User.findOne({
      email: email.toLowerCase(),
      tenantId: req.tenant._id
    });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email in your school'
      });
    }

    // Check subscription limits using planConfig (single source of truth)
    const { getPlanConfig } = require('../utils/planConfig');
    const planConfig = getPlanConfig(req.tenant.subscription?.plan || 'free');
    const limitKey = role === 'student' ? 'students' : 'teachers';
    const maxUsers = req.tenant.subscription?.customLimits?.[limitKey]
      ?? planConfig.limits?.[limitKey]
      ?? Infinity;

    if (maxUsers !== Infinity) {
      const userCount = await User.countDocuments({
        tenantId: req.tenant._id,
        role: role,
        isActive: true
      });
      if (userCount >= maxUsers) {
        return res.status(400).json({
          success: false,
          message: `Maximum ${role}s limit reached for your ${planConfig.name} plan (${maxUsers} allowed)`
        });
      }
    }

    // Create user
    const user = await User.create({
      tenantId: req.tenant._id,
      name,
      email: email.toLowerCase(),
      password,
      role,
      phone
    });

    // Generate token
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration'
    });
  }
});

// Helper function to ensure Demo Tenant exists
async function ensureDemoTenant() {
  let demoTenant = await Tenant.findOne({ schoolCode: 'demo' });

  if (!demoTenant) {
    try {
      demoTenant = await Tenant.create({
        schoolName: 'Demo School',
        schoolCode: 'demo',
        subdomain: 'demo',
        email: 'admin@learnovo.com',
        subscription: {
          plan: 'enterprise',
          status: 'active',
          maxStudents: 10000,
          maxTeachers: 500,
          startDate: new Date(),
          endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
        }
      });
      console.log('✅ Demo Tenant created');
    } catch (error) {
      demoTenant = await Tenant.findOne({ schoolCode: 'demo' });
      if (!demoTenant) throw error;
    }
  }

  // Create demo users if they don't exist (idempotent)
  const demoUsers = [
    { email: 'admin@learnovo.com', name: 'Demo Admin', password: 'admin123', role: 'admin' },
    { email: 'sarah.wilson@learnovo.com', name: 'Sarah Wilson', password: 'teacher123', role: 'teacher', phone: '+919876543211' },
    {
      email: 'john.doe@learnovo.com',
      name: 'John Doe',
      password: 'student123',
      role: 'student',
      phone: '+919876543212',
      class: '10th Grade',
      rollNumber: 'STU001',
      admissionDate: new Date('2023-07-01'),
      guardianName: 'Jane Doe',
      guardianPhone: '+919876543213',
      address: '123 Main Street'
    },
    { email: 'parent@learnovo.com', name: 'Demo Parent', password: 'parent123', role: 'parent', phone: '+919876543214' }
  ];

  for (const userData of demoUsers) {
    try {
      const existingUser = await User.findOne({
        email: userData.email.toLowerCase(),
        tenantId: demoTenant._id
      });

      if (!existingUser) {
        await User.create({
          tenantId: demoTenant._id,
          ...userData,
          email: userData.email.toLowerCase(),
          isActive: true
        });
        console.log(`✅ Demo user created: ${userData.email}`);
      }
    } catch (error) {
      // User might have been created concurrently, ignore
      console.log(`⚠️ Demo user ${userData.email} already exists or error:`, error.message);
    }
  }

  return demoTenant;
}

// @desc    Login user (tenant-based)
// @route   POST /api/auth/login
// @access  Public
router.post('/login', [
  body('email').notEmpty().withMessage('Please provide an email or admission number'),
  body('password').notEmpty().withMessage('Password is required'),
  body('schoolCode').optional().trim(),
  handleValidationErrors
], async(req, res) => {
  try {
    const { email, password, schoolCode } = req.body;
    // 'email' field in request can be either an actual email or an admission number
    const loginIdentifier = email.trim();
    const emailLower = loginIdentifier.toLowerCase();

    // Determine if this is a demo login
    const demoEmails = ['admin@learnovo.com', 'sarah.wilson@learnovo.com', 'john.doe@learnovo.com', 'parent@learnovo.com'];
    const isDemoLogin = demoEmails.includes(emailLower) || (schoolCode && schoolCode.toLowerCase() === 'demo');

    // Get tenant
    let tenant = null;
    if (isDemoLogin) {
      try {
        tenant = await ensureDemoTenant();
      } catch (error) {
        console.error('Error ensuring demo tenant:', error);
        return res.status(500).json({
          success: false,
          message: 'Failed to initialize demo environment',
          error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
      }
    } else if (schoolCode) {
      tenant = await Tenant.findOne({ schoolCode: schoolCode.toLowerCase(), isActive: true });
      if (!tenant) {
        return res.status(404).json({ success: false, message: 'School not found or inactive' });
      }
    }

    // Find user by email or admissionNumber (escape regex special chars for safety)
    const escapedIdentifier = loginIdentifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const identifierQuery = {
      $or: [
        { email: emailLower },
        { admissionNumber: { $regex: new RegExp(`^${escapedIdentifier}$`, 'i') } }
      ]
    };

    const userQuery = { ...identifierQuery };
    if (tenant) {
      userQuery.tenantId = tenant._id;
    }

    let user = await User.findOne(userQuery).select('+password').populate('tenantId');

    // If not found and no tenant specified, try finding by identifier only
    if (!user && !tenant) {
      user = await User.findOne(identifierQuery).select('+password').populate('tenantId');
      if (user && user.tenantId) {
        tenant = typeof user.tenantId === 'object' ? user.tenantId : await Tenant.findById(user.tenantId);
      }
    }

    // User not found
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    // Verify tenant matches (for non-demo logins)
    if (!isDemoLogin && tenant && user.tenantId) {
      const userTenantId = typeof user.tenantId === 'object' ? user.tenantId._id.toString() : user.tenantId.toString();
      if (userTenantId !== tenant._id.toString()) {
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }
    }

    // Check if active
    if (!user.isActive) {
      return res.status(401).json({ success: false, message: 'Account has been deactivated' });
    }

    // Verify password
    if (!user.password) {
      console.error('User has no password field:', user.email);
      return res.status(500).json({
        success: false,
        message: 'User account error. Please contact support.',
        error: process.env.NODE_ENV === 'development' ? 'User password field is missing' : undefined
      });
    }

    let isPasswordValid = false;
    try {
      isPasswordValid = await user.comparePassword(password);
    } catch (compareError) {
      console.error('Password comparison error:', compareError);
      return res.status(500).json({
        success: false,
        message: 'Authentication error',
        error: process.env.NODE_ENV === 'development' ? compareError.message : undefined
      });
    }

    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    // Update last login (non-blocking)
    User.updateOne({ _id: user._id }, { $set: { lastLogin: new Date() } }).catch(() => { });

    // Populate children for parent role (name, class, section, avatar, admissionNumber)
    let populatedChildren = [];
    if (user.role === 'parent' && user.children && user.children.length > 0) {
      const childDocs = await User.find(
        { _id: { $in: user.children }, tenantId: user.tenantId },
        'name firstName lastName fullName admissionNumber class section avatar photo'
      ).populate('class', 'name').populate('section', 'name');
      populatedChildren = childDocs.map(c => ({
        id: c._id,
        name: c.fullName || c.name || `${c.firstName || ''} ${c.lastName || ''}`.trim(),
        admissionNumber: c.admissionNumber,
        className: c.class?.name || '',
        sectionName: c.section?.name || '',
        avatar: c.avatar || c.photo || null
      }));
    }

    // Generate token
    let token;
    try {
      if (!user._id) {
        throw new Error('User ID is missing');
      }
      token = generateToken(user._id);
    } catch (tokenError) {
      console.error('Token generation error:', tokenError);
      return res.status(500).json({
        success: false,
        message: 'Failed to generate authentication token',
        error: process.env.NODE_ENV === 'development' ? tokenError.message : undefined
      });
    }

    // Prepare response data
    const tenantId = user.tenantId && (user.tenantId._id || user.tenantId);

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        fullName: user.fullName,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        photo: user.photo,
        phone: user.phone,
        address: user.address,
        lastLogin: user.lastLogin,
        tenantId: tenantId ? tenantId.toString() : null,
        // Student-specific fields
        admissionNumber: user.admissionNumber,
        rollNumber: user.rollNumber,
        class: user.class,
        section: user.section,
        admissionDate: user.admissionDate,
        penNumber: user.penNumber,
        // Employee/Teacher-specific fields
        employeeId: user.employeeId,
        designation: user.designation,
        department: user.department,
        dateOfJoining: user.dateOfJoining,
        // Common personal fields
        dateOfBirth: user.dateOfBirth,
        gender: user.gender,
        bloodGroup: user.bloodGroup,
        religion: user.religion,
        category: user.category,
        fatherOrHusbandName: user.fatherOrHusbandName,
        homeAddress: user.homeAddress,
        nationalId: user.nationalId,
        education: user.education,
        experience: user.experience,
        guardians: user.guardians,
        // Parent-specific: populated children list
        children: populatedChildren.length > 0 ? populatedChildren : undefined
      },
      tenant: tenant ? {
        id: tenant._id,
        schoolName: tenant.schoolName,
        schoolCode: tenant.schoolCode,
        subdomain: tenant.subdomain,
        primaryColor: tenant.primaryColor,
        secondaryColor: tenant.secondaryColor
      } : null
    });
  } catch (error) {
    console.error('Login error:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Server error during login',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      errorName: process.env.NODE_ENV === 'development' ? error.name : undefined
    });
  }
});

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
router.get('/me', protect, async(req, res) => {
  try {
    const user = await User.findById(req.user.id);

    // Also fetch tenant data (needed for cross-subdomain login handoff)
    let tenant = null;
    if (user.tenantId) {
      const tenantDoc = await Tenant.findById(user.tenantId);
      if (tenantDoc) {
        tenant = {
          id: tenantDoc._id,
          schoolName: tenantDoc.schoolName,
          schoolCode: tenantDoc.schoolCode,
          subdomain: tenantDoc.subdomain,
          primaryColor: tenantDoc.primaryColor,
          secondaryColor: tenantDoc.secondaryColor
        };
      }
    }

    // Populate children for parent role
    let populatedChildren = [];
    if (user.role === 'parent' && user.children && user.children.length > 0) {
      const childDocs = await User.find(
        { _id: { $in: user.children }, tenantId: user.tenantId },
        'name firstName lastName fullName admissionNumber class section avatar photo'
      ).populate('class', 'name').populate('section', 'name');
      populatedChildren = childDocs.map(c => ({
        id: c._id,
        name: c.fullName || c.name || `${c.firstName || ''} ${c.lastName || ''}`.trim(),
        admissionNumber: c.admissionNumber,
        className: c.class?.name || '',
        sectionName: c.section?.name || '',
        avatar: c.avatar || c.photo || null
      }));
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        fullName: user.fullName,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        photo: user.photo,
        phone: user.phone,
        address: user.address,
        tenantId: user.tenantId,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt,
        // Student-specific fields
        admissionNumber: user.admissionNumber,
        rollNumber: user.rollNumber,
        class: user.class,
        section: user.section,
        admissionDate: user.admissionDate,
        penNumber: user.penNumber,
        // Employee/Teacher-specific fields
        employeeId: user.employeeId,
        designation: user.designation,
        department: user.department,
        dateOfJoining: user.dateOfJoining,
        // Common personal fields
        dateOfBirth: user.dateOfBirth,
        gender: user.gender,
        bloodGroup: user.bloodGroup,
        religion: user.religion,
        category: user.category,
        fatherOrHusbandName: user.fatherOrHusbandName,
        homeAddress: user.homeAddress,
        nationalId: user.nationalId,
        education: user.education,
        experience: user.experience,
        guardians: user.guardians,
        // Parent-specific: populated children list
        children: populatedChildren.length > 0 ? populatedChildren : undefined
      },
      tenant
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
router.put('/profile', protect, [
  body('name').optional().trim().isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters'),
  body('phone').optional().isMobilePhone().withMessage('Please provide a valid phone number'),
  body('dateOfBirth').optional().isISO8601().withMessage('Please provide a valid date of birth'),
  body('gender').optional().isIn(['Male', 'Female', 'Other']).withMessage('Gender must be Male, Female or Other'),
  body('bloodGroup').optional().isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', '']).withMessage('Invalid blood group'),
  handleValidationErrors
], async(req, res) => {
  try {
    const { name, phone, address, dateOfBirth, gender, bloodGroup, religion, fatherOrHusbandName, homeAddress, nationalId, education, experience, category } = req.body;
    const userId = req.user.id;

    const updateData = {};
    if (name !== undefined) {
      updateData.name = name;
      updateData.fullName = name;
    }
    if (phone !== undefined) updateData.phone = phone;
    if (address !== undefined) updateData.address = address;
    if (dateOfBirth !== undefined) updateData.dateOfBirth = dateOfBirth;
    if (gender !== undefined) updateData.gender = gender;
    if (bloodGroup !== undefined) updateData.bloodGroup = bloodGroup;
    if (religion !== undefined) updateData.religion = religion;
    if (fatherOrHusbandName !== undefined) updateData.fatherOrHusbandName = fatherOrHusbandName;
    if (homeAddress !== undefined) updateData.homeAddress = homeAddress;
    if (nationalId !== undefined) updateData.nationalId = nationalId;
    if (education !== undefined) updateData.education = education;
    if (experience !== undefined) updateData.experience = experience;
    if (category !== undefined) updateData.category = category;

    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        name: user.name,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        photo: user.photo,
        phone: user.phone,
        address: user.address,
        tenantId: user.tenantId,
        admissionNumber: user.admissionNumber,
        rollNumber: user.rollNumber,
        class: user.class,
        section: user.section,
        employeeId: user.employeeId,
        designation: user.designation,
        department: user.department,
        dateOfBirth: user.dateOfBirth,
        gender: user.gender,
        bloodGroup: user.bloodGroup,
        religion: user.religion,
        category: user.category,
        fatherOrHusbandName: user.fatherOrHusbandName,
        homeAddress: user.homeAddress,
        nationalId: user.nationalId,
        education: user.education,
        experience: user.experience,
        guardians: user.guardians
      }
    });
  } catch (error) {
    console.error('Profile update error:', error);

    // Return field-level Mongoose validation errors
    if (error.name === 'ValidationError') {
      const fieldErrors = Object.entries(error.errors).map(([field, err]) => ({
        field,
        message: err.message
      }));
      return res.status(400).json({
        success: false,
        message: fieldErrors.map(e => e.message).join('. '),
        errors: fieldErrors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error during profile update'
    });
  }
});

// @desc    Change password
// @route   PUT /api/auth/password
// @access  Private
router.put('/password', protect, [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters long'),
  handleValidationErrors
], async(req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    // Get user with password
    const user = await User.findById(userId).select('+password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during password change'
    });
  }
});

// @desc    Upload profile photo
// @route   POST /api/auth/upload-photo
// @access  Private
router.post('/upload-photo', protect, upload.single('photo'), async(req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No photo file provided' });
    }

    const tenantId = req.user.tenantId ? req.user.tenantId.toString() : 'general';

    // Upload to Cloudinary under learnovo/<tenantId>/avatars/
    const result = await cloudinaryService.uploadFromMulter(req.file, {
      tenantId,
      folder: 'avatars',
      subPath: `${req.user._id}`,
      transformation: {
        width: 400,
        height: 400,
        crop: 'fill',
        gravity: 'face',
        quality: 'auto:good'
      }
    });

    // Save the Cloudinary URL into the user's avatar field
    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { avatar: result.secure_url },
      { new: true }
    );

    // Persist to cached localStorage on next /me fetch
    res.json({
      success: true,
      message: 'Profile photo updated successfully',
      avatar: result.secure_url,
      photo: result.secure_url,  // alias for frontend compatibility
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        fullName: updatedUser.fullName,
        email: updatedUser.email,
        role: updatedUser.role,
        avatar: updatedUser.avatar,
        photo: updatedUser.avatar
      }
    });
  } catch (error) {
    console.error('Upload photo error:', error.name, error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error while uploading photo'
    });
  }
});

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
router.post('/logout', protect, (req, res) => {
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

// @desc    Forgot password
// @route   POST /api/auth/forgot-password
// @access  Public
router.post('/forgot-password', forgotPasswordLimiter, [
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  handleValidationErrors
], async(req, res) => {
  try {
    const { email } = req.body;

    // Always return the same response to prevent user enumeration
    const successMessage = 'If an account with that email exists, password reset instructions have been sent';

    const user = await User.findOne({ email }).select('+resetPasswordToken +resetPasswordExpire');
    if (!user) {
      return res.json({ success: true, message: successMessage });
    }

    // Generate cryptographically secure reset token
    const resetToken = crypto.randomBytes(32).toString('hex');

    // Hash token before storing in DB (so a DB leak doesn't expose valid tokens)
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpire = Date.now() + 60 * 60 * 1000; // 1 hour
    await user.save({ validateBeforeSave: false });

    // Send reset email with the unhashed token (user receives this in the link)
    try {
      const userName = user.name || user.fullName || user.firstName || 'User';
      await emailService.sendPasswordResetEmail(user.email, resetToken, userName);
    } catch (emailError) {
      // If email fails, clear the token so user can retry
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save({ validateBeforeSave: false });

      console.error('Failed to send password reset email:', emailError);
      return res.status(500).json({
        success: false,
        message: 'Failed to send reset email. Please try again later.'
      });
    }

    res.json({ success: true, message: successMessage });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during password reset'
    });
  }
});

// @desc    Reset password
// @route   PUT /api/auth/reset-password
// @access  Public
router.put('/reset-password', [
  body('token').notEmpty().withMessage('Reset token is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
  handleValidationErrors
], async(req, res) => {
  try {
    const { token, password } = req.body;

    // Hash the incoming token to compare against the stored hash
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Find user with matching token that hasn't expired
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() }
    }).select('+resetPasswordToken +resetPasswordExpire +password');

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }

    // Set new password (pre-save hook will hash it)
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    res.json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during password reset'
    });
  }
});

module.exports = router;
