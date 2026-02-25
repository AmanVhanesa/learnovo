const express = require('express');
const { body } = require('express-validator');
const mongoose = require('mongoose');
const FeeInvoice = require('../models/FeeInvoice');
const PaymentAttempt = require('../models/PaymentAttempt');
const PaymentAuditLog = require('../models/PaymentAuditLog');
const PaymentDispute = require('../models/PaymentDispute');
const { protect, authorize } = require('../middleware/auth');

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
    return session ? log.save({ session }) : log.save();
}

/**
 * @desc    Get all disputes and stuck payments
 * @route   GET /api/admin-disputes
 * @access  Private (Admin)
 */
router.get('/', protect, authorize('admin'), async (req, res) => {
    try {
        // Find all active disputes
        const disputes = await PaymentDispute.find({
            tenantId: req.user.tenantId,
            status: { $in: ['RAISED', 'UNDER_REVIEW'] }
        })
            .populate('studentId', 'fullName email')
            .populate('invoiceId', 'invoiceNumber totalAmount')
            .populate('paymentAttemptId', 'gatewayRefId status createdAt amount')
            .sort({ createdAt: -1 });

        // Find payments stuck pending for older than 1 hour to warn admin
        const stuckPayments = await PaymentAttempt.find({
            tenantId: req.user.tenantId,
            status: 'PENDING',
            createdAt: { $lt: new Date(Date.now() - 60 * 60 * 1000) } // Older than 1h
        })
            .populate('studentId', 'fullName')
            .populate('invoiceId', 'invoiceNumber totalAmount');

        res.json({
            success: true,
            data: { disputes, stuckPayments }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

/**
 * @desc    Resolve a dispute manually
 * @route   POST /api/admin-disputes/:id/resolve
 * @access  Private (Admin)
 */
router.post('/:id/resolve', protect, authorize('admin'), [
    body('resolutionAction').isIn(['APPROVE', 'REJECT']),
    body('adminNote').notEmpty()
], async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { resolutionAction, adminNote } = req.body;

        const dispute = await PaymentDispute.findOne({
            _id: req.params.id,
            tenantId: req.user.tenantId
        }).session(session);

        if (!dispute) throw new Error('Dispute not found');
        if (['RESOLVED', 'REJECTED'].includes(dispute.status)) {
            throw new Error('Dispute already finalized');
        }

        const newDisputeStatus = resolutionAction === 'APPROVE' ? 'RESOLVED' : 'REJECTED';
        dispute.status = newDisputeStatus;
        dispute.adminNote = adminNote;
        dispute.resolvedAt = new Date();
        dispute.resolvedBy = req.user._id;

        await dispute.save({ session });

        // If the dispute had a linked attempt, we should finalize its terminal state
        if (dispute.paymentAttemptId) {
            const attempt = await PaymentAttempt.findById(dispute.paymentAttemptId).session(session);

            if (attempt && attempt.status !== 'SUCCESS') {
                const previousAttemptStatus = attempt.status;
                const newAttemptStatus = resolutionAction === 'APPROVE' ? 'SUCCESS' : 'FAILED';

                attempt.status = newAttemptStatus;
                await attempt.save({ session });

                await createAuditLog(
                    attempt._id,
                    session,
                    req.user.tenantId,
                    previousAttemptStatus,
                    newAttemptStatus,
                    'ADMIN_MANUAL',
                    `Admin resolved dispute ${dispute._id}. Action: ${resolutionAction}`
                );

                // If approved, mark invoice as paid
                if (resolutionAction === 'APPROVE') {
                    const invoice = await FeeInvoice.findById(attempt.invoiceId).session(session);
                    if (invoice) {
                        invoice.paidAmount += attempt.amount;
                        invoice.balanceAmount = invoice.totalAmount + invoice.lateFeeApplied - invoice.paidAmount;
                        invoice.status = invoice.balanceAmount <= 0 ? 'Paid' : 'Partial';
                        await invoice.save({ session });
                    }
                }
            }
        }

        await session.commitTransaction();
        session.endSession();

        res.json({
            success: true,
            message: `Dispute marked as ${newDisputeStatus}`,
            data: dispute
        });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        res.status(400).json({ success: false, message: error.message || 'Resolution failed' });
    }
});

module.exports = router;
