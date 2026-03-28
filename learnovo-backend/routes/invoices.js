const express = require('express');
const mongoose = require('mongoose');
const { body } = require('express-validator');
const FeeInvoice = require('../models/FeeInvoice');
const Payment = require('../models/Payment');
const StudentBalance = require('../models/StudentBalance');
const FeeAuditLog = require('../models/FeeAuditLog');
const Settings = require('../models/Settings');
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const Receipt = require('../models/Receipt');
const PaymentAttempt = require('../models/PaymentAttempt');
const { protect, authorize } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');
const { logger } = require('../middleware/errorHandler');
const { toNumber, roundToRupee, sumMoney, validateAmount } = require('../utils/money');

const planGate = require('../middleware/planGate');
const { syncFeePaymentToIncome } = require('../services/financeAutoSyncService');

const router = express.Router();

// All invoice routes require fees/finance feature (Basic+)
router.use(planGate.requireActiveSubscription);
router.use(planGate.checkFeesAndFinance);

// @desc    Generate invoice for student
// @route   POST /api/invoices/generate
// @access  Private (Admin, Accountant)
router.post('/generate', protect, authorize('admin', 'accountant'), [
  body('studentId').notEmpty().withMessage('Student ID is required'),
  body('academicSessionId').notEmpty().withMessage('Academic Session ID is required'),
  body('dueDate').isISO8601().withMessage('Valid due date is required'),
  handleValidationErrors
], async(req, res) => {
  try {
    const { studentId, academicSessionId, items, dueDate, feeStructureId, remarks } = req.body;

    // Verify student exists
    const student = await User.findOne({
      _id: studentId,
      tenantId: req.user.tenantId,
      role: 'student'
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Determine invoice items
    let invoiceItems = items;

    // If feeStructureId is provided but no items, fetch fee structure and convert feeHeads to items
    if (feeStructureId && (!items || items.length === 0)) {
      const FeeStructure = require('../models/FeeStructure');
      const feeStructure = await FeeStructure.findOne({
        _id: feeStructureId,
        tenantId: req.user.tenantId
      });

      if (!feeStructure) {
        return res.status(404).json({
          success: false,
          message: 'Fee structure not found'
        });
      }

      // Convert feeHeads to items format
      invoiceItems = feeStructure.feeHeads.map(head => {
        // Capitalize frequency to match FeeInvoice enum
        let frequency = head.frequency || 'one-time';
        if (frequency === 'monthly') frequency = 'Monthly';
        else if (frequency === 'quarterly') frequency = 'Quarterly';
        else if (frequency === 'one-time') frequency = 'One-time';
        else if (frequency === 'annual') frequency = 'Annual';

        return {
          feeHeadName: head.name,
          amount: head.amount,
          frequency: frequency
        };
      });
    }

    // Validate that we have items
    if (!invoiceItems || invoiceItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one fee item is required. Please provide either items array or feeStructureId.'
      });
    }

    // Calculate total and validate each item amount
    for (const item of invoiceItems) {
      validateAmount(item.amount, { field: item.feeHeadName || 'fee item' });
    }
    const totalAmount = sumMoney(invoiceItems.map(item => item.amount));

    // Generate invoice number
    const invoiceNumber = await FeeInvoice.generateInvoiceNumber(req.user.tenantId);

    // Determine classId - use student's classId or find from class name
    let studentClassId = student.classId;
    if (!studentClassId && student.class) {
      const Class = require('../models/Class');
      const classDoc = await Class.findOne({
        name: student.class,
        tenantId: req.user.tenantId
      });

      // Also try matching by grade number
      if (!classDoc) {
        const classList = await Class.find({ tenantId: req.user.tenantId });
        const matchedClass = classList.find(c => {
          const gradeMatch = c.name.match(/(\d+)/);
          return gradeMatch && gradeMatch[1] === student.class;
        });
        if (matchedClass) {
          studentClassId = matchedClass._id;
        }
      } else {
        studentClassId = classDoc._id;
      }
    }

    if (!studentClassId) {
      return res.status(400).json({
        success: false,
        message: 'Unable to determine student class. Please update student record.'
      });
    }

    // Use provided billing period or calculate it
    let billingPeriod = req.body.billingPeriod;
    if (!billingPeriod || !billingPeriod.displayText) {
      // Fallback: Calculate period if not provided
      const primaryFrequency = invoiceItems[0]?.frequency || 'One-time';
      billingPeriod = FeeInvoice.calculateBillingPeriod(new Date(), primaryFrequency);
    }

    // Create invoice
    const invoice = await FeeInvoice.create({
      tenantId: req.user.tenantId,
      invoiceNumber,
      studentId,
      classId: studentClassId,
      sectionId: student.sectionId || null,
      academicSessionId,
      feeStructureId,
      items: invoiceItems,
      totalAmount,
      balanceAmount: totalAmount,
      dueDate,
      billingPeriod,
      remarks,
      generatedBy: req.user._id
    });

    // Log action (best-effort — never fail the response after invoice is created)
    try {
      await FeeAuditLog.logAction({
        tenantId: req.user.tenantId,
        action: 'INVOICE_GENERATED',
        entityType: 'FeeInvoice',
        entityId: invoice._id,
        userId: req.user._id,
        userName: req.user.name,
        userRole: req.user.role,
        details: {
          studentId,
          studentName: student.name,
          invoiceNumber,
          totalAmount
        },
        ipAddress: req.ip
      });
    } catch (auditErr) {
      console.error('Audit log failed (non-fatal):', auditErr.message);
    }

    // Update student balance
    await StudentBalance.updateBalance(req.user.tenantId, studentId, academicSessionId);

    const populated = await FeeInvoice.findById(invoice._id)
      .populate('studentId', 'name studentId admissionNumber phone email')
      .populate('classId', 'name grade')
      .populate('sectionId', 'name')
      .populate('academicSessionId', 'name');

    res.status(201).json({
      success: true,
      message: 'Invoice generated successfully',
      data: populated
    });
  } catch (error) {
    // Rollback invoice counter so the number doesn't get skipped
    try {
      const year = new Date().getFullYear();
      const Counter = require('../models/Counter');
      await Counter.rollbackByName(`invoice_${req.user.tenantId}_${year}`);
    } catch (rollbackErr) {
      console.error('Invoice counter rollback failed:', rollbackErr);
    }

    logger.error('Generate invoice error', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error while generating invoice'
    });
  }
});

// @desc    Bulk generate invoices for class
// @route   POST /api/invoices/generate-bulk
// @access  Private (Admin)
router.post('/generate-bulk', protect, authorize('admin'), [
  body('classId').notEmpty().withMessage('Class ID is required'),
  body('academicSessionId').notEmpty().withMessage('Academic Session ID is required'),
  body('dueDate').isISO8601().withMessage('Valid due date is required'),
  handleValidationErrors
], async(req, res) => {
  try {
    const { classId, sectionId, academicSessionId, items, dueDate, feeStructureId } = req.body;

    logger.info('Bulk invoice generation started', { classId, sectionId, tenantId: req.user.tenantId });

    // Get all students in class/section
    // Support both classId (ObjectId) and class (string) fields
    const query = {
      tenantId: req.user.tenantId,
      role: 'student',
      isActive: true
    };

    // Build $or condition to support both classId and class string
    const classConditions = [{ classId: classId }];

    // Try to get class name from Class model for string matching
    try {
      const Class = require('../models/Class');
      const classDoc = await Class.findOne({
        _id: classId,
        tenantId: req.user.tenantId
      });

      if (classDoc && classDoc.name) {
        classConditions.push({ class: classDoc.name });

        const gradeMatch = classDoc.name.match(/(\d+)/);
        if (gradeMatch) {
          classConditions.push({ class: gradeMatch[1] });
        }
      }
    } catch (error) {
      logger.warn('Could not fetch class document, querying by classId only', { error: error.message });
    }

    query.$or = classConditions;

    if (sectionId) {
      query.sectionId = sectionId;
    }

    const students = await User.find(query);
    logger.info(`Bulk invoice: found ${students.length} students`, { classId });

    if (students.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No students found in the specified class/section'
      });
    }

    // Determine invoice items
    let invoiceItems = items;

    // If feeStructureId is provided but no items, fetch fee structure and convert feeHeads to items
    if (feeStructureId && (!items || items.length === 0)) {
      const FeeStructure = require('../models/FeeStructure');
      const feeStructure = await FeeStructure.findOne({
        _id: feeStructureId,
        tenantId: req.user.tenantId
      });

      if (!feeStructure) {
        return res.status(404).json({
          success: false,
          message: 'Fee structure not found'
        });
      }

      // Convert feeHeads to items format, preserving isAdmissionFee flag
      invoiceItems = feeStructure.feeHeads.map(head => {
        // Capitalize frequency to match FeeInvoice enum
        let frequency = head.frequency || 'one-time';
        if (frequency === 'monthly') frequency = 'Monthly';
        else if (frequency === 'quarterly') frequency = 'Quarterly';
        else if (frequency === 'one-time') frequency = 'One-time';
        else if (frequency === 'annual') frequency = 'Annual';

        return {
          feeHeadName: head.name,
          amount: head.amount,
          frequency: frequency,
          _isAdmissionFee: head.isAdmissionFee || false
        };
      });
    }

    // Validate that we have items
    if (!invoiceItems || invoiceItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one fee item is required. Please provide either items array or feeStructureId.'
      });
    }

    // Separate admission fee items from regular items
    const admissionFeeItems = invoiceItems.filter(item => item._isAdmissionFee);
    const regularItems = invoiceItems.filter(item => !item._isAdmissionFee);
    const admissionFeeHeadNames = admissionFeeItems.map(item => item.feeHeadName);

    // Clean the _isAdmissionFee flag before saving (not in schema)
    const cleanItems = (items) => items.map(({ _isAdmissionFee, ...rest }) => rest);

    // Validate item amounts
    for (const item of invoiceItems) {
      validateAmount(item.amount, { field: item.feeHeadName || 'fee item' });
    }
    const results = [];
    const errors = [];

    for (const student of students) {
      try {
        // Determine which items apply to this student
        let studentItems;

        if (admissionFeeItems.length > 0) {
          // Skip admission fees for imported students
          if (student.isImported) {
            studentItems = cleanItems(regularItems);
          } else if (student.admissionFeePaid) {
            // Skip admission fees if student already paid
            studentItems = cleanItems(regularItems);
          } else {
            // Skip admission fees if an admission fee invoice already exists
            const existingAdmissionInvoice = await FeeInvoice.findOne({
              tenantId: req.user.tenantId,
              studentId: student._id,
              'items.feeHeadName': { $in: admissionFeeHeadNames },
              status: { $ne: 'Cancelled' }
            });

            if (existingAdmissionInvoice) {
              studentItems = cleanItems(regularItems);
            } else {
              studentItems = cleanItems(invoiceItems);
            }
          }
        } else {
          studentItems = cleanItems(invoiceItems);
        }

        // Skip if no items remain after filtering
        if (studentItems.length === 0) continue;

        const studentTotalAmount = sumMoney(studentItems.map(item => item.amount));
        const invoiceNumber = await FeeInvoice.generateInvoiceNumber(req.user.tenantId);

        // Determine classId - use student's classId or find from class name
        let studentClassId = student.classId;
        if (!studentClassId && student.class) {
          // Try to find classId from class name
          const Class = require('../models/Class');
          const classDoc = await Class.findOne({
            name: student.class,
            tenantId: req.user.tenantId
          });
          if (classDoc) {
            studentClassId = classDoc._id;
          }
        }

        // If still no classId, use the provided classId from request
        if (!studentClassId) {
          studentClassId = classId;
        }

        // Use provided billing period or calculate it
        let billingPeriod = req.body.billingPeriod;
        if (!billingPeriod || !billingPeriod.displayText) {
          // Fallback: Calculate period if not provided
          const primaryFrequency = studentItems[0]?.frequency || 'One-time';
          billingPeriod = FeeInvoice.calculateBillingPeriod(new Date(), primaryFrequency);
        }

        const invoice = await FeeInvoice.create({
          tenantId: req.user.tenantId,
          invoiceNumber,
          studentId: student._id,
          classId: studentClassId,
          sectionId: student.sectionId || null,
          academicSessionId,
          feeStructureId,
          items: studentItems,
          totalAmount: studentTotalAmount,
          balanceAmount: studentTotalAmount,
          dueDate,
          billingPeriod,
          generatedBy: req.user._id
        });

        results.push(invoice);

        // Update balance
        await StudentBalance.updateBalance(req.user.tenantId, student._id, academicSessionId);
      } catch (error) {
        errors.push({
          studentId: student._id,
          studentName: student.name,
          error: error.message
        });
      }
    }

    // Log bulk action (best-effort — never fail the response after invoices are created)
    try {
      await FeeAuditLog.logAction({
        tenantId: req.user.tenantId,
        action: 'INVOICE_BULK_GENERATED',
        entityType: 'FeeInvoice',
        entityId: null,
        userId: req.user._id,
        userName: req.user.name,
        userRole: req.user.role,
        details: {
          classId,
          sectionId,
          totalStudents: students.length,
          successCount: results.length,
          errorCount: errors.length
        },
        ipAddress: req.ip
      });
    } catch (auditErr) {
      console.error('Audit log failed (non-fatal):', auditErr.message);
    }

    res.status(201).json({
      success: true,
      message: `Generated ${results.length} invoices successfully`,
      data: {
        generated: results.length,
        errors: errors.length,
        errorDetails: errors
      }
    });
  } catch (error) {
    logger.error('Bulk generate error', error);
    res.status(500).json({
      success: false,
      message: 'Server error while generating bulk invoices'
    });
  }
});

// @desc    Bulk delete invoices for class or all classes
// @route   DELETE /api/invoices/bulk
// @access  Private (Admin)
router.delete('/bulk', protect, authorize('admin'), [
  body('academicSessionId').notEmpty().withMessage('Academic Session ID is required'),
  handleValidationErrors
], async(req, res) => {
  try {
    const { classId, sectionId, academicSessionId, deleteAll } = req.body;
    logger.info('Bulk delete request', { classId, sectionId, academicSessionId, deleteAll });

    const query = {
      tenantId: req.user.tenantId,
      academicSessionId,
      status: 'Pending', // Only delete pending invoices
      paidAmount: 0      // Double check no payments made
    };

    // If deleteAll is true, skip class filtering — delete all pending invoices for the session
    if (!deleteAll) {
      if (!classId) {
        return res.status(400).json({
          success: false,
          message: 'Class ID is required when not deleting all'
        });
      }

      query.classId = classId;

      if (sectionId) {
        query.sectionId = sectionId;
      }
    }

    logger.info('Bulk delete query', { query });

    // Find invoices to be deleted to log them or get count
    let invoicesToDelete = await FeeInvoice.find(query);

    // FALLBACK: If no invoices found by classId, try finding by students in that class
    if (!deleteAll && invoicesToDelete.length === 0 && classId) {
      logger.info('No invoices found by classId directly, trying via student lookup');

      const User = require('../models/User');
      const studentQuery = {
        tenantId: req.user.tenantId,
        role: 'student',
        classId: classId
      };

      if (sectionId) {
        studentQuery.sectionId = sectionId;
      }

      const students = await User.find(studentQuery).select('_id');
      const studentIds = students.map(s => s._id);

      if (studentIds.length > 0) {
        const fallbackQuery = {
          tenantId: req.user.tenantId,
          academicSessionId,
          status: 'Pending',
          paidAmount: 0,
          studentId: { $in: studentIds }
        };

        logger.info('Bulk delete fallback query', { fallbackQuery });
        invoicesToDelete = await FeeInvoice.find(fallbackQuery);

        // Soft delete: cancel invoices found via fallback
        if (invoicesToDelete.length > 0) {
          const invoiceIds = invoicesToDelete.map(inv => inv._id);
          await FeeInvoice.updateMany(
            { _id: { $in: invoiceIds } },
            { $set: { status: 'Cancelled', balanceAmount: 0 } }
          );
          // Mark as already handled so standard path is skipped
          query._id = { $in: [] };
        }
      }
    } else {
      // Soft delete: cancel matching invoices
      await FeeInvoice.updateMany(query, { $set: { status: 'Cancelled', balanceAmount: 0 } });
    }

    const count = invoicesToDelete.length;

    if (count === 0) {
      return res.status(404).json({
        success: false,
        message: deleteAll ? 'No pending invoices found to delete' : 'No pending invoices found to delete for this class'
      });
    }

    // Update balances for all affected students
    const distinctStudentIds = [...new Set(invoicesToDelete.map(inv => inv.studentId.toString()))];

    // Update balances for all affected students in parallel
    await Promise.all(
      distinctStudentIds.map(studentId =>
        StudentBalance.updateBalance(req.user.tenantId, studentId, academicSessionId)
      )
    );

    // Log action (best-effort)
    try {
      await FeeAuditLog.logAction({
        tenantId: req.user.tenantId,
        action: 'INVOICE_BULK_DELETED',
        entityType: 'FeeInvoice',
        entityId: null,
        userId: req.user._id,
        userName: req.user.name,
        userRole: req.user.role,
        details: {
          classId: classId || 'ALL',
          sectionId,
          deleteAll: !!deleteAll,
          count,
          academicSessionId
        },
        ipAddress: req.ip
      });
    } catch (auditErr) {
      console.error('Audit log failed (non-fatal):', auditErr.message);
    }

    res.json({
      success: true,
      message: `Successfully deleted ${count} pending invoices`
    });

  } catch (error) {
    logger.error('Bulk delete error', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting invoices'
    });
  }
});

// @desc    Get all invoices
// @route   GET /api/invoices
// @access  Private (Admin, Accountant)
router.get('/', protect, authorize('admin', 'accountant'), async(req, res) => {
  try {
    const { studentId, classId, status, academicSessionId, startDate, endDate, page, limit, search } = req.query;

    // Base filter WITHOUT status — used for stats so tab counts are always accurate
    const baseFilter = { tenantId: req.user.tenantId };
    if (studentId) baseFilter.studentId = studentId;
    if (classId) baseFilter.classId = classId;
    if (academicSessionId) baseFilter.academicSessionId = academicSessionId;

    if (startDate || endDate) {
      baseFilter.issuedDate = {};
      if (startDate) baseFilter.issuedDate.$gte = new Date(startDate);
      if (endDate) baseFilter.issuedDate.$lte = new Date(endDate);
    }

    // Query filter includes status for the actual data fetch
    const queryFilter = { ...baseFilter };
    if (status) queryFilter.status = status;

    // Stats aggregation — computed WITHOUT status filter so all tab counts are correct
    const tenantObjId = new mongoose.Types.ObjectId(req.user.tenantId);
    const statsFilter = { ...baseFilter, tenantId: tenantObjId };
    if (statsFilter.studentId) statsFilter.studentId = new mongoose.Types.ObjectId(statsFilter.studentId);
    if (statsFilter.classId) statsFilter.classId = new mongoose.Types.ObjectId(statsFilter.classId);
    if (statsFilter.academicSessionId) statsFilter.academicSessionId = new mongoose.Types.ObjectId(statsFilter.academicSessionId);

    const [statsResult] = await FeeInvoice.aggregate([
      { $match: statsFilter },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          totalAmount: { $sum: { $add: ['$totalAmount', { $ifNull: ['$lateFeeApplied', 0] }] } },
          pendingAmount: { $sum: '$balanceAmount' },
          pending: { $sum: { $cond: [{ $eq: ['$status', 'Pending'] }, 1, 0] } },
          partial: { $sum: { $cond: [{ $eq: ['$status', 'Partial'] }, 1, 0] } },
          paid: { $sum: { $cond: [{ $eq: ['$status', 'Paid'] }, 1, 0] } },
          overdue: { $sum: { $cond: [{ $eq: ['$status', 'Overdue'] }, 1, 0] } }
        }
      }
    ]);

    const stats = statsResult || { total: 0, totalAmount: 0, pendingAmount: 0, pending: 0, partial: 0, paid: 0, overdue: 0 };

    // Filtered count for pagination (respects status filter)
    const filteredTotal = status
      ? (stats[status.toLowerCase()] || 0)
      : stats.total;

    // Pagination
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));
    const skip = (pageNum - 1) * limitNum;

    let invoices;
    let paginationTotal = filteredTotal;

    if (search) {
      // Escape regex special chars to prevent ReDoS
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(escaped, 'i');

      // Search by invoice number, student name, or admission number
      const User = require('../models/User');
      const matchingStudents = await User.find({
        tenantId: req.tenant._id,
        $or: [
          { fullName: searchRegex },
          { name: searchRegex },
          { admissionNumber: searchRegex }
        ]
      }).select('_id');
      const studentIds = matchingStudents.map(s => s._id);

      const searchFilter = {
        ...queryFilter,
        $or: [
          { invoiceNumber: searchRegex },
          ...(studentIds.length > 0 ? [{ studentId: { $in: studentIds } }] : [])
        ]
      };

      const searchCount = await FeeInvoice.countDocuments(searchFilter);
      paginationTotal = searchCount;

      invoices = await FeeInvoice.find(searchFilter)
        .populate('studentId', 'name fullName studentId admissionNumber phone email')
        .populate('classId', 'name grade')
        .populate('sectionId', 'name')
        .populate('academicSessionId', 'name')
        .sort({ issuedDate: -1 })
        .skip(skip)
        .limit(limitNum);
    } else {
      invoices = await FeeInvoice.find(queryFilter)
        .populate('studentId', 'name fullName studentId admissionNumber phone email')
        .populate('classId', 'name grade')
        .populate('sectionId', 'name')
        .populate('academicSessionId', 'name')
        .sort({ issuedDate: -1 })
        .skip(skip)
        .limit(limitNum);
    }

    const totalPages = Math.ceil(paginationTotal / limitNum);

    res.json({
      success: true,
      data: invoices,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: paginationTotal,
        pages: totalPages
      },
      stats: {
        total: stats.total,
        totalAmount: stats.totalAmount,
        pendingAmount: stats.pendingAmount,
        pending: stats.pending,
        partial: stats.partial,
        paid: stats.paid,
        overdue: stats.overdue
      }
    });
  } catch (error) {
    logger.error('Get invoices error', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching invoices'
    });
  }
});

// @desc    Get student's invoices
// @route   GET /api/invoices/student/:studentId
// @access  Private (Admin, Accountant)
router.get('/student/:studentId', protect, authorize('admin', 'accountant'), async(req, res) => {
  try {
    const invoices = await FeeInvoice.find({
      tenantId: req.user.tenantId,
      studentId: req.params.studentId
    })
      .populate('academicSessionId', 'name')
      .sort({ issuedDate: -1 });

    res.json({
      success: true,
      data: invoices
    });
  } catch (error) {
    logger.error('Get student invoices error', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching student invoices'
    });
  }
});

// @desc    Update invoice
// @route   PUT /api/invoices/:id
// @access  Private (Admin, Accountant)
router.put('/:id', protect, authorize('admin', 'accountant'), [
  body('items').isArray({ min: 1 }).withMessage('Items array is required'),
  body('items.*.feeHeadName').notEmpty().withMessage('Item name is required'),
  body('items.*.amount').isNumeric().toFloat().withMessage('Item amount is required'),
  body('dueDate').isISO8601().withMessage('Valid due date is required'),
  handleValidationErrors
], async(req, res) => {
  try {
    const { items, dueDate, remarks } = req.body;
    const tenantId = req.user.tenantId;

    const invoice = await FeeInvoice.findById(req.params.id);

    if (!invoice || invoice.tenantId.toString() !== tenantId.toString()) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    // Calculate new total with safe rounding
    const newTotal = sumMoney(items.map(item => item.amount));

    // Validate constraint: Cannot reduce total below paid amount
    if (newTotal < toNumber(invoice.paidAmount)) {
      return res.status(400).json({
        success: false,
        message: `New total (${newTotal}) cannot be less than already paid amount (${invoice.paidAmount})`
      });
    }

    // Prepare items with correct frequency (defaulting if missing)
    const updatedItems = items.map(item => ({
      feeHeadName: item.feeHeadName,
      amount: item.amount,
      frequency: item.frequency || 'One-time'
    }));

    // Update fields
    const oldTotal = invoice.totalAmount;
    invoice.items = updatedItems;
    invoice.totalAmount = newTotal;
    invoice.dueDate = dueDate;
    invoice.remarks = remarks;

    // Recalculate balance and status handled by pre-save hook
    // But explicitly ensuring fields are marked modified if needed
    invoice.markModified('items');

    await invoice.save();

    // Log action (best-effort)
    try {
      await FeeAuditLog.logAction({
        tenantId,
        action: 'INVOICE_UPDATED',
        entityType: 'FeeInvoice',
        entityId: invoice._id,
        userId: req.user._id,
        userName: req.user.name,
        userRole: req.user.role,
        details: {
          invoiceNumber: invoice.invoiceNumber,
          oldTotal,
          newTotal,
          itemsCount: updatedItems.length
        },
        ipAddress: req.ip
      });
    } catch (auditErr) {
      console.error('Audit log failed (non-fatal):', auditErr.message);
    }

    // Update student balance
    await StudentBalance.updateBalance(tenantId, invoice.studentId, invoice.academicSessionId);

    const updatedInvoice = await FeeInvoice.findById(invoice._id)
      .populate('studentId', 'name fullName studentId admissionNumber phone email')
      .populate('classId', 'name grade')
      .populate('sectionId', 'name')
      .populate('academicSessionId', 'name');

    res.json({
      success: true,
      message: 'Invoice updated successfully',
      data: updatedInvoice
    });

  } catch (error) {
    logger.error('Update invoice error', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating invoice'
    });
  }
});

// @desc    Delete multiple invoices by IDs
// @route   DELETE /api/invoices/batch
// @access  Private (Admin)
router.delete('/batch', protect, authorize('admin'), [
  body('invoiceIds').isArray({ min: 1 }).withMessage('At least one invoice ID is required'),
  handleValidationErrors
], async(req, res) => {
  try {
    const { invoiceIds } = req.body;
    const tenantId = req.user.tenantId;

    logger.info('Batch delete request', { count: invoiceIds.length, tenantId });

    // Find all matching invoices for this tenant
    const invoices = await FeeInvoice.find({
      _id: { $in: invoiceIds },
      tenantId,
    });

    if (invoices.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No invoices found'
      });
    }

    // Separate deletable vs non-deletable
    const deletable = invoices.filter(inv => inv.paidAmount === 0);
    const skipped = invoices.length - deletable.length;

    if (deletable.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'None of the selected invoices can be deleted — they all have payments.'
      });
    }

    const deletableIds = deletable.map(inv => inv._id);

    // Soft delete: cancel invoices
    await FeeInvoice.updateMany(
      { _id: { $in: deletableIds } },
      { $set: { status: 'Cancelled', balanceAmount: 0 } }
    );

    // Update student balances
    const distinctStudents = [...new Set(deletable.map(inv => `${inv.studentId}|${inv.academicSessionId}`))];
    await Promise.all(
      distinctStudents.map(key => {
        const [studentId, academicSessionId] = key.split('|');
        return StudentBalance.updateBalance(tenantId, studentId, academicSessionId);
      })
    );

    // Log action (best-effort)
    try {
      await FeeAuditLog.logAction({
        tenantId,
        action: 'INVOICE_BATCH_DELETED',
        entityType: 'FeeInvoice',
        entityId: null,
        userId: req.user._id,
        userName: req.user.name,
        userRole: req.user.role,
        details: {
          count: deletable.length,
          skipped,
          invoiceIds: deletableIds,
        },
        ipAddress: req.ip
      });
    } catch (auditErr) {
      console.error('Audit log failed (non-fatal):', auditErr.message);
    }

    res.json({
      success: true,
      message: `Successfully deleted ${deletable.length} invoice(s)${skipped > 0 ? `. ${skipped} skipped (have payments).` : ''}`,
      deleted: deletable.length,
      skipped,
    });

  } catch (error) {
    logger.error('Batch delete error', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting invoices'
    });
  }
});

// @desc    Delete invoice
// @route   DELETE /api/invoices/:id
// @access  Private (Admin, Accountant)
router.delete('/:id', protect, authorize('admin', 'accountant'), async(req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const invoice = await FeeInvoice.findById(req.params.id);

    if (!invoice || invoice.tenantId.toString() !== tenantId.toString()) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    // Validate constraint: Cannot delete if any payment is made
    if (invoice.paidAmount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete invoice with associated payments. Please reverse payments first.'
      });
    }

    const { studentId, academicSessionId, invoiceNumber, totalAmount } = invoice;

    // Soft delete: Cancel the invoice instead of hard deleting
    // Financial records should never be permanently deleted for audit trail integrity
    invoice.status = 'Cancelled';
    invoice.balanceAmount = 0;
    await invoice.save();

    // Log action (best-effort)
    try {
      await FeeAuditLog.logAction({
        tenantId,
        action: 'INVOICE_CANCELLED',
        entityType: 'FeeInvoice',
        entityId: invoice._id,
        userId: req.user._id,
        userName: req.user.name,
        userRole: req.user.role,
        details: {
          invoiceNumber,
          totalAmount,
          reason: 'Deleted by user'
        },
        ipAddress: req.ip
      });
    } catch (auditErr) {
      console.error('Audit log failed (non-fatal):', auditErr.message);
    }

    // Update student balance
    await StudentBalance.updateBalance(tenantId, studentId, academicSessionId);

    res.json({
      success: true,
      message: 'Invoice cancelled successfully'
    });

  } catch (error) {
    logger.error('Cancel invoice error', error);
    res.status(500).json({
      success: false,
      message: 'Server error while cancelling invoice'
    });
  }
});

// @desc    Apply late fee to invoice
// @route   PUT /api/invoices/:id/apply-late-fee
// @access  Private (Admin, Accountant)
router.put('/:id/apply-late-fee', protect, authorize('admin', 'accountant'), [
  body('amount').isNumeric().custom(v => v > 0).withMessage('Late fee amount must be a positive number'),
  handleValidationErrors
], async(req, res) => {
  try {
    const { amount } = req.body;

    const invoice = await FeeInvoice.findById(req.params.id);

    if (!invoice || invoice.tenantId.toString() !== req.user.tenantId.toString()) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    if (invoice.status === 'Paid') {
      return res.status(400).json({
        success: false,
        message: 'Cannot apply late fee to paid invoice'
      });
    }

    await invoice.applyLateFee(amount);

    // Log action (best-effort)
    try {
      await FeeAuditLog.logAction({
        tenantId: req.user.tenantId,
        action: 'LATE_FEE_APPLIED',
        entityType: 'FeeInvoice',
        entityId: invoice._id,
        userId: req.user._id,
        userName: req.user.name,
        userRole: req.user.role,
        details: {
          invoiceNumber: invoice.invoiceNumber,
          lateFeeAmount: amount
        },
        ipAddress: req.ip
      });
    } catch (auditErr) {
      console.error('Audit log failed (non-fatal):', auditErr.message);
    }

    // Update balance
    await StudentBalance.updateBalance(req.user.tenantId, invoice.studentId, invoice.academicSessionId);

    res.json({
      success: true,
      message: 'Late fee applied successfully',
      data: invoice
    });
  } catch (error) {
    logger.error('Apply late fee error', error);
    res.status(500).json({
      success: false,
      message: 'Server error while applying late fee'
    });
  }
});

// @desc    Apply discount / waiver to an invoice
// @route   POST /api/invoices/:invoiceId/discount
// @access  Private (Admin, Accountant)
router.post('/:invoiceId/discount', protect, authorize('admin', 'accountant'), [
  body('type').notEmpty().withMessage('Discount type is required'),
  body('amount').isNumeric().toFloat().custom(v => v > 0).withMessage('Valid positive amount is required'),
  body('reason').notEmpty().withMessage('Reason is required'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const { type, amount, percentage, reason } = req.body;
    const tenantId = req.user.tenantId;

    const invoice = await FeeInvoice.findOne({ _id: invoiceId, tenantId });
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    if (invoice.status === 'Paid') {
      return res.status(400).json({ success: false, message: 'Cannot apply discount to a fully paid invoice' });
    }

    if (invoice.status === 'Cancelled') {
      return res.status(400).json({ success: false, message: 'Cannot apply discount to a cancelled invoice' });
    }

    if (toNumber(invoice.discountAmount) > 0) {
      return res.status(400).json({ success: false, message: 'A discount has already been applied to this invoice. Remove it first.' });
    }

    const discountAmt = roundToRupee(toNumber(amount));
    if (discountAmt > toNumber(invoice.totalAmount)) {
      return res.status(400).json({ success: false, message: 'Discount cannot exceed the total amount' });
    }

    // Check discount doesn't make the balance negative after existing payments
    const effectiveTotal = toNumber(invoice.totalAmount) + toNumber(invoice.lateFeeApplied) - discountAmt;
    if (toNumber(invoice.paidAmount) > effectiveTotal + 0.01) {
      return res.status(400).json({ success: false, message: 'Discount would make balance negative given existing payments' });
    }

    invoice.discountAmount = discountAmt;
    invoice.discountType = type;
    invoice.discountReason = reason;
    invoice.discountAppliedBy = req.user._id;
    invoice.discountAppliedAt = new Date();

    await invoice.save(); // pre-save hook recalculates balance & status

    // Audit log (best effort)
    try {
      await FeeAuditLog.logAction({
        tenantId,
        action: 'DISCOUNT_APPLIED',
        entityType: 'FeeInvoice',
        entityId: invoice._id,
        userId: req.user._id,
        userName: req.user.name || req.user.fullName || 'Admin',
        userRole: req.user.role,
        details: {
          invoiceNumber: invoice.invoiceNumber,
          discountAmount: discountAmt,
          discountType: type,
          reason,
          percentage: percentage || null
        },
        ipAddress: req.ip
      });
    } catch (auditErr) {
      console.error('Audit log failed (non-fatal):', auditErr.message);
    }

    // Update student balance (best effort)
    try {
      await StudentBalance.updateBalance(tenantId, invoice.studentId, invoice.academicSessionId);
    } catch (balanceErr) {
      console.error('Balance update failed (non-fatal):', balanceErr.message);
    }

    res.json({
      success: true,
      message: 'Discount applied successfully',
      data: invoice
    });
  } catch (error) {
    logger.error('Apply discount error', error);
    res.status(500).json({ success: false, message: 'Server error while applying discount' });
  }
});

// @desc    Remove discount / waiver from an invoice
// @route   DELETE /api/invoices/:invoiceId/discount
// @access  Private (Admin, Accountant)
router.delete('/:invoiceId/discount', protect, authorize('admin', 'accountant'), async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const tenantId = req.user.tenantId;

    const invoice = await FeeInvoice.findOne({ _id: invoiceId, tenantId });
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    if (toNumber(invoice.discountAmount) === 0) {
      return res.status(400).json({ success: false, message: 'No discount to remove' });
    }

    if (invoice.status === 'Cancelled') {
      return res.status(400).json({ success: false, message: 'Cannot modify a cancelled invoice' });
    }

    const previousDiscount = invoice.discountAmount;
    const previousType = invoice.discountType;

    invoice.discountAmount = 0;
    invoice.discountType = undefined;
    invoice.discountReason = undefined;
    invoice.discountAppliedBy = undefined;
    invoice.discountAppliedAt = undefined;

    await invoice.save(); // pre-save hook recalculates balance & status

    // Audit log (best effort)
    try {
      await FeeAuditLog.logAction({
        tenantId,
        action: 'DISCOUNT_REMOVED',
        entityType: 'FeeInvoice',
        entityId: invoice._id,
        userId: req.user._id,
        userName: req.user.name || req.user.fullName || 'Admin',
        userRole: req.user.role,
        details: {
          invoiceNumber: invoice.invoiceNumber,
          removedDiscountAmount: previousDiscount,
          removedDiscountType: previousType
        },
        ipAddress: req.ip
      });
    } catch (auditErr) {
      console.error('Audit log failed (non-fatal):', auditErr.message);
    }

    // Update student balance (best effort)
    try {
      await StudentBalance.updateBalance(tenantId, invoice.studentId, invoice.academicSessionId);
    } catch (balanceErr) {
      console.error('Balance update failed (non-fatal):', balanceErr.message);
    }

    res.json({
      success: true,
      message: 'Discount removed successfully',
      data: invoice
    });
  } catch (error) {
    logger.error('Remove discount error', error);
    res.status(500).json({ success: false, message: 'Server error while removing discount' });
  }
});

// @desc    Collect payment for invoice
// @route   POST /api/invoices/collect-payment
// @access  Private (Admin, Accountant)
router.post('/collect-payment', protect, authorize('admin', 'accountant'), [
  body('studentId').notEmpty().withMessage('Student ID is required'),
  body('invoiceId').notEmpty().withMessage('Invoice ID is required'),
  body('amount').isNumeric().toFloat().custom(v => v > 0).withMessage('Valid positive amount is required'),
  body('paymentMethod').notEmpty().withMessage('Payment method is required'),
  body('paymentDate').isISO8601().withMessage('Valid payment date is required'),
  handleValidationErrors
], async(req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { studentId, invoiceId, amount, paymentMethod, paymentDate, transactionDetails, remarks } = req.body;
    const tenantId = req.user.tenantId;

    // Verify invoice exists (within transaction for consistency)
    const invoice = await FeeInvoice.findOne({
      _id: invoiceId,
      tenantId
    }).session(session);

    if (!invoice) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    if (invoice.status === 'Paid') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'This invoice is already fully paid'
      });
    }

    if (toNumber(amount) > toNumber(invoice.balanceAmount) + 0.01) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: `Amount exceeds pending balance of ${roundToRupee(invoice.balanceAmount)}`
      });
    }

    // Generate receipt number
    const receiptNumber = await Payment.generateReceiptNumber(tenantId);

    // Create Payment
    const payment = new Payment({
      tenantId,
      studentId,
      invoiceId,
      amount,
      paymentMethod,
      paymentDate: new Date(paymentDate),
      transactionDetails,
      remarks,
      receiptNumber,
      isConfirmed: true,
      confirmedAt: new Date(),
      confirmedBy: req.user._id,
      collectedBy: req.user._id
    });

    await payment.save({ session });

    // Update Invoice — use safe rounding; pre-save hook handles balance + status
    invoice.paidAmount = roundToRupee(toNumber(invoice.paidAmount) + toNumber(amount));
    await invoice.save({ session });

    // Create PaymentAttempt + Receipt so student can see it in their portal
    const idempotencyKey = `admin_${invoiceId}_${payment._id}`;
    const attempt = new PaymentAttempt({
      tenantId,
      idempotencyKey,
      studentId,
      invoiceId,
      amount,
      status: 'VERIFIED',
      triggerSource: 'ADMIN_MANUAL',
      paymentMode: paymentMethod?.toUpperCase() === 'CASH' ? 'CASH'
        : paymentMethod?.toUpperCase().includes('UPI') ? 'UPI'
          : paymentMethod?.toUpperCase().includes('BANK') ? 'BANK_TRANSFER'
            : 'OTHER',
      transactionRefId: transactionDetails?.referenceNumber || null,
      paymentDate: new Date(paymentDate),
      verifiedBy: req.user._id,
      verifiedAt: new Date()
    });
    await attempt.save({ session });

    const studentReceiptNum = await Receipt.generateReceiptNumber(tenantId);
    const studentReceipt = new Receipt({
      tenantId,
      paymentAttemptId: attempt._id,
      studentId,
      invoiceId,
      receiptNumber: studentReceiptNum,
      initiatedBy: 'admin',
      verifiedByUserId: req.user._id,
      verifiedByName: req.user.name || req.user.fullName || 'Admin',
      amount,
      paymentMode: attempt.paymentMode,
      transactionRefId: transactionDetails?.referenceNumber || null,
      paymentDate: new Date(paymentDate)
    });
    await studentReceipt.save({ session });

    await session.commitTransaction();
    session.endSession();

    // Audit log (outside transaction — best effort)
    try {
      await FeeAuditLog.logAction({
        tenantId,
        action: 'PAYMENT_COLLECTED',
        entityType: 'Payment',
        entityId: payment._id,
        userId: req.user._id,
        userName: req.user.name || req.user.fullName || 'Admin',
        userRole: req.user.role,
        details: {
          invoiceNumber: invoice.invoiceNumber,
          receiptNumber,
          amount,
          paymentMethod,
          studentId
        },
        ipAddress: req.ip
      });
    } catch (auditErr) {
      console.error('Audit log failed (non-fatal):', auditErr.message);
    }

    // Update student balance (outside transaction — best effort)
    try {
      await StudentBalance.updateBalance(tenantId, studentId, invoice.academicSessionId);
    } catch (balanceErr) {
      console.error('Balance update failed (non-fatal):', balanceErr.message);
    }

    // Auto-sync to Finance module (non-blocking, outside transaction)
    try {
      const student = await User.findById(studentId).select('name fullName').lean();
      await syncFeePaymentToIncome({
        tenantId,
        paymentId: payment._id,
        amount,
        paymentDate: new Date(paymentDate),
        paymentMethod,
        studentName: student?.fullName || student?.name || 'Student',
        invoiceNumber: invoice.invoiceNumber,
        addedBy: req.user._id,
        paymentReference: transactionDetails?.referenceNumber || receiptNumber,
        referenceModel: 'Payment'
      });
    } catch (syncErr) {
      console.error('[Finance-AutoSync] collect-payment sync failed (non-fatal):', syncErr.message);
    }

    res.json({
      success: true,
      message: 'Payment collected successfully',
      data: {
        payment,
        invoice
      }
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    logger.error('Collect payment error', error);
    res.status(500).json({
      success: false,
      message: 'Server error while collecting payment'
    });
  }
});

// @desc    Get payments list
// @route   GET /api/invoices/payments
// @access  Private (Admin, Accountant)
router.get('/payments', protect, authorize('admin', 'accountant'), async(req, res) => {
  try {
    const { studentId, invoiceId, startDate, endDate, paymentMethod } = req.query;
    const tenantId = req.user.tenantId;

    const filter = { tenantId };

    if (studentId) filter.studentId = studentId;
    if (invoiceId) filter.invoiceId = invoiceId;
    if (paymentMethod) filter.paymentMethod = paymentMethod;

    if (startDate || endDate) {
      filter.paymentDate = {};
      if (startDate) filter.paymentDate.$gte = new Date(startDate);
      if (endDate) filter.paymentDate.$lte = new Date(endDate);
    }

    const payments = await Payment.find(filter)
      .populate('studentId', 'name fullName admissionNumber studentId')
      .populate('invoiceId', 'invoiceNumber')
      .populate('collectedBy', 'name')
      .sort({ paymentDate: -1, createdAt: -1 })
      .limit(100);

    res.json({
      success: true,
      data: payments
    });
  } catch (error) {
    logger.error('Get payments error', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching payments'
    });
  }
});

// @desc    Get payment receipt details
// @route   GET /api/invoices/payments/:id/receipt
// @access  Private (Admin, Accountant)
router.get('/payments/:id/receipt', protect, authorize('admin', 'accountant'), async(req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId;

    const payment = await Payment.findOne({ _id: id, tenantId })
      .populate({
        path: 'studentId',
        select: 'name fullName admissionNumber studentId class section parentName address phone email classId',
        populate: { path: 'classId', select: 'name' }
      })
      .populate('invoiceId')
      .populate('collectedBy', 'name');

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    const tenant = await Tenant.findById(tenantId).select('schoolName schoolCode address phone email logo fullAddress website');
    const settings = await Settings.getSettings(tenantId);

    const schoolData = tenant.toObject();
    if (settings && settings.institution) {
      // Add contact information
      if (settings.institution.contact) {
        if (settings.institution.contact.phone) schoolData.phone = settings.institution.contact.phone;
        if (settings.institution.contact.email) schoolData.email = settings.institution.contact.email;
      }
      // Add school code, affiliation number, and UDISE code from Settings
      if (settings.institution.schoolCode) schoolData.schoolCode = settings.institution.schoolCode;
      if (settings.institution.affiliationNumber) schoolData.affiliationNumber = settings.institution.affiliationNumber;
      if (settings.institution.udiseCode) schoolData.udiseCode = settings.institution.udiseCode;
      // Add logo from Settings (overrides Tenant logo if present)
      if (settings.institution.logo) schoolData.logo = settings.institution.logo;
      // Add principal signature
      if (settings.institution.principalSignature) schoolData.principalSignature = settings.institution.principalSignature;
    }

    // Fallback: Calculate billing period for old invoices that don't have it
    if (payment.invoiceId && !payment.invoiceId.billingPeriod?.displayText) {
      // Get the primary fee frequency from invoice items
      const primaryFrequency = payment.invoiceId.items?.[0]?.frequency || 'One-time';
      // Calculate period based on payment date
      const calculatedPeriod = FeeInvoice.calculateBillingPeriod(payment.paymentDate, primaryFrequency);
      // Add it to the invoice object (not saved to DB, just for this response)
      payment.invoiceId.billingPeriod = calculatedPeriod;
    }

    res.json({
      success: true,
      data: {
        payment,
        school: schoolData
      }
    });
  } catch (error) {
    console.error('Get receipt error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching receipt'
    });
  }
});

// @desc    Download payment receipt as PDF
// @route   GET /api/invoices/payments/:id/receipt/pdf
// @access  Private
router.get('/payments/:id/receipt/pdf', protect, async(req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId;

    const payment = await Payment.findOne({ _id: id, tenantId })
      .populate({
        path: 'studentId',
        select: 'name fullName admissionNumber studentId class section parentName classId',
        populate: { path: 'classId', select: 'name' }
      })
      .populate('invoiceId')
      .populate('collectedBy', 'name');

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    const tenant = await Tenant.findById(tenantId).select('schoolName schoolCode address phone email logo fullAddress website');
    const settings = await Settings.getSettings(tenantId);

    const schoolData = tenant ? tenant.toObject() : {};
    if (settings && settings.institution) {
      if (settings.institution.contact) {
        if (settings.institution.contact.phone) schoolData.phone = settings.institution.contact.phone;
        if (settings.institution.contact.email) schoolData.email = settings.institution.contact.email;
      }
      if (settings.institution.schoolCode) schoolData.schoolCode = settings.institution.schoolCode;
      if (settings.institution.udiseCode) schoolData.udiseCode = settings.institution.udiseCode;
      if (settings.institution.logo) schoolData.logo = settings.institution.logo;
      if (settings.institution.principalSignature) schoolData.principalSignature = settings.institution.principalSignature;
    }

    const { generateReceiptPdf } = require('../services/receiptPdfService');
    const pdfBuffer = await generateReceiptPdf(payment, schoolData);

    const filename = `Receipt-${(payment.receiptNumber || id).replace(/[^a-zA-Z0-9-_]/g, '_')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.end(pdfBuffer);

    // Archival to S3 in background
    const { uploadBufferToS3, buildS3Key } = require('../utils/s3Upload');
    const s3Key = buildS3Key('receipts', tenantId, filename);
    uploadBufferToS3(pdfBuffer, s3Key, 'application/pdf')
      .catch(err => console.error(`Background S3 upload failed for receipt ${filename}:`, err.message));

  } catch (error) {
    console.error('Receipt PDF error:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Server error generating receipt PDF' });
    }
  }
});

module.exports = router;

