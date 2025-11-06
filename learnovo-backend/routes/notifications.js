const express = require('express');
const { body, query } = require('express-validator');
const { protect } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');

const router = express.Router();

// @desc    Get notifications
// @route   GET /api/notifications
// @access  Private
router.get('/', protect, [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  handleValidationErrors
], async(req, res) => {
  try {
    // Mock notifications for now
    const notifications = [
      {
        id: 1,
        title: 'Fee Payment Reminder',
        message: 'Your monthly tuition fee is due on January 15th.',
        type: 'warning',
        date: new Date(),
        read: false
      },
      {
        id: 2,
        title: 'Parent-Teacher Meeting',
        message: 'Parent-teacher meeting scheduled for January 20th at 2 PM.',
        type: 'info',
        date: new Date(),
        read: false
      }
    ];

    res.json({
      success: true,
      data: notifications
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching notifications'
    });
  }
});

module.exports = router;
