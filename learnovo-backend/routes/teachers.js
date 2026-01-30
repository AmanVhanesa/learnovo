const express = require('express');
const { body, query } = require('express-validator');
const User = require('../models/User');
const Class = require('../models/Class');
const { protect, authorize } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');

const router = express.Router();

// @desc    Get all teachers
// @route   GET /api/teachers
// @access  Private (Admin)
router.get('/', protect, authorize('admin'), [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('search').optional().trim().isLength({ min: 1, max: 100 }).withMessage('Search query must be between 1 and 100 characters'),
  handleValidationErrors
], async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Build filter
    const filter = { role: 'teacher' };

    // Add tenant filtering
    if (req.user && req.user.tenantId) {
      filter.tenantId = req.user.tenantId;
    }

    console.log('📋 Fetching teachers with filter:', filter);

    // Add search filter
    if (req.query.search) {
      filter.$or = [
        { name: { $regex: req.query.search, $options: 'i' } },
        { email: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    const teachers = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments(filter);

    console.log(`✅ Found ${teachers.length} teachers (total: ${total})`);

    res.json({
      success: true,
      data: teachers,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get teachers error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching teachers'
    });
  }
});

// @desc    Create teacher
// @route   POST /api/teachers
// @access  Private (Admin)
router.post('/', protect, authorize('admin'), [
  body('name').trim().isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
  body('subjects').isArray().withMessage('Subjects must be an array'),
  body('qualifications').trim().notEmpty().withMessage('Qualifications are required'),
  body('assignedClasses').isArray().withMessage('Assigned classes must be an array'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { name, email, password, subjects, qualifications, assignedClasses, phone } = req.body;

    const existingTeacher = await User.findOne({ email });
    if (existingTeacher) {
      return res.status(400).json({
        success: false,
        message: 'Teacher with this email already exists'
      });
    }

    // Store plain password before creation (it gets hashed in the model)
    const plainPassword = password;

    const teacher = await User.create({
      name,
      email,
      password,
      role: 'teacher',
      tenantId: req.user.tenantId, // Ensure tenantId is set
      subjects,
      qualifications,
      assignedClasses,
      phone
    });

    res.status(201).json({
      success: true,
      message: 'Teacher created successfully',
      data: {
        id: teacher._id,
        name: teacher.name,
        email: teacher.email,
        subjects: teacher.subjects,
        qualifications: teacher.qualifications,
        assignedClasses: teacher.assignedClasses,
        // Include credentials for admin to share
        credentials: {
          email: teacher.email,
          password: plainPassword // Return the plain password so admin can share it
        }
      }
    });
  } catch (error) {
    console.error('Create teacher error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating teacher'
    });
  }
});
// @desc    Update teacher
// @route   PUT /api/teachers/:id
// @access  Private (Admin)
router.put('/:id', protect, authorize('admin'), [
  body('name').optional().trim().isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters'),
  body('email').optional().isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('subjects').optional().isArray().withMessage('Subjects must be an array'),
  body('qualifications').optional().trim().notEmpty().withMessage('Qualifications are required'),
  body('assignedClasses').optional().isArray().withMessage('Assigned classes must be an array'),
  handleValidationErrors
], async (req, res) => {
  try {
    const teacher = await User.findById(req.params.id);
    if (!teacher || teacher.role !== 'teacher') {
      return res.status(404).json({ success: false, message: 'Teacher not found' });
    }
    if (req.body.email && req.body.email !== teacher.email) {
      const existing = await User.findOne({ email: req.body.email });
      if (existing) {
        return res.status(400).json({ success: false, message: 'Email already in use' });
      }
    }
    const updated = await User.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }).select('-password');
    res.json({ success: true, message: 'Teacher updated successfully', data: updated });
  } catch (error) {
    console.error('Update teacher error:', error);
    res.status(500).json({ success: false, message: 'Server error while updating teacher' });
  }
});

// @desc    Delete teacher
// @route   DELETE /api/teachers/:id
// @access  Private (Admin)
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const teacher = await User.findById(req.params.id);
    if (!teacher || teacher.role !== 'teacher') {
      return res.status(404).json({ success: false, message: 'Teacher not found' });
    }
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Teacher deleted successfully' });
  } catch (error) {
    console.error('Delete teacher error:', error);
    res.status(500).json({ success: false, message: 'Server error while deleting teacher' });
  }
});

// @desc    Get teacher's assigned classes
// @route   GET /api/teachers/my-classes
// @access  Private (Teacher)
router.get('/my-classes', protect, authorize('teacher', 'admin'), async (req, res) => {
  try {
    const teacherId = req.user._id;

    // Find all classes where this teacher is assigned
    const classes = await Class.find({
      tenantId: req.user.tenantId,
      $or: [
        { classTeacher: teacherId },
        { 'subjects.teacher': teacherId }
      ],
      isActive: true
    })
      .populate('classTeacher', 'name email')
      .populate('subjects.teacher', 'name email')
      .select('name grade academicYear classTeacher subjects isActive')
      .sort({ name: 1 });

    // Transform to include subject information
    const classesWithSubjects = classes.map(classDoc => {
      const subjects = classDoc.subjects
        .filter(sub => sub.teacher && sub.teacher._id.toString() === teacherId.toString())
        .map(sub => ({
          _id: sub._id,
          name: sub.subject?.name || sub.name || 'General', // Handle both structures
          teacher: sub.teacher
        }));

      return {
        _id: classDoc._id,
        name: classDoc.name,
        grade: classDoc.grade,
        academicYear: classDoc.academicYear,
        classTeacher: classDoc.classTeacher,
        subjects,
        isActive: classDoc.isActive
      };
    });

    res.json({
      success: true,
      data: classesWithSubjects,
      count: classesWithSubjects.length
    });
  } catch (error) {
    console.error('Get my classes error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching classes'
    });
  }
});

module.exports = router;
