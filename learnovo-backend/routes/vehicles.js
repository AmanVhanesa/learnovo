const express = require('express');
const { body, query } = require('express-validator');
const Vehicle = require('../models/Vehicle');
const Driver = require('../models/Driver');
const Counter = require('../models/Counter');
const { protect, authorize } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');
const ImportExportService = require('../services/importExportService');

const router = express.Router();

// @desc    Get all vehicles
// @route   GET /api/vehicles
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

        // Add type filter
        if (req.query.type) {
            filter.vehicleType = req.query.type;
        }

        // Add assignment filter
        if (req.query.assigned === 'true') {
            filter.assignedDriver = { $ne: null };
        } else if (req.query.assigned === 'false') {
            filter.assignedDriver = null;
        }

        // Add search filter
        if (req.query.search) {
            filter.$or = [
                { vehicleNumber: { $regex: req.query.search, $options: 'i' } },
                { vehicleId: { $regex: req.query.search, $options: 'i' } },
                { model: { $regex: req.query.search, $options: 'i' } }
            ];
        }

        // Get vehicles with driver details
        const vehicles = await Vehicle.find(filter)
            .populate('assignedDriver', 'name phone licenseNumber')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        // Add expiry warnings
        vehicles.forEach(vehicle => {
            const vehicleDoc = new Vehicle(vehicle);
            vehicle.hasExpiringDocs = vehicleDoc.hasExpiringDocuments();
            vehicle.hasExpiredDocs = vehicleDoc.hasExpiredDocuments();
            vehicle.expiringDocs = vehicleDoc.getExpiringDocuments();
        });

        const total = await Vehicle.countDocuments(filter);

        res.json({
            success: true,
            data: vehicles,
            pagination: {
                current: page,
                pages: Math.ceil(total / limit),
                total
            }
        });
    } catch (error) {
        console.error('Get vehicles error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching vehicles'
        });
    }
});

// @desc    Get single vehicle
// @route   GET /api/vehicles/:id
// @access  Private (Admin)
router.get('/:id', protect, authorize('admin'), async (req, res) => {
    try {
        const vehicle = await Vehicle.findOne({
            _id: req.params.id,
            tenantId: req.user.tenantId
        }).populate('assignedDriver', 'name phone licenseNumber email');

        if (!vehicle) {
            return res.status(404).json({
                success: false,
                message: 'Vehicle not found'
            });
        }

        res.json({
            success: true,
            data: vehicle
        });
    } catch (error) {
        console.error('Get vehicle error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching vehicle'
        });
    }
});

// @desc    Create new vehicle
// @route   POST /api/vehicles
// @access  Private (Admin)
router.post('/', protect, authorize('admin'), [
    body('vehicleNumber').trim().notEmpty().withMessage('Vehicle number is required'),
    body('vehicleType').isIn(['Bus', 'Van', 'Car', 'Auto', 'Tempo', 'Other']).withMessage('Invalid vehicle type'),
    body('capacity').isInt({ min: 1 }).withMessage('Capacity must be at least 1'),
    body('insuranceExpiry').isISO8601().withMessage('Valid insurance expiry date is required'),
    body('fitnessExpiry').isISO8601().withMessage('Valid fitness expiry date is required'),
    body('pollutionExpiry').isISO8601().withMessage('Valid pollution expiry date is required'),
    handleValidationErrors
], async (req, res) => {
    try {
        const {
            vehicleNumber, vehicleType, model, manufacturingYear, color, capacity,
            fuelType, insuranceNumber, insuranceExpiry, fitnessExpiry, pollutionExpiry,
            assignedDriver, photo, documents, notes
        } = req.body;

        const tenantId = req.user.tenantId;

        // Check vehicle number uniqueness
        if (await Vehicle.findOne({ vehicleNumber: vehicleNumber.trim().toUpperCase(), tenantId })) {
            return res.status(400).json({
                success: false,
                message: 'Vehicle with this number already exists'
            });
        }

        // Validate driver if assigned
        if (assignedDriver) {
            const driver = await Driver.findOne({ _id: assignedDriver, tenantId, isActive: true });
            if (!driver) {
                return res.status(400).json({
                    success: false,
                    message: 'Assigned driver not found or inactive'
                });
            }
        }

        // Generate Vehicle ID
        const currentYear = new Date().getFullYear().toString();
        const sequence = await Counter.getNextSequence('vehicle', currentYear, tenantId);
        const vehicleId = `VEH-${currentYear}-${String(sequence).padStart(4, '0')}`;

        const vehicleData = {
            tenantId,
            vehicleId,
            vehicleNumber: vehicleNumber.trim().toUpperCase(),
            vehicleType,
            model,
            manufacturingYear,
            color,
            capacity,
            fuelType,
            insuranceNumber,
            insuranceExpiry,
            fitnessExpiry,
            pollutionExpiry,
            assignedDriver: assignedDriver || null,
            photo,
            documents,
            notes,
            isActive: true,
            createdBy: req.user._id
        };

        const vehicle = await Vehicle.create(vehicleData);

        res.status(201).json({
            success: true,
            message: 'Vehicle created successfully',
            data: vehicle
        });
    } catch (error) {
        console.error('Create vehicle error:', error);
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: 'Duplicate vehicle number'
            });
        }
        res.status(500).json({
            success: false,
            message: error.message || 'Server error'
        });
    }
});

// @desc    Update vehicle
// @route   PUT /api/vehicles/:id
// @access  Private (Admin)
router.put('/:id', protect, authorize('admin'), [
    body('vehicleNumber').optional().trim().notEmpty().withMessage('Vehicle number cannot be empty'),
    body('capacity').optional().isInt({ min: 1 }).withMessage('Capacity must be at least 1'),
    handleValidationErrors
], async (req, res) => {
    try {
        const vehicle = await Vehicle.findOne({
            _id: req.params.id,
            tenantId: req.user.tenantId
        });

        if (!vehicle) {
            return res.status(404).json({
                success: false,
                message: 'Vehicle not found'
            });
        }

        // Check vehicle number uniqueness if being updated
        if (req.body.vehicleNumber && req.body.vehicleNumber !== vehicle.vehicleNumber) {
            const existing = await Vehicle.findOne({
                vehicleNumber: req.body.vehicleNumber.trim().toUpperCase(),
                tenantId: req.user.tenantId,
                _id: { $ne: req.params.id }
            });
            if (existing) {
                return res.status(400).json({
                    success: false,
                    message: 'Vehicle number already exists'
                });
            }
        }

        // Validate driver if being assigned
        if (req.body.assignedDriver) {
            const driver = await Driver.findOne({
                _id: req.body.assignedDriver,
                tenantId: req.user.tenantId,
                isActive: true
            });
            if (!driver) {
                return res.status(400).json({
                    success: false,
                    message: 'Assigned driver not found or inactive'
                });
            }
        }

        // Update vehicle
        const updatePayload = { ...req.body, updatedBy: req.user._id };

        const updatedVehicle = await Vehicle.findByIdAndUpdate(
            req.params.id,
            updatePayload,
            { new: true, runValidators: true }
        ).populate('assignedDriver', 'name phone licenseNumber');

        res.json({
            success: true,
            message: 'Vehicle updated successfully',
            data: updatedVehicle
        });
    } catch (error) {
        console.error('Update vehicle error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Server error while updating vehicle'
        });
    }
});

// @desc    Assign/Reassign driver to vehicle
// @route   PUT /api/vehicles/:id/assign-driver
// @access  Private (Admin)
router.put('/:id/assign-driver', protect, authorize('admin'), [
    body('driverId').notEmpty().withMessage('Driver ID is required'),
    handleValidationErrors
], async (req, res) => {
    try {
        const { driverId } = req.body;

        const vehicle = await Vehicle.findOne({
            _id: req.params.id,
            tenantId: req.user.tenantId
        });

        if (!vehicle) {
            return res.status(404).json({
                success: false,
                message: 'Vehicle not found'
            });
        }

        // Validate driver
        const driver = await Driver.findOne({
            _id: driverId,
            tenantId: req.user.tenantId,
            isActive: true
        });

        if (!driver) {
            return res.status(400).json({
                success: false,
                message: 'Driver not found or inactive'
            });
        }

        vehicle.assignedDriver = driverId;
        vehicle.updatedBy = req.user._id;
        await vehicle.save();

        const updatedVehicle = await Vehicle.findById(vehicle._id)
            .populate('assignedDriver', 'name phone licenseNumber');

        res.json({
            success: true,
            message: 'Driver assigned successfully',
            data: updatedVehicle
        });
    } catch (error) {
        console.error('Assign driver error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while assigning driver'
        });
    }
});

// @desc    Delete vehicle (soft delete)
// @route   DELETE /api/vehicles/:id
// @access  Private (Admin)
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
    try {
        const vehicle = await Vehicle.findOne({
            _id: req.params.id,
            tenantId: req.user.tenantId
        });

        if (!vehicle) {
            return res.status(404).json({
                success: false,
                message: 'Vehicle not found'
            });
        }

        // Soft delete
        vehicle.isActive = false;
        vehicle.inactiveReason = req.body.reason || 'Deleted by admin';
        vehicle.inactivatedAt = new Date();
        vehicle.updatedBy = req.user._id;
        await vehicle.save();

        res.json({
            success: true,
            message: 'Vehicle deleted successfully'
        });
    } catch (error) {
        console.error('Delete vehicle error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while deleting vehicle'
        });
    }
});

// @desc    Export vehicles
// @route   GET /api/vehicles/export
// @access  Private (Admin)
router.get('/export', protect, authorize('admin'), async (req, res) => {
    try {
        const filter = { tenantId: req.user.tenantId };

        if (req.query.status) {
            filter.isActive = req.query.status === 'active';
        }
        if (req.query.type) {
            filter.vehicleType = req.query.type;
        }

        const vehicles = await Vehicle.find(filter)
            .populate('assignedDriver', 'name phone')
            .lean();

        const columns = [
            { key: 'vehicleId', header: 'Vehicle ID' },
            { key: 'vehicleNumber', header: 'Vehicle Number' },
            { key: 'vehicleType', header: 'Type' },
            { key: 'model', header: 'Model' },
            { key: 'capacity', header: 'Capacity' },
            { key: 'assignedDriver', header: 'Driver', format: (val) => val ? val.name : 'Not Assigned' },
            { key: 'insuranceExpiry', header: 'Insurance Expiry', format: (val) => val ? new Date(val).toISOString().split('T')[0] : '' },
            { key: 'fitnessExpiry', header: 'Fitness Expiry', format: (val) => val ? new Date(val).toISOString().split('T')[0] : '' },
            { key: 'pollutionExpiry', header: 'Pollution Expiry', format: (val) => val ? new Date(val).toISOString().split('T')[0] : '' },
            { key: 'isActive', header: 'Status', format: (val) => val ? 'Active' : 'Inactive' }
        ];

        const csvBuffer = await ImportExportService.exportToCSV(vehicles, columns);
        const filename = `vehicles_export_${new Date().toISOString().split('T')[0]}.csv`;

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
        res.send(csvBuffer);
    } catch (error) {
        console.error('Export vehicles error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while exporting vehicles'
        });
    }
});

module.exports = router;
