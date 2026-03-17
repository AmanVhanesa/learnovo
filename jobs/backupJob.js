const { CronJob } = require('cron');
const mongoose = require('mongoose');
const backupService = require('../services/backupService');
const googleDriveService = require('../services/googleDriveService');
const { logger } = require('../middleware/errorHandler');

/**
 * Automatic daily backup job.
 * Runs at 2:00 AM IST for all active tenants.
 * Uploads to Google Drive (single file per tenant, overwritten).
 *
 * Enable via BACKUP_CRON_ENABLED=true in environment.
 */

async function runAutoBackup() {
  if (!googleDriveService.isConfigured()) {
    logger.info('Auto-backup skipped: Google Drive not configured');
    return;
  }

  logger.info('Auto-backup job started');

  try {
    const Tenant = mongoose.model('Tenant');
    const tenants = await Tenant.find({ isActive: true }).select('_id schoolName').lean();

    let successCount = 0;
    let failCount = 0;

    for (const tenant of tenants) {
      try {
        await backupService.createAndUploadBackup(tenant._id, null, 'scheduled');
        successCount++;
        logger.info(`Auto-backup completed for ${tenant.schoolName || tenant._id}`);
      } catch (err) {
        failCount++;
        logger.error(`Auto-backup failed for tenant ${tenant._id}`, err);
      }
    }

    logger.info(`Auto-backup job finished: ${successCount} succeeded, ${failCount} failed out of ${tenants.length} tenants`);
  } catch (error) {
    logger.error('Auto-backup job error', error);
  }
}

function startJob() {
  if (process.env.BACKUP_CRON_ENABLED !== 'true') {
    console.log('Auto-backup job disabled (set BACKUP_CRON_ENABLED=true to enable)');
    return;
  }

  const job = new CronJob(
    '0 2 * * *',      // 2:00 AM daily
    runAutoBackup,
    null,
    true,
    'Asia/Kolkata'     // IST timezone
  );

  job.start();
  console.log('Auto-backup job scheduled: daily at 2:00 AM IST');
}

module.exports = { startJob, runAutoBackup };
