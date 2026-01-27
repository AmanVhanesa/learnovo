const express = require('express');
const { body, query } = require('express-validator');
const AcademicSession = require('../models/AcademicSession');
const { protect, authorize } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');

const router = express.Router();

// @desc    Get all academic sessions
// @route   GET /api/academic-sessions
// @access  Private (Admin)
router.get('/', protect, authorize('admin'), async (req, res) => {
    try {
        const sessions = await AcademicSession.find({ tenantId: req.user.tenantId })
            .sort({ startDate: -1 })
            .populate('createdBy', 'name email');

        res.json({
            success: true,
            data: sessions
        });
    } catch (error) {
        console.error('Get sessions error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching academic sessions'
        });
    }
});

// @desc    Get active academic session
// @route   GET /api/academic-sessions/active
// @access  Private (Admin, Teacher)
router.get('/active', protect, async (req, res) => {
    try {
        const session = await AcademicSession.findOne({
            tenantId: req.user.tenantId,
            isActive: true
        });

        if (!session) {
            return res.status(404).json({
                success: false,
                message: 'No active academic session found'
            });
        }

        res.json({
            success: true,
            data: session
        });
    } catch (error) {
        console.error('Get active session error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching active session'
        });
    }
});

// @desc    Get single academic session
// @route   GET /api/academic-sessions/:id
// @access  Private (Admin)
router.get('/:id', protect, authorize('admin'), async (req, res) => {
    try {
        const session = await AcademicSession.findById(req.params.id)
            .populate('createdBy', 'name email');

        if (!session || session.tenantId.toString() !== req.user.tenantId.toString()) {
            return res.status(404).json({
                success: false,
                message: 'Academic session not found'
            });
        }

        res.json({
            success: true,
            data: session
        });
    } catch (error) {
        console.error('Get session error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching session'
        });
    }
});

// @desc    Create academic session
// @route   POST /api/academic-sessions
// @access  Private (Admin)
router.post('/', protect, authorize('admin'), [
    body('name').trim().notEmpty().withMessage('Session name is required'),
    body('startDate').isISO8601().withMessage('Valid start date is required'),
    body('endDate').isISO8601().withMessage('Valid end date is required'),
    handleValidationErrors
], async (req, res) => {
    try {
        const { name, startDate, endDate, description, isActive } = req.body;

        // Check if session name already exists
        const existing = await AcademicSession.findOne({
            tenantId: req.user.tenantId,
            name: name.trim()
        });

        if (existing) {
            return res.status(400).json({
                success: false,
                message: 'Academic session with this name already exists'
            });
        }

        const session = await AcademicSession.create({
            tenantId: req.user.tenantId,
            name: name.trim(),
            startDate,
            endDate,
            description,
            isActive: isActive || false,
            createdBy: req.user._id
        });

        res.status(201).json({
            success: true,
            message: 'Academic session created successfully',
            data: session
        });
    } catch (error) {
        console.error('Create session error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Server error while creating session'
        });
    }
});

// @desc    Update academic session
// @route   PUT /api/academic-sessions/:id
// @access  Private (Admin)
router.put('/:id', protect, authorize('admin'), [
    body('name').optional().trim().notEmpty().withMessage('Session name cannot be empty'),
    body('startDate').optional().isISO8601().withMessage('Valid start date is required'),
    body('endDate').optional().isISO8601().withMessage('Valid end date is required'),
    handleValidationErrors
], async (req, res) => {
    try {
        const session = await AcademicSession.findById(req.params.id);

        if (!session || session.tenantId.toString() !== req.user.tenantId.toString()) {
            return res.status(404).json({
                success: false,
                message: 'Academic session not found'
            });
        }

        // Check if session is locked
        if (session.isLocked) {
            return res.status(403).json({
                success: false,
                message: 'Cannot modify locked academic session'
            });
        }

        // Check name uniqueness if being updated
        if (req.body.name && req.body.name !== session.name) {
            const existing = await AcademicSession.findOne({
                tenantId: req.user.tenantId,
                name: req.body.name.trim(),
                _id: { $ne: req.params.id }
            });

            if (existing) {
                return res.status(400).json({
                    success: false,
                    message: 'Academic session with this name already exists'
                });
            }
        }

        // Update fields
        const allowedUpdates = ['name', 'startDate', 'endDate', 'description'];
        allowedUpdates.forEach(field => {
            if (req.body[field] !== undefined) {
                session[field] = req.body[field];
            }
        });

        await session.save();

        res.json({
            success: true,
            message: 'Academic session updated successfully',
            data: session
        });
    } catch (error) {
        console.error('Update session error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Server error while updating session'
        });
    }
});

// @desc    Activate academic session
// @route   PUT /api/academic-sessions/:id/activate
// @access  Private (Admin)
router.put('/:id/activate', protect, authorize('admin'), async (req, res) => {
    try {
        const session = await AcademicSession.findById(req.params.id);

        if (!session || session.tenantId.toString() !== req.user.tenantId.toString()) {
            return res.status(404).json({
                success: false,
                message: 'Academic session not found'
            });
        }

        await session.activate();

        res.json({
            success: true,
            message: 'Academic session activated successfully',
            data: session
        });
    } catch (error) {
        console.error('Activate session error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Server error while activating session'
        });
    }
});

// @desc    Lock/Unlock academic session
// @route   PUT /api/academic-sessions/:id/lock
// @access  Private (Admin)
router.put('/:id/lock', protect, authorize('admin'), async (req, res) => {
    try {
        const { lock } = req.body;
        const session = await AcademicSession.findById(req.params.id);

        if (!session || session.tenantId.toString() !== req.user.tenantId.toString()) {
            return res.status(404).json({
                success: false,
                message: 'Academic session not found'
            });
        }

        if (lock) {
            await session.lock();
        } else {
            await session.unlock();
        }

        res.json({
            success: true,
            message: `Academic session ${lock ? 'locked' : 'unlocked'} successfully`,
            data: session
        });
    } catch (error) {
        console.error('Lock session error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while locking/unlocking session'
        });
    }
});

// @desc    Delete academic session
// @route   DELETE /api/academic-sessions/:id
// @access  Private (Admin)
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
    try {
        const session = await AcademicSession.findById(req.params.id);

        if (!session || session.tenantId.toString() !== req.user.tenantId.toString()) {
            return res.status(404).json({
                success: false,
                message: 'Academic session not found'
            });
        }

        // Check if session is active
        if (session.isActive) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete active academic session. Please deactivate it first.'
            });
        }

        // Check if session is locked
        if (session.isLocked) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete locked academic session'
            });
        }

        // TODO: Check for dependencies (students, classes, exams, etc.)
        // For now, we'll allow deletion

        await session.deleteOne();

        res.json({
            success: true,
            message: 'Academic session deleted successfully'
        });
    } catch (error) {
        console.error('Delete session error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while deleting session'
        });
    }
});

module.exports = router;
