const express = require('express');
const { body, query, param } = require('express-validator');
const { protect } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');
const notificationService = require('../services/notificationService');
const NotificationPreference = require('../models/NotificationPreference');

const router = express.Router();

// ============================================================================
// GET NOTIFICATIONS
// ============================================================================

// @desc    Get user's notifications with filtering and pagination
// @route   GET /api/notifications
// @access  Private
router.get('/', protect, [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('isRead').optional().isIn(['true', 'false', 'all']).withMessage('isRead must be true, false, or all'),
  query('category').optional().isIn(['admission', 'fee', 'academic', 'attendance', 'employee', 'exam', 'system']).withMessage('Invalid category'),
  query('startDate').optional().isISO8601().withMessage('Invalid start date'),
  query('endDate').optional().isISO8601().withMessage('Invalid end date'),
  handleValidationErrors
], async (req, res) => {
  try {
    // Validate user is authenticated
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    // Validate tenantId exists
    if (!req.user.tenantId) {
      return res.status(400).json({
        success: false,
        message: 'User does not have a tenant association'
      });
    }

    const { page, limit, isRead, category, startDate, endDate } = req.query;

    const result = await notificationService.getNotifications(
      req.user._id,
      req.user.tenantId,
      { page, limit, isRead, category, startDate, endDate }
    );

    res.json({
      success: true,
      data: result.notifications,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching notifications',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @desc    Get unread notification count
// @route   GET /api/notifications/unread-count
// @access  Private
router.get('/unread-count', protect, async (req, res) => {
  try {
    const count = await notificationService.getUnreadCount(
      req.user._id,
      req.user.tenantId
    );

    res.json({
      success: true,
      data: { count }
    });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching unread count'
    });
  }
});

// @desc    Get single notification
// @route   GET /api/notifications/:id
// @access  Private
router.get('/:id', protect, [
  param('id').isMongoId().withMessage('Invalid notification ID'),
  handleValidationErrors
], async (req, res) => {
  try {
    const Notification = require('../models/Notification');
    const notification = await Notification.findOne({
      _id: req.params.id,
      userId: req.user._id,
      tenantId: req.user.tenantId,
      isDeleted: false
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.json({
      success: true,
      data: notification
    });
  } catch (error) {
    console.error('Get notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching notification'
    });
  }
});

// ============================================================================
// UPDATE NOTIFICATIONS
// ============================================================================

// @desc    Mark notification as read
// @route   PATCH /api/notifications/:id/read
// @access  Private
router.patch('/:id/read', protect, [
  param('id').isMongoId().withMessage('Invalid notification ID'),
  handleValidationErrors
], async (req, res) => {
  try {
    const notification = await notificationService.markAsRead(
      req.params.id,
      req.user._id,
      req.user.tenantId
    );

    res.json({
      success: true,
      data: notification,
      message: 'Notification marked as read'
    });
  } catch (error) {
    console.error('Mark as read error:', error);
    if (error.message === 'Notification not found') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error while marking notification as read'
    });
  }
});

// @desc    Mark notification as unread
// @route   PATCH /api/notifications/:id/unread
// @access  Private
router.patch('/:id/unread', protect, [
  param('id').isMongoId().withMessage('Invalid notification ID'),
  handleValidationErrors
], async (req, res) => {
  try {
    const Notification = require('../models/Notification');
    const notification = await Notification.findOne({
      _id: req.params.id,
      userId: req.user._id,
      tenantId: req.user.tenantId,
      isDeleted: false
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    await notification.markAsUnread();

    res.json({
      success: true,
      data: notification,
      message: 'Notification marked as unread'
    });
  } catch (error) {
    console.error('Mark as unread error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while marking notification as unread'
    });
  }
});

// @desc    Mark all notifications as read
// @route   PATCH /api/notifications/mark-all-read
// @access  Private
router.patch('/mark-all-read', protect, async (req, res) => {
  try {
    const result = await notificationService.markAllAsRead(
      req.user._id,
      req.user.tenantId
    );

    res.json({
      success: true,
      data: { modifiedCount: result.modifiedCount },
      message: 'All notifications marked as read'
    });
  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while marking all notifications as read'
    });
  }
});

// ============================================================================
// DELETE NOTIFICATIONS
// ============================================================================

// @desc    Soft delete a notification
// @route   DELETE /api/notifications/:id
// @access  Private
router.delete('/:id', protect, [
  param('id').isMongoId().withMessage('Invalid notification ID'),
  handleValidationErrors
], async (req, res) => {
  try {
    await notificationService.deleteNotification(
      req.params.id,
      req.user._id,
      req.user.tenantId
    );

    res.json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    console.error('Delete notification error:', error);
    if (error.message === 'Notification not found') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error while deleting notification'
    });
  }
});

// @desc    Bulk delete notifications
// @route   DELETE /api/notifications/bulk
// @access  Private
router.delete('/bulk', protect, [
  body('notificationIds').isArray({ min: 1 }).withMessage('notificationIds must be a non-empty array'),
  body('notificationIds.*').isMongoId().withMessage('Invalid notification ID in array'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { notificationIds } = req.body;
    const Notification = require('../models/Notification');

    const result = await Notification.updateMany(
      {
        _id: { $in: notificationIds },
        userId: req.user._id,
        tenantId: req.user.tenantId
      },
      {
        $set: {
          isDeleted: true,
          deletedAt: new Date()
        }
      }
    );

    res.json({
      success: true,
      data: { deletedCount: result.modifiedCount },
      message: `${result.modifiedCount} notification(s) deleted successfully`
    });
  } catch (error) {
    console.error('Bulk delete error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting notifications'
    });
  }
});

// ============================================================================
// NOTIFICATION PREFERENCES
// ============================================================================

// @desc    Get user's notification preferences
// @route   GET /api/notifications/preferences
// @access  Private
router.get('/preferences', protect, async (req, res) => {
  try {
    const preferences = await NotificationPreference.getOrCreate(
      req.user._id,
      req.user.tenantId
    );

    res.json({
      success: true,
      data: preferences
    });
  } catch (error) {
    console.error('Get preferences error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching preferences'
    });
  }
});

// @desc    Update user's notification preferences
// @route   PUT /api/notifications/preferences
// @access  Private
router.put('/preferences', protect, [
  body('preferences').isObject().withMessage('Preferences must be an object'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { preferences } = req.body;

    let userPreferences = await NotificationPreference.findOne({
      userId: req.user._id,
      tenantId: req.user.tenantId
    });

    if (!userPreferences) {
      userPreferences = await NotificationPreference.create({
        userId: req.user._id,
        tenantId: req.user.tenantId,
        preferences
      });
    } else {
      userPreferences.preferences = {
        ...userPreferences.preferences,
        ...preferences
      };
      await userPreferences.save();
    }

    res.json({
      success: true,
      data: userPreferences,
      message: 'Preferences updated successfully'
    });
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating preferences'
    });
  }
});

module.exports = router;

