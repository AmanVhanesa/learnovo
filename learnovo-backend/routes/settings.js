const express = require('express');
const { body } = require('express-validator');
const Settings = require('../models/Settings');
const { protect, authorize } = require('../middleware/auth');
const { handleValidationErrors, validateSettings } = require('../middleware/validation');
const { getSupportedCurrencies } = require('../utils/currency');

const router = express.Router();

// Helper function to get tenant ID from request
const getTenantId = (req) => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) {
    throw new Error('User tenant not found. Please login again.');
  }
  return tenantId;
};

// @desc    Get system settings
// @route   GET /api/settings
// @access  Private
router.get('/', protect, async(req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'User tenant not found. Please login again.'
      });
    }
    
    const settings = await Settings.getSettings(tenantId);

    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching settings'
    });
  }
});

// @desc    Update system settings
// @route   PUT /api/settings
// @access  Private (Admin)
router.put('/', protect, authorize('admin'), validateSettings, async(req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'User tenant not found. Please login again.'
      });
    }
    
    const settings = await Settings.getSettings(tenantId);

    // Update settings
    Object.keys(req.body).forEach(key => {
      if (settings[key] !== undefined) {
        settings[key] = { ...settings[key], ...req.body[key] };
      }
    });

    await settings.save();

    res.json({
      success: true,
      message: 'Settings updated successfully',
      data: settings
    });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating settings'
    });
  }
});

// @desc    Update currency settings
// @route   PUT /api/settings/currency
// @access  Private (Admin)
router.put('/currency', protect, authorize('admin'), [
  body('currency').isLength({ min: 3, max: 3 }).isUppercase().withMessage('Currency must be a 3-letter uppercase code'),
  body('symbol').trim().isLength({ min: 1, max: 5 }).withMessage('Currency symbol must be between 1 and 5 characters'),
  body('position').isIn(['before', 'after']).withMessage('Currency position must be before or after'),
  handleValidationErrors
], async(req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'User tenant not found. Please login again.'
      });
    }
    
    const { currency, symbol, position } = req.body;

    const settings = await Settings.getSettings(tenantId);
    await settings.updateCurrency(currency, symbol, position);

    res.json({
      success: true,
      message: 'Currency settings updated successfully',
      data: {
        currency: settings.currency
      }
    });
  } catch (error) {
    console.error('Update currency error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating currency settings'
    });
  }
});

// @desc    Get supported currencies
// @route   GET /api/settings/currencies
// @access  Public
router.get('/currencies', (req, res) => {
  try {
    const currencies = getSupportedCurrencies();

    res.json({
      success: true,
      data: currencies
    });
  } catch (error) {
    console.error('Get currencies error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching currencies'
    });
  }
});

// @desc    Add new class
// @route   POST /api/settings/classes
// @access  Private (Admin)
router.post('/classes', protect, authorize('admin'), [
  body('name').trim().isLength({ min: 2, max: 20 }).withMessage('Class name must be between 2 and 20 characters'),
  body('level').isInt({ min: 1, max: 20 }).withMessage('Class level must be between 1 and 20'),
  body('maxStudents').optional().isInt({ min: 1, max: 100 }).withMessage('Max students must be between 1 and 100'),
  handleValidationErrors
], async(req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { name, level, maxStudents = 40 } = req.body;

    const settings = await Settings.getSettings(tenantId);
    await settings.addClass(name, level, maxStudents);

    res.json({
      success: true,
      message: 'Class added successfully',
      data: settings.academic.classes
    });
  } catch (error) {
    console.error('Add class error:', error);
    const statusCode = error.message.includes('tenant not found') ? 400 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Server error while adding class'
    });
  }
});

// @desc    Add new subject
// @route   POST /api/settings/subjects
// @access  Private (Admin)
router.post('/subjects', protect, authorize('admin'), [
  body('name').trim().isLength({ min: 2, max: 50 }).withMessage('Subject name must be between 2 and 50 characters'),
  body('code').trim().isLength({ min: 2, max: 10 }).withMessage('Subject code must be between 2 and 10 characters'),
  handleValidationErrors
], async(req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { name, code } = req.body;

    const settings = await Settings.getSettings(tenantId);
    await settings.addSubject(name, code);

    res.json({
      success: true,
      message: 'Subject added successfully',
      data: settings.academic.subjects
    });
  } catch (error) {
    console.error('Add subject error:', error);
    const statusCode = error.message.includes('tenant not found') ? 400 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Server error while adding subject'
    });
  }
});

// @desc    Add fee structure
// @route   POST /api/settings/fee-structure
// @access  Private (Admin)
router.post('/fee-structure', protect, authorize('admin'), [
  body('class').trim().notEmpty().withMessage('Class is required'),
  body('feeType').isIn(['tuition', 'transport', 'library', 'sports', 'exam', 'other']).withMessage('Invalid fee type'),
  body('amount').isNumeric().isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
  body('term').isIn(['1st_term', '2nd_term', '3rd_term', 'annual']).withMessage('Invalid term'),
  handleValidationErrors
], async(req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { class: className, feeType, amount, term } = req.body;

    const settings = await Settings.getSettings(tenantId);
    await settings.addFeeStructure(className, feeType, amount, term);

    res.json({
      success: true,
      message: 'Fee structure added successfully',
      data: settings.fees.feeStructure
    });
  } catch (error) {
    console.error('Add fee structure error:', error);
    const statusCode = error.message.includes('tenant not found') ? 400 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Server error while adding fee structure'
    });
  }
});

// @desc    Update notification settings
// @route   PUT /api/settings/notifications
// @access  Private (Admin)
router.put('/notifications', protect, authorize('admin'), [
  body('email.enabled').optional().isBoolean().withMessage('Email enabled must be boolean'),
  body('email.reminderDays').optional().isArray().withMessage('Reminder days must be an array'),
  body('sms.enabled').optional().isBoolean().withMessage('SMS enabled must be boolean'),
  handleValidationErrors
], async(req, res) => {
  try {
    const tenantId = getTenantId(req);
    const settings = await Settings.getSettings(tenantId);

    if (req.body.email) {
      settings.notifications.email = { ...settings.notifications.email, ...req.body.email };
    }

    if (req.body.sms) {
      settings.notifications.sms = { ...settings.notifications.sms, ...req.body.sms };
    }

    if (req.body.dashboard) {
      settings.notifications.dashboard = { ...settings.notifications.dashboard, ...req.body.dashboard };
    }

    await settings.save();

    res.json({
      success: true,
      message: 'Notification settings updated successfully',
      data: settings.notifications
    });
  } catch (error) {
    console.error('Update notification settings error:', error);
    const statusCode = error.message.includes('tenant not found') ? 400 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Server error while updating notification settings'
    });
  }
});

// @desc    Update system settings
// @route   PUT /api/settings/system
// @access  Private (Admin)
router.put('/system', protect, authorize('admin'), [
  body('maintenanceMode').optional().isBoolean().withMessage('Maintenance mode must be boolean'),
  body('maxFileSize').optional().isInt({ min: 1048576 }).withMessage('Max file size must be at least 1MB'),
  body('sessionTimeout').optional().isInt({ min: 300 }).withMessage('Session timeout must be at least 5 minutes'),
  handleValidationErrors
], async(req, res) => {
  try {
    const tenantId = getTenantId(req);
    const settings = await Settings.getSettings(tenantId);

    if (req.body.maintenanceMode !== undefined) {
      settings.system.maintenanceMode = req.body.maintenanceMode;
    }

    if (req.body.maintenanceMessage) {
      settings.system.maintenanceMessage = req.body.maintenanceMessage;
    }

    if (req.body.maxFileSize) {
      settings.system.maxFileSize = req.body.maxFileSize;
    }

    if (req.body.sessionTimeout) {
      settings.system.sessionTimeout = req.body.sessionTimeout;
    }

    if (req.body.passwordPolicy) {
      settings.system.passwordPolicy = { ...settings.system.passwordPolicy, ...req.body.passwordPolicy };
    }

    await settings.save();

    res.json({
      success: true,
      message: 'System settings updated successfully',
      data: settings.system
    });
  } catch (error) {
    console.error('Update system settings error:', error);
    const statusCode = error.message.includes('tenant not found') ? 400 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Server error while updating system settings'
    });
  }
});

// @desc    Update theme settings
// @route   PUT /api/settings/theme
// @access  Private (Admin)
router.put('/theme', protect, authorize('admin'), [
  body('primaryColor').optional().isHexColor().withMessage('Primary color must be a valid hex color'),
  body('secondaryColor').optional().isHexColor().withMessage('Secondary color must be a valid hex color'),
  handleValidationErrors
], async(req, res) => {
  try {
    const tenantId = getTenantId(req);
    const settings = await Settings.getSettings(tenantId);

    if (req.body.primaryColor) {
      settings.theme.primaryColor = req.body.primaryColor;
    }

    if (req.body.secondaryColor) {
      settings.theme.secondaryColor = req.body.secondaryColor;
    }

    if (req.body.logo) {
      settings.theme.logo = req.body.logo;
    }

    if (req.body.favicon) {
      settings.theme.favicon = req.body.favicon;
    }

    await settings.save();

    res.json({
      success: true,
      message: 'Theme settings updated successfully',
      data: settings.theme
    });
  } catch (error) {
    console.error('Update theme settings error:', error);
    const statusCode = error.message.includes('tenant not found') ? 400 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Server error while updating theme settings'
    });
  }
});

module.exports = router;
