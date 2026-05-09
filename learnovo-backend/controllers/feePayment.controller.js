const crypto = require('crypto');
const FeePaymentOrder = require('../models/FeePaymentOrder');
const FeeInvoice = require('../models/FeeInvoice');
const Payment = require('../models/Payment');
const User = require('../models/User');
const { toNumber } = require('../utils/money');
const { logger } = require('../middleware/errorHandler');
const { syncFeePaymentToIncome } = require('../services/financeAutoSyncService');
const { mapOnlineMode } = require('../utils/onlineModeMap');

// ─── Initialize Razorpay (lazy load) ────────────────────────────
let razorpayInstance = null;

try {
  const Razorpay = require('razorpay');
  if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
    razorpayInstance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });
  }
} catch {
  console.warn('Razorpay SDK not installed. Fee payments will use mock mode.');
}

/**
 * ──────────────────────────────────────────────────────────────────
 * CREATE ORDER
 * ──────────────────────────────────────────────────────────────────
 *
 * Step 1 of the payment flow.
 *
 * The frontend calls this when a parent clicks "Pay Now" on an invoice.
 * We ask Razorpay to create an "order" — this locks the amount so the
 * parent can't tamper with it on the frontend.
 *
 * POST /api/fee-payments/create-order
 * Body: { invoiceId: "..." }
 */
exports.createOrder = async(req, res, next) => {
  try {
    const { invoiceId } = req.body;

    // ── Validate input ──────────────────────────────────────
    if (!invoiceId) {
      return res.status(400).json({
        success: false,
        message: 'invoiceId is required'
      });
    }

    // ── Find the invoice ────────────────────────────────────
    // We filter by tenantId to make sure a parent from School A
    // can't pay an invoice from School B.
    const invoice = await FeeInvoice.findOne({
      _id: invoiceId,
      tenantId: req.user.tenantId
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    // ── Check if invoice can be paid ────────────────────────
    if (invoice.status === 'Paid') {
      return res.status(400).json({
        success: false,
        message: 'This invoice is already fully paid'
      });
    }

    if (invoice.status === 'Cancelled') {
      return res.status(400).json({
        success: false,
        message: 'This invoice has been cancelled'
      });
    }

    // ── Calculate the amount to pay ─────────────────────────
    // balanceAmount = totalAmount + lateFee - paidAmount
    // This is the remaining amount the parent needs to pay.
    const amountInRupees = toNumber(invoice.balanceAmount);

    if (amountInRupees <= 0) {
      return res.status(400).json({
        success: false,
        message: 'No balance remaining on this invoice'
      });
    }

    // ── Convert to paise ────────────────────────────────────
    // Razorpay works in the smallest currency unit.
    // ₹5000 = 500000 paise. We multiply by 100.
    const amountInPaise = Math.round(amountInRupees * 100);

    // ── Create Razorpay Order ───────────────────────────────
    let razorpayOrder;

    if (razorpayInstance) {
      // REAL MODE: Ask Razorpay to create an order
      razorpayOrder = await razorpayInstance.orders.create({
        amount: amountInPaise,
        currency: 'INR',
        receipt: invoice.invoiceNumber,   // Our internal reference
        notes: {
          invoiceId: invoice._id.toString(),
          studentId: invoice.studentId.toString(),
          tenantId: req.user.tenantId.toString(),
          invoiceNumber: invoice.invoiceNumber
        }
      });
    } else {
      // MOCK MODE: For development without Razorpay keys
      razorpayOrder = {
        id: `order_mock_${  Date.now()}`,
        amount: amountInPaise,
        currency: 'INR',
        receipt: invoice.invoiceNumber,
        status: 'created'
      };
    }

    // ── Save the order in our database ──────────────────────
    // This lets us track every payment attempt, even if the parent
    // closes the browser before completing.
    const _paymentOrder = await FeePaymentOrder.create({
      tenantId: req.user.tenantId,
      invoiceId: invoice._id,
      studentId: invoice.studentId,
      paidBy: req.user._id,
      razorpayOrderId: razorpayOrder.id,
      amount: amountInRupees,
      currency: 'INR',
      status: 'created'
    });

    // ── Send response to frontend ───────────────────────────
    // The frontend needs these to open the Razorpay checkout popup.
    res.status(201).json({
      success: true,
      message: 'Payment order created',
      data: {
        orderId: razorpayOrder.id,
        amount: amountInPaise,          // Razorpay expects paise
        amountInRupees: amountInRupees,  // For display
        currency: 'INR',
        invoiceNumber: invoice.invoiceNumber,
        // The frontend needs this key to open the Razorpay popup
        razorpayKeyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_mock',
        mock: !razorpayInstance
      }
    });
  } catch (error) {
    logger.error('Create fee payment order failed', error, {
      userId: req.user?._id,
      body: req.body
    });
    next(error);
  }
};

/**
 * ──────────────────────────────────────────────────────────────────
 * VERIFY PAYMENT
 * ──────────────────────────────────────────────────────────────────
 *
 * Step 2 of the payment flow (frontend callback).
 *
 * After the parent completes payment in the Razorpay popup, Razorpay
 * calls our frontend with paymentId + signature. The frontend sends
 * these to this endpoint.
 *
 * We verify the signature to make sure the payment is real, then
 * update the invoice.
 *
 * POST /api/fee-payments/verify
 * Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 */
exports.verifyPayment = async(req, res, next) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    } = req.body;

    // ── Validate input ──────────────────────────────────────
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'Missing payment verification fields: razorpay_order_id, razorpay_payment_id, razorpay_signature'
      });
    }

    // ── Find our order record ───────────────────────────────
    const paymentOrder = await FeePaymentOrder.findOne({
      razorpayOrderId: razorpay_order_id,
      tenantId: req.user.tenantId
    });

    if (!paymentOrder) {
      return res.status(404).json({
        success: false,
        message: 'Payment order not found'
      });
    }

    // ── Already processed? ──────────────────────────────────
    // Prevent double-processing (idempotency)
    if (paymentOrder.status === 'paid') {
      return res.json({
        success: true,
        message: 'Payment already verified',
        data: { status: 'paid' }
      });
    }

    // ── SIGNATURE VERIFICATION ──────────────────────────────
    //
    // This is THE most important security step.
    //
    // Razorpay creates a "signature" by doing:
    //   HMAC-SHA256(order_id + "|" + payment_id, your_secret_key)
    //
    // We do the same calculation. If our result matches the
    // signature Razorpay sent, the payment is genuine.
    //
    // If someone fakes a request, they can't generate the correct
    // signature because they don't have your secret key.

    if (razorpayInstance) {
      // Concatenate order_id and payment_id with a pipe separator
      const body = `${razorpay_order_id  }|${  razorpay_payment_id}`;

      // Create HMAC using your secret key
      const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(body)
        .digest('hex');

      // Compare signatures
      if (expectedSignature !== razorpay_signature) {
        // SIGNATURE MISMATCH — this is either a bug or an attack
        paymentOrder.status = 'failed';
        paymentOrder.failedAt = new Date();
        await paymentOrder.save();

        logger.error('Payment signature verification failed', null, {
          orderId: razorpay_order_id,
          paymentId: razorpay_payment_id
        });

        return res.status(400).json({
          success: false,
          message: 'Payment verification failed: invalid signature'
        });
      }
    }
    // In mock mode, we skip signature verification

    // ── Signature valid! Update everything. ─────────────────

    // 1. Update our payment order record
    paymentOrder.razorpayPaymentId = razorpay_payment_id;
    paymentOrder.razorpaySignature = razorpay_signature;
    paymentOrder.status = 'paid';
    paymentOrder.paidAt = new Date();
    paymentOrder.verifiedViaCallback = true;
    await paymentOrder.save();

    // 2. Update the fee invoice (add to paidAmount, recalculate status)
    const invoice = await FeeInvoice.findById(paymentOrder.invoiceId);
    if (invoice && invoice.status !== 'Paid') {
      await invoice.recordPayment(paymentOrder.amount);
    }

    // 3. Fetch the payment from Razorpay to learn which sub-mode the
    //    student actually used (UPI / card / netbanking / wallet …).
    //    Best-effort: if the fetch fails, we still record the payment
    //    without onlineMode rather than failing the verification.
    let onlineMode;
    if (razorpayInstance) {
      try {
        const rzpPayment = await razorpayInstance.payments.fetch(razorpay_payment_id);
        onlineMode = mapOnlineMode(rzpPayment?.method);
      } catch (fetchErr) {
        logger.warn('Razorpay payment fetch failed (non-fatal)', {
          paymentId: razorpay_payment_id,
          error: fetchErr.message
        });
      }
    }

    // 4. Create a Payment record (for receipts and accounting)
    const receiptNumber = await Payment.generateReceiptNumber(paymentOrder.tenantId);
    await Payment.create({
      tenantId: paymentOrder.tenantId,
      receiptNumber,
      studentId: paymentOrder.studentId,
      invoiceId: paymentOrder.invoiceId,
      academicSessionId: invoice?.academicSessionId,
      amount: paymentOrder.amount,
      paymentMethod: 'Online',
      paymentDate: new Date(),
      transactionDetails: {
        transactionId: razorpay_payment_id,
        referenceNumber: razorpay_order_id,
        ...(onlineMode ? { onlineMode } : {}),
        ...(onlineMode === 'UPI' ? { upiId: razorpay_payment_id } : {})
      },
      remarks: `Online payment via Razorpay (Order: ${razorpay_order_id})`,
      isConfirmed: true,            // Online payments are auto-confirmed
      confirmedAt: new Date(),
      confirmedBy: req.user._id,
      collectedBy: req.user._id
    });

    // Auto-sync to Finance module (non-blocking)
    try {
      const student = await User.findById(paymentOrder.studentId).select('name fullName').lean();
      await syncFeePaymentToIncome({
        tenantId: paymentOrder.tenantId,
        paymentId: paymentOrder._id,
        amount: paymentOrder.amount,
        paymentDate: new Date(),
        paymentMethod: 'Online',
        studentName: student?.fullName || student?.name || 'Student',
        invoiceNumber: invoice?.invoiceNumber,
        addedBy: req.user._id,
        paymentReference: razorpay_payment_id,
        referenceModel: 'FeePaymentOrder',
        academicSessionId: invoice?.academicSessionId
      });
    } catch (syncErr) {
      logger.error('[Finance-AutoSync] verifyPayment sync failed (non-fatal)', syncErr);
    }

    res.json({
      success: true,
      message: 'Payment verified and recorded successfully',
      data: {
        status: 'paid',
        amount: paymentOrder.amount,
        receiptNumber,
        invoiceNumber: invoice?.invoiceNumber
      }
    });
  } catch (error) {
    logger.error('Verify fee payment failed', error, {
      userId: req.user?._id,
      body: req.body
    });
    next(error);
  }
};

/**
 * ──────────────────────────────────────────────────────────────────
 * WEBHOOK HANDLER
 * ──────────────────────────────────────────────────────────────────
 *
 * The safety net. Even if the parent's browser crashes after paying,
 * Razorpay will call this URL to confirm the payment.
 *
 * IMPORTANT: This endpoint has NO authentication middleware.
 * It's called by Razorpay's servers, not by a logged-in user.
 * We verify it using the webhook signature instead.
 *
 * POST /api/fee-payments/webhook
 * Headers: x-razorpay-signature (set by Razorpay)
 * Body: { event: "payment.captured", payload: { ... } }
 */
exports.handleWebhook = async(req, res) => {
  try {
    // ── Verify webhook signature ────────────────────────────
    //
    // Razorpay signs the ENTIRE request body with your webhook
    // secret. This is different from payment verification — here
    // we use RAZORPAY_WEBHOOK_SECRET, not RAZORPAY_KEY_SECRET.

    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (webhookSecret) {
      const receivedSignature = req.headers['x-razorpay-signature'];

      // req.rawBody must be available — we need the raw string,
      // not the parsed JSON, for signature verification.
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(req.rawBody || JSON.stringify(req.body))
        .digest('hex');

      if (expectedSignature !== receivedSignature) {
        logger.error('Webhook signature mismatch', null, {
          received: receivedSignature
        });
        // Return 200 anyway — otherwise Razorpay will keep retrying
        return res.status(200).json({ status: 'signature_invalid' });
      }
    }

    // ── Process the event ───────────────────────────────────
    const event = req.body.event;
    const paymentEntity = req.body.payload?.payment?.entity;

    logger.info('Razorpay webhook received', null, {
      event,
      paymentId: paymentEntity?.id,
      orderId: paymentEntity?.order_id
    });

    // We only care about "payment.captured" — this means money
    // has been successfully deducted from the parent's account.
    if (event === 'payment.captured' && paymentEntity) {
      const orderId = paymentEntity.order_id;
      const paymentId = paymentEntity.id;

      // Find our order record
      const paymentOrder = await FeePaymentOrder.findOne({
        razorpayOrderId: orderId
      });

      if (!paymentOrder) {
        logger.warn('Webhook: order not found', null, { orderId });
        return res.status(200).json({ status: 'order_not_found' });
      }

      // ── Idempotency check ───────────────────────────────
      // If the frontend callback already processed this, the
      // webhook should not process it again. But we still mark
      // that the webhook arrived (for audit trail).
      if (paymentOrder.status === 'paid') {
        paymentOrder.verifiedViaWebhook = true;
        paymentOrder.webhookPayload = req.body;
        await paymentOrder.save();
        return res.status(200).json({ status: 'already_processed' });
      }

      // ── Update payment order ────────────────────────────
      paymentOrder.razorpayPaymentId = paymentId;
      paymentOrder.status = 'paid';
      paymentOrder.paidAt = new Date();
      paymentOrder.verifiedViaWebhook = true;
      paymentOrder.webhookPayload = req.body;
      paymentOrder.paymentMethod = paymentEntity.method || 'other';
      await paymentOrder.save();

      // ── Update invoice ──────────────────────────────────
      const invoice = await FeeInvoice.findById(paymentOrder.invoiceId);
      if (invoice && invoice.status !== 'Paid') {
        await invoice.recordPayment(paymentOrder.amount);
      }

      // ── Create Payment record (if not already created) ──
      const existingPayment = await Payment.findOne({
        'transactionDetails.transactionId': paymentId,
        tenantId: paymentOrder.tenantId
      });

      if (!existingPayment) {
        const onlineMode = mapOnlineMode(paymentEntity.method);
        const receiptNumber = await Payment.generateReceiptNumber(paymentOrder.tenantId);
        await Payment.create({
          tenantId: paymentOrder.tenantId,
          receiptNumber,
          studentId: paymentOrder.studentId,
          invoiceId: paymentOrder.invoiceId,
          academicSessionId: invoice?.academicSessionId,
          amount: paymentOrder.amount,
          paymentMethod: 'Online',
          paymentDate: new Date(),
          transactionDetails: {
            transactionId: paymentId,
            referenceNumber: orderId,
            ...(onlineMode ? { onlineMode } : {}),
            ...(onlineMode === 'UPI' ? { upiId: paymentId } : {})
          },
          remarks: `Online payment via Razorpay webhook (Order: ${orderId})`,
          isConfirmed: true,
          confirmedAt: new Date(),
          confirmedBy: paymentOrder.paidBy,
          collectedBy: paymentOrder.paidBy
        });

        // Auto-sync to Finance module (non-blocking)
        try {
          const student = await User.findById(paymentOrder.studentId).select('name fullName').lean();
          await syncFeePaymentToIncome({
            tenantId: paymentOrder.tenantId,
            paymentId: paymentOrder._id,
            amount: paymentOrder.amount,
            paymentDate: new Date(),
            paymentMethod: 'Online',
            studentName: student?.fullName || student?.name || 'Student',
            invoiceNumber: invoice?.invoiceNumber,
            addedBy: paymentOrder.paidBy,
            paymentReference: paymentId,
            referenceModel: 'FeePaymentOrder',
            academicSessionId: invoice?.academicSessionId
          });
        } catch (syncErr) {
          logger.error('[Finance-AutoSync] webhook sync failed (non-fatal)', syncErr);
        }
      }

      logger.info('Webhook: payment processed', null, {
        orderId,
        paymentId,
        amount: paymentOrder.amount
      });
    }

    // ── Handle payment failures ─────────────────────────────
    if (event === 'payment.failed' && paymentEntity) {
      const orderId = paymentEntity.order_id;
      const paymentOrder = await FeePaymentOrder.findOne({
        razorpayOrderId: orderId
      });

      if (paymentOrder && paymentOrder.status === 'created') {
        paymentOrder.status = 'failed';
        paymentOrder.failedAt = new Date();
        paymentOrder.webhookPayload = req.body;
        await paymentOrder.save();
      }
    }

    // ALWAYS return 200 to Razorpay — otherwise it will retry
    // the webhook up to 24 hours, flooding your server.
    res.status(200).json({ status: 'ok' });
  } catch (error) {
    logger.error('Webhook processing error', error, {
      body: req.body
    });
    // Still return 200 — we don't want Razorpay to keep retrying
    res.status(200).json({ status: 'error_logged' });
  }
};

/**
 * ──────────────────────────────────────────────────────────────────
 * GET PAYMENT STATUS
 * ──────────────────────────────────────────────────────────────────
 *
 * Lets the frontend check if a payment went through.
 * Useful when the parent's browser refreshes after paying.
 *
 * GET /api/fee-payments/status/:orderId
 */
exports.getPaymentStatus = async(req, res, next) => {
  try {
    const paymentOrder = await FeePaymentOrder.findOne({
      razorpayOrderId: req.params.orderId,
      tenantId: req.user.tenantId
    }).select('status amount razorpayOrderId razorpayPaymentId paidAt');

    if (!paymentOrder) {
      return res.status(404).json({
        success: false,
        message: 'Payment order not found'
      });
    }

    res.json({
      success: true,
      data: paymentOrder
    });
  } catch (error) {
    next(error);
  }
};
