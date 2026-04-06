const CertificateTemplate = require('../models/CertificateTemplate');
const GeneratedCertificate = require('../models/GeneratedCertificate');
const User = require('../models/User');
const Settings = require('../models/Settings');
const Fee = require('../models/Fee');
const FeeInvoice = require('../models/FeeInvoice');
const StudentBalance = require('../models/StudentBalance');
const FeeAuditLog = require('../models/FeeAuditLog');
const AnnualFeeAllocation = require('../models/AnnualFeeAllocation');
const Counter = require('../models/Counter');
const ClassSubject = require('../models/ClassSubject');
const AcademicSession = require('../models/AcademicSession');
const pdfService = require('../services/pdfService');
const { format } = require('date-fns');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle, ImageRun } = require('docx');
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

    // --- Check pending fees/invoices for TC (warning, not blocking) ---
    let pendingFeesInfo = null;
    if (type === 'TC') {
      // Fetch outstanding invoices from FeeInvoice (primary fee system)
      const pendingInvoices = await FeeInvoice.find({
        tenantId,
        studentId,
        status: { $in: ['Pending', 'Partial', 'Overdue'] }
      }).sort({ dueDate: 1 });

      // Also check legacy Fee model for backward compatibility
      const pendingFees = await Fee.find({
        student: studentId,
        status: { $in: ['pending', 'overdue', 'partially_paid'] }
      });

      const invoiceTotal = pendingInvoices.reduce((sum, inv) => sum + (inv.balanceAmount || 0), 0);
      const legacyTotal = pendingFees.reduce((sum, f) => sum + (f.balance > 0 ? f.balance : f.amount - (f.paidAmount || 0)), 0);
      const totalPending = invoiceTotal + legacyTotal;

      if (totalPending > 0) {
        pendingFeesInfo = {
          hasPending: true,
          totalAmount: totalPending,
          invoiceTotal,
          legacyTotal,
          count: pendingInvoices.length + pendingFees.length,
          invoices: pendingInvoices.map(inv => ({
            id: inv._id,
            invoiceNumber: inv.invoiceNumber,
            description: inv.items?.map(i => i.feeHeadName).join(', ') || 'Fee Invoice',
            periodLabel: inv.periodLabel || '',
            totalAmount: inv.totalAmount,
            paidAmount: inv.paidAmount || 0,
            balance: inv.balanceAmount || 0,
            status: inv.status,
            dueDate: inv.dueDate
          })),
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
    const { studentId, type, specificData, autoDeactivate, categoryOverride, classOverride, penOverride, feesSkipped, cancelInvoices } = req.body;
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

    // 4.2. Cancel pending invoices if requested (e.g., student promoted, leaving school)
    if (type === 'TC' && cancelInvoices) {
      try {
        const invoicesToCancel = await FeeInvoice.find({
          tenantId,
          studentId,
          status: { $in: ['Pending', 'Partial', 'Overdue'] }
        });

        if (invoicesToCancel.length > 0) {
          const cancelledInvoiceNumbers = [];
          for (const invoice of invoicesToCancel) {
            invoice.status = 'Cancelled';
            invoice.balanceAmount = 0;
            invoice.cancelledAt = new Date();
            invoice.cancelledBy = req.user._id;
            invoice.cancellationReason = `Cancelled on TC/LC generation (${certNumber})`;
            await invoice.save();
            cancelledInvoiceNumbers.push(invoice.invoiceNumber);

            // Update student balance for each academic session
            try {
              await StudentBalance.updateBalance(tenantId, studentId, invoice.academicSessionId);
            } catch (e) { /* non-fatal */ }

            // Update allocation if linked
            if (invoice.annualAllocationId) {
              try {
                await AnnualFeeAllocation.recalculateFromInvoices(invoice.annualAllocationId);
              } catch (e) { /* non-fatal */ }
            }
          }

          // Audit log
          try {
            await FeeAuditLog.logAction({
              tenantId,
              action: 'INVOICES_CANCELLED_ON_TC',
              entityType: 'GeneratedCertificate',
              entityId: newCert._id,
              userId: req.user._id,
              userName: req.user.name || req.user.fullName,
              userRole: req.user.role,
              details: {
                certificateNumber: certNumber,
                studentId,
                cancelledInvoices: cancelledInvoiceNumbers,
                count: cancelledInvoiceNumbers.length
              },
              ipAddress: req.ip
            });
          } catch (e) { /* non-fatal */ }

          // Store in content snapshot
          newCert.contentSnapshot.invoicesCancelledAtTC = true;
          newCert.contentSnapshot.cancelledInvoiceCount = cancelledInvoiceNumbers.length;
          newCert.contentSnapshot.cancelledInvoiceNumbers = cancelledInvoiceNumbers;
          await newCert.save();
        }
      } catch (cancelErr) {
        console.error('Invoice cancellation during TC failed (non-fatal):', cancelErr.message);
      }
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

    // Fetch logo and signature images as raw buffers
    const [logoBuffer, signatureBuffer] = await Promise.all([
      fetchImageBuffer(data.schoolLogo),
      fetchImageBuffer(data.principalSignature)
    ]);

    // Build native DOCX using the docx package
    const doc = isTC
      ? buildTCDocument(data, cert, logoBuffer, signatureBuffer)
      : buildBonafideDocument(data, cert, logoBuffer, signatureBuffer);

    const docxBuffer = await Packer.toBuffer(doc);

    // Write to temp file and stream — avoids compression middleware corrupting binary
    const tmpPath = nodePath.join('/tmp', `cert_${cert._id}_${Date.now()}.docx`);
    fs.writeFileSync(tmpPath, docxBuffer);

    const filename = `${cert.type}_${cert.certificateNumber.replace(/\//g, '-')}.docx`;
    res.download(tmpPath, filename, (err) => {
      // Clean up temp file after download
      try {
        fs.unlinkSync(tmpPath);
      } catch (_) { /* ignore */ }
      if (err && !res.headersSent) {
        res.status(500).json({ message: 'Error sending Word document' });
      }
    });

  } catch (error) {
    console.error('Word download error:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Error generating Word document', error: error.message });
    }
  }
};

// Fetch an image and return raw Buffer, or null on failure
async function fetchImageBuffer(imagePath) {
  if (!imagePath) return null;
  try {
    if (imagePath.startsWith('http')) {
      const response = await axios.get(imagePath, { responseType: 'arraybuffer', timeout: 5000 });
      return Buffer.from(response.data);
    }
    let localPath = imagePath;
    if (localPath.startsWith('/')) localPath = nodePath.join(process.cwd(), localPath);
    if (!fs.existsSync(localPath)) localPath = nodePath.resolve(process.cwd(), imagePath);
    if (!fs.existsSync(localPath)) return null;
    return fs.readFileSync(localPath);
  } catch {
    return null;
  }
}

// ═══ Shared helpers for native DOCX builders ═══

const TEAL = '1F6F6D';
const DARK = '111827';
const GRAY = '4B5563';
const LIGHT_TEAL_BG = 'EDF9F7';
const ALT_ROW_BG = 'F0FDFA';
const BORDER_COLOR = 'E5E7EB';

const noBorders = {
  top: { style: BorderStyle.NONE, size: 0 },
  bottom: { style: BorderStyle.NONE, size: 0 },
  left: { style: BorderStyle.NONE, size: 0 },
  right: { style: BorderStyle.NONE, size: 0 }
};

const thinBorders = {
  top: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
  left: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
  right: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR }
};

function textRun(text, opts = {}) {
  return new TextRun({ text: text || '', font: 'Arial', size: opts.size || 20, color: opts.color || DARK, bold: opts.bold || false, italics: opts.italics || false, ...opts });
}

function buildHeaderParagraphs(data, logoBuffer) {
  const children = [];

  // School logo
  if (logoBuffer) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [new ImageRun({ data: logoBuffer, transformation: { width: 130, height: 130 } })]
    }));
  }

  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 40 },
    children: [textRun(data.schoolName || '', { size: 36, bold: true, color: TEAL, font: 'Georgia' })]
  }));

  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 20 },
    children: [textRun(data.schoolAddress || '', { size: 18, color: GRAY })]
  }));

  if (data.schoolPhone || data.schoolEmail) {
    const parts = [];
    if (data.schoolPhone) parts.push(`Phone: ${data.schoolPhone}`);
    if (data.schoolEmail) parts.push(`Email: ${data.schoolEmail}`);
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 20 },
      children: [textRun(parts.join('  |  '), { size: 18, color: GRAY })]
    }));
  }

  const affParts = [];
  if (data.affiliationNumber) affParts.push(`Affiliation No: ${data.affiliationNumber}`);
  if (data.schoolCode) affParts.push(`School Code: ${data.schoolCode}`);
  if (data.udiseCode) affParts.push(`UDISE: ${data.udiseCode}`);
  if (affParts.length) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [textRun(affParts.join('     '), { size: 16, color: GRAY })]
    }));
  }

  return children;
}

function buildTitleParagraph(title) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 100, after: 100 },
    shading: { type: 'clear', fill: LIGHT_TEAL_BG },
    children: [textRun(title, { size: 26, bold: true, color: '0A5C56', font: 'Arial' })]
  });
}

function buildMetaRow(leftLabel, leftValue, rightLabel, rightValue) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: thinBorders,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: noBorders,
            shading: { type: 'clear', fill: 'F9FAFB' },
            children: [new Paragraph({ spacing: { before: 40, after: 40 }, children: [
              textRun(`${leftLabel}: `, { size: 20, color: GRAY }),
              textRun(leftValue, { size: 20, bold: true, color: DARK })
            ] })]
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: noBorders,
            shading: { type: 'clear', fill: 'F9FAFB' },
            children: [new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { before: 40, after: 40 }, children: [
              textRun(`${rightLabel}: `, { size: 20, color: GRAY }),
              textRun(rightValue, { size: 20, bold: true, color: DARK })
            ] })]
          })
        ]
      })
    ]
  });
}

function buildSignatureSection(signatureBuffer, stampBuffer) {
  // Principal signature column
  const sigChildren = [];
  if (signatureBuffer) {
    sigChildren.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200 },
      children: [new ImageRun({ data: signatureBuffer, transformation: { width: 140, height: 70 } })]
    }));
  } else {
    sigChildren.push(new Paragraph({ spacing: { before: 600 }, children: [] }));
  }
  sigChildren.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [textRun('________________________', { size: 18, color: '9CA3AF' })] }));
  sigChildren.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [textRun('PRINCIPAL', { size: 18, bold: true, color: GRAY })] }));

  // Stamp/seal column
  const stampChildren = [];
  if (stampBuffer) {
    stampChildren.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200 },
      children: [new ImageRun({ data: stampBuffer, transformation: { width: 90, height: 90 } })]
    }));
  } else {
    stampChildren.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 300 }, children: [textRun('[ School Seal ]', { size: 16, color: '9CA3AF', italics: true })] }));
  }

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: noBorders.top, bottom: noBorders.bottom, left: noBorders.left, right: noBorders.right },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 33, type: WidthType.PERCENTAGE },
            borders: noBorders,
            children: [
              new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 600 }, children: [textRun('________________________', { size: 18, color: '9CA3AF' })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, children: [textRun('CLASS TEACHER', { size: 18, bold: true, color: GRAY })] })
            ]
          }),
          new TableCell({
            width: { size: 34, type: WidthType.PERCENTAGE },
            borders: noBorders,
            children: stampChildren
          }),
          new TableCell({
            width: { size: 33, type: WidthType.PERCENTAGE },
            borders: noBorders,
            children: sigChildren
          })
        ]
      })
    ]
  });
}

function buildFooter() {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 200 },
    border: { top: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR, space: 8 } },
    children: [textRun('Powered by ', { size: 14, color: GRAY }), textRun('Learnovo', { size: 14, bold: true, color: '0F766E' }), textRun(' — School Management System', { size: 14, color: GRAY })]
  });
}

// ═══ TC Document Builder ═══

function buildTCDocument(data, cert, logoBuffer, signatureBuffer) {
  const rows = [
    { num: '01', label: 'Name of the Student', val: data.studentName || '', bold: true },
    { num: '02', label: 'Father\'s / Guardian\'s Name', val: data.fatherName || '' },
    { num: '03', label: 'Mother\'s Name', val: data.motherName || '' },
    { num: '04', label: 'Nationality', val: data.nationality || '' },
    { num: '05', label: 'Category (Gen / SC / ST / OBC)', val: data.categoryOverride || data.category || '' },
    { num: '06', label: 'Date of Birth', val: `${data.dob || ''}${data.dobWords ? ` (${data.dobWords})` : ''}`, bold: true },
    { num: '07', label: 'PEN Number', val: data.penNumber || '-' },
    { num: '08', label: 'Date of First Admission in School', val: data.admissionDate || '' },
    { num: '09', label: 'Class in which Last Studied', val: `${data.classOverride || data.class || ''} - ${data.section || ''}`, bold: true },
    { num: '10', label: 'Board Examination Last Taken', val: data.boardResult || '' },
    { num: '11', label: 'Whether Qualified for Promotion', val: data.promotionStatus || '' },
    { num: '12', label: 'Subjects Studied', val: data.subjects || '' },
    { num: '13', label: 'Month up to which Fees Paid', val: data.feeStatus || '' },
    { num: '14', label: 'General Conduct', val: data.conduct || '' },
    { num: '15', label: 'Date of Application for Certificate', val: data.applicationDate || '' },
    { num: '16', label: 'Date of Issue of Certificate', val: data.issueDate || '' },
    { num: '17', label: 'Reason for Leaving the School', val: data.leavingReason || '', bold: true },
    { num: '18', label: 'Any Other Remarks', val: data.remarks || '-' }
  ];

  const tableRows = rows.map((r, i) => new TableRow({
    children: [
      new TableCell({ width: { size: 5, type: WidthType.PERCENTAGE }, borders: thinBorders, shading: { type: 'clear', fill: i % 2 === 0 ? ALT_ROW_BG : 'FFFFFF' }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [textRun(r.num, { size: 18, bold: true, color: GRAY })] })] }),
      new TableCell({ width: { size: 45, type: WidthType.PERCENTAGE }, borders: thinBorders, shading: { type: 'clear', fill: i % 2 === 0 ? ALT_ROW_BG : 'FFFFFF' }, children: [new Paragraph({ children: [textRun(r.label, { size: 20, bold: true, color: '1F2937' })] })] }),
      new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, borders: thinBorders, shading: { type: 'clear', fill: i % 2 === 0 ? ALT_ROW_BG : 'FFFFFF' }, children: [new Paragraph({ children: [textRun(r.val, { size: 20, bold: r.bold, color: r.bold ? DARK : '374151' })] })] })
    ]
  }));

  const sections = [];
  // Header
  sections.push(...buildHeaderParagraphs(data, logoBuffer));
  // Title
  sections.push(buildTitleParagraph('SCHOOL LEAVING CERTIFICATE'));
  // Meta
  sections.push(buildMetaRow('Certificate No', cert.certificateNumber || '', 'Admission No', data.admissionNumber || ''));
  // Spacing
  sections.push(new Paragraph({ spacing: { after: 80 }, children: [] }));
  // Fields table
  sections.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: thinBorders, rows: tableRows }));
  // Note
  sections.push(new Paragraph({ spacing: { before: 120, after: 40 }, shading: { type: 'clear', fill: 'F9FAFB' }, border: { top: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR }, bottom: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR }, left: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR }, right: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR } }, children: [textRun('IMPORTANT NOTE: ', { size: 16, bold: true, color: GRAY }), textRun('This certificate is issued based on school records. No alteration shall be made. Erasing or overwriting renders it invalid.', { size: 16, color: GRAY })] }));
  // Certification
  sections.push(new Paragraph({ spacing: { before: 80, after: 40 }, children: [textRun('Certified that the above information is in accordance with school records. This certificate does not entitle the holder to any benefits unless countersigned by competent authority.', { size: 16, color: GRAY, italics: true })] }));
  sections.push(new Paragraph({ children: [textRun(`Place: ${data.place || ''}`, { size: 18, bold: true, color: DARK })] }));
  // Signatures
  sections.push(buildSignatureSection(signatureBuffer, null));
  // Footer
  sections.push(buildFooter());

  return new Document({ sections: [{ children: sections }] });
}

// ═══ Bonafide Document Builder ═══

function buildBonafideDocument(data, cert, logoBuffer, signatureBuffer) {
  const sections = [];

  // Header
  sections.push(...buildHeaderParagraphs(data, logoBuffer));
  // Title
  sections.push(buildTitleParagraph('BONAFIDE CERTIFICATE'));
  // Meta
  sections.push(buildMetaRow('Certificate No', cert.certificateNumber || '', 'Date of Issue', data.issueDate || ''));
  // To whom
  sections.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200, after: 60 }, children: [textRun('TO WHOM IT MAY CONCERN', { size: 24, bold: true, color: '0A5C56', font: 'Georgia' })] }));
  // Declaration
  sections.push(new Paragraph({ spacing: { after: 120 }, children: [
    textRun('This is to certify that ', { size: 22, color: '374151' }),
    textRun(data.studentName || '', { size: 22, bold: true, color: DARK }),
    textRun(', Son/Daughter of Shri ', { size: 22, color: '374151' }),
    textRun(data.fatherName || '', { size: 22, bold: true, color: DARK }),
    textRun(' and Smt. ', { size: 22, color: '374151' }),
    textRun(data.motherName || '', { size: 22, bold: true, color: DARK }),
    textRun(', is a bonafide student of this institution. He/She is currently studying in Class ', { size: 22, color: '374151' }),
    textRun(`${data.class || ''} (${data.section || ''})`, { size: 22, bold: true, color: DARK }),
    textRun(' for the Academic Session ', { size: 22, color: '374151' }),
    textRun(data.academicYear || '', { size: 22, bold: true, color: DARK }),
    textRun('. His/Her date of birth as per our school records is ', { size: 22, color: '374151' }),
    textRun(data.dob || '', { size: 22, bold: true, color: DARK }),
    textRun('.', { size: 22, color: '374151' })
  ] }));
  // Details grid
  const detailRows = [
    ['Student Name', data.studentName || '', 'Admission Number', data.admissionNumber || ''],
    ['Father\'s Name', data.fatherName || '', 'Mother\'s Name', data.motherName || ''],
    ['Class & Section', `${data.class || ''} - ${data.section || ''}`, 'Date of Birth', data.dob || ''],
    ['Academic Session', data.academicYear || '', 'Board / Affiliation', data.schoolBoard || '']
  ];
  sections.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: thinBorders,
    rows: detailRows.map(row => new TableRow({
      children: [
        new TableCell({ width: { size: 25, type: WidthType.PERCENTAGE }, borders: thinBorders, shading: { type: 'clear', fill: ALT_ROW_BG }, children: [new Paragraph({ spacing: { before: 20 }, children: [textRun(row[0], { size: 14, bold: true, color: '6B7280' })] }), new Paragraph({ children: [textRun(row[1], { size: 20, bold: true, color: DARK })] })] }),
        new TableCell({ width: { size: 25, type: WidthType.PERCENTAGE }, borders: thinBorders, shading: { type: 'clear', fill: ALT_ROW_BG }, children: [new Paragraph({ spacing: { before: 20 }, children: [textRun(row[2], { size: 14, bold: true, color: '6B7280' })] }), new Paragraph({ children: [textRun(row[3], { size: 20, bold: true, color: DARK })] })] })
      ]
    }))
  }));
  // Purpose
  sections.push(new Paragraph({ spacing: { before: 120, after: 80 }, children: [
    textRun('This certificate is issued on the request of the student/parent for the purpose of ', { size: 20, color: GRAY }),
    textRun(data.purpose || 'general purpose', { size: 20, bold: true, color: DARK }),
    textRun('. No fees are due from the student at the time of issue of this certificate.', { size: 20, color: GRAY })
  ] }));
  if (data.remarks) {
    sections.push(new Paragraph({ children: [textRun('Remarks: ', { size: 20, bold: true }), textRun(data.remarks, { size: 20 })] }));
  }
  // Place
  sections.push(new Paragraph({ children: [textRun(`Place: ${data.place || ''}`, { size: 18, bold: true, color: DARK })] }));
  // Signatures
  sections.push(buildSignatureSection(signatureBuffer, null));
  // Footer
  sections.push(buildFooter());

  return new Document({ sections: [{ children: sections }] });
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
