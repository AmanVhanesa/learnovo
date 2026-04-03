const express = require('express');
const fs = require('fs');
const { protect, authorize } = require('../middleware/auth');
const planGate = require('../middleware/planGate');

// Lazy-loaded on first request to avoid adding ~500ms + 30MB to startup
let _reportCardService, _bulkPdfService, _pdfService;
function getReportCardService() {
  return _reportCardService || (_reportCardService = require('../services/reportCardService'));
}
function getBulkPdfService() {
  return _bulkPdfService || (_bulkPdfService = require('../services/bulkPdfService'));
}
function getPdfService() {
  return _pdfService || (_pdfService = require('../services/pdfService'));
}

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

    const data = await getReportCardService().getBlankReportCardData(
      req.user.tenantId, studentId, { examSeries, className }
    );

    if (!data) {
      return res.status(404).json({ success: false, message: 'No data found for this student' });
    }

    const pdfBuffer = await getPdfService().generateBlankReportCard(data);
    const studentName = (data.student.name || 'Student').replace(/\s+/g, '_');
    const filename = `Blank_Report_Card_${studentName}.pdf`;

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': pdfBuffer.length
    });

    res.send(pdfBuffer);
  } catch (error) {
    console.error('Blank report card PDF error:', error.message);
    const msg = error.message?.includes('timed out') || error.message?.includes('Target closed')
      ? 'PDF generation timed out. Please try again.'
      : 'Failed to generate blank report card PDF';
    res.status(500).json({ success: false, message: msg });
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

    const { students, section } = await getReportCardService().getStudentsInSection(req.user.tenantId, sectionId);

    if (!students.length) {
      return res.status(404).json({ success: false, message: 'No active students found in this section' });
    }

    const jobId = getBulkPdfService().startBulkJob(req.user.tenantId, students, {
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
  const jobTenantId = getBulkPdfService().getJobTenantId(jobId);
  if (!jobTenantId || jobTenantId.toString() !== req.user.tenantId.toString()) {
    return res.status(404).json({ success: false, message: 'Job not found' });
  }

  const status = getBulkPdfService().getJobStatus(jobId);
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
  const jobTenantId = getBulkPdfService().getJobTenantId(jobId);
  if (!jobTenantId || jobTenantId.toString() !== req.user.tenantId.toString()) {
    return res.status(404).json({ success: false, message: 'Job not found' });
  }

  const zipPath = getBulkPdfService().getJobZipPath(jobId);
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

    const data = await getReportCardService().getFinalReportCardData(req.user.tenantId, studentId, sessionId);

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

    const data = await getReportCardService().getFinalReportCardData(req.user.tenantId, studentId, sessionId);

    if (!data) {
      return res.status(404).json({ success: false, message: 'No cumulative results found' });
    }

    const pdfBuffer = await getPdfService().generateFinalReportCard(data);
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

    const { students } = await getReportCardService().getStudentsInSection(req.user.tenantId, sectionId);

    if (!students.length) {
      return res.status(404).json({ success: false, message: 'No active students found in this section' });
    }

    const jobId = getBulkPdfService().startBulkJob(req.user.tenantId, students, {
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

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOM / MANUAL REPORT CARD
// ─────────────────────────────────────────────────────────────────────────────

// @desc    Generate a custom report card PDF from manually provided data
// @route   POST /api/report-cards/custom/pdf
// @access  Private (admin, teacher)
router.post('/custom/pdf', protect, authorize('admin', 'teacher'), async(req, res, next) => {
  try {
    const { student, exam, subjects, remarks } = req.body;

    if (!student || !exam || !subjects || !Array.isArray(subjects) || subjects.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'student, exam, and subjects (non-empty array) are required'
      });
    }

    // Validate each subject has required fields
    for (let i = 0; i < subjects.length; i++) {
      const s = subjects[i];
      if (!s.name || s.totalMarks == null || s.marksObtained == null) {
        return res.status(400).json({
          success: false,
          message: `Subject at index ${i} must have name, totalMarks, and marksObtained`
        });
      }
    }

    // Build the data payload matching the existing PDF template structure
    const reportCardService = getReportCardService();
    const Settings = require('../models/Settings');
    const settings = await Settings.findOne({ tenantId: req.user.tenantId });

    // If studentId is provided, optionally enrich from DB
    let studentData = {
      name: student.name || '',
      admissionNumber: student.admissionNumber || '',
      class: student.class || '',
      section: student.section || '',
      rollNumber: student.rollNumber || '',
      dob: student.dob || '',
      fatherOrHusbandName: student.fatherOrHusbandName || student.guardianName || ''
    };

    if (student.studentId) {
      const User = require('../models/User');
      const dbStudent = await User.findOne({ _id: student.studentId, tenantId: req.user.tenantId })
        .select('name fullName rollNumber admissionNumber class section dateOfBirth fatherOrHusbandName guardianName')
        .lean();
      if (dbStudent) {
        // Merge: manual overrides take priority, DB fills blanks
        studentData = {
          name: student.name || dbStudent.fullName || dbStudent.name || '',
          admissionNumber: student.admissionNumber || dbStudent.admissionNumber || '',
          class: student.class || dbStudent.class || '',
          section: student.section || dbStudent.section || '',
          rollNumber: student.rollNumber || dbStudent.rollNumber || '',
          dob: student.dob || dbStudent.dateOfBirth || '',
          fatherOrHusbandName: student.fatherOrHusbandName || student.guardianName || dbStudent.fatherOrHusbandName || dbStudent.guardianName || ''
        };
      }
    }

    // Calculate grades and summary
    const processedSubjects = subjects.map(s => {
      const total = Number(s.totalMarks) || 0;
      const obtained = Number(s.marksObtained) || 0;
      const percentage = total > 0 ? Math.round((obtained / total) * 100 * 10) / 10 : 0;
      const passingMarks = Number(s.passingMarks) || Math.ceil(total * 0.33);
      const isPassed = obtained >= passingMarks;
      let grade;
      if (percentage >= 90) grade = 'A+';
      else if (percentage >= 80) grade = 'A';
      else if (percentage >= 70) grade = 'B';
      else if (percentage >= 60) grade = 'C';
      else if (percentage >= 50) grade = 'D';
      else grade = 'F';

      return {
        name: s.name,
        subject: s.name,
        examName: exam.name || '',
        date: exam.date || null,
        totalMarks: total,
        marksObtained: obtained,
        percentage,
        grade,
        isPassed,
        remarks: s.remarks || ''
      };
    });

    const grandTotal = processedSubjects.reduce((acc, s) => acc + s.totalMarks, 0);
    const grandObtained = processedSubjects.reduce((acc, s) => acc + s.marksObtained, 0);
    const overallPercentage = grandTotal > 0
      ? Math.round((grandObtained / grandTotal) * 100 * 10) / 10
      : 0;
    let overallGrade;
    if (overallPercentage >= 90) overallGrade = 'A+';
    else if (overallPercentage >= 80) overallGrade = 'A';
    else if (overallPercentage >= 70) overallGrade = 'B';
    else if (overallPercentage >= 60) overallGrade = 'C';
    else if (overallPercentage >= 50) overallGrade = 'D';
    else overallGrade = 'F';
    const overallPassed = processedSubjects.every(s => s.isPassed);
    const passCount = processedSubjects.filter(s => s.isPassed).length;

    // Build school data from tenant settings
    const inst = settings?.institution || {};
    const addressParts = [inst.address?.street, inst.address?.city, inst.address?.state].filter(Boolean);

    const pdfData = {
      school: {
        name: inst.name || 'School',
        address: addressParts.join(', '),
        phone: inst.contact?.phone || '',
        email: inst.contact?.email || '',
        board: inst.board || '',
        affiliation: inst.affiliationNumber || '',
        schoolCode: inst.schoolCode || '',
        udise: inst.udiseCode || '',
        logo: inst.logo || null,
        brand_color: inst.brandColor || '#1E3A5F'
      },
      student: studentData,
      exam: {
        type: exam.examSeries || exam.type || 'Custom',
        academicYear: exam.academicYear || settings?.academicYear || '',
        date_issued: new Date().toISOString()
      },
      subjects: processedSubjects,
      summary: {
        grandTotal,
        grandObtained,
        overallPercentage,
        overallGrade,
        overallPassed,
        passCount,
        totalSubjects: processedSubjects.length,
        teacherRemarks: remarks || ''
      },
      attendance: null,
      signatures: {
        principal: inst.principalSignature || null,
        class_teacher: null
      }
    };

    const pdfBuffer = await getPdfService().generateReportCard(pdfData);
    const studentName = (studentData.name || 'Student').replace(/\s+/g, '_');
    const filename = `Custom_Report_Card_${studentName}.pdf`;

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': pdfBuffer.length
    });

    res.send(pdfBuffer);
  } catch (error) {
    console.error('Custom report card PDF error:', error.message);
    const msg = error.message?.includes('timed out') || error.message?.includes('Target closed')
      ? 'PDF generation timed out. Please try again.'
      : 'Failed to generate custom report card PDF';
    res.status(500).json({ success: false, message: msg });
  }
});

module.exports = router;
