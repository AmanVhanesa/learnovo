const CertificateTemplate = require('../models/CertificateTemplate');
const GeneratedCertificate = require('../models/GeneratedCertificate');
const User = require('../models/User');
const Settings = require('../models/Settings');
const Fee = require('../models/Fee');
const Counter = require('../models/Counter');
const pdfService = require('../services/pdfService');
const { format } = require('date-fns');

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
        if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? '-' + ones[n % 10].toLowerCase() : '');
        if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + numToWords(n % 100) : '');
        if (n < 10000) return ones[Math.floor(n / 1000)] + ' Thousand' + (n % 1000 ? ' ' + numToWords(n % 1000) : '');
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

exports.getTemplates = async (req, res) => {
    try {
        // req.user.tenantId should be populated by auth middleware
        const templates = await CertificateTemplate.find({ tenantId: req.user.tenantId });
        res.json(templates);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching templates', error: error.message });
    }
};

exports.createOrUpdateTemplate = async (req, res) => {
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
exports.previewCertificate = async (req, res) => {
    try {
        const { studentId, type } = req.body;
        const tenantId = req.user.tenantId;

        const student = await User.findOne({ _id: studentId, tenantId });
        if (!student) return res.status(404).json({ message: 'Student not found' });

        const settings = await Settings.getSettings(tenantId);

        // --- Validation for TC ---
        if (type === 'TC') {
            // Check for pending fees
            const pendingFees = await Fee.find({
                student: studentId,
                status: { $in: ['pending', 'overdue', 'partially_paid'] }
            });

            if (pendingFees.length > 0) {
                return res.status(400).json({
                    message: 'Cannot generate Leaving Certificate. Student has pending fees.',
                    details: pendingFees
                });
            }
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
            subjects: 'English, Hindi, Maths, Science, Social Science', // TODO: Fetch
            feeStatus: 'Paid up to date',
            conduct: 'Good',
            leavingReason: 'Parent Request', // Allow override from frontend
            remarks: '',

            // New fields for premium templates
            purpose: 'general purpose', // Bonafide: purpose of certificate
            srNumber: student.srNumber || student.admissionNumber || '-', // LC: SR/GR number
        };

        res.json(data);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error previewing certificate', error: error.message });
    }
};

/**
 * Generate Certificate
 * Creates record, generates number, and returns PDF stream.
 */
exports.generateCertificate = async (req, res) => {
    try {
        const { studentId, type, specificData, autoDeactivate, categoryOverride, classOverride } = req.body; // specificData allows overriding fields like 'leavingReason'
        const tenantId = req.user.tenantId;

        // 1. Re-validate (similar to preview)
        const student = await User.findOne({ _id: studentId, tenantId });
        if (!student) return res.status(404).json({ message: 'Student not found' });

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
            schoolEmail: settings.institution.contact?.email || '',
        };

        // 3.1 Apply ephemeral overrides (TC only) — these do NOT update the student record
        if (type === 'TC') {
            if (categoryOverride !== undefined && categoryOverride !== null) {
                finalData.categoryOverride = categoryOverride;
            }
            if (classOverride !== undefined && classOverride !== null) {
                finalData.classOverride = classOverride;
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

exports.getGeneratedCertificates = async (req, res) => {
    try {
        const certs = await GeneratedCertificate.find({ tenantId: req.user.tenantId })
            .populate('student', 'fullName admissionNumber class')
            .populate('issuedBy', 'fullName')
            .sort({ issueDate: -1 });
        res.json(certs);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching history', error: error.message });
    }
};

exports.downloadCertificate = async (req, res) => {
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

exports.deleteCertificate = async (req, res) => {
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

exports.updateCertificate = async (req, res) => {
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
