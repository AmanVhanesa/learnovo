const express = require('express');
const mongoose = require('mongoose');
const { body, query } = require('express-validator');
const Fee = require('../models/Fee');
const User = require('../models/User');
const Settings = require('../models/Settings');
const { protect, authorize, canAccessFee } = require('../middleware/auth');
const { handleValidationErrors, validateFee } = require('../middleware/validation');
const { formatCurrencyWithSettings } = require('../utils/currency');
const { sendFeeReminder, sendOverdueFeeReminder } = require('../utils/email');
const notificationService = require('../services/notificationService');

const router = express.Router();

// @desc    Get daily fee details (drill-down)
// @route   GET /api/fees/daily
// @access  Private (Admin, Accountant) - Restricted for now
router.get('/daily', protect, [
  query('date').isISO8601().withMessage('Valid date is required (YYYY-MM-DD)')
], handleValidationErrors, async (req, res) => {
  try {
    // Ensure admin or strict permission check
    if (req.user.role !== 'admin' && req.user.role !== 'teacher') { // Assuming teacher/accountant role
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { date } = req.query;
    const tenantId = req.user.tenantId;

    // Set time range for the entire day (00:00:00 to 23:59:59) in local time or UTC as stored
    // Assuming date is passed as YYYY-MM-DD
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const filter = {
      tenantId,
      paidDate: { $gte: startOfDay, $lte: endOfDay },
      status: 'paid'
    };

    // Additional filters
    if (req.query.class) {
      // Need to filter by student's class, so we need aggregation or two-step
      // Simple approach: Fetch fees, populate student, filter in JS. 
      // Better: Aggregation. Let's start with Populate & Filter for simplicity unless scale is huge.
    }

    if (req.query.paymentMethod) {
      filter.paymentMethod = req.query.paymentMethod;
    }

    if (req.query.feeType) {
      filter.feeType = req.query.feeType;
    }

    const fees = await Fee.find(filter)
      .populate('student', 'name admissionNumber class section')
      .sort({ paidDate: -1 });

    // JS Filter for class if needed
    let resultFees = fees;
    if (req.query.class) {
      resultFees = fees.filter(f => f.student?.class === req.query.class);
    }

    const totalCollected = resultFees.reduce((sum, f) => sum + f.amount, 0);

    res.json({
      success: true,
      data: {
        date: date,
        totalCollected,
        count: resultFees.length,
        transactions: resultFees
      }
    });

  } catch (error) {
    console.error('Get daily fees error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @desc    Get all fees
// @route   GET /api/fees
// @access  Private
router.get('/', protect, [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('status').optional().isIn(['pending', 'paid', 'overdue', 'cancelled']).withMessage('Invalid status'),
  query('student').optional().isMongoId().withMessage('Invalid student ID'),
  query('class').optional().trim().notEmpty().withMessage('Class filter cannot be empty'),
  handleValidationErrors
], async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Build filter
    const filter = {};

    // Add tenant filtering - use tenantId on Fee model if available, otherwise filter through students
    if (req.user && req.user.tenantId) {
      // Check if Fee model has tenantId field by looking at recent fees
      const sampleFee = await Fee.findOne({}).select('tenantId').lean();
      if (sampleFee && sampleFee.tenantId) {
        // Fee model has tenantId, filter directly
        filter.tenantId = req.user.tenantId;
      } else {
        // Legacy: filter through students
        const studentsInTenant = await User.find({
          tenantId: req.user.tenantId,
          role: 'student'
        }).select('_id');
        filter.student = { $in: studentsInTenant.map(s => s._id) };
      }
    }

    // Add status filter
    if (req.query.status) {
      filter.status = req.query.status;
    }

    // Add student filter (must be in same tenant)
    if (req.query.student) {
      const student = await User.findById(req.query.student);
      if (student && req.user.tenantId && student.tenantId.toString() === req.user.tenantId.toString()) {
        filter.student = req.query.student;
      } else if (!student || !req.user.tenantId || student.tenantId.toString() !== req.user.tenantId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Student not found or access denied'
        });
      }
    }

    // Add class filter for teachers
    if (req.user.role === 'teacher' && req.user.assignedClasses) {
      const studentsInClass = await User.find({
        role: 'student',
        class: { $in: req.user.assignedClasses }
      }).select('_id');
      filter.student = { $in: studentsInClass.map(s => s._id) };
    }

    // Add class filter from query
    if (req.query.class) {
      const studentsInClass = await User.find({
        role: 'student',
        class: req.query.class
      }).select('_id');
      filter.student = { $in: studentsInClass.map(s => s._id) };
    }

    // For students and parents, only show their own fees
    if (req.user.role === 'student') {
      filter.student = req.user._id;
    } else if (req.user.role === 'parent' && req.user.children) {
      filter.student = { $in: req.user.children };
    }

    // Get fees
    const fees = await Fee.find(filter)
      .populate('student', 'name email phone class studentId rollNumber')
      .sort({ dueDate: -1 })
      .skip(skip)
      .limit(limit);

    // Get total count
    const total = await Fee.countDocuments(filter);

    // Format fees with currency
    const formattedFees = await Promise.all(
      fees.map(async (fee) => ({
        ...fee.toJSON(),
        formattedAmount: await formatCurrencyWithSettings(fee.amount, fee.currency),
        student: fee.student
      }))
    );

    res.json({
      success: true,
      data: formattedFees,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get fees error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching fees'
    });
  }
});

// @desc    Get single fee
// @route   GET /api/fees/:id
// @access  Private
router.get('/:id', protect, canAccessFee, async (req, res) => {
  try {
    const fee = await Fee.findById(req.params.id)
      .populate('student', 'name email phone class studentId rollNumber');

    if (!fee) {
      return res.status(404).json({
        success: false,
        message: 'Fee not found'
      });
    }

    res.json({
      success: true,
      data: {
        ...fee.toJSON(),
        formattedAmount: await formatCurrencyWithSettings(fee.amount, fee.currency),
        student: fee.student
      }
    });
  } catch (error) {
    console.error('Get fee error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching fee'
    });
  }
});

// @desc    Create new fee
// @route   POST /api/fees
// @access  Private (Admin, Teacher)
router.post('/', protect, authorize('admin', 'teacher'), validateFee, handleValidationErrors, async (req, res) => {
  try {
    const {
      student,
      amount,
      currency,
      description,
      dueDate,
      feeType,
      academicYear,
      term,
      notes,
      status,
      paymentMethod,
      paidDate
    } = req.body;

    // Check if student exists and belongs to same tenant
    const studentExists = await User.findById(student);
    if (!studentExists || studentExists.role !== 'student') {
      return res.status(400).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Verify tenant access
    if (req.user.tenantId && studentExists.tenantId.toString() !== req.user.tenantId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Student does not belong to your school'
      });
    }

    // Get system currency if not provided
    let settings;
    try {
      settings = await Settings.getSettings();
    } catch (settingsError) {
      console.warn('Settings error, using defaults:', settingsError.message);
      console.warn('Settings error stack:', settingsError.stack);
      // Use defaults if settings fail
      settings = {
        currency: { default: 'INR' },
        academic: { currentYear: new Date().getFullYear() + '-' + (new Date().getFullYear() + 1) }
      };
    }

    // Handle case where settings might not have all required fields
    const feeCurrency = currency || (settings?.currency?.default || settings?.currency || 'INR');
    const currentYear = new Date().getFullYear();
    const nextYear = currentYear + 1;
    const defaultAcademicYearStr = academicYear ||
      settings?.academic?.currentYear ||
      settings?.settings?.academicYear ||
      `${currentYear}-${nextYear}`;

    const feeCurrencyFinal = typeof feeCurrency === 'string' ? feeCurrency : (feeCurrency?.default || 'INR');
    const defaultAcademicYear = defaultAcademicYearStr.toString();

    // Validate student ID format
    if (!mongoose.Types.ObjectId.isValid(student)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid student ID format'
      });
    }

    // Validate feeType enum
    const validFeeTypes = ['tuition', 'transport', 'library', 'sports', 'exam', 'other'];
    const finalFeeType = feeType && validFeeTypes.includes(feeType.toLowerCase())
      ? feeType.toLowerCase()
      : 'tuition';

    // Validate term enum
    const validTerms = ['1st_term', '2nd_term', '3rd_term', 'annual'];
    const finalTerm = term && validTerms.includes(term.toLowerCase())
      ? term.toLowerCase()
      : 'annual';

    // Validate academic year format
    const academicYearPattern = /^\d{4}-\d{4}$/;
    const finalAcademicYear = academicYear && academicYearPattern.test(academicYear)
      ? academicYear
      : defaultAcademicYear.toString().trim();

    // Validate status
    const validStatuses = ['pending', 'paid', 'overdue', 'cancelled'];
    const finalStatus = status && validStatuses.includes(status.toLowerCase())
      ? status.toLowerCase()
      : 'pending';

    // If status is paid, set payment info
    const paymentInfo = {};
    if (finalStatus === 'paid') {
      const validPaymentMethods = ['cash', 'bank_transfer', 'online', 'cheque', 'other'];
      paymentInfo.paymentMethod = paymentMethod && validPaymentMethods.includes(paymentMethod.toLowerCase())
        ? paymentMethod.toLowerCase()
        : 'cash';
      paymentInfo.paidDate = paidDate ? new Date(paidDate) : new Date();
    }

    // Prepare fee data - mongoose will handle ObjectId conversion
    const feeDataToCreate = {
      tenantId: req.user.tenantId, // Ensure tenantId is included
      student: student,
      amount: parseFloat(amount),
      currency: (feeCurrencyFinal || 'INR').toUpperCase().trim(),
      description: (description || 'Fee payment').trim(),
      dueDate: dueDate ? new Date(dueDate) : new Date(),
      feeType: finalFeeType,
      academicYear: finalAcademicYear,
      term: finalTerm,
      status: finalStatus,
      ...paymentInfo,
      notes: (notes || '').trim()
    };

    console.log('✅ Fee data validated and prepared:', {
      ...feeDataToCreate,
      dueDateType: typeof feeDataToCreate.dueDate,
      dueDateInstance: feeDataToCreate.dueDate instanceof Date
    });

    console.log('Creating fee with data:', feeDataToCreate);
    console.log('Data types:', {
      student: typeof feeDataToCreate.student,
      amount: typeof feeDataToCreate.amount,
      currency: typeof feeDataToCreate.currency,
      description: typeof feeDataToCreate.description,
      dueDate: feeDataToCreate.dueDate instanceof Date,
      feeType: typeof feeDataToCreate.feeType,
      academicYear: typeof feeDataToCreate.academicYear,
      term: typeof feeDataToCreate.term
    });

    // Validate required fields before creating
    if (!feeDataToCreate.student) {
      throw new Error('Student ID is required');
    }
    if (!feeDataToCreate.amount || isNaN(feeDataToCreate.amount) || feeDataToCreate.amount <= 0) {
      throw new Error('Valid amount is required');
    }
    if (!feeDataToCreate.description || feeDataToCreate.description.length < 1) {
      throw new Error('Description is required');
    }
    if (!feeDataToCreate.academicYear || feeDataToCreate.academicYear.length < 1) {
      throw new Error('Academic year is required');
    }
    if (!(feeDataToCreate.dueDate instanceof Date) || isNaN(feeDataToCreate.dueDate.getTime())) {
      throw new Error('Valid due date is required');
    }

    // Create fee
    let fee;
    try {
      console.log('📝 Attempting Fee.create() with data:', JSON.stringify(feeDataToCreate, null, 2));
      fee = await Fee.create(feeDataToCreate);
      console.log('✅ Fee created successfully:', fee._id);
    } catch (createError) {
      console.error('❌ Fee.create() FAILED!');
      console.error('❌ Error name:', createError.name);
      console.error('❌ Error message:', createError.message);
      console.error('❌ Error code:', createError.code);
      console.error('❌ Full error object:', createError);

      if (createError.errors) {
        console.error('❌ Validation errors object:', createError.errors);
        Object.keys(createError.errors).forEach(key => {
          const err = createError.errors[key];
          console.error(`  - ${key}: ${err.message} (kind: ${err.kind}, value: ${err.value})`);
        });
      }

      if (createError.keyPattern) {
        console.error('❌ Duplicate key pattern:', createError.keyPattern);
        console.error('❌ Duplicate key value:', createError.keyValue);
      }

      console.error('❌ Stack trace:', createError.stack);

      // Re-throw to outer catch
      throw createError;
    }

    // Populate student data
    try {
      await fee.populate('student', 'name email phone class studentId rollNumber');
    } catch (populateError) {
      console.warn('Failed to populate student, continuing without population:', populateError.message);
    }

    // Format currency
    let formattedAmount;
    try {
      formattedAmount = await formatCurrencyWithSettings(fee.amount, fee.currency);
    } catch (formatError) {
      console.warn('Failed to format currency, using default:', formatError.message);
      formattedAmount = `${fee.currency} ${fee.amount.toFixed(2)}`;
    }

    // Safely convert fee to JSON
    let feeData;
    try {
      feeData = fee.toJSON();
    } catch (toJsonError) {
      console.error('🚨 Error converting fee to JSON:', toJsonError);
      // Fallback: manually extract fee data
      feeData = {
        _id: fee._id,
        student: fee.student,
        amount: fee.amount,
        currency: fee.currency,
        description: fee.description,
        dueDate: fee.dueDate,
        status: fee.status,
        feeType: fee.feeType,
        academicYear: fee.academicYear,
        term: fee.term,
        createdAt: fee.createdAt,
        updatedAt: fee.updatedAt
      };
    }

    // Send notification about new fee invoice
    try {
      const tenantId = req.user.tenantId;
      if (tenantId && fee.student) {
        await notificationService.notifyFeeInvoiceGenerated(fee, studentExists, tenantId);
      }
    } catch (notifError) {
      console.error('Error sending fee invoice notification:', notifError);
      // Don't fail the request if notification fails
    }

    res.status(201).json({
      success: true,
      message: 'Fee created successfully',
      data: {
        ...feeData,
        formattedAmount: formattedAmount,
        student: fee.student
      }
    });
  } catch (error) {
    console.error('🚨🚨🚨 OUTER CATCH: Create fee error occurred! 🚨🚨🚨');
    console.error('🚨 Error type:', error?.name);
    console.error('🚨 Error message:', error?.message);
    console.error('🚨 Error code:', error?.code);
    console.error('🚨 Full error object:', error);
    console.error('🚨 Error constructor:', error?.constructor?.name);
    console.error('🚨 Is Error instance?', error instanceof Error);

    // Check if response was already sent
    if (res.headersSent) {
      console.error('🚨⚠️ Response already sent! Cannot send error response.');
      return;
    }

    if (error?.errors) {
      console.error('🚨 Error.errors exists! Keys:', Object.keys(error.errors));
      Object.keys(error.errors).forEach(key => {
        console.error(`  🚨 ${key}:`, error.errors[key]);
      });
    } else {
      console.error('🚨 No error.errors property');
    }

    if (error?.keyPattern) {
      console.error('🚨 Duplicate key error detected!');
      console.error('🚨 Key pattern:', error.keyPattern);
      console.error('🚨 Key value:', error.keyValue);
    }

    if (error?.stack) {
      console.error('🚨 Stack trace (first 15 lines):');
      console.error(error.stack.split('\n').slice(0, 15).join('\n'));
    }

    // Handle specific error types
    let statusCode = 500;
    let errorMessage = 'Server error while creating fee';

    if (error?.name === 'ValidationError') {
      statusCode = 400;
      errorMessage = 'Validation error';
      const validationErrors = Object.values(error.errors || {}).map(err => ({
        field: err.path,
        message: err.message
      }));
      console.error('🚨 Returning ValidationError response with', validationErrors.length, 'errors');
      const validationResponse = {
        success: false,
        message: errorMessage,
        error: error?.message || 'Validation error',
        errorName: error?.name || 'ValidationError',
        errorCode: error?.code,
        errors: validationErrors,
        validationErrors: validationErrors
      };
      console.error('🚨 ValidationError response:', JSON.stringify(validationResponse, null, 2));
      return res.status(statusCode).json(validationResponse);
    } else if (error?.name === 'MongoServerError' || error?.name === 'MongoError') {
      statusCode = 409;
      if (error?.code === 11000) {
        const duplicateField = Object.keys(error.keyPattern || {})[0];
        errorMessage = `${duplicateField} already exists`;
      } else {
        errorMessage = error?.message || 'Database error';
      }
    } else if (error?.message) {
      errorMessage = error.message;
    }

    // Build comprehensive error response - FORCE include details
    const errorResponse = {
      success: false,
      message: errorMessage,
      // ALWAYS include these fields
      error: error?.message || String(error) || 'Unknown error',
      errorName: error?.name || error?.constructor?.name || 'UnknownError',
      errorCode: error?.code || undefined,
      // Include request info for debugging
      timestamp: new Date().toISOString()
    };

    // Log what we're including
    console.error('🚨 Error object analysis:', {
      hasMessage: !!error?.message,
      hasName: !!error?.name,
      hasCode: !!error?.code,
      hasErrors: !!error?.errors,
      hasKeyPattern: !!error?.keyPattern,
      errorKeys: error ? Object.keys(error) : ['N/A'],
      errorType: typeof error,
      errorString: String(error)
    });

    // Include detailed validation errors if present
    if (error?.errors && typeof error.errors === 'object' && Object.keys(error.errors).length > 0) {
      errorResponse.validationErrors = Object.keys(error.errors).map(key => ({
        field: key,
        message: error.errors[key]?.message || 'Validation error',
        kind: error.errors[key]?.kind,
        value: error.errors[key]?.value
      }));
      console.error('🚨 Added', errorResponse.validationErrors.length, 'validation errors to response');
    }

    // Include duplicate key info if present
    if (error?.keyPattern || error?.keyValue) {
      errorResponse.duplicateKey = {
        pattern: error.keyPattern,
        value: error.keyValue
      };
      console.error('🚨 Added duplicate key info to response');
    }

    // Always include stack in development
    if (error?.stack) {
      errorResponse.stack = error.stack.split('\n').slice(0, 15).join('\n');
    }

    console.error('🚨🚨🚨 FINAL ERROR RESPONSE BEING SENT:');
    console.error(JSON.stringify(errorResponse, null, 2));
    console.error('🚨 Response status code:', statusCode);
    console.error('🚨 Response headers sent?', res.headersSent);

    try {
      res.status(statusCode).json(errorResponse);
      console.error('🚨✅ Error response sent successfully');
    } catch (sendError) {
      console.error('🚨❌ Error sending error response:', sendError);
      // Last resort - try to send minimal response
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'Error sending error response',
          originalError: error?.message || String(error)
        });
      }
    }
  }
});

// @desc    Update fee
// @route   PUT /api/fees/:id
// @access  Private (Admin, Teacher)
router.put('/:id', protect, authorize('admin', 'teacher'), [
  body('amount').optional().isNumeric().isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
  body('description').optional().trim().isLength({ min: 5, max: 200 }).withMessage('Description must be between 5 and 200 characters'),
  body('dueDate').optional().isISO8601().withMessage('Please provide a valid due date'),
  handleValidationErrors
], async (req, res) => {
  try {
    const fee = await Fee.findById(req.params.id);

    if (!fee) {
      return res.status(404).json({
        success: false,
        message: 'Fee not found'
      });
    }

    // Don't allow updating paid fees
    if (fee.status === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update paid fees'
      });
    }

    // Update fee
    const updatedFee = await Fee.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('student', 'name email phone class studentId rollNumber');

    res.json({
      success: true,
      message: 'Fee updated successfully',
      data: {
        ...updatedFee.toJSON(),
        formattedAmount: await formatCurrencyWithSettings(updatedFee.amount, updatedFee.currency),
        student: updatedFee.student
      }
    });
  } catch (error) {
    console.error('Update fee error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating fee'
    });
  }
});

// @desc    Mark fee as paid
// @route   PUT /api/fees/:id/pay
// @access  Private (Admin, Teacher)
router.put('/:id/pay', protect, authorize('admin', 'teacher'), [
  body('paymentMethod').isIn(['cash', 'bank_transfer', 'online', 'cheque', 'other']).withMessage('Invalid payment method'),
  body('notes').optional().trim().isLength({ max: 500 }).withMessage('Notes must be less than 500 characters'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { paymentMethod, notes } = req.body;

    const fee = await Fee.findById(req.params.id);

    if (!fee) {
      return res.status(404).json({
        success: false,
        message: 'Fee not found'
      });
    }

    if (fee.status === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Fee is already paid'
      });
    }

    // Mark as paid
    await fee.markAsPaid(paymentMethod, notes);

    // Populate student data
    await fee.populate('student', 'name email phone class studentId rollNumber');

    // Send notification about payment received
    try {
      const tenantId = req.user.tenantId;
      if (tenantId && fee.student) {
        await notificationService.notifyFeePaymentReceived(fee, fee.student, tenantId);
      }
    } catch (notifError) {
      console.error('Error sending payment notification:', notifError);
    }

    res.json({
      success: true,
      message: 'Fee marked as paid successfully',
      data: {
        ...fee.toJSON(),
        formattedAmount: await formatCurrencyWithSettings(fee.amount, fee.currency),
        student: fee.student
      }
    });
  } catch (error) {
    console.error('Mark fee as paid error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while marking fee as paid'
    });
  }
});

// @desc    Send fee reminder
// @route   POST /api/fees/:id/remind
// @access  Private (Admin, Teacher)
router.post('/:id/remind', protect, authorize('admin', 'teacher'), async (req, res) => {
  try {
    const fee = await Fee.findById(req.params.id)
      .populate('student', 'name email phone class studentId rollNumber');

    if (!fee) {
      return res.status(404).json({
        success: false,
        message: 'Fee not found'
      });
    }

    if (fee.status === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Cannot send reminder for paid fees'
      });
    }

    // Send reminder email
    let emailResult;
    if (fee.status === 'overdue') {
      emailResult = await sendOverdueFeeReminder(fee.student, fee);
    } else {
      emailResult = await sendFeeReminder(fee.student, fee);
    }

    // Add reminder to fee record
    await fee.addReminder('email', emailResult.success ? 'sent' : 'failed');

    res.json({
      success: true,
      message: 'Fee reminder sent successfully',
      emailResult
    });
  } catch (error) {
    console.error('Send fee reminder error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while sending fee reminder'
    });
  }
});

// @desc    Delete fee
// @route   DELETE /api/fees/:id
// @access  Private (Admin)
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const fee = await Fee.findById(req.params.id);

    if (!fee) {
      return res.status(404).json({
        success: false,
        message: 'Fee not found'
      });
    }

    // Don't allow deleting paid fees
    if (fee.status === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete paid fees'
      });
    }

    // Delete fee
    await Fee.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Fee deleted successfully'
    });
  } catch (error) {
    console.error('Delete fee error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting fee'
    });
  }
});

// @desc    Get fee statistics
// @route   GET /api/fees/statistics
// @access  Private
router.get('/statistics', protect, async (req, res) => {
  try {
    // Build filter based on user role
    const filter = {};

    if (req.user.role === 'teacher' && req.user.assignedClasses) {
      const studentsInClass = await User.find({
        role: 'student',
        class: { $in: req.user.assignedClasses }
      }).select('_id');
      filter.student = { $in: studentsInClass.map(s => s._id) };
    } else if (req.user.role === 'student') {
      filter.student = req.user._id;
    } else if (req.user.role === 'parent' && req.user.children) {
      filter.student = { $in: req.user.children };
    }

    // Get fee statistics
    const totalFees = await Fee.countDocuments(filter);
    const paidFees = await Fee.countDocuments({ ...filter, status: 'paid' });
    const pendingFees = await Fee.countDocuments({ ...filter, status: 'pending' });
    const overdueFees = await Fee.countDocuments({ ...filter, status: 'overdue' });

    // Get amount statistics
    const fees = await Fee.find(filter);
    const totalAmount = fees.reduce((sum, fee) => sum + fee.amount, 0);
    const paidAmount = fees.filter(fee => fee.status === 'paid').reduce((sum, fee) => sum + fee.amount, 0);
    const pendingAmount = fees.filter(fee => fee.status === 'pending').reduce((sum, fee) => sum + fee.amount, 0);
    const overdueAmount = fees.filter(fee => fee.status === 'overdue').reduce((sum, fee) => sum + fee.amount, 0);

    const statistics = {
      counts: {
        total: totalFees,
        paid: paidFees,
        pending: pendingFees,
        overdue: overdueFees
      },
      amounts: {
        total: await formatCurrencyWithSettings(totalAmount),
        paid: await formatCurrencyWithSettings(paidAmount),
        pending: await formatCurrencyWithSettings(pendingAmount),
        overdue: await formatCurrencyWithSettings(overdueAmount)
      },
      rawAmounts: {
        total: totalAmount,
        paid: paidAmount,
        pending: pendingAmount,
        overdue: overdueAmount
      }
    };

    res.json({
      success: true,
      data: statistics
    });
  } catch (error) {
    console.error('Get fee statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching fee statistics'
    });
  }
});

// @desc    Get overdue fees
// @route   GET /api/fees/overdue
// @access  Private
router.get('/overdue', protect, async (req, res) => {
  try {
    // Build filter based on user role
    const filter = { status: 'overdue' };

    if (req.user.role === 'teacher' && req.user.assignedClasses) {
      const studentsInClass = await User.find({
        role: 'student',
        class: { $in: req.user.assignedClasses }
      }).select('_id');
      filter.student = { $in: studentsInClass.map(s => s._id) };
    } else if (req.user.role === 'student') {
      filter.student = req.user._id;
    } else if (req.user.role === 'parent' && req.user.children) {
      filter.student = { $in: req.user.children };
    }

    const overdueFees = await Fee.find(filter)
      .populate('student', 'name email phone class studentId rollNumber')
      .sort({ dueDate: 1 });

    // Format fees with currency
    const formattedFees = await Promise.all(
      overdueFees.map(async (fee) => ({
        ...fee.toJSON(),
        formattedAmount: await formatCurrencyWithSettings(fee.amount, fee.currency),
        student: fee.student
      }))
    );

    res.json({
      success: true,
      data: formattedFees
    });
  } catch (error) {
    console.error('Get overdue fees error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching overdue fees'
    });
  }
});

module.exports = router;
