const express = require('express');
const { body, query, param } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');
const announcementService = require('../services/announcementService');

const router = express.Router();

// @desc    Get all announcements
// @route   GET /api/announcements
// @access  Private
router.get('/', protect, [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
    query('includeExpired').optional().isBoolean().withMessage('includeExpired must be a boolean'),
    handleValidationErrors
], async (req, res) => {
    try {
        const { page, limit, isActive, includeExpired } = req.query;

        const result = await announcementService.getAnnouncements(
            req.user.tenantId,
            {
                page,
                limit,
                isActive: isActive !== undefined ? isActive === 'true' : null,
                includeExpired: includeExpired === 'true'
            }
        );

        res.json({
            success: true,
            data: result.announcements,
            pagination: result.pagination
        });
    } catch (error) {
        console.error('Get announcements error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching announcements'
        });
    }
});

// @desc    Get single announcement
// @route   GET /api/announcements/:id
// @access  Private
router.get('/:id', protect, [
    param('id').isMongoId().withMessage('Invalid announcement ID'),
    handleValidationErrors
], async (req, res) => {
    try {
        const announcement = await announcementService.getAnnouncement(
            req.params.id,
            req.user.tenantId
        );

        res.json({
            success: true,
            data: announcement
        });
    } catch (error) {
        console.error('Get announcement error:', error);
        if (error.message === 'Announcement not found') {
            return res.status(404).json({
                success: false,
                message: error.message
            });
        }
        res.status(500).json({
            success: false,
            message: 'Server error while fetching announcement'
        });
    }
});

// @desc    Create announcement
// @route   POST /api/announcements
// @access  Private (Admin only)
router.post('/', protect, authorize('admin'), [
    body('title').trim().isLength({ min: 3, max: 200 }).withMessage('Title must be between 3 and 200 characters'),
    body('message').trim().isLength({ min: 10, max: 2000 }).withMessage('Message must be between 10 and 2000 characters'),
    body('targetAudience').isArray({ min: 1 }).withMessage('Target audience must be a non-empty array'),
    body('targetAudience.*').isIn(['student', 'teacher', 'parent', 'admin', 'all']).withMessage('Invalid target audience'),
    body('targetClasses').optional().isArray().withMessage('Target classes must be an array'),
    body('targetClasses.*').optional().isMongoId().withMessage('Invalid class ID'),
    body('priority').optional().isIn(['low', 'medium', 'high']).withMessage('Invalid priority'),
    body('expiresAt').optional().isISO8601().withMessage('Invalid expiration date'),
    handleValidationErrors
], async (req, res) => {
    try {
        const {
            title,
            message,
            targetAudience,
            targetClasses,
            priority,
            expiresAt
        } = req.body;

        const announcement = await announcementService.createAnnouncement({
            tenantId: req.user.tenantId,
            createdBy: req.user._id,
            title,
            message,
            targetAudience,
            targetClasses: targetClasses || [],
            priority: priority || 'medium',
            expiresAt: expiresAt ? new Date(expiresAt) : null
        });

        res.status(201).json({
            success: true,
            message: `Announcement created and sent to ${announcement.notificationsSent} users`,
            data: announcement
        });
    } catch (error) {
        console.error('Create announcement error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while creating announcement'
        });
    }
});

// @desc    Update announcement
// @route   PUT /api/announcements/:id
// @access  Private (Admin only)
router.put('/:id', protect, authorize('admin'), [
    param('id').isMongoId().withMessage('Invalid announcement ID'),
    body('title').optional().trim().isLength({ min: 3, max: 200 }).withMessage('Title must be between 3 and 200 characters'),
    body('message').optional().trim().isLength({ min: 10, max: 2000 }).withMessage('Message must be between 10 and 2000 characters'),
    body('priority').optional().isIn(['low', 'medium', 'high']).withMessage('Invalid priority'),
    body('expiresAt').optional().isISO8601().withMessage('Invalid expiration date'),
    body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
    handleValidationErrors
], async (req, res) => {
    try {
        const updates = {};
        if (req.body.title) updates.title = req.body.title;
        if (req.body.message) updates.message = req.body.message;
        if (req.body.priority) updates.priority = req.body.priority;
        if (req.body.expiresAt !== undefined) updates.expiresAt = req.body.expiresAt ? new Date(req.body.expiresAt) : null;
        if (req.body.isActive !== undefined) updates.isActive = req.body.isActive;

        const announcement = await announcementService.updateAnnouncement(
            req.params.id,
            req.user.tenantId,
            updates
        );

        res.json({
            success: true,
            message: 'Announcement updated successfully',
            data: announcement
        });
    } catch (error) {
        console.error('Update announcement error:', error);
        if (error.message === 'Announcement not found') {
            return res.status(404).json({
                success: false,
                message: error.message
            });
        }
        res.status(500).json({
            success: false,
            message: 'Server error while updating announcement'
        });
    }
});

// @desc    Delete announcement
// @route   DELETE /api/announcements/:id
// @access  Private (Admin only)
router.delete('/:id', protect, authorize('admin'), [
    param('id').isMongoId().withMessage('Invalid announcement ID'),
    handleValidationErrors
], async (req, res) => {
    try {
        await announcementService.deleteAnnouncement(
            req.params.id,
            req.user.tenantId
        );

        res.json({
            success: true,
            message: 'Announcement deleted successfully'
        });
    } catch (error) {
        console.error('Delete announcement error:', error);
        if (error.message === 'Announcement not found') {
            return res.status(404).json({
                success: false,
                message: error.message
            });
        }
        res.status(500).json({
            success: false,
            message: 'Server error while deleting announcement'
        });
    }
});

module.exports = router;
