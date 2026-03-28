const mongoose = require('mongoose');
const FeeInvoice = require('../models/FeeInvoice');
const PaymentAttempt = require('../models/PaymentAttempt');
const PaymentAuditLog = require('../models/PaymentAuditLog');
const Receipt = require('../models/Receipt');
const StudentBalance = require('../models/StudentBalance');
const MockPaymentGateway = require('../services/payment/MockPaymentGateway');
const { logger } = require('../middleware/errorHandler');
const { toNumber, roundToRupee } = require('../utils/money');

const gateway = new MockPaymentGateway();

// Prevent overlapping runs
let isRunning = false;

/**
 * Runs the reconciliation process for stuck PENDING and PROCESSING payments.
 * Uses transactions to ensure data consistency when updating invoices.
 */
async function runReconciliation() {
  if (isRunning) {
    logger.info('Reconciliation Job skipped — previous run still in progress.');
    return;
  }

  isRunning = true;

  try {
    // Process in batches per tenant to avoid cross-tenant issues
    const stuckAttempts = await PaymentAttempt.find({
      status: { $in: ['PENDING', 'PROCESSING'] }
    }).limit(500); // Cap batch size to prevent memory issues

    if (stuckAttempts.length === 0) return;

    logger.info(`Reconciliation Job found ${stuckAttempts.length} stuck payments.`);

    const now = new Date();
    const msIn24Hours = 24 * 60 * 60 * 1000;

    for (const attempt of stuckAttempts) {
      try {
        // If stuck for over 24 hours, escalate to DISPUTED
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

          continue;
        }

        // Skip manual payments (no gatewayRefId) — they are verified by admin
        if (!attempt.gatewayRefId) continue;

        const gwResult = await gateway.checkStatus(attempt.gatewayRefId);

        if (gwResult.status !== attempt.status && ['SUCCESS', 'FAILED'].includes(gwResult.status)) {
          const previousStatus = attempt.status;

          if (gwResult.status === 'SUCCESS') {
            // Use transaction for SUCCESS path (modifies invoice + creates receipt)
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

                const receiptNum = await Receipt.generateReceiptNumber(attempt.tenantId);
                await Receipt.create([{
                  tenantId: attempt.tenantId,
                  paymentAttemptId: attempt._id,
                  studentId: attempt.studentId,
                  invoiceId: invoice._id,
                  receiptNumber: receiptNum
                }], { session });
              }

              await PaymentAuditLog.create([{
                tenantId: attempt.tenantId,
                paymentAttemptId: attempt._id,
                previousStatus,
                newStatus: 'SUCCESS',
                triggerSource: 'BACKGROUND_JOB',
                note: 'Status reconciled from gateway polling.'
              }], { session });

              await session.commitTransaction();
              session.endSession();

              // Update balance outside transaction (best effort)
              if (invoice) {
                try {
                  await StudentBalance.updateBalance(
                    attempt.tenantId,
                    attempt.studentId,
                    invoice.academicSessionId
                  );
                } catch (balErr) {
                  logger.error(`Balance update failed for student ${attempt.studentId}`, balErr);
                }
              }
            } catch (txErr) {
              await session.abortTransaction();
              session.endSession();
              throw txErr;
            }
          } else {
            // FAILED path — simpler, no invoice update needed
            attempt.status = gwResult.status;
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
        }

      } catch (err) {
        logger.error(`Reconciliation failed for attempt ${attempt._id}`, err);
      }
    }
  } catch (e) {
    logger.error('Fatal error in reconciliation job wrapper', e);
  } finally {
    isRunning = false;
  }
}

/**
 * Start the polling interval
 */
function startJob() {
  const INTERVAL_MS = 5 * 60 * 1000;
  setInterval(runReconciliation, INTERVAL_MS);
  logger.info('Reconciliation Job scheduled to run every 5 minutes');
}

module.exports = { startJob, runReconciliation };
