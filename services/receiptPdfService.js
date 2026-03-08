'use strict';

const PDFDocument = require('pdfkit');
const axios = require('axios');

/**
 * Fetch an image from a URL and return a Buffer.
 * Returns null on any failure so the PDF still generates without the image.
 */
async function fetchImageBuffer(url) {
    if (!url) return null;
    try {
        const fullUrl = url.startsWith('http') ? url : `https://learnovo-backend.onrender.com${url}`;
        const response = await axios.get(fullUrl, {
            responseType: 'arraybuffer',
            timeout: 6000,
            // Allow redirects from Cloudinary
            maxRedirects: 5
        });
        return Buffer.from(response.data);
    } catch (err) {
        console.warn('[receiptPdfService] Could not fetch image:', url, '—', err.message);
        return null;
    }
}

/**
 * Generate a fee receipt PDF fully buffered in memory.
 *
 * @param {Object} payment   - Mongoose payment document (populated)
 * @param {Object} schoolData - Tenant + settings merged school data
 * @returns {Promise<Buffer>} - Resolves with the complete PDF buffer
 */
async function generateReceiptPdf(payment, schoolData) {
    // Fetch images in parallel before opening the PDFDocument
    const [logoBuffer, signatureBuffer] = await Promise.all([
        fetchImageBuffer(schoolData.logo),
        fetchImageBuffer(schoolData.principalSignature)
    ]);

    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: 'A5', margin: 30, bufferPages: true });
        const chunks = [];

        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', err => reject(err));

        try {
            buildReceiptPdf(doc, payment, schoolData, logoBuffer, signatureBuffer);
            doc.end();
        } catch (buildErr) {
            // Destroy doc to free resources, then reject
            try { doc.destroy(); } catch (_) { /* ignore */ }
            reject(buildErr);
        }
    });
}

/**
 * Synchronously draw all receipt content onto the PDFDocument.
 * All async work (image fetching) is done BEFORE this is called.
 */
function buildReceiptPdf(doc, payment, schoolData, logoBuffer, signatureBuffer) {
    const student = payment.studentId || {};
    const studentName = student.name || student.fullName || 'N/A';
    const admNo = student.admissionNumber || student.studentId || '-';
    const cls = student.classId?.name || student.class || '-';
    const sec = student.section ? ` (${student.section})` : '';

    // ── Header ────────────────────────────────────────────────────────────────
    if (logoBuffer) {
        try { doc.image(logoBuffer, 30, 30, { width: 52, height: 52 }); } catch (_) { /* skip */ }
    }

    doc.fontSize(13).font('Helvetica-Bold').fillColor('#0f172a')
        .text((schoolData.schoolName || 'School').toUpperCase(), 92, 30, { width: 420 });

    doc.fontSize(7).font('Helvetica').fillColor('#475569')
        .text(schoolData.fullAddress || schoolData.address?.city || '', 92)
        .text(`Ph: ${schoolData.phone || '-'}  |  ${schoolData.email || '-'}`, 92)
        .text(`School Code: ${schoolData.schoolCode || '-'}  |  UDISE: ${schoolData.udiseCode || '-'}`, 92);

    doc.moveTo(30, 92).lineTo(545, 92).lineWidth(1).strokeColor('#e2e8f0').stroke();

    // ── Receipt badge ─────────────────────────────────────────────────────────
    doc.rect(30, 99, 515, 22).fill('#eff6ff');
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#2563eb')
        .text('PAYMENT RECEIPT', 38, 105);
    doc.fontSize(8).font('Helvetica').fillColor('#475569')
        .text(`#${payment.receiptNumber || ''}`, 38, 105, { align: 'right', width: 507 });

    // ── Info grid ─────────────────────────────────────────────────────────────
    const gridTop = 132;

    const drawLabel = (x, y, text) =>
        doc.fillColor('#94a3b8').fontSize(7).font('Helvetica-Bold').text(text, x, y);
    const drawDivider = (x1, y, x2) =>
        doc.moveTo(x1, y).lineTo(x2, y).lineWidth(0.5).strokeColor('#e2e8f0').stroke();
    const drawRow = (x, y, label, value) => {
        doc.fillColor('#64748b').fontSize(7).font('Helvetica').text(label, x, y);
        doc.fillColor('#0f172a').fontSize(8).font('Helvetica-Bold').text(value || '-', x + 62, y);
    };

    drawLabel(30, gridTop, 'STUDENT');
    drawLabel(295, gridTop, 'PAYMENT DETAILS');
    drawDivider(30, gridTop + 10, 265);
    drawDivider(295, gridTop + 10, 545);

    const it = gridTop + 16;
    drawRow(30, it, 'Name', studentName);
    drawRow(30, it + 14, 'Adm. No.', admNo);
    drawRow(30, it + 28, 'Class', `${cls}${sec}`);

    const payDate = payment.paymentDate
        ? new Date(payment.paymentDate).toLocaleDateString('en-IN')
        : '-';
    drawRow(295, it, 'Date', payDate);
    drawRow(295, it + 14, 'Mode', payment.paymentMethod || '-');
    drawRow(295, it + 28, 'Status', 'Paid ✔');
    if (payment.transactionDetails?.referenceNumber) {
        drawRow(295, it + 42, 'Ref. No.', payment.transactionDetails.referenceNumber);
    }
    if (payment.invoiceId?.billingPeriod?.displayText) {
        drawRow(295, it + (payment.transactionDetails?.referenceNumber ? 56 : 42),
            'Period', payment.invoiceId.billingPeriod.displayText);
    }

    // ── Amount box ────────────────────────────────────────────────────────────
    const amtTop = gridTop + 82;
    doc.rect(30, amtTop, 515, 50).fill('#eff6ff');
    doc.rect(30, amtTop, 515, 50).lineWidth(1).strokeColor('#bfdbfe').stroke();

    doc.fillColor('#3b82f6').fontSize(8).font('Helvetica-Bold')
        .text('TOTAL AMOUNT PAID', 30, amtTop + 8, { align: 'center', width: 515 });

    const amtStr = `\u20b9${(payment.amount || 0).toLocaleString('en-IN')}`;
    doc.fillColor('#1e40af').fontSize(22).font('Helvetica-Bold')
        .text(amtStr, 30, amtTop + 20, { align: 'center', width: 515 });

    // ── Signatures ────────────────────────────────────────────────────────────
    const sigTop = amtTop + 76;

    // Depositor (left)
    doc.moveTo(40, sigTop + 50).lineTo(175, sigTop + 50).lineWidth(1).strokeColor('#64748b').stroke();
    doc.fillColor('#475569').fontSize(7).font('Helvetica-Bold')
        .text('Depositor', 40, sigTop + 54, { width: 135, align: 'center' });

    // Authorized (right, with signature image)
    if (signatureBuffer) {
        try {
            doc.image(signatureBuffer, 360, sigTop + 2, { width: 120, height: 46, fit: [120, 46] });
        } catch (_) { /* skip on bad image data */ }
    }
    doc.moveTo(355, sigTop + 50).lineTo(520, sigTop + 50).lineWidth(1).strokeColor('#64748b').stroke();
    doc.fillColor('#475569').fontSize(7).font('Helvetica-Bold')
        .text('Authorized Signatory', 355, sigTop + 54, { width: 165, align: 'center' });

    // ── Footer ────────────────────────────────────────────────────────────────
    const footerY = sigTop + 76;
    doc.moveTo(30, footerY).lineTo(545, footerY).lineWidth(0.5).strokeColor('#e2e8f0').stroke();
    doc.fillColor('#94a3b8').fontSize(6).font('Helvetica')
        .text('Computer-generated receipt. Valid without physical signature.  |  Powered by Learnovo',
            30, footerY + 6, { align: 'center', width: 515 });
}

module.exports = { generateReceiptPdf };
