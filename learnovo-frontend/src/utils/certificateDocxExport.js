import PizZip from 'pizzip';
import { saveAs } from 'file-saver';

const val = (v) => (v && v !== '-' && v !== '—' ? String(v) : '—');

/**
 * Build placeholder map for TC certificates
 */
function buildTCPlaceholders(data) {
    return {
        school_name: val(data.schoolName),
        school_address: val(data.schoolAddress),
        school_phone: val(data.schoolPhone),
        school_email: val(data.schoolEmail),
        affiliation_no: val(data.affiliationNumber),
        school_code: val(data.schoolCode),
        udise_no: val(data.udiseCode),
        certificate_number: val(data.certificateNumber),
        admission_no: val(data.admissionNumber),
        student_name: val(data.studentName),
        father_name: val(data.fatherName),
        mother_name: val(data.motherName),
        nationality: val(data.nationality),
        category: val(data.categoryOverride || data.category),
        dob: val(data.dob),
        pen_number: val(data.penNumber),
        apaar_id: val(data.apaarId),
        admission_date: val(data.admissionDate),
        class_last_studied: val(data.classOverride || data.class),
        board_exam_result: val(data.boardResult),
        promotion_status: val(data.promotionStatus),
        subjects: val(data.subjects),
        fee_status: val(data.feeStatus),
        conduct: val(data.conduct),
        application_date: val(data.applicationDate),
        issue_date: val(data.issueDate),
        reason_for_leaving: val(data.leavingReason),
        remarks: val(data.remarks),
        place: val(data.place),
    };
}

/**
 * Build placeholder map for Bonafide certificates
 */
function buildBonafidePlaceholders(data) {
    return {
        school_name: val(data.schoolName),
        school_address: val(data.schoolAddress),
        school_phone: val(data.schoolPhone),
        school_email: val(data.schoolEmail),
        affiliation_no: val(data.affiliationNumber),
        school_code: val(data.schoolCode),
        udise_no: val(data.udiseCode),
        certificate_number: val(data.certificateNumber),
        issue_date: val(data.issueDate),
        student_name: val(data.studentName),
        father_name: val(data.fatherName),
        mother_name: val(data.motherName),
        admission_no: val(data.admissionNumber),
        dob: val(data.dob),
        class: val(data.class),
        section: val(data.section),
        academic_year: val(data.academicYear),
        category: val(data.category),
        school_board: val(data.schoolBoard),
        purpose: val(data.purpose),
        place: val(data.place),
    };
}

/**
 * Escape XML special characters
 */
function escapeXml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/**
 * Clean XML text: merge split template tags that Word broke
 * across multiple <w:r> runs.
 * e.g., <w:t>{</w:t></w:r><w:r>...<w:t>{student_name}}</w:t>
 * becomes a single run with <w:t>{{student_name}}</w:t>
 */
function cleanTemplateXml(xml) {
    // Step 1: Remove XML formatting between split braces
    // Match a lone { at end of a <w:t> tag, followed by XML runs, then { at start of next <w:t>
    // This handles: {</w:t></w:r><w:r><w:rPr>...</w:rPr><w:t> {variable}}
    xml = xml.replace(
        /\{(<\/w:t><\/w:r><w:r[^>]*>(?:<w:rPr>.*?<\/w:rPr>)?<w:t[^>]*>)\s*\{/gs,
        '{{' + '$1'.replace(/.*/, '') // remove the XML between
    );

    // Step 2: Simpler fix — just clean the text content
    // Extract all text, fix delimiters, put back
    // Actually, let's do direct replacement on the raw XML string
    // Fix "{ {" pattern (with possible XML tags in between)
    xml = xml.replace(
        /\{(<\/w:t><\/w:r><w:r[^>]*>(?:<w:rPr>[^<]*(?:<[^>]+>[^<]*)*<\/w:rPr>)?<w:t[^>]*>)\s?\{/gs,
        '{{',
    );

    // Fix any remaining "{ {" in plain text
    xml = xml.replace(/\{\s+\{/g, '{{');
    xml = xml.replace(/\}\s+\}/g, '}}');

    return xml;
}

/**
 * Replace all {{placeholder}} tags in XML with actual values
 */
function fillPlaceholders(xml, placeholders) {
    // First clean any split tags
    xml = cleanTemplateXml(xml);

    // Then replace all {{key}} with values
    for (const [key, value] of Object.entries(placeholders)) {
        const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
        xml = xml.replace(regex, escapeXml(value));
    }

    return xml;
}

/**
 * Fetch the DOCX template file from public folder
 */
async function fetchTemplate(type) {
    const filename = type === 'TC' ? 'tc-template.docx' : 'bonafide-template.docx';
    const response = await fetch(`/templates/${filename}`);
    if (!response.ok) {
        throw new Error(`Failed to load ${filename} template`);
    }
    return await response.arrayBuffer();
}

/**
 * Generate and download a certificate DOCX using the template
 */
export async function generateCertificateDocx(type, data) {
    const normalizedType = type.toUpperCase();

    // 1. Fetch the DOCX template
    const templateBuffer = await fetchTemplate(normalizedType);

    // 2. Load into PizZip
    const zip = new PizZip(templateBuffer);

    // 3. Build placeholder values
    const placeholders = normalizedType === 'TC'
        ? buildTCPlaceholders(data)
        : buildBonafidePlaceholders(data);

    // 4. Process all XML files in the DOCX
    const xmlFiles = ['word/document.xml', 'word/header1.xml', 'word/header2.xml', 'word/footer1.xml', 'word/footer2.xml'];

    for (const fileName of xmlFiles) {
        const file = zip.file(fileName);
        if (file) {
            let xml = file.asText();
            xml = fillPlaceholders(xml, placeholders);
            zip.file(fileName, xml);
        }
    }

    // 5. Generate the output DOCX
    const outputBlob = zip.generate({
        type: 'blob',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    // 6. Download
    const studentName = (data.studentName || 'Student').replace(/[^a-zA-Z0-9]/g, '_');
    const admNo = (data.admissionNumber || '').replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `${normalizedType}_${studentName}_${admNo}.docx`;
    saveAs(outputBlob, filename);
}
