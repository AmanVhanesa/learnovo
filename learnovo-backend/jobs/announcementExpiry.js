const { CronJob } = require('cron');
const mongoose = require('mongoose');
const { logger } = require('../middleware/errorHandler');

/**
 * Announcement Expiry Job — runs every 15 minutes.
 * Marks announcements as inactive when their expiresAt date has passed.
 *
 * Query-time filtering is the primary approach (in announcementService.js).
 * This cron job is the secondary approach for DB consistency — sets isActive=false
 * so that even raw DB queries reflect the expired state.
 */

async function runAnnouncementExpiry() {
  const startTime = Date.now();
  logger.info('[announcement-expiry] Job started');

  try {
    const Announcement = mongoose.model('Announcement');
    const now = new Date();

    // Find active announcements with expiresAt in the past and mark inactive
    const result = await Announcement.updateMany(
      {
        isActive: true,
        expiresAt: { $ne: null, $lte: now }
      },
      { $set: { isActive: false } }
    );

    const elapsed = Date.now() - startTime;
    logger.info(`[announcement-expiry] Job finished: ${result.modifiedCount} expired in ${elapsed}ms`);
  } catch (error) {
    logger.error('[announcement-expiry] Job error', { error: error.message, stack: error.stack });
  }
}

function startJob() {
  // Run every 15 minutes
  const job = new CronJob(
    '*/15 * * * *',
    runAnnouncementExpiry,
    null,
    true,
    'Asia/Kolkata'
  );

  job.start();
  console.log('[announcement-expiry] Job scheduled: every 15 minutes');

  // Run once on startup to catch up
  setTimeout(runAnnouncementExpiry, 7000);
}

module.exports = { startJob, runAnnouncementExpiry };
