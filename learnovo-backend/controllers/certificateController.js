const CertificateTemplate = require('../models/CertificateTemplate');
const GeneratedCertificate = require('../models/GeneratedCertificate');
const User = require('../models/User');
const Settings = require('../models/Settings');
const Fee = require('../models/Fee');
const Counter = require('../models/Counter');
const pdfService = require('../services/pdfService');
const { format } = require('date-fns');

// Helper to convert date to words (simplified)
const dateToWords = (dateStr) => {
    // Ideally use a library like 'date-fns' or 'moment' + custom logic or 'number-to-words'
    return dateStr; // Placeholder
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
        const dob = student.dateOfBirth ? format(new Date(student.dateOfBirth), 'dd/MM/yyyy') : '';
        const dobWords = student.dateOfBirth ? dateToWords(format(new Date(student.dateOfBirth), 'dd MMMM yyyy')) : '';
        const today = format(new Date(), 'dd/MM/yyyy');

        // Get guardian names and strip existing honorifics (PDF service will add them)
        const father = student.guardians?.find(g => g.relation === 'Father');
        const mother = student.guardians?.find(g => g.relation === 'Mother');
        const fatherName = stripHonorific(student.fatherOrHusbandName || father?.name || '-');
        const motherName = stripHonorific(mother?.name || '-');

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
            schoolAddress: `${settings.institution.address.street}, ${settings.institution.address.city}`,
            affiliationNumber: settings.institution.affiliationNumber || 'AFF-XXXX',
            schoolBoard: settings.institution.board || 'CBSE',
            udiseCode: settings.institution.udiseCode || '-',
            schoolCode: settings.institution.schoolCode || settings.tenantId.schoolCode || 'SCH-001',
            schoolLogo: settings.institution.logo,
            principalSignature: settings.institution.principalSignature,
            schoolPhone: settings.institution.contact?.phone || '',
            schoolEmail: settings.institution.contact?.email || '',
            place: settings.institution.address.city,
            issueDate: today,
            applicationDate: today, // Default to today

            // TC Specifics placeholders
            admissionDate: student.admissionDate ? format(new Date(student.admissionDate), 'dd/MM/yyyy') : '-',
            boardResult: 'Passed', // TODO: Fetch from Exam Result model
            promotionStatus: 'Yes',
            subjects: 'English, Hindi, Maths, Science, Social Science', // TODO: Fetch
            feeStatus: 'Paid up to date',
            conduct: 'Good',
            leavingReason: 'Parent Request', // Allow override from frontend
            remarks: ''
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
        const { studentId, type, specificData } = req.body; // specificData allows overriding fields like 'leavingReason'
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
            schoolAddress: `${settings.institution.address.street}, ${settings.institution.address.city}`,
            schoolCode: settings.institution.schoolCode || settings.tenantId.schoolCode || 'SCH-001',
            schoolLogo: settings.institution.logo,
            principalSignature: settings.institution.principalSignature,
            schoolBoard: settings.institution.board || 'CBSE',
            udiseCode: settings.institution.udiseCode || '-',
            affiliationNumber: settings.institution.affiliationNumber || 'AFF-XXXX',
            schoolPhone: settings.institution.contact?.phone || '',
            schoolEmail: settings.institution.contact?.email || '',
        };

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

        // 5. Get Template
        const template = await CertificateTemplate.findOne({ tenantId, type }) || { type };

        // 6. Generate PDF
        const doc = await pdfService.generateCertificate(finalData, template);

        // 7. Stream Response
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${type}_${student.admissionNumber}.pdf`);

        doc.pipe(res);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error generating certificate', error: error.message });
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

        // Generate PDF from stored snapshot
        const doc = await pdfService.generateCertificate(cert.contentSnapshot, template);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${cert.type}_${cert.certificateNumber}.pdf`);

        doc.pipe(res);

    } catch (error) {
        console.error('Download error:', error);
        res.status(500).json({ message: 'Error downloading certificate' });
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
