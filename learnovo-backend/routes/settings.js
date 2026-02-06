const express = require('express');
const { body } = require('express-validator');
const Settings = require('../models/Settings');
const Tenant = require('../models/Tenant'); // Import Tenant model for sync
const upload = require('../middleware/upload');
const { protect, authorize } = require('../middleware/auth');
const User = require('../models/User'); // Required for locking check
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
router.get('/', protect, async (req, res) => {
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
router.put('/', protect, authorize('admin'), async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'User tenant not found. Please login again.'
      });
    }

    const settings = await Settings.getSettings(tenantId);

    // Filter out protected fields that shouldn't be updated
    const protectedFields = ['_id', 'tenantId', '__v', 'createdAt', 'updatedAt'];
    const updateData = Object.keys(req.body)
      .filter(key => !protectedFields.includes(key))
      .reduce((obj, key) => {
        obj[key] = req.body[key];
        return obj;
      }, {});

    // Update settings - handle nested objects properly
    Object.keys(updateData).forEach(key => {
      if (settings[key] !== undefined) {
        if (typeof updateData[key] === 'object' && !Array.isArray(updateData[key]) && updateData[key] !== null) {
          // Merge nested objects
          settings[key] = { ...settings[key], ...updateData[key] };
        } else {
          // Direct assignment for primitives and arrays
          settings[key] = updateData[key];
        }
      }
    });

    await settings.save();

    // Sync Institution details to Tenant model
    if (updateData.institution) {
      const tenantUpdate = {};
      const inst = settings.institution; // Use updated settings which has merged data

      if (inst.name) tenantUpdate.schoolName = inst.name;
      if (inst.contact?.email) tenantUpdate.email = inst.contact.email;
      if (inst.contact?.phone) tenantUpdate.phone = inst.contact.phone;
      if (inst.logo) tenantUpdate.logo = inst.logo;

      if (inst.address) {
        tenantUpdate.address = {
          street: inst.address.street,
          city: inst.address.city,
          state: inst.address.state,
          country: inst.address.country,
          zipCode: inst.address.pincode // Remap pincode to zipCode
        };
      }

      await Tenant.findByIdAndUpdate(tenantId, { $set: tenantUpdate });
    }

    res.json({
      success: true,
      message: 'Settings updated successfully',
      data: settings
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
], async (req, res) => {
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
], async (req, res) => {
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
], async (req, res) => {
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
], async (req, res) => {
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
], async (req, res) => {
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
], async (req, res) => {
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

const cloudinaryService = require('../services/cloudinaryService');

// @desc    Upload school logo
// @route   POST /api/settings/upload-logo
// @access  Private (Admin)
router.post('/upload-logo', protect, authorize('admin'), upload.single('logo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const tenantId = req.user.tenantId;

    // Upload to Cloudinary
    const result = await cloudinaryService.uploadSchoolLogo(req.file, tenantId.toString());

    // Update settings with Cloudinary URL
    const settings = await Settings.getSettings(tenantId);
    settings.institution.logo = result.secure_url;
    settings.institution.logoPublicId = result.public_id; // Store for deletion later
    await settings.save();

    res.json({
      success: true,
      message: 'Logo uploaded successfully',
      data: {
        url: result.secure_url,
        public_id: result.public_id
      }
    });
  } catch (error) {
    console.error('Upload logo error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error while uploading logo'
    });
  }
});

// @desc    Upload principal signature
// @route   POST /api/settings/upload-signature
// @access  Private (Admin)
router.post('/upload-signature', protect, authorize('admin'), upload.single('signature'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const tenantId = req.user.tenantId;

    // Check if Cloudinary is configured
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      console.error('Cloudinary not configured. Please set CLOUDINARY_* environment variables.');
      return res.status(500).json({
        success: false,
        message: 'File upload service not configured. Please contact administrator.'
      });
    }

    // Upload to Cloudinary
    const result = await cloudinaryService.uploadSchoolLogo(req.file, tenantId.toString());

    // Update settings with Cloudinary URL
    const settings = await Settings.getSettings(tenantId);
    settings.institution.principalSignature = result.secure_url;
    settings.institution.signaturePublicId = result.public_id;
    await settings.save();

    res.json({
      success: true,
      message: 'Signature uploaded successfully',
      data: {
        url: result.secure_url,
        public_id: result.public_id
      }
    });
  } catch (error) {
    console.error('Upload signature error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error while uploading signature'
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
], async (req, res) => {
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

// @desc    Update admission settings
// @route   PUT /api/settings/admission
// @access  Private (Admin)
router.put('/admission', protect, authorize('admin'), [
  body('mode').optional().isIn(['AUTO', 'CUSTOM']).withMessage('Invalid mode'),
  body('prefix').optional().trim().isUppercase().matches(/^[A-Z0-9]+$/).withMessage('Prefix must be alphanumeric uppercase').isLength({ min: 2, max: 10 }).withMessage('Prefix must be 2-10 characters'),
  body('counterPadding').optional().isInt({ min: 3, max: 6 }).withMessage('Padding must be between 3 and 6'),
  handleValidationErrors
], async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const settings = await Settings.getSettings(tenantId);

    // Check if students exist (Locking Logic)
    const studentCount = await User.countDocuments({ tenantId, role: 'student' });
    const isLocked = studentCount > 0;

    // Reject locked fields if students exist
    if (isLocked) {
      if (req.body.mode && req.body.mode !== settings.admission.mode) {
        return res.status(400).json({ success: false, message: 'Cannot change Admission Mode because students already exist.' });
      }
      if (req.body.prefix && req.body.prefix !== settings.admission.prefix) {
        return res.status(400).json({ success: false, message: 'Cannot change Admission Prefix because students already exist.' });
      }
    }

    // Global Uniqueness Check for Prefix (only if changing)
    if (req.body.prefix && req.body.prefix !== settings.admission.prefix) {
      // Check if any OTHER settings doc has this prefix
      const duplicatePrefix = await Settings.findOne({
        'admission.prefix': req.body.prefix,
        tenantId: { $ne: tenantId }
      });

      if (duplicatePrefix) {
        return res.status(400).json({ success: false, message: 'This admission prefix is already in use by another school.' });
      }
    }

    // Update fields
    if (req.body.mode) settings.admission.mode = req.body.mode;
    if (req.body.prefix) settings.admission.prefix = req.body.prefix;
    if (req.body.yearFormat) settings.admission.yearFormat = req.body.yearFormat;
    if (req.body.counterPadding) settings.admission.counterPadding = req.body.counterPadding;
    if (req.body.startFrom) settings.admission.startFrom = req.body.startFrom;
    if (req.body.resetEachYear !== undefined) settings.admission.resetEachYear = req.body.resetEachYear;

    await settings.save();

    res.json({
      success: true,
      message: 'Admission settings updated successfully',
      data: settings.admission,
      isLocked
    });

  } catch (error) {
    console.error('Update admission settings error:', error);
    res.status(500).json({ success: false, message: 'Server error while updating admission settings' });
  }
});

// @desc    Update grading rules
// @route   PUT /api/settings/grading
// @access  Private (Admin)
router.put('/grading', protect, authorize('admin'), async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const settings = await Settings.getSettings(tenantId);
    const { rules } = req.body;

    // Validate grading rules
    if (rules && Array.isArray(rules)) {
      // Check for overlaps and full coverage
      const sortedRules = rules.sort((a, b) => a.percentageFrom - b.percentageFrom);

      for (let i = 0; i < sortedRules.length; i++) {
        const rule = sortedRules[i];

        // Validate range
        if (rule.percentageFrom >= rule.percentageTo) {
          return res.status(400).json({
            success: false,
            message: `Invalid range for grade ${rule.gradeName}: From must be less than To`
          });
        }

        // Check for overlaps with next rule
        if (i < sortedRules.length - 1) {
          const nextRule = sortedRules[i + 1];
          if (rule.percentageTo > nextRule.percentageFrom) {
            return res.status(400).json({
              success: false,
              message: `Overlapping ranges between ${rule.gradeName} and ${nextRule.gradeName}`
            });
          }
        }
      }

      settings.grading.rules = rules.map((rule, index) => ({
        ...rule,
        order: index
      }));
    }

    if (req.body.isActive !== undefined) {
      settings.grading.isActive = req.body.isActive;
    }

    await settings.save();

    res.json({
      success: true,
      message: 'Grading rules updated successfully',
      data: settings.grading
    });
  } catch (error) {
    console.error('Update grading error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
});

// @desc    Add bank account
// @route   POST /api/settings/bank-accounts
// @access  Private (Admin)
router.post('/bank-accounts', protect, authorize('admin'), [
  body('bankName').trim().notEmpty().withMessage('Bank name is required'),
  body('accountNumber').trim().notEmpty().withMessage('Account number is required'),
  handleValidationErrors
], async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const settings = await Settings.getSettings(tenantId);

    const { bankName, accountNumber, branch, address, instructions, isDefault } = req.body;

    // If this is set as default, unset others
    if (isDefault) {
      settings.bankAccounts.forEach(acc => acc.isDefault = false);
    }

    settings.bankAccounts.push({
      bankName,
      accountNumber,
      branch,
      address,
      instructions,
      isDefault: isDefault || false,
      isActive: true
    });

    await settings.save();

    res.json({
      success: true,
      message: 'Bank account added successfully',
      data: settings.bankAccounts
    });
  } catch (error) {
    console.error('Add bank account error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
});

// @desc    Update bank account
// @route   PUT /api/settings/bank-accounts/:id
// @access  Private (Admin)
router.put('/bank-accounts/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const settings = await Settings.getSettings(tenantId);
    const accountId = req.params.id;

    const account = settings.bankAccounts.id(accountId);
    if (!account) {
      return res.status(404).json({ success: false, message: 'Bank account not found' });
    }

    // If setting as default, unset others
    if (req.body.isDefault) {
      settings.bankAccounts.forEach(acc => {
        if (acc._id.toString() !== accountId) {
          acc.isDefault = false;
        }
      });
    }

    Object.keys(req.body).forEach(key => {
      if (account[key] !== undefined) {
        account[key] = req.body[key];
      }
    });

    await settings.save();

    res.json({
      success: true,
      message: 'Bank account updated successfully',
      data: settings.bankAccounts
    });
  } catch (error) {
    console.error('Update bank account error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
});

// @desc    Delete bank account
// @route   DELETE /api/settings/bank-accounts/:id
// @access  Private (Admin)
router.delete('/bank-accounts/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const settings = await Settings.getSettings(tenantId);
    const accountId = req.params.id;

    const account = settings.bankAccounts.id(accountId);
    if (!account) {
      return res.status(404).json({ success: false, message: 'Bank account not found' });
    }

    account.remove();
    await settings.save();

    res.json({
      success: true,
      message: 'Bank account deleted successfully',
      data: settings.bankAccounts
    });
  } catch (error) {
    console.error('Delete bank account error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
});

// @desc    Update rules and regulations
// @route   PUT /api/settings/rules
// @access  Private (Admin)
router.put('/rules', protect, authorize('admin'), async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const settings = await Settings.getSettings(tenantId);
    const { content } = req.body;

    if (content !== undefined) {
      settings.rulesAndRegulations.content = content;
      settings.rulesAndRegulations.version += 1;
      settings.rulesAndRegulations.lastUpdatedBy = req.user._id;
      settings.rulesAndRegulations.lastUpdatedAt = new Date();
    }

    await settings.save();

    res.json({
      success: true,
      message: 'Rules and regulations updated successfully',
      data: settings.rulesAndRegulations
    });
  } catch (error) {
    console.error('Update rules error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
});

// @desc    Update account settings
// @route   PUT /api/settings/account
// @access  Private (Admin)
router.put('/account', protect, authorize('admin'), async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const settings = await Settings.getSettings(tenantId);

    if (req.body.timezone) {
      settings.account.timezone = req.body.timezone;
    }

    if (req.body.dateFormat) {
      settings.account.dateFormat = req.body.dateFormat;
    }

    if (req.body.timeFormat) {
      settings.account.timeFormat = req.body.timeFormat;
    }

    await settings.save();

    res.json({
      success: true,
      message: 'Account settings updated successfully',
      data: settings.account
    });
  } catch (error) {
    console.error('Update account settings error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
});

module.exports = router;
