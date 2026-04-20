const FeeInvoice = require('../models/FeeInvoice');
const FeePaymentOrder = require('../models/FeePaymentOrder');
const Payment = require('../models/Payment');
const User = require('../models/User');
const { logger } = require('../middleware/errorHandler');
const { syncFeePaymentToIncome } = require('./financeAutoSyncService');
const { toNumber } = require('../utils/money');

/**
 * Single entry-point to confirm a fee payment.
 *
 * Used by: Razorpay webhook, verify callback, background reconciliation job,
 * and the bank-MIS reconciliation admin action.
 *
 * Idempotent — safe to call repeatedly for the same order/txn. Returns
 * { created: boolean, paymentId, receiptNumber, invoiceId }.
 */
async function confirmFeePayment({
  tenantId,
  invoiceId,
  amount,
  paymentMethod = 'Online',
  gatewayOrderId,
  gatewayPaymentId,
  orderDocId,
  actorUserId,
  source = 'WEBHOOK',
  remarks
}) {
  if (!tenantId) throw new Error('tenantId is required');
  if (!invoiceId) throw new Error('invoiceId is required');
  if (!(toNumber(amount) > 0)) throw new Error('amount must be > 0');

  const dedupeKey = gatewayPaymentId || gatewayOrderId;
  if (dedupeKey) {
    const existing = await Payment.findOne({
      tenantId,
      $or: [
        { 'transactionDetails.transactionId': dedupeKey },
        { 'transactionDetails.referenceNumber': dedupeKey }
      ]
    }).select('_id receiptNumber invoiceId').lean();

    if (existing) {
      return {
        created: false,
        paymentId: existing._id,
        receiptNumber: existing.receiptNumber,
        invoiceId: existing.invoiceId,
        alreadyConfirmed: true
      };
    }
  }

  const invoice = await FeeInvoice.findOne({ _id: invoiceId, tenantId });
  if (!invoice) throw new Error('Invoice not found for this tenant');

  if (invoice.status !== 'Paid') {
    await invoice.recordPayment(toNumber(amount));
  }

  if (orderDocId) {
    const order = await FeePaymentOrder.findOne({ _id: orderDocId, tenantId });
    if (order && order.status !== 'paid') {
      order.status = 'paid';
      order.paidAt = new Date();
      if (gatewayPaymentId) order.razorpayPaymentId = gatewayPaymentId;
      if (source === 'WEBHOOK') order.verifiedViaWebhook = true;
      if (source === 'CALLBACK') order.verifiedViaCallback = true;
      await order.save();
    }
  }

  const receiptNumber = await Payment.generateReceiptNumber(tenantId);
  const payment = await Payment.create({
    tenantId,
    receiptNumber,
    studentId: invoice.studentId,
    invoiceId: invoice._id,
    academicSessionId: invoice.academicSessionId,
    amount: toNumber(amount),
    paymentMethod,
    paymentDate: new Date(),
    transactionDetails: {
      transactionId: gatewayPaymentId || gatewayOrderId || null,
      referenceNumber: gatewayOrderId || null
    },
    remarks: remarks || `Payment confirmed via ${source}${gatewayOrderId ? ` (Order: ${gatewayOrderId})` : ''}`,
    isConfirmed: true,
    confirmedAt: new Date(),
    confirmedBy: actorUserId,
    collectedBy: actorUserId
  });

  try {
    const student = await User.findById(invoice.studentId).select('name fullName').lean();
    await syncFeePaymentToIncome({
      tenantId,
      paymentId: payment._id,
      amount: toNumber(amount),
      paymentDate: new Date(),
      paymentMethod,
      studentName: student?.fullName || student?.name || 'Student',
      invoiceNumber: invoice.invoiceNumber,
      addedBy: actorUserId,
      paymentReference: gatewayPaymentId || gatewayOrderId,
      referenceModel: 'Payment',
      academicSessionId: invoice.academicSessionId
    });
  } catch (syncErr) {
    logger.error('[Finance-AutoSync] confirmFeePayment sync failed (non-fatal)', syncErr);
  }

  return {
    created: true,
    paymentId: payment._id,
    receiptNumber,
    invoiceId: invoice._id
  };
}

module.exports = { confirmFeePayment };
