const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { getTenantFromRequest, validateTenantAccess } = require('../middleware/tenant');
const { logger } = require('../middleware/errorHandler');
const csvImportService = require('../services/csvImportService');
const emailService = require('../services/emailService');

const router = express.Router();

// @desc    Register a new school/tenant
// @route   POST /api/tenants/register
// @access  Public
router.post('/register', [
  body('schoolName').notEmpty().withMessage('School name is required').trim().isLength({ min: 2, max: 100 }),
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('schoolCode').isLength({ min: 3, max: 20 }).withMessage('School code must be 3-20 characters').matches(/^[a-zA-Z0-9]+$/).withMessage('School code must contain only letters and numbers'),
  body('subdomain').isLength({ min: 3, max: 20 }).withMessage('Subdomain must be 3-20 characters').matches(/^[a-z0-9-]+$/).withMessage('Subdomain must contain only lowercase letters, numbers, and hyphens'),
  body('phone').optional().isMobilePhone().withMessage('Valid phone number required'),
  body('address').optional().isObject().withMessage('Address must be an object')
], async (req, res) => {
  // For development, skip transactions if MongoDB is not a replica set
  const useTransactions = process.env.NODE_ENV === 'production';
  const session = useTransactions ? await mongoose.startSession() : null;
  
  try {
    // Validation
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('Registration validation failed', null, {
        requestId: req.requestId,
        route: req.route?.path,
        errors: errors.array()
      });

      return res.status(400).json({
        success: false,
        errors: errors.array().map(err => ({
          field: err.path,
          message: err.msg
        })),
        requestId: req.requestId
      });
    }

    const { schoolName, email, password, schoolCode, subdomain, phone, address } = req.body;

    logger.info('Starting tenant registration', {
      requestId: req.requestId,
      route: req.route?.path,
      schoolName,
      email,
      schoolCode,
      subdomain
    });

    // Start transaction if using sessions
    if (session) {
      session.startTransaction();
    }

    // Check if school code, subdomain, or email already exists
    const existingTenant = await Tenant.findOne({
      $or: [
        { schoolCode: schoolCode.toLowerCase() },
        { subdomain: subdomain.toLowerCase() },
        { email: email.toLowerCase() }
      ]
    }, session ? { session } : {});

    if (existingTenant) {
      if (session) {
        await session.abortTransaction();
      }
      
      logger.warn('Tenant registration failed - duplicate data', null, {
        requestId: req.requestId,
        route: req.route?.path,
        existingTenant: {
          schoolCode: existingTenant.schoolCode,
          subdomain: existingTenant.subdomain,
          email: existingTenant.email
        }
      });

      return res.status(409).json({
        success: false,
        message: 'School with that name or email already exists.',
        requestId: req.requestId
      });
    }

    // Create tenant
    const tenantData = {
      schoolName: schoolName.trim(),
      email: email.toLowerCase(),
      schoolCode: schoolCode.toLowerCase(),
      subdomain: subdomain.toLowerCase(),
      phone: phone?.trim(),
      address: address || {},
      subscription: {
        plan: 'free',
        status: 'trial',
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14 days
      }
    };

    const tenant = session 
      ? await Tenant.create([tenantData], { session })
      : await Tenant.create(tenantData);

    const createdTenant = Array.isArray(tenant) ? tenant[0] : tenant;

    // Create admin user for the school
    const userData = {
      tenantId: createdTenant._id,
      name: `${schoolName.trim()} Admin`,
      email: email.toLowerCase(),
      password,
      role: 'admin',
      phone: phone?.trim()
    };

    const adminUser = session
      ? await User.create([userData], { session })
      : await User.create(userData);

    const createdAdminUser = Array.isArray(adminUser) ? adminUser[0] : adminUser;

    // Commit transaction if using sessions
    if (session) {
      await session.commitTransaction();
    }

    logger.info('Tenant registration successful', {
      requestId: req.requestId,
      route: req.route?.path,
      tenantId: createdTenant._id,
      userId: createdAdminUser._id,
      schoolName,
      email
    });

    // Generate JWT token
    const token = jwt.sign(
      {
        id: createdAdminUser._id,
        tenantId: createdTenant._id,
        role: createdAdminUser.role
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Send onboarding email (async, don't wait for it)
    emailService.sendOnboardingEmail(
      email.toLowerCase(),
      schoolName.trim(),
      `${schoolName.trim()} Admin`
    ).catch(error => {
      logger.error('Failed to send onboarding email', error, {
        requestId: req.requestId,
        tenantId: createdTenant._id,
        email
      });
    });

    res.status(201).json({
      success: true,
      message: 'School registered successfully',
      data: {
        tenant: {
          id: createdTenant._id,
          schoolName: createdTenant.schoolName,
          schoolCode: createdTenant.schoolCode,
          subdomain: createdTenant.subdomain,
          subscription: createdTenant.subscription
        },
        user: {
          id: createdAdminUser._id,
          name: createdAdminUser.name,
          email: createdAdminUser.email,
          role: createdAdminUser.role
        },
        token
      },
      requestId: req.requestId
    });

  } catch (error) {
    // Rollback transaction if using sessions
    if (session) {
      await session.abortTransaction();
    }
    
    logger.error('Tenant registration failed', error, {
      requestId: req.requestId,
      route: req.route?.path
    });

    // Let the global error handler deal with the error
    throw error;
  } finally {
    if (session) {
      session.endSession();
    }
  }
});

// @desc    Get tenant information
// @route   GET /api/tenants/info
// @access  Private (Tenant Admin)
router.get('/info', protect, getTenantFromRequest, validateTenantAccess, async(req, res) => {
  try {
    const tenant = await Tenant.findById(req.tenant._id)
      .select('-__v')
      .populate('subscription');

    res.json({
      success: true,
      data: tenant
    });
  } catch (error) {
    console.error('Get tenant info error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching tenant information'
    });
  }
});

// @desc    Update tenant information
// @route   PUT /api/tenants/info
// @access  Private (Tenant Admin)
router.put('/info', protect, getTenantFromRequest, validateTenantAccess, [
  body('schoolName').optional().notEmpty().withMessage('School name cannot be empty'),
  body('phone').optional().isMobilePhone().withMessage('Valid phone number required'),
  body('primaryColor').optional().isHexColor().withMessage('Valid hex color required'),
  body('secondaryColor').optional().isHexColor().withMessage('Valid hex color required')
], async(req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const allowedUpdates = [
      'schoolName', 'phone', 'address', 'logo',
      'primaryColor', 'secondaryColor', 'settings'
    ];

    const updates = {};
    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    const tenant = await Tenant.findByIdAndUpdate(
      req.tenant._id,
      updates,
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'School information updated successfully',
      data: tenant
    });
  } catch (error) {
    console.error('Update tenant info error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating tenant information'
    });
  }
});

// @desc    Get tenant subscription details
// @route   GET /api/tenants/subscription
// @access  Private (Tenant Admin)
router.get('/subscription', protect, getTenantFromRequest, validateTenantAccess, async(req, res) => {
  try {
    const tenant = await Tenant.findById(req.tenant._id)
      .select('subscription schoolName schoolCode');

    res.json({
      success: true,
      data: {
        subscription: tenant.subscription,
        schoolName: tenant.schoolName,
        schoolCode: tenant.schoolCode
      }
    });
  } catch (error) {
    console.error('Get subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching subscription details'
    });
  }
});

// @desc    Update subscription plan
// @route   PUT /api/tenants/subscription
// @access  Private (Tenant Admin)
router.put('/subscription', protect, getTenantFromRequest, validateTenantAccess, [
  body('plan').isIn(['free', 'basic', 'premium', 'enterprise']).withMessage('Invalid plan'),
  body('billingCycle').optional().isIn(['monthly', 'yearly']).withMessage('Invalid billing cycle')
], async(req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { plan, billingCycle } = req.body;

    // Define plan limits
    const planLimits = {
      free: { maxStudents: 100, maxTeachers: 10 },
      basic: { maxStudents: 500, maxTeachers: 25 },
      premium: { maxStudents: 2000, maxTeachers: 100 },
      enterprise: { maxStudents: 10000, maxTeachers: 500 }
    };

    const updates = {
      'subscription.plan': plan,
      'subscription.status': 'active',
      'subscription.maxStudents': planLimits[plan].maxStudents,
      'subscription.maxTeachers': planLimits[plan].maxTeachers
    };

    if (billingCycle) {
      updates['subscription.billingCycle'] = billingCycle;
    }

    const tenant = await Tenant.findByIdAndUpdate(
      req.tenant._id,
      updates,
      { new: true }
    );

    res.json({
      success: true,
      message: 'Subscription updated successfully',
      data: {
        subscription: tenant.subscription
      }
    });
  } catch (error) {
    console.error('Update subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating subscription'
    });
  }
});

// @desc    Check if school code/subdomain is available
// @route   GET /api/tenants/check-availability
// @access  Public
router.get('/check-availability', async(req, res) => {
  try {
    const { schoolCode, subdomain, email } = req.query;

    if (!schoolCode && !subdomain && !email) {
      return res.status(400).json({
        success: false,
        message: 'At least one parameter (schoolCode, subdomain, or email) is required'
      });
    }

    const query = {};
    if (schoolCode) query.schoolCode = schoolCode.toLowerCase();
    if (subdomain) query.subdomain = subdomain.toLowerCase();
    if (email) query.email = email.toLowerCase();

    const existing = await Tenant.findOne(query);

    res.json({
      success: true,
      data: {
        available: !existing,
        schoolCode: schoolCode ? !await Tenant.findOne({ schoolCode: schoolCode.toLowerCase() }) : null,
        subdomain: subdomain ? !await Tenant.findOne({ subdomain: subdomain.toLowerCase() }) : null,
        email: email ? !await Tenant.findOne({ email: email.toLowerCase() }) : null
      }
    });
  } catch (error) {
    console.error('Check availability error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while checking availability'
    });
  }
});

// @desc    Import CSV data (teachers or students)
// @route   POST /api/tenants/:id/import/csv
// @access  Private (Admin only)
router.post('/:id/import/csv', protect, getTenantFromRequest, validateTenantAccess, async(req, res) => {
  try {
    // Only admins can import data
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can import data',
        requestId: req.requestId
      });
    }

    const { type } = req.body; // 'teachers' or 'students'
    const csvData = req.body.data; // Array of CSV rows

    if (!type || !csvData || !Array.isArray(csvData)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request: type and data array are required',
        requestId: req.requestId
      });
    }

    if (!['teachers', 'students'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid type: must be "teachers" or "students"',
        requestId: req.requestId
      });
    }

    logger.info('Starting CSV import', {
      requestId: req.requestId,
      route: req.route?.path,
      tenantId: req.tenant._id,
      type,
      recordCount: csvData.length,
      adminEmail: req.user.email
    });

    let results;
    if (type === 'teachers') {
      results = await csvImportService.importTeachers(req.tenant._id, csvData, req.user.email);
    } else {
      results = await csvImportService.importStudents(req.tenant._id, csvData, req.user.email);
    }

    res.json({
      success: true,
      message: `CSV import completed: ${results.created} created, ${results.skipped} skipped`,
      data: {
        summary: {
          total: csvData.length,
          created: results.created,
          skipped: results.skipped,
          errors: results.errors.length
        },
        errors: results.errors,
        type
      },
      requestId: req.requestId
    });

  } catch (error) {
    logger.error('CSV import failed', error, {
      requestId: req.requestId,
      route: req.route?.path,
      tenantId: req.tenant?._id,
      userEmail: req.user?.email
    });

    throw error;
  }
});

// @desc    Get CSV import template
// @route   GET /api/tenants/:id/import/template
// @access  Private (Admin only)
router.get('/:id/import/template', protect, getTenantFromRequest, validateTenantAccess, async(req, res) => {
  try {
    // Only admins can access templates
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can access templates',
        requestId: req.requestId
      });
    }

    const { type } = req.query;

    if (!type || !['teachers', 'students'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid type: must be "teachers" or "students"',
        requestId: req.requestId
      });
    }

    const template = csvImportService.getTemplate(type);

    res.json({
      success: true,
      data: template,
      requestId: req.requestId
    });

  } catch (error) {
    logger.error('Failed to get import template', error, {
      requestId: req.requestId,
      route: req.route?.path,
      tenantId: req.tenant?._id,
      userEmail: req.user?.email
    });

    throw error;
  }
});

module.exports = router;
