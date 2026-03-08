const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const { logger } = require('../middleware/errorHandler');
const emailService = require('../services/emailService');

const router = express.Router();

// @desc    Register a new school/tenant (public route)
// @route   POST /api/schools/register
// @access  Public
router.post('/register', [
  body('schoolName').notEmpty().withMessage('School name is required').trim().isLength({ min: 2, max: 100 }),
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('schoolCode').isLength({ min: 3, max: 20 }).withMessage('School code must be 3-20 characters').matches(/^[a-zA-Z0-9]+$/).withMessage('School code must contain only letters and numbers'),
  body('subdomain').optional().isLength({ min: 3, max: 20 }).withMessage('Subdomain must be 3-20 characters').matches(/^[a-z0-9-]+$/).withMessage('Subdomain must contain only lowercase letters, numbers, and hyphens'),
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
      return res.status(400).json({
        success: false,
        errors: errors.array().map(err => ({
          field: err.path,
          message: err.msg
        }))
      });
    }

    const { schoolName, email, password, schoolCode, subdomain, phone, address } = req.body;

    // Auto-generate subdomain from schoolCode if not provided
    const finalSubdomain = subdomain ? subdomain.toLowerCase() : schoolCode.toLowerCase();

    // Check if school code, subdomain, or email already exists
    const existingTenant = await Tenant.findOne({
      $or: [
        { schoolCode: schoolCode.toLowerCase() },
        { subdomain: finalSubdomain },
        { email: email.toLowerCase() }
      ]
    });

    if (existingTenant) {
      return res.status(409).json({
        success: false,
        message: 'School with that code or email already exists. Please choose a different school code.'
      });
    }

    // Create tenant
    const tenantData = {
      schoolName: schoolName.trim(),
      email: email.toLowerCase(),
      schoolCode: schoolCode.toLowerCase(),
      subdomain: finalSubdomain, // Use generated or provided subdomain
      phone: phone?.trim(),
      address: address || {},
      subscription: {
        plan: 'free',
        status: 'trial',
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14 days
      }
    };

    const tenant = await Tenant.create(tenantData);

    // Create admin user for the school
    const adminUser = await User.create({
      tenantId: tenant._id,
      name: `${schoolName.trim()} Admin`,
      email: email.toLowerCase(),
      password,
      role: 'admin',
      phone: phone?.trim()
    });

    // Generate JWT token
    const token = jwt.sign(
      {
        id: adminUser._id,
        tenantId: tenant._id,
        role: adminUser.role
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
      logger.error('Failed to send onboarding email', error);
    });

    res.status(201).json({
      success: true,
      message: 'School registered successfully',
      data: {
        tenant: {
          id: tenant._id,
          schoolName: tenant.schoolName,
          schoolCode: tenant.schoolCode,
          subdomain: tenant.subdomain,
          subscription: tenant.subscription
        },
        user: {
          id: adminUser._id,
          name: adminUser.name,
          email: adminUser.email,
          role: adminUser.role
        },
        token
      }
    });

  } catch (error) {
    console.error('School registration error:', error);
    console.error('Error stack:', error.stack);
    logger.error('School registration failed', error);
    
    // Handle specific error types
    let statusCode = 500;
    let message = 'Server error during school registration';
    
    if (error.name === 'ValidationError') {
      statusCode = 400;
      message = 'Validation error';
    } else if (error.code === 11000) {
      // Duplicate key error (MongoDB)
      statusCode = 409;
      message = 'School with that code, subdomain, or email already exists';
    } else if (error.message) {
      message = error.message;
    }
    
    res.status(statusCode).json({
      success: false,
      message: message,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      details: process.env.NODE_ENV === 'development' ? {
        name: error.name,
        code: error.code,
        keyPattern: error.keyPattern,
        keyValue: error.keyValue
      } : undefined
    });
  } finally {
    if (session) {
      session.endSession();
    }
  }
});

module.exports = router;

