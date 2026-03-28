const express = require('express');
const { query } = require('express-validator');
const { protect } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');
const Notification = require('../models/Notification');
const NotificationPreference = require('../models/NotificationPreference');
const Announcement = require('../models/Announcement');

/**
 * Get IDs of expired announcements for a tenant.
 * Used to filter out notifications linked to expired announcements.
 */
async function getExpiredAnnouncementIds(tenantId) {
  const expired = await Announcement.find({
    tenantId,
    expiresAt: { $ne: null, $lte: new Date() }
  }).select('_id').lean();
  return expired.map(a => a._id);
}

/**
 * Add a filter to a Mongo query that excludes notifications
 * whose parent announcement has expired.
 */
function addExpiredAnnouncementFilter(query, expiredIds) {
  if (expiredIds.length === 0) return;
  // Exclude announcement notifications whose parent has expired
  if (!query.$and) query.$and = [];
  query.$and.push({
    $or: [
      { category: { $ne: 'announcement' } },
      { 'metadata.announcementId': { $nin: expiredIds } }
    ]
  });
}

const router = express.Router();

// @desc    Get user notification preferences
// @route   GET /api/notifications/preferences
// @access  Private
router.get('/preferences', protect, async(req, res) => {
  try {
    const preferences = await NotificationPreference.getOrCreate(req.user._id, req.user.tenantId);
    res.json({
      success: true,
      data: preferences
    });
  } catch (error) {
    console.error('Get notification preferences error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching notification preferences'
    });
  }
});

// @desc    Update user notification preferences
// @route   PUT /api/notifications/preferences
// @access  Private
router.put('/preferences', protect, async(req, res) => {
  try {
    const { preferences } = req.body;

    if (!preferences || typeof preferences !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Preferences object is required'
      });
    }

    // Validate category keys
    const validCategories = ['admission', 'fee', 'academic', 'attendance', 'employee', 'exam', 'announcement', 'system'];
    const updateData = {};

    for (const [category, channels] of Object.entries(preferences)) {
      if (!validCategories.includes(category)) {
        continue;
      }
      if (typeof channels !== 'object') {
        continue;
      }
      updateData[`preferences.${category}`] = {};
      for (const [channel, value] of Object.entries(channels)) {
        if (['inApp', 'email', 'whatsapp'].includes(channel) && typeof value === 'boolean') {
          updateData[`preferences.${category}`][channel] = value;
        }
      }
    }

    const updated = await NotificationPreference.findOneAndUpdate(
      { userId: req.user._id, tenantId: req.user.tenantId },
      { $set: updateData },
      { new: true, upsert: true }
    );

    res.json({
      success: true,
      message: 'Notification preferences updated successfully',
      data: updated
    });
  } catch (error) {
    console.error('Update notification preferences error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating notification preferences'
    });
  }
});

// @desc    Get unread notification count
// @route   GET /api/notifications/unread-count
// @access  Private
router.get('/unread-count', protect, async(req, res) => {
  try {
    // Get expired announcement IDs to exclude from count
    const expiredIds = await getExpiredAnnouncementIds(req.user.tenantId);

    const User = require('../models/User');
    const user = await User.findById(req.user._id).select('role').lean();

    const countQuery = {
      userId: req.user._id,
      tenantId: req.user.tenantId,
      isRead: false,
      isDeleted: false
    };

    // Apply role-based visibility filter (same as model static)
    if (user && user.role !== 'admin') {
      countQuery.visibility = user.role;
    }

    // Exclude notifications for expired announcements
    addExpiredAnnouncementFilter(countQuery, expiredIds);

    const count = await Notification.countDocuments(countQuery);
    res.json({
      success: true,
      data: { count }
    });
  } catch (error) {
    console.error('Get unread notifications count error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching unread notification count'
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
], async(req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Get expired announcement IDs to exclude
    const expiredIds = await getExpiredAnnouncementIds(req.user.tenantId);

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

    // Exclude notifications for expired announcements
    addExpiredAnnouncementFilter(query, expiredIds);

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
router.patch('/mark-all-read', protect, async(req, res) => {
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
router.patch('/:id/read', protect, async(req, res) => {
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
router.patch('/:id/unread', protect, async(req, res) => {
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

// @desc    Soft-delete a notification
// @route   DELETE /api/notifications/:id
// @access  Private
router.delete('/:id', protect, async(req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.user.tenantId, userId: req.user._id, isDeleted: false },
      { $set: { isDeleted: true, deletedAt: new Date() } },
      { new: true }
    );
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    res.json({ success: true, message: 'Notification deleted' });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
