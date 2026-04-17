const express = require('express');
const { body } = require('express-validator');
const Settings = require('../models/Settings');
const { protect, authorize } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');
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

router.put('/', protect, authorize('admin'), async(req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'User tenant not found. Please login again.'
      });
    }

    // Ensure settings document exists
    await Settings.getSettings(tenantId);

    // Build a flat $set object from the request body
    const setObj = {};
    const allowedSections = ['institution', 'currency', 'academic', 'fees', 'notifications', 'system', 'theme', 'backup', 'grading', 'bankAccounts', 'rulesAndRegulations', 'account'];

    for (const section of allowedSections) {
      if (!req.body[section]) continue;

      const flatten = (obj, prefix) => {
        for (const [key, value] of Object.entries(obj)) {
          if (key === '_id' || key === '__v') continue; // skip Mongoose metadata
          const path = `${prefix}.${key}`;
          if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
            flatten(value, path);
          } else {
            setObj[path] = value;
          }
        }
      };

      flatten(req.body[section], section);
    }

    if (Object.keys(setObj).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid settings fields to update'
      });
    }

    const updatedSettings = await Settings.findOneAndUpdate(
      { tenantId },
      { $set: setObj },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Settings updated successfully',
      data: updatedSettings
    });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error while updating settings'
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

// @desc    Get/Update co-scholastic areas for report cards
// @route   GET /api/settings/co-scholastic
// @access  Private (Admin)
router.get('/co-scholastic', protect, authorize('admin'), async(req, res) => {
  try {
    const tenantId = getTenantId(req);
    const settings = await Settings.getSettings(tenantId);
    res.json({ success: true, data: settings.academic?.coScholasticAreas || [] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
});

// @route   PUT /api/settings/co-scholastic
router.put('/co-scholastic', protect, authorize('admin'), async(req, res) => {
  try {
    const tenantId = getTenantId(req);
    const settings = await Settings.getSettings(tenantId);
    const { areas } = req.body;

    if (!Array.isArray(areas)) {
      return res.status(400).json({ success: false, message: 'areas must be an array' });
    }

    settings.academic.coScholasticAreas = areas.filter(a => a.area?.trim()).map(a => ({
      area: a.area.trim(),
      isActive: a.isActive !== false
    }));

    await settings.save();
    res.json({ success: true, message: 'Co-scholastic areas updated', data: settings.academic.coScholasticAreas });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
});

// @desc    Upload institution logo
// @route   POST /api/settings/upload-logo
// @access  Private (Admin)
const upload = require('../middleware/upload');
const cloudinaryService = require('../services/cloudinaryService');

router.post('/upload-logo', protect, authorize('admin'), upload.single('logo'), async(req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No logo file uploaded' });
    }

    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'User tenant not found.' });
    }

    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      return res.status(500).json({ success: false, message: 'File upload service not configured.' });
    }

    const result = await cloudinaryService.uploadSchoolLogo(req.file, tenantId.toString());

    await Settings.findOneAndUpdate(
      { tenantId },
      { $set: { 'institution.logo': result.secure_url } }
    );

    res.json({
      success: true,
      message: 'Logo uploaded successfully',
      data: { url: result.secure_url }
    });
  } catch (error) {
    console.error('Upload logo error:', error);
    res.status(500).json({ success: false, message: error.message || 'Error uploading logo' });
  }
});

// @desc    Upload principal signature
// @route   POST /api/settings/upload-signature
// @access  Private (Admin)
router.post('/upload-signature', protect, authorize('admin'), upload.single('signature'), async(req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No signature file uploaded' });
    }

    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'User tenant not found.' });
    }

    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      return res.status(500).json({ success: false, message: 'File upload service not configured.' });
    }

    const result = await cloudinaryService.uploadFromMulter(req.file, {
      tenantId: tenantId.toString(),
      folder: 'school',
      subPath: 'signatures',
      transformation: {
        width: 900,
        height: 700,
        crop: 'fit',
        quality: 'auto:best'
      }
    });

    await Settings.findOneAndUpdate(
      { tenantId },
      { $set: { 'institution.principalSignature': result.secure_url } }
    );

    res.json({
      success: true,
      message: 'Signature uploaded successfully',
      data: { url: result.secure_url }
    });
  } catch (error) {
    console.error('Upload signature error:', error);
    res.status(500).json({ success: false, message: error.message || 'Error uploading signature' });
  }
});

// ── Payment Gateway Configuration ─────────────────────────────────
const Tenant = require('../models/Tenant');
const { clearCache } = require('../services/payment/GatewayFactory');
const { encrypt } = require('../utils/encryption');

/**
 * @desc    Get payment gateway config for this tenant
 * @route   GET /api/settings/payment-gateway
 * @access  Private (Admin only)
 */
router.get('/payment-gateway', protect, authorize('admin'), async(req, res) => {
  try {
    const tenant = await Tenant.findById(req.user.tenantId).select('paymentGateway');
    if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found' });

    // Mask sensitive keys for security (only show last 4 chars)
    const config = tenant.paymentGateway?.toObject?.() || tenant.paymentGateway || {};
    const maskField = (val) => val && val.length > 4 ? `****${val.slice(-4)}` : '****';
    if (config.iciciOrange?.apiKey) config.iciciOrange.apiKey = maskField(config.iciciOrange.apiKey);
    if (config.iciciOrange?.apiSecret) config.iciciOrange.apiSecret = maskField(config.iciciOrange.apiSecret);
    if (config.razorpay?.keySecret) config.razorpay.keySecret = maskField(config.razorpay.keySecret);
    if (config.razorpay?.webhookSecret) config.razorpay.webhookSecret = maskField(config.razorpay.webhookSecret);

    res.json({ success: true, data: config });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @desc    Update payment gateway config for this tenant
 * @route   PUT /api/settings/payment-gateway
 * @access  Private (Admin only)
 *
 * Body: {
 *   provider: 'icici_orange' | 'razorpay' | 'mock' | 'none',
 *   iciciOrange: { merchantId, terminalId, apiKey, apiSecret },
 *   razorpay: { keyId, keySecret, webhookSecret },
 *   isActive: true/false
 * }
 */
router.put('/payment-gateway', protect, authorize('admin'), [
  body('provider').isIn(['none', 'mock', 'icici_orange', 'razorpay']).withMessage('Invalid provider'),
  body('isActive').optional().isBoolean()
], handleValidationErrors, async(req, res) => {
  try {
    const { provider, iciciOrange, isActive } = req.body;
    const update = { 'paymentGateway.provider': provider };

    if (typeof isActive === 'boolean') {
      update['paymentGateway.isActive'] = isActive;
    }

    if (provider === 'icici_orange' && iciciOrange) {
      if (iciciOrange.merchantId) update['paymentGateway.iciciOrange.merchantId'] = encrypt(iciciOrange.merchantId);
      if (iciciOrange.terminalId) update['paymentGateway.iciciOrange.terminalId'] = encrypt(iciciOrange.terminalId);
      if (iciciOrange.apiKey && !iciciOrange.apiKey.startsWith('****')) {
        update['paymentGateway.iciciOrange.apiKey'] = encrypt(iciciOrange.apiKey);
      }
      if (iciciOrange.apiSecret && !iciciOrange.apiSecret.startsWith('****')) {
        update['paymentGateway.iciciOrange.apiSecret'] = encrypt(iciciOrange.apiSecret);
      }
    }

    if (provider === 'razorpay' && req.body.razorpay) {
      const rz = req.body.razorpay;
      if (rz.keyId) update['paymentGateway.razorpay.keyId'] = encrypt(rz.keyId);
      if (rz.keySecret && !rz.keySecret.startsWith('****')) {
        update['paymentGateway.razorpay.keySecret'] = encrypt(rz.keySecret);
      }
      if (rz.webhookSecret && !rz.webhookSecret.startsWith('****')) {
        update['paymentGateway.razorpay.webhookSecret'] = encrypt(rz.webhookSecret);
      }
    }

    const tenant = await Tenant.findByIdAndUpdate(
      req.user.tenantId,
      { $set: update },
      { new: true, runValidators: true }
    ).select('paymentGateway');

    if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found' });

    // Clear the cached gateway instance so it picks up the new config
    clearCache(req.user.tenantId);

    res.json({
      success: true,
      message: 'Payment gateway configuration updated',
      data: { provider: tenant.paymentGateway.provider, isActive: tenant.paymentGateway.isActive }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
