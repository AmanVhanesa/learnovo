const express = require('express');
const mongoose = require('mongoose');
const { body } = require('express-validator');
const AnnualFeeAllocation = require('../models/AnnualFeeAllocation');
const FeeStructure = require('../models/FeeStructure');
const FeeInvoice = require('../models/FeeInvoice');
const FeeAuditLog = require('../models/FeeAuditLog');
const StudentBalance = require('../models/StudentBalance');
const User = require('../models/User');
const AcademicSession = require('../models/AcademicSession');
const { protect, authorize } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');
const { logger } = require('../middleware/errorHandler');
const { toNumber, roundToRupee, sumMoney, formatRupee } = require('../utils/money');
const {
  generateInvoicesForStudent,
  generateInvoicesForBulk,
  previewInvoiceGeneration,
  generatePeriods
} = require('../services/invoiceGenerationService');

const planGate = require('../middleware/planGate');

const router = express.Router();

router.use(planGate.requireActiveSubscription);
router.use(planGate.checkFeesAndFinance);

/**
 * Helper: Determine which fee heads apply to a student
 */
async function buildStudentFeeHeads(student, feeStructure, tenantId) {
  const allocatedHeads = [];

  for (const head of feeStructure.feeHeads) {
    const entry = {
      feeHeadName: head.name,
      amount: head.amount,
      frequency: head.frequency || 'one-time',
      isCompulsory: !head.isOptional,
      isAdmissionFee: head.isAdmissionFee || false,
      isIncluded: true,
      exclusionReason: null
    };

    // Exclude admission fees for imported students
    if (head.isAdmissionFee && student.isImported) {
      entry.isIncluded = false;
      entry.exclusionReason = 'Imported student — exempt from admission fee';
      allocatedHeads.push(entry);
      continue;
    }

    // Exclude admission fees if already paid
    if (head.isAdmissionFee && student.admissionFeePaid) {
      entry.isIncluded = false;
      entry.exclusionReason = 'Admission fee already paid';
      allocatedHeads.push(entry);
      continue;
    }

    // Exclude admission fees if a prior non-cancelled invoice exists
    if (head.isAdmissionFee) {
      const existingAdmissionInvoice = await FeeInvoice.findOne({
        tenantId,
        studentId: student._id,
        'items.feeHeadName': head.name,
        status: { $ne: 'Cancelled' }
      });
      if (existingAdmissionInvoice) {
        entry.isIncluded = false;
        entry.exclusionReason = 'Admission fee already invoiced';
        allocatedHeads.push(entry);
        continue;
      }
    }

    allocatedHeads.push(entry);
  }

  return allocatedHeads;
}

/**
 * Helper: Calculate annual total from allocated fee heads
 * Accounts for frequency — e.g., monthly fee × 12, quarterly × 4, etc.
 */
function calculateAnnualTotal(allocatedHeads) {
  let total = 0;
  for (const head of allocatedHeads) {
    if (!head.isIncluded) continue;
    const multiplier = getFrequencyMultiplier(head.frequency);
    total += head.amount * multiplier;
  }
  return roundToRupee(total);
}

function getFrequencyMultiplier(frequency) {
  switch (frequency) {
  case 'monthly': return 12;
  case 'quarterly': return 4;
  case 'half-yearly': return 2;
  case 'yearly': return 1;
  case 'one-time': return 1;
  default: return 1;
  }
}

/**
 * @desc    Generate annual allocations for a class or all classes
 * @route   POST /api/fees/allocations/generate
 * @access  Private (Admin)
 */
router.post('/generate', protect, authorize('admin'), [
  body('academicSessionId').notEmpty().withMessage('Academic session is required'),
  body('paymentPlan').optional().isIn(['monthly', 'quarterly', 'half-yearly', 'annual']),
  handleValidationErrors
], async(req, res) => {
  try {
    const { classId, sectionId, academicSessionId, paymentPlan = 'quarterly' } = req.body;
    const tenantId = req.user.tenantId;

    // Find fee structures for the specified class/session (or all classes if classId not provided)
    const fsQuery = {
      tenantId,
      academicSessionId,
      isActive: true
    };
    if (classId) fsQuery.classId = classId;

    const feeStructures = await FeeStructure.find(fsQuery);
    if (feeStructures.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No active fee structures found for the specified session/class'
      });
    }

    const results = [];
    const errors = [];
    const skipped = [];

    for (const fs of feeStructures) {
      // Get students for this class
      const studentQuery = {
        tenantId,
        role: 'student',
        isActive: true
      };

      // Match by classId or class string
      const classConditions = [{ classId: fs.classId }];
      try {
        const Class = require('../models/Class');
        const classDoc = await Class.findById(fs.classId);
        if (classDoc?.name) {
          classConditions.push({ class: classDoc.name });
          const gradeMatch = classDoc.name.match(/(\d+)/);
          if (gradeMatch) classConditions.push({ class: gradeMatch[1] });
        }
      } catch (e) { /* ignore */ }

      studentQuery.$or = classConditions;
      if (sectionId) studentQuery.sectionId = sectionId;
      else if (fs.sectionId) studentQuery.sectionId = fs.sectionId;

      const students = await User.find(studentQuery);

      for (const student of students) {
        try {
          // Check if allocation already exists
          const existing = await AnnualFeeAllocation.findOne({
            tenantId,
            studentId: student._id,
            academicSessionId
          });

          if (existing) {
            skipped.push({
              studentId: student._id,
              studentName: student.name,
              reason: 'Allocation already exists'
            });
            continue;
          }

          // Build fee heads for this student
          const allocatedHeads = await buildStudentFeeHeads(student, fs, tenantId);
          const totalAnnualAmount = calculateAnnualTotal(allocatedHeads);

          if (totalAnnualAmount <= 0) {
            skipped.push({
              studentId: student._id,
              studentName: student.name,
              reason: 'No applicable fee heads'
            });
            continue;
          }

          const allocation = await AnnualFeeAllocation.create({
            tenantId,
            studentId: student._id,
            feeStructureId: fs._id,
            classId: student.classId || fs.classId,
            sectionId: student.sectionId || fs.sectionId || null,
            academicSessionId,
            allocatedFeeHeads: allocatedHeads,
            totalAnnualAmount,
            balance: totalAnnualAmount,
            paymentPlan,
            generatedBy: req.user._id
          });

          // Mark admission fee paid if included
          const hasAdmissionFee = allocatedHeads.some(h => h.isAdmissionFee && h.isIncluded);
          if (hasAdmissionFee && !student.admissionFeePaid) {
            await User.updateOne({ _id: student._id }, { $set: { admissionFeePaid: true } });
          }

          results.push(allocation);
        } catch (err) {
          // Handle duplicate key from unique index
          if (err.code === 11000) {
            skipped.push({
              studentId: student._id,
              studentName: student.name,
              reason: 'Allocation already exists'
            });
          } else {
            errors.push({
              studentId: student._id,
              studentName: student.name,
              error: err.message
            });
          }
        }
      }
    }

    // Audit log
    try {
      await FeeAuditLog.logAction({
        tenantId,
        action: 'ALLOCATION_GENERATED',
        entityType: 'AnnualFeeAllocation',
        entityId: null,
        userId: req.user._id,
        userName: req.user.name,
        userRole: req.user.role,
        details: {
          classId,
          academicSessionId,
          paymentPlan,
          created: results.length,
          skipped: skipped.length,
          errors: errors.length
        },
        ipAddress: req.ip
      });
    } catch (e) { /* non-fatal */ }

    res.status(201).json({
      success: true,
      message: `Generated ${results.length} allocations (${skipped.length} skipped, ${errors.length} errors)`,
      data: {
        created: results.length,
        skipped: skipped.length,
        skippedDetails: skipped,
        errors: errors.length,
        errorDetails: errors
      }
    });
  } catch (error) {
    logger.error('Allocation generation error', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error while generating allocations'
    });
  }
});

/**
 * @desc    Generate invoices from annual allocations based on payment plan
 * @route   POST /api/fees/allocations/generate-invoices
 * @access  Private (Admin)
 */
router.post('/generate-invoices', protect, authorize('admin'), [
  body('academicSessionId').notEmpty().withMessage('Academic session is required'),
  body('dueDate').isISO8601().withMessage('Valid due date is required'),
  handleValidationErrors
], async(req, res) => {
  try {
    const { academicSessionId, classId, dueDate, periods } = req.body;
    const tenantId = req.user.tenantId;

    // Find active allocations
    const allocQuery = {
      tenantId,
      academicSessionId,
      status: 'active'
    };
    if (classId) allocQuery.classId = classId;

    const allocations = await AnnualFeeAllocation.find(allocQuery).populate('studentId', 'name classId sectionId');
    if (allocations.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No active allocations found. Please generate allocations first.'
      });
    }

    const results = [];
    const errors = [];
    const skipped = [];

    for (const alloc of allocations) {
      try {
        const invoicePeriods = periods || generatePeriodsForPlan(alloc.paymentPlan);

        for (const period of invoicePeriods) {
          // Check duplicate
          const existing = await FeeInvoice.findOne({
            tenantId,
            studentId: alloc.studentId._id || alloc.studentId,
            academicSessionId,
            'billingPeriod.displayText': period.displayText,
            status: { $ne: 'Cancelled' }
          });

          if (existing) {
            skipped.push({
              studentName: alloc.studentId.name || 'Unknown',
              period: period.displayText,
              reason: `Invoice already exists (${existing.invoiceNumber})`
            });
            continue;
          }

          // Calculate invoice items and amount for this period
          const { items, totalAmount } = calculatePeriodInvoice(alloc, period);

          if (totalAmount <= 0) continue;

          const invoiceNumber = await FeeInvoice.generateInvoiceNumber(tenantId);

          const invoice = await FeeInvoice.create({
            tenantId,
            invoiceNumber,
            studentId: alloc.studentId._id || alloc.studentId,
            classId: alloc.classId,
            sectionId: alloc.sectionId || null,
            academicSessionId,
            feeStructureId: alloc.feeStructureId,
            annualAllocationId: alloc._id,
            items,
            totalAmount,
            balanceAmount: totalAmount,
            dueDate,
            billingPeriod: period,
            generatedBy: req.user._id
          });

          results.push(invoice);

          // Update student balance
          await StudentBalance.updateBalance(tenantId, alloc.studentId._id || alloc.studentId, academicSessionId);
        }
      } catch (err) {
        if (err.code === 11000) {
          skipped.push({
            studentName: alloc.studentId?.name || 'Unknown',
            reason: 'Duplicate invoice (race condition)'
          });
        } else {
          errors.push({
            studentId: alloc.studentId._id || alloc.studentId,
            studentName: alloc.studentId?.name || 'Unknown',
            error: err.message
          });
        }
      }
    }

    // Audit
    try {
      await FeeAuditLog.logAction({
        tenantId,
        action: 'INVOICE_BULK_GENERATED',
        entityType: 'FeeInvoice',
        entityId: null,
        userId: req.user._id,
        userName: req.user.name,
        userRole: req.user.role,
        details: {
          source: 'annual_allocation',
          academicSessionId,
          created: results.length,
          skipped: skipped.length,
          errors: errors.length
        },
        ipAddress: req.ip
      });
    } catch (e) { /* non-fatal */ }

    res.status(201).json({
      success: true,
      message: `Generated ${results.length} invoices (${skipped.length} skipped, ${errors.length} errors)`,
      data: {
        created: results.length,
        skipped: skipped.length,
        skippedDetails: skipped,
        errors: errors.length,
        errorDetails: errors
      }
    });
  } catch (error) {
    logger.error('Invoice generation from allocations error', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
});

/**
 * Helper: Generate billing periods based on payment plan
 */
function generatePeriodsForPlan(plan, year) {
  const currentYear = year || new Date().getFullYear();

  switch (plan) {
  case 'monthly':
    return Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
      return {
        month,
        year: currentYear,
        displayText: `${monthNames[i]} ${currentYear}`
      };
    });

  case 'quarterly':
    return [
      { quarter: 1, year: currentYear, displayText: `Q1 ${currentYear} (Jan-Mar)` },
      { quarter: 2, year: currentYear, displayText: `Q2 ${currentYear} (Apr-Jun)` },
      { quarter: 3, year: currentYear, displayText: `Q3 ${currentYear} (Jul-Sep)` },
      { quarter: 4, year: currentYear, displayText: `Q4 ${currentYear} (Oct-Dec)` }
    ];

  case 'half-yearly':
    return [
      { quarter: 1, year: currentYear, displayText: `H1 ${currentYear} (Jan-Jun)` },
      { quarter: 3, year: currentYear, displayText: `H2 ${currentYear} (Jul-Dec)` }
    ];

  case 'annual':
    return [
      { year: currentYear, displayText: `Academic Year ${currentYear}-${currentYear + 1}` }
    ];

  default:
    return [
      { quarter: 1, year: currentYear, displayText: `Q1 ${currentYear} (Jan-Mar)` },
      { quarter: 2, year: currentYear, displayText: `Q2 ${currentYear} (Apr-Jun)` },
      { quarter: 3, year: currentYear, displayText: `Q3 ${currentYear} (Jul-Sep)` },
      { quarter: 4, year: currentYear, displayText: `Q4 ${currentYear} (Oct-Dec)` }
    ];
  }
}

/**
 * Helper: Calculate invoice items and total for a specific billing period
 */
function calculatePeriodInvoice(allocation, period) {
  const items = [];
  let totalAmount = 0;
  const planDivisor = getPlanDivisor(allocation.paymentPlan);

  for (const head of allocation.allocatedFeeHeads) {
    if (!head.isIncluded) continue;

    // One-time fees only appear in the first period
    if (head.frequency === 'one-time') {
      const isFirstPeriod = (period.quarter === 1 || period.month === 1 || !period.quarter);
      if (!isFirstPeriod) continue;

      // Capitalize frequency
      items.push({
        feeHeadName: head.feeHeadName,
        amount: head.amount,
        frequency: 'One-time'
      });
      totalAmount += head.amount;
      continue;
    }

    // Calculate per-period amount based on the fee head's frequency and the payment plan
    const annualAmount = head.amount * getFrequencyMultiplier(head.frequency);
    const periodAmount = roundToRupee(annualAmount / planDivisor);

    // Capitalize frequency
    let freq = head.frequency;
    if (freq === 'monthly') freq = 'Monthly';
    else if (freq === 'quarterly') freq = 'Quarterly';
    else if (freq === 'half-yearly') freq = 'Half-yearly';
    else if (freq === 'yearly') freq = 'Annual';
    else if (freq === 'one-time') freq = 'One-time';

    items.push({
      feeHeadName: head.feeHeadName,
      amount: periodAmount,
      frequency: freq
    });
    totalAmount += periodAmount;
  }

  // Apply allocation-level discount proportionally
  if (allocation.totalDiscount > 0 && allocation.totalAnnualAmount > 0) {
    const discountPerPeriod = roundToRupee(allocation.totalDiscount / planDivisor);
    totalAmount = Math.max(0, roundToRupee(totalAmount - discountPerPeriod));
  }

  return { items, totalAmount: roundToRupee(totalAmount) };
}

function getPlanDivisor(plan) {
  switch (plan) {
  case 'monthly': return 12;
  case 'quarterly': return 4;
  case 'half-yearly': return 2;
  case 'annual': return 1;
  default: return 4;
  }
}

/**
 * @desc    List allocations with filters
 * @route   GET /api/fees/allocations
 * @access  Private (Admin, Accountant)
 */
router.get('/', protect, authorize('admin', 'accountant'), async(req, res) => {
  try {
    const { studentId, classId, academicSessionId, status, page = 1, limit = 50 } = req.query;
    const tenantId = req.user.tenantId;

    const query = { tenantId };
    if (studentId) query.studentId = studentId;
    if (classId) query.classId = classId;
    if (academicSessionId) query.academicSessionId = academicSessionId;
    if (status) query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [allocations, total] = await Promise.all([
      AnnualFeeAllocation.find(query)
        .populate('studentId', 'name admissionNumber class classId')
        .populate('classId', 'name grade')
        .populate('feeStructureId', 'feeHeads lateFeeConfig')
        .populate('academicSessionId', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      AnnualFeeAllocation.countDocuments(query)
    ]);

    // Summary stats
    const stats = await AnnualFeeAllocation.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalExpected: { $sum: '$totalAnnualAmount' },
          totalPaid: { $sum: '$totalPaid' },
          totalBalance: { $sum: '$balance' },
          totalWaived: { $sum: '$totalWaived' },
          totalDiscount: { $sum: '$totalDiscount' },
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      data: allocations,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      },
      stats: stats[0] || { totalExpected: 0, totalPaid: 0, totalBalance: 0, totalWaived: 0, totalDiscount: 0, count: 0 }
    });
  } catch (error) {
    logger.error('List allocations error', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * @desc    Get single allocation with full details
 * @route   GET /api/fees/allocations/:id
 * @access  Private (Admin, Accountant)
 */
router.get('/:id', protect, authorize('admin', 'accountant'), async(req, res) => {
  try {
    const allocation = await AnnualFeeAllocation.findOne({
      _id: req.params.id,
      tenantId: req.user.tenantId
    })
      .populate('studentId', 'name admissionNumber class classId email phone')
      .populate('classId', 'name grade')
      .populate('feeStructureId', 'feeHeads lateFeeConfig')
      .populate('academicSessionId', 'name');

    if (!allocation) {
      return res.status(404).json({ success: false, message: 'Allocation not found' });
    }

    // Fetch linked invoices
    const invoices = await FeeInvoice.find({
      tenantId: req.user.tenantId,
      annualAllocationId: allocation._id
    }).sort({ 'billingPeriod.quarter': 1, 'billingPeriod.month': 1 });

    res.json({
      success: true,
      data: { allocation, invoices }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * @desc    Change payment plan for a student
 * @route   PUT /api/fees/allocations/:id/payment-plan
 * @access  Private (Admin)
 */
router.put('/:id/payment-plan', protect, authorize('admin'), [
  body('paymentPlan').isIn(['monthly', 'quarterly', 'half-yearly', 'annual']).withMessage('Invalid payment plan'),
  handleValidationErrors
], async(req, res) => {
  try {
    const { paymentPlan } = req.body;
    const tenantId = req.user.tenantId;

    const allocation = await AnnualFeeAllocation.findOne({
      _id: req.params.id,
      tenantId,
      status: 'active'
    });

    if (!allocation) {
      return res.status(404).json({ success: false, message: 'Active allocation not found' });
    }

    if (allocation.paymentPlan === paymentPlan) {
      return res.status(400).json({ success: false, message: `Payment plan is already set to ${  paymentPlan}` });
    }

    const oldPlan = allocation.paymentPlan;

    // Cancel unpaid future invoices for the old plan
    const unpaidInvoices = await FeeInvoice.find({
      tenantId,
      annualAllocationId: allocation._id,
      status: { $in: ['Pending', 'Overdue'] },
      paidAmount: 0
    });

    const cancelledCount = unpaidInvoices.length;
    for (const inv of unpaidInvoices) {
      inv.status = 'Cancelled';
      await inv.save();
    }

    // Update payment plan
    allocation.paymentPlan = paymentPlan;
    await allocation.save();

    // Audit
    try {
      await FeeAuditLog.logAction({
        tenantId,
        action: 'PAYMENT_PLAN_CHANGED',
        entityType: 'AnnualFeeAllocation',
        entityId: allocation._id,
        userId: req.user._id,
        userName: req.user.name,
        userRole: req.user.role,
        details: {
          studentId: allocation.studentId,
          oldPlan,
          newPlan: paymentPlan,
          cancelledInvoices: cancelledCount
        },
        ipAddress: req.ip
      });
    } catch (e) { /* non-fatal */ }

    res.json({
      success: true,
      message: `Payment plan changed from ${oldPlan} to ${paymentPlan}. ${cancelledCount} unpaid invoices cancelled. Generate new invoices to apply the new plan.`,
      data: allocation
    });
  } catch (error) {
    logger.error('Change payment plan error', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * @desc    Cancel/terminate allocation (e.g., student withdrawal)
 * @route   PUT /api/fees/allocations/:id/cancel
 * @access  Private (Admin)
 */
router.put('/:id/cancel', protect, authorize('admin'), [
  body('reason').notEmpty().withMessage('Cancellation reason is required'),
  handleValidationErrors
], async(req, res) => {
  try {
    const { reason, terminateType = 'cancelled' } = req.body;
    const tenantId = req.user.tenantId;

    const allocation = await AnnualFeeAllocation.findOne({
      _id: req.params.id,
      tenantId,
      status: 'active'
    });

    if (!allocation) {
      return res.status(404).json({ success: false, message: 'Active allocation not found' });
    }

    // Cancel unpaid future invoices
    const unpaidInvoices = await FeeInvoice.find({
      tenantId,
      annualAllocationId: allocation._id,
      status: { $in: ['Pending', 'Overdue'] },
      paidAmount: 0
    });

    for (const inv of unpaidInvoices) {
      inv.status = 'Cancelled';
      await inv.save();
    }

    allocation.status = terminateType === 'terminated' ? 'terminated' : 'cancelled';
    allocation.cancelledAt = new Date();
    allocation.cancelledBy = req.user._id;
    allocation.cancellationReason = reason;
    await allocation.save();

    // Audit
    try {
      await FeeAuditLog.logAction({
        tenantId,
        action: 'ALLOCATION_CANCELLED',
        entityType: 'AnnualFeeAllocation',
        entityId: allocation._id,
        userId: req.user._id,
        userName: req.user.name,
        userRole: req.user.role,
        details: {
          studentId: allocation.studentId,
          reason,
          cancelledInvoices: unpaidInvoices.length
        },
        ipAddress: req.ip
      });
    } catch (e) { /* non-fatal */ }

    res.json({
      success: true,
      message: `Allocation ${allocation.status}. ${unpaidInvoices.length} unpaid invoices cancelled.`,
      data: allocation
    });
  } catch (error) {
    logger.error('Cancel allocation error', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * @desc    Apply discount/scholarship to an allocation
 * @route   PUT /api/fees/allocations/:id/discount
 * @access  Private (Admin)
 */
router.put('/:id/discount', protect, authorize('admin'), [
  body('discountReason').notEmpty().withMessage('Discount reason is required'),
  handleValidationErrors
], async(req, res) => {
  try {
    const { discountPercentage, discountFixed, discountReason } = req.body;
    const tenantId = req.user.tenantId;

    const allocation = await AnnualFeeAllocation.findOne({
      _id: req.params.id,
      tenantId,
      status: 'active'
    });

    if (!allocation) {
      return res.status(404).json({ success: false, message: 'Active allocation not found' });
    }

    if (discountPercentage !== undefined) allocation.discountPercentage = discountPercentage;
    if (discountFixed !== undefined) allocation.discountFixed = discountFixed;
    allocation.discountReason = discountReason;

    await allocation.save(); // pre-save recalculates balance

    res.json({
      success: true,
      message: 'Discount applied successfully',
      data: allocation
    });
  } catch (error) {
    logger.error('Apply discount error', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * @desc    Dashboard summary stats
 * @route   GET /api/fees/allocations/dashboard
 * @access  Private (Admin, Accountant)
 */
router.get('/dashboard/summary', protect, authorize('admin', 'accountant'), async(req, res) => {
  try {
    const { academicSessionId } = req.query;
    const tenantId = req.user.tenantId;

    const matchQuery = { tenantId };
    if (academicSessionId) matchQuery.academicSessionId = new mongoose.Types.ObjectId(academicSessionId);

    // Allocation-level stats
    const allocationStats = await AnnualFeeAllocation.aggregate([
      { $match: { ...matchQuery, status: { $in: ['active', 'completed'] } } },
      {
        $group: {
          _id: null,
          totalExpectedRevenue: { $sum: '$totalAnnualAmount' },
          totalCollected: { $sum: '$totalPaid' },
          totalOutstanding: { $sum: '$balance' },
          totalDiscounts: { $sum: '$totalDiscount' },
          totalWaivers: { $sum: '$totalWaived' },
          studentCount: { $sum: 1 }
        }
      }
    ]);

    // Invoice-level stats for overdue
    const overdueStats = await FeeInvoice.aggregate([
      {
        $match: {
          tenantId: new mongoose.Types.ObjectId(tenantId),
          status: 'Overdue',
          ...(academicSessionId ? { academicSessionId: new mongoose.Types.ObjectId(academicSessionId) } : {})
        }
      },
      {
        $group: {
          _id: null,
          totalOverdue: { $sum: '$balanceAmount' },
          overdueCount: { $sum: 1 }
        }
      }
    ]);

    // Per-class breakdown
    const classBreakdown = await AnnualFeeAllocation.aggregate([
      { $match: { ...matchQuery, status: { $in: ['active', 'completed'] } } },
      {
        $lookup: {
          from: 'classes',
          localField: 'classId',
          foreignField: '_id',
          as: 'classInfo'
        }
      },
      { $unwind: { path: '$classInfo', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$classId',
          className: { $first: '$classInfo.name' },
          totalExpected: { $sum: '$totalAnnualAmount' },
          totalCollected: { $sum: '$totalPaid' },
          totalOutstanding: { $sum: '$balance' },
          studentCount: { $sum: 1 }
        }
      },
      { $sort: { className: 1 } }
    ]);

    const stats = allocationStats[0] || {
      totalExpectedRevenue: 0, totalCollected: 0, totalOutstanding: 0,
      totalDiscounts: 0, totalWaivers: 0, studentCount: 0
    };

    const overdue = overdueStats[0] || { totalOverdue: 0, overdueCount: 0 };

    res.json({
      success: true,
      data: {
        totalExpectedRevenue: stats.totalExpectedRevenue,
        totalCollected: stats.totalCollected,
        totalOutstanding: stats.totalOutstanding,
        totalOverdue: overdue.totalOverdue,
        overdueInvoiceCount: overdue.overdueCount,
        totalDiscounts: stats.totalDiscounts,
        totalWaivers: stats.totalWaivers,
        studentCount: stats.studentCount,
        collectionRate: stats.totalExpectedRevenue > 0
          ? Math.round((stats.totalCollected / stats.totalExpectedRevenue) * 100)
          : 0,
        classBreakdown
      }
    });
  } catch (error) {
    logger.error('Dashboard summary error', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * @desc    Generate allocation for a mid-year admission (single student)
 * @route   POST /api/fees/allocations/mid-year
 * @access  Private (Admin)
 *
 * Only generates invoices from the student's admission quarter/month onward.
 */
router.post('/mid-year', protect, authorize('admin'), [
  body('studentId').notEmpty().withMessage('Student ID is required'),
  body('academicSessionId').notEmpty().withMessage('Academic session is required'),
  body('startFromMonth').optional().isInt({ min: 1, max: 12 }),
  body('dueDate').isISO8601().withMessage('Valid due date is required'),
  handleValidationErrors
], async(req, res) => {
  try {
    const { studentId, academicSessionId, paymentPlan = 'quarterly', startFromMonth, dueDate } = req.body;
    const tenantId = req.user.tenantId;

    const student = await User.findOne({ _id: studentId, tenantId, role: 'student' });
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    // Check existing allocation
    const existing = await AnnualFeeAllocation.findOne({ tenantId, studentId, academicSessionId });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Allocation already exists for this student and session' });
    }

    // Find fee structure for student's class
    const studentClassId = student.classId;
    if (!studentClassId) {
      return res.status(400).json({ success: false, message: 'Student has no class assigned' });
    }

    const feeStructure = await FeeStructure.findOne({
      tenantId,
      classId: studentClassId,
      academicSessionId,
      isActive: true
    });

    if (!feeStructure) {
      return res.status(404).json({ success: false, message: 'No fee structure found for student\'s class' });
    }

    // Build fee heads
    const allocatedHeads = await buildStudentFeeHeads(student, feeStructure, tenantId);
    const totalAnnualAmount = calculateAnnualTotal(allocatedHeads);

    if (totalAnnualAmount <= 0) {
      return res.status(400).json({ success: false, message: 'No applicable fee heads for this student' });
    }

    const allocation = await AnnualFeeAllocation.create({
      tenantId,
      studentId,
      feeStructureId: feeStructure._id,
      classId: studentClassId,
      sectionId: student.sectionId || null,
      academicSessionId,
      allocatedFeeHeads: allocatedHeads,
      totalAnnualAmount,
      balance: totalAnnualAmount,
      paymentPlan,
      generatedBy: req.user._id
    });

    // Mark admission fee paid if included
    const hasAdmission = allocatedHeads.some(h => h.isAdmissionFee && h.isIncluded);
    if (hasAdmission && !student.admissionFeePaid) {
      await User.updateOne({ _id: studentId }, { $set: { admissionFeePaid: true } });
    }

    // Generate invoices only from the start month onward
    const admissionMonth = startFromMonth || (student.createdAt ? new Date(student.createdAt).getMonth() + 1 : new Date().getMonth() + 1);
    const allPeriods = generatePeriodsForPlan(paymentPlan);

    // Filter periods to only include those on or after the admission month
    const applicablePeriods = allPeriods.filter(period => {
      if (period.month) return period.month >= admissionMonth;
      if (period.quarter) {
        const quarterStartMonth = (period.quarter - 1) * 3 + 1;
        return quarterStartMonth + 2 >= admissionMonth; // Include if quarter overlaps
      }
      return true; // annual / one-time
    });

    const invoiceResults = [];
    for (const period of applicablePeriods) {
      try {
        const { items, totalAmount } = calculatePeriodInvoice(allocation, period);
        if (totalAmount <= 0) continue;

        const invoiceNumber = await FeeInvoice.generateInvoiceNumber(tenantId);
        const invoice = await FeeInvoice.create({
          tenantId,
          invoiceNumber,
          studentId,
          classId: studentClassId,
          sectionId: student.sectionId || null,
          academicSessionId,
          feeStructureId: feeStructure._id,
          annualAllocationId: allocation._id,
          items,
          totalAmount,
          balanceAmount: totalAmount,
          dueDate,
          billingPeriod: period,
          generatedBy: req.user._id
        });
        invoiceResults.push(invoice);
      } catch (err) {
        if (err.code !== 11000) throw err; // Ignore duplicates
      }
    }

    await StudentBalance.updateBalance(tenantId, studentId, academicSessionId);

    res.status(201).json({
      success: true,
      message: `Mid-year allocation created. ${invoiceResults.length} invoices generated from month ${admissionMonth}.`,
      data: { allocation, invoices: invoiceResults }
    });
  } catch (error) {
    logger.error('Mid-year admission allocation error', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
});

/**
 * @desc    Waive specific fee heads for a student's allocation
 * @route   PUT /api/fees/allocations/:id/waive
 * @access  Private (Admin)
 */
router.put('/:id/waive', protect, authorize('admin'), [
  body('feeHeadNames').isArray({ min: 1 }).withMessage('At least one fee head name is required'),
  body('reason').notEmpty().withMessage('Waiver reason is required'),
  handleValidationErrors
], async(req, res) => {
  try {
    const { feeHeadNames, reason } = req.body;
    const tenantId = req.user.tenantId;

    const allocation = await AnnualFeeAllocation.findOne({
      _id: req.params.id,
      tenantId,
      status: 'active'
    });

    if (!allocation) {
      return res.status(404).json({ success: false, message: 'Active allocation not found' });
    }

    let waivedTotal = 0;
    for (const head of allocation.allocatedFeeHeads) {
      if (feeHeadNames.includes(head.feeHeadName) && head.isIncluded) {
        head.isIncluded = false;
        head.exclusionReason = `Waived: ${reason}`;
        waivedTotal += head.amount * getFrequencyMultiplier(head.frequency);
      }
    }

    allocation.totalWaived = roundToRupee(toNumber(allocation.totalWaived) + waivedTotal);
    await allocation.save();

    // Audit
    try {
      await FeeAuditLog.logAction({
        tenantId,
        action: 'FEE_WAIVER_APPLIED',
        entityType: 'AnnualFeeAllocation',
        entityId: allocation._id,
        userId: req.user._id,
        userName: req.user.name,
        userRole: req.user.role,
        details: { studentId: allocation.studentId, feeHeadNames, reason, waivedAmount: waivedTotal },
        ipAddress: req.ip
      });
    } catch (e) { /* non-fatal */ }

    res.json({
      success: true,
      message: `${feeHeadNames.length} fee head(s) waived. Total waived: ${formatRupee(waivedTotal)}`,
      data: allocation
    });
  } catch (error) {
    logger.error('Waive fee heads error', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * @desc    Apply late fees to overdue invoices
 * @route   POST /api/fees/allocations/apply-late-fees
 * @access  Private (Admin)
 *
 * Scans all overdue invoices and applies late fees based on their fee structure's config.
 */
router.post('/apply-late-fees', protect, authorize('admin'), [
  body('academicSessionId').notEmpty().withMessage('Academic session is required'),
  handleValidationErrors
], async(req, res) => {
  try {
    const { academicSessionId, classId } = req.body;
    const tenantId = req.user.tenantId;

    const invoiceQuery = {
      tenantId,
      academicSessionId,
      status: 'Overdue',
      lateFeeApplied: 0 // Only apply once
    };
    if (classId) invoiceQuery.classId = classId;

    const overdueInvoices = await FeeInvoice.find(invoiceQuery).populate('feeStructureId');
    let applied = 0;
    const errors = [];

    for (const invoice of overdueInvoices) {
      try {
        const lateFeeConfig = invoice.feeStructureId?.lateFeeConfig;
        if (!lateFeeConfig?.enabled) continue;

        // Check grace period
        const daysPastDue = Math.floor((new Date() - new Date(invoice.dueDate)) / (1000 * 60 * 60 * 24));
        if (daysPastDue <= (lateFeeConfig.gracePeriodDays || 0)) continue;

        let lateFeeAmount;
        if (lateFeeConfig.type === 'percentage') {
          lateFeeAmount = roundToRupee(toNumber(invoice.totalAmount) * toNumber(lateFeeConfig.amount) / 100);
        } else {
          lateFeeAmount = toNumber(lateFeeConfig.amount);
        }

        if (lateFeeAmount > 0) {
          await invoice.applyLateFee(lateFeeAmount);
          applied++;
        }
      } catch (err) {
        errors.push({ invoiceId: invoice._id, error: err.message });
      }
    }

    res.json({
      success: true,
      message: `Late fees applied to ${applied} invoices (${overdueInvoices.length - applied} skipped, ${errors.length} errors)`,
      data: { applied, total: overdueInvoices.length, errors }
    });
  } catch (error) {
    logger.error('Apply late fees error', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ============================================================================
// NEW ENDPOINTS — Using invoice generation service (annual_amount architecture)
// ============================================================================

/**
 * @desc    Preview invoice generation for a class (dry run)
 * @route   POST /api/fees/allocations/preview
 * @access  Private (Admin)
 */
router.post('/preview', protect, authorize('admin'), [
  body('academicSessionId').notEmpty().withMessage('Academic session is required'),
  body('paymentPlan').isIn(['monthly', 'quarterly', 'half-yearly', 'annual']).withMessage('Invalid payment plan'),
  handleValidationErrors
], async(req, res) => {
  try {
    const { classId, sectionId, academicSessionId, paymentPlan } = req.body;
    const tenantId = req.user.tenantId;

    // Get academic session name for period generation
    const session = await AcademicSession.findById(academicSessionId);
    if (!session) return res.status(404).json({ success: false, message: 'Academic session not found' });

    // Find fee structures
    const fsQuery = { tenantId, academicSessionId, isActive: true };
    if (classId) fsQuery.classId = classId;

    const feeStructures = await FeeStructure.find(fsQuery);
    if (feeStructures.length === 0) {
      return res.status(404).json({ success: false, message: 'No active fee structures found' });
    }

    const allPreviews = [];

    for (const fs of feeStructures) {
      // Get students for this class
      const studentQuery = { tenantId, role: 'student', isActive: true };
      const classConditions = [{ classId: fs.classId }];
      try {
        const Class = require('../models/Class');
        const classDoc = await Class.findById(fs.classId);
        if (classDoc?.name) {
          classConditions.push({ class: classDoc.name });
          const gradeMatch = classDoc.name.match(/(\d+)/);
          if (gradeMatch) classConditions.push({ class: gradeMatch[1] });
        }
      } catch (e) { /* ignore */ }
      studentQuery.$or = classConditions;
      if (sectionId) studentQuery.sectionId = sectionId;

      const students = await User.find(studentQuery);

      const previews = await previewInvoiceGeneration({
        tenantId,
        students,
        feeStructure: fs,
        paymentPlan,
        academicYearName: session.name,
        academicSessionId
      });

      allPreviews.push(...previews);
    }

    // Summary
    const totalStudents = allPreviews.length;
    const newStudents = allPreviews.filter(p => p.isNew).length;
    const importedStudents = allPreviews.filter(p => p.isImported).length;
    const alreadyAllocated = allPreviews.filter(p => p.hasExistingAllocation).length;
    const totalExpected = sumMoney(allPreviews.filter(p => !p.hasExistingAllocation).map(p => p.totalAnnual));

    res.json({
      success: true,
      data: {
        previews: allPreviews,
        summary: {
          totalStudents,
          newStudents,
          importedStudents,
          alreadyAllocated,
          toGenerate: totalStudents - alreadyAllocated,
          totalExpectedRevenue: totalExpected,
          paymentPlan,
          periods: generatePeriods(session.name, paymentPlan).map(p => p.label)
        }
      }
    });
  } catch (error) {
    logger.error('Preview generation error', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
});

/**
 * @desc    Generate allocations + invoices in one step (new flow)
 * @route   POST /api/fees/allocations/generate-all
 * @access  Private (Admin)
 *
 * This is the new "Generate Invoices" wizard endpoint.
 * Creates annual allocations AND all period invoices for each student.
 */
router.post('/generate-all', protect, authorize('admin'), [
  body('academicSessionId').notEmpty().withMessage('Academic session is required'),
  body('paymentPlan').isIn(['monthly', 'quarterly', 'half-yearly', 'annual']).withMessage('Invalid payment plan'),
  handleValidationErrors
], async(req, res) => {
  try {
    const { classId, sectionId, academicSessionId, paymentPlan, dueDay } = req.body;
    const tenantId = req.user.tenantId;

    // Get academic session
    const session = await AcademicSession.findById(academicSessionId);
    if (!session) return res.status(404).json({ success: false, message: 'Academic session not found' });

    // Find fee structures
    const fsQuery = { tenantId, academicSessionId, isActive: true };
    if (classId) fsQuery.classId = classId;

    const feeStructures = await FeeStructure.find(fsQuery);
    if (feeStructures.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No active fee structures found. Create fee structures before generating invoices.'
      });
    }

    const allResults = [];
    const allErrors = [];
    const allSkipped = [];

    for (const fs of feeStructures) {
      // Get students for this class
      const studentQuery = { tenantId, role: 'student', isActive: true };
      const classConditions = [{ classId: fs.classId }];
      try {
        const Class = require('../models/Class');
        const classDoc = await Class.findById(fs.classId);
        if (classDoc?.name) {
          classConditions.push({ class: classDoc.name });
          const gradeMatch = classDoc.name.match(/(\d+)/);
          if (gradeMatch) classConditions.push({ class: gradeMatch[1] });
        }
      } catch (e) { /* ignore */ }
      studentQuery.$or = classConditions;
      if (sectionId) studentQuery.sectionId = sectionId;

      const students = await User.find(studentQuery);

      const { results, errors, skipped } = await generateInvoicesForBulk({
        tenantId,
        students,
        feeStructure: fs,
        paymentPlan,
        academicSessionId,
        academicYearName: session.name,
        generatedBy: req.user._id,
        dueDay: dueDay || 10
      });

      allResults.push(...results);
      allErrors.push(...errors);
      allSkipped.push(...skipped);
    }

    const totalInvoices = allResults.reduce((sum, r) => sum + r.invoiceCount, 0);

    // Audit
    try {
      await FeeAuditLog.logAction({
        tenantId,
        action: 'INVOICE_BULK_GENERATED',
        entityType: 'AnnualFeeAllocation',
        entityId: null,
        userId: req.user._id,
        userName: req.user.name,
        userRole: req.user.role,
        details: {
          source: 'generate_all',
          classId,
          academicSessionId,
          paymentPlan,
          studentsProcessed: allResults.length,
          invoicesGenerated: totalInvoices,
          skipped: allSkipped.length,
          errors: allErrors.length
        },
        ipAddress: req.ip
      });
    } catch (e) { /* non-fatal */ }

    res.status(201).json({
      success: true,
      message: `Generated ${totalInvoices} invoices for ${allResults.length} students (${allSkipped.length} skipped, ${allErrors.length} errors)`,
      data: {
        generated: allResults.length,
        totalInvoices,
        skipped: allSkipped.length,
        skippedDetails: allSkipped,
        errors: allErrors.length,
        errorDetails: allErrors,
        results: allResults
      }
    });
  } catch (error) {
    logger.error('Generate all error', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
});

/**
 * @desc    Generate allocation + invoices for a SINGLE student (new flow)
 * @route   POST /api/fees/allocations/generate-single
 * @access  Private (Admin)
 *
 * Auto-detects fee structure from student's class.
 */
router.post('/generate-single', protect, authorize('admin'), [
  body('studentId').notEmpty().withMessage('Student ID is required'),
  body('academicSessionId').notEmpty().withMessage('Academic session is required'),
  body('paymentPlan').isIn(['monthly', 'quarterly', 'half-yearly', 'annual']).withMessage('Invalid payment plan'),
  handleValidationErrors
], async(req, res) => {
  try {
    const { studentId, academicSessionId, paymentPlan, dueDay } = req.body;
    const tenantId = req.user.tenantId;

    // Verify student
    const student = await User.findOne({ _id: studentId, tenantId, role: 'student' });
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    // Get academic session
    const session = await AcademicSession.findById(academicSessionId);
    if (!session) return res.status(404).json({ success: false, message: 'Academic session not found' });

    // Auto-detect fee structure from student's class
    let feeStructure = null;

    if (student.classId) {
      // Primary: match by classId ObjectId
      feeStructure = await FeeStructure.findOne({
        tenantId,
        classId: student.classId,
        academicSessionId,
        isActive: true
      });
    }

    // Fallback: if student only has class name string (e.g., imported students), resolve classId
    if (!feeStructure && !student.classId && student.class) {
      const Class = require('../models/Class');
      const classDoc = await Class.findOne({ tenantId, name: student.class });
      if (classDoc) {
        // Update student record with the resolved classId for future use
        student.classId = classDoc._id;
        await student.save();

        feeStructure = await FeeStructure.findOne({
          tenantId,
          classId: classDoc._id,
          academicSessionId,
          isActive: true
        });
      }
    }

    if (!student.classId && !student.class) {
      return res.status(400).json({ success: false, message: 'Student has no class assigned. Please update student record.' });
    }

    if (!feeStructure) {
      return res.status(404).json({
        success: false,
        message: 'No active fee structure found for this student\'s class. Please create one first.'
      });
    }

    const result = await generateInvoicesForStudent({
      tenantId,
      student,
      feeStructure,
      paymentPlan,
      academicSessionId,
      academicYearName: session.name,
      generatedBy: req.user._id,
      dueDay: dueDay || 10
    });

    if (result.summary.skipped) {
      return res.status(409).json({
        success: false,
        message: result.summary.reason
      });
    }

    // Audit
    try {
      await FeeAuditLog.logAction({
        tenantId,
        action: 'INVOICE_GENERATED',
        entityType: 'AnnualFeeAllocation',
        entityId: result.allocation?._id,
        userId: req.user._id,
        userName: req.user.name,
        userRole: req.user.role,
        details: {
          source: 'generate_single',
          studentId,
          studentName: student.name,
          paymentPlan,
          totalAnnual: result.summary.total,
          invoiceCount: result.summary.invoiceCount
        },
        ipAddress: req.ip
      });
    } catch (e) { /* non-fatal */ }

    res.status(201).json({
      success: true,
      message: `Generated ${result.invoices.length} invoices for ${student.name}. Annual total: ${formatRupee(result.summary.total)}`,
      data: {
        allocation: result.allocation,
        invoices: result.invoices,
        summary: result.summary
      }
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Allocation or invoices already exist for this student and academic year.'
      });
    }
    logger.error('Generate single error', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
});

module.exports = router;
