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

function buildReceiptHtml(payment, schoolData, logoDataUri, signatureDataUri) {
  const student = payment.studentId || {};
  const studentName = student.name || student.fullName || 'N/A';
  const studentAdmNo = student.admissionNumber || student.studentId || '-';
  const studentClass = (student.classId?.name || student.class || '-') + (student.section ? ` (${student.section})` : '');
  const paymentDate = payment.paymentDate
    ? new Date(payment.paymentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
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
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800;900&display=swap" rel="stylesheet">
<style>
  @page { size: A4 portrait; margin: 0; }
  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    width: 794px; height: 1123px;
    font-family: 'Helvetica Neue', Arial, 'Noto Sans', sans-serif;
    color: #111827; background: #f9fafb;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
    text-rendering: optimizeLegibility; -webkit-font-smoothing: antialiased;
  }
  .page {
    width: 794px; height: 1123px; position: relative;
    overflow: hidden; background: #f9fafb;
  }
  .card {
    position: absolute; top: 14px; left: 14px; right: 14px; bottom: 14px;
    background: #fff; border-radius: 14px;
    box-shadow: 0 2px 24px rgba(0,0,0,0.07);
    overflow: hidden; display: flex; flex-direction: column;
  }

  /* Decorative shapes */
  .deco { position: absolute; top: 0; right: 0; width: 100%; height: 100%; pointer-events: none; z-index: 0; overflow: hidden; border-radius: 14px; }
  .deco .d1 { position: absolute; top: -60px; right: -40px; width: 320px; height: 320px; background: #eef9f7; border-radius: 50%; }
  .deco .d2 { position: absolute; top: 80px; right: -80px; width: 240px; height: 450px; background: #f2faf9; transform: rotate(-25deg); border-radius: 80px; }
  .deco .d3 { position: absolute; bottom: -50px; left: -60px; width: 260px; height: 260px; background: #f0faf8; border-radius: 50%; }
  .deco .d4 { position: absolute; bottom: 120px; left: 40px; width: 160px; height: 300px; background: #f4fbfa; transform: rotate(20deg); border-radius: 60px; }
  .card > *:not(.deco) { position: relative; z-index: 1; }

  /* Watermark */
  .wm {
    position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%) rotate(-35deg);
    font-family: Georgia, serif; font-size: 54px; font-weight: 700;
    color: rgba(62,196,177,0.04); letter-spacing: 12px;
    white-space: nowrap; z-index: 0; pointer-events: none; text-transform: uppercase;
  }

  /* Header */
  .header { display: flex; align-items: center; gap: 16px; padding: 22px 30px 14px; flex-shrink: 0; }
  .logo-wrap { width: 90px; height: 90px; flex-shrink: 0; border-radius: 10px; overflow: hidden; display: flex; align-items: center; justify-content: center; }
  .logo-wrap img { width: 90px; height: 90px; object-fit: contain; }
  .school-info { flex: 1; text-align: center; }
  .school-name {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 28px; font-weight: 800; color: #1F6F6D;
    letter-spacing: 1.5px; line-height: 1.15; text-transform: uppercase;
  }
  .school-addr { font-size: 12px; color: #4b5563; font-weight: 500; margin-top: 3px; }
  .aff-row { display: flex; justify-content: center; gap: 20px; margin-top: 6px; }
  .aff-line { font-size: 11px; color: #4b5563; font-weight: 500; }
  .aff-line b { font-weight: 700; color: #111827; }
  .hd { height: 1px; background: #e5e7eb; margin: 0 28px; flex-shrink: 0; }

  /* Title */
  .title-sec { padding: 18px 28px; text-align: center; display: flex; flex-direction: column; align-items: center; flex-shrink: 0; }
  .title-badge { background: #edf9f7; border-radius: 10px; padding: 12px 32px; }
  .title-badge h1 { font-size: 16px; font-weight: 700; color: #0a5c56; letter-spacing: 4.5px; text-transform: uppercase; line-height: 1; }

  /* Meta */
  .meta { display: flex; justify-content: space-between; align-items: center; padding: 10px 28px; background: #f9fafb; border-top: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; flex-shrink: 0; }
  .meta-l { font-size: 14px; font-weight: 600; color: #111827; }
  .meta-l .hash { color: #3EC4B1; }
  .meta-r { font-size: 14px; color: #374151; font-weight: 500; }
  .meta-r b { font-weight: 700; color: #111827; }

  /* Two-column info */
  .info { display: flex; gap: 0; padding: 16px 24px; flex-shrink: 0; }
  .info-col { flex: 1; padding: 0 8px; }
  .info-col + .info-col { border-left: 1px solid #e5e7eb; padding-left: 20px; }
  .info-title { font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 1.2px; margin-bottom: 8px; }
  .info-row { display: flex; margin-bottom: 5px; }
  .info-lbl { width: 90px; font-size: 13px; font-weight: 500; color: #6b7280; flex-shrink: 0; }
  .info-val { font-size: 14px; font-weight: 700; color: #111827; }
  .info-val.green { color: #059669; }
  .info-val.teal { color: #0a5c56; font-weight: 800; }

  /* Fee table */
  .fee-wrap { margin: 8px 20px 0; border-radius: 8px; overflow: hidden; border: 1px solid #e5e7eb; flex-shrink: 0; }
  .fee-tbl { width: 100%; border-collapse: separate; border-spacing: 0; }
  .fee-tbl thead th { font-size: 11px; font-weight: 700; color: #1f2937; text-transform: uppercase; letter-spacing: .5px; padding: 8px 14px; text-align: left; background: #edf9f7; border-bottom: 1px solid #e5e7eb; }
  .fee-tbl thead th:last-child { text-align: right; }
  .fee-tbl tbody td { font-size: 14px; font-weight: 500; color: #111827; padding: 7px 14px; border-bottom: 1px solid #e5e7eb; }
  .fee-tbl tbody td.amt { text-align: right; font-weight: 700; font-variant-numeric: tabular-nums; }
  .fee-tbl tbody tr:last-child td { border-bottom: none; }

  /* Amount */
  .amt-sec { margin: 10px 20px 0; flex-shrink: 0; }
  .amt-box { background: #edf9f7; border: 1px solid #d1fae5; border-radius: 10px; padding: 14px 20px; display: flex; align-items: center; justify-content: space-between; }
  .amt-label { font-size: 13px; font-weight: 700; color: #0a5c56; text-transform: uppercase; letter-spacing: 2px; }
  .amt-value { font-size: 30px; font-weight: 800; color: #059669; font-variant-numeric: tabular-nums; }

  /* Balance */
  .bal-sec { margin: 8px 20px 0; flex-shrink: 0; }
  .bal-box { background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; padding: 10px 20px; display: flex; align-items: center; justify-content: space-between; }
  .bal-label { font-size: 11px; font-weight: 700; color: #92400e; text-transform: uppercase; letter-spacing: 1px; }
  .bal-value { font-size: 20px; font-weight: 800; color: #b45309; }

  /* Spacer */
  .spacer { flex: 1; min-height: 10px; }

  /* Signatures */
  .sig-sec { padding: 0 30px 16px; flex-shrink: 0; }
  .sig-row { display: flex; justify-content: space-between; align-items: flex-end; height: 80px; }
  .sig-col { text-align: center; width: 150px; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; }
  .sig-img { max-height: 60px; max-width: 140px; margin: 0 auto 4px; object-fit: contain; display: block; }
  .sig-col .sig-line { width: 110px; height: 1px; background: #9ca3af; margin: 0 auto 4px; }
  .sig-col .sig-label { font-size: 11px; font-weight: 600; color: #374151; text-transform: uppercase; letter-spacing: 0.8px; }

  /* Footer */
  .footer { padding: 10px 28px; border-top: 1px solid #e5e7eb; text-align: center; flex-shrink: 0; }
  .footer span { font-size: 9px; color: #4b5563; font-weight: 500; text-transform: uppercase; letter-spacing: 1.5px; }
  .footer .brand { font-weight: 600; color: #0f766e; }
  .footer .gen { display: block; margin-top: 2px; font-size: 8px; color: #6b7280; text-transform: none; letter-spacing: 0; }
</style>
</head>
<body>
<div class="page">
<div class="card">
  <div class="deco"><div class="d1"></div><div class="d2"></div><div class="d3"></div><div class="d4"></div></div>
  <div class="wm">Payment Receipt</div>

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
  <div class="hd"></div>

  <div class="title-sec"><div class="title-badge"><h1>Payment Receipt</h1></div></div>

  <div class="meta">
    <div class="meta-l"><span class="hash">#</span> ${payment.receiptNumber || '-'}</div>
    <div class="meta-r">Date: <b>${paymentDate}</b></div>
  </div>

  <div class="info">
    <div class="info-col">
      <div class="info-title">Student</div>
      <div class="info-row"><span class="info-lbl">Name</span><span class="info-val">${studentName}</span></div>
      <div class="info-row"><span class="info-lbl">Adm. No.</span><span class="info-val">${studentAdmNo}</span></div>
      <div class="info-row"><span class="info-lbl">Class</span><span class="info-val">${studentClass}</span></div>
    </div>
    <div class="info-col">
      <div class="info-title">Payment</div>
      <div class="info-row"><span class="info-lbl">Date</span><span class="info-val">${paymentDate}</span></div>
      <div class="info-row"><span class="info-lbl">Mode</span><span class="info-val">${payment.paymentMethod || '-'}</span></div>
      ${billingPeriod ? `<div class="info-row"><span class="info-lbl">Period</span><span class="info-val teal">${billingPeriod}</span></div>` : ''}
      <div class="info-row"><span class="info-lbl">Initiated By</span><span class="info-val">${initiatedByLabel}</span></div>
      <div class="info-row"><span class="info-lbl">Status</span><span class="info-val green">${isPartial ? 'Partial' : 'Paid'}</span></div>
    </div>
  </div>

  ${invoiceItems.length > 0 ? `
  <div class="fee-wrap">
    <table class="fee-tbl">
      <thead><tr><th>Description</th><th>Amount (&#8377;)</th></tr></thead>
      <tbody>${feeRowsHtml}</tbody>
    </table>
  </div>` : ''}

  <div class="amt-sec">
    <div class="amt-box">
      <span class="amt-label">Total Amount Paid</span>
      <span class="amt-value">&#8377; ${amountFormatted}</span>
    </div>
  </div>

  ${isPartial ? `
  <div class="bal-sec">
    <div class="bal-box">
      <span class="bal-label">Remaining Balance${billingPeriod ? ` (${billingPeriod})` : ''}</span>
      <span class="bal-value">&#8377; ${invoiceBalance.toLocaleString('en-IN')}</span>
    </div>
  </div>` : ''}

  <div class="spacer"></div>

  <div class="sig-sec">
    <div class="sig-row">
      <div class="sig-col"><div class="sig-line"></div><div class="sig-label">Depositor</div></div>
      <div class="sig-col">
        ${signatureDataUri ? `<img class="sig-img" src="${signatureDataUri}" alt="Signature">` : ''}
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
      format: 'A4', printBackground: true, preferCSSPageSize: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 }
    });
    return Buffer.from(pdfUint8);
  } finally {
    await page.close();
    releaseBrowser();
  }
}

module.exports = { generateReceiptPdf };
