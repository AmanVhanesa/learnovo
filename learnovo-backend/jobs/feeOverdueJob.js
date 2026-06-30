const { CronJob } = require('cron');
const mongoose = require('mongoose');
const { logger } = require('../middleware/errorHandler');

/**
 * Fee Invoice Overdue Sweep — runs daily at 01:00 IST.
 *
 * FeeInvoice status is normally derived in the model's pre('save') hook, but
 * that only fires when an invoice document is re-saved. An invoice created as
 * 'Pending' with a future dueDate never flips to 'Overdue' on its own once the
 * dueDate passes — nothing re-saves it. That leaves past-due invoices stuck as
 * 'Pending', so the dashboard "Overdue Amount" (status === 'Overdue') under-
 * reports relative to the actual unpaid-and-past-due balance.
 *
 * This job is the DB-consistency backstop, mirroring libraryOverdueJob and
 * homeworkStatusUpdater. It applies the same rule the model uses:
 *   Pending → Overdue  when dueDate < now AND balanceAmount > 0
 *
 * Note: partially-paid past-due invoices stay 'Partial' (the model's pre-save
 * hook ranks Partial above Overdue), so they are intentionally left untouched
 * here to keep DB state consistent with model-derived state.
 */
async function runFeeOverdueUpdate() {
  const start = Date.now();
  logger.info('[fee-overdue] Job started');

  try {
    const FeeInvoice = mongoose.model('FeeInvoice');
    const now = new Date();

    const result = await FeeInvoice.updateMany(
      {
        status: 'Pending',
        dueDate: { $lt: now },
        balanceAmount: { $gt: 0 }
      },
      { $set: { status: 'Overdue' } }
    );

    logger.info(`[fee-overdue] Job finished: ${result.modifiedCount} invoices marked Overdue in ${Date.now() - start}ms`);
  } catch (error) {
    logger.error('[fee-overdue] Job error', { error: error.message, stack: error.stack });
  }
}

function startJob() {
  // Daily at 01:00 IST — fee due dates are day-granular, so daily is enough.
  const job = new CronJob('0 1 * * *', runFeeOverdueUpdate, null, false, 'Asia/Kolkata');
  job.start();
  console.log('[fee-overdue] Job scheduled: daily 01:00 IST');

  // Run once shortly after startup to catch up.
  setTimeout(runFeeOverdueUpdate, 10000);
}

module.exports = { startJob, runFeeOverdueUpdate };
