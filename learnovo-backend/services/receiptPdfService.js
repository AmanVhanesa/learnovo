'use strict';

const pdfService = require('./pdfService');
const axios = require('axios');

function numberToIndianWords(num) {
  const n = Math.round(Math.abs(Number(num) || 0));
  if (n === 0) return 'Zero Rupees Only';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const twoDigits = (x) => (x < 20 ? ones[x] : `${tens[Math.floor(x / 10)]}${x % 10 ? ` ${ones[x % 10]}` : ''}`);
  const threeDigits = (x) => {
    const h = Math.floor(x / 100);
    const r = x % 100;
    return `${h ? `${ones[h]} Hundred${r ? ' ' : ''}` : ''}${r ? twoDigits(r) : ''}`;
  };
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const rest = n % 1000;
  const parts = [];
  if (crore) parts.push(`${threeDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (rest) parts.push(threeDigits(rest));
  return `${parts.join(' ').replace(/\s+/g, ' ').trim()} Rupees Only`;
}

async function toBase64DataUri(url) {
  if (!url) return '';
  try {
    const fullUrl = url.startsWith('http') ? url : `https://api.learnovoportal.com${url}`;
    const response = await axios.get(fullUrl, { responseType: 'arraybuffer', timeout: 8000 });
    const buf = Buffer.from(response.data);
    if (buf.length < 100) return '';
    const mime = response.headers['content-type'] || 'image/png';
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch {
    return '';
  }
}

function buildReceiptHtml(payment, schoolData, logoDataUri) {
  const student = payment.studentId || {};
  const studentName = student.name || student.fullName || 'N/A';
  const studentAdmNo = student.admissionNumber || student.studentId || '-';
  const studentClass = (student.classId?.name || student.class || '-') + (student.section ? ` (${student.section})` : '');
  const paymentDate = payment.paymentDate
    ? new Date(payment.paymentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '-';
  const amountFormatted = typeof payment.amount === 'number' ? payment.amount.toLocaleString('en-IN') : '0';
  const amountInWords = numberToIndianWords(payment.amount || 0);
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

  /* ─────────────────────────────────────────────────────────────
     A4 portrait layout: 794 × 1123 px
     Receipt content fills the top portion of the page.
     ───────────────────────────────────────────────────────────── */
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
    width: 794px; min-height: 562px; position: relative;
    overflow: hidden; background: #f9fafb;
  }
  .card {
    margin: 8px 10px 18px; background: #fff; border-radius: 10px;
    box-shadow: 0 2px 18px rgba(0,0,0,0.07);
    overflow: hidden; display: flex; flex-direction: column;
    position: relative;
    border: 3px solid #0a5c56;
  }

  /* Decorative shapes */
  .deco { position: absolute; top: 0; right: 0; width: 100%; height: 100%; pointer-events: none; z-index: 0; overflow: hidden; border-radius: 10px; }
  .deco .d1 { position: absolute; top: -40px; right: -30px; width: 220px; height: 220px; background: #eef9f7; border-radius: 50%; }
  .deco .d2 { position: absolute; top: 50px; right: -50px; width: 170px; height: 300px; background: #f2faf9; transform: rotate(-25deg); border-radius: 60px; }
  .deco .d3 { position: absolute; bottom: -30px; left: -40px; width: 180px; height: 180px; background: #f0faf8; border-radius: 50%; }
  .deco .d4 { position: absolute; bottom: 60px; left: 30px; width: 110px; height: 200px; background: #f4fbfa; transform: rotate(20deg); border-radius: 40px; }
  .card > *:not(.deco) { position: relative; z-index: 1; }

  /* Watermark */
  .wm {
    position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%) rotate(-35deg);
    font-family: Georgia, serif; font-size: 38px; font-weight: 700;
    color: rgba(62,196,177,0.04); letter-spacing: 10px;
    white-space: nowrap; z-index: 0; pointer-events: none; text-transform: uppercase;
  }

  /* Header — logo beside school name */
  .header { display: flex; align-items: center; gap: 12px; padding: 12px 20px 8px; flex-shrink: 0; }
  .logo-wrap { width: 60px; height: 60px; flex-shrink: 0; border-radius: 8px; overflow: hidden; }
  .logo-wrap img { width: 60px; height: 60px; object-fit: contain; }
  .school-info { flex: 1; text-align: center; }
  .school-name {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 20px; font-weight: 800; color: #1F6F6D;
    letter-spacing: 1px; line-height: 1.15; text-transform: uppercase;
  }
  .school-addr { font-size: 9px; color: #4b5563; font-weight: 500; margin-top: 1px; }
  .aff-row { display: flex; justify-content: center; gap: 14px; margin-top: 3px; }
  .aff-line { font-size: 8px; color: #4b5563; font-weight: 500; }
  .aff-line b { font-weight: 700; color: #111827; }
  .hd { height: 1px; background: #e5e7eb; margin: 0 18px; flex-shrink: 0; }

  /* Title */
  .title-sec { padding: 7px 18px; text-align: center; display: flex; flex-direction: column; align-items: center; flex-shrink: 0; }
  .title-badge { background: #edf9f7; border-radius: 8px; padding: 5px 20px; }
  .title-badge h1 { font-size: 11px; font-weight: 700; color: #0a5c56; letter-spacing: 3.5px; text-transform: uppercase; line-height: 1; }

  /* Meta */
  .meta { display: flex; justify-content: space-between; align-items: center; padding: 5px 18px; background: #f9fafb; border-top: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; flex-shrink: 0; }
  .meta-l { font-size: 11px; font-weight: 600; color: #111827; }
  .meta-l .hash { color: #3EC4B1; }
  .meta-r { font-size: 11px; color: #374151; font-weight: 500; }
  .meta-r b { font-weight: 700; color: #111827; }

  /* Two-column info */
  .info { display: flex; gap: 0; padding: 8px 16px; flex-shrink: 0; }
  .info-col { flex: 1; padding: 0 6px; }
  .info-col + .info-col { border-left: 1px solid #e5e7eb; padding-left: 14px; }
  .info-title { font-size: 8px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
  .info-row { display: flex; margin-bottom: 2px; }
  .info-lbl { width: 70px; font-size: 10px; font-weight: 500; color: #6b7280; flex-shrink: 0; }
  .info-val { font-size: 11px; font-weight: 700; color: #111827; }
  .info-val.green { color: #059669; }
  .info-val.teal { color: #0a5c56; font-weight: 800; }

  /* Fee table */
  .fee-wrap { margin: 4px 14px 0; border-radius: 6px; overflow: hidden; border: 1px solid #e5e7eb; flex-shrink: 0; }
  .fee-tbl { width: 100%; border-collapse: separate; border-spacing: 0; }
  .fee-tbl thead th { font-size: 8px; font-weight: 700; color: #1f2937; text-transform: uppercase; letter-spacing: .4px; padding: 4px 10px; text-align: left; background: #edf9f7; border-bottom: 1px solid #e5e7eb; }
  .fee-tbl thead th:last-child { text-align: right; }
  .fee-tbl tbody td { font-size: 11px; font-weight: 500; color: #111827; padding: 3px 10px; border-bottom: 1px solid #e5e7eb; }
  .fee-tbl tbody td.amt { text-align: right; font-weight: 700; font-variant-numeric: tabular-nums; }
  .fee-tbl tbody tr:last-child td { border-bottom: none; }

  /* Amount */
  .amt-sec { margin: 5px 14px 0; flex-shrink: 0; }
  .amt-box { background: #edf9f7; border: 1px solid #d1fae5; border-radius: 8px; padding: 7px 14px; display: flex; align-items: center; justify-content: space-between; }
  .amt-label { font-size: 10px; font-weight: 700; color: #0a5c56; text-transform: uppercase; letter-spacing: 1.5px; }
  .amt-value { font-size: 22px; font-weight: 800; color: #059669; font-variant-numeric: tabular-nums; }
  .amt-right { display: flex; flex-direction: column; align-items: flex-end; }
  .amt-words { margin-top: 1px; font-size: 8.5px; font-style: italic; color: #0a5c56; font-weight: 600; letter-spacing: 0.3px; text-align: right; }
  .amt-words b { font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; font-style: normal; font-size: 7.5px; color: #4b5563; }

  /* Balance */
  .bal-sec { margin: 4px 14px 0; flex-shrink: 0; }
  .bal-box { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 4px 14px; display: flex; align-items: center; justify-content: space-between; }
  .bal-label { font-size: 8px; font-weight: 700; color: #92400e; text-transform: uppercase; letter-spacing: 1px; }
  .bal-value { font-size: 15px; font-weight: 800; color: #b45309; }

  /* Spacer */
  .spacer { flex: 1; min-height: 4px; }

  /* Signatures */
  .sig-sec { padding: 0 20px 4px; flex-shrink: 0; }
  .sig-row { display: flex; justify-content: space-between; align-items: flex-end; height: 70px; }
  .sig-col { text-align: center; width: 210px; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; }
  .sig-img { max-height: 100px; max-width: 200px; margin: 0 auto 4px; object-fit: contain; display: block; }
  .sig-col .sig-line { width: 80px; height: 1px; background: #9ca3af; margin: 0 auto 2px; }
  .sig-col .sig-label { font-size: 8px; font-weight: 600; color: #374151; text-transform: uppercase; letter-spacing: 0.6px; }
  .sig-col .dep-name { font-size: 13px; font-weight: 700; color: #0a5c56; margin: 0 auto 4px; padding-bottom: 3px; border-bottom: 1px solid #0a5c56; min-width: 140px; text-align: center; font-family: Georgia, serif; }

  /* Footer */
  .footer { padding: 4px 18px; border-top: 1px solid #e5e7eb; text-align: center; flex-shrink: 0; }
  .footer span { font-size: 7px; color: #4b5563; font-weight: 500; text-transform: uppercase; letter-spacing: 1.2px; }
  .footer .brand { font-weight: 600; color: #0f766e; }
  .footer .gen { display: block; margin-top: 1px; font-size: 6.5px; color: #6b7280; text-transform: none; letter-spacing: 0; }
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
      <div class="amt-right">
        <span class="amt-value">&#8377; ${amountFormatted}</span>
        <div class="amt-words"><b>In Words:</b> ${amountInWords}</div>
      </div>
    </div>
  </div>

  ${isPartial ? `
  <div class="bal-sec">
    <div class="bal-box">
      <span class="bal-label">Remaining Balance${billingPeriod ? ` — ${billingPeriod}` : ''}</span>
      <span class="bal-value">&#8377; ${invoiceBalance.toLocaleString('en-IN')}</span>
    </div>
  </div>` : ''}

  <div class="spacer"></div>

  <div class="sig-sec">
    <div class="sig-row">
      <div class="sig-col">
        ${payment.depositorName ? `<div class="dep-name">${payment.depositorName}</div>` : '<div class="sig-line"></div>'}
        <div class="sig-label">Depositor Name</div>
      </div>
      <div class="sig-col">
        <div class="sig-line"></div>
        <div class="sig-label">Cashier</div>
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
  const logoDataUri = await toBase64DataUri(schoolData.logo);
  const html = buildReceiptHtml(payment, schoolData, logoDataUri);
  const { getBrowser, releaseBrowser } = pdfService._internal;
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    // A4 portrait
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 3 });
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 15000 });
    await page.evaluateHandle('document.fonts.ready');
    const pdfUint8 = await page.pdf({
      format: 'A4',
      printBackground: true, preferCSSPageSize: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 }
    });
    return Buffer.from(pdfUint8);
  } finally {
    await page.close();
    releaseBrowser();
  }
}

/**
 * Generate printable HTML page — same template as PDF but with a print toolbar.
 * Browser @page CSS handles the half-A4 sizing when user hits Print.
 */
async function generateReceiptHtml(payment, schoolData) {
  const logoDataUri = await toBase64DataUri(schoolData.logo);
  let html = buildReceiptHtml(payment, schoolData, logoDataUri);

  // Inject a toolbar and tweak for browser viewing/printing
  const toolbarHtml = `
    <div id="toolbar" style="position:fixed;top:0;left:0;right:0;background:#1C1C1E;color:#fff;padding:10px 24px;display:flex;gap:10px;align-items:center;z-index:999;font-family:'Helvetica Neue',Arial,sans-serif;">
      <span style="flex:1;font-size:13px;font-weight:500;">Receipt #${payment.receiptNumber || ''}</span>
      <button onclick="document.getElementById('toolbar').style.display='none';window.print();setTimeout(()=>document.getElementById('toolbar').style.display='flex',500)" style="padding:7px 18px;border:none;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;background:#1F6F6D;color:white;">Print</button>
      <button onclick="window.close()" style="padding:7px 18px;border:none;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;background:#38383A;color:#8E8E93;">Close</button>
    </div>`;

  // Add toolbar right after <body>, add padding-top so content isn't hidden behind toolbar
  html = html.replace('<body>', `<body>${toolbarHtml}`);
  html = html.replace('.page {', '.page { margin-top: 50px; ');

  // Override @page for browser print — A4 portrait
  html = html.replace('@page { size: A4 portrait; margin: 0; }',
    '@page { size: A4 portrait; margin: 0; } @media print { #toolbar { display: none !important; } .page { margin-top: 0 !important; } }');

  return html;
}

/* ──────────────────────────────────────────────────────────────
   Consolidated receipt — for when admin settles multiple invoices
   in one transaction. Renders ONE PDF listing every invoice as a row.
   ────────────────────────────────────────────────────────────── */

function buildConsolidatedReceiptHtml(payments, schoolData, logoDataUri) {
  const first = payments[0] || {};
  const student = first.studentId || {};
  const studentName = student.name || student.fullName || 'N/A';
  const studentAdmNo = student.admissionNumber || student.studentId || '-';
  const studentClass = (student.classId?.name || student.class || '-') + (student.section ? ` (${student.section})` : '');

  const paymentDate = first.paymentDate
    ? new Date(first.paymentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '-';

  const totalAmount = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const totalFormatted = totalAmount.toLocaleString('en-IN');
  const amountInWords = numberToIndianWords(totalAmount);
  const groupReceiptNumber = first.groupReceiptNumber || first.transactionGroupId || '-';

  const depositorName = first.depositorName || '';
  const paymentMethod = first.paymentMethod || '-';
  const initiatedByLabel = (first.initiatedBy === 'admin' || first.collectedBy) ? 'Admin' : 'Student';

  const schoolName = schoolData.schoolName || 'School';
  const fullAddress = schoolData.fullAddress || '';
  const phone = schoolData.phone || '-';
  const email = schoolData.email || '-';
  const schoolCode = schoolData.schoolCode || '';
  const udiseCode = schoolData.udiseCode || '';
  const now = new Date();
  const generatedOn = now.toLocaleString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

  // One row per invoice — show period/description, individual receipt #, amount
  const rowsHtml = payments.map((p, i) => {
    const inv = p.invoiceId || {};
    const period = inv.billingPeriod?.displayText || inv.periodLabel || inv.invoiceNumber || 'Fee Payment';
    const invNo = inv.invoiceNumber || '-';
    const amt = (Number(p.amount) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
    return `
      <tr style="background:${i % 2 === 0 ? '#f0fdfa' : '#fff'}">
        <td>${period}</td>
        <td>${invNo}</td>
        <td>${p.receiptNumber || '-'}</td>
        <td class="amt">${amt}</td>
      </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800;900&display=swap" rel="stylesheet">
<style>
  @page { size: A4 portrait; margin: 0; }
  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    width: 794px; min-height: 1123px;
    font-family: 'Helvetica Neue', Arial, 'Noto Sans', sans-serif;
    color: #111827; background: #f9fafb;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
    text-rendering: optimizeLegibility; -webkit-font-smoothing: antialiased;
  }
  .page { width: 794px; min-height: 1123px; position: relative; overflow: hidden; background: #f9fafb; }
  .card {
    margin: 8px 10px 18px; background: #fff; border-radius: 10px;
    box-shadow: 0 2px 18px rgba(0,0,0,0.07);
    overflow: hidden; display: flex; flex-direction: column;
    position: relative;
    border: 3px solid #0a5c56;
  }
  .deco { position: absolute; top: 0; right: 0; width: 100%; height: 100%; pointer-events: none; z-index: 0; overflow: hidden; border-radius: 10px; }
  .deco .d1 { position: absolute; top: -40px; right: -30px; width: 220px; height: 220px; background: #eef9f7; border-radius: 50%; }
  .deco .d2 { position: absolute; top: 50px; right: -50px; width: 170px; height: 300px; background: #f2faf9; transform: rotate(-25deg); border-radius: 60px; }
  .deco .d3 { position: absolute; bottom: -30px; left: -40px; width: 180px; height: 180px; background: #f0faf8; border-radius: 50%; }
  .deco .d4 { position: absolute; bottom: 60px; left: 30px; width: 110px; height: 200px; background: #f4fbfa; transform: rotate(20deg); border-radius: 40px; }
  .card > *:not(.deco) { position: relative; z-index: 1; }
  .wm {
    position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%) rotate(-35deg);
    font-family: Georgia, serif; font-size: 38px; font-weight: 700;
    color: rgba(62,196,177,0.04); letter-spacing: 10px;
    white-space: nowrap; z-index: 0; pointer-events: none; text-transform: uppercase;
  }
  .header { display: flex; align-items: center; gap: 12px; padding: 12px 20px 8px; flex-shrink: 0; }
  .logo-wrap { width: 60px; height: 60px; flex-shrink: 0; border-radius: 8px; overflow: hidden; }
  .logo-wrap img { width: 60px; height: 60px; object-fit: contain; }
  .school-info { flex: 1; text-align: center; }
  .school-name {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 20px; font-weight: 800; color: #1F6F6D;
    letter-spacing: 1px; line-height: 1.15; text-transform: uppercase;
  }
  .school-addr { font-size: 9px; color: #4b5563; font-weight: 500; margin-top: 1px; }
  .aff-row { display: flex; justify-content: center; gap: 14px; margin-top: 3px; }
  .aff-line { font-size: 8px; color: #4b5563; font-weight: 500; }
  .aff-line b { font-weight: 700; color: #111827; }
  .hd { height: 1px; background: #e5e7eb; margin: 0 18px; flex-shrink: 0; }
  .title-sec { padding: 7px 18px; text-align: center; display: flex; flex-direction: column; align-items: center; flex-shrink: 0; }
  .title-badge { background: #edf9f7; border-radius: 8px; padding: 5px 20px; }
  .title-badge h1 { font-size: 11px; font-weight: 700; color: #0a5c56; letter-spacing: 3.5px; text-transform: uppercase; line-height: 1; }
  .meta { display: flex; justify-content: space-between; align-items: center; padding: 5px 18px; background: #f9fafb; border-top: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; flex-shrink: 0; }
  .meta-l { font-size: 11px; font-weight: 600; color: #111827; }
  .meta-l .hash { color: #3EC4B1; }
  .meta-r { font-size: 11px; color: #374151; font-weight: 500; }
  .meta-r b { font-weight: 700; color: #111827; }
  .info { display: flex; gap: 0; padding: 8px 16px; flex-shrink: 0; }
  .info-col { flex: 1; padding: 0 6px; }
  .info-col + .info-col { border-left: 1px solid #e5e7eb; padding-left: 14px; }
  .info-title { font-size: 8px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
  .info-row { display: flex; margin-bottom: 2px; }
  .info-lbl { width: 90px; font-size: 10px; font-weight: 500; color: #6b7280; flex-shrink: 0; }
  .info-val { font-size: 11px; font-weight: 700; color: #111827; }
  .info-val.green { color: #059669; }
  .info-val.teal { color: #0a5c56; font-weight: 800; }
  .fee-wrap { margin: 4px 14px 0; border-radius: 6px; overflow: hidden; border: 1px solid #e5e7eb; flex-shrink: 0; }
  .fee-tbl { width: 100%; border-collapse: separate; border-spacing: 0; }
  .fee-tbl thead th { font-size: 8.5px; font-weight: 700; color: #1f2937; text-transform: uppercase; letter-spacing: .4px; padding: 6px 10px; text-align: left; background: #edf9f7; border-bottom: 1px solid #e5e7eb; }
  .fee-tbl thead th:last-child { text-align: right; }
  .fee-tbl tbody td { font-size: 10.5px; font-weight: 500; color: #111827; padding: 5px 10px; border-bottom: 1px solid #e5e7eb; }
  .fee-tbl tbody td.amt { text-align: right; font-weight: 700; font-variant-numeric: tabular-nums; }
  .fee-tbl tbody tr:last-child td { border-bottom: none; }
  .amt-sec { margin: 6px 14px 0; flex-shrink: 0; }
  .amt-box { background: #edf9f7; border: 1px solid #d1fae5; border-radius: 8px; padding: 9px 14px; display: flex; align-items: center; justify-content: space-between; }
  .amt-label { font-size: 10px; font-weight: 700; color: #0a5c56; text-transform: uppercase; letter-spacing: 1.5px; }
  .amt-value { font-size: 22px; font-weight: 800; color: #059669; font-variant-numeric: tabular-nums; }
  .amt-right { display: flex; flex-direction: column; align-items: flex-end; }
  .amt-words { margin-top: 1px; font-size: 8.5px; font-style: italic; color: #0a5c56; font-weight: 600; letter-spacing: 0.3px; text-align: right; }
  .amt-words b { font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; font-style: normal; font-size: 7.5px; color: #4b5563; }
  .spacer { flex: 1; min-height: 8px; }
  .sig-sec { padding: 0 20px 4px; flex-shrink: 0; }
  .sig-row { display: flex; justify-content: space-between; align-items: flex-end; height: 70px; }
  .sig-col { text-align: center; width: 210px; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; }
  .sig-col .sig-line { width: 80px; height: 1px; background: #9ca3af; margin: 0 auto 2px; }
  .sig-col .sig-label { font-size: 8px; font-weight: 600; color: #374151; text-transform: uppercase; letter-spacing: 0.6px; }
  .sig-col .dep-name { font-size: 13px; font-weight: 700; color: #0a5c56; margin: 0 auto 4px; padding-bottom: 3px; border-bottom: 1px solid #0a5c56; min-width: 140px; text-align: center; font-family: Georgia, serif; }
  .footer { padding: 4px 18px; border-top: 1px solid #e5e7eb; text-align: center; flex-shrink: 0; }
  .footer span { font-size: 7px; color: #4b5563; font-weight: 500; text-transform: uppercase; letter-spacing: 1.2px; }
  .footer .brand { font-weight: 600; color: #0f766e; }
  .footer .gen { display: block; margin-top: 1px; font-size: 6.5px; color: #6b7280; text-transform: none; letter-spacing: 0; }
</style>
</head>
<body>
<div class="page">
<div class="card">
  <div class="deco"><div class="d1"></div><div class="d2"></div><div class="d3"></div><div class="d4"></div></div>
  <div class="wm">Consolidated Receipt</div>

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

  <div class="title-sec"><div class="title-badge"><h1>Consolidated Payment Receipt</h1></div></div>

  <div class="meta">
    <div class="meta-l"><span class="hash">#</span> ${groupReceiptNumber}</div>
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
      <div class="info-row"><span class="info-lbl">Mode</span><span class="info-val">${paymentMethod}</span></div>
      <div class="info-row"><span class="info-lbl">Invoices Paid</span><span class="info-val teal">${payments.length}</span></div>
      <div class="info-row"><span class="info-lbl">Initiated By</span><span class="info-val">${initiatedByLabel}</span></div>
    </div>
  </div>

  <div class="fee-wrap">
    <table class="fee-tbl">
      <thead><tr><th>Period / Description</th><th>Invoice #</th><th>Receipt #</th><th>Amount (&#8377;)</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  </div>

  <div class="amt-sec">
    <div class="amt-box">
      <span class="amt-label">Total Amount Paid</span>
      <div class="amt-right">
        <span class="amt-value">&#8377; ${totalFormatted}</span>
        <div class="amt-words"><b>In Words:</b> ${amountInWords}</div>
      </div>
    </div>
  </div>

  <div class="spacer"></div>

  <div class="sig-sec">
    <div class="sig-row">
      <div class="sig-col">
        ${depositorName ? `<div class="dep-name">${depositorName}</div>` : '<div class="sig-line"></div>'}
        <div class="sig-label">Depositor Name</div>
      </div>
      <div class="sig-col">
        <div class="sig-line"></div>
        <div class="sig-label">Cashier</div>
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

async function generateConsolidatedReceiptPdf(payments, schoolData) {
  if (!Array.isArray(payments) || payments.length === 0) {
    throw new Error('No payments supplied for consolidated receipt');
  }
  const logoDataUri = await toBase64DataUri(schoolData.logo);
  const html = buildConsolidatedReceiptHtml(payments, schoolData, logoDataUri);
  const { getBrowser, releaseBrowser } = pdfService._internal;
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 3 });
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 15000 });
    await page.evaluateHandle('document.fonts.ready');
    const pdfUint8 = await page.pdf({
      format: 'A4',
      printBackground: true, preferCSSPageSize: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 }
    });
    return Buffer.from(pdfUint8);
  } finally {
    await page.close();
    releaseBrowser();
  }
}

module.exports = { generateReceiptPdf, generateReceiptHtml, generateConsolidatedReceiptPdf };
