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

/* ── Color palette (green theme) ─────────────────────────────── */
const C = {
  black: '#0f172a',
  text: '#111827',
  textDark: '#374151',
  label: '#6b7280',
  muted: '#9ca3af',
  border: '#e5e7eb',
  borderLight: '#f3f4f6',
  green: '#16a34a',
  greenDark: '#15803d',
  greenBg: '#f0fdf4',
  greenBorder: '#86efac',
  blue: '#2563eb',
  amber: '#b45309',
  amberBg: '#fffbeb',
  amberBorder: '#fde68a',
  white: '#ffffff',
  logoBg: '#dcfce7'
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
  const invoiceItems = payment.invoiceId?.items || [];
  const schoolName = (schoolData.schoolName || 'School').toUpperCase();
  const initials = schoolName.split(' ').filter(w => w.length > 1).map(w => w[0]).join('').slice(0, 2);
  const billingPeriod = payment.invoiceId?.billingPeriod?.displayText || payment.invoiceId?.periodLabel || '';
  const initiatedByLabel = payment.initiatedBy === 'admin' ? 'Admin' : 'Student';
  const invoiceBalance = payment.invoiceId?.balanceAmount ?? 0;
  const invoiceStatus = payment.invoiceId?.status || 'Paid';
  const isPartial = invoiceBalance > 0 && invoiceStatus !== 'Paid';

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

  let Y = 40;

  // ═══ HEADER — Logo + School Info ═══
  const logoSize = 48;
  const logoX = L;
  const logoY = Y;

  if (logoBuffer) {
    try {
      roundRect(logoX, logoY, logoSize, logoSize, 8, C.logoBg);
      doc.image(logoBuffer, logoX + 4, logoY + 4, { width: logoSize - 8, height: logoSize - 8, fit: [logoSize - 8, logoSize - 8] });
    } catch (_) {
      roundRect(logoX, logoY, logoSize, logoSize, 8, C.logoBg);
      doc.fontSize(18).font('Helvetica-Bold').fillColor(C.greenDark)
        .text(initials, logoX, logoY + 14, { width: logoSize, align: 'center' });
    }
  } else {
    roundRect(logoX, logoY, logoSize, logoSize, 8, C.logoBg);
    doc.fontSize(18).font('Helvetica-Bold').fillColor(C.greenDark)
      .text(initials, logoX, logoY + 14, { width: logoSize, align: 'center' });
  }

  const infoX = logoX + logoSize + 14;
  doc.fontSize(15).font('Helvetica-Bold').fillColor(C.black)
    .text(schoolName, infoX, Y, { width: R - infoX });

  Y = doc.y + 2;
  const address = schoolData.fullAddress || schoolData.address?.city || '';
  doc.fontSize(7.5).font('Helvetica').fillColor(C.label);
  if (address) { doc.text(address, infoX, Y, { width: R - infoX }); Y = doc.y; }
  doc.text(`${schoolData.phone || '-'}  ·  ${schoolData.email || '-'}`, infoX, Y, { width: R - infoX });
  Y = doc.y;
  doc.text(`School Code: ${schoolData.schoolCode || '-'}  ·  UDISE: ${schoolData.udiseCode || '-'}`, infoX, Y, { width: R - infoX });

  Y = Math.max(doc.y, logoY + logoSize) + 12;
  line(L, Y, R, C.green, 1);
  Y += 14;

  // ═══ RECEIPT BADGE BAR ═══
  const badgeH = 26;
  roundRect(L, Y, W, badgeH, 4, C.greenBg);
  roundRect(L, Y, 3.5, badgeH, 2, C.green);

  doc.fontSize(10).font('Helvetica-Bold').fillColor(C.greenDark)
    .text('PAYMENT RECEIPT', L + 14, Y + 7);
  doc.fontSize(8.5).font('Helvetica').fillColor('#475569')
    .text(`#${payment.receiptNumber || ''}`, L + 14, Y + 8, { align: 'right', width: W - 28 });

  Y += badgeH + 16;

  // ═══ TWO-COLUMN INFO GRID ═══
  const colGap = 30;
  const colW = (W - colGap) / 2;
  const col1X = L;
  const col2X = L + colW + colGap;
  const labelW = 65;

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

  drawRow(col1X, Y, 'Name', studentName);
  drawRow(col1X, Y + 16, 'Adm. No.', admNo);
  drawRow(col1X, Y + 32, 'Class', `${cls}${sec}`);
  const studentEndY = Y + 48;

  const payDate = payment.paymentDate
    ? new Date(payment.paymentDate).toLocaleDateString('en-IN')
    : '-';

  let pY = Y;
  drawRow(col2X, pY, 'Date', payDate); pY += 16;
  drawRow(col2X, pY, 'Mode', payment.paymentMethod || '-'); pY += 16;
  if (billingPeriod) { drawRow(col2X, pY, 'Period', billingPeriod, C.blue); pY += 16; }
  drawRow(col2X, pY, 'Initiated By', initiatedByLabel); pY += 16;
  drawRow(col2X, pY, 'Status', isPartial ? 'Partial' : 'Paid', C.green); pY += 16;

  Y = Math.max(studentEndY, pY) + 8;

  // ═══ FEE BREAKDOWN TABLE ═══
  if (invoiceItems.length > 0) {
    doc.fontSize(7).font('Helvetica-Bold').fillColor(C.label);
    doc.text('DESCRIPTION', L, Y);
    doc.text('AMOUNT (\u20B9)', L, Y, { width: W, align: 'right' });
    Y += 10;
    line(L, Y, R, C.border, 0.75);
    Y += 8;

    for (const item of invoiceItems) {
      doc.fontSize(8.5).font('Helvetica').fillColor(C.textDark)
        .text(item.feeHeadName, L, Y, { width: W - 100 });
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor(C.text)
        .text((item.netAmount || item.periodAmount || item.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }), L, Y, { width: W, align: 'right' });
      Y += 14;
      line(L, Y, R, C.borderLight);
      Y += 4;
    }
    Y += 6;
  }

  // ═══ TOTAL AMOUNT BOX (Green) ═══
  const amtBoxH = 48;
  roundRect(L, Y, W, amtBoxH, 6, C.greenBg, C.greenBorder);

  doc.fontSize(8).font('Helvetica-Bold').fillColor(C.greenDark)
    .text('TOTAL AMOUNT PAID', L + 16, Y + 10);

  const amtStr = `Rs. ${(payment.amount || 0).toLocaleString('en-IN')}`;
  doc.fontSize(24).font('Helvetica-Bold').fillColor(C.green)
    .text(amtStr, L + 16, Y + 10, { width: W - 32, align: 'right' });

  Y += amtBoxH + 10;

  // ═══ REMAINING BALANCE (partial payments) ═══
  if (isPartial) {
    const balBoxH = 32;
    roundRect(L, Y, W, balBoxH, 6, C.amberBg, C.amberBorder);

    const balLabel = `REMAINING BALANCE${billingPeriod ? ` (${billingPeriod})` : ''}`;
    doc.fontSize(7).font('Helvetica-Bold').fillColor(C.amber)
      .text(balLabel, L + 16, Y + 10);

    doc.fontSize(16).font('Helvetica-Bold').fillColor(C.amber)
      .text(`\u20B9 ${invoiceBalance.toLocaleString('en-IN')}`, L + 16, Y + 8, { width: W - 32, align: 'right' });

    Y += balBoxH + 10;
  } else {
    Y += 20;
  }

  // ═══ SIGNATURES ═══
  const sigLineW = 140;
  const sig1X = L + 10;
  const sig2X = R - sigLineW - 10;

  if (signatureBuffer) {
    try { doc.image(signatureBuffer, sig2X + 10, Y - 6, { width: 120, height: 42, fit: [120, 42] }); } catch (_) { /* skip */ }
  }

  const sigLineY = Y + 40;
  doc.save().moveTo(sig1X, sigLineY).lineTo(sig1X + sigLineW, sigLineY)
    .lineWidth(0.75).strokeColor('#d1d5db').stroke().restore();
  doc.save().moveTo(sig2X, sigLineY).lineTo(sig2X + sigLineW, sigLineY)
    .lineWidth(0.75).strokeColor('#d1d5db').stroke().restore();

  doc.fontSize(7.5).font('Helvetica').fillColor(C.label);
  doc.text('Depositor', sig1X, sigLineY + 5, { width: sigLineW, align: 'center' });
  doc.text('Principal', sig2X, sigLineY + 5, { width: sigLineW, align: 'center' });

  Y = sigLineY + 28;

  // ═══ FOOTER ═══
  line(L, Y, R);
  doc.fontSize(6.5).font('Helvetica').fillColor(C.muted)
    .text('Computer-generated receipt. Valid without physical signature.  ·  Powered by Learnovo',
      L, Y + 6, { align: 'center', width: W });
}

module.exports = { generateReceiptPdf };
