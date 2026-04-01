const CertificateTemplate = require('../models/CertificateTemplate');
const GeneratedCertificate = require('../models/GeneratedCertificate');
const User = require('../models/User');
const Settings = require('../models/Settings');
const Fee = require('../models/Fee');
const Counter = require('../models/Counter');
const ClassSubject = require('../models/ClassSubject');
const AcademicSession = require('../models/AcademicSession');
const pdfService = require('../services/pdfService');
const { format } = require('date-fns');
const HTMLtoDOCX = require('html-to-docx');
const axios = require('axios');
const fs = require('fs');
const nodePath = require('path');

// Helper to convert date to words (e.g., "15 March 2025" → "Fifteenth March, Two Thousand Twenty-Five")
const dateToWords = (dateStr) => {
  if (!dateStr) return '';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty'];
  const ordinalOnes = ['', 'First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth',
    'Tenth', 'Eleventh', 'Twelfth', 'Thirteenth', 'Fourteenth', 'Fifteenth', 'Sixteenth', 'Seventeenth', 'Eighteenth', 'Nineteenth'];
  const ordinalTens = { 'Twenty': 'Twentieth', 'Thirty': 'Thirtieth' };

  const numToOrdinal = (n) => {
    if (n < 20) return ordinalOnes[n];
    const t = tens[Math.floor(n / 10)];
    const o = n % 10;
    return o === 0 ? ordinalTens[t] : `${t}-${ordinalOnes[o].toLowerCase()}`;
  };

  const numToWords = (n) => {
    if (n === 0) return '';
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? `-${  ones[n % 10].toLowerCase()}` : '');
    if (n < 1000) return `${ones[Math.floor(n / 100)]  } Hundred${  n % 100 ? ` ${  numToWords(n % 100)}` : ''}`;
    if (n < 10000) return `${ones[Math.floor(n / 1000)]  } Thousand${  n % 1000 ? ` ${  numToWords(n % 1000)}` : ''}`;
    return String(n);
  };

  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const day = date.getDate();
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    return `${numToOrdinal(day)} ${month}, ${numToWords(year)}`;
  } catch {
    return dateStr;
  }
};

// Helper to strip existing honorific prefixes from names
const stripHonorific = (name) => {
  if (!name || typeof name !== 'string') return name;
  // Remove common honorifics: Mr., Mrs., Ms., Dr., Prof., Miss
  return name.replace(/^(Mr\.|Mrs\.|Ms\.|Dr\.|Prof\.|Miss)\s+/i, '').trim();
};

exports.getTemplates = async(req, res) => {
  try {
    // req.user.tenantId should be populated by auth middleware
    const templates = await CertificateTemplate.find({ tenantId: req.user.tenantId });
    res.json(templates);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching templates', error: error.message });
  }
};

exports.createOrUpdateTemplate = async(req, res) => {
  try {
    const { type, headerText, declarationText, footerText } = req.body;

    let template = await CertificateTemplate.findOne({
      tenantId: req.user.tenantId,
      type
    });

    if (template) {
      template.headerText = headerText;
      template.declarationText = declarationText;
      template.footerText = footerText;
      await template.save();
    } else {
      template = await CertificateTemplate.create({
        tenantId: req.user.tenantId,
        type,
        headerText,
        declarationText,
        footerText
      });
    }
    res.json(template);
  } catch (error) {
    res.status(500).json({ message: 'Error saving template', error: error.message });
  }
};

/**
 * Preview Certificate Data
 * Returns the JSON data that will be put into the certificate, for frontend review.
 */
exports.previewCertificate = async(req, res) => {
  try {
    const { studentId, type } = req.body;
    const tenantId = req.user.tenantId;

    const student = await User.findOne({ _id: studentId, tenantId });
    if (!student) return res.status(404).json({ message: 'Student not found' });

    const settings = await Settings.getSettings(tenantId);

    // --- Check if certificate already exists for this student ---
    const existingCert = await GeneratedCertificate.findOne({
      tenantId,
      student: studentId,
      type,
      status: 'ACTIVE'
    });

    if (existingCert) {
      const label = type === 'TC' ? 'Leaving Certificate' : 'Bonafide Certificate';
      return res.status(409).json({
        message: `${label} has already been generated for this student (${existingCert.certificateNumber}). You can download it from the Certificate Manager.`,
        existingCertificate: {
          id: existingCert._id,
          certificateNumber: existingCert.certificateNumber,
          issueDate: existingCert.issueDate
        }
      });
    }

    // --- Check pending fees for TC (warning, not blocking) ---
    let pendingFeesInfo = null;
    if (type === 'TC') {
      const pendingFees = await Fee.find({
        student: studentId,
        status: { $in: ['pending', 'overdue', 'partially_paid'] }
      });

      if (pendingFees.length > 0) {
        const totalPending = pendingFees.reduce((sum, f) => sum + (f.balance > 0 ? f.balance : f.amount - (f.paidAmount || 0)), 0);
        pendingFeesInfo = {
          hasPending: true,
          totalAmount: totalPending,
          count: pendingFees.length,
          breakdown: pendingFees.map(f => ({
            id: f._id,
            description: f.description,
            feeType: f.feeType,
            amount: f.amount,
            paidAmount: f.paidAmount || 0,
            balance: f.balance > 0 ? f.balance : f.amount - (f.paidAmount || 0),
            status: f.status,
            dueDate: f.dueDate
          }))
        };
      }
    }

    // --- Fetch subjects studied from class-subject assignments ---
    let subjectsStudied = '';
    try {
      if (student.classId) {
        const activeSession = await AcademicSession.findOne({ tenantId, isActive: true });
        const query = { tenantId, classId: student.classId, isActive: true };
        if (activeSession) query.academicSessionId = activeSession._id;

        const classSubjects = await ClassSubject.find(query).populate('subjectId', 'name');
        const subjectNames = classSubjects
          .filter(cs => cs.subjectId && cs.subjectId.name)
          .map(cs => cs.subjectId.name);

        if (subjectNames.length > 0) {
          subjectsStudied = subjectNames.join(', ');
        }
      }

      // Fallback: if no class-subject assignments found, fetch all active subjects for the tenant
      if (!subjectsStudied) {
        const Subject = require('../models/Subject');
        const allSubjects = await Subject.find({ tenantId, isActive: true }).select('name');
        if (allSubjects.length > 0) {
          subjectsStudied = allSubjects.map(s => s.name).join(', ');
        } else {
          subjectsStudied = '-';
        }
      }
    } catch (err) {
      console.error('Error fetching subjects for TC:', err.message);
      subjectsStudied = '-';
    }

    // --- Prepare Data ---
    // Format dates
    const dob = student.dateOfBirth ? format(new Date(student.dateOfBirth), 'dd MMM yyyy') : '';
    const dobWords = student.dateOfBirth ? dateToWords(student.dateOfBirth) : '';
    const today = format(new Date(), 'dd MMM yyyy');

    // Get guardian names from guardians array, falling back to legacy flat fields
    const father = student.guardians?.find(g => g.relation === 'Father');
    const mother = student.guardians?.find(g => g.relation === 'Mother');
    const primaryGuardian = student.guardians?.find(g => g.isPrimary) || student.guardians?.[0];

    // Father: guardians array → legacy fatherOrHusbandName → legacy guardianName → fallback
    const rawFatherName = father?.name || student.fatherOrHusbandName || (primaryGuardian?.relation !== 'Mother' ? primaryGuardian?.name : null) || student.guardianName || '-';
    const fatherName = stripHonorific(rawFatherName);

    // Mother: guardians array → fallback
    const rawMotherName = mother?.name || '-';
    const motherName = stripHonorific(rawMotherName);

    const data = {
      studentName: student.fullName,
      fatherName: fatherName,
      motherName: motherName,
      admissionNumber: student.admissionNumber || '-',
      class: student.class || '-',
      section: student.section || '-',
      academicYear: student.academicYear || settings.academic.currentYear,
      dob: dob,
      dobWords: dobWords, // TODO: Implement converter
      nationality: 'Indian', // Default or from model
      category: student.category || 'General',
      schoolName: settings.institution.name,
      schoolAddress: `${settings.institution.address?.street || ''}, ${settings.institution.address?.city || ''}`,
      affiliationNumber: settings.institution.affiliationNumber || 'AFF-XXXX',
      schoolBoard: settings.institution.board || 'CBSE',
      udiseCode: settings.institution.udiseCode || '-',
      schoolCode: settings.institution.schoolCode || settings.tenantId?.schoolCode || 'SCH-001',
      schoolLogo: settings.institution.logo,
      principalSignature: settings.institution.principalSignature,
      schoolPhone: settings.institution.contact?.phone || '',
      schoolEmail: settings.institution.contact?.email || '',
      place: settings.institution.address?.city || '',
      issueDate: today,
      applicationDate: today, // Default to today

      // TC Specifics placeholders
      admissionDate: student.admissionDate ? format(new Date(student.admissionDate), 'dd MMM yyyy') : '-',
      boardResult: 'Passed', // TODO: Fetch from Exam Result model
      promotionStatus: 'Yes',
      subjects: subjectsStudied,
      feeStatus: 'Paid up to date',
      conduct: 'Good',
      leavingReason: 'Parent Request', // Allow override from frontend
      remarks: '',

      penNumber: student.penNumber || '', // PEN Number from student profile

      // New fields for premium templates
      purpose: 'general purpose', // Bonafide: purpose of certificate
      srNumber: student.srNumber || student.admissionNumber || '-' // LC: SR/GR number
    };

    res.json({ ...data, pendingFeesInfo });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error previewing certificate', error: error.message });
  }
};

/**
 * Generate Certificate
 * Creates record, generates number, and returns PDF stream.
 */
exports.generateCertificate = async(req, res) => {
  try {
    const { studentId, type, specificData, autoDeactivate, categoryOverride, classOverride, penOverride, feesSkipped } = req.body;
    const tenantId = req.user.tenantId;

    // 1. Re-validate (similar to preview)
    const student = await User.findOne({ _id: studentId, tenantId });
    if (!student) return res.status(404).json({ message: 'Student not found' });

    // 1.1 Check if certificate already exists for this student
    const existingCert = await GeneratedCertificate.findOne({
      tenantId,
      student: studentId,
      type,
      status: 'ACTIVE'
    });

    if (existingCert) {
      const label = type === 'TC' ? 'Leaving Certificate' : 'Bonafide Certificate';
      return res.status(409).json({
        message: `${label} has already been generated for this student (${existingCert.certificateNumber}). You can download it from the Certificate Manager.`,
        existingCertificate: {
          id: existingCert._id,
          certificateNumber: existingCert.certificateNumber,
          issueDate: existingCert.issueDate
        }
      });
    }

    // 2. Generate Sequence Number
    const currentYear = new Date().getFullYear().toString();
    const counterName = type === 'TC' ? 'cert_tc' : 'cert_bonafide';
    const sequence = await Counter.getNextSequence(counterName, currentYear, tenantId);

    const certNumber = `${type}/${currentYear}/${String(sequence).padStart(4, '0')}`;

    // 3. Prepare Final Data (Merge preview logic + specificData + certNumber)
    // Note: Ideally we reuse a shared helper function for data prep to avoid code duplication with preview
    // For now, reusing some logic inline or assuming specificData contains the confirmed preview data + overrides

    const settings = await Settings.getSettings(tenantId);
    const finalData = {
      ...specificData, // Data passed from frontend confirm step (trusted or re-verified)
      certificateNumber: certNumber,
      schoolName: settings.institution.name,
      schoolAddress: `${settings.institution.address?.street || ''}, ${settings.institution.address?.city || ''}`,
      schoolCode: settings.institution.schoolCode || settings.tenantId?.schoolCode || 'SCH-001',
      schoolLogo: settings.institution.logo,
      principalSignature: settings.institution.principalSignature,
      schoolBoard: settings.institution.board || 'CBSE',
      udiseCode: settings.institution.udiseCode || '-',
      affiliationNumber: settings.institution.affiliationNumber || 'AFF-XXXX',
      schoolPhone: settings.institution.contact?.phone || '',
      schoolEmail: settings.institution.contact?.email || ''
    };

    // 3.1 Apply ephemeral overrides (TC only) — these do NOT update the student record
    if (type === 'TC') {
      if (categoryOverride !== undefined && categoryOverride !== null) {
        finalData.categoryOverride = categoryOverride;
      }
      if (classOverride !== undefined && classOverride !== null) {
        finalData.classOverride = classOverride;
      }
      if (penOverride !== undefined && penOverride !== null) {
        finalData.penNumber = penOverride;
      }
      if (feesSkipped) {
        finalData.feesSkippedAtTC = true;
        finalData.feesSkippedDate = new Date().toISOString();
      }
    }

    // 4. Create Record
    const newCert = await GeneratedCertificate.create({
      tenantId,
      student: studentId,
      type,
      certificateNumber: certNumber,
      academicYear: student.academicYear || settings.academic.currentYear,
      issuedBy: req.user.id, // Assuming req.user is set
      contentSnapshot: finalData
    });

    // 4.1. Auto-Deactivate Student logic if requested for TC
    if (type === 'TC' && autoDeactivate) {
      let parsedReason = specificData?.leavingReason || 'Transferred';
      if (!['Graduated', 'Transferred', 'Withdrawn', 'Expelled', 'Other'].includes(parsedReason)) {
        parsedReason = 'Other';
      }

      await User.updateOne(
        { _id: studentId, tenantId },
        {
          $set: {
            isActive: false,
            removalDate: new Date(),
            removalReason: parsedReason,
            removalNotes: `Auto-deactivated on TC generation (${certNumber})`
          }
        }
      );
    }

    // 5. Get Template
    const template = await CertificateTemplate.findOne({ tenantId, type }) || { type };

    // 6. Generate PDF (returns Buffer directly)
    let pdfBuffer;
    try {
      pdfBuffer = await pdfService.generateCertificate(finalData, template);
    } catch (pdfErr) {
      // PDF generation failed — clean up the already-created certificate record
      // so the user can retry without hitting a duplicate key error
      console.error('PDF generation failed, rolling back certificate record:', pdfErr.message);
      try {
        await GeneratedCertificate.deleteOne({ _id: newCert._id });
      } catch (delErr) {
        console.error('Failed to delete orphaned certificate record:', delErr.message);
      }
      throw pdfErr; // re-throw so the outer catch handles response + counter rollback
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${type}_${student.admissionNumber}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.end(pdfBuffer);

    // Archival to S3 in background (non-blocking, isolated try-catch)
    try {
      const { uploadBufferToS3, buildS3Key } = require('../utils/s3Upload');
      const s3Key = buildS3Key('certificates', tenantId, `${type}_${student.admissionNumber}.pdf`);
      uploadBufferToS3(pdfBuffer, s3Key, 'application/pdf')
        .catch(err => console.error(`Background S3 upload failed for certificate ${certNumber}:`, err.message));
    } catch (s3Err) {
      console.error('S3 upload setup error (non-fatal):', s3Err.message);
    }

  } catch (error) {
    console.error('Certificate generation error:', error.message, error.stack);

    // Rollback certificate counter so the number doesn't get skipped
    try {
      const currentYear = new Date().getFullYear().toString();
      const counterName = req.body.type === 'TC' ? 'cert_tc' : 'cert_bonafide';
      await Counter.rollbackSequence(counterName, currentYear, req.user.tenantId);
    } catch (rollbackErr) {
      console.error('Certificate counter rollback failed:', rollbackErr);
    }

    if (!res.headersSent) {
      res.status(500).json({ message: 'Error generating certificate', error: error.message });
    }
  }
};

exports.getGeneratedCertificates = async(req, res) => {
  try {
    const certs = await GeneratedCertificate.find({ tenantId: req.user.tenantId })
      .populate('student', 'fullName name admissionNumber class')
      .populate('issuedBy', 'fullName name firstName lastName')
      .sort({ issueDate: -1 });
    res.json(certs);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching history', error: error.message });
  }
};

exports.downloadCertificate = async(req, res) => {
  try {
    const { id } = req.params;
    const cert = await GeneratedCertificate.findOne({ _id: id, tenantId: req.user.tenantId });

    if (!cert) {
      return res.status(404).json({ message: 'Certificate not found' });
    }

    // Get Template (or default)
    const template = await CertificateTemplate.findOne({
      tenantId: req.user.tenantId,
      type: cert.type
    }) || { type: cert.type };

    // Generate PDF from stored snapshot (returns Buffer directly)
    const pdfBuffer = await pdfService.generateCertificate(cert.contentSnapshot, template);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${cert.type}_${cert.certificateNumber.replace(/\//g, '-')}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.end(pdfBuffer);

    // Archival to S3 in background (isolated try-catch)
    try {
      const { uploadBufferToS3, buildS3Key } = require('../utils/s3Upload');
      const s3Key = buildS3Key('certificates', req.user.tenantId, `${cert.type}_${cert.certificateNumber}.pdf`);
      uploadBufferToS3(pdfBuffer, s3Key, 'application/pdf')
        .catch(err => console.error(`Background S3 upload failed for certificate ${cert.certificateNumber}:`, err.message));
    } catch (s3Err) {
      console.error('S3 upload setup error (non-fatal):', s3Err.message);
    }

  } catch (error) {
    console.error('Download error:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Error downloading certificate' });
    }
  }
};

/**
 * Download Certificate as Word (DOCX)
 * Generates an editable Word document from stored snapshot.
 */
exports.downloadCertificateWord = async(req, res) => {
  try {
    const { id } = req.params;
    const cert = await GeneratedCertificate.findOne({ _id: id, tenantId: req.user.tenantId });

    if (!cert) {
      return res.status(404).json({ message: 'Certificate not found' });
    }

    const data = cert.contentSnapshot || {};
    const isTC = cert.type === 'TC';

    // Fetch logo and signature as base64 data URIs for embedding in Word
    const [logoDataUri, signatureDataUri] = await Promise.all([
      fetchImageAsBase64(data.schoolLogo),
      fetchImageAsBase64(data.principalSignature)
    ]);

    // Build HTML matching the tc-minimal / bonafide-minimal template design
    const html = isTC
      ? buildTCWordHtml(data, cert, logoDataUri, signatureDataUri)
      : buildBonafideWordHtml(data, cert, logoDataUri, signatureDataUri);

    const docxBuffer = await HTMLtoDOCX(html, null, {
      table: { row: { cantSplit: true } },
      footer: true,
      pageNumber: true
    });

    const filename = `${cert.type}_${cert.certificateNumber.replace(/\//g, '-')}.docx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', docxBuffer.length);
    res.end(docxBuffer);

  } catch (error) {
    console.error('Word download error:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Error generating Word document', error: error.message });
    }
  }
};

// Fetch an image (URL or local path) and return a base64 data URI, or null on failure
async function fetchImageAsBase64(imagePath) {
  if (!imagePath) return null;
  try {
    let imageBuffer;
    if (imagePath.startsWith('http')) {
      const response = await axios.get(imagePath, { responseType: 'arraybuffer', timeout: 5000 });
      imageBuffer = Buffer.from(response.data);
    } else {
      let localPath = imagePath;
      if (localPath.startsWith('/')) localPath = nodePath.join(process.cwd(), localPath);
      if (!fs.existsSync(localPath)) localPath = nodePath.resolve(process.cwd(), imagePath);
      if (!fs.existsSync(localPath)) localPath = nodePath.join(process.cwd(), 'uploads', nodePath.basename(imagePath));
      if (!fs.existsSync(localPath)) return null;
      imageBuffer = fs.readFileSync(localPath);
    }
    const ext = nodePath.extname(imagePath).toLowerCase();
    let mimeType = 'image/png';
    if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
    else if (ext === '.svg') mimeType = 'image/svg+xml';
    else if (ext === '.webp') mimeType = 'image/webp';
    return `data:${mimeType};base64,${imageBuffer.toString('base64')}`;
  } catch {
    return null;
  }
}

// HTML escape helper for Word generation
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Build TC Word HTML matching tc-minimal.html design.
 * Uses table-based layout for Word compatibility (no flexbox/grid/border-radius).
 */
function buildTCWordHtml(data, cert, logoDataUri, signatureDataUri) {
  const e = escapeHtml;
  const schoolName = e(data.schoolName || '');
  const schoolAddr = e(data.schoolAddress || '');
  const schoolPhone = e(data.schoolPhone || '');
  const schoolEmail = e(data.schoolEmail || '');
  const affNo = e(data.affiliationNumber || '');
  const schoolCode = e(data.schoolCode || '');
  const udise = e(data.udiseCode || '');
  const certNum = e(cert.certificateNumber || '');
  const admNo = e(data.admissionNumber || '');

  const rows = [
    { num: '01', label: 'Name of the Student', val: e(data.studentName || ''), bold: true },
    { num: '02', label: 'Father\'s / Guardian\'s Name', val: e(data.fatherName || '') },
    { num: '03', label: 'Mother\'s Name', val: e(data.motherName || '') },
    { num: '04', label: 'Nationality', val: e(data.nationality || '') },
    { num: '05', label: 'Category (Gen / SC / ST / OBC)', val: e(data.categoryOverride || data.category || '') },
    { num: '06', label: 'Date of Birth', val: `${e(data.dob || '')}${data.dobWords ? ` (${e(data.dobWords)})` : ''}`, bold: true },
    { num: '07', label: 'PEN Number', val: e(data.penNumber || '-') },
    { num: '08', label: 'Date of First Admission in School', val: e(data.admissionDate || '') },
    { num: '09', label: 'Class in which Last Studied', val: `${e(data.classOverride || data.class || '')} - ${e(data.section || '')}`, bold: true },
    { num: '10', label: 'Board Examination Last Taken', val: e(data.boardResult || '') },
    { num: '11', label: 'Whether Qualified for Promotion', val: e(data.promotionStatus || '') },
    { num: '12', label: 'Subjects Studied', val: e(data.subjects || '') },
    { num: '13', label: 'Month up to which Fees Paid', val: e(data.feeStatus || '') },
    { num: '14', label: 'General Conduct', val: e(data.conduct || '') },
    { num: '15', label: 'Date of Application for Certificate', val: e(data.applicationDate || '') },
    { num: '16', label: 'Date of Issue of Certificate', val: e(data.issueDate || '') },
    { num: '17', label: 'Reason for Leaving the School', val: e(data.leavingReason || ''), bold: true },
    { num: '18', label: 'Any Other Remarks', val: e(data.remarks || '-') }
  ];

  const tableRows = rows.map((r, i) => {
    const bg = i % 2 === 0 ? '#f0fdfa' : '#ffffff';
    const valWeight = r.bold ? 'font-weight:700;color:#111827;' : 'font-weight:500;color:#374151;';
    return `<tr style="background:${bg};">
      <td style="width:30px;text-align:center;font-size:9pt;font-weight:600;color:#4b5563;border-bottom:1px solid #e5e7eb;border-right:1px solid #e5e7eb;padding:4px 4px;">${r.num}</td>
      <td style="width:42%;font-size:10pt;font-weight:600;color:#1f2937;border-bottom:1px solid #e5e7eb;border-right:1px solid #e5e7eb;padding:4px 10px;">${r.label}</td>
      <td style="font-size:10pt;${valWeight}border-bottom:1px solid #e5e7eb;padding:4px 10px;">${r.val}</td>
    </tr>`;
  }).join('\n');

  return `<html>
<head>
<style>
  @page { size: A4 portrait; margin: 15mm 12mm; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111827; margin: 0; padding: 0; }
  table { border-collapse: collapse; }
</style>
</head>
<body>
  <!-- HEADER -->
  <table style="width:100%;margin-bottom:6px;">
    <tr>
      ${logoDataUri ? `<td style="width:90px;vertical-align:top;padding:4px 10px 0 0;">
        <img src="${logoDataUri}" alt="School Logo" style="width:85px;height:85px;object-fit:contain;" />
      </td>` : ''}
      <td style="text-align:center;vertical-align:top;">
        <p style="font-family:Georgia,'Times New Roman',serif;font-size:22pt;font-weight:800;color:#1F6F6D;letter-spacing:2px;text-transform:uppercase;margin:0;line-height:1.1;">${schoolName}</p>
        <p style="font-size:9pt;color:#4b5563;font-weight:500;margin:3px 0 0;">${schoolAddr}</p>
        ${schoolPhone || schoolEmail ? `<p style="font-size:9pt;color:#4b5563;font-weight:500;margin:2px 0 0;">${schoolPhone ? `Phone: ${schoolPhone}` : ''}${schoolPhone && schoolEmail ? ' &nbsp;|&nbsp; ' : ''}${schoolEmail ? `Email: ${schoolEmail}` : ''}</p>` : ''}
        <p style="font-size:8pt;color:#4b5563;font-weight:500;margin:5px 0 0;">
          ${affNo ? `Affiliation No: <b style="color:#111827;">${affNo}</b>` : ''}
          ${affNo && schoolCode ? ' &nbsp;&nbsp;&nbsp; ' : ''}
          ${schoolCode ? `School Code: <b style="color:#111827;">${schoolCode}</b>` : ''}
          ${(affNo || schoolCode) && udise ? ' &nbsp;&nbsp;&nbsp; ' : ''}
          ${udise ? `UDISE: <b style="color:#111827;">${udise}</b>` : ''}
        </p>
      </td>
    </tr>
  </table>

  <!-- DIVIDER -->
  <hr style="border:none;height:1px;background:#e5e7eb;margin:0 0 6px;" />

  <!-- TITLE -->
  <table style="width:100%;margin-bottom:6px;">
    <tr>
      <td style="text-align:center;padding:12px 0;">
        <table style="margin:0 auto;background:#edf9f7;padding:8px 24px 10px;">
          <tr>
            <td style="text-align:center;">
              <p style="font-family:Arial,Helvetica,sans-serif;font-size:13pt;font-weight:700;color:#0a5c56;letter-spacing:4px;text-transform:uppercase;margin:0;">SCHOOL LEAVING CERTIFICATE</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <!-- META ROW -->
  <table style="width:100%;background:#f9fafb;border:1px solid #e5e7eb;margin-bottom:8px;">
    <tr>
      <td style="padding:7px 20px;font-size:10pt;font-weight:600;color:#111827;">
        <span style="color:#3EC4B1;font-weight:700;">#</span> ${certNum}
      </td>
      <td style="padding:7px 20px;font-size:10pt;color:#374151;font-weight:500;text-align:right;">
        Admission No: <b style="color:#111827;">${admNo}</b>
      </td>
    </tr>
  </table>

  <!-- FIELDS TABLE -->
  <table style="width:100%;border:1px solid #e5e7eb;margin-bottom:8px;">
    ${tableRows}
  </table>

  <!-- NOTE BOX -->
  <table style="width:100%;background:#f9fafb;border:1px solid #e5e7eb;margin-bottom:6px;">
    <tr>
      <td style="padding:6px 12px;">
        <p style="font-size:8pt;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.5px;margin:0;">Important Note</p>
        <p style="font-size:8.5pt;font-weight:500;color:#4b5563;line-height:1.5;margin:2px 0 0;">This certificate is issued based on school records. No alteration shall be made on this certificate. Erasing or overwriting renders it invalid.</p>
      </td>
    </tr>
  </table>

  <!-- CERTIFICATION -->
  <p style="font-size:8pt;color:#4b5563;font-weight:500;font-style:italic;line-height:1.45;margin:0 0 3px;">Certified that the above information is in accordance with school records. This certificate does not entitle the holder to any benefits unless countersigned by competent authority.</p>
  <p style="font-size:9pt;color:#111827;font-weight:600;margin:0 0 8px;">Place: ${e(data.place || '')}</p>

  <!-- SIGNATURES -->
  <table style="width:100%;margin-top:40px;">
    <tr>
      <td style="width:33%;text-align:center;vertical-align:bottom;padding-top:50px;">
        <hr style="width:110px;border:none;height:1px;background:#9ca3af;margin:0 auto 4px;" />
        <p style="font-size:9pt;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:0.8px;margin:0;">Class Teacher</p>
      </td>
      <td style="width:34%;text-align:center;vertical-align:bottom;">
        <div style="width:90px;height:90px;border:2px dashed #d1d5db;margin:0 auto;">&nbsp;</div>
      </td>
      <td style="width:33%;text-align:center;vertical-align:bottom;padding-top:10px;">
        ${signatureDataUri ? `<img src="${signatureDataUri}" alt="Principal Signature" style="max-height:70px;max-width:150px;display:block;margin:0 auto 4px;object-fit:contain;" />` : ''}
        <hr style="width:110px;border:none;height:1px;background:#9ca3af;margin:0 auto 4px;" />
        <p style="font-size:9pt;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:0.8px;margin:0;">Principal</p>
      </td>
    </tr>
  </table>

  <!-- FOOTER -->
  <hr style="border:none;height:1px;background:#e5e7eb;margin:16px 0 6px;" />
  <p style="text-align:center;font-size:7pt;color:#4b5563;font-weight:500;text-transform:uppercase;letter-spacing:1.5px;margin:0;">
    Powered by <span style="font-weight:600;color:#0f766e;">Learnovo</span> &mdash; School Management System
  </p>
</body>
</html>`;
}

/**
 * Build Bonafide Word HTML matching bonafide-minimal.html design.
 */
function buildBonafideWordHtml(data, cert, logoDataUri, signatureDataUri) {
  const e = escapeHtml;
  const schoolName = e(data.schoolName || '');
  const schoolAddr = e(data.schoolAddress || '');
  const schoolPhone = e(data.schoolPhone || '');
  const schoolEmail = e(data.schoolEmail || '');
  const affNo = e(data.affiliationNumber || '');
  const schoolCode = e(data.schoolCode || '');
  const udise = e(data.udiseCode || '');
  const schoolBoard = e(data.schoolBoard || '');
  const certNum = e(cert.certificateNumber || '');
  const issueDate = e(data.issueDate || '');
  const studentName = e(data.studentName || '');
  const fatherName = e(data.fatherName || '');
  const motherName = e(data.motherName || '');
  const className = e(data.class || '');
  const section = e(data.section || '');
  const academicYear = e(data.academicYear || '');
  const dob = e(data.dob || '');
  const admNo = e(data.admissionNumber || '');
  const purpose = e(data.purpose || 'general purpose');

  return `<html>
<head>
<style>
  @page { size: A4 portrait; margin: 15mm 12mm; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111827; margin: 0; padding: 0; }
  table { border-collapse: collapse; }
</style>
</head>
<body>
  <!-- HEADER -->
  <table style="width:100%;margin-bottom:6px;">
    <tr>
      ${logoDataUri ? `<td style="width:90px;vertical-align:top;padding:4px 10px 0 0;">
        <img src="${logoDataUri}" alt="School Logo" style="width:85px;height:85px;object-fit:contain;" />
      </td>` : ''}
      <td style="text-align:center;vertical-align:top;">
        <p style="font-family:Georgia,'Times New Roman',serif;font-size:22pt;font-weight:800;color:#1F6F6D;letter-spacing:2px;text-transform:uppercase;margin:0;line-height:1.1;">${schoolName}</p>
        <p style="font-size:9pt;color:#4b5563;font-weight:500;margin:3px 0 0;">${schoolAddr}</p>
        ${schoolPhone || schoolEmail ? `<p style="font-size:9pt;color:#4b5563;font-weight:500;margin:2px 0 0;">${schoolPhone ? `Phone: ${schoolPhone}` : ''}${schoolPhone && schoolEmail ? ' &nbsp;|&nbsp; ' : ''}${schoolEmail ? `Email: ${schoolEmail}` : ''}</p>` : ''}
        <p style="font-size:8pt;color:#4b5563;font-weight:500;margin:5px 0 0;">
          ${affNo ? `Affiliation No: <b style="color:#111827;">${affNo}</b>` : ''}
          ${affNo && schoolCode ? ' &nbsp;&nbsp;&nbsp; ' : ''}
          ${schoolCode ? `School Code: <b style="color:#111827;">${schoolCode}</b>` : ''}
          ${(affNo || schoolCode) && udise ? ' &nbsp;&nbsp;&nbsp; ' : ''}
          ${udise ? `UDISE: <b style="color:#111827;">${udise}</b>` : ''}
        </p>
      </td>
    </tr>
  </table>

  <!-- DIVIDER -->
  <hr style="border:none;height:1px;background:#e5e7eb;margin:0 0 6px;" />

  <!-- TITLE -->
  <table style="width:100%;margin-bottom:6px;">
    <tr>
      <td style="text-align:center;padding:12px 0;">
        <table style="margin:0 auto;background:#edf9f7;padding:8px 24px 10px;">
          <tr>
            <td style="text-align:center;">
              <p style="font-family:Arial,Helvetica,sans-serif;font-size:13pt;font-weight:700;color:#0a5c56;letter-spacing:4px;text-transform:uppercase;margin:0;">BONAFIDE CERTIFICATE</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <!-- META ROW -->
  <table style="width:100%;background:#f9fafb;border:1px solid #e5e7eb;margin-bottom:14px;">
    <tr>
      <td style="padding:7px 20px;font-size:10pt;font-weight:600;color:#111827;">
        <span style="color:#3EC4B1;font-weight:700;">#</span> ${certNum}
      </td>
      <td style="padding:7px 20px;font-size:10pt;color:#374151;font-weight:500;text-align:right;">
        Date of Issue: <b style="color:#111827;">${issueDate}</b>
      </td>
    </tr>
  </table>

  <!-- TO WHOM IT MAY CONCERN -->
  <p style="font-family:Georgia,'Times New Roman',serif;font-size:12pt;font-weight:600;color:#0a5c56;text-align:center;letter-spacing:2px;text-transform:uppercase;margin:0 0 4px;">To Whom It May Concern</p>
  <hr style="width:50px;border:none;height:2px;background:#3EC4B1;margin:0 auto 16px;" />

  <!-- DECLARATION -->
  <p style="font-size:11pt;line-height:2;color:#374151;font-weight:500;text-align:justify;margin:0 0 16px;">
    This is to certify that <b style="color:#111827;border-bottom:1.5px solid rgba(62,196,177,0.35);">${studentName}</b>,
    Son/Daughter of Shri <b style="color:#111827;border-bottom:1.5px solid rgba(62,196,177,0.35);">${fatherName}</b>
    and Smt. <b style="color:#111827;border-bottom:1.5px solid rgba(62,196,177,0.35);">${motherName}</b>,
    is a bonafide student of this institution. He/She is currently studying in
    Class <b style="color:#111827;border-bottom:1.5px solid rgba(62,196,177,0.35);">${className} (${section})</b>
    for the Academic Session <b style="color:#111827;border-bottom:1.5px solid rgba(62,196,177,0.35);">${academicYear}</b>.
    His/Her date of birth as per our school records is
    <b style="color:#111827;border-bottom:1.5px solid rgba(62,196,177,0.35);">${dob}</b>.
  </p>

  <!-- DETAILS GRID -->
  <table style="width:100%;background:#f0fdfa;border:1px solid #e5e7eb;margin-bottom:14px;">
    <tr>
      <td style="width:50%;padding:10px 16px;vertical-align:top;">
        <p style="font-size:7pt;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:1px;margin:0;">Student Name</p>
        <p style="font-size:10pt;font-weight:700;color:#111827;margin:2px 0 0;">${studentName}</p>
      </td>
      <td style="width:50%;padding:10px 16px;vertical-align:top;">
        <p style="font-size:7pt;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:1px;margin:0;">Admission Number</p>
        <p style="font-size:10pt;font-weight:700;color:#111827;margin:2px 0 0;">${admNo}</p>
      </td>
    </tr>
    <tr>
      <td style="width:50%;padding:10px 16px;vertical-align:top;">
        <p style="font-size:7pt;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:1px;margin:0;">Father's Name</p>
        <p style="font-size:10pt;font-weight:700;color:#111827;margin:2px 0 0;">${fatherName}</p>
      </td>
      <td style="width:50%;padding:10px 16px;vertical-align:top;">
        <p style="font-size:7pt;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:1px;margin:0;">Mother's Name</p>
        <p style="font-size:10pt;font-weight:700;color:#111827;margin:2px 0 0;">${motherName}</p>
      </td>
    </tr>
    <tr>
      <td style="width:50%;padding:10px 16px;vertical-align:top;">
        <p style="font-size:7pt;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:1px;margin:0;">Class &amp; Section</p>
        <p style="font-size:10pt;font-weight:700;color:#111827;margin:2px 0 0;">${className} - ${section}</p>
      </td>
      <td style="width:50%;padding:10px 16px;vertical-align:top;">
        <p style="font-size:7pt;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:1px;margin:0;">Date of Birth</p>
        <p style="font-size:10pt;font-weight:700;color:#111827;margin:2px 0 0;">${dob}</p>
      </td>
    </tr>
    <tr>
      <td style="width:50%;padding:10px 16px;vertical-align:top;">
        <p style="font-size:7pt;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:1px;margin:0;">Academic Session</p>
        <p style="font-size:10pt;font-weight:700;color:#111827;margin:2px 0 0;">${academicYear}</p>
      </td>
      <td style="width:50%;padding:10px 16px;vertical-align:top;">
        <p style="font-size:7pt;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:1px;margin:0;">Board / Affiliation</p>
        <p style="font-size:10pt;font-weight:700;color:#111827;margin:2px 0 0;">${schoolBoard}</p>
      </td>
    </tr>
  </table>

  <!-- PURPOSE -->
  <p style="font-size:10pt;color:#4b5563;font-weight:500;line-height:1.8;text-align:justify;margin:0 0 10px;">
    This certificate is issued on the request of the student/parent for the purpose of
    <b style="color:#111827;">${purpose}</b>.
    No fees are due from the student at the time of issue of this certificate.
  </p>
  ${data.remarks ? `<p style="font-size:10pt;margin:0 0 10px;"><b>Remarks:</b> ${e(data.remarks)}</p>` : ''}

  <!-- PLACE -->
  <p style="font-size:9pt;color:#111827;font-weight:600;margin:0 0 8px;">Place: ${e(data.place || '')}</p>

  <!-- SIGNATURES -->
  <table style="width:100%;margin-top:40px;">
    <tr>
      <td style="width:33%;text-align:center;vertical-align:bottom;padding-top:50px;">
        <hr style="width:110px;border:none;height:1px;background:#9ca3af;margin:0 auto 4px;" />
        <p style="font-size:9pt;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:0.8px;margin:0;">Class Teacher</p>
      </td>
      <td style="width:34%;text-align:center;vertical-align:bottom;">
        <div style="width:90px;height:90px;border:2px dashed #d1d5db;margin:0 auto;">&nbsp;</div>
      </td>
      <td style="width:33%;text-align:center;vertical-align:bottom;padding-top:10px;">
        ${signatureDataUri ? `<img src="${signatureDataUri}" alt="Principal Signature" style="max-height:70px;max-width:150px;display:block;margin:0 auto 4px;object-fit:contain;" />` : ''}
        <hr style="width:110px;border:none;height:1px;background:#9ca3af;margin:0 auto 4px;" />
        <p style="font-size:9pt;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:0.8px;margin:0;">Principal</p>
      </td>
    </tr>
  </table>

  <!-- FOOTER -->
  <hr style="border:none;height:1px;background:#e5e7eb;margin:16px 0 6px;" />
  <p style="text-align:center;font-size:7pt;color:#4b5563;font-weight:500;text-transform:uppercase;letter-spacing:1.5px;margin:0;">
    Powered by <span style="font-weight:600;color:#0f766e;">Learnovo</span> &mdash; School Management System
  </p>
</body>
</html>`;
}

exports.deleteCertificate = async(req, res) => {
  try {
    const { id } = req.params;
    const result = await GeneratedCertificate.deleteOne({ _id: id, tenantId: req.user.tenantId });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Certificate not found' });
    }

    res.json({ message: 'Certificate deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting certificate', error: error.message });
  }
};

exports.updateCertificate = async(req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body; // e.g. { remarks: '...', leavingReason: '...' }

    const cert = await GeneratedCertificate.findOne({ _id: id, tenantId: req.user.tenantId });
    if (!cert) {
      return res.status(404).json({ message: 'Certificate not found' });
    }

    // Merge updates into contentSnapshot
    cert.contentSnapshot = {
      ...cert.contentSnapshot,
      ...updates
    };

    await cert.save();
    res.json({ message: 'Certificate updated successfully', certificate: cert });
  } catch (error) {
    res.status(500).json({ message: 'Error updating certificate', error: error.message });
  }
};
