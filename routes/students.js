const express = require('express');
const { body, query } = require('express-validator');
const User = require('../models/User');
const Fee = require('../models/Fee');
const Counter = require('../models/Counter');
const { protect, authorize, canAccessStudent } = require('../middleware/auth');
const { handleValidationErrors, validateStudent } = require('../middleware/validation');
const { formatCurrencyWithSettings } = require('../utils/currency');

const router = express.Router();

// @desc    Get all students
// @route   GET /api/students
// @access  Private (Admin, Teacher)
router.get('/', protect, authorize('admin', 'teacher'), [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('class').optional().trim().notEmpty().withMessage('Class filter cannot be empty'),
  query('search').optional().trim().isLength({ min: 1, max: 100 }).withMessage('Search query must be between 1 and 100 characters'),
  handleValidationErrors
], async(req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Build filter
    const filter = { role: 'student' };

    // Add tenant filtering
    if (req.user && req.user.tenantId) {
      filter.tenantId = req.user.tenantId;
    }

    // Add class filter for teachers
    if (req.user.role === 'teacher' && req.user.assignedClasses) {
      filter.class = { $in: req.user.assignedClasses };
    }

    // Add class filter from query
    if (req.query.class) {
      filter.class = req.query.class;
    }

    // Add search filter
    if (req.query.search) {
      filter.$or = [
        { name: { $regex: req.query.search, $options: 'i' } },
        { admissionNumber: { $regex: req.query.search, $options: 'i' } },
        { rollNumber: { $regex: req.query.search, $options: 'i' } },
        { studentId: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    // Get students
    const students = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Get total count
    const total = await User.countDocuments(filter);

    // Get fee summary for each student
    const studentsWithFees = await Promise.all(
      students.map(async(student) => {
        const fees = await Fee.find({ student: student._id });
        const totalFees = fees.reduce((sum, fee) => sum + fee.amount, 0);
        const paidFees = fees.filter(fee => fee.status === 'paid').reduce((sum, fee) => sum + fee.amount, 0);
        const pendingFees = fees.filter(fee => fee.status === 'pending').reduce((sum, fee) => sum + fee.amount, 0);
        const overdueFees = fees.filter(fee => fee.status === 'overdue').reduce((sum, fee) => sum + fee.amount, 0);

        return {
          ...student.toJSON(),
          feeSummary: {
            total: await formatCurrencyWithSettings(totalFees),
            paid: await formatCurrencyWithSettings(paidFees),
            pending: await formatCurrencyWithSettings(pendingFees),
            overdue: await formatCurrencyWithSettings(overdueFees)
          }
        };
      })
    );

    res.json({
      success: true,
      data: studentsWithFees,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching students'
    });
  }
});

// @desc    Get single student
// @route   GET /api/students/:id
// @access  Private
router.get('/:id', protect, canAccessStudent, async(req, res) => {
  try {
    const student = await User.findById(req.params.id).select('-password');

    if (!student || student.role !== 'student') {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Get fee details
    const fees = await Fee.find({ student: student._id }).sort({ dueDate: -1 });

    // Get fee summary
    const totalFees = fees.reduce((sum, fee) => sum + fee.amount, 0);
    const paidFees = fees.filter(fee => fee.status === 'paid').reduce((sum, fee) => sum + fee.amount, 0);
    const pendingFees = fees.filter(fee => fee.status === 'pending').reduce((sum, fee) => sum + fee.amount, 0);
    const overdueFees = fees.filter(fee => fee.status === 'overdue').reduce((sum, fee) => sum + fee.amount, 0);

    // Format fees with currency
    const formattedFees = await Promise.all(
      fees.map(async(fee) => ({
        ...fee.toJSON(),
        formattedAmount: await formatCurrencyWithSettings(fee.amount, fee.currency)
      }))
    );

    res.json({
      success: true,
      data: {
        ...student.toJSON(),
        fees: formattedFees,
        feeSummary: {
          total: await formatCurrencyWithSettings(totalFees),
          paid: await formatCurrencyWithSettings(paidFees),
          pending: await formatCurrencyWithSettings(pendingFees),
          overdue: await formatCurrencyWithSettings(overdueFees)
        }
      }
    });
  } catch (error) {
    console.error('Get student error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching student'
    });
  }
});

// @desc    Create new student
// @route   POST /api/students
// @access  Private (Admin)
router.post('/', protect, authorize('admin'), validateStudent, async(req, res) => {
  try {
    // Ensure student is created with same tenantId as admin
    if (!req.user || !req.user.tenantId) {
      return res.status(400).json({
        success: false,
        message: 'User tenant not found. Please login again.'
      });
    }

    const {
      name,
      email,
      phone,
      password,
      class: studentClass,
      rollNumber,
      admissionDate,
      guardianName,
      guardianPhone,
      address,
      avatar
    } = req.body;

    // Check if email already exists in the same tenant
    const existingStudent = await User.findOne({ 
      email: email.toLowerCase().trim(),
      tenantId: req.user.tenantId 
    });
    if (existingStudent) {
      return res.status(400).json({
        success: false,
        message: 'Student with this email already exists'
      });
    }

    // Check if roll number already exists in the same class and tenant
    const existingRollNumber = await User.findOne({
      rollNumber: rollNumber?.trim(),
      class: studentClass?.trim(),
      role: 'student',
      tenantId: req.user.tenantId
    });
    if (existingRollNumber) {
      return res.status(400).json({
        success: false,
        message: 'Roll number already exists in this class'
      });
    }

    // Prepare student data
    const studentData = {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      role: 'student',
      tenantId: req.user.tenantId, // CRITICAL: Must include tenantId
      class: studentClass?.trim(),
      rollNumber: rollNumber?.trim(),
      guardianName: guardianName?.trim(),
      address: address?.trim(),
      avatar: avatar?.trim()
    };

    // Add optional fields only if provided and valid
    if (phone && phone.trim()) {
      const cleanedPhone = phone.trim().replace(/\s+/g, '');
      // Remove leading zero if present
      const finalPhone = cleanedPhone.startsWith('0') 
        ? cleanedPhone.substring(1) 
        : cleanedPhone;
      if (finalPhone && /^[\+]?[1-9][\d]{5,15}$/.test(finalPhone)) {
        studentData.phone = finalPhone;
      } else if (finalPhone) {
        // Phone provided but invalid format - log warning but don't fail
        console.warn('Invalid phone format provided, skipping phone field:', finalPhone);
      }
    }
    
    if (admissionDate) {
      try {
        // Convert to Date object if string
        const date = admissionDate instanceof Date 
          ? admissionDate 
          : new Date(admissionDate);
        if (!isNaN(date.getTime())) {
          studentData.admissionDate = date;
        } else {
          console.warn('Invalid admission date, skipping:', admissionDate);
        }
      } catch (err) {
        console.warn('Error parsing admission date:', err.message);
      }
    }
    
    if (guardianPhone && guardianPhone.trim()) {
      const cleanedGuardianPhone = guardianPhone.trim().replace(/\s+/g, '');
      const finalGuardianPhone = cleanedGuardianPhone.startsWith('0') 
        ? cleanedGuardianPhone.substring(1) 
        : cleanedGuardianPhone;
      if (finalGuardianPhone && /^[\+]?[1-9][\d]{5,15}$/.test(finalGuardianPhone)) {
        studentData.guardianPhone = finalGuardianPhone;
      } else if (finalGuardianPhone) {
        console.warn('Invalid guardian phone format, skipping:', finalGuardianPhone);
      }
    }

    // Generate admission number BEFORE creating student
    const currentYear = new Date().getFullYear().toString()
    const sequence = await Counter.getNextSequence('admission', currentYear, req.user.tenantId)
    const admissionNumber = Counter.formatAdmissionNumber(sequence, currentYear)
    
    // Add admission number to student data
    studentData.admissionNumber = admissionNumber

    console.log('Creating student with data:', {
      ...studentData,
      password: '[HIDDEN]',
      admissionNumber
    });

    // Store the plain password before creation (it gets hashed in the model)
    const plainPassword = password || 'student123'; // Use provided password or default

    // Create student
    const student = await User.create(studentData);

    res.status(201).json({
      success: true,
      message: 'Student created successfully',
      data: {
        id: student._id,
        name: student.name,
        email: student.email,
        admissionNumber: student.admissionNumber,
        studentId: student.studentId,
        rollNumber: student.rollNumber,
        class: student.class,
        admissionDate: student.admissionDate,
        // Include credentials for admin to share
        credentials: {
          email: student.email,
          password: plainPassword // Return the plain password so admin can share it
        }
      }
    });
  } catch (error) {
    console.error('Create student error:', error);
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      code: error.code,
      keyPattern: error.keyPattern,
      keyValue: error.keyValue,
      errors: error.errors,
      stack: error.stack
    });
    
    // Handle specific error types
    let statusCode = 500;
    let errorMessage = 'Server error while creating student';
    
    if (error.name === 'ValidationError') {
      statusCode = 400;
      errorMessage = 'Validation error';
      const validationErrors = Object.values(error.errors || {}).map(err => ({
        field: err.path,
        message: err.message
      }));
      return res.status(statusCode).json({
        success: false,
        message: errorMessage,
        errors: validationErrors
      });
    } else if (error.name === 'MongoServerError' && error.code === 11000) {
      // Duplicate key error
      statusCode = 409;
      const duplicateField = Object.keys(error.keyPattern || {})[0];
      errorMessage = `${duplicateField} already exists`;
      return res.status(statusCode).json({
        success: false,
        message: errorMessage
      });
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    res.status(statusCode).json({
      success: false,
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      details: process.env.NODE_ENV === 'development' ? {
        name: error.name,
        code: error.code,
        validationErrors: error.errors || undefined
      } : undefined
    });
  }
});

// @desc    Update student
// @route   PUT /api/students/:id
// @access  Private
router.put('/:id', protect, canAccessStudent, [
  body('name').optional().trim().isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters'),
  body('phone').optional().isMobilePhone().withMessage('Please provide a valid phone number'),
  body('class').optional().trim().notEmpty().withMessage('Class cannot be empty'),
  body('rollNumber').optional().trim().notEmpty().withMessage('Roll number cannot be empty'),
  handleValidationErrors
], async(req, res) => {
  try {
    const student = await User.findById(req.params.id);

    if (!student || student.role !== 'student') {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Check if roll number already exists in the same class (if being updated)
    if (req.body.rollNumber && req.body.class) {
      const existingRollNumber = await User.findOne({
        rollNumber: req.body.rollNumber?.trim(),
        class: req.body.class?.trim(),
        role: 'student',
        _id: { $ne: req.params.id }
      });
      if (existingRollNumber) {
        return res.status(400).json({
          success: false,
          message: 'Roll number already exists in this class'
        });
      }
    }

    // Update student
    const updatePayload = { ...req.body };
    if (updatePayload.password === '') {
      delete updatePayload.password;
    }
    const updatedStudent = await User.findByIdAndUpdate(
      req.params.id,
      updatePayload,
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      success: true,
      message: 'Student updated successfully',
      data: updatedStudent
    });
  } catch (error) {
    console.error('Update student error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating student'
    });
  }
});

// @desc    Delete student
// @route   DELETE /api/students/:id
// @access  Private (Admin)
router.delete('/:id', protect, authorize('admin'), async(req, res) => {
  try {
    const student = await User.findById(req.params.id);

    if (!student || student.role !== 'student') {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Check if student has fees
    const hasFees = await Fee.exists({ student: req.params.id });
    if (hasFees) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete student with existing fees. Please clear all fees first.'
      });
    }

    // Delete student
    await User.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Student deleted successfully'
    });
  } catch (error) {
    console.error('Delete student error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting student'
    });
  }
});

// @desc    Get student fees
// @route   GET /api/students/:id/fees
// @access  Private
router.get('/:id/fees', protect, canAccessStudent, async(req, res) => {
  try {
    const student = await User.findById(req.params.id);

    if (!student || student.role !== 'student') {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    const fees = await Fee.find({ student: req.params.id })
      .sort({ dueDate: -1 });

    // Format fees with currency
    const formattedFees = await Promise.all(
      fees.map(async(fee) => ({
        ...fee.toJSON(),
        formattedAmount: await formatCurrencyWithSettings(fee.amount, fee.currency)
      }))
    );

    res.json({
      success: true,
      data: formattedFees
    });
  } catch (error) {
    console.error('Get student fees error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching student fees'
    });
  }
});

// @desc    Get student statistics
// @route   GET /api/students/:id/statistics
// @access  Private
router.get('/:id/statistics', protect, canAccessStudent, async(req, res) => {
  try {
    const student = await User.findById(req.params.id);

    if (!student || student.role !== 'student') {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    const fees = await Fee.find({ student: req.params.id });

    const statistics = {
      totalFees: fees.length,
      paidFees: fees.filter(fee => fee.status === 'paid').length,
      pendingFees: fees.filter(fee => fee.status === 'pending').length,
      overdueFees: fees.filter(fee => fee.status === 'overdue').length,
      totalAmount: fees.reduce((sum, fee) => sum + fee.amount, 0),
      paidAmount: fees.filter(fee => fee.status === 'paid').reduce((sum, fee) => sum + fee.amount, 0),
      pendingAmount: fees.filter(fee => fee.status === 'pending').reduce((sum, fee) => sum + fee.amount, 0),
      overdueAmount: fees.filter(fee => fee.status === 'overdue').reduce((sum, fee) => sum + fee.amount, 0)
    };

    // Format amounts
    statistics.formattedTotalAmount = await formatCurrencyWithSettings(statistics.totalAmount);
    statistics.formattedPaidAmount = await formatCurrencyWithSettings(statistics.paidAmount);
    statistics.formattedPendingAmount = await formatCurrencyWithSettings(statistics.pendingAmount);
    statistics.formattedOverdueAmount = await formatCurrencyWithSettings(statistics.overdueAmount);

    res.json({
      success: true,
      data: statistics
    });
  } catch (error) {
    console.error('Get student statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching student statistics'
    });
  }
});

module.exports = router;
