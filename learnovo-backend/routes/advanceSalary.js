const express = require('express');
const { body, query } = require('express-validator');
const AdvanceSalary = require('../models/AdvanceSalary');
const { protect, authorize } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');

const router = express.Router();

// @desc    Get all advance salary requests
// @route   GET /api/advance-salary
// @access  Private (Admin)
router.get('/', protect, authorize('admin'), [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('status').optional().isIn(['pending', 'approved', 'rejected']).withMessage('Invalid status'),
    query('deductionStatus').optional().isIn(['pending', 'partial', 'deducted']).withMessage('Invalid deduction status'),
    handleValidationErrors
], async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        // Build filter
        const filter = { tenantId: req.user.tenantId };
        if (req.query.status) filter.status = req.query.status;
        if (req.query.deductionStatus) filter.deductionStatus = req.query.deductionStatus;
        if (req.query.employeeId) filter.employeeId = req.query.employeeId;

        // Get advance requests
        const advances = await AdvanceSalary.find(filter)
            .populate('employeeId', 'name employeeId email phone designation')
            .populate('approvedBy', 'name email')
            .populate('rejectedBy', 'name email')
            .populate('createdBy', 'name email')
            .sort({ requestDate: -1 })
            .skip(skip)
            .limit(limit);

        const total = await AdvanceSalary.countDocuments(filter);

        res.json({
            success: true,
            data: advances,
            pagination: {
                current: page,
                pages: Math.ceil(total / limit),
                total
            }
        });

    } catch (error) {
        console.error('Get advance salary requests error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching advance salary requests'
        });
    }
});

// @desc    Get single advance salary request
// @route   GET /api/advance-salary/:id
// @access  Private (Admin)
router.get('/:id', protect, authorize('admin'), async (req, res) => {
    try {
        const advance = await AdvanceSalary.findById(req.params.id)
            .populate('employeeId', 'name employeeId email phone designation salary')
            .populate('approvedBy', 'name email')
            .populate('rejectedBy', 'name email')
            .populate('createdBy', 'name email')
            .populate('deductions.payrollId', 'month year netSalary');

        if (!advance || advance.tenantId.toString() !== req.user.tenantId.toString()) {
            return res.status(404).json({
                success: false,
                message: 'Advance salary request not found'
            });
        }

        res.json({
            success: true,
            data: advance
        });

    } catch (error) {
        console.error('Get advance salary request error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching advance salary request'
        });
    }
});

// @desc    Create advance salary request
// @route   POST /api/advance-salary
// @access  Private (Admin)
router.post('/', protect, authorize('admin'), [
    body('employeeId').notEmpty().withMessage('Employee ID is required'),
    body('amount').isFloat({ min: 0 }).withMessage('Amount must be >= 0'),
    body('reason').trim().notEmpty().withMessage('Reason is required'),
    handleValidationErrors
], async (req, res) => {
    try {
        const { employeeId, amount, reason, notes } = req.body;

        const advanceData = {
            tenantId: req.user.tenantId,
            employeeId,
            amount,
            reason,
            notes,
            createdBy: req.user._id,
            requestDate: new Date()
        };

        const advance = await AdvanceSalary.create(advanceData);

        // Populate for response
        await advance.populate('employeeId', 'name employeeId email');

        res.status(201).json({
            success: true,
            message: 'Advance salary request created successfully',
            data: advance
        });

    } catch (error) {
        console.error('Create advance salary request error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Server error while creating advance salary request'
        });
    }
});

// @desc    Approve advance salary request
// @route   PUT /api/advance-salary/:id/approve
// @access  Private (Admin)
router.put('/:id/approve', protect, authorize('admin'), async (req, res) => {
    try {
        const advance = await AdvanceSalary.findById(req.params.id);

        if (!advance || advance.tenantId.toString() !== req.user.tenantId.toString()) {
            return res.status(404).json({
                success: false,
                message: 'Advance salary request not found'
            });
        }

        if (advance.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: `Cannot approve request with status: ${advance.status}`
            });
        }

        advance.status = 'approved';
        advance.approvedBy = req.user._id;
        advance.approvedAt = new Date();
        await advance.save();

        await advance.populate('employeeId', 'name employeeId email');
        await advance.populate('approvedBy', 'name email');

        res.json({
            success: true,
            message: 'Advance salary request approved successfully',
            data: advance
        });

    } catch (error) {
        console.error('Approve advance salary request error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while approving advance salary request'
        });
    }
});

// @desc    Reject advance salary request
// @route   PUT /api/advance-salary/:id/reject
// @access  Private (Admin)
router.put('/:id/reject', protect, authorize('admin'), [
    body('rejectionReason').optional().trim().notEmpty().withMessage('Rejection reason cannot be empty'),
    handleValidationErrors
], async (req, res) => {
    try {
        const { rejectionReason } = req.body;
        const advance = await AdvanceSalary.findById(req.params.id);

        if (!advance || advance.tenantId.toString() !== req.user.tenantId.toString()) {
            return res.status(404).json({
                success: false,
                message: 'Advance salary request not found'
            });
        }

        if (advance.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: `Cannot reject request with status: ${advance.status}`
            });
        }

        advance.status = 'rejected';
        advance.rejectedBy = req.user._id;
        advance.rejectedAt = new Date();
        advance.rejectionReason = rejectionReason || 'No reason provided';
        await advance.save();

        await advance.populate('employeeId', 'name employeeId email');
        await advance.populate('rejectedBy', 'name email');

        res.json({
            success: true,
            message: 'Advance salary request rejected',
            data: advance
        });

    } catch (error) {
        console.error('Reject advance salary request error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while rejecting advance salary request'
        });
    }
});

// @desc    Get employee advance salary history
// @route   GET /api/advance-salary/employee/:employeeId
// @access  Private (Admin)
router.get('/employee/:employeeId', protect, authorize('admin'), async (req, res) => {
    try {
        const advances = await AdvanceSalary.find({
            tenantId: req.user.tenantId,
            employeeId: req.params.employeeId
        })
            .populate('approvedBy', 'name email')
            .populate('rejectedBy', 'name email')
            .sort({ requestDate: -1 });

        res.json({
            success: true,
            data: advances
        });

    } catch (error) {
        console.error('Get employee advance history error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching advance history'
        });
    }
});

// @desc    Get advance salary statistics
// @route   GET /api/advance-salary/stats
// @access  Private (Admin)
router.get('/stats/summary', protect, authorize('admin'), async (req, res) => {
    try {
        const tenantId = req.user.tenantId;

        const [pending, approved, rejected, totalPending, totalApproved] = await Promise.all([
            AdvanceSalary.countDocuments({ tenantId, status: 'pending' }),
            AdvanceSalary.countDocuments({ tenantId, status: 'approved' }),
            AdvanceSalary.countDocuments({ tenantId, status: 'rejected' }),
            AdvanceSalary.aggregate([
                { $match: { tenantId, status: 'approved', deductionStatus: { $in: ['pending', 'partial'] } } },
                { $group: { _id: null, total: { $sum: '$remainingAmount' } } }
            ]),
            AdvanceSalary.aggregate([
                { $match: { tenantId, status: 'approved' } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ])
        ]);

        res.json({
            success: true,
            data: {
                pendingRequests: pending,
                approvedRequests: approved,
                rejectedRequests: rejected,
                totalPendingAmount: totalPending[0]?.total || 0,
                totalApprovedAmount: totalApproved[0]?.total || 0
            }
        });

    } catch (error) {
        console.error('Get advance salary stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching statistics'
        });
    }
});

module.exports = router;
