const express = require('express');
const { body, param } = require('express-validator');
const crypto = require('crypto');
const mongoose = require('mongoose');
const FeeInvoice = require('../models/FeeInvoice');
const PaymentAttempt = require('../models/PaymentAttempt');
const PaymentAuditLog = require('../models/PaymentAuditLog');
const PaymentDispute = require('../models/PaymentDispute');
const Receipt = require('../models/Receipt');
const { protect, authorize } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');

// Initialize Mock Gateway for now
const MockPaymentGateway = require('../services/payment/MockPaymentGateway');
const gateway = new MockPaymentGateway();

const router = express.Router();

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
 * @desc    Get all fee invoices assigned to the logged-in student
 * @route   GET /api/student-fees
 * @access  Private (Student)
 */
router.get('/', protect, authorize('student'), async (req, res) => {
    try {
        const invoices = await FeeInvoice.find({
            studentId: req.user._id,
            tenantId: req.user.tenantId
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
router.get('/history', protect, authorize('student'), async (req, res) => {
    try {
        const attempts = await PaymentAttempt.find({
            studentId: req.user._id,
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
 * @desc    Get single invoice detail heavily populated with history
 * @route   GET /api/student-fees/:id
 * @access  Private (Student)
 */
router.get('/:id', protect, authorize('student'), async (req, res) => {
    try {
        const invoice = await FeeInvoice.findOne({
            _id: req.params.id,
            studentId: req.user._id,
            tenantId: req.user.tenantId
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
router.post('/:id/pay', protect, authorize('student'), async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const invoice = await FeeInvoice.findOne({
            _id: req.params.id,
            studentId: req.user._id,
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

        // Generate Idempotency Key combining invoice and time to prevent immediate duplicate mashes
        const idempotencyKey = `idmp_${invoice._id}_${Date.now()}`;
        const amountToPay = invoice.balanceAmount;

        // 1. Create INITIATED attempt record FIRST before calling gateway
        const attempt = new PaymentAttempt({
            tenantId: req.user.tenantId,
            idempotencyKey,
            studentId: req.user._id,
            invoiceId: invoice._id,
            amount: amountToPay,
            status: 'INITIATED',
            triggerSource: 'STUDENT_PORTAL'
        });

        await attempt.save({ session });
        await createAuditLog(attempt._id, session, req.user.tenantId, null, 'INITIATED', 'STUDENT_PORTAL', 'Started payment flow');

        await session.commitTransaction();
        session.endSession();

        // 2. Safely call external gateway now that our DB knows an attempt started
        let gatewayResult;
        try {
            gatewayResult = await gateway.initiatePayment({
                amount: amountToPay,
                currency: 'INR',
                reference: idempotencyKey,
                customerInfo: { name: req.user.fullName, email: req.user.email }
            });

            // Success call update status isolated
            await PaymentAttempt.findByIdAndUpdate(attempt._id, {
                status: 'PROCESSING',
                gatewayRefId: gatewayResult.gatewayRefId,
                gatewayResponse: gatewayResult.raw
            });
            await createAuditLog(attempt._id, null, req.user.tenantId, 'INITIATED', 'PROCESSING', 'STUDENT_PORTAL', 'Gateway returned checkout UI URL');

            return res.json({
                success: true,
                message: 'Payment tracking started. Redirecting to gateway.',
                data: {
                    paymentAttemptId: attempt._id,
                    paymentUrl: gatewayResult.paymentUrl,
                    gatewayRefId: gatewayResult.gatewayRefId
                }
            });

        } catch (gatewayErr) {
            // Failsafe if the API call flat out crashed/timed out prior to UI Generation
            await PaymentAttempt.findByIdAndUpdate(attempt._id, {
                status: 'FAILED',
                gatewayResponse: { error: gatewayErr.message }
            });
            await createAuditLog(attempt._id, null, req.user.tenantId, 'INITIATED', 'FAILED', 'STUDENT_PORTAL', 'Gateway error establishing session');

            res.status(502).json({ success: false, message: 'Payment gateway could not be reached right now. Try again later.' });
        }

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        res.status(400).json({ success: false, message: error.message || 'Payment initiation failed' });
    }
});

/**
 * @desc    Check status of an ongoing payment attempt
 * @route   GET /api/student-fees/payment/:id/status
 * @access  Private (Student)
 */
router.get('/payment/:id/status', protect, authorize('student'), async (req, res) => {
    try {
        const attempt = await PaymentAttempt.findOne({
            _id: req.params.id,
            studentId: req.user._id,
            tenantId: req.user.tenantId
        });

        if (!attempt) return res.status(404).json({ success: false, message: 'Payment attempt not found' });

        // If it's already terminal, don't ping the gateway, just return
        if (['SUCCESS', 'FAILED', 'DISPUTED'].includes(attempt.status)) {
            return res.json({ success: true, data: attempt });
        }

        // It is PENDING or PROCESSING, we must verify with gateway
        const gwResult = await gateway.checkStatus(attempt.gatewayRefId);

        if (gwResult.status !== attempt.status) {
            // State evolved
            const previousStatus = attempt.status;
            attempt.status = gwResult.status;

            // If it resolved to SUCCESS, we MUST update the invoice to Paid
            if (gwResult.status === 'SUCCESS') {
                const invoice = await FeeInvoice.findById(attempt.invoiceId);
                invoice.paidAmount += attempt.amount;
                invoice.balanceAmount = invoice.totalAmount + invoice.lateFeeApplied - invoice.paidAmount;

                if (invoice.balanceAmount <= 0) invoice.status = 'Paid';
                else invoice.status = 'Partial';

                await invoice.save();

                // Generate Receipt
                const receiptNum = await Receipt.generateReceiptNumber(req.user.tenantId);
                const receipt = new Receipt({
                    tenantId: req.user.tenantId,
                    paymentAttemptId: attempt._id,
                    studentId: req.user._id,
                    invoiceId: invoice._id,
                    receiptNumber: receiptNum
                });
                await receipt.save();
            }

            await attempt.save();
            await createAuditLog(
                attempt._id,
                null,
                req.user.tenantId,
                previousStatus,
                gwResult.status,
                'STUDENT_PORTAL',
                'Student manually polled status update.'
            );
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
    body('invoiceId').notEmpty(),
    body('amount').isNumeric(),
    body('studentNote').notEmpty()
], async (req, res) => {
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
router.get('/dispute/:id', protect, authorize('student'), async (req, res) => {
    try {
        const dispute = await PaymentDispute.findOne({
            _id: req.params.id,
            studentId: req.user._id,
            tenantId: req.user.tenantId
        }).populate('invoiceId', 'invoiceNumber totalAmount');

        if (!dispute) return res.status(404).json({ success: false, message: 'Dispute not found' });

        res.json({ success: true, data: dispute });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

/**
 * @desc    Get receipt logic (mocked PDF stream for now, frontend drives it via components)
 * @route   GET /api/student-fees/receipt/:id
 * @access  Private (Student)
 */
router.get('/receipt/:id', protect, authorize('student'), async (req, res) => {
    try {
        const receipt = await Receipt.findOne({
            _id: req.params.id,
            studentId: req.user._id,
            tenantId: req.user.tenantId
        }).populate('invoiceId', 'invoiceNumber')
            .populate('paymentAttemptId', 'gatewayRefId amount status');

        if (!receipt) return res.status(404).json({ success: false, message: 'Receipt not found' });

        // Typically we use pdfkit to pipe a stream here. 
        // For now, we return the robust JSON graph so the Frontend React component can render & print it client-side.
        res.json({ success: true, data: receipt });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
