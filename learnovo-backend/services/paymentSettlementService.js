const FeeInvoice = require('../models/FeeInvoice');
const Receipt = require('../models/Receipt');
const Payment = require('../models/Payment');
const PaymentAuditLog = require('../models/PaymentAuditLog');
const StudentBalance = require('../models/StudentBalance');
const User = require('../models/User');
const { toNumber, roundToRupee, isFullyPaid } = require('../utils/money');
const { syncFeePaymentToIncome } = require('./financeAutoSyncService');
const { logger } = require('../middleware/errorHandler');

/**
 * Resolve all invoice IDs covered by a PaymentAttempt — supports both the
 * single-invoice and combined (invoiceIds[]) shapes.
 */
function getAttemptInvoiceIds(attempt) {
  if (attempt.invoiceIds && attempt.invoiceIds.length > 0) return attempt.invoiceIds;
  return attempt.invoiceId ? [attempt.invoiceId] : [];
}

/**
 * Apply a payment amount across one or more invoices. Updates each invoice's
 * paidAmount/balanceAmount/status, generates a Receipt per invoice with full
 * detail (amount, paymentMode, transactionRefId, etc.), and returns the
 * receipts. Must be called inside an open Mongoose session (transaction).
 */
async function applyPaymentToInvoices(attempt, session, opts = {}) {
  const invoiceIds = getAttemptInvoiceIds(attempt);
  if (invoiceIds.length === 0) return { receipts: [], invoices: [] };

  const invoices = await FeeInvoice.find({
    _id: { $in: invoiceIds },
    tenantId: attempt.tenantId
  }).session(session);

  let remaining = toNumber(attempt.amount);
  const receipts = [];
  const touched = [];

  for (const invoice of invoices) {
    if (remaining <= 0) break;
    const balance = toNumber(invoice.balanceAmount);
    if (balance <= 0) continue;

    const applyAmount = Math.min(remaining, balance);
    const newPaid = roundToRupee(toNumber(invoice.paidAmount) + applyAmount);
    invoice.paidAmount = newPaid;
    invoice.balanceAmount = roundToRupee(toNumber(invoice.totalAmount) - newPaid);

    if (isFullyPaid(invoice.totalAmount, newPaid)) {
      invoice.status = 'Paid';
      invoice.paidDate = new Date();
    } else {
      invoice.status = 'Partially Paid';
    }

    await invoice.save({ session });
    remaining = roundToRupee(remaining - applyAmount);

    const receiptNum = await Receipt.generateReceiptNumber(attempt.tenantId);
    const receipt = new Receipt({
      tenantId: attempt.tenantId,
      paymentAttemptId: attempt._id,
      studentId: attempt.studentId,
      invoiceId: invoice._id,
      receiptNumber: receiptNum,
      amount: applyAmount,
      paymentMode: opts.paymentMode || 'ONLINE',
      paymentDate: opts.paymentDate || new Date(),
      transactionRefId: opts.transactionRefId || null,
      ...(opts.initiatedBy && { initiatedBy: opts.initiatedBy }),
      ...(opts.verifiedByUserId && { verifiedByUserId: opts.verifiedByUserId }),
      ...(opts.verifiedByName && { verifiedByName: opts.verifiedByName })
    });
    await receipt.save({ session });
    receipts.push(receipt);

    // Mirror into the legacy Payment collection. The Fees & Finance
    // dashboard's "Total Collected" / "This Month" / "Recent Payments" /
    // method-breakdown widgets all aggregate Payment, so a gateway
    // settlement that only writes Receipt would never show up. Dedupe
    // via (tenantId, invoiceId, paymentAttemptId) so a re-run doesn't
    // duplicate.
    const existingPayment = await Payment.findOne({
      tenantId: attempt.tenantId,
      paymentAttemptId: attempt._id,
      invoiceId: invoice._id
    }).session(session);

    if (!existingPayment) {
      const paymentReceiptNum = await Payment.generateReceiptNumber(attempt.tenantId);
      // Field convention (matches Razorpay flow):
      //   transactionDetails.transactionId  → gateway's bank txn ID (UTR / RRN)
      //   transactionDetails.referenceNumber → our merchant txn ref sent to bank
      //   paymentAttemptId (top-level)      → internal PaymentAttempt link (dedup)
      const gatewayTxnId = opts.transactionRefId || attempt.gatewayRefId || null;
      const merchantRef = attempt.gatewayRefId || null;
      await Payment.create([{
        tenantId: attempt.tenantId,
        receiptNumber: paymentReceiptNum,
        studentId: attempt.studentId,
        invoiceId: invoice._id,
        paymentAttemptId: attempt._id,
        academicSessionId: invoice.academicSessionId,
        amount: applyAmount,
        paymentMethod: 'Online',
        paymentDate: opts.paymentDate || new Date(),
        transactionDetails: {
          transactionId: gatewayTxnId,
          referenceNumber: merchantRef,
          ...(opts.onlineMode ? { onlineMode: opts.onlineMode } : {}),
          ...(opts.onlineMode === 'UPI' && gatewayTxnId ? { upiId: gatewayTxnId } : {})
        },
        remarks: opts.note || `Online payment via gateway (Attempt: ${attempt._id})`,
        isConfirmed: true,
        confirmedAt: new Date(),
        confirmedBy: opts.actorUserId || attempt.studentId,
        collectedBy: opts.actorUserId || attempt.studentId
      }], { session });
    }

    touched.push(invoice);
  }

  return { receipts, invoices: touched };
}

/**
 * Settle a successful PaymentAttempt end-to-end. This is the single
 * source of truth for "payment succeeded — do all the things":
 *
 *   1. Mark attempt SUCCESS (or VERIFIED) and save audit log.
 *   2. Apply amount across invoices, mark Paid/Partially Paid, set
 *      paidDate, and create a Receipt per invoice with full detail.
 *   3. Recalculate StudentBalance.
 *   4. Sync to Income (Finance module) so total collection updates.
 *
 * Idempotent: if attempt is already SUCCESS/VERIFIED with receipts, no-ops.
 *
 * Called from: ICICI Orange callback processor, reconciliation sweep,
 * Razorpay verify, admin manual verification.
 */
async function settleSuccessfulAttempt(attempt, session, opts = {}) {
  const previousStatus = attempt.status;
  const newStatus = opts.status || 'SUCCESS';

  // Guard against double-settlement: if this attempt already has receipts,
  // bail without touching invoices again. Receipt is the marker that the
  // financial side of settlement happened.
  const existingReceipt = await Receipt.findOne({
    paymentAttemptId: attempt._id,
    tenantId: attempt.tenantId
  }).session(session);

  if (existingReceipt && ['SUCCESS', 'VERIFIED'].includes(previousStatus)) {
    return { receipts: [existingReceipt], invoices: [], alreadySettled: true };
  }

  attempt.status = newStatus;
  if (opts.gatewayResponseExtras) {
    attempt.gatewayResponse = {
      ...(attempt.gatewayResponse || {}),
      ...opts.gatewayResponseExtras
    };
  }
  if (newStatus === 'VERIFIED') {
    attempt.verifiedBy = opts.verifiedByUserId || attempt.verifiedBy;
    attempt.verifiedAt = new Date();
  }
  await attempt.save({ session });

  const { receipts, invoices } = existingReceipt
    ? { receipts: [existingReceipt], invoices: [] }
    : await applyPaymentToInvoices(attempt, session, opts);

  await PaymentAuditLog.create([{
    tenantId: attempt.tenantId,
    paymentAttemptId: attempt._id,
    previousStatus,
    newStatus,
    triggerSource: opts.triggerSource || 'BACKGROUND_JOB',
    note: opts.note || 'Payment settled.'
  }], { session });

  return { receipts, invoices, alreadySettled: false };
}

/**
 * Post-settlement side effects that must run OUTSIDE the Mongoose
 * transaction: balance recompute and finance auto-sync. Both are
 * best-effort — failures are logged, never thrown.
 */
async function runPostSettlementSideEffects(attempt, invoices, opts = {}) {
  // Balance recalc per affected academic session
  const seenSessions = new Set();
  for (const invoice of invoices) {
    const sessionKey = String(invoice.academicSessionId || '');
    if (seenSessions.has(sessionKey)) continue;
    seenSessions.add(sessionKey);
    try {
      await StudentBalance.updateBalance(
        attempt.tenantId,
        attempt.studentId,
        invoice.academicSessionId
      );
    } catch (err) {
      logger.error('paymentSettlement: balance recalc failed', {
        attemptId: String(attempt._id),
        studentId: String(attempt.studentId),
        error: err.message
      });
    }
  }

  // Finance auto-sync — one Income record per invoice receipt so totals
  // reflect every payment, not just one collapsed entry.
  let student = null;
  try {
    student = await User.findById(attempt.studentId).select('name fullName').lean();
  } catch (_) { /* fall through with null student */ }

  for (const invoice of invoices) {
    const receiptForInvoice = (opts.receipts || []).find(r => String(r.invoiceId) === String(invoice._id));
    const incomeAmount = receiptForInvoice ? toNumber(receiptForInvoice.amount) : toNumber(attempt.amount);
    try {
      await syncFeePaymentToIncome({
        tenantId: attempt.tenantId,
        paymentId: receiptForInvoice?._id || attempt._id,
        amount: incomeAmount,
        paymentDate: opts.paymentDate || new Date(),
        paymentMethod: opts.paymentMode || 'Online',
        studentName: student?.fullName || student?.name || 'Student',
        invoiceNumber: invoice.invoiceNumber,
        addedBy: opts.actorUserId || attempt.studentId,
        paymentReference: opts.transactionRefId || attempt.gatewayRefId || null,
        referenceModel: 'PaymentAttempt',
        academicSessionId: invoice.academicSessionId
      });
    } catch (err) {
      logger.error('paymentSettlement: finance auto-sync failed (non-fatal)', {
        attemptId: String(attempt._id),
        invoiceId: String(invoice._id),
        error: err.message
      });
    }
  }
}

module.exports = {
  getAttemptInvoiceIds,
  applyPaymentToInvoices,
  settleSuccessfulAttempt,
  runPostSettlementSideEffects
};
