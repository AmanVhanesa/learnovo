const { CronJob } = require('cron');
const { logger } = require('../middleware/errorHandler');
const libraryService = require('../services/libraryService');

/**
 * Library Overdue Sweep — runs daily at 02:15 IST.
 * - Marks overdue book issues whose dueDate has passed.
 * - Expires reservations past their expiresAt.
 */
async function run() {
  const start = Date.now();
  try {
    const overdue = await libraryService.markOverdue();
    const expired = await libraryService.expireReservations();
    logger.info(`[library-overdue] swept overdue=${overdue} expiredReservations=${expired} in ${Date.now() - start}ms`);
  } catch (err) {
    logger.error('[library-overdue] error', { error: err.message, stack: err.stack });
  }
}

function startJob() {
  const job = new CronJob('15 2 * * *', run, null, false, 'Asia/Kolkata');
  job.start();
  console.log('[library-overdue] Job scheduled: daily 02:15 IST');
  setTimeout(run, 10000);
}

module.exports = { startJob, run };
