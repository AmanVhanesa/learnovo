const express = require('express');
const { body, query } = require('express-validator');
const { protect } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');
const Notification = require('../models/Notification'); // Import Notification model

const router = express.Router();

// @desc    Get unread notification count
// @route   GET /api/notifications/unread-count
// @access  Private
router.get('/unread-count', protect, async (req, res) => {
  try {
    const userId = req.user._id;
    const tenantId = req.user.tenantId;

    // Check if models are properly registered
    const NotificationModel = require('../models/Notification');

    const count = await NotificationModel.getUnreadCount(userId, tenantId);

    return res.json({
      success: true,
      data: { count }
    });
  } catch (error) {
    console.error(`[Notification Error] GET /unread-count - RequestID: ${req.requestId}`, error);

    // Ensure we ALWAYS return valid JSON instead of letting connection close
    return res.status(500).json({
      success: false,
      message: 'Error fetching notification count',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @desc    Get notifications
// @route   GET /api/notifications
// @access  Private
router.get('/', protect, [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  handleValidationErrors
], async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Build query
    const query = {
      tenantId: req.user.tenantId,
      userId: req.user._id,
      isDeleted: false
    };

    if (req.query.isRead !== undefined && req.query.isRead !== 'all') {
      query.isRead = req.query.isRead === 'true';
    }

    if (req.query.category) {
      query.category = req.query.category;
    }

    if (req.query.startDate && req.query.endDate) {
      query.createdAt = {
        $gte: new Date(req.query.startDate),
        $lte: new Date(req.query.endDate)
      };
    }

    // Execute query
    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Notification.countDocuments(query);

    res.json({
      success: true,
      data: notifications,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching notifications'
    });
  }
});

// @desc    Mark all notifications as read
// @route   PATCH /api/notifications/mark-all-read
// @access  Private
router.patch('/mark-all-read', protect, async (req, res) => {
  try {
    await Notification.updateMany(
      { tenantId: req.user.tenantId, userId: req.user._id, isRead: false },
      { $set: { isRead: true, readAt: new Date() } }
    );
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark all read error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @desc    Mark notification as read
// @route   PATCH /api/notifications/:id/read
// @access  Private
router.patch('/:id/read', protect, async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.user.tenantId, userId: req.user._id },
      { $set: { isRead: true, readAt: new Date() } },
      { new: true }
    );
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    res.json({ success: true, data: notification });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @desc    Mark notification as unread
// @route   PATCH /api/notifications/:id/unread
// @access  Private
router.patch('/:id/unread', protect, async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.user.tenantId, userId: req.user._id },
      { $set: { isRead: false, readAt: null } },
      { new: true }
    );
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    res.json({ success: true, data: notification });
  } catch (error) {
    console.error('Mark as unread error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
