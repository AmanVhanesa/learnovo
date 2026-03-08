const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const Subject = require('../models/Subject');

// Get all subjects
router.get('/', protect, async (req, res) => {
  try {
    const { isActive } = req.query;
    const filter = {};

    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    const subjects = await Subject.find(filter).sort({ name: 1 });

    res.json({
      success: true,
      data: subjects
    });
  } catch (error) {
    console.error('Error fetching subjects:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get a specific subject
router.get('/:id', protect, async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.id);

    if (!subject) {
      return res.status(404).json({
        success: false,
        message: 'Subject not found'
      });
    }

    res.json({
      success: true,
      data: subject
    });
  } catch (error) {
    console.error('Error fetching subject:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Create a new subject
router.post('/', [
  protect,
  authorize('admin'),
  body('name').notEmpty().withMessage('Subject name is required'),
  body('subjectCode').notEmpty().withMessage('Subject code is required'),
  body('description').optional().isString().withMessage('Description must be a string')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { name, subjectCode, description, type, maxMarks, passingMarks } = req.body;

    // Check if subject code already exists within this tenant
    const existingSubject = await Subject.findOne({ subjectCode, tenantId: req.user.tenantId });
    if (existingSubject) {
      return res.status(400).json({
        success: false,
        message: 'Subject code already exists'
      });
    }

    const newSubject = new Subject({
      tenantId: req.user.tenantId, // Mandatory for multi-tenant
      name,
      subjectCode: subjectCode ? subjectCode.toUpperCase() : undefined,
      type: type || 'Theory',
      maxMarks: maxMarks !== undefined ? maxMarks : 100,
      passingMarks: passingMarks !== undefined ? passingMarks : 33,
      description
    });

    await newSubject.save();

    res.status(201).json({
      success: true,
      message: 'Subject created successfully',
      data: newSubject
    });
  } catch (error) {
    console.error('Error creating subject:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Update a subject
router.put('/:id', [
  protect,
  authorize('admin'),
  body('name').optional().notEmpty().withMessage('Subject name cannot be empty'),
  body('subjectCode').optional().notEmpty().withMessage('Subject code cannot be empty'),
  body('description').optional().isString().withMessage('Description must be a string')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { name, subjectCode, description, type, maxMarks, passingMarks } = req.body;
    const updates = {};

    if (name) updates.name = name;
    if (subjectCode) {
      // Check if new subject code already exists (excluding current subject, within same tenant)
      const existingSubject = await Subject.findOne({
        subjectCode: subjectCode.toUpperCase(),
        tenantId: req.user.tenantId,
        _id: { $ne: req.params.id }
      });
      if (existingSubject) {
        return res.status(400).json({
          success: false,
          message: 'Subject code already exists'
        });
      }
      updates.subjectCode = subjectCode.toUpperCase();
    }
    if (description !== undefined) updates.description = description;

    if (type) updates.type = type;
    if (maxMarks !== undefined) updates.maxMarks = maxMarks;
    if (passingMarks !== undefined) updates.passingMarks = passingMarks;

    const updatedSubject = await Subject.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );

    if (!updatedSubject) {
      return res.status(404).json({
        success: false,
        message: 'Subject not found'
      });
    }

    res.json({
      success: true,
      message: 'Subject updated successfully',
      data: updatedSubject
    });
  } catch (error) {
    console.error('Error updating subject:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Delete a subject
router.delete('/:id', [protect, authorize('admin')], async (req, res) => {
  try {
    const deletedSubject = await Subject.findByIdAndDelete(req.params.id);

    if (!deletedSubject) {
      return res.status(404).json({
        success: false,
        message: 'Subject not found'
      });
    }

    res.json({
      success: true,
      message: 'Subject deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting subject:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Toggle subject active status
router.patch('/:id/toggle', [protect, authorize('admin')], async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.id);

    if (!subject) {
      return res.status(404).json({
        success: false,
        message: 'Subject not found'
      });
    }

    subject.isActive = !subject.isActive;
    await subject.save();

    res.json({
      success: true,
      message: `Subject ${subject.isActive ? 'activated' : 'deactivated'} successfully`,
      data: subject
    });
  } catch (error) {
    console.error('Error toggling subject status:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;
