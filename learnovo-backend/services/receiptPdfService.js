'use strict';

const pdfService = require('./pdfService');
const axios = require('axios');

async function toBase64DataUri(url) {
  if (!url) return '';
  try {
    const fullUrl = url.startsWith('http') ? url : `https://api.learnovoportal.com${url}`;
    const response = await axios.get(fullUrl, { responseType: 'arraybuffer', timeout: 8000 });
    const buf = Buffer.from(response.data);
    if (buf.length < 100) return '';
    const mime = response.headers['content-type'] || 'image/png';
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch { return ''; }
}

/**
 * Build receipt HTML — IDENTICAL to frontend buildReceiptHtml in receiptHelpers.js.
 * Any change here must be mirrored there, and vice versa.
 */
function buildReceiptHtml(payment, schoolData, logoDataUri, signatureDataUri) {
  const student = payment.studentId || {};
  const studentName = student.name || student.fullName || 'N/A';
  const studentAdmNo = student.admissionNumber || student.studentId || '-';
  const studentClass = (student.classId?.name || student.class || '-') + (student.section ? ` (${student.section})` : '');
  const paymentDate = payment.paymentDate
    ? new Date(payment.paymentDate).toLocaleDateString('en-IN')
    : '-';
  const amountFormatted = typeof payment.amount === 'number' ? payment.amount.toLocaleString('en-IN') : '0';
  const invoiceItems = payment.invoiceId?.items || [];
  const billingPeriod = payment.invoiceId?.billingPeriod?.displayText || payment.invoiceId?.periodLabel || '';
  const initiatedByLabel = (payment.initiatedBy === 'admin' || payment.collectedBy) ? 'Admin' : 'Student';
  const invoiceStatus = payment.invoiceId?.status || 'Paid';
  const invoiceBalance = payment.invoiceId?.balanceAmount ?? 0;
  const isPartial = invoiceBalance > 0 && invoiceStatus !== 'Paid';
  const schoolName = schoolData.schoolName || 'School';
  const fullAddress = schoolData.fullAddress || '';
  const phone = schoolData.phone || '-';
  const email = schoolData.email || '-';
  const schoolCode = schoolData.schoolCode || '';
  const udiseCode = schoolData.udiseCode || '';
  const now = new Date();
  const generatedOn = now.toLocaleString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

  const feeRowsHtml = invoiceItems.map((item, i) => `
    <tr style="background:${i % 2 === 0 ? '#f0fdfa' : '#fff'}">
      <td>${item.feeHeadName || '-'}</td>
      <td class="amt">${(item.netAmount || item.periodAmount || item.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Receipt #${payment.receiptNumber}</title>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800;900&display=swap" rel="stylesheet">
<style>
  @page { size: A4 portrait; margin: 0; }
  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

  html, body {
    width: 794px; height: 1123px;
    font-family: 'Helvetica Neue', 'Arial', 'Noto Sans', sans-serif;
    color: #111827; background: #fff;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
    text-rendering: optimizeLegibility; -webkit-font-smoothing: antialiased;
  }

  .page { width: 794px; height: 1123px; position: relative; overflow: hidden; background: #fff; padding: 24px; }

  .card {
    background: #ffffff; border-radius: 6px; border: 1px solid #d1d5db;
    overflow: hidden; display: flex; flex-direction: column; position: relative;
  }

  .deco-shapes { position: absolute; top: 0; right: 0; width: 100%; height: 100%; pointer-events: none; z-index: 0; overflow: hidden; border-radius: 6px; }
  .deco-shapes .s1 { position: absolute; top: -30px; right: -20px; width: 160px; height: 160px; background: #eef9f7; border-radius: 50%; }
  .deco-shapes .s2 { position: absolute; top: 40px; right: -40px; width: 120px; height: 220px; background: #f2faf9; transform: rotate(-25deg); border-radius: 40px; }
  .deco-shapes .s3 { position: absolute; bottom: -20px; left: -25px; width: 120px; height: 120px; background: #f0faf8; border-radius: 50%; }
  .card > *:not(.deco-shapes) { position: relative; z-index: 1; }

  .watermark { position: absolute; top: 45%; left: 50%; transform: translate(-50%,-50%) rotate(-35deg); font-family: Georgia, serif; font-size: 36px; font-weight: 700; color: rgba(62,196,177,0.04); letter-spacing: 8px; white-space: nowrap; z-index: 0; pointer-events: none; text-transform: uppercase; }

  .header { position: relative; padding: 8px 18px 4px; flex-shrink: 0; min-height: 64px; }
  .logo-wrap { position: absolute; left: 10px; top: 4px; width: 58px; height: 58px; display: flex; align-items: center; justify-content: center; border-radius: 6px; overflow: hidden; }
  .logo-wrap img { width: 58px; height: 58px; object-fit: contain; }
  .school-info { text-align: center; }
  .school-name { font-family: 'Playfair Display', Georgia, 'Times New Roman', serif; font-size: 19px; font-weight: 800; color: #1F6F6D; line-height: 1.15; letter-spacing: 1px; text-transform: uppercase; }
  .school-addr { font-size: 9px; color: #4b5563; font-weight: 500; margin-top: 2px; }
  .aff-row { display: flex; justify-content: center; gap: 12px; margin-top: 3px; flex-wrap: wrap; }
  .aff-line { font-size: 8.5px; color: #4b5563; font-weight: 500; line-height: 1.6; }
  .aff-line b { font-weight: 700; color: #111827; }
  .header-divider { height: 1px; background: #e5e7eb; margin: 0 16px; flex-shrink: 0; }

  .title-section { padding: 8px 16px; text-align: center; display: flex; flex-direction: column; align-items: center; flex-shrink: 0; }
  .title-badge { background: #edf9f7; border-radius: 7px; padding: 6px 22px; }
  .title-badge h1 { font-size: 12px; font-weight: 700; color: #0a5c56; letter-spacing: 3.5px; text-transform: uppercase; line-height: 1; }

  .meta-row { display: flex; justify-content: space-between; align-items: center; padding: 5px 16px; background: #f9fafb; border-top: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; flex-shrink: 0; }
  .meta-left { font-size: 11px; font-weight: 600; color: #111827; }
  .meta-left .hash { color: #3EC4B1; }
  .meta-right { font-size: 11px; color: #374151; font-weight: 500; }
  .meta-right b { font-weight: 700; color: #111827; }

  .info-grid { display: flex; gap: 0; padding: 10px 14px; flex-shrink: 0; }
  .info-col { flex: 1; padding: 0 4px; }
  .info-col + .info-col { border-left: 1px solid #e5e7eb; padding-left: 12px; }
  .info-col-title { font-size: 9px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px; }
  .info-row { display: flex; margin-bottom: 3px; }
  .info-label { width: 65px; font-size: 10px; font-weight: 500; color: #6b7280; flex-shrink: 0; }
  .info-value { font-size: 11px; font-weight: 700; color: #111827; }
  .info-value.green { color: #059669; }
  .info-value.teal { color: #0a5c56; font-weight: 800; }

  .fee-wrap { margin: 5px 12px 0; border-radius: 6px; overflow: hidden; border: 1px solid #e5e7eb; flex-shrink: 0; }
  .fee-tbl { width: 100%; border-collapse: separate; border-spacing: 0; }
  .fee-tbl thead th { font-size: 8.5px; font-weight: 700; color: #1f2937; text-transform: uppercase; letter-spacing: .4px; padding: 4px 8px; text-align: left; background: #edf9f7; border-bottom: 1px solid #e5e7eb; }
  .fee-tbl thead th:last-child { text-align: right; }
  .fee-tbl tbody td { font-size: 11px; font-weight: 500; color: #111827; padding: 4px 8px; border-bottom: 1px solid #e5e7eb; }
  .fee-tbl tbody td.amt { text-align: right; font-weight: 700; font-variant-numeric: tabular-nums; }
  .fee-tbl tbody tr:last-child td { border-bottom: none; }

  .amount-section { margin: 6px 12px 0; flex-shrink: 0; }
  .amount-box { background: #edf9f7; border: 1px solid #d1fae5; border-radius: 7px; padding: 8px 14px; display: flex; align-items: center; justify-content: space-between; }
  .amt-label { font-size: 10px; font-weight: 700; color: #0a5c56; text-transform: uppercase; letter-spacing: 1.5px; }
  .amt-value { font-size: 22px; font-weight: 800; color: #059669; font-variant-numeric: tabular-nums; }

  .balance-section { margin: 5px 12px 0; flex-shrink: 0; }
  .balance-box { background: #fffbeb; border: 1px solid #fde68a; border-radius: 7px; padding: 5px 14px; display: flex; align-items: center; justify-content: space-between; }
  .bal-label { font-size: 8.5px; font-weight: 700; color: #92400e; text-transform: uppercase; letter-spacing: 1px; }
  .bal-value { font-size: 15px; font-weight: 800; color: #b45309; }

  .sig-section { padding: 0 18px; flex-shrink: 0; margin-top: 10px; }
  .sig-row { display: flex; justify-content: space-between; align-items: flex-end; height: 50px; }
  .sig-col { text-align: center; width: 110px; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; }
  .sig-img { max-height: 38px; max-width: 90px; margin: 0 auto 2px; object-fit: contain; display: block; }
  .sig-col .sig-line { width: 75px; height: 1px; background: #9ca3af; margin: 0 auto 3px; }
  .sig-col .sig-label { font-size: 8.5px; font-weight: 600; color: #374151; text-transform: uppercase; letter-spacing: 0.5px; }

  .footer { padding: 5px 16px; border-top: 1px solid #e5e7eb; text-align: center; flex-shrink: 0; margin-top: 6px; }
  .footer span { font-size: 7.5px; color: #4b5563; font-weight: 500; text-transform: uppercase; letter-spacing: 1px; }
  .footer .brand { font-weight: 600; color: #0f766e; }
  .footer .gen { display: block; margin-top: 1px; font-size: 7px; color: #6b7280; text-transform: none; letter-spacing: 0; }
</style>
</head>
<body>
<div class="page">
  <div class="card">
    <div class="deco-shapes"><div class="s1"></div><div class="s2"></div><div class="s3"></div></div>
    <div class="watermark">Payment Receipt</div>

    <div class="header">
      ${logoDataUri ? `<div class="logo-wrap"><img src="${logoDataUri}" alt="Logo"></div>` : ''}
      <div class="school-info">
        <div class="school-name">${schoolName}</div>
        ${fullAddress ? `<div class="school-addr">${fullAddress}</div>` : ''}
        <div class="school-addr">Phone: ${phone} &nbsp;|&nbsp; Email: ${email}</div>
        ${(schoolCode || udiseCode) ? `<div class="aff-row">
          ${schoolCode ? `<span class="aff-line">School Code: <b>${schoolCode}</b></span>` : ''}
          ${udiseCode ? `<span class="aff-line">UDISE: <b>${udiseCode}</b></span>` : ''}
        </div>` : ''}
      </div>
    </div>
    <div class="header-divider"></div>

    <div class="title-section"><div class="title-badge"><h1>Payment Receipt</h1></div></div>

    <div class="meta-row">
      <div class="meta-left"><span class="hash">#</span> ${payment.receiptNumber || '-'}</div>
      <div class="meta-right">Date: <b>${paymentDate}</b></div>
    </div>

    <div class="info-grid">
      <div class="info-col">
        <div class="info-col-title">Student</div>
        <div class="info-row"><span class="info-label">Name</span><span class="info-value">${studentName}</span></div>
        <div class="info-row"><span class="info-label">Adm. No.</span><span class="info-value">${studentAdmNo}</span></div>
        <div class="info-row"><span class="info-label">Class</span><span class="info-value">${studentClass}</span></div>
      </div>
      <div class="info-col">
        <div class="info-col-title">Payment</div>
        <div class="info-row"><span class="info-label">Date</span><span class="info-value">${paymentDate}</span></div>
        <div class="info-row"><span class="info-label">Mode</span><span class="info-value">${payment.paymentMethod || '-'}</span></div>
        ${billingPeriod ? `<div class="info-row"><span class="info-label">Period</span><span class="info-value teal">${billingPeriod}</span></div>` : ''}
        <div class="info-row"><span class="info-label">Initiated By</span><span class="info-value">${initiatedByLabel}</span></div>
        <div class="info-row"><span class="info-label">Status</span><span class="info-value green">${isPartial ? 'Partial' : 'Paid'}</span></div>
      </div>
    </div>

    ${invoiceItems.length > 0 ? `
    <div class="fee-wrap">
      <table class="fee-tbl">
        <thead><tr><th>Description</th><th>Amount (&#8377;)</th></tr></thead>
        <tbody>${feeRowsHtml}</tbody>
      </table>
    </div>` : ''}

    <div class="amount-section">
      <div class="amount-box">
        <span class="amt-label">Total Amount Paid</span>
        <span class="amt-value">Rs. ${amountFormatted}</span>
      </div>
    </div>

    ${isPartial ? `
    <div class="balance-section">
      <div class="balance-box">
        <span class="bal-label">Remaining Balance${billingPeriod ? ` (${billingPeriod})` : ''}</span>
        <span class="bal-value">&#8377; ${invoiceBalance.toLocaleString('en-IN')}</span>
      </div>
    </div>` : ''}

    <div class="sig-section">
      <div class="sig-row">
        <div class="sig-col"><div class="sig-line"></div><div class="sig-label">Depositor</div></div>
        <div class="sig-col">
          ${signatureDataUri ? `<img class="sig-img" src="${signatureDataUri}" alt="Principal Signature">` : ''}
          <div class="sig-line"></div><div class="sig-label">Principal</div>
        </div>
      </div>
    </div>

    <div class="footer">
      <span>Powered by <span class="brand">Learnovo</span> &mdash; School Management System</span>
      <span class="gen">Generated: ${generatedOn}</span>
    </div>
  </div>
</div>
</body>
</html>`;
}

/**
 * Generate receipt PDF using Puppeteer — same engine as certificates.
 * Uses the shared browser instance from pdfService.
 */
async function generateReceiptPdf(payment, schoolData) {
  const [logoDataUri, signatureDataUri] = await Promise.all([
    toBase64DataUri(schoolData.logo),
    toBase64DataUri(schoolData.principalSignature)
  ]);

  const html = buildReceiptHtml(payment, schoolData, logoDataUri, signatureDataUri);

  const { getBrowser, releaseBrowser } = pdfService._internal;
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 3 });
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 15000 });
    await page.evaluateHandle('document.fonts.ready');

    const pdfUint8 = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 }
    });

    return Buffer.from(pdfUint8);
  } finally {
    await page.close();
    releaseBrowser();
  }
}

module.exports = { generateReceiptPdf };
