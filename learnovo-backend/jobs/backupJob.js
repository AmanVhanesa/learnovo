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
  logger.info('Auto-backup job started');

  // Check if Google Drive is available
  let driveAvailable = false;
  if (googleDriveService.isConfigured()) {
    const connection = await googleDriveService.checkConnection();
    driveAvailable = connection.ok;
    if (!driveAvailable) {
      logger.error(`Auto-backup: Google Drive connection failed — ${connection.error}. Falling back to local-only backups.`);
    }
  } else {
    logger.info('Auto-backup: Google Drive not configured, running local-only backups');
  }

  try {
    const Tenant = mongoose.model('Tenant');
    const tenants = await Tenant.find({ isActive: true }).select('_id schoolName').lean();

    let successCount = 0;
    let failCount = 0;

    for (const tenant of tenants) {
      try {
        if (driveAvailable) {
          await backupService.createAndUploadBackup(tenant._id, null, 'scheduled');
        } else {
          // Fallback: create backup buffer and log it (local-only)
          await backupService.createLocalBackup(tenant._id, null, 'scheduled');
        }
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
    false,
    'Asia/Kolkata'     // IST timezone
  );

  job.start();
  console.log('Auto-backup job scheduled: daily at 2:00 AM IST');
}

module.exports = { startJob, runAutoBackup };
