const fs = require('fs');
const path = require('path');
const os = require('os');
const { v4: uuidv4 } = require('uuid');

// ── Lazy-loaded heavy deps (only when bulk download is actually used) ──
let pdfQueue = null;
function getQueue() {
  if (!pdfQueue) {
    const PQueue = require('p-queue').default || require('p-queue');
    pdfQueue = new PQueue({ concurrency: 1 });
  }
  return pdfQueue;
}

// ── File-based job store (shared across PM2 cluster instances) ──
const JOB_TTL_MS = 30 * 60 * 1000; // 30 minutes

function getTempDir() {
  const dir = path.join(os.tmpdir(), 'learnovo-bulk');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function jobMetaPath(jobId) {
  return path.join(getTempDir(), `job-${jobId}.json`);
}

function readJob(jobId) {
  const p = jobMetaPath(jobId);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function writeJob(job) {
  fs.writeFileSync(jobMetaPath(job.id), JSON.stringify(job), 'utf8');
}

// Auto-cleanup expired jobs every 10 minutes
setInterval(() => {
  const dir = getTempDir();
  try {
    const files = fs.readdirSync(dir);
    const now = Date.now();
    for (const file of files) {
      if (!file.startsWith('job-') || !file.endsWith('.json')) continue;
      const filePath = path.join(dir, file);
      try {
        const job = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (now - job.createdAt > JOB_TTL_MS) {
          if (job.zipPath && fs.existsSync(job.zipPath)) {
            try {
              fs.unlinkSync(job.zipPath);
            } catch { /* ignore */ }
          }
          try {
            fs.unlinkSync(filePath);
          } catch { /* ignore */ }
        }
      } catch { /* skip corrupt files */ }
    }
  } catch { /* ignore */ }
}, 10 * 60 * 1000);

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
      tenantId: tenantId.toString(),
      status: 'processing',
      total: students.length,
      completed: 0,
      failed: 0,
      errors: [],
      zipPath: null,
      createdAt: Date.now()
    };
    writeJob(job);

    // Fire and forget — runs in background with global timeout (5 min max)
    const JOB_TIMEOUT = 5 * 60 * 1000;
    Promise.race([
      this._processJob(jobId, tenantId, students, options),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Job timed out after 5 minutes')), JOB_TIMEOUT)
      )
    ]).catch(err => {
      console.error(`[bulk-pdf] Job ${jobId} fatal error:`, err.message);
      const j = readJob(jobId);
      if (j) {
        j.status = 'failed';
        j.errors.push(`Fatal: ${err.message}`);
        writeJob(j);
      }
    });

    return jobId;
  },

  /**
   * Process all students in the job sequentially via the global queue.
   */
  async _processJob(jobId, tenantId, students, options) {
    const job = readJob(jobId);
    if (!job) return;

    const archiver = require('archiver');
    const pdfService = require('./pdfService');
    const reportCardService = require('./reportCardService');
    const queue = getQueue();

    const { type = 'regular', examSeries, className, sessionId } = options;
    const zipPath = path.join(getTempDir(), `bulk-${jobId}.zip`);
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 5 } });

    archive.pipe(output);

    const archiveFinished = new Promise((resolve, reject) => {
      output.on('close', resolve);
      archive.on('error', reject);
    });

    // Pre-warm: fetch the first student's data so logo/signature images get cached
    // before the main loop starts. This prevents N sequential HTTP fetches.
    try {
      const firstId = students[0]._id.toString();
      if (type === 'blank') {
        await reportCardService.getBlankReportCardData(tenantId, firstId, { examSeries, className });
      } else if (type === 'final') {
        await reportCardService.getTwoTermReportCardData(tenantId, firstId, sessionId);
      } else {
        await reportCardService.getReportCardData(tenantId, firstId, { examSeries, className });
      }
    } catch { /* pre-warm failure is non-fatal */ }

    let hasAtLeastOneSuccess = false;
    const PER_STUDENT_TIMEOUT = 30000; // 30s per student max (images are cached now)

    for (const student of students) {
      const studentId = student._id.toString();
      const studentName = (student.fullName || student.name || 'Student').replace(/[^a-zA-Z0-9 ]/g, '').trim();
      const rollNo = student.rollNumber || '';

      try {
        // Wrap each student in a timeout to prevent infinite hangs
        const pdfBuffer = await Promise.race([
          queue.add(async() => {
            let buf;
            if (type === 'blank') {
              const data = await reportCardService.getBlankReportCardData(tenantId, studentId, { examSeries, className });
              if (!data) throw new Error(`No data for student ${studentName}`);
              buf = await pdfService.generateBlankReportCard(data);
            } else if (type === 'final') {
              const data = await reportCardService.getTwoTermReportCardData(tenantId, studentId, sessionId);
              if (!data) throw new Error(`No exam results found for ${studentName}`);
              buf = await pdfService.generateTwoTermReportCard(data);
            } else {
              const data = await reportCardService.getReportCardData(tenantId, studentId, { examSeries, className });
              if (!data) throw new Error(`No results for student ${studentName}`);
              buf = await pdfService.generateReportCard(data);
            }
            return buf;
          }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('PDF generation timed out (30s)')), PER_STUDENT_TIMEOUT)
          )
        ]);

        const filename = `${rollNo ? `${rollNo}_` : ''}${studentName}.pdf`.replace(/\s+/g, '_');
        archive.append(pdfBuffer, { name: filename });
        job.completed++;
        hasAtLeastOneSuccess = true;
      } catch (err) {
        job.failed++;
        job.errors.push(`${studentName}: ${err.message}`);
        console.error(`[bulk-pdf] Failed for ${studentName}:`, err.message);
      }

      // Write progress to disk periodically (every 5 students or on last)
      if ((job.completed + job.failed) % 5 === 0 || (job.completed + job.failed) === job.total) {
        writeJob(job);
      }
    }

    // If no PDFs generated, add a placeholder text file
    if (!hasAtLeastOneSuccess) {
      archive.append('No report cards could be generated. Check server logs for errors.', { name: 'ERROR.txt' });
    }

    // Finalize archive and wait for file to be fully written
    await archive.finalize();
    await archiveFinished;

    job.zipPath = zipPath;
    job.status = 'completed';
    writeJob(job);
  },

  /**
   * Get current status of a bulk job.
   */
  getJobStatus(jobId) {
    const job = readJob(jobId);
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
   */
  getJobZipPath(jobId) {
    const job = readJob(jobId);
    if (!job || job.status !== 'completed' || !job.zipPath) return null;
    if (!fs.existsSync(job.zipPath)) return null;
    return job.zipPath;
  },

  /**
   * Get the tenantId for a job (for authorization checks).
   */
  getJobTenantId(jobId) {
    const job = readJob(jobId);
    return job ? job.tenantId : null;
  }
};

module.exports = bulkPdfService;
