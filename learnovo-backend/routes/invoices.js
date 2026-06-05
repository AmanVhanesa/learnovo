const express = require('express');
const mongoose = require('mongoose');
const crypto = require('crypto');
const { body } = require('express-validator');
const FeeInvoice = require('../models/FeeInvoice');
const AnnualFeeAllocation = require('../models/AnnualFeeAllocation');
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
const { applyDateRange } = require('../utils/dateRange');

const planGate = require('../middleware/planGate');
const { syncFeePaymentToIncome } = require('../services/financeAutoSyncService');

const router = express.Router();

/**
 * Helper: Clean up allocation when all its invoices are cancelled.
 * Deletes the AnnualFeeAllocation so invoices can be regenerated.
 */
async function cleanupOrphanedAllocations(tenantId, studentIds, academicSessionId) {
  for (const studentId of studentIds) {
    // Check if any non-cancelled invoices remain for this student+session
    const activeInvoice = await FeeInvoice.findOne({
      tenantId,
      studentId,
      academicSessionId,
      status: { $ne: 'Cancelled' }
    });

    // If no active invoices remain, delete the allocation to allow regeneration
    if (!activeInvoice) {
      await AnnualFeeAllocation.deleteMany({ tenantId, studentId, academicSessionId });
    }
  }
}

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

      // Validate student's class matches fee structure's class
      const fsClassId = String(feeStructure.classId);
      const stuClassId = String(student.classId || '');
      if (feeStructure.classId && student.classId && fsClassId !== stuClassId) {
        return res.status(400).json({
          success: false,
          message: 'Fee structure does not match the student\'s class. Please select the correct fee structure.'
        });
      }

      // Convert feeHeads to items format, filtering out admission fees for imported students
      invoiceItems = [];
      for (const head of feeStructure.feeHeads) {
        // Skip admission fees for imported students or students who already paid
        if (head.isAdmissionFee) {
          if (student.isImported || student.admissionFeePaid) {
            continue;
          }
          // Check if an admission fee invoice already exists for this student
          const existingAdmissionInvoice = await FeeInvoice.findOne({
            tenantId: req.user.tenantId,
            studentId: student._id,
            'items.feeHeadName': head.name,
            status: { $ne: 'Cancelled' }
          });
          if (existingAdmissionInvoice) {
            continue;
          }
        }

        // Capitalize frequency to match FeeInvoice enum
        let frequency = head.frequency || 'one-time';
        if (frequency === 'monthly') frequency = 'Monthly';
        else if (frequency === 'quarterly') frequency = 'Quarterly';
        else if (frequency === 'one-time') frequency = 'One-time';
        else if (frequency === 'annual' || frequency === 'yearly') frequency = 'Annual';
        else if (frequency === 'half-yearly') frequency = 'Annual';

        invoiceItems.push({
          feeHeadName: head.name,
          amount: head.amount,
          frequency: frequency
        });
      }
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

    // Check for duplicate: same student + billing period + academic session (non-cancelled)
    if (billingPeriod && billingPeriod.displayText) {
      const existingInvoice = await FeeInvoice.findOne({
        tenantId: req.user.tenantId,
        studentId,
        academicSessionId,
        'billingPeriod.displayText': billingPeriod.displayText,
        status: { $ne: 'Cancelled' }
      });
      if (existingInvoice) {
        return res.status(409).json({
          success: false,
          message: `An invoice already exists for this student for ${billingPeriod.displayText} (${existingInvoice.invoiceNumber}). Please view or edit the existing invoice instead.`,
          data: { existingInvoiceId: existingInvoice._id, existingInvoiceNumber: existingInvoice.invoiceNumber }
        });
      }
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

    // Mark admissionFeePaid if this invoice contains an admission fee
    if (feeStructureId) {
      const FeeStructure = require('../models/FeeStructure');
      const fs = await FeeStructure.findById(feeStructureId);
      if (fs) {
        const admissionHeadNames = fs.feeHeads.filter(h => h.isAdmissionFee).map(h => h.name);
        const invoiceHasAdmission = invoiceItems.some(item => admissionHeadNames.includes(item.feeHeadName));
        if (invoiceHasAdmission && !student.admissionFeePaid) {
          await User.updateOne({ _id: studentId }, { $set: { admissionFeePaid: true } });
        }
      }
    }

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
    // Handle duplicate key error from unique index (race condition safety net)
    if (error.code === 11000 && error.message?.includes('unique_active_invoice_per_student_period')) {
      return res.status(409).json({
        success: false,
        message: 'An invoice already exists for this student for the selected billing period. Please view or edit the existing invoice instead.'
      });
    }

    // Rollback invoice counter so the number doesn't get skipped
    try {
      const year = new Date().getFullYear();
      const Counter = require('../models/Counter');
      await Counter.rollbackSequence('invoice', String(year), req.user.tenantId);
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
        else if (frequency === 'annual' || frequency === 'yearly') frequency = 'Annual';
        else if (frequency === 'half-yearly') frequency = 'Annual';

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
            // Skip admission fees if an admission fee invoice already exists (any status except Cancelled)
            const existingAdmissionInvoice = await FeeInvoice.findOne({
              tenantId: req.user.tenantId,
              studentId: student._id,
              $or: [
                { 'items.feeHeadName': { $in: admissionFeeHeadNames } },
                { 'billingPeriod.displayText': 'Admission Fee' }
              ],
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

        // Check for duplicate: skip students who already have an active invoice for this period
        let billingPeriod = req.body.billingPeriod;
        if (!billingPeriod || !billingPeriod.displayText) {
          const primaryFrequency = studentItems[0]?.frequency || 'One-time';
          billingPeriod = FeeInvoice.calculateBillingPeriod(new Date(), primaryFrequency);
        }
        if (billingPeriod && billingPeriod.displayText) {
          const existingInvoice = await FeeInvoice.findOne({
            tenantId: req.user.tenantId,
            studentId: student._id,
            academicSessionId,
            'billingPeriod.displayText': billingPeriod.displayText,
            status: { $ne: 'Cancelled' }
          });
          if (existingInvoice) {
            errors.push({
              studentId: student._id,
              studentName: student.name,
              error: `Invoice already exists for ${billingPeriod.displayText} (${existingInvoice.invoiceNumber})`
            });
            continue;
          }
        }

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

        // billingPeriod already computed above for duplicate check

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

        // Mark admissionFeePaid if this invoice includes admission fees
        if (admissionFeeItems.length > 0 && !student.isImported && !student.admissionFeePaid) {
          const invoiceHasAdmission = studentItems.some(item => admissionFeeHeadNames.includes(item.feeHeadName));
          if (invoiceHasAdmission) {
            await User.updateOne({ _id: student._id }, { $set: { admissionFeePaid: true } });
          }
        }

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
      paidAmount: 0 // Only delete invoices with no payments (Pending + Overdue both qualify)
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
          paidAmount: 0,
          studentId: { $in: studentIds }
        };

        logger.info('Bulk delete fallback query', { fallbackQuery });
        invoicesToDelete = await FeeInvoice.find(fallbackQuery);

        // Hard-delete invoices found via fallback
        if (invoicesToDelete.length > 0) {
          const invoiceIds = invoicesToDelete.map(inv => inv._id);
          await FeeInvoice.deleteMany({ _id: { $in: invoiceIds } });
          // Mark as already handled so standard path is skipped
          query._id = { $in: [] };
        }
      }
    } else {
      // Hard-delete matching invoices
      await FeeInvoice.deleteMany(query);
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

    // Clean up allocations for students whose invoices are all cancelled (allows regeneration)
    await cleanupOrphanedAllocations(req.user.tenantId, distinctStudentIds, academicSessionId);

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

    applyDateRange(baseFilter, 'issuedDate', startDate, endDate);

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
        tenantId: req.user.tenantId,
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
      .sort({ issuedDate: -1 })
      .lean();

    // Enrich with feeItems for frontend display (items → feeItems mapping)
    const enriched = invoices.map(inv => ({
      ...inv,
      feeItems: (inv.items || []).map(item => ({
        name: item.feeHeadName,
        amount: item.netAmount || item.periodAmount || item.amount || 0,
        type: item.type,
        frequency: item.frequency
      }))
    }));

    res.json({
      success: true,
      data: enriched
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
      tenantId
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

    // Hard-delete unpaid invoices (matches single-delete behavior at DELETE /:id)
    await FeeInvoice.deleteMany({ _id: { $in: deletableIds } });

    // Update student balances
    const distinctStudents = [...new Set(deletable.map(inv => `${inv.studentId}|${inv.academicSessionId}`))];
    await Promise.all(
      distinctStudents.map(key => {
        const [studentId, academicSessionId] = key.split('|');
        return StudentBalance.updateBalance(tenantId, studentId, academicSessionId);
      })
    );

    // Clean up allocations for students whose invoices are all cancelled (allows regeneration)
    for (const key of distinctStudents) {
      const [studentId, academicSessionId] = key.split('|');
      await cleanupOrphanedAllocations(tenantId, [studentId], academicSessionId);
    }

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
          invoiceIds: deletableIds
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
      skipped
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

    // Hard-delete unpaid invoices so the list doesn't fill with stale cancelled rows.
    // Paid invoices go through the soft-cancel flow via POST /:id/cancel (with payment reversal).
    await FeeInvoice.deleteOne({ _id: invoice._id });

    // Log action (best-effort)
    try {
      await FeeAuditLog.logAction({
        tenantId,
        action: 'INVOICE_DELETED',
        entityType: 'FeeInvoice',
        entityId: invoice._id,
        userId: req.user._id,
        userName: req.user.name,
        userRole: req.user.role,
        details: {
          invoiceNumber,
          totalAmount,
          reason: req.body?.reason || 'Deleted by user'
        },
        ipAddress: req.ip
      });
    } catch (auditErr) {
      console.error('Audit log failed (non-fatal):', auditErr.message);
    }

    // Update student balance
    await StudentBalance.updateBalance(tenantId, studentId, academicSessionId);

    // Clean up allocation if all invoices are now cancelled (allows regeneration)
    await cleanupOrphanedAllocations(tenantId, [studentId], academicSessionId);

    res.json({
      success: true,
      message: 'Invoice deleted successfully'
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
], async(req, res) => {
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
router.delete('/:invoiceId/discount', protect, authorize('admin', 'accountant'), async(req, res) => {
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
  try {
    const { studentId, invoiceId, amount, paymentMethod, paymentDate, transactionDetails, remarks, depositorName } = req.body;
    const tenantId = req.user.tenantId;

    // ── Step 1: Validate invoice ──
    const invoice = await FeeInvoice.findOne({ _id: invoiceId, tenantId });

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    if (invoice.status === 'Paid') {
      return res.status(400).json({ success: false, message: 'This invoice is already fully paid' });
    }

    if (toNumber(amount) > toNumber(invoice.balanceAmount) + 0.01) {
      return res.status(400).json({
        success: false,
        message: `Amount exceeds pending balance of ${roundToRupee(invoice.balanceAmount)}`
      });
    }

    // ── Step 2: Create Payment + Update Invoice (core — must succeed) ──
    const receiptNumber = await Payment.generateReceiptNumber(tenantId);

    const payment = new Payment({
      tenantId,
      studentId,
      invoiceId,
      academicSessionId: invoice.academicSessionId,
      amount,
      paymentMethod,
      paymentDate: new Date(paymentDate),
      transactionDetails: transactionDetails || {},
      remarks,
      depositorName: depositorName ? String(depositorName).trim() : undefined,
      receiptNumber,
      isConfirmed: true,
      confirmedAt: new Date(),
      confirmedBy: req.user._id,
      collectedBy: req.user._id
    });

    await payment.save();

    invoice.paidAmount = roundToRupee(toNumber(invoice.paidAmount) + toNumber(amount));
    await invoice.save();

    // ── Payment is committed — send success response immediately ──
    res.json({
      success: true,
      message: 'Payment collected successfully',
      data: {
        payment: {
          _id: payment._id,
          receiptNumber: payment.receiptNumber,
          amount: payment.amount,
          paymentMethod: payment.paymentMethod,
          paymentDate: payment.paymentDate,
          isConfirmed: payment.isConfirmed
        },
        invoice: {
          _id: invoice._id,
          invoiceNumber: invoice.invoiceNumber,
          totalAmount: invoice.totalAmount,
          paidAmount: invoice.paidAmount,
          balanceAmount: invoice.balanceAmount,
          status: invoice.status
        }
      }
    });

    // ── Step 3: Side-effects (all best-effort, response already sent) ──

    // Create PaymentAttempt + Receipt so student portal shows it
    try {
      const paymentModeMap = { CASH: 'CASH', UPI: 'UPI' };
      const upperMethod = (paymentMethod || '').toUpperCase();
      const resolvedMode = paymentModeMap[upperMethod]
        || (upperMethod.includes('BANK') ? 'BANK_TRANSFER' : 'OTHER');

      const attempt = new PaymentAttempt({
        tenantId,
        idempotencyKey: `admin_${invoiceId}_${payment._id}`,
        studentId,
        invoiceId,
        amount,
        status: 'VERIFIED',
        triggerSource: 'ADMIN_MANUAL',
        paymentMode: resolvedMode,
        transactionRefId: transactionDetails?.referenceNumber || null,
        paymentDate: new Date(paymentDate),
        verifiedBy: req.user._id,
        verifiedAt: new Date()
      });
      await attempt.save();

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
        paymentMode: resolvedMode,
        transactionRefId: transactionDetails?.referenceNumber || null,
        paymentDate: new Date(paymentDate)
      });
      await studentReceipt.save();
    } catch (portalErr) {
      logger.error('PaymentAttempt/Receipt creation failed (non-fatal)', { message: portalErr.message, paymentId: payment._id });
    }

    // Audit log
    try {
      await FeeAuditLog.logAction({
        tenantId, action: 'PAYMENT_COLLECTED', entityType: 'Payment', entityId: payment._id,
        userId: req.user._id, userName: req.user.name || req.user.fullName || 'Admin', userRole: req.user.role,
        details: { invoiceNumber: invoice.invoiceNumber, receiptNumber, amount, paymentMethod, studentId },
        ipAddress: req.ip
      });
    } catch (_) { /* non-fatal */ }

    // Update student balance
    try {
      await StudentBalance.updateBalance(tenantId, studentId, invoice.academicSessionId);
    } catch (_) { /* non-fatal */ }

    // Mark admission fee paid
    if (invoice.status === 'Paid' && invoice.billingPeriod?.displayText === 'Admission Fee') {
      try {
        await User.updateOne({ _id: studentId, tenantId }, { $set: { admissionFeePaid: true } });
      } catch (_) { /* non-fatal */ }
    }

    // Auto-sync to Finance module
    try {
      const student = await User.findById(studentId).select('name fullName').lean();
      await syncFeePaymentToIncome({
        tenantId, paymentId: payment._id, amount, paymentDate: new Date(paymentDate), paymentMethod,
        studentName: student?.fullName || student?.name || 'Student',
        invoiceNumber: invoice.invoiceNumber, addedBy: req.user._id,
        paymentReference: transactionDetails?.referenceNumber || receiptNumber, referenceModel: 'Payment',
        academicSessionId: invoice.academicSessionId
      });
    } catch (_) { /* non-fatal */ }

  } catch (error) {
    logger.error('Collect payment error', { message: error.message, stack: error.stack, code: error.code });

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Duplicate payment detected. This payment may have already been recorded.'
      });
    }

    res.status(500).json({
      success: false,
      message: process.env.NODE_ENV === 'development'
        ? `Payment error: ${error.message}`
        : 'Server error while collecting payment'
    });
  }
});

// @desc    Collect a single payment that settles multiple invoices in one go
// @route   POST /api/invoices/collect-bulk-payment
// @access  Private (Admin, Accountant)
router.post('/collect-bulk-payment', protect, authorize('admin', 'accountant'), [
  body('studentId').notEmpty().withMessage('Student ID is required'),
  body('items').isArray({ min: 1 }).withMessage('At least one invoice is required'),
  body('items.*.invoiceId').notEmpty().withMessage('Invoice ID is required'),
  body('items.*.amount').isNumeric().toFloat().custom(v => v > 0).withMessage('Each amount must be positive'),
  body('paymentMethod').notEmpty().withMessage('Payment method is required'),
  body('paymentDate').isISO8601().withMessage('Valid payment date is required'),
  handleValidationErrors
], async(req, res) => {
  try {
    const { studentId, items, paymentMethod, paymentDate, transactionDetails, remarks, depositorName } = req.body;
    const tenantId = req.user.tenantId;

    const invoiceIds = items.map(i => i.invoiceId);
    const uniqueIds = new Set(invoiceIds.map(String));
    if (uniqueIds.size !== invoiceIds.length) {
      return res.status(400).json({ success: false, message: 'Duplicate invoice in the request' });
    }

    // Load and validate every invoice belongs to this tenant + student and is unpaid
    const invoices = await FeeInvoice.find({ _id: { $in: invoiceIds }, tenantId, studentId });
    if (invoices.length !== items.length) {
      return res.status(404).json({ success: false, message: 'One or more invoices not found' });
    }

    const invoiceById = new Map(invoices.map(inv => [String(inv._id), inv]));
    for (const item of items) {
      const invoice = invoiceById.get(String(item.invoiceId));
      if (invoice.status === 'Paid') {
        return res.status(400).json({ success: false, message: `Invoice ${invoice.invoiceNumber} is already fully paid` });
      }
      if (toNumber(item.amount) > toNumber(invoice.balanceAmount) + 0.01) {
        return res.status(400).json({
          success: false,
          message: `Amount for invoice ${invoice.invoiceNumber} exceeds balance ${roundToRupee(invoice.balanceAmount)}`
        });
      }
    }

    const totalAmount = roundToRupee(items.reduce((sum, i) => sum + toNumber(i.amount), 0));
    const collectedPayments = [];
    const updatedInvoices = [];

    // When multiple invoices are settled in one transaction, stamp every
    // resulting Payment row with a shared transactionGroupId + groupReceiptNumber
    // so a single consolidated receipt PDF can be produced.
    let transactionGroupId = null;
    let groupReceiptNumber = null;
    if (items.length > 1) {
      transactionGroupId = crypto.randomUUID();
      const year = new Date().getFullYear();
      const Counter = require('../models/Counter');
      const seq = await Counter.getNextSequence('group-receipt', String(year), tenantId);
      groupReceiptNumber = `RCP-GRP-${year}-${String(seq).padStart(5, '0')}`;
    }

    // Create a Payment per invoice (Payment.invoiceId is singular)
    for (const item of items) {
      const invoice = invoiceById.get(String(item.invoiceId));
      const amount = toNumber(item.amount);
      const receiptNumber = await Payment.generateReceiptNumber(tenantId);

      const payment = new Payment({
        tenantId,
        studentId,
        invoiceId: invoice._id,
        academicSessionId: invoice.academicSessionId,
        amount,
        paymentMethod,
        paymentDate: new Date(paymentDate),
        transactionDetails: transactionDetails || {},
        remarks,
        depositorName: depositorName ? String(depositorName).trim() : undefined,
        receiptNumber,
        transactionGroupId,
        groupReceiptNumber,
        isConfirmed: true,
        confirmedAt: new Date(),
        confirmedBy: req.user._id,
        collectedBy: req.user._id
      });
      await payment.save();

      invoice.paidAmount = roundToRupee(toNumber(invoice.paidAmount) + amount);
      await invoice.save();

      collectedPayments.push({
        _id: payment._id,
        receiptNumber: payment.receiptNumber,
        amount: payment.amount,
        invoiceId: invoice._id,
        invoiceNumber: invoice.invoiceNumber
      });
      updatedInvoices.push({
        _id: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        totalAmount: invoice.totalAmount,
        paidAmount: invoice.paidAmount,
        balanceAmount: invoice.balanceAmount,
        status: invoice.status
      });
    }

    res.json({
      success: true,
      message: `Collected ${roundToRupee(totalAmount)} across ${items.length} invoice(s)`,
      data: {
        payments: collectedPayments,
        invoices: updatedInvoices,
        totalAmount,
        transactionGroupId,
        groupReceiptNumber
      }
    });

    // ── Side-effects (best-effort, response already sent) ──
    const paymentModeMap = { CASH: 'CASH', UPI: 'UPI' };
    const upperMethod = (paymentMethod || '').toUpperCase();
    const resolvedMode = paymentModeMap[upperMethod]
      || (upperMethod.includes('BANK') ? 'BANK_TRANSFER' : 'OTHER');
    const student = await User.findById(studentId).select('name fullName').lean().catch(() => null);
    const studentName = student?.fullName || student?.name || 'Student';

    for (const cp of collectedPayments) {
      const invoice = invoiceById.get(String(cp.invoiceId));

      try {
        const attempt = new PaymentAttempt({
          tenantId,
          idempotencyKey: `admin_${cp.invoiceId}_${cp._id}`,
          studentId,
          invoiceId: cp.invoiceId,
          amount: cp.amount,
          status: 'VERIFIED',
          triggerSource: 'ADMIN_MANUAL',
          paymentMode: resolvedMode,
          transactionRefId: transactionDetails?.referenceNumber || null,
          paymentDate: new Date(paymentDate),
          verifiedBy: req.user._id,
          verifiedAt: new Date()
        });
        await attempt.save();

        const studentReceiptNum = await Receipt.generateReceiptNumber(tenantId);
        const studentReceipt = new Receipt({
          tenantId,
          paymentAttemptId: attempt._id,
          studentId,
          invoiceId: cp.invoiceId,
          receiptNumber: studentReceiptNum,
          initiatedBy: 'admin',
          verifiedByUserId: req.user._id,
          verifiedByName: req.user.name || req.user.fullName || 'Admin',
          amount: cp.amount,
          paymentMode: resolvedMode,
          transactionRefId: transactionDetails?.referenceNumber || null,
          paymentDate: new Date(paymentDate)
        });
        await studentReceipt.save();
      } catch (portalErr) {
        logger.error('Bulk: PaymentAttempt/Receipt creation failed (non-fatal)', { message: portalErr.message, paymentId: cp._id });
      }

      try {
        await FeeAuditLog.logAction({
          tenantId, action: 'PAYMENT_COLLECTED', entityType: 'Payment', entityId: cp._id,
          userId: req.user._id, userName: req.user.name || req.user.fullName || 'Admin', userRole: req.user.role,
          details: { invoiceNumber: invoice.invoiceNumber, receiptNumber: cp.receiptNumber, amount: cp.amount, paymentMethod, studentId, bulk: true },
          ipAddress: req.ip
        });
      } catch (_) { /* non-fatal */ }

      try {
        await syncFeePaymentToIncome({
          tenantId, paymentId: cp._id, amount: cp.amount, paymentDate: new Date(paymentDate), paymentMethod,
          studentName,
          invoiceNumber: invoice.invoiceNumber, addedBy: req.user._id,
          paymentReference: transactionDetails?.referenceNumber || cp.receiptNumber, referenceModel: 'Payment',
          academicSessionId: invoice.academicSessionId
        });
      } catch (_) { /* non-fatal */ }

      if (invoice.status === 'Paid' && invoice.billingPeriod?.displayText === 'Admission Fee') {
        try {
          await User.updateOne({ _id: studentId, tenantId }, { $set: { admissionFeePaid: true } });
        } catch (_) { /* non-fatal */ }
      }
    }

    // Single balance recalculation for the student's session(s)
    const sessionIds = [...new Set(invoices.map(i => String(i.academicSessionId)))];
    for (const sid of sessionIds) {
      try {
        await StudentBalance.updateBalance(tenantId, studentId, sid);
      } catch (_) { /* non-fatal */ }
    }

  } catch (error) {
    logger.error('Collect bulk payment error', { message: error.message, stack: error.stack, code: error.code });
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Duplicate payment detected.' });
    }
    res.status(500).json({
      success: false,
      message: process.env.NODE_ENV === 'development'
        ? `Payment error: ${error.message}`
        : 'Server error while collecting payment'
    });
  }
});

// @desc    Edit non-financial fields of a payment (method/date/remarks/depositor/txn details)
// @route   PUT /api/invoices/payments/:id
// @access  Private (Admin)
router.put('/payments/:id', protect, authorize('admin'), [
  body('paymentMethod').optional().isIn(['Cash', 'Bank Transfer', 'UPI', 'Cheque', 'Card', 'Online']).withMessage('Invalid payment method'),
  body('paymentDate').optional().isISO8601().withMessage('Valid payment date is required'),
  handleValidationErrors
], async(req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const payment = await Payment.findOne({ _id: req.params.id, tenantId });
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }
    if (payment.isReversed) {
      return res.status(400).json({ success: false, message: 'Cannot edit a reversed payment' });
    }

    const { paymentMethod, paymentDate, remarks, depositorName, transactionDetails } = req.body;
    const update = {};
    if (paymentMethod !== undefined) update.paymentMethod = paymentMethod;
    if (paymentDate !== undefined) update.paymentDate = new Date(paymentDate);
    if (remarks !== undefined) update.remarks = remarks;
    if (depositorName !== undefined) update.depositorName = depositorName ? String(depositorName).trim() : undefined;
    if (transactionDetails !== undefined) update.transactionDetails = transactionDetails || {};

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ success: false, message: 'No editable fields provided' });
    }

    // Bypass pre-save hook (it blocks edits to confirmed payments). These fields are
    // non-financial metadata — no invoice/balance recalculation needed.
    await Payment.updateOne({ _id: payment._id, tenantId }, { $set: update });

    try {
      await FeeAuditLog.logAction({
        tenantId, action: 'PAYMENT_UPDATED', entityType: 'Payment', entityId: payment._id,
        userId: req.user._id, userName: req.user.name || req.user.fullName || 'Admin', userRole: req.user.role,
        details: { receiptNumber: payment.receiptNumber, changes: Object.keys(update) },
        ipAddress: req.ip
      });
    } catch (_) { /* non-fatal */ }

    const updated = await Payment.findById(payment._id)
      .populate({ path: 'studentId', select: 'name fullName admissionNumber studentId classId guardians', populate: { path: 'classId', select: 'name' } })
      .populate('invoiceId', 'invoiceNumber');

    res.json({ success: true, message: 'Payment updated successfully', data: updated });
  } catch (error) {
    logger.error('Update payment error', { message: error.message });
    res.status(500).json({ success: false, message: 'Server error while updating payment' });
  }
});

// @desc    Reverse a confirmed payment (admin correction)
// @route   POST /api/invoices/payments/:id/reverse
// @access  Private (Admin)
router.post('/payments/:id/reverse', protect, authorize('admin'), [
  body('reason').notEmpty().withMessage('Reversal reason is required'),
  handleValidationErrors
], async(req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { reason } = req.body;

    const payment = await Payment.findOne({ _id: req.params.id, tenantId });
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }
    if (payment.isReversed) {
      return res.status(400).json({ success: false, message: 'Payment is already reversed' });
    }
    if (!payment.isConfirmed) {
      return res.status(400).json({ success: false, message: 'Only confirmed payments can be reversed' });
    }

    const originalAmount = toNumber(payment.amount);

    // Use model method: creates a negative reversal Payment record and flips isReversed
    await payment.reverse(req.user._id, reason);

    // Decrement invoice paidAmount so balance reflects reality
    const invoice = await FeeInvoice.findOne({ _id: payment.invoiceId, tenantId });
    if (invoice) {
      invoice.paidAmount = roundToRupee(Math.max(0, toNumber(invoice.paidAmount) - originalAmount));
      await invoice.save();
      try {
        await StudentBalance.updateBalance(tenantId, invoice.studentId, invoice.academicSessionId);
      } catch (_) { /* non-fatal */ }
    }

    try {
      await FeeAuditLog.logAction({
        tenantId, action: 'PAYMENT_REVERSED', entityType: 'Payment', entityId: payment._id,
        userId: req.user._id, userName: req.user.name || req.user.fullName || 'Admin', userRole: req.user.role,
        details: { receiptNumber: payment.receiptNumber, amount: originalAmount, reason },
        ipAddress: req.ip
      });
    } catch (_) { /* non-fatal */ }

    res.json({
      success: true,
      message: 'Payment reversed successfully',
      data: { paymentId: payment._id, invoiceId: payment.invoiceId }
    });
  } catch (error) {
    logger.error('Reverse payment error', { message: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: error.message || 'Server error while reversing payment' });
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

    applyDateRange(filter, 'paymentDate', startDate, endDate);

    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 5000);

    const payments = await Payment.find(filter)
      .populate({ path: 'studentId', select: 'name fullName admissionNumber studentId classId guardians', populate: { path: 'classId', select: 'name' } })
      .populate('invoiceId', 'invoiceNumber periodLabel billingPeriod')
      .populate('collectedBy', 'name')
      .sort({ paymentDate: -1, createdAt: -1 })
      .limit(limit + 1);

    const hasMore = payments.length > limit;
    const data = hasMore ? payments.slice(0, limit) : payments;

    res.json({
      success: true,
      data,
      hasMore
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
      // Institution name from Settings overrides the (possibly stale) Tenant.schoolName
      if (settings.institution.name) schoolData.schoolName = settings.institution.name;
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
        select: 'name fullName admissionNumber studentId class section parentName guardians fatherOrHusbandName classId',
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
      if (settings.institution.name) schoolData.schoolName = settings.institution.name;
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

// @desc    Download a consolidated PDF receipt covering every invoice settled
//          in a single bulk-collection transaction.
// @route   GET /api/invoices/payments/group/:groupId/receipt/pdf
// @access  Private
router.get('/payments/group/:groupId/receipt/pdf', protect, async(req, res) => {
  try {
    const { groupId } = req.params;
    const tenantId = req.user.tenantId;

    const payments = await Payment.find({ tenantId, transactionGroupId: groupId })
      .populate({
        path: 'studentId',
        select: 'name fullName admissionNumber studentId class section parentName guardians fatherOrHusbandName classId',
        populate: { path: 'classId', select: 'name' }
      })
      .populate('invoiceId')
      .populate('collectedBy', 'name')
      .sort({ createdAt: 1 });

    if (!payments.length) {
      return res.status(404).json({ success: false, message: 'Consolidated receipt not found' });
    }

    const tenant = await Tenant.findById(tenantId).select('schoolName schoolCode address phone email logo fullAddress website');
    const settings = await Settings.getSettings(tenantId);
    const schoolData = tenant ? tenant.toObject() : {};
    if (settings && settings.institution) {
      if (settings.institution.name) schoolData.schoolName = settings.institution.name;
      if (settings.institution.contact) {
        if (settings.institution.contact.phone) schoolData.phone = settings.institution.contact.phone;
        if (settings.institution.contact.email) schoolData.email = settings.institution.contact.email;
      }
      if (settings.institution.schoolCode) schoolData.schoolCode = settings.institution.schoolCode;
      if (settings.institution.udiseCode) schoolData.udiseCode = settings.institution.udiseCode;
      if (settings.institution.logo) schoolData.logo = settings.institution.logo;
    }

    const { generateConsolidatedReceiptPdf } = require('../services/receiptPdfService');
    const pdfBuffer = await generateConsolidatedReceiptPdf(payments, schoolData);

    const safeName = (payments[0].groupReceiptNumber || groupId).replace(/[^a-zA-Z0-9-_]/g, '_');
    const filename = `Receipt-${safeName}.pdf`;
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
    console.error('Consolidated receipt PDF error:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Server error generating consolidated receipt PDF' });
    }
  }
});

// @desc    Get payment receipt as printable HTML page
// @route   GET /api/invoices/payments/:id/receipt/html
// @access  Private
router.get('/payments/:id/receipt/html', protect, async(req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId;

    const payment = await Payment.findOne({ _id: id, tenantId })
      .populate({
        path: 'studentId',
        select: 'name fullName admissionNumber studentId class section parentName fatherName guardians fatherOrHusbandName classId',
        populate: { path: 'classId', select: 'name' }
      })
      .populate('invoiceId')
      .populate('collectedBy', 'name');

    if (!payment) {
      return res.status(404).send('Payment not found');
    }

    const tenant = await Tenant.findById(tenantId).select('schoolName schoolCode address phone email logo fullAddress');
    const settings = await Settings.getSettings(tenantId);

    const schoolData = tenant ? tenant.toObject() : {};
    if (settings && settings.institution) {
      if (settings.institution.name) schoolData.schoolName = settings.institution.name;
      if (settings.institution.contact) {
        if (settings.institution.contact.phone) schoolData.phone = settings.institution.contact.phone;
        if (settings.institution.contact.email) schoolData.email = settings.institution.contact.email;
      }
      if (settings.institution.schoolCode) schoolData.schoolCode = settings.institution.schoolCode;
      if (settings.institution.udiseCode) schoolData.udiseCode = settings.institution.udiseCode;
      if (settings.institution.logo) schoolData.logo = settings.institution.logo;
      if (settings.institution.principalSignature) schoolData.principalSignature = settings.institution.principalSignature;
    }

    const { generateReceiptHtml } = require('../services/receiptPdfService');
    const html = await generateReceiptHtml(payment, schoolData);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error) {
    console.error('Receipt HTML error:', error);
    if (!res.headersSent) {
      res.status(500).send('Server error generating receipt');
    }
  }
});

// @desc    Cancel an invoice with reason (proper cancel, not delete)
// @route   POST /api/invoices/:id/cancel
// @access  Private (Admin)
router.post('/:id/cancel', protect, authorize('admin'), [
  body('reason').notEmpty().withMessage('Cancellation reason is required'),
  handleValidationErrors
], async(req, res) => {
  try {
    const { reason } = req.body;
    const tenantId = req.user.tenantId;

    const invoice = await FeeInvoice.findOne({ _id: req.params.id, tenantId });
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    if (invoice.status === 'Cancelled') {
      return res.status(400).json({ success: false, message: 'Invoice is already cancelled' });
    }

    if (invoice.status === 'Paid') {
      return res.status(400).json({ success: false, message: 'Cannot cancel a fully paid invoice. Please reverse payments first.' });
    }

    invoice.status = 'Cancelled';
    invoice.balanceAmount = 0;
    invoice.cancelledAt = new Date();
    invoice.cancelledBy = req.user._id;
    invoice.cancellationReason = reason;
    await invoice.save();

    // Audit
    try {
      await FeeAuditLog.logAction({
        tenantId,
        action: 'INVOICE_CANCELLED',
        entityType: 'FeeInvoice',
        entityId: invoice._id,
        userId: req.user._id,
        userName: req.user.name,
        userRole: req.user.role,
        details: { invoiceNumber: invoice.invoiceNumber, reason },
        ipAddress: req.ip
      });
    } catch (e) { /* non-fatal */ }

    await StudentBalance.updateBalance(tenantId, invoice.studentId, invoice.academicSessionId);

    // Update allocation if linked
    if (invoice.annualAllocationId) {
      try {
        await AnnualFeeAllocation.recalculateFromInvoices(invoice.annualAllocationId);
      } catch (e) { /* non-fatal */ }
    }

    // Clean up allocation if all invoices are now cancelled (allows regeneration)
    await cleanupOrphanedAllocations(tenantId, [invoice.studentId], invoice.academicSessionId);

    res.json({
      success: true,
      message: 'Invoice cancelled successfully',
      data: invoice
    });
  } catch (error) {
    logger.error('Cancel invoice error', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
