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
                '--font-render-hinting=none'
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

    closeBrowser,
};

module.exports = pdfService;
