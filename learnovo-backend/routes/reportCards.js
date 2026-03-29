const express = require('express');
const fs = require('fs');
const { protect, authorize } = require('../middleware/auth');
const planGate = require('../middleware/planGate');
const reportCardService = require('../services/reportCardService');
const bulkPdfService = require('../services/bulkPdfService');
const pdfService = require('../services/pdfService');

const router = express.Router();

const examPlanGates = [planGate.requireActiveSubscription, planGate.checkGradesAndExams];

// ─────────────────────────────────────────────────────────────────────────────
// INDIVIDUAL BLANK REPORT CARD
// ─────────────────────────────────────────────────────────────────────────────

// @desc    Download blank report card PDF for a student (empty marks for hand-filling)
// @route   GET /api/report-cards/:studentId/blank/pdf
// @access  Private (admin, teacher)
router.get('/:studentId/blank/pdf', protect, examPlanGates, authorize('admin', 'teacher'), async(req, res, next) => {
  try {
    const { studentId } = req.params;
    const { examSeries, class: className } = req.query;

    const data = await reportCardService.getBlankReportCardData(
      req.user.tenantId, studentId, { examSeries, className }
    );

    if (!data) {
      return res.status(404).json({ success: false, message: 'No data found for this student' });
    }

    const pdfBuffer = await pdfService.generateBlankReportCard(data);
    const studentName = (data.student.name || 'Student').replace(/\s+/g, '_');
    const filename = `Blank_Report_Card_${studentName}.pdf`;

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': pdfBuffer.length
    });

    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// BULK DOWNLOAD (regular + blank)
// ─────────────────────────────────────────────────────────────────────────────

// @desc    Start bulk report card download job for a section
// @route   POST /api/report-cards/bulk-download
// @access  Private (admin, teacher)
router.post('/bulk-download', protect, examPlanGates, authorize('admin', 'teacher'), async(req, res, next) => {
  try {
    const { sectionId, examSeries, class: className, type = 'regular' } = req.body;

    if (!sectionId) {
      return res.status(400).json({ success: false, message: 'sectionId is required' });
    }

    if (!['regular', 'blank'].includes(type)) {
      return res.status(400).json({ success: false, message: 'type must be "regular" or "blank"' });
    }

    const { students, section } = await reportCardService.getStudentsInSection(req.user.tenantId, sectionId);

    if (!students.length) {
      return res.status(404).json({ success: false, message: 'No active students found in this section' });
    }

    const jobId = bulkPdfService.startBulkJob(req.user.tenantId, students, {
      type,
      examSeries,
      className: className || section?.classId?.name
    });

    res.status(202).json({
      success: true,
      message: `Bulk ${type} report card generation started`,
      data: {
        jobId,
        totalStudents: students.length
      }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Get bulk download job status
// @route   GET /api/report-cards/bulk-download/:jobId/status
// @access  Private (admin, teacher)
router.get('/bulk-download/:jobId/status', protect, authorize('admin', 'teacher'), async(req, res) => {
  const { jobId } = req.params;

  // Verify tenant ownership
  const jobTenantId = bulkPdfService.getJobTenantId(jobId);
  if (!jobTenantId || jobTenantId.toString() !== req.user.tenantId.toString()) {
    return res.status(404).json({ success: false, message: 'Job not found' });
  }

  const status = bulkPdfService.getJobStatus(jobId);
  if (!status) {
    return res.status(404).json({ success: false, message: 'Job not found' });
  }

  res.json({ success: true, data: status });
});

// @desc    Download completed bulk zip file
// @route   GET /api/report-cards/bulk-download/:jobId/download
// @access  Private (admin, teacher)
router.get('/bulk-download/:jobId/download', protect, authorize('admin', 'teacher'), async(req, res) => {
  const { jobId } = req.params;

  // Verify tenant ownership
  const jobTenantId = bulkPdfService.getJobTenantId(jobId);
  if (!jobTenantId || jobTenantId.toString() !== req.user.tenantId.toString()) {
    return res.status(404).json({ success: false, message: 'Job not found' });
  }

  const zipPath = bulkPdfService.getJobZipPath(jobId);
  if (!zipPath) {
    return res.status(404).json({ success: false, message: 'Zip file not ready or expired' });
  }

  const filename = `Report_Cards_${jobId.slice(0, 8)}.zip`;
  res.set({
    'Content-Type': 'application/zip',
    'Content-Disposition': `attachment; filename="${filename}"`
  });

  const stream = fs.createReadStream(zipPath);
  stream.pipe(res);
});

// ─────────────────────────────────────────────────────────────────────────��───
// FINAL / CUMULATIVE REPORT CARD
// ─────────────────────────────────────────────────────────────────────────────

// @desc    Get final/cumulative report card data (JSON) for a student
// @route   GET /api/report-cards/final/:studentId/:sessionId
// @access  Private
router.get('/final/:studentId/:sessionId', protect, examPlanGates, async(req, res, next) => {
  try {
    const { studentId, sessionId } = req.params;

    // Students can only view their own
    if (req.user.role === 'student' && studentId !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const data = await reportCardService.getFinalReportCardData(req.user.tenantId, studentId, sessionId);

    if (!data) {
      return res.status(404).json({ success: false, message: 'No cumulative results found' });
    }

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// @desc    Download final/cumulative report card PDF
// @route   GET /api/report-cards/final/:studentId/:sessionId/pdf
// @access  Private
router.get('/final/:studentId/:sessionId/pdf', protect, examPlanGates, async(req, res, next) => {
  try {
    const { studentId, sessionId } = req.params;

    if (req.user.role === 'student' && studentId !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const data = await reportCardService.getFinalReportCardData(req.user.tenantId, studentId, sessionId);

    if (!data) {
      return res.status(404).json({ success: false, message: 'No cumulative results found' });
    }

    const pdfBuffer = await pdfService.generateFinalReportCard(data);
    const studentName = (data.student.name || 'Student').replace(/\s+/g, '_');
    const filename = `Final_Report_Card_${studentName}_${data.session.name || ''}.pdf`;

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': pdfBuffer.length
    });

    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
});

// @desc    Start bulk final report card download job
// @route   POST /api/report-cards/final/bulk-download
// @access  Private (admin, teacher)
router.post('/final/bulk-download', protect, examPlanGates, authorize('admin', 'teacher'), async(req, res, next) => {
  try {
    const { sectionId, sessionId } = req.body;

    if (!sectionId || !sessionId) {
      return res.status(400).json({ success: false, message: 'sectionId and sessionId are required' });
    }

    const { students } = await reportCardService.getStudentsInSection(req.user.tenantId, sectionId);

    if (!students.length) {
      return res.status(404).json({ success: false, message: 'No active students found in this section' });
    }

    const jobId = bulkPdfService.startBulkJob(req.user.tenantId, students, {
      type: 'final',
      sessionId
    });

    res.status(202).json({
      success: true,
      message: 'Bulk final report card generation started',
      data: {
        jobId,
        totalStudents: students.length
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
