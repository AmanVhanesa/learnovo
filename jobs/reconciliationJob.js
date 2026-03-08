const mongoose = require('mongoose');
const FeeInvoice = require('../models/FeeInvoice');
const PaymentAttempt = require('../models/PaymentAttempt');
const PaymentAuditLog = require('../models/PaymentAuditLog');
const Receipt = require('../models/Receipt');
const MockPaymentGateway = require('../services/payment/MockPaymentGateway');
const { logger } = require('../middleware/errorHandler');

const gateway = new MockPaymentGateway();

/**
 * Runs the reconciliation process for stuck PENDING and PROCESSING payments.
 */
async function runReconciliation() {
    try {
        const stuckAttempts = await PaymentAttempt.find({
            status: { $in: ['PENDING', 'PROCESSING'] }
        });

        if (stuckAttempts.length === 0) return;

        logger.info(`Reconciliation Job found ${stuckAttempts.length} stuck payments.`);

        const now = new Date();

        for (const attempt of stuckAttempts) {
            try {
                // If it's been stuck for over 24 hours, automatically escalate to DISPUTED to alert admins 
                const msIn24Hours = 24 * 60 * 60 * 1000;
                if (now.getTime() - attempt.createdAt.getTime() > msIn24Hours) {
                    const previousStatus = attempt.status;
                    attempt.status = 'DISPUTED';
                    await attempt.save();

                    await PaymentAuditLog.create({
                        tenantId: attempt.tenantId,
                        paymentAttemptId: attempt._id,
                        previousStatus,
                        newStatus: 'DISPUTED',
                        triggerSource: 'BACKGROUND_JOB',
                        note: 'Automatically disputed after 24 hours without gateway resolution.'
                    });

                    continue; // Skip polling gateway
                }

                // Poll gateway
                if (!attempt.gatewayRefId) continue; // Safety check

                const gwResult = await gateway.checkStatus(attempt.gatewayRefId);

                // If status evolved from gateway
                if (gwResult.status !== attempt.status && ['SUCCESS', 'FAILED'].includes(gwResult.status)) {
                    const previousStatus = attempt.status;
                    attempt.status = gwResult.status;

                    if (gwResult.status === 'SUCCESS') {
                        const invoice = await FeeInvoice.findById(attempt.invoiceId);
                        if (invoice) {
                            invoice.paidAmount += attempt.amount;
                            invoice.balanceAmount = invoice.totalAmount + invoice.lateFeeApplied - invoice.paidAmount;

                            if (invoice.balanceAmount <= 0) invoice.status = 'Paid';
                            else invoice.status = 'Partial';

                            await invoice.save();

                            // Ensure receipt gets generated 
                            const receiptNum = await Receipt.generateReceiptNumber(attempt.tenantId);
                            await Receipt.create({
                                tenantId: attempt.tenantId,
                                paymentAttemptId: attempt._id,
                                studentId: attempt.studentId,
                                invoiceId: invoice._id,
                                receiptNumber: receiptNum
                            });
                        }
                    }

                    await attempt.save();

                    await PaymentAuditLog.create({
                        tenantId: attempt.tenantId,
                        paymentAttemptId: attempt._id,
                        previousStatus,
                        newStatus: gwResult.status,
                        triggerSource: 'BACKGROUND_JOB',
                        note: 'Status reconciled from gateway polling.'
                    });
                }

            } catch (err) {
                logger.error(`Reconciliation failed for attempt ${attempt._id}`, err);
            }
        }
    } catch (e) {
        logger.error('Fatal error in reconciliation job wrapper', e);
    }
}

/**
 * Start the polling interval
 */
function startJob() {
    // Run every 5 minutes 
    const INTERVAL_MS = 5 * 60 * 1000;
    setInterval(runReconciliation, INTERVAL_MS);
    logger.info(`Reconciliation Job scheduled to run every 5 minutes`);

    // Quick invoke for dev testing if necessary 
    // runReconciliation();
}

module.exports = { startJob, runReconciliation };
