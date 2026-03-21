const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// ── Singleton browser instance ──
let browserInstance = null;

async function getBrowser() {
    if (!browserInstance || !browserInstance.isConnected()) {
        browserInstance = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--font-render-hinting=none',
                '--no-first-run',
                '--no-zygote',
                '--single-process'
            ]
        });
    }
    return browserInstance;
}

/**
 * Gracefully close the shared browser (call on server shutdown)
 */
async function closeBrowser() {
    if (browserInstance) {
        try { await browserInstance.close(); } catch (e) { /* ignore */ }
        browserInstance = null;
    }
}

// ── Template helpers ──

function getTemplatePath(type) {
    if (type === 'REPORT_CARD') {
        return path.join(__dirname, '..', 'templates', 'report-cards', 'report-card.html');
    }
    const filename = type === 'TC' ? 'leaving-certificate.html' : 'bonafide-certificate.html';
    return path.join(__dirname, '..', 'templates', 'certificates', filename);
}

/**
 * Build the mapping from controller camelCase fields → template {{snake_case}} placeholders
 */
function buildPlaceholderMap(data) {
    return {
        school_name: data.schoolName || '',
        school_address: data.schoolAddress || '',
        school_phone: data.schoolPhone || '',
        school_email: data.schoolEmail || '',
        affiliation_no: data.affiliationNumber || '',
        school_code: data.schoolCode || '',
        udise_no: data.udiseCode || '',
        school_board: data.schoolBoard || '',
        student_name: data.studentName || '',
        father_name: data.fatherName || '',
        mother_name: data.motherName || '',
        dob: data.dob || '',
        dob_in_words: data.dobWords || data.dob || '',
        admission_no: data.admissionNumber || '',
        class: data.class || '',
        section: data.section || '',
        academic_year: data.academicYear || '',
        certificate_number: data.certificateNumber || '',
        issue_date: data.issueDate || '',
        place: data.place || '',
        nationality: data.nationality || 'Indian',
        category: data.category || 'General',
        admission_date: data.admissionDate || '',
        class_last_studied: data.class || '',
        board_exam_result: data.boardResult || '',
        promotion_status: data.promotionStatus || '',
        subjects: data.subjects || '',
        fee_status: data.feeStatus || '',
        conduct: data.conduct || 'Good',
        application_date: data.applicationDate || '',
        reason_for_leaving: data.leavingReason || '',
        remarks: data.remarks || '-',
        purpose: data.purpose || 'general purpose',
        sr_number: data.srNumber || data.admissionNumber || '-',
    };
}

/**
 * Replace all {{key}} placeholders in the HTML string
 */
function fillTemplate(html, placeholderMap) {
    let result = html;
    for (const [key, value] of Object.entries(placeholderMap)) {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        // Escape HTML special chars in values to prevent XSS
        const safeValue = String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
        result = result.replace(regex, safeValue);
    }
    return result;
}

/**
 * Fetch an image (URL or local path) and return as base64 data URI
 */
async function fetchImageAsDataUri(imagePath) {
    if (!imagePath) return null;
    try {
        let imageBuffer;
        if (imagePath.startsWith('http')) {
            const response = await axios.get(imagePath, { responseType: 'arraybuffer', timeout: 5000 });
            imageBuffer = Buffer.from(response.data);
        } else {
            let localPath = imagePath;
            if (localPath.startsWith('/')) localPath = path.join(process.cwd(), localPath);
            if (!fs.existsSync(localPath)) {
                localPath = path.resolve(process.cwd(), imagePath);
            }
            if (!fs.existsSync(localPath)) {
                localPath = path.join(process.cwd(), 'uploads', path.basename(imagePath));
            }
            if (!fs.existsSync(localPath)) {
                console.warn(`Image file not found at: ${imagePath}`);
                return null;
            }
            imageBuffer = fs.readFileSync(localPath);
        }

        const ext = path.extname(imagePath).toLowerCase();
        let mimeType = 'image/png';
        if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
        else if (ext === '.svg') mimeType = 'image/svg+xml';
        else if (ext === '.webp') mimeType = 'image/webp';

        const base64 = imageBuffer.toString('base64');
        return `data:${mimeType};base64,${base64}`;
    } catch (err) {
        console.warn(`Failed to load image from ${imagePath}:`, err.message);
        return null;
    }
}

/**
 * Inject school logo into the template HTML
 * Replaces <!-- LOGO_PLACEHOLDER --> with an <img> tag or fallback SVG
 */
async function injectLogo(html, logoPath) {
    const fallbackSvg = '<svg width="50" height="50" viewBox="0 0 50 50" fill="none"><circle cx="25" cy="25" r="20" stroke="rgba(255,255,255,0.5)" stroke-width="1.5"/><text x="25" y="30" text-anchor="middle" fill="rgba(255,255,255,0.7)" font-size="10" font-family="Playfair Display,serif">LOGO</text></svg>';

    if (!logoPath) {
        return html.replace('<!-- LOGO_PLACEHOLDER -->', fallbackSvg);
    }

    const dataUri = await fetchImageAsDataUri(logoPath);
    if (dataUri) {
        return html.replace('<!-- LOGO_PLACEHOLDER -->', `<img src="${dataUri}" alt="School Logo" />`);
    }

    return html.replace('<!-- LOGO_PLACEHOLDER -->', fallbackSvg);
}

/**
 * Inject principal signature into the template HTML
 * Replaces <!-- PRINCIPAL_SIGNATURE_PLACEHOLDER --> with an <img> or empty string
 */
async function injectPrincipalSignature(html, signaturePath) {
    if (!signaturePath) {
        return html.replace('<!-- PRINCIPAL_SIGNATURE_PLACEHOLDER -->', '');
    }

    const dataUri = await fetchImageAsDataUri(signaturePath);
    if (dataUri) {
        return html.replace('<!-- PRINCIPAL_SIGNATURE_PLACEHOLDER -->', `<img class="sig-img" src="${dataUri}" alt="Principal Signature" />`);
    }

    return html.replace('<!-- PRINCIPAL_SIGNATURE_PLACEHOLDER -->', '');
}

// ── Report Card helpers ──

function getGradeClass(grade) {
    const g = (grade || '').toUpperCase();
    if (g === 'A+' || g === 'A') return 'excellent';
    if (g === 'B+' || g === 'B') return 'good';
    if (g === 'C+' || g === 'C') return 'average';
    return 'poor';
}

function buildSubjectRow(subject) {
    const gradeClass = getGradeClass(subject.grade);
    const resultClass = subject.isPassed ? 'pass-text' : 'fail-text';
    const resultText = subject.isPassed ? 'Pass' : 'Fail';
    const examDate = subject.date
        ? new Date(subject.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        : '';
    const examDetail = [subject.examName, examDate].filter(Boolean).join(' \u00B7 ');
    const remarks = subject.remarks || '\u2014';

    return `<tr>
        <td class="subject-name">${escapeHtml(subject.subject || subject.name || '')}<span class="exam-detail">${escapeHtml(examDetail)}</span></td>
        <td class="num">${subject.totalMarks}</td>
        <td class="num" style="font-weight:600">${subject.marksObtained}</td>
        <td class="num">${subject.percentage}%</td>
        <td class="center"><span class="grade-display"><span class="grade-dot ${gradeClass}"></span> ${escapeHtml(subject.grade)}</span></td>
        <td class="center"><span class="${resultClass}">${resultText}</span></td>
        <td style="font-size:9px; color: var(--rc-text-muted)">${escapeHtml(remarks)}</td>
    </tr>`;
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function buildReportCardPlaceholders(data) {
    const { school, student, exam, subjects, summary, attendance } = data;
    const brandColor = school.brand_color || school.brandColor || '#1E3A5F';

    // Build address line
    const addressParts = [school.address, school.phone ? `Phone: ${school.phone}` : '', school.email].filter(Boolean);
    const addressLine = addressParts.join(' \u00B7 ');

    // Build meta line (board, affiliation, UDISE)
    const metaParts = [school.board, school.affiliation ? `Affil: ${school.affiliation}` : '', school.udise ? `UDISE: ${school.udise}` : ''].filter(Boolean);
    const metaLine = metaParts.join(' \u00B7 ');

    // Build subject rows HTML
    const subjectRowsHtml = (subjects || []).map(s => buildSubjectRow(s)).join('\n');

    // Format date
    const dateIssued = exam.date_issued
        ? new Date(exam.date_issued).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
        : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

    // Format DOB
    const dob = student.dob
        ? new Date(student.dob).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
        : '\u2014';

    const overallResult = summary.overall_result === 'PASS' || summary.overallPassed ? 'PASS' : 'FAIL';
    const isPassed = overallResult === 'PASS';
    const overallGrade = summary.overall_grade || summary.overallGrade || '\u2014';

    return {
        brand_color: brandColor,
        brand_color_light: `${brandColor}0A`,
        school_name: school.name || '',
        school_address: addressLine,
        school_meta: metaLine,
        exam_type: exam.type || exam.examSeries || 'Mid Term',
        academic_year: exam.academic_year || exam.academicYear || '',
        date_issued: dateIssued,
        student_name: student.name || student.fullName || '',
        adm_number: student.adm_number || student.admissionNumber || '\u2014',
        class_section: student.class_section || `${student.class || ''}${student.section ? ' \u2014 ' + student.section : ''}`,
        roll_number: student.roll_number || student.rollNumber || '\u2014',
        dob: dob,
        parent_name: student.parent_name || student.guardianName || student.fatherOrHusbandName || '\u2014',
        subject_rows: subjectRowsHtml,
        grand_total_max: summary.total_max || summary.grandTotal || 0,
        grand_total_obtained: summary.total_obtained || summary.grandObtained || 0,
        overall_percentage: summary.overall_percentage || summary.overallPercentage || 0,
        overall_grade: overallGrade,
        overall_grade_class: getGradeClass(overallGrade),
        overall_result: overallResult,
        overall_result_color: isPassed ? 'pass' : 'fail',
        result_banner_class: isPassed ? 'pass' : 'fail',
        result_text: isPassed ? 'PASSED' : 'FAILED',
        performance_tag: summary.performance_tag || summary.performanceTag || (isPassed ? 'Satisfactory Performance' : 'Needs Improvement'),
        result_stats: `${summary.subjects_passed || summary.passCount || 0} of ${summary.total_subjects || summary.totalSubjects || 0} subjects passed \u00B7 Overall: ${summary.overall_percentage || summary.overallPercentage || 0}% \u00B7 Grade: ${overallGrade}`,
    };
}

async function injectReportCardLogo(html, logoPath, brandColor) {
    const initial = brandColor ? `style="background:${brandColor}"` : '';
    const fallback = `<div class="school-logo-fallback" ${initial}>S</div>`;

    if (!logoPath) {
        return html.replace('<!-- LOGO_PLACEHOLDER -->', fallback);
    }

    const dataUri = await fetchImageAsDataUri(logoPath);
    if (dataUri) {
        return html.replace('<!-- LOGO_PLACEHOLDER -->', `<div class="school-logo"><img src="${dataUri}" alt="School Logo" /></div>`);
    }

    return html.replace('<!-- LOGO_PLACEHOLDER -->', fallback);
}

function injectAttendanceSection(html, attendance) {
    if (!attendance || !attendance.working_days) {
        return html.replace('<!-- ATTENDANCE_SECTION -->', '');
    }

    const section = `
    <div class="attendance-section">
        <div class="section-label">Attendance</div>
        <div class="attendance-row">
            <div class="att-card">
                <div class="att-value">${attendance.working_days || 0}</div>
                <div class="att-label">Working Days</div>
            </div>
            <div class="att-card">
                <div class="att-value">${attendance.days_present || 0}</div>
                <div class="att-label">Days Present</div>
            </div>
            <div class="att-card">
                <div class="att-value">${attendance.percentage || 0}%</div>
                <div class="att-label">Attendance</div>
            </div>
        </div>
    </div>`;

    return html.replace('<!-- ATTENDANCE_SECTION -->', section);
}

function injectRemarksSection(html, remarks) {
    if (!remarks) {
        return html.replace('<!-- REMARKS_SECTION -->', '');
    }

    const section = `
    <div class="remarks-section">
        <div class="section-label">Teacher's Remarks</div>
        <div class="remarks-text">${escapeHtml(remarks)}</div>
    </div>`;

    return html.replace('<!-- REMARKS_SECTION -->', section);
}

async function injectSignature(html, placeholder, signaturePath) {
    if (!signaturePath) {
        return html.replace(placeholder, '');
    }

    const dataUri = await fetchImageAsDataUri(signaturePath);
    if (dataUri) {
        return html.replace(placeholder, `<img class="sig-img" src="${dataUri}" alt="Signature" />`);
    }

    return html.replace(placeholder, '');
}

/**
 * Service to generate PDF certificates using Puppeteer
 */
const pdfService = {
    /**
     * Generate a PDF certificate buffer
     * @param {Object} data - Certificate data (camelCase fields from controller)
     * @param {Object} template - Template configuration ({ type: 'TC' | 'BONAFIDE' })
     * @returns {Promise<Buffer>} PDF buffer
     */
    generateCertificate: async (data, template) => {
        // 1. Load HTML template
        const templatePath = getTemplatePath(template.type);
        let html = fs.readFileSync(templatePath, 'utf8');

        // 2. Inject images (logo + principal signature) as base64
        html = await injectLogo(html, data.schoolLogo);
        html = await injectPrincipalSignature(html, data.principalSignature);

        // 3. Fill all {{placeholder}} values
        const placeholders = buildPlaceholderMap(data);
        html = fillTemplate(html, placeholders);

        // 4. Render to PDF via Puppeteer
        const browser = await getBrowser();
        const page = await browser.newPage();

        try {
            // Use 'domcontentloaded' — the Google Fonts @import loads async;
            // 'networkidle0' can timeout waiting for external font requests.
            await page.setContent(html, {
                waitUntil: 'domcontentloaded',
                timeout: 30000
            });

            // Small delay to let fonts/CSS settle
            await new Promise(r => setTimeout(r, 500));

            const pdfUint8 = await page.pdf({
                format: 'A4',
                printBackground: true,
                preferCSSPageSize: true,
            });

            // Puppeteer 24.x returns Uint8Array — convert to Node Buffer for Express compat
            return Buffer.from(pdfUint8);
        } finally {
            await page.close();
        }
    },

    /**
     * Generate a report card PDF buffer
     * @param {Object} data - Report card data payload (school, student, exam, subjects, summary, attendance, signatures)
     * @returns {Promise<Buffer>} PDF buffer
     */
    generateReportCard: async (data) => {
        // 1. Load HTML template
        const templatePath = getTemplatePath('REPORT_CARD');
        let html = fs.readFileSync(templatePath, 'utf8');

        // 2. Build and fill placeholders
        const placeholders = buildReportCardPlaceholders(data);

        // Subject rows contain raw HTML — inject before fillTemplate (which escapes HTML)
        html = html.replace('{{subject_rows}}', placeholders.subject_rows);
        delete placeholders.subject_rows;

        html = fillTemplate(html, placeholders);

        // 3. Inject images
        const brandColor = data.school?.brand_color || data.school?.brandColor || '#1E3A5F';
        html = await injectReportCardLogo(html, data.school?.logo_url || data.school?.logo, brandColor);
        html = await injectSignature(html, '<!-- PRINCIPAL_SIGNATURE_PLACEHOLDER -->', data.signatures?.principal);
        html = await injectSignature(html, '<!-- CLASS_TEACHER_SIGNATURE_PLACEHOLDER -->', data.signatures?.class_teacher);

        // 4. Inject conditional sections
        html = injectAttendanceSection(html, data.attendance);
        html = injectRemarksSection(html, data.summary?.teacher_remarks || data.summary?.teacherRemarks);

        // 5. Render to PDF via Puppeteer
        const browser = await getBrowser();
        const page = await browser.newPage();

        try {
            await page.setContent(html, {
                waitUntil: 'domcontentloaded',
                timeout: 30000
            });

            await new Promise(r => setTimeout(r, 500));

            const pdfUint8 = await page.pdf({
                format: 'A4',
                printBackground: true,
                preferCSSPageSize: true,
                margin: { top: 0, right: 0, bottom: 0, left: 0 },
            });

            return Buffer.from(pdfUint8);
        } finally {
            await page.close();
        }
    },

    closeBrowser,
};

module.exports = pdfService;
