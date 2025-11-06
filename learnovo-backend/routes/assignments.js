const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');
const Assignment = require('../models/Assignment');
const User = require('../models/User');

// @desc    Get all assignments (role-based)
// @route   GET /api/assignments
// @access  Private
router.get('/', protect, async(req, res) => {
  try {
    const { status, class: className, subject } = req.query;
    const user = req.user;
    const tenantId = user.tenantId;

    // Build filter based on user role
    const filter = { tenantId };

    if (user.role === 'teacher') {
      filter.teacher = user._id;
    } else if (user.role === 'student') {
      // Find assignments assigned to this student
      filter.assignedTo = user._id;
      filter.isVisible = true;
    } else if (user.role === 'admin') {
      // Admin can see all assignments in their tenant
    } else if (user.role === 'parent') {
      // Parents see assignments for their children
      const childrenIds = Array.isArray(user.children) ? user.children : [];
      if (childrenIds.length > 0) {
        filter.assignedTo = { $in: childrenIds };
      } else {
        // No children, return empty
        return res.json({
          success: true,
          data: []
        });
      }
    }

    // Additional filters
    if (status) {
      filter.status = status;
    }
    if (className) {
      filter.class = className;
    }
    if (subject) {
      filter.subject = subject;
    }

    const assignments = await Assignment.find(filter)
      .populate('teacher', 'name email')
      .sort({ dueDate: 1 });

    res.json({
      success: true,
      data: assignments
    });
  } catch (error) {
    console.error('Error fetching assignments:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching assignments'
    });
  }
});

// @desc    Get a specific assignment
// @route   GET /api/assignments/:id
// @access  Private
router.get('/:id', protect, async(req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const tenantId = user.tenantId;

    const filter = { _id: id, tenantId };

    // Students and parents can only see assignments assigned to them/their children
    if (user.role === 'student') {
      filter.assignedTo = user._id;
    } else if (user.role === 'parent') {
      const childrenIds = Array.isArray(user.children) ? user.children : [];
      filter.assignedTo = { $in: childrenIds };
    } else if (user.role === 'teacher') {
      filter.teacher = user._id;
    }

    const assignment = await Assignment.findOne(filter)
      .populate('teacher', 'name email')
      .populate('assignedTo', 'name email rollNumber');

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Assignment not found'
      });
    }

    res.json({
      success: true,
      data: assignment
    });
  } catch (error) {
    console.error('Error fetching assignment:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching assignment'
    });
  }
});

// @desc    Create a new assignment
// @route   POST /api/assignments
// @access  Private (Teacher, Admin)
router.post('/', protect, authorize('admin', 'teacher'), [
  body('title').notEmpty().withMessage('Title is required'),
  body('description').notEmpty().withMessage('Description is required'),
  body('class').notEmpty().withMessage('Class is required'),
  body('subject').notEmpty().withMessage('Subject is required'),
  body('dueDate').isISO8601().withMessage('Valid due date is required'),
  body('assignedTo').optional().isArray().withMessage('Assigned to must be an array')
], handleValidationErrors, async(req, res) => {
  try {
    const {
      title,
      description,
      class: className,
      subject,
      dueDate,
      assignedTo,
      totalMarks,
      instructions,
      classId
    } = req.body;

    // If assignedTo is not provided, assign to all students in the class
    let studentIds = assignedTo;
    if (!studentIds || studentIds.length === 0) {
      const students = await User.find({
        role: 'student',
        class: className,
        tenantId: req.user.tenantId
      }).select('_id');
      studentIds = students.map(s => s._id);
    }

    const assignment = await Assignment.create({
      tenantId: req.user.tenantId,
      title,
      description,
      class: className,
      classId,
      subject,
      teacher: req.user._id,
      assignedTo: studentIds,
      dueDate,
      totalMarks: totalMarks || 100,
      instructions
    });

    // Populate assignment
    await assignment.populate('teacher', 'name email');
    await assignment.populate('assignedTo', 'name email rollNumber');

    res.status(201).json({
      success: true,
      message: 'Assignment created successfully',
      data: assignment
    });
  } catch (error) {
    console.error('Error creating assignment:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating assignment'
    });
  }
});

// @desc    Update an assignment
// @route   PUT /api/assignments/:id
// @access  Private (Teacher, Admin)
router.put('/:id', protect, authorize('admin', 'teacher'), [
  body('title').optional().notEmpty().withMessage('Title cannot be empty'),
  body('description').optional().notEmpty().withMessage('Description cannot be empty'),
  body('status').optional().isIn(['active', 'completed', 'cancelled']).withMessage('Invalid status')
], handleValidationErrors, async(req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const filter = { _id: id, tenantId: req.user.tenantId };

    // Teachers can only update their own assignments
    if (req.user.role === 'teacher') {
      filter.teacher = req.user._id;
    }

    const assignment = await Assignment.findOneAndUpdate(
      filter,
      updates,
      { new: true, runValidators: true }
    )
      .populate('teacher', 'name email')
      .populate('assignedTo', 'name email rollNumber');

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Assignment not found'
      });
    }

    res.json({
      success: true,
      message: 'Assignment updated successfully',
      data: assignment
    });
  } catch (error) {
    console.error('Error updating assignment:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating assignment'
    });
  }
});

// @desc    Delete an assignment
// @route   DELETE /api/assignments/:id
// @access  Private (Teacher, Admin)
router.delete('/:id', protect, authorize('admin', 'teacher'), async(req, res) => {
  try {
    const { id } = req.params;

    const filter = { _id: id, tenantId: req.user.tenantId };

    // Teachers can only delete their own assignments
    if (req.user.role === 'teacher') {
      filter.teacher = req.user._id;
    }

    const assignment = await Assignment.findOneAndDelete(filter);

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Assignment not found'
      });
    }

    res.json({
      success: true,
      message: 'Assignment deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting assignment:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting assignment'
    });
  }
});

// @desc    Get assignment statistics
// @route   GET /api/assignments/stats/overview
// @access  Private
router.get('/stats/overview', protect, async(req, res) => {
  try {
    const user = req.user;
    const tenantId = user.tenantId;

    const filter = { tenantId };

    if (user.role === 'teacher') {
      filter.teacher = user._id;
    } else if (user.role === 'student') {
      filter.assignedTo = user._id;
      filter.isVisible = true;
    } else if (user.role === 'parent') {
      const childrenIds = Array.isArray(user.children) ? user.children : [];
      if (childrenIds.length > 0) {
        filter.assignedTo = { $in: childrenIds };
      }
    }

    const assignments = await Assignment.find(filter);
    
    const stats = {
      totalAssignments: assignments.length,
      activeAssignments: assignments.filter(a => a.status === 'active').length,
      completedAssignments: assignments.filter(a => a.status === 'completed').length,
      cancelledAssignments: assignments.filter(a => a.status === 'cancelled').length
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching assignment stats:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching statistics'
    });
  }
});

// @desc    Get upcoming assignments
// @route   GET /api/assignments/upcoming/list
// @access  Private
router.get('/upcoming/list', protect, async(req, res) => {
  try {
    const user = req.user;
    const tenantId = user.tenantId;
    const today = new Date();

    const filter = {
      tenantId,
      status: 'active',
      dueDate: { $gte: today }
    };

    if (user.role === 'teacher') {
      filter.teacher = user._id;
    } else if (user.role === 'student') {
      filter.assignedTo = user._id;
      filter.isVisible = true;
    } else if (user.role === 'parent') {
      const childrenIds = Array.isArray(user.children) ? user.children : [];
      if (childrenIds.length > 0) {
        filter.assignedTo = { $in: childrenIds };
      }
    }

    const upcomingAssignments = await Assignment.find(filter)
      .populate('teacher', 'name email')
      .sort({ dueDate: 1 })
      .limit(10);

    res.json({
      success: true,
      data: upcomingAssignments
    });
  } catch (error) {
    console.error('Error fetching upcoming assignments:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching upcoming assignments'
    });
  }
});

module.exports = router;
