const express = require('express');
const { body, param, query } = require('express-validator');
const ActivityEnrollment = require('../models/ActivityEnrollment');
const FeeInvoice = require('../models/FeeInvoice');
const User = require('../models/User');
const StudentBalance = require('../models/StudentBalance');
const { protect, authorize } = require('../middleware/auth');
const planGate = require('../middleware/planGate');
const { handleValidationErrors } = require('../middleware/validation');
const { roundToRupee, toNumber } = require('../utils/money');

const router = express.Router();

const readGates = [protect, planGate.requireActiveSubscription, planGate.checkFeesAndFinance];
const writeGates = [...readGates, authorize('admin', 'accountant')];

// ─── GET /api/activity-enrollments ─────────────────────────────────────
router.get('/', readGates, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 200 }),
  query('search').optional().trim().isLength({ max: 100 }),
  query('activityProgram').optional().isMongoId(),
  query('studentId').optional().isMongoId(),
  query('academicSessionId').optional().isMongoId(),
  query('status').optional().isIn(['active', 'paused', 'completed', 'cancelled', 'all']),
  handleValidationErrors
], async(req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const filter = { tenantId };
    if (req.query.activityProgram) filter.activityProgram = req.query.activityProgram;
    if (req.query.studentId) filter.student = req.query.studentId;
    if (req.query.academicSessionId) filter.academicSession = req.query.academicSessionId;
    const status = req.query.status || 'active';
    if (status !== 'all') filter.status = status;

    if (req.query.search) {
      const matchingStudents = await User.find({
        tenantId,
        role: 'student',
        $or: [
          { name: { $regex: req.query.search, $options: 'i' } },
          { admissionNumber: { $regex: req.query.search, $options: 'i' } }
        ]
      }).select('_id').lean();
      filter.student = { $in: matchingStudents.map(s => s._id) };
    }

    const [enrollments, total] = await Promise.all([
      ActivityEnrollment.find(filter)
        .populate('student', 'name admissionNumber class section photo')
        .populate('activityProgram', 'name category monthlyFee photo')
        .populate('academicSession', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ActivityEnrollment.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: enrollments,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      requestId: req.requestId
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/activity-enrollments/me ──────────────────────────────────
// For students/parents — list the logged-in student's enrollments.
router.get('/me', protect, async(req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    let studentId = req.user._id;
    if (req.user.role === 'parent' && req.user.linkedStudentId) {
      studentId = req.user.linkedStudentId;
    }
    if (req.query.studentId && (req.user.role === 'parent' || req.user.role === 'student')) {
      // Parents may have multiple children, students stay scoped to self
      if (req.user.role === 'parent') studentId = req.query.studentId;
    }

    const enrollments = await ActivityEnrollment.find({
      tenantId,
      student: studentId
    })
      .populate('activityProgram', 'name category monthlyFee photo schedule')
      .populate('academicSession', 'name')
      .sort({ status: 1, createdAt: -1 })
      .lean();

    res.json({ success: true, data: enrollments, requestId: req.requestId });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/activity-enrollments/:id ─────────────────────────────────
router.get('/:id', readGates, [
  param('id').isMongoId(),
  handleValidationErrors
], async(req, res, next) => {
  try {
    const enrollment = await ActivityEnrollment.findOne({
      _id: req.params.id,
      tenantId: req.user.tenantId
    })
      .populate('student', 'name admissionNumber class section photo')
      .populate('activityProgram', 'name category monthlyFee photo schedule')
      .populate('academicSession', 'name')
      .lean();

    if (!enrollment) {
      return res.status(404).json({ success: false, message: 'Enrollment not found', requestId: req.requestId });
    }

    // Outstanding invoices for this enrollment
    const outstandingInvoices = await FeeInvoice.find({
      tenantId: req.user.tenantId,
      invoiceType: 'activity',
      sourceId: enrollment._id,
      status: { $in: ['Pending', 'Partial', 'Overdue'] }
    }).sort({ periodStart: 1 }).lean();

    res.json({
      success: true,
      data: { ...enrollment, outstandingInvoices },
      requestId: req.requestId
    });
  } catch (err) {
    next(err);
  }
});

// ─── PUT /api/activity-enrollments/:id ─────────────────────────────────
router.put('/:id', writeGates, [
  param('id').isMongoId(),
  body('monthlyFee').optional().isFloat({ min: 0 }),
  body('discountType').optional().isIn(['none', 'percent', 'fixed']),
  body('discountValue').optional().isFloat({ min: 0 }),
  body('enrolledFrom').optional().isISO8601(),
  body('notes').optional().trim().isLength({ max: 500 }),
  handleValidationErrors
], async(req, res, next) => {
  try {
    const enrollment = await ActivityEnrollment.findOne({
      _id: req.params.id,
      tenantId: req.user.tenantId
    });
    if (!enrollment) {
      return res.status(404).json({ success: false, message: 'Enrollment not found', requestId: req.requestId });
    }
    if (enrollment.status === 'cancelled' || enrollment.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Cannot edit a withdrawn or completed enrollment',
        requestId: req.requestId
      });
    }

    if (req.body.monthlyFee !== undefined) enrollment.monthlyFee = req.body.monthlyFee;
    if (req.body.discountType !== undefined) {
      enrollment.discountType = req.body.discountType;
      if (req.body.discountType === 'none') enrollment.discountValue = 0;
    }
    if (req.body.discountValue !== undefined) enrollment.discountValue = req.body.discountValue;
    if (req.body.enrolledFrom !== undefined) enrollment.enrolledFrom = new Date(req.body.enrolledFrom);
    if (req.body.notes !== undefined) enrollment.notes = req.body.notes;
    enrollment.updatedBy = req.user._id;

    await enrollment.save();
    res.json({ success: true, message: 'Enrollment updated', data: enrollment, requestId: req.requestId });
  } catch (err) {
    next(err);
  }
});

// ─── PUT /api/activity-enrollments/:id/pause ───────────────────────────
router.put('/:id/pause', writeGates, [
  param('id').isMongoId(),
  body('notes').optional().trim().isLength({ max: 300 }),
  handleValidationErrors
], async(req, res, next) => {
  try {
    const enrollment = await ActivityEnrollment.findOne({
      _id: req.params.id,
      tenantId: req.user.tenantId,
      status: 'active'
    });
    if (!enrollment) {
      return res.status(404).json({ success: false, message: 'Active enrollment not found', requestId: req.requestId });
    }
    enrollment.status = 'paused';
    if (req.body.notes) enrollment.notes = req.body.notes;
    enrollment.updatedBy = req.user._id;
    await enrollment.save();
    res.json({ success: true, message: 'Enrollment paused', data: enrollment, requestId: req.requestId });
  } catch (err) {
    next(err);
  }
});

// ─── PUT /api/activity-enrollments/:id/resume ──────────────────────────
router.put('/:id/resume', writeGates, [
  param('id').isMongoId(),
  handleValidationErrors
], async(req, res, next) => {
  try {
    const enrollment = await ActivityEnrollment.findOne({
      _id: req.params.id,
      tenantId: req.user.tenantId,
      status: 'paused'
    });
    if (!enrollment) {
      return res.status(404).json({ success: false, message: 'Paused enrollment not found', requestId: req.requestId });
    }

    // Block resume if another active enrollment exists for this student+activity.
    const conflict = await ActivityEnrollment.findOne({
      tenantId: req.user.tenantId,
      activityProgram: enrollment.activityProgram,
      student: enrollment.student,
      status: 'active',
      _id: { $ne: enrollment._id }
    }).select('_id').lean();
    if (conflict) {
      return res.status(409).json({
        success: false,
        message: 'Student already has an active enrollment in this activity',
        requestId: req.requestId
      });
    }

    enrollment.status = 'active';
    enrollment.updatedBy = req.user._id;
    await enrollment.save();
    res.json({ success: true, message: 'Enrollment resumed', data: enrollment, requestId: req.requestId });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/activity-enrollments/:id/withdraw ───────────────────────
// Withdraws a student. Optionally settles outstanding invoices:
//   - settlementMode='discount'  → apply a discount to outstanding invoices, leaving a smaller balance for collection
//   - settlementMode='cancel'    → cancel outstanding (still-unpaid) invoices
//   - settlementMode='none'      → leave invoices untouched
router.post('/:id/withdraw', writeGates, [
  param('id').isMongoId(),
  body('reason').optional().trim().isLength({ max: 300 }),
  body('endDate').optional().isISO8601(),
  body('settlementMode').optional().isIn(['none', 'discount', 'cancel']),
  body('discountAmount').optional().isFloat({ min: 0 }),
  body('cancelOnlyUnpaid').optional().isBoolean(),
  handleValidationErrors
], async(req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const enrollment = await ActivityEnrollment.findOne({
      _id: req.params.id,
      tenantId,
      status: { $in: ['active', 'paused'] }
    });
    if (!enrollment) {
      return res.status(404).json({ success: false, message: 'Active or paused enrollment not found', requestId: req.requestId });
    }

    const settlementMode = req.body.settlementMode || 'none';
    const endDate = req.body.endDate ? new Date(req.body.endDate) : new Date();
    let settlementSummary = null;

    if (settlementMode === 'discount') {
      const discount = toNumber(req.body.discountAmount) || 0;
      if (discount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'discountAmount must be > 0 for settlementMode=discount',
          requestId: req.requestId
        });
      }
      // Apply the discount across outstanding invoices, oldest first, capped at remaining balance per invoice.
      const outstanding = await FeeInvoice.find({
        tenantId,
        invoiceType: 'activity',
        sourceId: enrollment._id,
        status: { $in: ['Pending', 'Partial', 'Overdue'] }
      }).sort({ periodStart: 1 });

      let remaining = discount;
      const adjustments = [];
      for (const inv of outstanding) {
        if (remaining <= 0) break;
        const invBalance = toNumber(inv.balanceAmount);
        const apply = Math.min(remaining, invBalance);
        if (apply <= 0) continue;
        inv.discountAmount = roundToRupee(toNumber(inv.discountAmount) + apply);
        inv.discountReason = req.body.reason || 'Withdrawal settlement discount';
        inv.discountAppliedBy = req.user._id;
        inv.discountAppliedAt = new Date();
        await inv.save();
        remaining = roundToRupee(remaining - apply);
        adjustments.push({ invoiceNumber: inv.invoiceNumber, discountApplied: apply, newBalance: inv.balanceAmount, status: inv.status });
      }
      settlementSummary = {
        mode: 'discount',
        totalDiscountApplied: roundToRupee(discount - remaining),
        unusedDiscount: remaining,
        adjustments
      };
    } else if (settlementMode === 'cancel') {
      const onlyUnpaid = req.body.cancelOnlyUnpaid !== false; // default true
      const cancelFilter = {
        tenantId,
        invoiceType: 'activity',
        sourceId: enrollment._id,
        status: { $in: ['Pending', 'Partial', 'Overdue'] }
      };
      if (onlyUnpaid) cancelFilter.paidAmount = 0;
      const invoices = await FeeInvoice.find(cancelFilter);
      const cancelled = [];
      for (const inv of invoices) {
        inv.status = 'Cancelled';
        inv.cancelledAt = new Date();
        inv.cancelledBy = req.user._id;
        inv.cancellationReason = req.body.reason || 'Withdrawn from activity';
        await inv.save();
        cancelled.push({ invoiceNumber: inv.invoiceNumber });
      }
      settlementSummary = { mode: 'cancel', cancelledCount: cancelled.length, cancelled };
    }

    enrollment.status = 'completed';
    enrollment.enrolledTo = endDate;
    enrollment.withdrawnAt = new Date();
    enrollment.withdrawalReason = req.body.reason;
    enrollment.updatedBy = req.user._id;
    await enrollment.save();

    // Refresh student balance
    try {
      await StudentBalance.updateBalance(tenantId, enrollment.student, enrollment.academicSession);
    } catch (e) { /* non-fatal */ }

    res.json({
      success: true,
      message: 'Enrollment withdrawn',
      data: { enrollment, settlement: settlementSummary },
      requestId: req.requestId
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/activity-enrollments/:id/outstanding ─────────────────────
// Returns the enrollment's outstanding invoices (used by the withdraw flow).
router.get('/:id/outstanding', readGates, [
  param('id').isMongoId(),
  handleValidationErrors
], async(req, res, next) => {
  try {
    const enrollment = await ActivityEnrollment.findOne({
      _id: req.params.id,
      tenantId: req.user.tenantId
    }).lean();
    if (!enrollment) {
      return res.status(404).json({ success: false, message: 'Enrollment not found', requestId: req.requestId });
    }
    const invoices = await FeeInvoice.find({
      tenantId: req.user.tenantId,
      invoiceType: 'activity',
      sourceId: enrollment._id,
      status: { $in: ['Pending', 'Partial', 'Overdue'] }
    }).sort({ periodStart: 1 }).lean();

    const totalOutstanding = invoices.reduce((s, i) => s + toNumber(i.balanceAmount), 0);
    res.json({
      success: true,
      data: { invoices, totalOutstanding: roundToRupee(totalOutstanding) },
      requestId: req.requestId
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
