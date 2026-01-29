const express = require('express');
const { body, query } = require('express-validator');
const Driver = require('../models/Driver');
const Counter = require('../models/Counter');
const { protect, authorize } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');
const ImportExportService = require('../services/importExportService');

const router = express.Router();

// @desc    Get all drivers
// @route   GET /api/drivers
// @access  Private (Admin)
router.get('/', protect, authorize('admin'), [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('search').optional().trim().isLength({ min: 1, max: 100 }).withMessage('Search query must be between 1 and 100 characters'),
    handleValidationErrors
], async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const filter = { tenantId: req.user.tenantId };

        // Add status filter
        if (req.query.status) {
            filter.isActive = req.query.status === 'active';
        }

        // Add search filter
        if (req.query.search) {
            filter.$or = [
                { name: { $regex: req.query.search, $options: 'i' } },
                { phone: { $regex: req.query.search, $options: 'i' } },
                { driverId: { $regex: req.query.search, $options: 'i' } },
                { licenseNumber: { $regex: req.query.search, $options: 'i' } }
            ];
        }

        // Get drivers
        const drivers = await Driver.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        // Add expiry warnings
        drivers.forEach(driver => {
            const driverDoc = new Driver(driver);
            driver.licenseExpiringSoon = driverDoc.isLicenseExpiringSoon();
            driver.licenseExpired = driverDoc.isLicenseExpired();
        });

        const total = await Driver.countDocuments(filter);

        res.json({
            success: true,
            data: drivers,
            pagination: {
                current: page,
                pages: Math.ceil(total / limit),
                total
            }
        });
    } catch (error) {
        console.error('Get drivers error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching drivers'
        });
    }
});

// @desc    Get single driver
// @route   GET /api/drivers/:id
// @access  Private (Admin)
router.get('/:id', protect, authorize('admin'), async (req, res) => {
    try {
        const driver = await Driver.findOne({
            _id: req.params.id,
            tenantId: req.user.tenantId
        });

        if (!driver) {
            return res.status(404).json({
                success: false,
                message: 'Driver not found'
            });
        }

        res.json({
            success: true,
            data: driver
        });
    } catch (error) {
        console.error('Get driver error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching driver'
        });
    }
});

// @desc    Create new driver
// @route   POST /api/drivers
// @access  Private (Admin)
router.post('/', protect, authorize('admin'), [
    body('name').trim().notEmpty().withMessage('Driver name is required'),
    body('phone').trim().notEmpty().withMessage('Phone number is required'),
    body('licenseNumber').trim().notEmpty().withMessage('License number is required'),
    body('licenseExpiry').isISO8601().withMessage('Valid license expiry date is required'),
    body('email').optional().isEmail().withMessage('Valid email required'),
    handleValidationErrors
], async (req, res) => {
    try {
        const {
            name, phone, email, licenseNumber, licenseExpiry, licenseType,
            dateOfBirth, gender, bloodGroup, address, dateOfJoining, salary,
            experience, emergencyContact, photo, documents, notes
        } = req.body;

        const tenantId = req.user.tenantId;

        // Check phone uniqueness
        if (await Driver.findOne({ phone: phone.trim(), tenantId })) {
            return res.status(400).json({
                success: false,
                message: 'Driver with this phone number already exists'
            });
        }

        // Check license uniqueness
        if (await Driver.findOne({ licenseNumber: licenseNumber.trim().toUpperCase(), tenantId })) {
            return res.status(400).json({
                success: false,
                message: 'Driver with this license number already exists'
            });
        }

        // Check email uniqueness if provided
        if (email && await Driver.findOne({ email: email.toLowerCase().trim(), tenantId })) {
            return res.status(400).json({
                success: false,
                message: 'Driver with this email already exists'
            });
        }

        // Generate Driver ID
        const currentYear = new Date().getFullYear().toString();
        const sequence = await Counter.getNextSequence('driver', currentYear, tenantId);
        const driverId = `DRV-${currentYear}-${String(sequence).padStart(4, '0')}`;

        const driverData = {
            tenantId,
            driverId,
            name: name.trim(),
            phone: phone.trim(),
            email: email ? email.toLowerCase().trim() : undefined,
            licenseNumber: licenseNumber.trim().toUpperCase(),
            licenseExpiry,
            licenseType,
            dateOfBirth,
            gender,
            bloodGroup,
            address,
            dateOfJoining: dateOfJoining || new Date(),
            salary,
            experience,
            emergencyContact,
            photo,
            documents,
            notes,
            isActive: true,
            createdBy: req.user._id
        };

        const driver = await Driver.create(driverData);

        res.status(201).json({
            success: true,
            message: 'Driver created successfully',
            data: driver
        });
    } catch (error) {
        console.error('Create driver error:', error);
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: 'Duplicate entry detected (Phone, License, or Email)'
            });
        }
        res.status(500).json({
            success: false,
            message: error.message || 'Server error'
        });
    }
});

// @desc    Update driver
// @route   PUT /api/drivers/:id
// @access  Private (Admin)
router.put('/:id', protect, authorize('admin'), [
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
    body('phone').optional().trim().notEmpty().withMessage('Phone cannot be empty'),
    body('licenseNumber').optional().trim().notEmpty().withMessage('License number cannot be empty'),
    body('email').optional().isEmail().withMessage('Valid email required'),
    handleValidationErrors
], async (req, res) => {
    try {
        const driver = await Driver.findOne({
            _id: req.params.id,
            tenantId: req.user.tenantId
        });

        if (!driver) {
            return res.status(404).json({
                success: false,
                message: 'Driver not found'
            });
        }

        // Check phone uniqueness if being updated
        if (req.body.phone && req.body.phone !== driver.phone) {
            const existingPhone = await Driver.findOne({
                phone: req.body.phone.trim(),
                tenantId: req.user.tenantId,
                _id: { $ne: req.params.id }
            });
            if (existingPhone) {
                return res.status(400).json({
                    success: false,
                    message: 'Phone number already exists'
                });
            }
        }

        // Check license uniqueness if being updated
        if (req.body.licenseNumber && req.body.licenseNumber !== driver.licenseNumber) {
            const existingLicense = await Driver.findOne({
                licenseNumber: req.body.licenseNumber.trim().toUpperCase(),
                tenantId: req.user.tenantId,
                _id: { $ne: req.params.id }
            });
            if (existingLicense) {
                return res.status(400).json({
                    success: false,
                    message: 'License number already exists'
                });
            }
        }

        // Check email uniqueness if being updated
        if (req.body.email && req.body.email !== driver.email) {
            const existingEmail = await Driver.findOne({
                email: req.body.email.toLowerCase().trim(),
                tenantId: req.user.tenantId,
                _id: { $ne: req.params.id }
            });
            if (existingEmail) {
                return res.status(400).json({
                    success: false,
                    message: 'Email already exists'
                });
            }
        }

        // Update driver
        const updatePayload = { ...req.body, updatedBy: req.user._id };

        const updatedDriver = await Driver.findByIdAndUpdate(
            req.params.id,
            updatePayload,
            { new: true, runValidators: true }
        );

        res.json({
            success: true,
            message: 'Driver updated successfully',
            data: updatedDriver
        });
    } catch (error) {
        console.error('Update driver error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Server error while updating driver'
        });
    }
});

// @desc    Delete driver (soft delete)
// @route   DELETE /api/drivers/:id
// @access  Private (Admin)
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
    try {
        const driver = await Driver.findOne({
            _id: req.params.id,
            tenantId: req.user.tenantId
        });

        if (!driver) {
            return res.status(404).json({
                success: false,
                message: 'Driver not found'
            });
        }

        // Soft delete
        driver.isActive = false;
        driver.inactiveReason = req.body.reason || 'Deleted by admin';
        driver.inactivatedAt = new Date();
        driver.updatedBy = req.user._id;
        await driver.save();

        res.json({
            success: true,
            message: 'Driver deleted successfully'
        });
    } catch (error) {
        console.error('Delete driver error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while deleting driver'
        });
    }
});

// @desc    Toggle driver status
// @route   PUT /api/drivers/:id/toggle-status
// @access  Private (Admin)
router.put('/:id/toggle-status', protect, authorize('admin'), async (req, res) => {
    try {
        const { reason } = req.body;
        const driver = await Driver.findOne({
            _id: req.params.id,
            tenantId: req.user.tenantId
        });

        if (!driver) {
            return res.status(404).json({
                success: false,
                message: 'Driver not found'
            });
        }

        // Toggle status
        driver.isActive = !driver.isActive;

        if (!driver.isActive) {
            driver.inactiveReason = reason || 'No reason provided';
            driver.inactivatedAt = new Date();
        } else {
            driver.inactiveReason = null;
            driver.inactivatedAt = null;
        }

        driver.updatedBy = req.user._id;
        await driver.save();

        res.json({
            success: true,
            message: `Driver ${driver.isActive ? 'activated' : 'deactivated'} successfully`,
            data: driver
        });
    } catch (error) {
        console.error('Toggle status error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while toggling driver status'
        });
    }
});

// @desc    Get drivers with expiring licenses
// @route   GET /api/drivers/expiring/licenses
// @access  Private (Admin)
router.get('/expiring/licenses', protect, authorize('admin'), async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30;
        const checkDate = new Date();
        checkDate.setDate(checkDate.getDate() + days);

        const drivers = await Driver.find({
            tenantId: req.user.tenantId,
            isActive: true,
            licenseExpiry: {
                $gte: new Date(),
                $lte: checkDate
            }
        }).sort({ licenseExpiry: 1 });

        res.json({
            success: true,
            data: drivers,
            count: drivers.length
        });
    } catch (error) {
        console.error('Get expiring licenses error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching expiring licenses'
        });
    }
});

// @desc    Export drivers
// @route   GET /api/drivers/export
// @access  Private (Admin)
router.get('/export', protect, authorize('admin'), async (req, res) => {
    try {
        const filter = { tenantId: req.user.tenantId };

        if (req.query.status) {
            filter.isActive = req.query.status === 'active';
        }

        const drivers = await Driver.find(filter).lean();

        const columns = [
            { key: 'driverId', header: 'Driver ID' },
            { key: 'name', header: 'Name' },
            { key: 'phone', header: 'Phone' },
            { key: 'email', header: 'Email' },
            { key: 'licenseNumber', header: 'License Number' },
            { key: 'licenseType', header: 'License Type' },
            { key: 'licenseExpiry', header: 'License Expiry', format: (val) => val ? new Date(val).toISOString().split('T')[0] : '' },
            { key: 'dateOfJoining', header: 'Date of Joining', format: (val) => val ? new Date(val).toISOString().split('T')[0] : '' },
            { key: 'salary', header: 'Salary' },
            { key: 'isActive', header: 'Status', format: (val) => val ? 'Active' : 'Inactive' }
        ];

        const csvBuffer = await ImportExportService.exportToCSV(drivers, columns);
        const filename = `drivers_export_${new Date().toISOString().split('T')[0]}.csv`;

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
        res.send(csvBuffer);
    } catch (error) {
        console.error('Export drivers error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while exporting drivers'
        });
    }
});

module.exports = router;
