const express = require('express');
const { body } = require('express-validator');
const mongoose = require('mongoose');
const { toNumber, roundToRupee } = require('../utils/money');
const FeeInvoice = require('../models/FeeInvoice');
const PaymentAttempt = require('../models/PaymentAttempt');
const PaymentAuditLog = require('../models/PaymentAuditLog');
const PaymentDispute = require('../models/PaymentDispute');
const Receipt = require('../models/Receipt');
const Payment = require('../models/Payment');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');
const { syncFeePaymentToIncome } = require('../services/financeAutoSyncService');
const {
  applyPaymentToInvoices: sharedApplyPaymentToInvoices,
  settleSuccessfulAttempt,
  runPostSettlementSideEffects
} = require('../services/paymentSettlementService');

// Payment gateway — resolved per tenant via factory
const { getGateway } = require('../services/payment/GatewayFactory');
const Tenant = require('../models/Tenant');

const planGate = require('../middleware/planGate');

const router = express.Router();

// All student fee routes require fees/finance feature (Basic+)
router.use(planGate.requireActiveSubscription);
router.use(planGate.checkFeesAndFinance);

/**
 * Helper: Resolve the target student ID for fee queries.
 * - For students: returns their own ID
 * - For parents: returns the childId from query param (validated against their children array)
 * Returns { studentId, error }
 */
function resolveStudentId(req) {
  if (req.user.role === 'student') {
    return { studentId: req.user._id };
  }
  if (req.user.role === 'parent') {
    // Body-based override for POST routes — frontend can put childId in
    // either the query string or the JSON body. POST endpoints (pay,
    // pay-combined, abandon) read from the body so the URL stays clean.
    const childId = req.query.childId || req.body?.childId;
    if (!childId) {
      return { error: 'childId is required for parent access (query or body)' };
    }
    const children = (req.user.children || []).map(c => c.toString());
    if (!children.includes(childId.toString())) {
      return { error: 'You can only access your children\'s fee data' };
    }
    return { studentId: childId };
  }
  return { error: 'Unauthorized role' };
}

/**
 * Resolve the full student User record for the current request. For
 * students this is just req.user; for parents we look up the child so
 * that downstream gateway calls get the right name / email /
 * admissionNumber on the customer record (not the parent's). Returns
 * { student, error }.
 */
async function resolveStudent(req) {
  const { studentId, error } = resolveStudentId(req);
  if (error) return { error };
  if (req.user.role === 'student') return { student: req.user };
  const student = await User.findOne({
    _id: studentId,
    tenantId: req.user.tenantId,
    role: 'student'
  }).lean();
  if (!student) return { error: 'Child student record not found' };
  return { student };
}

/**
 * Helper to log state transitions strictly
 */
async function createAuditLog(paymentAttemptId, session, tenantId, previousStatus, newStatus, triggerSource, note = '') {
  const log = new PaymentAuditLog({
    tenantId,
    paymentAttemptId,
    previousStatus,
    newStatus,
    triggerSource,
    note
  });
    // Can optionally run against a session if provided
  return session ? log.save({ session }) : log.save();
}

/**
 * Helper: Get all invoice IDs for a payment attempt (supports both single and combined).
 * Returns array of ObjectIds.
 */
/**
 * Apply a successful payment across one or more invoices via the shared
 * settlement service so reconciliation, ICICI callbacks and admin
 * verification all stay in lockstep.
 */
async function applyPaymentToInvoices(attempt, session, opts = {}) {
  const result = await sharedApplyPaymentToInvoices(attempt, session, opts);
  return result.receipts;
}

/**
 * @desc    Get all fee invoices assigned to the logged-in student (or parent's child)
 * @route   GET /api/student-fees?childId=xxx (childId required for parents)
 * @access  Private (Student, Parent)
 */
router.get('/', protect, authorize('student', 'parent'), async(req, res) => {
  try {
    const { studentId, error } = resolveStudentId(req);
    if (error) return res.status(400).json({ success: false, message: error });

    const invoices = await FeeInvoice.find({
      studentId,
      tenantId: req.user.tenantId,
      status: { $ne: 'Cancelled' }
    })
      .populate('feeStructureId', 'name academicYear')
      .sort({ dueDate: 1 });

    res.json({
      success: true,
      data: invoices
    });
  } catch (error) {
    console.error('Error fetching student fees:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * @desc    Get complete history of payment attempts for this student
 * @route   GET /api/student-fees/history
 * @access  Private (Student)
 */
router.get('/history', protect, authorize('student', 'parent'), async(req, res) => {
  try {
    const { studentId, error } = resolveStudentId(req);
    if (error) return res.status(400).json({ success: false, message: error });

    // Opportunistic refresh: ping the gateway for any in-flight attempts
    // and flip clearly-FAILED ones so the SPA polling sees an updated
    // status without waiting for the background reconciliation job.
    // SUCCESS transitions are intentionally left to webhook / returnURL /
    // reconciliation paths (full settlement is heavy and must run inside
    // a transaction).
    //
    // The 3-second floor is a tiny grace window so we don't race with the
    // gateway-redirect handoff (the attempt row is created ~immediately
    // before the browser navigates to ICICI). Anything older is fair game
    // — students who cancel at the gateway typically return to /fees
    // within 5-15 seconds, and waiting 30s+ to detect that left the UI
    // showing "Cancel & Retry" instead of "Pay Now".
    try {
      const refreshCutoff = new Date(Date.now() - 3 * 1000);
      const inFlight = await PaymentAttempt.find({
        studentId,
        tenantId: req.user.tenantId,
        status: { $in: ['INITIATED', 'PROCESSING', 'PENDING'] },
        gatewayRefId: { $exists: true, $ne: null },
        createdAt: { $lt: refreshCutoff }
      }).limit(10);

      if (inFlight.length > 0) {
        const tenant = await Tenant.findById(req.user.tenantId).lean();
        const gateway = tenant ? getGateway(tenant) : null;
        if (gateway && typeof gateway.checkStatus === 'function') {
          await Promise.all(inFlight.map(async(attempt) => {
            try {
              const result = await gateway.checkStatus(attempt.gatewayRefId, attempt.idempotencyKey);
              if (result?.status === 'FAILED') {
                const previousStatus = attempt.status;
                attempt.status = 'FAILED';
                await attempt.save();
                await PaymentAuditLog.create({
                  tenantId: attempt.tenantId,
                  paymentAttemptId: attempt._id,
                  previousStatus,
                  newStatus: 'FAILED',
                  triggerSource: 'STUDENT_PORTAL',
                  note: 'Status reconciled during history fetch.'
                });
              } else if (result?.status === 'SUCCESS') {
                // Student paid at the gateway but closed the browser
                // before the returnURL POST fired. Settle inline so the
                // page doesn't sit on "pending" until the 90s
                // reconciliation tick. settleSuccessfulAttempt is
                // idempotent via (paymentAttemptId, invoiceId), so a
                // simultaneous reconciliation run will no-op.
                const session = await mongoose.startSession();
                session.startTransaction();
                let settleResult;
                try {
                  settleResult = await settleSuccessfulAttempt(attempt, session, {
                    paymentMode: 'ONLINE',
                    paymentDate: new Date(),
                    transactionRefId: attempt.gatewayRefId || null,
                    initiatedBy: 'student',
                    triggerSource: 'STUDENT_PORTAL',
                    note: 'Reconciled inline during /history fetch — student returned to portal after closing gateway window.'
                  });
                  await session.commitTransaction();
                } catch (txErr) {
                  await session.abortTransaction();
                  throw txErr;
                } finally {
                  session.endSession();
                }

                if (settleResult && !settleResult.alreadySettled) {
                  await runPostSettlementSideEffects(attempt, settleResult.invoices, {
                    receipts: settleResult.receipts,
                    paymentMode: 'Online',
                    paymentDate: new Date(),
                    transactionRefId: attempt.gatewayRefId || null
                  });
                }
              }
            } catch (err) {
              // Log every reconciliation failure so we can see *why* polls
              // aren't converging (signature mismatch, network, settlement
              // racing, etc.) — the previous silent catch made stuck
              // payments invisible until a user complained.
              try {
                const { logger } = require('../middleware/errorHandler');
                logger.warn('Inline /history reconcile failed for attempt', {
                  attemptId: String(attempt._id),
                  gatewayRefId: attempt.gatewayRefId,
                  tenantId: String(attempt.tenantId),
                  error: err?.message || String(err),
                  stack: err?.stack
                });
              } catch (_) { /* logger not available — skip */ }
            }
          }));
        }
      }
    } catch (err) {
      // Log but don't fail the history response.
      try {
        const { logger } = require('../middleware/errorHandler');
        logger.warn('History opportunistic refresh threw', { error: err?.message, stack: err?.stack });
      } catch (_) { /* logger not available */ }
    }

    const attempts = await PaymentAttempt.find({
      studentId,
      tenantId: req.user.tenantId
    })
      .populate('invoiceId', 'invoiceNumber totalAmount status dueDate')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: attempts
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error fetching history' });
  }
});

/**
 * @desc    Force-reconcile a single stuck payment attempt against the
 *          gateway. Use when the student paid at the bank but the
 *          browser was closed before returnURL fired and the
 *          opportunistic /history poll didn't converge (e.g. transient
 *          gateway hash failure on one tick). Surfaces the raw gateway
 *          response so support can diagnose if it still won't settle.
 * @route   POST /api/student-fees/reconcile/:attemptId
 * @access  Private (Student)
 */
router.post('/reconcile/:attemptId', protect, authorize('student', 'parent'), async(req, res) => {
  try {
    const { attemptId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(attemptId)) {
      return res.status(400).json({ success: false, message: 'Invalid attempt id' });
    }

    const { studentId, error } = resolveStudentId(req);
    if (error) return res.status(400).json({ success: false, message: error });

    const attempt = await PaymentAttempt.findOne({
      _id: attemptId,
      studentId,
      tenantId: req.user.tenantId
    });
    if (!attempt) {
      return res.status(404).json({ success: false, message: 'Payment attempt not found' });
    }
    if (['SUCCESS', 'VERIFIED'].includes(attempt.status)) {
      return res.json({ success: true, message: 'Already settled', data: { status: attempt.status } });
    }
    if (!attempt.gatewayRefId) {
      return res.status(400).json({ success: false, message: 'This is a manual payment — wait for admin verification' });
    }

    const tenant = await Tenant.findById(req.user.tenantId).lean();
    const gateway = tenant ? getGateway(tenant) : null;
    if (!gateway || typeof gateway.checkStatus !== 'function') {
      return res.status(400).json({ success: false, message: 'Gateway does not support manual reconciliation' });
    }

    let gwResult;
    try {
      gwResult = await gateway.checkStatus(attempt.gatewayRefId, attempt.idempotencyKey);
    } catch (gwErr) {
      return res.status(502).json({
        success: false,
        message: 'Could not reach the payment gateway. Please try again in a moment.',
        debug: process.env.NODE_ENV !== 'production' ? gwErr.message : undefined
      });
    }

    if (gwResult?.status === 'SUCCESS') {
      const session = await mongoose.startSession();
      session.startTransaction();
      let settleResult;
      try {
        settleResult = await settleSuccessfulAttempt(attempt, session, {
          paymentMode: 'ONLINE',
          paymentDate: new Date(),
          transactionRefId: attempt.gatewayRefId || null,
          initiatedBy: 'student',
          triggerSource: 'STUDENT_PORTAL',
          note: 'Force-reconciled by student via /reconcile endpoint.'
        });
        await session.commitTransaction();
      } catch (txErr) {
        await session.abortTransaction();
        session.endSession();
        return res.status(500).json({ success: false, message: 'Settlement failed', debug: process.env.NODE_ENV !== 'production' ? txErr.message : undefined });
      }
      session.endSession();

      if (settleResult && !settleResult.alreadySettled) {
        await runPostSettlementSideEffects(attempt, settleResult.invoices, {
          receipts: settleResult.receipts,
          paymentMode: 'Online',
          paymentDate: new Date(),
          transactionRefId: attempt.gatewayRefId || null
        });
      }

      return res.json({
        success: true,
        message: settleResult?.alreadySettled ? 'Already settled' : 'Payment confirmed and applied to invoices',
        data: { status: 'SUCCESS', invoicesUpdated: settleResult?.invoices?.length || 0 }
      });
    }

    if (gwResult?.status === 'FAILED') {
      const previousStatus = attempt.status;
      attempt.status = 'FAILED';
      await attempt.save();
      await PaymentAuditLog.create({
        tenantId: attempt.tenantId,
        paymentAttemptId: attempt._id,
        previousStatus,
        newStatus: 'FAILED',
        triggerSource: 'STUDENT_PORTAL',
        note: 'Force-reconciled by student — gateway reported failure.'
      });
      return res.json({ success: true, message: 'Gateway reported this payment failed. You can retry now.', data: { status: 'FAILED' } });
    }

    return res.json({
      success: true,
      message: 'Gateway still processing. Please wait a minute and try again.',
      data: { status: gwResult?.status || 'PENDING', raw: gwResult?.raw }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Reconcile failed' });
  }
});

/**
 * @desc    Get annual fee summary for the logged-in student
 * @route   GET /api/student-fees/summary
 * @access  Private (Student)
 *
 * Returns total annual fee, paid, outstanding, payment plan, and allocation info.
 * Excludes cancelled invoices from all calculations.
 */
router.get('/summary', protect, authorize('student', 'parent'), async(req, res) => {
  try {
    const { studentId, error } = resolveStudentId(req);
    if (error) return res.status(400).json({ success: false, message: error });

    const AnnualFeeAllocation = require('../models/AnnualFeeAllocation');

    // Find active allocation for this student
    const allocation = await AnnualFeeAllocation.findOne({
      studentId,
      tenantId: req.user.tenantId,
      status: { $in: ['active', 'completed'] }
    }).sort({ createdAt: -1 });

    // Get non-cancelled invoices
    const invoices = await FeeInvoice.find({
      studentId,
      tenantId: req.user.tenantId,
      status: { $ne: 'Cancelled' }
    }).sort({ dueDate: 1 });

    const totalInvoiced = invoices.reduce((sum, inv) => sum + (inv.totalAmount || 0) + (inv.lateFeeApplied || 0) - (inv.discountAmount || 0), 0);
    const totalPaid = invoices.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0);
    const totalOutstanding = Math.max(0, totalInvoiced - totalPaid);
    const overdueInvoices = invoices.filter(inv => inv.status === 'Overdue');
    const nextDue = invoices.find(inv => inv.status === 'Pending' || inv.status === 'Partial' || inv.status === 'Overdue');

    res.json({
      success: true,
      data: {
        totalAnnualFee: allocation?.totalAnnualAmount || totalInvoiced,
        totalPaid,
        totalOutstanding,
        totalOverdue: overdueInvoices.reduce((sum, inv) => sum + (inv.balanceAmount || 0), 0),
        paymentPlan: allocation?.paymentPlan || null,
        invoiceCount: invoices.length,
        paidCount: invoices.filter(inv => inv.status === 'Paid').length,
        pendingCount: invoices.filter(inv => inv.status === 'Pending' || inv.status === 'Partial').length,
        overdueCount: overdueInvoices.length,
        nextDueDate: nextDue?.dueDate || null,
        nextDueAmount: nextDue?.balanceAmount || null
      }
    });
  } catch (error) {
    console.error('Error fetching student fee summary:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * @desc    Get single invoice detail heavily populated with history
 * @route   GET /api/student-fees/:id
 * @access  Private (Student)
 */
// IMPORTANT: must come before the /:id catch-all below — otherwise
// Express casts "gateway-status" as an ObjectId and 500s on CastError.
router.get('/gateway-status', protect, authorize('student', 'parent'), async(req, res) => {
  try {
    const tenant = await Tenant.findById(req.user.tenantId).select('paymentGateway').lean();
    if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found' });

    const pg = tenant.paymentGateway || {};
    res.json({
      success: true,
      data: {
        gatewayEnabled: pg.isActive && pg.provider !== 'none',
        provider: pg.isActive ? pg.provider : 'none'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Constrain :id to a MongoDB ObjectId so word routes declared later in
// this file (e.g. /receipts, /receipt/:id) don't get shadowed. Without
// the regex, GET /api/student-fees/receipts was matching this handler
// with id="receipts", which then CastError'd inside the FeeInvoice
// lookup and returned a generic 'Server error' — masking the real
// receipts route entirely. Any new word-prefixed GET added below must
// either be declared before this handler or remain non-ObjectId-shaped.
router.get('/:id([0-9a-fA-F]{24})', protect, authorize('student', 'parent'), async(req, res) => {
  try {
    const { studentId, error } = resolveStudentId(req);
    if (error) return res.status(400).json({ success: false, message: error });

    const invoice = await FeeInvoice.findOne({
      _id: req.params.id,
      studentId,
      tenantId: req.user.tenantId,
      status: { $ne: 'Cancelled' }
    });

    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });

    const history = await PaymentAttempt.find({ invoiceId: invoice._id }).sort({ createdAt: -1 });

    // Add virtual wrapper
    res.json({
      success: true,
      data: {
        invoice,
        history
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * @desc    Initiate a new payment for an invoice
 * @route   POST /api/student-fees/:id/pay
 * @access  Private (Student)
 */
router.post('/:id/pay', protect, authorize('student', 'parent'), async(req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { student, error: stuErr } = await resolveStudent(req);
    if (stuErr) { await session.abortTransaction(); session.endSession(); return res.status(400).json({ success: false, message: stuErr }); }

    const invoice = await FeeInvoice.findOne({
      _id: req.params.id,
      studentId: student._id,
      tenantId: req.user.tenantId
    }).session(session);

    if (!invoice) throw new Error('Invoice not found');

    // Rule: If already Paid, block
    if (invoice.status === 'Paid') {
      throw new Error('This invoice is already fully paid.');
    }

    // Check if there is already a PENDING or PROCESSING payment for this
    const stuckAttempt = await PaymentAttempt.findOne({
      invoiceId: invoice._id,
      status: { $in: ['PENDING', 'PROCESSING'] }
    }).session(session);

    if (stuckAttempt) {
      throw new Error('You already have a payment undergoing verification for this invoice. Please wait or check your history.');
    }

    // Idempotency key: unique per attempt. The stuck-attempt check above is the
    // real idempotency guard (blocks if PENDING/PROCESSING exists). This key just
    // prevents MongoDB-level race conditions on concurrent inserts.
    const idempotencyKey = `idmp_${invoice._id}_${student._id}_${Date.now()}`;
    const amountToPay = invoice.balanceAmount;

    // 1. Create INITIATED attempt record FIRST before calling gateway
    const attempt = new PaymentAttempt({
      tenantId: req.user.tenantId,
      idempotencyKey,
      studentId: student._id,
      invoiceId: invoice._id,
      amount: amountToPay,
      status: 'INITIATED',
      triggerSource: req.user.role === 'parent' ? 'PARENT_PORTAL' : 'STUDENT_PORTAL'
    });

    await attempt.save({ session });
    await createAuditLog(attempt._id, session, req.user.tenantId, null, 'INITIATED', 'STUDENT_PORTAL', 'Started payment flow');

    await session.commitTransaction();
    session.endSession();

    // 2. Resolve the payment gateway for this tenant
    const tenant = await Tenant.findById(req.user.tenantId).lean();
    const gateway = getGateway(tenant);

    if (!gateway) {
      // No gateway configured for this tenant in production
      await PaymentAttempt.findByIdAndUpdate(attempt._id, { status: 'FAILED' });
      await createAuditLog(attempt._id, null, req.user.tenantId, 'INITIATED', 'FAILED', 'STUDENT_PORTAL', 'No payment gateway configured for this school');
      return res.status(400).json({ success: false, message: 'Online payments are not yet configured for your school. Please contact the school office.' });
    }

    // 3. Safely call external gateway now that our DB knows an attempt started
    let gatewayResult;
    try {
      gatewayResult = await gateway.initiatePayment({
        amount: amountToPay,
        currency: 'INR',
        reference: idempotencyKey,
        invoiceNumber: invoice.invoiceNumber,
        customerInfo: {
          name: student.fullName || `${student.firstName || ''} ${student.lastName || ''}`.trim() || 'Student',
          email: student.email || req.user.email,
          phone: student.phone || req.user.phone,
          admissionNumber: student.admissionNumber
        }
      });

      // Success call update status isolated
      await PaymentAttempt.findByIdAndUpdate(attempt._id, {
        status: 'PROCESSING',
        gatewayRefId: gatewayResult.gatewayRefId,
        gatewayResponse: gatewayResult.raw
      });
      await createAuditLog(attempt._id, null, req.user.tenantId, 'INITIATED', 'PROCESSING', 'STUDENT_PORTAL', 'Gateway returned checkout UI URL');

      // Build response — supports both redirect (ICICI) and popup (Razorpay) flows
      const responseData = {
        paymentAttemptId: attempt._id,
        paymentUrl: gatewayResult.paymentUrl, // null for Razorpay (popup), URL for ICICI (redirect)
        gatewayRefId: gatewayResult.gatewayRefId,
        provider: tenant.paymentGateway?.provider || 'unknown'
      };

      // Razorpay: include order details for frontend checkout popup
      if (gatewayResult.razorpayOrder) {
        responseData.razorpayOrder = gatewayResult.razorpayOrder;
      }

      return res.json({
        success: true,
        message: gatewayResult.paymentUrl ? 'Payment tracking started. Redirecting to gateway.' : 'Payment order created. Opening checkout.',
        data: responseData
      });

    } catch (gatewayErr) {
      // Failsafe if the API call flat out crashed/timed out prior to UI Generation
      await PaymentAttempt.findByIdAndUpdate(attempt._id, {
        status: 'FAILED',
        gatewayResponse: { error: gatewayErr.message }
      });
      await createAuditLog(attempt._id, null, req.user.tenantId, 'INITIATED', 'FAILED', 'STUDENT_PORTAL', `Gateway error establishing session: ${gatewayErr.message}`);

      res.status(502).json({ success: false, message: 'Payment gateway could not be reached right now. Try again later.', debug: process.env.NODE_ENV !== 'production' ? gatewayErr.message : undefined });
    }

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(400).json({ success: false, message: error.message || 'Payment initiation failed' });
  }
});

/**
 * @desc    Abandon a stuck INITIATED/PROCESSING payment attempt so the student can retry.
 *          Verifies with the gateway first to avoid losing a real success.
 * @route   POST /api/student-fees/attempts/:attemptId/abandon
 * @access  Private (Student)
 */
router.post('/attempts/:attemptId/abandon', protect, authorize('student', 'parent'), async(req, res) => {
  try {
    const { studentId, error: stuErr } = resolveStudentId(req);
    if (stuErr) return res.status(400).json({ success: false, message: stuErr });

    const attempt = await PaymentAttempt.findOne({
      _id: req.params.attemptId,
      studentId,
      tenantId: req.user.tenantId
    });

    if (!attempt) {
      return res.status(404).json({ success: false, message: 'Payment attempt not found' });
    }

    if (!['INITIATED', 'PROCESSING'].includes(attempt.status)) {
      return res.status(400).json({ success: false, message: `Cannot abandon a payment in '${attempt.status}' state.` });
    }

    // Confirm with gateway that no success has occurred — otherwise we'd lose a real payment.
    if (attempt.gatewayRefId) {
      try {
        const tenant = await Tenant.findById(req.user.tenantId).lean();
        const gateway = getGateway(tenant);
        if (gateway && typeof gateway.checkStatus === 'function') {
          const result = await gateway.checkStatus(attempt.gatewayRefId, attempt.idempotencyKey);
          if (result && ['SUCCESS', 'VERIFIED'].includes(result.status)) {
            // The previous version returned 409 and asked the student to
            // "refresh the page to see the receipt" — but no other path
            // would actually apply the settlement (the combined-pay
            // attempt covers multiple invoices, and the bank's payment
            // advice webhook isn't always wired). The result was both
            // invoices stuck on Pending forever and Q2 showing Pay Now
            // even though the student had already paid for it inside
            // the combined transaction. Settle inline here so cancel-
            // and-retry self-heals when the student returns from a
            // closed gateway window.
            const session = await mongoose.startSession();
            session.startTransaction();
            let settleResult;
            try {
              settleResult = await settleSuccessfulAttempt(attempt, session, {
                paymentMode: 'ONLINE',
                paymentDate: new Date(),
                transactionRefId: attempt.gatewayRefId || null,
                initiatedBy: 'student',
                triggerSource: 'STUDENT_PORTAL',
                note: 'Cancel-and-retry detected the payment had succeeded at the gateway — settled inline.'
              });
              await session.commitTransaction();
            } catch (txErr) {
              await session.abortTransaction();
              session.endSession();
              return res.status(500).json({
                success: false,
                message: 'Payment was confirmed at the bank but we could not record it. Please contact the school office.',
                debug: process.env.NODE_ENV !== 'production' ? txErr.message : undefined
              });
            }
            session.endSession();

            if (settleResult && !settleResult.alreadySettled) {
              await runPostSettlementSideEffects(attempt, settleResult.invoices, {
                receipts: settleResult.receipts,
                paymentMode: 'Online',
                paymentDate: new Date(),
                transactionRefId: attempt.gatewayRefId || null
              });
            }

            return res.json({
              success: true,
              message: settleResult?.alreadySettled
                ? 'This payment had already been settled. Refresh to see the receipt.'
                : `Payment confirmed at the bank. ${settleResult?.invoices?.length || 1} invoice(s) marked as paid.`,
              data: {
                status: 'SUCCESS',
                invoicesSettled: settleResult?.invoices?.length || 0,
                alreadySettled: !!settleResult?.alreadySettled
              }
            });
          }
        }
      } catch (gatewayErr) {
        // Gateway unreachable — be conservative and refuse.
        return res.status(502).json({
          success: false,
          message: 'Could not verify payment status with the gateway. Please try again in a moment.'
        });
      }
    }

    const previousStatus = attempt.status;
    attempt.status = 'FAILED';
    await attempt.save();
    await createAuditLog(attempt._id, null, req.user.tenantId, previousStatus, 'FAILED', 'STUDENT_PORTAL', 'Abandoned by student');

    return res.json({ success: true, message: 'Previous attempt cancelled. You can pay again now.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Failed to cancel attempt' });
  }
});

/**
 * @desc    Pay multiple invoices in one gateway transaction
 * @route   POST /api/student-fees/pay-combined
 * @access  Private (Student)
 */
router.post('/pay-combined', protect, authorize('student', 'parent'), [
  body('invoiceIds').isArray({ min: 2 }).withMessage('At least 2 invoice IDs required'),
  handleValidationErrors
], async(req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { invoiceIds } = req.body;

    const { student, error: stuErr } = await resolveStudent(req);
    if (stuErr) { await session.abortTransaction(); session.endSession(); return res.status(400).json({ success: false, message: stuErr }); }

    // Validate all invoices belong to this student and have balance
    const invoices = await FeeInvoice.find({
      _id: { $in: invoiceIds },
      studentId: student._id,
      tenantId: req.user.tenantId,
      status: { $nin: ['Paid', 'Cancelled'] }
    }).session(session);

    if (invoices.length === 0) {
      throw new Error('No payable invoices found');
    }

    // Check for stuck payments on any of the invoices
    const stuckAttempt = await PaymentAttempt.findOne({
      $or: [
        { invoiceId: { $in: invoiceIds } },
        { invoiceIds: { $in: invoiceIds } }
      ],
      status: { $in: ['PENDING', 'PROCESSING'] }
    }).session(session);

    if (stuckAttempt) {
      throw new Error('One of the selected invoices already has a payment undergoing verification. Please wait or check your history.');
    }

    const totalAmount = roundToRupee(invoices.reduce((sum, inv) => sum + toNumber(inv.balanceAmount), 0));
    const idempotencyKey = `idmp_combined_${student._id}_${Date.now()}`;

    const attempt = new PaymentAttempt({
      tenantId: req.user.tenantId,
      idempotencyKey,
      studentId: student._id,
      invoiceId: invoices[0]._id, // primary invoice (backward compat)
      invoiceIds: invoices.map(inv => inv._id),
      amount: totalAmount,
      status: 'INITIATED',
      triggerSource: req.user.role === 'parent' ? 'PARENT_PORTAL' : 'STUDENT_PORTAL'
    });

    await attempt.save({ session });
    await createAuditLog(attempt._id, session, req.user.tenantId, null, 'INITIATED', 'STUDENT_PORTAL',
      `Combined payment for ${invoices.length} invoices`);

    await session.commitTransaction();
    session.endSession();

    // Resolve gateway
    const tenant = await Tenant.findById(req.user.tenantId).lean();
    const gateway = getGateway(tenant);

    if (!gateway) {
      await PaymentAttempt.findByIdAndUpdate(attempt._id, { status: 'FAILED' });
      return res.status(400).json({ success: false, message: 'Online payments are not yet configured for your school.' });
    }

    try {
      // ICICI invoiceNo is alphanumeric, max 32 chars. We can't pack a
      // comma-separated list of Learnovo invoice numbers in there (commas
      // aren't in the alphanumeric set the bank accepts, and 3+ invoices
      // overflow 32 chars and get truncated mid-number). Send a synthetic
      // representative tag instead — same character set as a normal invoice
      // number, fits, and finance ops can still spot it in the CSV.
      const firstInvoiceNo = invoices.find(inv => inv.invoiceNumber)?.invoiceNumber || '';
      const combinedInvoiceLabel = firstInvoiceNo
        ? `MULTI-${invoices.length}-${firstInvoiceNo}`.slice(0, 32)
        : '';
      const gatewayResult = await gateway.initiatePayment({
        amount: totalAmount,
        currency: 'INR',
        reference: idempotencyKey,
        invoiceNumber: combinedInvoiceLabel,
        customerInfo: {
          name: student.fullName || `${student.firstName || ''} ${student.lastName || ''}`.trim() || 'Student',
          email: student.email || req.user.email,
          phone: student.phone || req.user.phone,
          admissionNumber: student.admissionNumber
        }
      });

      await PaymentAttempt.findByIdAndUpdate(attempt._id, {
        status: 'PROCESSING',
        gatewayRefId: gatewayResult.gatewayRefId,
        gatewayResponse: gatewayResult.raw
      });

      const responseData = {
        paymentAttemptId: attempt._id,
        paymentUrl: gatewayResult.paymentUrl,
        gatewayRefId: gatewayResult.gatewayRefId,
        provider: tenant.paymentGateway?.provider || 'unknown',
        invoiceCount: invoices.length,
        totalAmount
      };

      if (gatewayResult.razorpayOrder) {
        responseData.razorpayOrder = gatewayResult.razorpayOrder;
      }

      return res.json({ success: true, message: `Payment initiated for ${invoices.length} invoices.`, data: responseData });
    } catch (gatewayErr) {
      await PaymentAttempt.findByIdAndUpdate(attempt._id, { status: 'FAILED', gatewayResponse: { error: gatewayErr.message } });
      res.status(502).json({ success: false, message: 'Payment gateway could not be reached. Try again later.', debug: process.env.NODE_ENV !== 'production' ? gatewayErr.message : undefined });
    }
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(400).json({ success: false, message: error.message || 'Combined payment initiation failed' });
  }
});

/**
 * @desc    Submit manual payment proof for multiple invoices
 * @route   POST /api/student-fees/submit-payment-combined
 * @access  Private (Student)
 */
router.post('/submit-payment-combined', protect, authorize('student'), [
  body('invoiceIds').isArray({ min: 2 }).withMessage('At least 2 invoice IDs required'),
  body('paymentMode').isIn(['UPI', 'BANK_TRANSFER', 'CASH', 'CHEQUE', 'OTHER']).withMessage('Invalid payment mode'),
  body('paymentDate').isISO8601().withMessage('Valid payment date required'),
  handleValidationErrors
], async(req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { invoiceIds, paymentMode, paymentDate, transactionRefId, proofScreenshotUrl } = req.body;

    const invoices = await FeeInvoice.find({
      _id: { $in: invoiceIds },
      studentId: req.user._id,
      tenantId: req.user.tenantId,
      status: { $nin: ['Paid', 'Cancelled'] }
    }).session(session);

    if (invoices.length === 0) throw new Error('No payable invoices found');

    // Check for stuck payments
    const stuckAttempt = await PaymentAttempt.findOne({
      $or: [
        { invoiceId: { $in: invoiceIds } },
        { invoiceIds: { $in: invoiceIds } }
      ],
      status: { $in: ['PENDING', 'PROCESSING'] }
    }).session(session);
    if (stuckAttempt) throw new Error('One of the selected invoices already has a payment awaiting verification.');

    const totalAmount = roundToRupee(invoices.reduce((sum, inv) => sum + toNumber(inv.balanceAmount), 0));

    const attempt = new PaymentAttempt({
      tenantId: req.user.tenantId,
      idempotencyKey: `idmp_combined_manual_${req.user._id}_${Date.now()}`,
      studentId: req.user._id,
      invoiceId: invoices[0]._id,
      invoiceIds: invoices.map(inv => inv._id),
      amount: totalAmount,
      status: 'PENDING',
      triggerSource: 'STUDENT_PORTAL',
      paymentMode,
      paymentDate: new Date(paymentDate),
      transactionRefId: transactionRefId || null,
      proofScreenshotUrl: proofScreenshotUrl || null
    });

    await attempt.save({ session });
    await createAuditLog(attempt._id, session, req.user.tenantId, null, 'PENDING', 'STUDENT_PORTAL',
      `Combined manual payment for ${invoices.length} invoices: ${paymentMode}`);

    await session.commitTransaction();
    session.endSession();

    res.json({
      success: true,
      message: `Payment for ${invoices.length} invoices submitted for verification.`,
      data: { paymentAttemptId: attempt._id, status: 'PENDING', invoiceCount: invoices.length, totalAmount }
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(400).json({ success: false, message: error.message || 'Combined payment submission failed' });
  }
});

/**
 * @desc    Submit manual payment proof (when gateway is not enabled)
 * @route   POST /api/student-fees/:id/submit-payment
 * @access  Private (Student)
 */
router.post('/:id/submit-payment', protect, authorize('student'), [
  body('paymentMode').isIn(['UPI', 'BANK_TRANSFER', 'CASH', 'CHEQUE', 'OTHER']).withMessage('Invalid payment mode'),
  body('amount').isNumeric().custom(v => v > 0).withMessage('Amount must be positive'),
  body('paymentDate').isISO8601().withMessage('Valid payment date required'),
  body('transactionRefId').optional({ nullable: true }),
  body('proofScreenshotUrl').optional({ nullable: true })
], handleValidationErrors, async(req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const invoice = await FeeInvoice.findOne({
      _id: req.params.id,
      studentId: req.user._id,
      tenantId: req.user.tenantId
    }).session(session);

    if (!invoice) throw new Error('Invoice not found');
    if (invoice.status === 'Paid') throw new Error('This invoice is already fully paid.');

    // Block if there is already a pending submission for this invoice
    const existingPending = await PaymentAttempt.findOne({
      invoiceId: invoice._id,
      studentId: req.user._id,
      status: { $in: ['PENDING', 'PROCESSING', 'INITIATED', 'UNDER_REVIEW'] }
    }).session(session);

    if (existingPending) {
      throw new Error('You already have a payment awaiting verification for this invoice.');
    }

    const { paymentMode, amount, paymentDate, transactionRefId, proofScreenshotUrl } = req.body;

    // Amount cannot exceed balance (with tolerance)
    if (toNumber(amount) > toNumber(invoice.balanceAmount) + 0.01) {
      throw new Error(`Amount (${amount}) exceeds balance due (${roundToRupee(invoice.balanceAmount)}).`);
    }

    // Unique key per attempt. The existingPending check above is the real
    // idempotency guard (blocks if non-terminal attempt exists).
    const idempotencyKey = `manual_${invoice._id}_${req.user._id}_${Date.now()}`;

    const attempt = new PaymentAttempt({
      tenantId: req.user.tenantId,
      idempotencyKey,
      studentId: req.user._id,
      invoiceId: invoice._id,
      amount,
      status: 'PENDING',
      triggerSource: 'STUDENT_PORTAL',
      paymentMode,
      transactionRefId: transactionRefId || null,
      paymentDate: new Date(paymentDate),
      proofScreenshotUrl: proofScreenshotUrl || null
    });

    await attempt.save({ session });
    await createAuditLog(attempt._id, session, req.user.tenantId, null, 'PENDING', 'STUDENT_PORTAL', `Manual payment submitted: ${paymentMode}`);

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      success: true,
      message: 'Your payment has been submitted for verification. You will be notified once it is approved.',
      data: { paymentAttemptId: attempt._id, status: 'PENDING' }
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(400).json({ success: false, message: error.message || 'Payment submission failed' });
  }
});

/**
 * @desc    Check status of an ongoing payment attempt
 * @route   GET /api/student-fees/payment/:id/status
 * @access  Private (Student)
 */
router.get('/payment/:id/status', protect, authorize('student', 'parent'), async(req, res) => {
  try {
    const { studentId, error } = resolveStudentId(req);
    if (error) return res.status(400).json({ success: false, message: error });

    const attempt = await PaymentAttempt.findOne({
      _id: req.params.id,
      studentId,
      tenantId: req.user.tenantId
    });

    if (!attempt) return res.status(404).json({ success: false, message: 'Payment attempt not found' });

    // If it's already terminal, don't ping the gateway, just return
    if (['SUCCESS', 'FAILED', 'DISPUTED', 'VERIFIED'].includes(attempt.status)) {
      return res.json({ success: true, data: attempt });
    }

    // Skip gateway poll for manual payments (no gatewayRefId)
    if (!attempt.gatewayRefId) {
      return res.json({ success: true, data: attempt });
    }

    // It is PENDING or PROCESSING, verify with gateway
    const tenant = await Tenant.findById(req.user.tenantId).lean();
    const gateway = getGateway(tenant);
    if (!gateway) return res.json({ success: true, data: attempt });

    const gwResult = await gateway.checkStatus(attempt.gatewayRefId);

    if (gwResult.status !== attempt.status && ['SUCCESS', 'FAILED'].includes(gwResult.status)) {
      const previousStatus = attempt.status;

      if (gwResult.status === 'SUCCESS') {
        // Use transaction for SUCCESS path to ensure atomicity
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
          attempt.status = 'SUCCESS';
          await attempt.save({ session });

          const invoice = await FeeInvoice.findById(attempt.invoiceId).session(session);
          if (invoice) {
            // Safe rounding — pre-save hook handles balance + status
            invoice.paidAmount = roundToRupee(toNumber(invoice.paidAmount) + toNumber(attempt.amount));
            await invoice.save({ session });
          }

          // Generate Receipt
          const receiptNum = await Receipt.generateReceiptNumber(req.user.tenantId);
          await Receipt.create([{
            tenantId: req.user.tenantId,
            paymentAttemptId: attempt._id,
            studentId: req.user._id,
            invoiceId: attempt.invoiceId,
            receiptNumber: receiptNum
          }], { session });

          await createAuditLog(attempt._id, session, req.user.tenantId, previousStatus, 'SUCCESS', 'STUDENT_PORTAL', 'Status resolved via student poll.');

          await session.commitTransaction();
          session.endSession();
        } catch (txErr) {
          await session.abortTransaction();
          session.endSession();
          throw txErr;
        }
      } else {
        // FAILED path — no invoice update needed
        attempt.status = gwResult.status;
        await attempt.save();
        await createAuditLog(attempt._id, null, req.user.tenantId, previousStatus, gwResult.status, 'STUDENT_PORTAL', 'Status resolved via student poll.');
      }
    }

    res.json({
      success: true,
      data: attempt
    });

  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error checking status' });
  }
});

/**
 * @desc    Raise a dispute on a payment
 * @route   POST /api/student-fees/dispute
 * @access  Private (Student)
 */
router.post('/dispute', protect, authorize('student'), [
  body('invoiceId').notEmpty().withMessage('Invoice ID is required'),
  body('amount').isNumeric().custom(v => v > 0).withMessage('Valid positive amount is required'),
  body('studentNote').notEmpty().withMessage('Please describe the issue')
], handleValidationErrors, async(req, res) => {
  try {
    const { invoiceId, paymentAttemptId, transactionId, bankReferenceNumber, amount, studentNote } = req.body;

    // Ensure invoice belongs to student
    const invoice = await FeeInvoice.findOne({ _id: invoiceId, studentId: req.user._id });
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });

    const dispute = new PaymentDispute({
      tenantId: req.user.tenantId,
      studentId: req.user._id,
      invoiceId,
      paymentAttemptId, // optional if they don't know which attempt it was
      transactionId,
      bankReferenceNumber,
      amount,
      studentNote,
      status: 'RAISED'
    });

    await dispute.save();

    if (paymentAttemptId) {
      // Lock the attempt and log it
      await PaymentAttempt.findByIdAndUpdate(paymentAttemptId, { status: 'DISPUTED' });
      await createAuditLog(paymentAttemptId, null, req.user.tenantId, null, 'DISPUTED', 'STUDENT_PORTAL', 'Student raised a dispute');
    }

    res.status(201).json({ success: true, message: 'Dispute raised successfully. Admin will review.', data: dispute });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to raise dispute' });
  }
});

/**
 * @desc    Get dispute status
 * @route   GET /api/student-fees/dispute/:id
 * @access  Private (Student)
 */
router.get('/dispute/:id', protect, authorize('student', 'parent'), async(req, res) => {
  try {
    const { studentId, error } = resolveStudentId(req);
    if (error) return res.status(400).json({ success: false, message: error });

    const dispute = await PaymentDispute.findOne({
      _id: req.params.id,
      studentId,
      tenantId: req.user.tenantId
    }).populate('invoiceId', 'invoiceNumber totalAmount');

    if (!dispute) return res.status(404).json({ success: false, message: 'Dispute not found' });

    res.json({ success: true, data: dispute });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * @desc    Get all receipts for the logged-in student
 * @route   GET /api/student-fees/receipts
 * @access  Private (Student)
 */
router.get('/receipts', protect, authorize('student', 'parent'), async(req, res) => {
  try {
    const { studentId, error } = resolveStudentId(req);
    if (error) return res.status(400).json({ success: false, message: error });

    const tenantId = req.user.tenantId;

    const receipts = await Receipt.find({ studentId, tenantId })
      .populate('invoiceId', 'invoiceNumber totalAmount items')
      .populate('paymentAttemptId', 'gatewayRefId amount status paymentMode transactionRefId paymentDate triggerSource')
      .populate('verifiedByUserId', 'name fullName')
      .sort({ issuedAt: -1 })
      .lean();

    // Surface confirmed Payment rows that have no matching Receipt
    // (legacy ICICI settlements pre-fix, admin-recorded cash/cheque
    // payments, partial backfills). Normalise them into the same shape
    // the frontend renders so the student panel never silently misses
    // a payment that the admin panel shows.
    const coveredAttemptInvoicePairs = new Set(
      receipts.map(r => `${r.paymentAttemptId?._id || r.paymentAttemptId || ''}::${r.invoiceId?._id || r.invoiceId || ''}`)
    );
    const coveredInvoiceIds = new Set(
      receipts.filter(r => r.invoiceId).map(r => String(r.invoiceId?._id || r.invoiceId))
    );

    const payments = await Payment.find({ studentId, tenantId, isConfirmed: true })
      .populate('invoiceId', 'invoiceNumber totalAmount items')
      .sort({ paymentDate: -1 })
      .lean();

    const orphanReceipts = [];
    for (const p of payments) {
      const attemptId = p.transactionDetails?.transactionId || '';
      const invoiceId = String(p.invoiceId?._id || p.invoiceId || '');
      const pairKey = `${attemptId}::${invoiceId}`;
      // Skip if already represented by a Receipt (matched by attempt+invoice,
      // or by invoice alone for non-gateway payments).
      if (attemptId && coveredAttemptInvoicePairs.has(pairKey)) continue;
      if (!attemptId && invoiceId && coveredInvoiceIds.has(invoiceId)) continue;

      orphanReceipts.push({
        _id: p._id,
        tenantId: p.tenantId,
        studentId: p.studentId,
        invoiceId: p.invoiceId,
        receiptNumber: p.receiptNumber,
        amount: p.amount,
        paymentMode: p.paymentMethod,
        paymentDate: p.paymentDate,
        transactionRefId: p.transactionDetails?.referenceNumber || null,
        initiatedBy: 'admin',
        issuedAt: p.confirmedAt || p.paymentDate || p.createdAt,
        paymentAttemptId: attemptId
          ? {
            _id: attemptId,
            gatewayRefId: p.transactionDetails?.referenceNumber || null,
            amount: p.amount,
            status: 'SUCCESS',
            paymentMode: p.paymentMethod,
            transactionRefId: p.transactionDetails?.referenceNumber || null,
            paymentDate: p.paymentDate
          }
          : null,
        _source: 'payment'
      });
    }

    const combined = [...receipts, ...orphanReceipts]
      .sort((a, b) => new Date(b.issuedAt || 0) - new Date(a.issuedAt || 0));

    res.json({ success: true, data: combined });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error fetching receipts' });
  }
});

/**
 * @desc    Get a single receipt by receipt ID or paymentAttemptId
 * @route   GET /api/student-fees/receipt/:id
 * @access  Private (Student)
 */
router.get('/receipt/:id', protect, authorize('student', 'parent'), async(req, res) => {
  try {
    const { studentId, error } = resolveStudentId(req);
    if (error) return res.status(400).json({ success: false, message: error });

    // Try by receipt _id first, then by paymentAttemptId
    let receipt = await Receipt.findOne({
      _id: req.params.id,
      studentId,
      tenantId: req.user.tenantId
    });

    if (!receipt) {
      receipt = await Receipt.findOne({
        paymentAttemptId: req.params.id,
        studentId,
        tenantId: req.user.tenantId
      });
    }

    if (!receipt) return res.status(404).json({ success: false, message: 'Receipt not found' });

    await receipt.populate('invoiceId', 'invoiceNumber totalAmount items billingPeriod');
    await receipt.populate('paymentAttemptId', 'gatewayRefId amount status paymentMode transactionRefId paymentDate triggerSource');
    await receipt.populate('studentId', 'name fullName admissionNumber classId section parentName');
    await receipt.populate('verifiedByUserId', 'name fullName');

    // Populate student's classId
    if (receipt.studentId?.classId) {
      await receipt.populate('studentId.classId', 'name grade');
    }

    res.json({ success: true, data: receipt });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * @desc    Admin verifies a manual payment submission → generates receipt
 * @route   POST /api/student-fees/admin/verify-payment/:attemptId
 * @access  Private (Admin)
 */
router.post('/admin/verify-payment/:attemptId', protect, authorize('admin', 'accountant'), async(req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const attempt = await PaymentAttempt.findOne({
      _id: req.params.attemptId,
      tenantId: req.user.tenantId
    }).session(session);

    if (!attempt) throw new Error('Payment attempt not found');
    if (['SUCCESS', 'VERIFIED', 'FAILED'].includes(attempt.status)) {
      throw new Error(`Payment is already ${attempt.status}. Cannot verify again.`);
    }

    // Mark as VERIFIED
    const previousStatus = attempt.status;
    attempt.status = 'VERIFIED';
    attempt.verifiedBy = req.user._id;
    attempt.verifiedAt = new Date();
    await attempt.save({ session });

    // Apply payment to invoice(s) and generate receipts
    const receipts = await applyPaymentToInvoices(attempt, session, {
      paymentMode: attempt.paymentMode || 'OTHER',
      paymentDate: attempt.paymentDate || attempt.createdAt,
      transactionRefId: attempt.transactionRefId || null,
      initiatedBy: attempt.triggerSource === 'ADMIN_MANUAL' ? 'admin' : 'student',
      verifiedByUserId: req.user._id,
      verifiedByName: req.user.name || req.user.fullName || 'Admin'
    });
    const receipt = receipts[0];

    await createAuditLog(attempt._id, session, req.user.tenantId, previousStatus, 'VERIFIED', 'ADMIN_MANUAL', `Verified by ${req.user.name || 'Admin'}`);

    await session.commitTransaction();
    session.endSession();

    // Auto-sync to Finance module (non-blocking, outside transaction)
    try {
      const student = await User.findById(attempt.studentId).select('name fullName').lean();
      const inv = await FeeInvoice.findById(attempt.invoiceId).select('invoiceNumber academicSessionId').lean();
      await syncFeePaymentToIncome({
        tenantId: req.user.tenantId,
        paymentId: attempt._id,
        amount: attempt.amount,
        paymentDate: attempt.paymentDate || attempt.createdAt,
        paymentMethod: attempt.paymentMode || 'Cash',
        studentName: student?.fullName || student?.name || 'Student',
        invoiceNumber: inv?.invoiceNumber,
        addedBy: req.user._id,
        paymentReference: attempt.transactionRefId,
        referenceModel: 'PaymentAttempt',
        academicSessionId: inv?.academicSessionId
      });
    } catch (syncErr) {
      console.error('[Finance-AutoSync] admin verify sync failed (non-fatal):', syncErr.message);
    }

    res.json({
      success: true,
      message: 'Payment verified and receipt generated.',
      data: { attempt, receipt }
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(400).json({ success: false, message: error.message || 'Verification failed' });
  }
});

/**
 * @desc    Payment gateway webhook/notify endpoint
 * @route   POST /api/student-fees/payment/notify
 * @access  Public (called by payment gateway — NO auth required)
 *
 * This endpoint is called by the bank/payment gateway (HDFC, CCAvenue, Razorpay, etc.)
 * to notify the system of payment status changes. The request is verified using
 * the gateway's webhook signature before any state changes are made.
 */
router.post('/payment/notify', async(req, res) => {
  try {
    const { gatewayRefId, status } = req.body;

    if (!gatewayRefId) {
      return res.status(400).json({ success: false, message: 'Missing gatewayRefId' });
    }

    // Find the payment attempt by gateway reference
    const attempt = await PaymentAttempt.findOne({ gatewayRefId });
    if (!attempt) {
      console.warn(`[webhook] Unknown gatewayRefId: ${gatewayRefId}`);
      // Return 200 so the gateway doesn't keep retrying for unknown refs
      return res.status(200).json({ success: false, message: 'Unknown payment reference' });
    }

    // Resolve gateway for the attempt's tenant
    const tenant = await Tenant.findById(attempt.tenantId).lean();
    const gateway = getGateway(tenant);

    // Verify webhook signature using the gateway adapter
    const isValid = gateway ? gateway.verifyWebhookSignature(req.headers, JSON.stringify(req.body)) : false;
    if (!isValid) {
      console.error(`[webhook] Invalid signature for gatewayRefId: ${gatewayRefId}`);
      return res.status(403).json({ success: false, message: 'Invalid webhook signature' });
    }

    // Prevent re-processing terminal states
    if (['SUCCESS', 'FAILED', 'REFUNDED'].includes(attempt.status)) {
      return res.status(200).json({ success: true, message: 'Already processed' });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const previousStatus = attempt.status;
      const newStatus = status === 'SUCCESS' ? 'SUCCESS' : 'FAILED';

      // Update payment attempt
      attempt.status = newStatus;
      attempt.gatewayResponse = req.body;
      await attempt.save({ session });

      await createAuditLog(
        attempt._id, session, attempt.tenantId,
        previousStatus, newStatus, 'WEBHOOK',
        `Gateway webhook: ${status}`
      );

      // If payment succeeded, apply to invoice(s) and generate receipts
      if (newStatus === 'SUCCESS') {
        await applyPaymentToInvoices(attempt, session, { paymentMode: 'ONLINE' });
      }

      await session.commitTransaction();
      session.endSession();

      // Auto-sync to Finance module (non-blocking, outside transaction)
      if (newStatus === 'SUCCESS') {
        try {
          const student = await User.findById(attempt.studentId).select('name fullName').lean();
          const inv = await FeeInvoice.findById(attempt.invoiceId).select('invoiceNumber academicSessionId').lean();
          await syncFeePaymentToIncome({
            tenantId: attempt.tenantId,
            paymentId: attempt._id,
            amount: attempt.amount,
            paymentDate: new Date(),
            paymentMethod: 'Online',
            studentName: student?.fullName || student?.name || 'Student',
            invoiceNumber: inv?.invoiceNumber,
            addedBy: attempt.studentId,
            paymentReference: attempt.gatewayRefId,
            referenceModel: 'PaymentAttempt',
            academicSessionId: inv?.academicSessionId
          });
        } catch (syncErr) {
          console.error('[Finance-AutoSync] notify webhook sync failed (non-fatal):', syncErr.message);
        }
      }

      // Always return 200 to acknowledge receipt to the gateway
      res.status(200).json({ success: true, message: `Payment ${newStatus.toLowerCase()}` });
    } catch (txnError) {
      await session.abortTransaction();
      session.endSession();
      throw txnError;
    }
  } catch (error) {
    console.error('[webhook] Payment notify error:', error);
    // Return 500 so the gateway retries
    res.status(500).json({ success: false, message: 'Webhook processing failed' });
  }
});

/**
 * @desc    Razorpay payment verification (frontend popup callback)
 * @route   POST /api/student-fees/payment/razorpay-verify
 * @access  Private (student)
 *
 * After the Razorpay checkout popup closes, the frontend sends
 * razorpay_order_id, razorpay_payment_id, razorpay_signature here.
 */
router.post('/payment/razorpay-verify', protect, authorize('student'), async(req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, paymentAttemptId } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !paymentAttemptId) {
      return res.status(400).json({ success: false, message: 'Missing required payment verification fields' });
    }

    // Find the payment attempt
    const attempt = await PaymentAttempt.findOne({
      _id: paymentAttemptId,
      tenantId: req.user.tenantId,
      studentId: req.user._id
    });

    if (!attempt) {
      return res.status(404).json({ success: false, message: 'Payment attempt not found' });
    }

    if (attempt.status === 'SUCCESS') {
      return res.json({ success: true, message: 'Payment already verified', data: { status: 'SUCCESS' } });
    }

    // Resolve gateway and verify signature
    const tenant = await Tenant.findById(req.user.tenantId).lean();
    const gateway = getGateway(tenant);

    if (!gateway || typeof gateway.verifyPaymentSignature !== 'function') {
      return res.status(400).json({ success: false, message: 'Payment gateway not configured for verification' });
    }

    const isValid = gateway.verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
    if (!isValid) {
      attempt.status = 'FAILED';
      attempt.gatewayResponse = { error: 'Signature verification failed', ...req.body };
      await attempt.save();
      await createAuditLog(attempt._id, null, attempt.tenantId, 'PROCESSING', 'FAILED', 'STUDENT_PORTAL', 'Razorpay signature verification failed');
      return res.status(400).json({ success: false, message: 'Payment verification failed: invalid signature' });
    }

    // Signature valid — process payment
    const previousStatus = attempt.status;
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      attempt.status = 'SUCCESS';
      attempt.gatewayRefId = razorpay_payment_id;
      attempt.gatewayResponse = req.body;
      await attempt.save({ session });

      // Apply payment to invoice(s) and generate receipts
      const receipts = await applyPaymentToInvoices(attempt, session, {
        paymentMode: 'ONLINE',
        transactionRefId: razorpay_payment_id
      });
      const receiptNum = receipts[0]?.receiptNumber;

      await createAuditLog(attempt._id, session, attempt.tenantId, previousStatus, 'SUCCESS', 'STUDENT_PORTAL',
        `Razorpay payment verified. Payment ID: ${razorpay_payment_id}`);

      await session.commitTransaction();
      session.endSession();

      // Auto-sync to Finance module (non-blocking)
      try {
        const student = await User.findById(attempt.studentId).select('name fullName').lean();
        const inv = await FeeInvoice.findById(attempt.invoiceId).select('invoiceNumber academicSessionId').lean();
        await syncFeePaymentToIncome({
          tenantId: attempt.tenantId,
          paymentId: attempt._id,
          amount: attempt.amount,
          paymentDate: new Date(),
          paymentMethod: 'Online',
          studentName: student?.fullName || student?.name || 'Student',
          invoiceNumber: inv?.invoiceNumber,
          addedBy: attempt.studentId,
          paymentReference: razorpay_payment_id,
          referenceModel: 'PaymentAttempt',
          academicSessionId: inv?.academicSessionId
        });
      } catch (syncErr) {
        console.error('[Finance-AutoSync] Razorpay verify sync failed (non-fatal):', syncErr.message);
      }

      return res.json({
        success: true,
        message: 'Payment verified and recorded successfully',
        data: {
          status: 'SUCCESS',
          amount: attempt.amount,
          receiptNumber: receiptNum
        }
      });
    } catch (txErr) {
      await session.abortTransaction();
      session.endSession();
      throw txErr;
    }
  } catch (error) {
    console.error('[razorpay-verify] Error:', error);
    res.status(500).json({ success: false, message: error.message || 'Payment verification failed' });
  }
});

/**
 * @desc    Check if online payment gateway is enabled for this tenant
 * @route   GET /api/student-fees/gateway-status
 * @access  Private (student)
 */
/**
 * @desc    Get student receipt as printable HTML
 * @route   GET /api/student-fees/receipt/:id/html
 * @access  Private (Student, Parent)
 */
router.get('/receipt/:id/html', protect, authorize('student', 'parent'), async(req, res) => {
  try {
    const { studentId, error } = resolveStudentId(req);
    if (error) return res.status(400).send('Bad request');

    let receipt = await Receipt.findOne({ _id: req.params.id, studentId, tenantId: req.user.tenantId })
      .catch(() => null);
    if (!receipt) {
      receipt = await Receipt.findOne({ paymentAttemptId: req.params.id, studentId, tenantId: req.user.tenantId });
    }
    if (!receipt) return res.status(404).send('Receipt not found');

    await receipt.populate({
      path: 'studentId',
      select: 'name fullName admissionNumber studentId class section classId',
      populate: { path: 'classId', select: 'name' }
    });
    await receipt.populate('invoiceId', 'invoiceNumber items billingPeriod status balanceAmount periodLabel');
    await receipt.populate('paymentAttemptId', 'paymentMode transactionRefId');

    const paymentData = {
      receiptNumber: receipt.receiptNumber,
      amount: receipt.amount,
      paymentDate: receipt.paymentDate,
      paymentMethod: receipt.paymentMode || receipt.paymentAttemptId?.paymentMode || '-',
      studentId: receipt.studentId,
      invoiceId: receipt.invoiceId,
      initiatedBy: receipt.initiatedBy,
      transactionRefId: receipt.transactionRefId || receipt.paymentAttemptId?.transactionRefId
    };

    const Settings = require('../models/Settings');
    const tenant = await Tenant.findById(req.user.tenantId).select('schoolName schoolCode address phone email logo fullAddress');
    const settings = await Settings.getSettings(req.user.tenantId);
    const schoolData = tenant ? tenant.toObject() : {};
    if (settings?.institution) {
      if (settings.institution.contact?.phone) schoolData.phone = settings.institution.contact.phone;
      if (settings.institution.contact?.email) schoolData.email = settings.institution.contact.email;
      if (settings.institution.schoolCode) schoolData.schoolCode = settings.institution.schoolCode;
      if (settings.institution.udiseCode) schoolData.udiseCode = settings.institution.udiseCode;
      if (settings.institution.logo) schoolData.logo = settings.institution.logo;
      if (settings.institution.principalSignature) schoolData.principalSignature = settings.institution.principalSignature;
    }

    const { generateReceiptHtml } = require('../services/receiptPdfService');
    const html = await generateReceiptHtml(paymentData, schoolData);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error) {
    console.error('Student receipt HTML error:', error);
    if (!res.headersSent) res.status(500).send('Server error generating receipt');
  }
});

/**
 * @desc    Download student receipt as PDF
 * @route   GET /api/student-fees/receipt/:id/pdf
 * @access  Private (Student, Parent)
 */
router.get('/receipt/:id/pdf', protect, authorize('student', 'parent'), async(req, res) => {
  try {
    const { studentId, error } = resolveStudentId(req);
    if (error) return res.status(400).json({ success: false, message: error });

    let receipt = await Receipt.findOne({ _id: req.params.id, studentId, tenantId: req.user.tenantId })
      .catch(() => null);
    if (!receipt) {
      receipt = await Receipt.findOne({ paymentAttemptId: req.params.id, studentId, tenantId: req.user.tenantId });
    }
    if (!receipt) return res.status(404).json({ success: false, message: 'Receipt not found' });

    await receipt.populate({
      path: 'studentId',
      select: 'name fullName admissionNumber studentId class section classId',
      populate: { path: 'classId', select: 'name' }
    });
    await receipt.populate('invoiceId', 'invoiceNumber items billingPeriod status balanceAmount periodLabel');
    await receipt.populate('paymentAttemptId', 'paymentMode transactionRefId');

    const paymentData = {
      receiptNumber: receipt.receiptNumber,
      amount: receipt.amount,
      paymentDate: receipt.paymentDate,
      paymentMethod: receipt.paymentMode || receipt.paymentAttemptId?.paymentMode || '-',
      studentId: receipt.studentId,
      invoiceId: receipt.invoiceId,
      initiatedBy: receipt.initiatedBy,
      transactionRefId: receipt.transactionRefId || receipt.paymentAttemptId?.transactionRefId
    };

    const Settings = require('../models/Settings');
    const tenant = await Tenant.findById(req.user.tenantId).select('schoolName schoolCode address phone email logo fullAddress');
    const settings = await Settings.getSettings(req.user.tenantId);
    const schoolData = tenant ? tenant.toObject() : {};
    if (settings?.institution) {
      if (settings.institution.contact?.phone) schoolData.phone = settings.institution.contact.phone;
      if (settings.institution.contact?.email) schoolData.email = settings.institution.contact.email;
      if (settings.institution.schoolCode) schoolData.schoolCode = settings.institution.schoolCode;
      if (settings.institution.udiseCode) schoolData.udiseCode = settings.institution.udiseCode;
      if (settings.institution.logo) schoolData.logo = settings.institution.logo;
      if (settings.institution.principalSignature) schoolData.principalSignature = settings.institution.principalSignature;
    }

    const { generateReceiptPdf } = require('../services/receiptPdfService');
    const pdfBuffer = await generateReceiptPdf(paymentData, schoolData);
    const filename = `Receipt-${(receipt.receiptNumber || req.params.id).replace(/[^a-zA-Z0-9-_]/g, '_')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.end(pdfBuffer);
  } catch (error) {
    console.error('Student receipt PDF error:', error);
    if (!res.headersSent) res.status(500).json({ success: false, message: 'Server error generating receipt PDF' });
  }
});

module.exports = router;
