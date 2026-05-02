const express = require('express');
const { body, query, param } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');
const circularService = require('../services/circularService');

const router = express.Router();

// List circulars (visible to all authenticated users in tenant)
router.get('/', protect, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('category').optional().isString(),
  query('search').optional().isString(),
  handleValidationErrors
], async(req, res) => {
  try {
    const { page, limit, category, search } = req.query;
    const result = await circularService.getCirculars(req.user.tenantId, {
      page, limit, category, search
    });
    res.json({
      success: true,
      data: result.circulars,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Get circulars error:', error);
    res.status(500).json({ success: false, message: 'Server error while fetching circulars' });
  }
});

// Get single circular
router.get('/:id', protect, [
  param('id').isMongoId(),
  handleValidationErrors
], async(req, res) => {
  try {
    const circular = await circularService.getCircular(req.params.id, req.user.tenantId);
    res.json({ success: true, data: circular });
  } catch (error) {
    if (error.message === 'Circular not found') {
      return res.status(404).json({ success: false, message: error.message });
    }
    console.error('Get circular error:', error);
    res.status(500).json({ success: false, message: 'Server error while fetching circular' });
  }
});

// Create circular (admin only)
router.post('/', protect, authorize('admin', 'principal'), [
  body('title').trim().isLength({ min: 3, max: 200 }),
  body('subject').trim().isLength({ min: 3, max: 300 }),
  body('body').trim().isLength({ min: 10, max: 10000 }),
  body('category').optional().isIn(['general', 'academic', 'event', 'holiday', 'exam', 'fee', 'urgent', 'other']),
  body('priority').optional().isIn(['low', 'medium', 'high']),
  body('targetAudience').isArray({ min: 1 }),
  body('targetAudience.*').isIn(['student', 'teacher', 'parent', 'admin', 'all']),
  body('targetClasses').optional().isArray(),
  body('targetClasses.*').optional().isMongoId(),
  body('issueDate').optional().isISO8601(),
  body('signedByName').optional().isString(),
  body('signedByDesignation').optional().isString(),
  body('referenceNumber').optional().isString(),
  handleValidationErrors
], async(req, res) => {
  try {
    const circular = await circularService.createCircular({
      tenantId: req.user.tenantId,
      createdBy: req.user._id,
      ...req.body
    });
    res.status(201).json({
      success: true,
      message: 'Circular created and notifications are being sent',
      data: circular
    });
  } catch (error) {
    console.error('Create circular error:', error);
    res.status(500).json({ success: false, message: 'Server error while creating circular' });
  }
});

// Update circular (admin only)
router.put('/:id', protect, authorize('admin', 'principal'), [
  param('id').isMongoId(),
  body('title').optional().trim().isLength({ min: 3, max: 200 }),
  body('subject').optional().trim().isLength({ min: 3, max: 300 }),
  body('body').optional().trim().isLength({ min: 10, max: 10000 }),
  body('category').optional().isIn(['general', 'academic', 'event', 'holiday', 'exam', 'fee', 'urgent', 'other']),
  body('priority').optional().isIn(['low', 'medium', 'high']),
  body('targetAudience').optional().isArray({ min: 1 }),
  body('targetAudience.*').optional().isIn(['student', 'teacher', 'parent', 'admin', 'all']),
  body('targetClasses').optional().isArray(),
  body('targetClasses.*').optional().isMongoId(),
  body('signedByName').optional().isString(),
  body('signedByDesignation').optional().isString(),
  body('referenceNumber').optional().isString(),
  body('issueDate').optional().isISO8601(),
  body('isActive').optional().isBoolean(),
  handleValidationErrors
], async(req, res) => {
  try {
    const circular = await circularService.updateCircular(req.params.id, req.user.tenantId, req.body);
    res.json({ success: true, message: 'Circular updated', data: circular });
  } catch (error) {
    if (error.message === 'Circular not found') {
      return res.status(404).json({ success: false, message: error.message });
    }
    console.error('Update circular error:', error);
    res.status(500).json({ success: false, message: 'Server error while updating circular' });
  }
});

// Delete circular (admin only, soft delete)
router.delete('/:id', protect, authorize('admin', 'principal'), [
  param('id').isMongoId(),
  handleValidationErrors
], async(req, res) => {
  try {
    await circularService.deleteCircular(req.params.id, req.user.tenantId);
    res.json({ success: true, message: 'Circular deleted' });
  } catch (error) {
    if (error.message === 'Circular not found') {
      return res.status(404).json({ success: false, message: error.message });
    }
    console.error('Delete circular error:', error);
    res.status(500).json({ success: false, message: 'Server error while deleting circular' });
  }
});

module.exports = router;
