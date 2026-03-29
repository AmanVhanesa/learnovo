const PQueue = require('p-queue').default || require('p-queue');
const archiver = require('archiver');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { v4: uuidv4 } = require('uuid');
const pdfService = require('./pdfService');
const reportCardService = require('./reportCardService');

// ── Global concurrency queue — 1 PDF at a time across all users ──
const pdfQueue = new PQueue({ concurrency: 1 });

// ── In-memory job store ──
const jobs = new Map();

// Auto-cleanup: remove expired jobs and temp files every 10 minutes
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
const JOB_TTL_MS = 30 * 60 * 1000; // 30 minutes

setInterval(() => {
  const now = Date.now();
  for (const [jobId, job] of jobs.entries()) {
    if (now - job.createdAt > JOB_TTL_MS) {
      if (job.zipPath && fs.existsSync(job.zipPath)) {
        try {
          fs.unlinkSync(job.zipPath);
        } catch (e) { /* ignore */ }
      }
      jobs.delete(jobId);
    }
  }
}, CLEANUP_INTERVAL_MS);

/**
 * Get the temp directory for bulk PDFs, creating it if needed.
 */
function getTempDir() {
  const dir = path.join(os.tmpdir(), 'learnovo-bulk');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const bulkPdfService = {
  /**
   * Start a bulk PDF generation job.
   * @param {string} tenantId
   * @param {Array} students - [{ _id, name, fullName, rollNumber, admissionNumber }]
   * @param {Object} options - { type: 'regular'|'blank'|'final', examSeries, className, sessionId }
   * @returns {string} jobId
   */
  startBulkJob(tenantId, students, options = {}) {
    const jobId = uuidv4();
    const job = {
      id: jobId,
      tenantId,
      status: 'processing', // processing | completed | failed
      total: students.length,
      completed: 0,
      failed: 0,
      errors: [],
      zipPath: null,
      createdAt: Date.now()
    };
    jobs.set(jobId, job);

    // Fire and forget — runs in background
    this._processJob(jobId, tenantId, students, options).catch(err => {
      const j = jobs.get(jobId);
      if (j) {
        j.status = 'failed';
        j.errors.push(`Fatal: ${err.message}`);
      }
    });

    return jobId;
  },

  /**
   * Process all students in the job sequentially via the global queue.
   */
  async _processJob(jobId, tenantId, students, options) {
    const job = jobs.get(jobId);
    if (!job) return;

    const { type = 'regular', examSeries, className, sessionId } = options;
    const zipPath = path.join(getTempDir(), `bulk-${jobId}.zip`);
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 5 } });

    // Pipe archive to file
    archive.pipe(output);

    // Wait for the archive to finalize
    const archiveFinished = new Promise((resolve, reject) => {
      output.on('close', resolve);
      archive.on('error', reject);
    });

    for (const student of students) {
      try {
        // Each PDF goes through the global concurrency queue
        await pdfQueue.add(async() => {
          let pdfBuffer;
          const studentId = student._id.toString();
          const studentName = (student.fullName || student.name || 'Student').replace(/[^a-zA-Z0-9 ]/g, '').trim();
          const rollNo = student.rollNumber || '';

          if (type === 'blank') {
            const data = await reportCardService.getBlankReportCardData(tenantId, studentId, { examSeries, className });
            if (!data) throw new Error(`No data for student ${studentName}`);
            pdfBuffer = await pdfService.generateBlankReportCard(data);
          } else if (type === 'final') {
            const data = await reportCardService.getFinalReportCardData(tenantId, studentId, sessionId);
            if (!data) throw new Error(`No final data for student ${studentName}`);
            pdfBuffer = await pdfService.generateFinalReportCard(data);
          } else {
            // regular
            const data = await reportCardService.getReportCardData(tenantId, studentId, { examSeries, className });
            if (!data) throw new Error(`No results for student ${studentName}`);
            pdfBuffer = await pdfService.generateReportCard(data);
          }

          const filename = `${rollNo ? `${rollNo  }_` : ''}${studentName}.pdf`.replace(/\s+/g, '_');
          archive.append(pdfBuffer, { name: filename });
        });

        job.completed++;
      } catch (err) {
        job.failed++;
        const name = student.fullName || student.name || student._id;
        job.errors.push(`${name}: ${err.message}`);
      }
    }

    // Finalize the archive
    await archive.finalize();
    await archiveFinished;

    job.zipPath = zipPath;
    job.status = 'completed';
  },

  /**
   * Get current status of a bulk job.
   */
  getJobStatus(jobId) {
    const job = jobs.get(jobId);
    if (!job) return null;
    return {
      id: job.id,
      status: job.status,
      total: job.total,
      completed: job.completed,
      failed: job.failed,
      errors: job.errors
    };
  },

  /**
   * Get the zip file path for a completed job.
   * Returns null if job doesn't exist, isn't complete, or file is missing.
   */
  getJobZipPath(jobId) {
    const job = jobs.get(jobId);
    if (!job || job.status !== 'completed' || !job.zipPath) return null;
    if (!fs.existsSync(job.zipPath)) return null;
    return job.zipPath;
  },

  /**
   * Get the tenantId for a job (for authorization checks).
   */
  getJobTenantId(jobId) {
    const job = jobs.get(jobId);
    return job ? job.tenantId : null;
  }
};

module.exports = bulkPdfService;
