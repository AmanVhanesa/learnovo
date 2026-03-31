const { CronJob } = require('cron');
const mongoose = require('mongoose');
const { logger } = require('../middleware/errorHandler');

/**
 * Homework Status Updater — runs every 10 minutes.
 * Updates homework status based on assignedDate and dueDate:
 *   pending  → assignedDate in the future
 *   active   → assignedDate <= now AND dueDate (end of day) >= now
 *   overdue  → dueDate < now AND dueDate + 7 days >= now
 *   expired  → dueDate + 7 days < now
 *
 * Query-time enrichment is the primary approach (in homeworkService.js).
 * This cron job is the secondary approach for DB consistency.
 */

async function runHomeworkStatusUpdate() {
  const startTime = Date.now();
  logger.info('[homework-status] Job started');

  try {
    const Homework = mongoose.model('Homework');
    const now = new Date();

    // End of today for due date comparison
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    // 7 days ago (end of day) for expired threshold
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(23, 59, 59, 999);

    let totalUpdated = 0;

    // 1. pending → active: assignedDate <= now AND dueDate >= today (end of day)
    const toActive = await Homework.updateMany(
      {
        isActive: true,
        status: { $ne: 'active' },
        assignedDate: { $lte: now },
        dueDate: { $gte: new Date(now.toISOString().split('T')[0]) } // start of today
      },
      { $set: { status: 'active' } }
    );
    totalUpdated += toActive.modifiedCount;

    // 2. active → overdue: dueDate (end of day) < now AND dueDate + 7 days >= now
    const toOverdue = await Homework.updateMany(
      {
        isActive: true,
        status: { $in: ['pending', 'active'] },
        dueDate: { $lt: new Date(now.toISOString().split('T')[0]), $gte: sevenDaysAgo }
      },
      { $set: { status: 'overdue' } }
    );
    totalUpdated += toOverdue.modifiedCount;

    // 3. overdue → expired: dueDate + 7 days < now
    const toExpired = await Homework.updateMany(
      {
        isActive: true,
        status: { $in: ['pending', 'active', 'overdue'] },
        dueDate: { $lt: sevenDaysAgo }
      },
      { $set: { status: 'expired' } }
    );
    totalUpdated += toExpired.modifiedCount;

    const elapsed = Date.now() - startTime;
    logger.info(`[homework-status] Job finished: ${totalUpdated} updated (active: ${toActive.modifiedCount}, overdue: ${toOverdue.modifiedCount}, expired: ${toExpired.modifiedCount}) in ${elapsed}ms`);
  } catch (error) {
    logger.error('[homework-status] Job error', { error: error.message, stack: error.stack });
  }
}

function startJob() {
  // Run every 10 minutes
  const job = new CronJob(
    '*/10 * * * *',
    runHomeworkStatusUpdate,
    null,
    true,
    'Asia/Kolkata'
  );

  job.start();
  console.log('[homework-status] Job scheduled: every 10 minutes');

  // Run once on startup to catch up
  setTimeout(runHomeworkStatusUpdate, 5000);
}

module.exports = { startJob, runHomeworkStatusUpdate };
