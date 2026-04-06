const { CronJob } = require('cron');
const mongoose = require('mongoose');
const { logger } = require('../middleware/errorHandler');

/**
 * Trial Expiry Job — runs every hour.
 * Finds tenants with status='trial' whose trialEndsAt has passed,
 * and sets their status to 'suspended' so they are locked out.
 */

async function runTrialExpiry() {
  const startTime = Date.now();
  logger.info('[trial-expiry] Job started');

  try {
    const Tenant = mongoose.model('Tenant');
    const now = new Date();

    const result = await Tenant.updateMany(
      {
        'subscription.status': 'trial',
        'subscription.trialEndsAt': { $ne: null, $lte: now }
      },
      {
        $set: { 'subscription.status': 'suspended' }
      }
    );

    const elapsed = Date.now() - startTime;
    logger.info(`[trial-expiry] Job finished: ${result.modifiedCount} tenant(s) suspended in ${elapsed}ms`);
  } catch (error) {
    logger.error('[trial-expiry] Job error', { error: error.message, stack: error.stack });
  }
}

function startJob() {
  // Run every hour at minute 5
  const job = new CronJob(
    '5 * * * *',
    runTrialExpiry,
    null,
    false,
    'Asia/Kolkata'
  );

  job.start();
  console.log('[trial-expiry] Job scheduled: every hour');

  // Run once on startup (after 10s to let DB connect)
  setTimeout(runTrialExpiry, 10000);
}

module.exports = { startJob, runTrialExpiry };
