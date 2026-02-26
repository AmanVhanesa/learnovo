const express = require('express');
const { body } = require('express-validator');
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const { protect, generateToken, sendTokenResponse } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');
const { getTenantFromRequest } = require('../middleware/tenant');
const upload = require('../middleware/upload');
const cloudinaryService = require('../services/cloudinaryService');


const router = express.Router();

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
], async (req, res) => {
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

    // Check subscription limits
    const userCount = await User.countDocuments({
      tenantId: req.tenant._id,
      role: role
    });

    const maxUsers = role === 'student' ? req.tenant.subscription.maxStudents : req.tenant.subscription.maxTeachers;
    if (userCount >= maxUsers) {
      return res.status(400).json({
        success: false,
        message: `Maximum ${role}s limit reached for your subscription plan`
      });
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
  body('email').custom((value) => {
    // Allow email, admission number, or employee ID
    if (!value || value.trim() === '') {
      throw new Error('Email, Admission Number, or Employee ID is required');
    }
    return true;
  }),
  body('password').notEmpty().withMessage('Password is required'),
  body('schoolCode').optional().trim(),
  handleValidationErrors
], async (req, res) => {
  try {
    const { email, password, schoolCode } = req.body;
    const identifier = email.toLowerCase().trim();

    // Determine if this is a demo login
    const demoEmails = ['admin@learnovo.com', 'sarah.wilson@learnovo.com', 'john.doe@learnovo.com', 'parent@learnovo.com'];
    const isDemoLogin = demoEmails.includes(identifier) || (schoolCode && schoolCode.toLowerCase() === 'demo');

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
      console.log(`[LOGIN DEBUG] Searching for school: '${schoolCode}'`);

      // Find tenant (don't filter by active yet to debug)
      tenant = await Tenant.findOne({ schoolCode: schoolCode.toLowerCase().trim() });

      if (!tenant) {
        console.log(`[LOGIN DEBUG] School '${schoolCode}' NOT FOUND in DB`);
        return res.status(404).json({ success: false, message: 'School not found' });
      }

      console.log(`[LOGIN DEBUG] School found: ${tenant.schoolName}, Active: ${tenant.isActive}`);

      if (!tenant.isActive) {
        return res.status(404).json({ success: false, message: 'School is inactive. Please contact support.' });
      }
    }

    // Find user - check if identifier is email or other ID (admissionNumber/employeeId)
    const isEmail = identifier.includes('@');
    let userQuery;

    if (isEmail) {
      userQuery = { email: identifier };
    } else {
      // Use case-insensitive search for admission number or employee ID
      const safeIdentifier = identifier.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&');
      userQuery = {
        $or: [
          { admissionNumber: { $regex: new RegExp(`^${safeIdentifier}$`, 'i') }, role: { $in: ['student', 'parent'] } },
          { employeeId: { $regex: new RegExp(`^${safeIdentifier}$`, 'i') }, role: { $in: ['admin', 'teacher', 'staff', 'accountant'] } }
        ]
      };
    }

    if (tenant) {
      userQuery.tenantId = tenant._id;
    }

    let user = await User.findOne(userQuery).select('+password').populate('tenantId');

    // If not found and no tenant specified, try finding by identifier only
    if (!user && !tenant) {
      if (isEmail) {
        userQuery = { email: identifier };
      } else {
        const safeIdentifier = identifier.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&');
        userQuery = {
          $or: [
            { admissionNumber: { $regex: new RegExp(`^${safeIdentifier}$`, 'i') }, role: { $in: ['student', 'parent'] } },
            { employeeId: { $regex: new RegExp(`^${safeIdentifier}$`, 'i') }, role: { $in: ['admin', 'teacher', 'staff', 'accountant'] } }
          ]
        };
      }

      user = await User.findOne(userQuery).select('+password').populate('tenantId');
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
        email: user.email,
        role: user.role,
        avatar: user.avatar || user.photo || null,
        photo: user.photo || user.avatar || null,
        phone: user.phone,
        address: user.address,
        lastLogin: user.lastLogin,
        tenantId: tenantId ? tenantId.toString() : null
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
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar || user.photo || null,
        photo: user.photo || user.avatar || null,
        phone: user.phone,
        address: user.address,
        dateOfBirth: user.dateOfBirth,
        gender: user.gender,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt,
        tenantId: user.tenantId
      }
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
  body('email').optional().isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('phone').optional().isMobilePhone().withMessage('Please provide a valid phone number'),
  body('address').optional().isString().withMessage('Address must be a string'),
  body('dateOfBirth').optional().isISO8601().withMessage('Valid date of birth is required'),
  body('gender').optional().isIn(['male', 'female', 'other']).withMessage('Invalid gender'),
  handleValidationErrors
], async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Define allowed fields based on role
    const allowedFields = {
      student: ['name', 'email', 'phone', 'address', 'dateOfBirth', 'gender', 'bloodGroup', 'religion'],
      teacher: ['name', 'email', 'phone', 'address', 'dateOfBirth', 'gender', 'bloodGroup', 'religion', 'education', 'experience', 'homeAddress'],
      admin: ['name', 'email', 'phone', 'address', 'dateOfBirth', 'gender'],
      parent: ['name', 'email', 'phone', 'address'],
      accountant: ['name', 'email', 'phone', 'address', 'dateOfBirth', 'gender'],
      staff: ['name', 'email', 'phone', 'address', 'dateOfBirth', 'gender']
    };

    // Fields that are NEVER allowed to be updated via this endpoint
    const protectedFields = ['salary', 'role', 'tenantId', 'isActive', 'loginEnabled', 'employeeId', 'admissionNumber'];

    const roleAllowedFields = allowedFields[user.role] || [];
    const updateData = {};

    // Filter and validate update fields
    for (const [key, value] of Object.entries(req.body)) {
      // Skip protected fields
      if (protectedFields.includes(key)) {
        continue;
      }

      // Only allow fields that are permitted for this role
      if (roleAllowedFields.includes(key)) {
        updateData[key] = value;
      }
    }

    // Check email uniqueness if being updated
    if (updateData.email && updateData.email !== user.email) {
      const existingUser = await User.findOne({
        email: updateData.email.toLowerCase(),
        tenantId: user.tenantId,
        _id: { $ne: userId }
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Email already in use'
        });
      }
    }

    // Update user
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        avatar: updatedUser.avatar || updatedUser.photo || null,
        photo: updatedUser.photo || updatedUser.avatar || null,
        phone: updatedUser.phone,
        address: updatedUser.address,
        dateOfBirth: updatedUser.dateOfBirth,
        gender: updatedUser.gender
      }
    });
  } catch (error) {
    console.error('Profile update error:', error);
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
], async (req, res) => {
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
router.post('/forgot-password', [
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found with this email'
      });
    }

    // Generate reset token (in production, use crypto.randomBytes)
    const resetToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

    // In production, save reset token to database with expiration
    // For now, just send a response
    res.json({
      success: true,
      message: 'Password reset instructions sent to your email',
      resetToken // Remove this in production
    });
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
], async (req, res) => {
  try {
    const { token, password } = req.body;

    // In production, verify token and check expiration
    // For now, just update password if token is provided
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

// @desc    Temp route to reset SPIS passwords
// @route   GET /api/auth/temp-reset-spis
// @access  Public
router.get('/temp-reset-spis', async (req, res) => {
  try {
    const bcrypt = require('bcryptjs');
    const Tenant = require('../models/Tenant');

    const tenant = await Tenant.findOne({ schoolCode: 'spis' });
    if (!tenant) {
      return res.status(404).json({ message: 'spis tenant not found' });
    }

    const salt = await bcrypt.genSalt(12);
    const employeeHash = await bcrypt.hash('employee123', salt);
    const studentHash = await bcrypt.hash('student123', salt);

    const users = await User.find({ tenantId: tenant._id, role: { $ne: 'admin' } });

    let employeeCount = 0;
    let studentCount = 0;

    const bulkOps = users.map(user => {
      let hashToUse;
      if (['teacher', 'staff', 'accountant', 'librarian'].includes(user.role) || (user.role === 'employee')) {
        hashToUse = employeeHash;
        employeeCount++;
      } else if (user.role === 'student' || user.role === 'parent') {
        hashToUse = studentHash;
        studentCount++;
      } else {
        return null; // Skip admins or unknowns
      }

      return {
        updateOne: {
          filter: { _id: user._id },
          update: {
            $set: {
              password: hashToUse,
              hasLogin: true
            }
          }
        }
      };
    }).filter(op => op !== null);

    if (bulkOps.length > 0) {
      const result = await User.bulkWrite(bulkOps);
      return res.json({ success: true, message: `Updated ${result.modifiedCount} accounts. ${employeeCount} employees, ${studentCount} students/parents.` });
    } else {
      return res.json({ success: true, message: 'No valid users found.' });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
});

// @desc    Upload profile photo
// @route   POST /api/auth/upload-photo
// @access  Private
router.post('/upload-photo', protect, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file provided' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Upload to Cloudinary
    const result = await cloudinaryService.uploadFromMulter(req.file, {
      tenantId: user.tenantId.toString(),
      folder: 'avatars',
      subPath: user._id.toString(),
      transformation: {
        width: 400,
        height: 400,
        crop: 'fill',
        gravity: 'face',
        quality: 'auto:good'
      }
    });

    // Save to both fields for backward compatibility
    const photoUrl = result.secure_url;
    await User.findByIdAndUpdate(req.user.id, { avatar: photoUrl, photo: photoUrl });

    res.json({
      success: true,
      message: 'Profile photo updated successfully',
      avatar: photoUrl,
      photo: photoUrl
    });
  } catch (error) {
    console.error('Upload photo error:', error);
    res.status(500).json({ success: false, message: 'Failed to upload photo' });
  }
});

module.exports = router;

