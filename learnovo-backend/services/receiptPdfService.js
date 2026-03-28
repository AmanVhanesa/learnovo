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
    const fullUrl = url.startsWith('http') ? url : `https://api.learnovoportal.com${url}`;
    const response = await axios.get(fullUrl, {
      responseType: 'arraybuffer',
      timeout: 8000,
      maxRedirects: 5
    });
    const buf = Buffer.from(response.data);
    if (buf.length < 100) return null; // Too small to be a real image
    return buf;
  } catch (err) {
    console.warn('[receiptPdfService] Could not fetch image:', url, '—', err.message);
    return null;
  }
}

/**
 * Generate a fee receipt PDF fully buffered in memory.
 */
async function generateReceiptPdf(payment, schoolData) {
  const [logoBuffer, signatureBuffer] = await Promise.all([
    fetchImageBuffer(schoolData.logo),
    fetchImageBuffer(schoolData.principalSignature)
  ]);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });
    const chunks = [];

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', err => reject(err));

    try {
      buildReceiptPdf(doc, payment, schoolData, logoBuffer, signatureBuffer);
      doc.end();
    } catch (buildErr) {
      try {
        doc.destroy();
      } catch (_) { /* ignore */ }
      reject(buildErr);
    }
  });
}

/* ── Color palette (matching HTML template) ─────────────────────────────── */
const C = {
  black: '#0f172a',
  text: '#111827',
  label: '#6b7280',
  muted: '#9ca3af',
  border: '#e5e7eb',
  borderLight: '#f3f4f6',
  blue: '#2563eb',
  blueDark: '#1e40af',
  blueBg: '#f0f5ff',
  blueBorder: '#dbeafe',
  green: '#059669',
  white: '#ffffff',
  logoBg: '#f3f4f6'
};

const L = 40;  // left margin
const R = 555; // right edge
const W = R - L; // usable width

function buildReceiptPdf(doc, payment, schoolData, logoBuffer, signatureBuffer) {
  const student = payment.studentId || {};
  const studentName = student.name || student.fullName || 'N/A';
  const admNo = student.admissionNumber || student.studentId || '-';
  const cls = student.classId?.name || student.class || '-';
  const sec = student.section ? ` (${student.section})` : '';
  const parentName = student.parentName || '';
  const invoiceItems = payment.invoiceId?.items || [];
  const schoolName = (schoolData.schoolName || 'School').toUpperCase();
  const initials = schoolName.split(' ').filter(w => w.length > 1).map(w => w[0]).join('').slice(0, 2);

  // ── Helpers ─────────────────────────────────────────────────────────────
  const line = (x1, y, x2, color = C.border, w = 0.5) => {
    doc.save().moveTo(x1, y).lineTo(x2, y).lineWidth(w).strokeColor(color).stroke().restore();
  };

  const roundRect = (x, y, w, h, r, fill, stroke) => {
    doc.roundedRect(x, y, w, h, r);
    if (fill) doc.fill(fill);
    if (stroke) {
      doc.roundedRect(x, y, w, h, r); doc.lineWidth(0.75).strokeColor(stroke).stroke();
    }
  };

  let Y = 40; // current Y cursor

  // ═══════════════════════════════════════════════════════════════════════
  // HEADER — Logo + School Info
  // ═══════════════════════════════════════════════════════════════════════

  const logoSize = 48;
  const logoX = L;
  const logoY = Y;

  if (logoBuffer) {
    try {
      // Draw background box for logo
      roundRect(logoX, logoY, logoSize, logoSize, 8, C.logoBg);
      doc.image(logoBuffer, logoX + 4, logoY + 4, { width: logoSize - 8, height: logoSize - 8, fit: [logoSize - 8, logoSize - 8] });
    } catch (_) {
      // If image fails, draw initials fallback
      roundRect(logoX, logoY, logoSize, logoSize, 8, C.logoBg);
      doc.fontSize(18).font('Helvetica-Bold').fillColor(C.label)
        .text(initials, logoX, logoY + 14, { width: logoSize, align: 'center' });
    }
  } else {
    // No logo — draw initials in a rounded box
    roundRect(logoX, logoY, logoSize, logoSize, 8, C.logoBg);
    doc.fontSize(18).font('Helvetica-Bold').fillColor(C.label)
      .text(initials, logoX, logoY + 14, { width: logoSize, align: 'center' });
  }

  const infoX = logoX + logoSize + 14;

  doc.fontSize(15).font('Helvetica-Bold').fillColor(C.black)
    .text(schoolName, infoX, Y, { width: R - infoX });

  Y = doc.y + 2;
  const address = schoolData.fullAddress || schoolData.address?.city || '';
  doc.fontSize(7.5).font('Helvetica').fillColor(C.label);
  if (address) {
    doc.text(address, infoX, Y, { width: R - infoX }); Y = doc.y;
  }
  doc.text(`${schoolData.phone || '-'}  ·  ${schoolData.email || '-'}`, infoX, Y, { width: R - infoX });
  Y = doc.y;
  doc.text(`School Code: ${schoolData.schoolCode || '-'}  ·  UDISE: ${schoolData.udiseCode || '-'}`, infoX, Y, { width: R - infoX });

  Y = Math.max(doc.y, logoY + logoSize) + 12;
  line(L, Y, R);
  Y += 14;

  // ═══════════════════════════════════════════════════════════════════════
  // RECEIPT BADGE BAR
  // ═══════════════════════════════════════════════════════════════════════

  const badgeH = 26;
  roundRect(L, Y, W, badgeH, 4, C.blueBg);
  // Blue left accent bar
  roundRect(L, Y, 3.5, badgeH, 2, C.blue);

  doc.fontSize(10).font('Helvetica-Bold').fillColor(C.blue)
    .text('PAYMENT RECEIPT', L + 14, Y + 7);
  doc.fontSize(8.5).font('Helvetica').fillColor('#475569')
    .text(`#${payment.receiptNumber || ''}`, L + 14, Y + 8, { align: 'right', width: W - 28 });

  Y += badgeH + 16;

  // ═══════════════════════════════════════════════════════════════════════
  // TWO-COLUMN INFO GRID
  // ═══════════════════════════════════════════════════════════════════════

  const colGap = 30;
  const colW = (W - colGap) / 2;
  const col1X = L;
  const col2X = L + colW + colGap;
  const labelW = 65;

  // Column titles
  doc.fontSize(7).font('Helvetica-Bold').fillColor(C.label);
  doc.text('STUDENT', col1X, Y);
  doc.text('PAYMENT', col2X, Y);
  Y += 10;
  line(col1X, Y, col1X + colW, C.border, 0.75);
  line(col2X, Y, col2X + colW, C.border, 0.75);
  Y += 8;

  const drawRow = (colX, y, label, value, valColor = C.text) => {
    doc.fontSize(7.5).font('Helvetica').fillColor(C.label).text(label, colX, y, { width: labelW });
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor(valColor).text(value || '-', colX + labelW, y, { width: colW - labelW });
  };

  // Student column
  const _studentStartY = Y;
  drawRow(col1X, Y, 'Name', studentName);
  drawRow(col1X, Y + 16, 'Adm. No.', admNo);
  drawRow(col1X, Y + 32, 'Class', `${cls}${sec}`);
  let studentEndY = Y + 48;
  if (parentName) {
    drawRow(col1X, Y + 48, 'Parent', parentName);
    studentEndY = Y + 64;
  }

  // Payment column
  const payDate = payment.paymentDate
    ? new Date(payment.paymentDate).toLocaleDateString('en-IN')
    : '-';

  let pY = Y;
  drawRow(col2X, pY, 'Date', payDate);
  pY += 16;
  drawRow(col2X, pY, 'Mode', payment.paymentMethod || '-');
  pY += 16;
  if (payment.transactionDetails?.referenceNumber) {
    drawRow(col2X, pY, 'Ref. No.', payment.transactionDetails.referenceNumber);
    pY += 16;
  }
  if (payment.invoiceId?.billingPeriod?.displayText) {
    drawRow(col2X, pY, 'Period', payment.invoiceId.billingPeriod.displayText, C.blue);
    pY += 16;
  }
  drawRow(col2X, pY, 'Status', 'Paid', C.green);
  pY += 16;

  Y = Math.max(studentEndY, pY) + 8;

  // ═══════════════════════════════════════════════════════════════════════
  // FEE BREAKDOWN TABLE
  // ═══════════════════════════════════════════════════════════════════════

  if (invoiceItems.length > 0) {
    // Table header
    doc.fontSize(7).font('Helvetica-Bold').fillColor(C.label);
    doc.text('DESCRIPTION', L, Y);
    doc.text('AMOUNT', L, Y, { width: W, align: 'right' });
    Y += 10;
    line(L, Y, R, C.border, 0.75);
    Y += 8;

    // Table rows
    for (const item of invoiceItems) {
      doc.fontSize(8.5).font('Helvetica').fillColor('#374151')
        .text(item.feeHeadName, L, Y, { width: W - 100 });
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor(C.text)
        .text((item.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }), L, Y, { width: W, align: 'right' });
      Y += 14;
      line(L, Y, R, C.borderLight);
      Y += 4;
    }
    Y += 6;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // TOTAL AMOUNT BOX
  // ═══════════════════════════════════════════════════════════════════════

  const amtBoxH = 48;
  roundRect(L, Y, W, amtBoxH, 6, C.blueBg, C.blueBorder);

  doc.fontSize(8).font('Helvetica-Bold').fillColor(C.blue)
    .text('TOTAL AMOUNT PAID', L + 16, Y + 10);

  const amtStr = `Rs. ${(payment.amount || 0).toLocaleString('en-IN')}`;
  doc.fontSize(24).font('Helvetica-Bold').fillColor(C.blueDark)
    .text(amtStr, L + 16, Y + 10, { width: W - 32, align: 'right' });

  Y += amtBoxH + 30;

  // ═══════════════════════════════════════════════════════════════════════
  // SIGNATURES
  // ═══════════════════════════════════════════════════════════════════════

  const sigLineW = 140;
  const sig1X = L + 10;
  const sig2X = R - sigLineW - 10;

  // Authorized signature image (right side)
  if (signatureBuffer) {
    try {
      doc.image(signatureBuffer, sig2X + 10, Y - 6, { width: 120, height: 42, fit: [120, 42] });
    } catch (_) { /* skip */ }
  }

  const sigLineY = Y + 40;
  doc.save().moveTo(sig1X, sigLineY).lineTo(sig1X + sigLineW, sigLineY)
    .lineWidth(0.75).strokeColor('#d1d5db').stroke().restore();
  doc.save().moveTo(sig2X, sigLineY).lineTo(sig2X + sigLineW, sigLineY)
    .lineWidth(0.75).strokeColor('#d1d5db').stroke().restore();

  doc.fontSize(7.5).font('Helvetica').fillColor(C.label);
  doc.text('Depositor', sig1X, sigLineY + 5, { width: sigLineW, align: 'center' });
  doc.text('Authorized Signatory', sig2X, sigLineY + 5, { width: sigLineW, align: 'center' });

  Y = sigLineY + 28;

  // ═══════════════════════════════════════════════════════════════════════
  // FOOTER
  // ═══════════════════════════════════════════════════════════════════════

  line(L, Y, R);
  doc.fontSize(6.5).font('Helvetica').fillColor(C.muted)
    .text('Computer-generated receipt. Valid without physical signature.  ·  Powered by Learnovo',
      L, Y + 6, { align: 'center', width: W });
}

module.exports = { generateReceiptPdf };
