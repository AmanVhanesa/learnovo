const { CronJob } = require('cron');
const mongoose = require('mongoose');
const { logger } = require('../middleware/errorHandler');

/**
 * Exam Status Updater — runs every 5 minutes.
 * Updates exam status based on date + startTime + endTime:
 *   Scheduled → date/startTime in the future
 *   Ongoing   → now is between startTime and endTime on exam date
 *   Completed → endTime has passed
 *
 * NEVER overrides 'Cancelled' status — admin's manual cancel is sacred.
 *
 * Query-time enrichment is the primary approach (in routes/exams.js).
 * This cron job is the secondary approach for DB consistency.
 */

function buildExamDateTimes(exam) {
  const examDate = new Date(exam.date);

  const startDT = new Date(examDate);
  if (exam.startTime) {
    const [h, m] = exam.startTime.split(':').map(Number);
    startDT.setHours(h, m, 0, 0);
  } else {
    startDT.setHours(0, 0, 0, 0);
  }

  let endDT = new Date(examDate);
  if (exam.endTime) {
    const [h, m] = exam.endTime.split(':').map(Number);
    endDT.setHours(h, m, 0, 0);
  } else if (exam.startTime) {
    // No end time but has start → assume 2 hours
    endDT = new Date(startDT.getTime() + 2 * 60 * 60 * 1000);
  } else {
    endDT.setHours(23, 59, 59, 999);
  }

  return { startDT, endDT };
}

async function runExamStatusUpdate() {
  const startTime = Date.now();
  logger.info('[exam-status] Job started');

  try {
    const Exam = mongoose.model('Exam');
    const now = new Date();

    // Only process non-cancelled exams that may need status updates.
    // Use date range to limit scan: exams from yesterday to tomorrow cover ongoing transitions.
    const twoDaysAgo = new Date(now);
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    const exams = await Exam.find({
      status: { $ne: 'Cancelled' },
      date: { $gte: twoDaysAgo }
    }).select('_id status date startTime endTime').lean();

    let toScheduled = 0;
    let toOngoing = 0;
    let toCompleted = 0;

    const bulkOps = [];

    for (const exam of exams) {
      const { startDT, endDT } = buildExamDateTimes(exam);
      let newStatus;

      if (now < startDT) {
        newStatus = 'Scheduled';
      } else if (now >= startDT && now <= endDT) {
        newStatus = 'Ongoing';
      } else {
        newStatus = 'Completed';
      }

      if (newStatus !== exam.status) {
        bulkOps.push({
          updateOne: {
            filter: { _id: exam._id, status: { $ne: 'Cancelled' } },
            update: { $set: { status: newStatus } }
          }
        });

        if (newStatus === 'Scheduled') toScheduled++;
        else if (newStatus === 'Ongoing') toOngoing++;
        else toCompleted++;
      }
    }

    if (bulkOps.length > 0) {
      await Exam.bulkWrite(bulkOps);
    }

    // Also mark old exams (before the 2-day window) as Completed if still Scheduled/Ongoing
    const oldCompleted = await Exam.updateMany(
      {
        status: { $in: ['Scheduled', 'Ongoing'] },
        date: { $lt: twoDaysAgo }
      },
      { $set: { status: 'Completed' } }
    );
    toCompleted += oldCompleted.modifiedCount;

    const totalUpdated = toScheduled + toOngoing + toCompleted;
    const elapsed = Date.now() - startTime;
    logger.info(`[exam-status] Job finished: ${totalUpdated} updated (scheduled: ${toScheduled}, ongoing: ${toOngoing}, completed: ${toCompleted}) in ${elapsed}ms`);
  } catch (error) {
    logger.error('[exam-status] Job error', { error: error.message, stack: error.stack });
  }
}

function startJob() {
  // Run every 5 minutes
  const job = new CronJob(
    '*/5 * * * *',
    runExamStatusUpdate,
    null,
    false,
    'Asia/Kolkata'
  );

  job.start();
  console.log('[exam-status] Job scheduled: every 5 minutes');

  // Run once on startup to catch up
  setTimeout(runExamStatusUpdate, 3000);
}

module.exports = { startJob, runExamStatusUpdate };
