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

// ── Shared helper: resolve student data from payload (system or manual) ──
async function resolveStudentData(student, tenantId) {
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
    const dbStudent = await User.findOne({ _id: student.studentId, tenantId })
      .select('name fullName rollNumber admissionNumber class section dateOfBirth fatherOrHusbandName guardianName')
      .lean();
    if (dbStudent) {
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

  return studentData;
}

function buildSchoolData(settings) {
  const inst = settings?.institution || {};
  const addressParts = [inst.address?.street, inst.address?.city, inst.address?.state].filter(Boolean);
  return {
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
  };
}

function calculateGrade(percentage) {
  if (percentage >= 90) return 'A+';
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B';
  if (percentage >= 60) return 'C';
  if (percentage >= 50) return 'D';
  return 'F';
}

// @desc    Generate a custom report card PDF from manually provided data
// @route   POST /api/report-cards/custom/pdf
// @access  Private (admin, teacher)
router.post('/custom/pdf', protect, authorize('admin', 'teacher'), async(req, res, next) => {
  try {
    const { student, reportType, remarks } = req.body;

    if (!student) {
      return res.status(400).json({ success: false, message: 'student is required' });
    }

    const Settings = require('../models/Settings');
    const settings = await Settings.findOne({ tenantId: req.user.tenantId });
    const studentData = await resolveStudentData(student, req.user.tenantId);
    const schoolData = buildSchoolData(settings);

    let pdfBuffer, filename;

    // ─── CUMULATIVE (Multi-Exam) Report Card ───
    if (reportType === 'cumulative') {
      const { exams: examsList, subjects, academicYear, sessionName } = req.body;

      if (!examsList || !Array.isArray(examsList) || examsList.length < 2) {
        return res.status(400).json({ success: false, message: 'At least 2 exams are required for cumulative report' });
      }
      if (!subjects || !Array.isArray(subjects) || subjects.length === 0) {
        return res.status(400).json({ success: false, message: 'subjects (non-empty array) is required' });
      }

      // Validate subjects
      for (let i = 0; i < subjects.length; i++) {
        const s = subjects[i];
        if (!s.name || !s.marks || typeof s.marks !== 'object') {
          return res.status(400).json({
            success: false,
            message: `Subject at index ${i} must have name and marks object`
          });
        }
      }

      // Build exam series list (names)
      const examSeries = examsList.map(e => e.name);

      // Build subject rows matching the final report card data structure
      const subjectRows = subjects.map(sub => {
        const totalMarksPerExam = Number(sub.totalMarksPerExam) || 100;
        const passingPct = Number(sub.passingPercentage) || 40;
        const examsData = {};
        let totalObtained = 0;
        let totalMax = 0;

        examSeries.forEach(examName => {
          const marks = sub.marks[examName];
          if (marks !== null && marks !== undefined) {
            examsData[examName] = {
              marksObtained: Number(marks),
              totalMarks: totalMarksPerExam
            };
            totalObtained += Number(marks);
            totalMax += totalMarksPerExam;
          }
        });

        const averagePercentage = totalMax > 0
          ? Math.round((totalObtained / totalMax) * 100 * 10) / 10
          : 0;
        const isPassed = averagePercentage >= passingPct;
        const finalGrade = calculateGrade(averagePercentage);

        return {
          subject: sub.name,
          exams: examsData,
          totalObtained,
          totalMax,
          averagePercentage,
          finalGrade,
          isPassed
        };
      });

      // Calculate grand totals
      const grandTotalMax = subjectRows.reduce((acc, r) => acc + r.totalMax, 0);
      const grandTotalObtained = subjectRows.reduce((acc, r) => acc + r.totalObtained, 0);
      const overallPercentage = grandTotalMax > 0
        ? Math.round((grandTotalObtained / grandTotalMax) * 100 * 10) / 10
        : 0;
      const overallGrade = calculateGrade(overallPercentage);
      const overallPassed = subjectRows.every(r => r.isPassed);
      const passCount = subjectRows.filter(r => r.isPassed).length;

      const pdfData = {
        school: schoolData,
        student: {
          ...studentData,
          guardianName: studentData.fatherOrHusbandName
        },
        session: {
          name: sessionName || academicYear || ''
        },
        examSeries,
        subjectRows,
        summary: {
          grandTotalMax,
          grandTotalObtained,
          overallPercentage,
          overallGrade,
          overallPassed,
          passCount,
          totalSubjects: subjectRows.length
        },
        attendance: null,
        signatures: {
          principal: settings?.institution?.principalSignature || null,
          class_teacher: null
        }
      };

      pdfBuffer = await getPdfService().generateFinalReportCard(pdfData);
      const studentName = (studentData.name || 'Student').replace(/\s+/g, '_');
      filename = `Custom_Cumulative_Report_Card_${studentName}.pdf`;

    } else {
      // ─── SINGLE Exam Report Card ───
      const { exam, subjects } = req.body;

      if (!exam || !subjects || !Array.isArray(subjects) || subjects.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'exam and subjects (non-empty array) are required'
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

      // Calculate grades and summary
      const processedSubjects = subjects.map(s => {
        const total = Number(s.totalMarks) || 0;
        const obtained = Number(s.marksObtained) || 0;
        const percentage = total > 0 ? Math.round((obtained / total) * 100 * 10) / 10 : 0;
        const passingMarks = Number(s.passingMarks) || Math.ceil(total * 0.33);
        const isPassed = obtained >= passingMarks;
        const grade = calculateGrade(percentage);

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
      const overallGrade = calculateGrade(overallPercentage);
      const overallPassed = processedSubjects.every(s => s.isPassed);
      const passCount = processedSubjects.filter(s => s.isPassed).length;

      const pdfData = {
        school: schoolData,
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
          principal: settings?.institution?.principalSignature || null,
          class_teacher: null
        }
      };

      pdfBuffer = await getPdfService().generateReportCard(pdfData);
      const studentName = (studentData.name || 'Student').replace(/\s+/g, '_');
      filename = `Custom_Report_Card_${studentName}.pdf`;
    }

    // ─── Save PDF to S3 and store metadata ───
    const { uploadBufferToS3, buildS3Key } = require('../utils/s3Upload');
    const CustomReportCard = require('../models/CustomReportCard');

    const s3Key = buildS3Key('custom-report-cards', req.user.tenantId.toString(), filename);
    const { url: pdfUrl } = await uploadBufferToS3(pdfBuffer, s3Key, 'application/pdf');

    // Determine summary values for metadata
    let overallPct = 0, overallGrd = '', resultStr = 'FAIL', examInfoStr = '';
    if (reportType === 'cumulative') {
      const { exams: examsList, sessionName: sn, academicYear: ay } = req.body;
      const subjectRows2 = req.body.subjects || [];
      const grandMax = subjectRows2.reduce((a, s) => {
        let m = 0; Object.values(s.marks || {}).forEach(v => { if (v !== null) m += Number(s.totalMarksPerExam) || 100; }); return a + m;
      }, 0);
      const grandObt = subjectRows2.reduce((a, s) => {
        let m = 0; Object.values(s.marks || {}).forEach(v => { if (v !== null) m += Number(v); }); return a + m;
      }, 0);
      overallPct = grandMax > 0 ? Math.round((grandObt / grandMax) * 100 * 10) / 10 : 0;
      overallGrd = calculateGrade(overallPct);
      resultStr = subjectRows2.length > 0 && subjectRows2.every(s => {
        let tm = 0, to = 0; Object.values(s.marks || {}).forEach(v => { if (v !== null) { tm += Number(s.totalMarksPerExam) || 100; to += Number(v); } });
        return tm > 0 && (to / tm * 100) >= (Number(s.passingPercentage) || 40);
      }) ? 'PASS' : 'FAIL';
      examInfoStr = `Cumulative — ${(examsList || []).map(e => e.name).join(', ')}`;
    } else {
      const { exam: ex, subjects: subs } = req.body;
      const gt = (subs || []).reduce((a, s) => a + (Number(s.totalMarks) || 0), 0);
      const go = (subs || []).reduce((a, s) => a + (Number(s.marksObtained) || 0), 0);
      overallPct = gt > 0 ? Math.round((go / gt) * 100 * 10) / 10 : 0;
      overallGrd = calculateGrade(overallPct);
      resultStr = (subs || []).every(s => (Number(s.marksObtained) || 0) >= (Number(s.passingMarks) || Math.ceil((Number(s.totalMarks) || 0) * 0.33))) ? 'PASS' : 'FAIL';
      examInfoStr = `${ex?.examSeries || 'Custom'}${ex?.name ? ' — ' + ex.name : ''}`;
    }

    const record = await CustomReportCard.create({
      tenantId: req.user.tenantId,
      studentId: student.studentId || null,
      studentName: studentData.name || 'Student',
      studentClass: studentData.class || '',
      studentSection: studentData.section || '',
      admissionNumber: studentData.admissionNumber || '',
      reportType: reportType || 'single',
      examInfo: examInfoStr,
      sessionName: req.body.sessionName || req.body.exam?.academicYear || '',
      overallPercentage: overallPct,
      overallGrade: overallGrd,
      result: resultStr,
      remarks: remarks || '',
      pdfUrl,
      pdfKey: s3Key,
      payloadSnapshot: req.body,
      generatedBy: req.user._id
    });

    // Return JSON with metadata + PDF as base64 for preview
    const pdfBase64 = pdfBuffer.toString('base64');
    res.status(201).json({
      success: true,
      message: 'Custom report card generated',
      data: {
        _id: record._id,
        studentName: record.studentName,
        studentClass: record.studentClass,
        studentSection: record.studentSection,
        reportType: record.reportType,
        examInfo: record.examInfo,
        sessionName: record.sessionName,
        overallPercentage: record.overallPercentage,
        overallGrade: record.overallGrade,
        result: record.result,
        pdfUrl: record.pdfUrl,
        pdfBase64,
        filename,
        createdAt: record.createdAt
      }
    });
  } catch (error) {
    console.error('Custom report card PDF error:', error.message);
    const msg = error.message?.includes('timed out') || error.message?.includes('Target closed')
      ? 'PDF generation timed out. Please try again.'
      : 'Failed to generate custom report card PDF';
    res.status(500).json({ success: false, message: msg });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOM REPORT CARD — HISTORY
// ─────────────────────────────────────────────────────────────────────────────

// @desc    List all generated custom report cards for the tenant
// @route   GET /api/report-cards/custom/history
// @access  Private (admin, teacher)
router.get('/custom/history', protect, authorize('admin', 'teacher'), async(req, res, next) => {
  try {
    const CustomReportCard = require('../models/CustomReportCard');
    const { page = 1, limit = 50, search } = req.query;

    const filter = { tenantId: req.user.tenantId };
    if (search) {
      const q = new RegExp(search.trim(), 'i');
      filter.$or = [
        { studentName: q },
        { admissionNumber: q },
        { examInfo: q }
      ];
    }

    const { getPresignedUrl } = require('../utils/s3PresignedUrl');

    const total = await CustomReportCard.countDocuments(filter);
    const records = await CustomReportCard.find(filter)
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .select('-payloadSnapshot')
      .lean();

    // Replace raw S3 URLs with pre-signed URLs
    for (const record of records) {
      if (record.pdfKey) {
        try {
          record.pdfUrl = await getPresignedUrl(record.pdfKey);
        } catch { /* keep original url as fallback */ }
      }
      delete record.pdfKey;
    }

    res.json({
      success: true,
      data: records,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Download a generated custom report card PDF
// @route   GET /api/report-cards/custom/:id/download
// @access  Private (admin, teacher)
router.get('/custom/:id/download', protect, authorize('admin', 'teacher'), async(req, res, next) => {
  try {
    const CustomReportCard = require('../models/CustomReportCard');
    const { getPresignedUrl } = require('../utils/s3PresignedUrl');
    const record = await CustomReportCard.findOne({
      _id: req.params.id,
      tenantId: req.user.tenantId
    }).lean();

    if (!record) {
      return res.status(404).json({ success: false, message: 'Report card not found' });
    }

    // Redirect to pre-signed S3 URL
    const signedUrl = record.pdfKey
      ? await getPresignedUrl(record.pdfKey)
      : record.pdfUrl;
    res.redirect(signedUrl);
  } catch (error) {
    next(error);
  }
});

// @desc    Get payload snapshot for re-editing
// @route   GET /api/report-cards/custom/:id/payload
// @access  Private (admin, teacher)
router.get('/custom/:id/payload', protect, authorize('admin', 'teacher'), async(req, res, next) => {
  try {
    const CustomReportCard = require('../models/CustomReportCard');
    const record = await CustomReportCard.findOne({
      _id: req.params.id,
      tenantId: req.user.tenantId
    }).select('payloadSnapshot reportType studentName').lean();

    if (!record) {
      return res.status(404).json({ success: false, message: 'Report card not found' });
    }

    res.json({ success: true, data: record });
  } catch (error) {
    next(error);
  }
});

// @desc    Delete a generated custom report card
// @route   DELETE /api/report-cards/custom/:id
// @access  Private (admin)
router.delete('/custom/:id', protect, authorize('admin'), async(req, res, next) => {
  try {
    const CustomReportCard = require('../models/CustomReportCard');
    const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
    const { s3Client, BUCKET_NAME } = require('../utils/s3');

    const record = await CustomReportCard.findOne({
      _id: req.params.id,
      tenantId: req.user.tenantId
    });

    if (!record) {
      return res.status(404).json({ success: false, message: 'Report card not found' });
    }

    // Delete from S3
    try {
      await s3Client.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: record.pdfKey }));
    } catch { /* S3 deletion failure is non-critical */ }

    await CustomReportCard.deleteOne({ _id: record._id });

    res.json({ success: true, message: 'Report card deleted' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
