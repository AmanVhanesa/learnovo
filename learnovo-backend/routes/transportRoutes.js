const express = require('express');
const { body, query } = require('express-validator');
const Route = require('../models/Route');
const Vehicle = require('../models/Vehicle');
const Driver = require('../models/Driver');
const StudentTransportAssignment = require('../models/StudentTransportAssignment');
const Counter = require('../models/Counter');
const { protect, authorize } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');
const ImportExportService = require('../services/importExportService');

const router = express.Router();

// @desc    Get all routes
// @route   GET /api/transport/routes
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
                { routeName: { $regex: req.query.search, $options: 'i' } },
                { routeCode: { $regex: req.query.search, $options: 'i' } },
                { routeId: { $regex: req.query.search, $options: 'i' } }
            ];
        }

        // Get routes with vehicle and driver details
        const routes = await Route.find(filter)
            .populate('assignedVehicle', 'vehicleNumber vehicleType capacity')
            .populate('assignedDriver', 'name phone licenseNumber')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        // Get student count for each route
        for (let route of routes) {
            const studentCount = await StudentTransportAssignment.countDocuments({
                route: route._id,
                isActive: true,
                tenantId: req.user.tenantId
            });
            route.studentCount = studentCount;
        }

        const total = await Route.countDocuments(filter);

        res.json({
            success: true,
            data: routes,
            pagination: {
                current: page,
                pages: Math.ceil(total / limit),
                total
            }
        });
    } catch (error) {
        console.error('Get routes error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching routes'
        });
    }
});

// @desc    Get single route
// @route   GET /api/transport/routes/:id
// @access  Private (Admin)
router.get('/:id', protect, authorize('admin'), async (req, res) => {
    try {
        const route = await Route.findOne({
            _id: req.params.id,
            tenantId: req.user.tenantId
        })
            .populate('assignedVehicle', 'vehicleNumber vehicleType capacity model')
            .populate('assignedDriver', 'name phone licenseNumber email');

        if (!route) {
            return res.status(404).json({
                success: false,
                message: 'Route not found'
            });
        }

        res.json({
            success: true,
            data: route
        });
    } catch (error) {
        console.error('Get route error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching route'
        });
    }
});

// @desc    Create new route
// @route   POST /api/transport/routes
// @access  Private (Admin)
router.post('/', protect, authorize('admin'), [
    body('routeName').trim().notEmpty().withMessage('Route name is required'),
    body('stops').isArray({ min: 2 }).withMessage('At least 2 stops are required'),
    body('stops.*.stopName').trim().notEmpty().withMessage('Stop name is required'),
    body('stops.*.stopOrder').isInt({ min: 1 }).withMessage('Stop order must be a positive integer'),
    body('monthlyFee').isFloat({ min: 0 }).withMessage('Monthly fee must be >= 0'),
    handleValidationErrors
], async (req, res) => {
    try {
        const {
            routeName, routeCode, stops, assignedVehicle, assignedDriver,
            distance, estimatedDuration, monthlyFee, notes
        } = req.body;

        const tenantId = req.user.tenantId;

        // Check route name uniqueness
        if (await Route.findOne({ routeName: routeName.trim(), tenantId })) {
            return res.status(400).json({
                success: false,
                message: 'Route with this name already exists'
            });
        }

        // Check route code uniqueness if provided
        if (routeCode && await Route.findOne({ routeCode: routeCode.trim().toUpperCase(), tenantId })) {
            return res.status(400).json({
                success: false,
                message: 'Route with this code already exists'
            });
        }

        // Validate vehicle if assigned
        if (assignedVehicle) {
            const vehicle = await Vehicle.findOne({ _id: assignedVehicle, tenantId, isActive: true });
            if (!vehicle) {
                return res.status(400).json({
                    success: false,
                    message: 'Assigned vehicle not found or inactive'
                });
            }
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

        // Generate Route ID
        const currentYear = new Date().getFullYear().toString();
        const sequence = await Counter.getNextSequence('route', currentYear, tenantId);
        const routeId = `RT-${currentYear}-${String(sequence).padStart(4, '0')}`;

        const routeData = {
            tenantId,
            routeId,
            routeName: routeName.trim(),
            routeCode: routeCode ? routeCode.trim().toUpperCase() : undefined,
            stops,
            assignedVehicle: assignedVehicle || null,
            assignedDriver: assignedDriver || null,
            distance,
            estimatedDuration,
            monthlyFee,
            notes,
            isActive: true,
            createdBy: req.user._id
        };

        const route = await Route.create(routeData);

        res.status(201).json({
            success: true,
            message: 'Route created successfully',
            data: route
        });
    } catch (error) {
        console.error('Create route error:', error);
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: 'Duplicate route name or code'
            });
        }
        res.status(500).json({
            success: false,
            message: error.message || 'Server error'
        });
    }
});

// @desc    Update route
// @route   PUT /api/transport/routes/:id
// @access  Private (Admin)
router.put('/:id', protect, authorize('admin'), [
    body('routeName').optional().trim().notEmpty().withMessage('Route name cannot be empty'),
    body('stops').optional().isArray({ min: 2 }).withMessage('At least 2 stops are required'),
    handleValidationErrors
], async (req, res) => {
    try {
        const route = await Route.findOne({
            _id: req.params.id,
            tenantId: req.user.tenantId
        });

        if (!route) {
            return res.status(404).json({
                success: false,
                message: 'Route not found'
            });
        }

        // Check route name uniqueness if being updated
        if (req.body.routeName && req.body.routeName !== route.routeName) {
            const existing = await Route.findOne({
                routeName: req.body.routeName.trim(),
                tenantId: req.user.tenantId,
                _id: { $ne: req.params.id }
            });
            if (existing) {
                return res.status(400).json({
                    success: false,
                    message: 'Route name already exists'
                });
            }
        }

        // Validate vehicle if being assigned
        if (req.body.assignedVehicle) {
            const vehicle = await Vehicle.findOne({
                _id: req.body.assignedVehicle,
                tenantId: req.user.tenantId,
                isActive: true
            });
            if (!vehicle) {
                return res.status(400).json({
                    success: false,
                    message: 'Assigned vehicle not found or inactive'
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

        // Update route
        const updatePayload = { ...req.body, updatedBy: req.user._id };

        const updatedRoute = await Route.findByIdAndUpdate(
            req.params.id,
            updatePayload,
            { new: true, runValidators: true }
        )
            .populate('assignedVehicle', 'vehicleNumber vehicleType capacity')
            .populate('assignedDriver', 'name phone licenseNumber');

        res.json({
            success: true,
            message: 'Route updated successfully',
            data: updatedRoute
        });
    } catch (error) {
        console.error('Update route error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Server error while updating route'
        });
    }
});

// @desc    Assign vehicle to route
// @route   PUT /api/transport/routes/:id/assign-vehicle
// @access  Private (Admin)
router.put('/:id/assign-vehicle', protect, authorize('admin'), [
    body('vehicleId').notEmpty().withMessage('Vehicle ID is required'),
    handleValidationErrors
], async (req, res) => {
    try {
        const { vehicleId } = req.body;

        const route = await Route.findOne({
            _id: req.params.id,
            tenantId: req.user.tenantId
        });

        if (!route) {
            return res.status(404).json({
                success: false,
                message: 'Route not found'
            });
        }

        // Validate vehicle
        const vehicle = await Vehicle.findOne({
            _id: vehicleId,
            tenantId: req.user.tenantId,
            isActive: true
        });

        if (!vehicle) {
            return res.status(400).json({
                success: false,
                message: 'Vehicle not found or inactive'
            });
        }

        route.assignedVehicle = vehicleId;
        route.updatedBy = req.user._id;
        await route.save();

        const updatedRoute = await Route.findById(route._id)
            .populate('assignedVehicle', 'vehicleNumber vehicleType capacity')
            .populate('assignedDriver', 'name phone licenseNumber');

        res.json({
            success: true,
            message: 'Vehicle assigned successfully',
            data: updatedRoute
        });
    } catch (error) {
        console.error('Assign vehicle error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while assigning vehicle'
        });
    }
});

// @desc    Assign driver to route
// @route   PUT /api/transport/routes/:id/assign-driver
// @access  Private (Admin)
router.put('/:id/assign-driver', protect, authorize('admin'), [
    body('driverId').notEmpty().withMessage('Driver ID is required'),
    handleValidationErrors
], async (req, res) => {
    try {
        const { driverId } = req.body;

        const route = await Route.findOne({
            _id: req.params.id,
            tenantId: req.user.tenantId
        });

        if (!route) {
            return res.status(404).json({
                success: false,
                message: 'Route not found'
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

        route.assignedDriver = driverId;
        route.updatedBy = req.user._id;
        await route.save();

        const updatedRoute = await Route.findById(route._id)
            .populate('assignedVehicle', 'vehicleNumber vehicleType capacity')
            .populate('assignedDriver', 'name phone licenseNumber');

        res.json({
            success: true,
            message: 'Driver assigned successfully',
            data: updatedRoute
        });
    } catch (error) {
        console.error('Assign driver error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while assigning driver'
        });
    }
});

// @desc    Get students on a route
// @route   GET /api/transport/routes/:id/students
// @access  Private (Admin)
router.get('/:id/students', protect, authorize('admin'), async (req, res) => {
    try {
        const route = await Route.findOne({
            _id: req.params.id,
            tenantId: req.user.tenantId
        });

        if (!route) {
            return res.status(404).json({
                success: false,
                message: 'Route not found'
            });
        }

        const students = await StudentTransportAssignment.find({
            route: req.params.id,
            tenantId: req.user.tenantId,
            isActive: true
        })
            .populate('student', 'name class section phone email admissionNumber')
            .sort({ stop: 1 });

        res.json({
            success: true,
            data: students,
            count: students.length
        });
    } catch (error) {
        console.error('Get route students error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching route students'
        });
    }
});

// @desc    Delete route (soft delete)
// @route   DELETE /api/transport/routes/:id
// @access  Private (Admin)
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
    try {
        const route = await Route.findOne({
            _id: req.params.id,
            tenantId: req.user.tenantId
        });

        if (!route) {
            return res.status(404).json({
                success: false,
                message: 'Route not found'
            });
        }

        // Check if route has active student assignments
        const activeAssignments = await StudentTransportAssignment.countDocuments({
            route: req.params.id,
            isActive: true,
            tenantId: req.user.tenantId
        });

        if (activeAssignments > 0) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete route with ${activeAssignments} active student assignment(s). Please deactivate student assignments first.`
            });
        }

        // Soft delete
        route.isActive = false;
        route.inactiveReason = req.body.reason || 'Deleted by admin';
        route.inactivatedAt = new Date();
        route.updatedBy = req.user._id;
        await route.save();

        res.json({
            success: true,
            message: 'Route deleted successfully'
        });
    } catch (error) {
        console.error('Delete route error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while deleting route'
        });
    }
});

// @desc    Export routes
// @route   GET /api/transport/routes/export
// @access  Private (Admin)
router.get('/export', protect, authorize('admin'), async (req, res) => {
    try {
        const filter = { tenantId: req.user.tenantId };

        if (req.query.status) {
            filter.isActive = req.query.status === 'active';
        }

        const routes = await Route.find(filter)
            .populate('assignedVehicle', 'vehicleNumber')
            .populate('assignedDriver', 'name')
            .lean();

        const columns = [
            { key: 'routeId', header: 'Route ID' },
            { key: 'routeName', header: 'Route Name' },
            { key: 'routeCode', header: 'Route Code' },
            { key: 'stopsCount', header: 'Stops Count', format: (val, row) => row.stops ? row.stops.length : 0 },
            { key: 'assignedVehicle', header: 'Vehicle', format: (val) => val ? val.vehicleNumber : 'Not Assigned' },
            { key: 'assignedDriver', header: 'Driver', format: (val) => val ? val.name : 'Not Assigned' },
            { key: 'distance', header: 'Distance (km)' },
            { key: 'monthlyFee', header: 'Monthly Fee' },
            { key: 'isActive', header: 'Status', format: (val) => val ? 'Active' : 'Inactive' }
        ];

        const csvBuffer = await ImportExportService.exportToCSV(routes, columns);
        const filename = `routes_export_${new Date().toISOString().split('T')[0]}.csv`;

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
        res.send(csvBuffer);
    } catch (error) {
        console.error('Export routes error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while exporting routes'
        });
    }
});

module.exports = router;
