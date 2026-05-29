import { SERVER_URL } from '../constants/config'
import jsPDF from 'jspdf'
import { highQualityPrint } from './highQualityPrint'

function getLogoUrl(url) {
  if (!url) return null
  const fullUrl = url.startsWith('http') ? url : `${SERVER_URL}${url}`
  return encodeURI(fullUrl)
}

/**
 * Fetch an image URL and return a base64 data-URI.
 */
async function toBase64DataUrl(url) {
  if (!url) return null
  try {
    const fullUrl = url.startsWith('http') ? url : `${SERVER_URL}${url}`
    const resp = await fetch(fullUrl, { mode: 'cors' })
    if (!resp.ok) return null
    const blob = await resp.blob()
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

function normalizeSchool(raw) {
  if (!raw) return {}
  const inst = raw.institution || {}
  const contact = inst.contact || {}
  const addr = inst.address || raw.address || {}
  return {
    schoolName: raw.schoolName || inst.name || '',
    phone: raw.phone || contact.phone || '',
    email: raw.email || contact.email || '',
    logo: raw.logo || inst.logo || '',
    principalSignature: raw.principalSignature || inst.principalSignature || '',
    schoolCode: raw.schoolCode || inst.schoolCode || '',
    udiseCode: raw.udiseCode || inst.udiseCode || '',
    fullAddress: raw.fullAddress || [addr.street, addr.city, addr.state, addr.pincode].filter(Boolean).join(', ') || ''
  }
}

function normalizePayment(raw) {
  if (!raw) return {}
  const attempt = raw.paymentAttemptId || {}
  const paymentMode = raw.paymentMode || attempt.paymentMode || raw.paymentMethod || attempt.paymentMethod || '-'
  const txnRef = raw.transactionRefId || attempt.transactionRefId || raw.transactionDetails?.referenceNumber || attempt.transactionDetails?.referenceNumber || null
  return {
    receiptNumber: raw.receiptNumber || '',
    amount: raw.amount ?? attempt.amount ?? 0,
    paymentDate: raw.paymentDate || attempt.paymentDate || raw.issuedAt || raw.createdAt || '',
    paymentMethod: paymentMode,
    transactionDetails: raw.transactionDetails || attempt.transactionDetails || {},
    transactionRefId: txnRef,
    invoiceId: raw.invoiceId || {},
    studentId: raw.studentId || {},
    initiatedBy: raw.initiatedBy || (attempt.triggerSource === 'ADMIN_MANUAL' ? 'admin' : 'student'),
    verifiedByName: raw.verifiedByName || (raw.verifiedByUserId?.name || raw.verifiedByUserId?.fullName || null),
  }
}

function getGeneratedTimestamp() {
  const now = new Date()
  return now.toLocaleString('en-IN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  })
}

/* ═══════════════════════════════════════════════════════════════
   buildReceiptFullHtml — single function that returns a complete
   standalone HTML page matching the Leaving / Bonafide certificate
   design (A5 half-page, white card on gray, green teal branding,
   Playfair Display headings, decorative shapes, numbered table).
   ═══════════════════════════════════════════════════════════════ */

export function buildReceiptHtml(rawPayment, rawSchool, opts = {}) {
  const school = normalizeSchool(rawSchool)
  const payment = normalizePayment(rawPayment)
  const logoSrc = opts.logoDataUrl || getLogoUrl(school.logo)
  const signatureSrc = opts.signatureDataUrl || getLogoUrl(school.principalSignature)

  const studentName = payment.studentId?.name || payment.studentId?.fullName || 'N/A'
  const studentAdmNo = payment.studentId?.admissionNumber || payment.studentId?.studentId || '-'
  const studentClass = (payment.studentId?.classId?.name || payment.studentId?.class || '-')
    + (payment.studentId?.section ? ` (${payment.studentId.section})` : '')
  const paymentDate = payment.paymentDate ? new Date(payment.paymentDate).toLocaleDateString('en-IN') : '-'
  const amountFormatted = typeof payment.amount === 'number' ? payment.amount.toLocaleString('en-IN') : '0'
  const generatedOn = getGeneratedTimestamp()
  const invoiceItems = payment.invoiceId?.items || []
  const billingPeriod = payment.invoiceId?.billingPeriod?.displayText || payment.invoiceId?.periodLabel || ''
  const initiatedByLabel = payment.initiatedBy === 'admin' ? 'Admin' : 'Student'
  const invoiceStatus = payment.invoiceId?.status || 'Paid'
  const invoiceBalance = payment.invoiceId?.balanceAmount ?? 0
  const isPartial = invoiceBalance > 0 && invoiceStatus !== 'Paid'

  const feeRowsHtml = invoiceItems.map((item, i) => `
    <tr style="background:${i % 2 === 0 ? '#f0fdfa' : '#fff'}">
      <td>${item.feeHeadName || '-'}</td>
      <td class="amt">${(item.netAmount || item.periodAmount || item.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
    </tr>`).join('')

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
    font-family: 'Helvetica Neue', 'Arial', 'Noto Sans', sans-serif;
    color: #111827; background: #fff;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
    text-rendering: optimizeLegibility; -webkit-font-smoothing: antialiased;
  }

  .page { width: 100%; max-width: 794px; margin: 0 auto; background: #fff; padding: 24px; }

  .card {
    background: #ffffff; border-radius: 6px; border: 1px solid #d1d5db;
    overflow: hidden; display: flex; flex-direction: column; position: relative;
  }

  /* ═══ DECORATIVE SHAPES ═══ */
  .deco-shapes { position: absolute; top: 0; right: 0; width: 100%; height: 100%; pointer-events: none; z-index: 0; overflow: hidden; border-radius: 6px; }
  .deco-shapes .s1 { position: absolute; top: -30px; right: -20px; width: 160px; height: 160px; background: #eef9f7; border-radius: 50%; }
  .deco-shapes .s2 { position: absolute; top: 40px; right: -40px; width: 120px; height: 220px; background: #f2faf9; transform: rotate(-25deg); border-radius: 40px; }
  .deco-shapes .s3 { position: absolute; bottom: -20px; left: -25px; width: 120px; height: 120px; background: #f0faf8; border-radius: 50%; }
  .card > *:not(.deco-shapes) { position: relative; z-index: 1; }

  /* ═══ WATERMARK ═══ */
  .watermark { position: absolute; top: 45%; left: 50%; transform: translate(-50%,-50%) rotate(-35deg); font-family: Georgia, serif; font-size: 36px; font-weight: 700; color: rgba(62,196,177,0.04); letter-spacing: 8px; white-space: nowrap; z-index: 0; pointer-events: none; text-transform: uppercase; }

  /* ═══ HEADER ═══ */
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

  /* ═══ TITLE BADGE ═══ */
  .title-section { padding: 8px 16px; text-align: center; display: flex; flex-direction: column; align-items: center; flex-shrink: 0; }
  .title-badge { background: #edf9f7; border-radius: 7px; padding: 6px 22px; }
  .title-badge h1 { font-size: 12px; font-weight: 700; color: #0a5c56; letter-spacing: 3.5px; text-transform: uppercase; line-height: 1; }

  /* ═══ META ROW ═══ */
  .meta-row { display: flex; justify-content: space-between; align-items: center; padding: 5px 16px; background: #f9fafb; border-top: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; flex-shrink: 0; }
  .meta-left { font-size: 11px; font-weight: 600; color: #111827; }
  .meta-left .hash { color: #3EC4B1; }
  .meta-right { font-size: 11px; color: #374151; font-weight: 500; }
  .meta-right b { font-weight: 700; color: #111827; }

  /* ═══ TWO-COLUMN INFO ═══ */
  .info-grid { display: flex; gap: 0; padding: 10px 14px; flex-shrink: 0; }
  .info-col { flex: 1; padding: 0 4px; }
  .info-col + .info-col { border-left: 1px solid #e5e7eb; padding-left: 12px; }
  .info-col-title { font-size: 9px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px; }
  .info-row { display: flex; margin-bottom: 3px; }
  .info-label { width: 65px; font-size: 10px; font-weight: 500; color: #6b7280; flex-shrink: 0; }
  .info-value { font-size: 11px; font-weight: 700; color: #111827; }
  .info-value.green { color: #059669; }
  .info-value.teal { color: #0a5c56; font-weight: 800; }

  /* ═══ FEE BREAKDOWN ═══ */
  .fee-wrap { margin: 5px 12px 0; border-radius: 6px; overflow: hidden; border: 1px solid #e5e7eb; flex-shrink: 0; }
  .fee-tbl { width: 100%; border-collapse: separate; border-spacing: 0; }
  .fee-tbl thead th { font-size: 8.5px; font-weight: 700; color: #1f2937; text-transform: uppercase; letter-spacing: .4px; padding: 4px 8px; text-align: left; background: #edf9f7; border-bottom: 1px solid #e5e7eb; }
  .fee-tbl thead th:last-child { text-align: right; }
  .fee-tbl tbody td { font-size: 11px; font-weight: 500; color: #111827; padding: 4px 8px; border-bottom: 1px solid #e5e7eb; }
  .fee-tbl tbody td.amt { text-align: right; font-weight: 700; font-variant-numeric: tabular-nums; }
  .fee-tbl tbody tr:last-child td { border-bottom: none; }

  /* ═══ AMOUNT BOX ═══ */
  .amount-section { margin: 6px 12px 0; flex-shrink: 0; }
  .amount-box { background: #edf9f7; border: 1px solid #d1fae5; border-radius: 7px; padding: 8px 14px; display: flex; align-items: center; justify-content: space-between; }
  .amt-label { font-size: 10px; font-weight: 700; color: #0a5c56; text-transform: uppercase; letter-spacing: 1.5px; }
  .amt-value { font-size: 22px; font-weight: 800; color: #059669; font-variant-numeric: tabular-nums; }

  /* ═══ BALANCE BOX ═══ */
  .balance-section { margin: 5px 12px 0; flex-shrink: 0; }
  .balance-box { background: #fffbeb; border: 1px solid #fde68a; border-radius: 7px; padding: 5px 14px; display: flex; align-items: center; justify-content: space-between; }
  .bal-label { font-size: 8.5px; font-weight: 700; color: #92400e; text-transform: uppercase; letter-spacing: 1px; }
  .bal-value { font-size: 15px; font-weight: 800; color: #b45309; }

  /* ═══ SIGNATURES ═══ */
  .sig-section { padding: 0 18px; flex-shrink: 0; margin-top: 10px; }
  .sig-row { display: flex; justify-content: space-between; align-items: flex-end; height: 110px; }
  .sig-col { text-align: center; width: 210px; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; }
  .sig-img { max-height: 100px; max-width: 200px; margin: 0 auto 4px; object-fit: contain; display: block; }
  .sig-col .sig-line { width: 75px; height: 1px; background: #9ca3af; margin: 0 auto 3px; }
  .sig-col .sig-label { font-size: 8.5px; font-weight: 600; color: #374151; text-transform: uppercase; letter-spacing: 0.5px; }
  .sig-sub { font-size: 7px; color: #6b7280; margin-top: 1px; }

  /* ═══ FOOTER ═══ */
  .footer { padding: 5px 16px; border-top: 1px solid #e5e7eb; text-align: center; flex-shrink: 0; margin-top: 6px; }
  .footer span { font-size: 7.5px; color: #4b5563; font-weight: 500; text-transform: uppercase; letter-spacing: 1px; }
  .footer .brand { font-weight: 600; color: #0f766e; }
  .footer .gen { display: block; margin-top: 1px; font-size: 7px; color: #6b7280; text-transform: none; letter-spacing: 0; }

  /* ═══ TOOLBAR (screen only) ═══ */
  .toolbar { position: fixed; top: 0; left: 0; right: 0; background: #1C1C1E; color: #fff; padding: 10px 24px; display: flex; gap: 10px; align-items: center; z-index: 999; }
  .toolbar-title { flex: 1; font-size: 13px; font-weight: 500; }
  .tbtn { padding: 7px 18px; border: none; border-radius: 8px; cursor: pointer; font-size: 12px; font-weight: 600; transition: opacity .15s; }
  .tbtn:hover { opacity: .85; }
  .tbtn-print { background: #1F6F6D; color: white; }
  .tbtn-close { background: #38383A; color: #8E8E93; }
  .page-body { padding-top: 54px; }

  @media print {
    .toolbar { display: none !important; }
    .page-body { padding-top: 0 !important; }
    html, body { width: 210mm; height: 297mm; }
    .page { width: 210mm; max-width: 210mm; padding: 7mm; }
  }
</style>
</head>
<body>
  <div class="toolbar">
    <span class="toolbar-title">Receipt #${payment.receiptNumber}</span>
    <button class="tbtn tbtn-print" onclick="window.print()">Print</button>
    <button class="tbtn tbtn-close" onclick="window.close()">Close</button>
  </div>
  <div class="page-body">
    <div class="page">
      <div class="card">

        <div class="deco-shapes"><div class="s1"></div><div class="s2"></div><div class="s3"></div></div>
        <div class="watermark">Payment Receipt</div>

        <!-- Header -->
        <div class="header">
          ${logoSrc ? `<div class="logo-wrap"><img src="${logoSrc}" alt="Logo" crossorigin="anonymous"></div>` : ''}
          <div class="school-info">
            <div class="school-name">${school.schoolName || 'School Name'}</div>
            ${school.fullAddress ? `<div class="school-addr">${school.fullAddress}</div>` : ''}
            ${(school.phone || school.email) ? `<div class="school-addr">Phone: ${school.phone || '-'} &nbsp;|&nbsp; Email: ${school.email || '-'}</div>` : ''}
            ${(school.schoolCode || school.udiseCode) ? `
            <div class="aff-row">
              ${school.schoolCode ? `<span class="aff-line">School Code: <b>${school.schoolCode}</b></span>` : ''}
              ${school.udiseCode ? `<span class="aff-line">UDISE: <b>${school.udiseCode}</b></span>` : ''}
            </div>` : ''}
          </div>
        </div>

        <div class="header-divider"></div>

        <!-- Title badge -->
        <div class="title-section">
          <div class="title-badge"><h1>Payment Receipt</h1></div>
        </div>

        <!-- Meta row -->
        <div class="meta-row">
          <div class="meta-left"><span class="hash">#</span> ${payment.receiptNumber || '-'}</div>
          <div class="meta-right">Date: <b>${paymentDate}</b></div>
        </div>

        <!-- Two-Column Info -->
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

        <!-- Fee breakdown -->
        ${invoiceItems.length > 0 ? `
        <div class="fee-wrap">
          <table class="fee-tbl">
            <thead><tr><th>Description</th><th>Amount (&#8377;)</th></tr></thead>
            <tbody>${feeRowsHtml}</tbody>
          </table>
        </div>` : ''}

        <!-- Total amount -->
        <div class="amount-section">
          <div class="amount-box">
            <span class="amt-label">Total Amount Paid</span>
            <span class="amt-value">Rs. ${amountFormatted}</span>
          </div>
        </div>

        ${isPartial ? `
        <!-- Remaining balance -->
        <div class="balance-section">
          <div class="balance-box">
            <span class="bal-label">Remaining Balance${billingPeriod ? ` — ${billingPeriod}` : ''}</span>
            <span class="bal-value">&#8377; ${invoiceBalance.toLocaleString('en-IN')}</span>
          </div>
        </div>` : ''}

        <!-- Signatures -->
        <div class="sig-section">
          <div class="sig-row">
            <div class="sig-col">
              <div class="sig-line"></div>
              <div class="sig-label">Depositor</div>
            </div>
            <div class="sig-col">
              ${signatureSrc ? `<img class="sig-img" src="${signatureSrc}" alt="Principal Signature" crossorigin="anonymous">` : ''}
              <div class="sig-line"></div>
              <div class="sig-label">Principal</div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="footer">
          <span>Powered by <span class="brand">Learnovo</span> &mdash; School Management System</span>
          <span class="gen">Generated: ${generatedOn}</span>
        </div>

      </div>
    </div>
  </div>
</body>
</html>`
}

/**
 * High-quality print for fee receipts — renders to hidden DOM, captures as PDF.
 */
export async function printReceiptHighQuality(rawPayment, rawSchool, opts = {}) {
  const html = buildReceiptHtml(rawPayment, rawSchool, opts)
  const container = document.createElement('div')
  container.style.cssText = 'position:fixed;left:-9999px;top:0;width:720px;background:#fff;z-index:-1;'
  container.innerHTML = html.replace(/<html[\s\S]*?<body[^>]*>/, '').replace(/<\/body[\s\S]*$/, '')
  document.body.appendChild(container)
  await new Promise(r => setTimeout(r, 400))
  try {
    const target = container.querySelector('.page')
    const payment = normalizePayment(rawPayment)
    await highQualityPrint(target, `Receipt-${payment.receiptNumber || 'Fee-Receipt'}`, {
      scale: 3, format: 'a4', orientation: 'portrait', margin: 4,
    })
  } finally { document.body.removeChild(container) }
}


/* ═══════════════════════════════════════════════════════════
   PDF DOWNLOAD — renders same HTML template via html2canvas
   ═══════════════════════════════════════════════════════════ */

export async function downloadReceiptAsPdf(rawPayment, rawSchool) {
  const payment = normalizePayment(rawPayment)
  const [logoDataUrl, signatureDataUrl] = await Promise.all([
    toBase64DataUrl(normalizeSchool(rawSchool).logo),
    toBase64DataUrl(normalizeSchool(rawSchool).principalSignature)
  ])
  const html = buildReceiptHtml(rawPayment, rawSchool, { logoDataUrl, signatureDataUrl })

  // Render in hidden container — 720px matches 190mm at 96dpi
  const container = document.createElement('div')
  container.style.cssText = 'position:fixed;left:-9999px;top:0;width:720px;background:#fff;z-index:-1;'
  // Strip <html>/<head>/<body> tags, inject just the inner content
  container.innerHTML = html.replace(/<html[\s\S]*?<body[^>]*>/, '').replace(/<\/body[\s\S]*$/, '')
  // Also inject the styles from the <style> tag
  const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/)
  if (styleMatch) {
    const styleEl = document.createElement('style')
    styleEl.textContent = styleMatch[1]
    container.prepend(styleEl)
  }
  // Remove toolbar from the container
  const toolbar = container.querySelector('.toolbar')
  if (toolbar) toolbar.remove()
  document.body.appendChild(container)

  await new Promise(r => setTimeout(r, 500))

  try {
    const target = container.querySelector('.page')
    await highQualityPrint(target, `Receipt-${payment.receiptNumber || 'receipt'}`, {
      scale: 3, format: 'a4', orientation: 'portrait', margin: 4,
    })
  } finally {
    document.body.removeChild(container)
  }
}

/* ── dead code below — kept to avoid import errors if referenced elsewhere ── */
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
  greenAccent: '#059669',
  blue: '#2563eb',
  amber: '#b45309',
  amberBg: '#fffbeb',
  amberBorder: '#fde68a',
  white: '#ffffff',
  logoBg: '#dcfce7',
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return [r, g, b]
}

// Old vector jsPDF download — no longer used, kept to prevent dead reference errors
async function _oldDownloadReceiptAsPdf_UNUSED(rawPayment, rawSchool) {
  const school = normalizeSchool(rawSchool)
  const payment = normalizePayment(rawPayment)

  const [logoDataUrl, signatureDataUrl] = await Promise.all([
    toBase64DataUrl(school.logo),
    toBase64DataUrl(school.principalSignature)
  ])

  const student = payment.studentId || {}
  const studentName = student.name || student.fullName || 'N/A'
  const admNo = student.admissionNumber || student.studentId || '-'
  const cls = (student.classId?.name || student.class || '-') + (student.section ? ` (${student.section})` : '')
  const invoiceItems = payment.invoiceId?.items || []
  const schoolName = (school.schoolName || 'School').toUpperCase()
  const payDate = payment.paymentDate ? new Date(payment.paymentDate).toLocaleDateString('en-IN') : '-'
  const amtStr = `Rs. ${(payment.amount || 0).toLocaleString('en-IN')}`
  const generatedOn = getGeneratedTimestamp()
  const billingPeriod = payment.invoiceId?.billingPeriod?.displayText || payment.invoiceId?.periodLabel || ''
  const initiatedByLabel = payment.initiatedBy === 'admin' ? 'Admin' : 'Student'
  const invoiceBalance = payment.invoiceId?.balanceAmount ?? 0
  const invoiceStatus = payment.invoiceId?.status || 'Paid'
  const isPartial = invoiceBalance > 0 && invoiceStatus !== 'Paid'

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const L = 12
  const R = 198      // A4 width 210mm - 12mm margin
  const W = R - L
  let Y = 8

  const setColor = (hex) => { const [r, g, b] = hexToRgb(hex); pdf.setTextColor(r, g, b) }
  const setDrawCol = (hex) => { const [r, g, b] = hexToRgb(hex); pdf.setDrawColor(r, g, b) }
  const setFillCol = (hex) => { const [r, g, b] = hexToRgb(hex); pdf.setFillColor(r, g, b) }
  const hLine = (x1, y, x2, color = C.border, w = 0.3) => {
    setDrawCol(color); pdf.setLineWidth(w); pdf.line(x1, y, x2, y)
  }
  const roundRect = (x, y, w, h, r, fill, stroke) => {
    if (fill) { setFillCol(fill); pdf.roundedRect(x, y, w, h, r, r, 'F') }
    if (stroke) { setDrawCol(stroke); pdf.setLineWidth(0.4); pdf.roundedRect(x, y, w, h, r, r, 'S') }
  }

  // ── HEADER ──
  const logoSize = 12
  if (logoDataUrl) {
    try {
      roundRect(L, Y, logoSize, logoSize, 2, C.logoBg)
      pdf.addImage(logoDataUrl, 'PNG', L + 1, Y + 1, logoSize - 2, logoSize - 2)
    } catch {
      roundRect(L, Y, logoSize, logoSize, 2, C.logoBg)
      pdf.setFontSize(8); pdf.setFont('helvetica', 'bold'); setColor(C.green)
      const initials = schoolName.split(' ').filter(w => w.length > 1).map(w => w[0]).join('').slice(0, 2)
      pdf.text(initials, L + logoSize / 2, Y + logoSize / 2 + 1.5, { align: 'center' })
    }
  } else {
    roundRect(L, Y, logoSize, logoSize, 2, C.logoBg)
    pdf.setFontSize(8); pdf.setFont('helvetica', 'bold'); setColor(C.green)
    const initials = schoolName.split(' ').filter(w => w.length > 1).map(w => w[0]).join('').slice(0, 2)
    pdf.text(initials, L + logoSize / 2, Y + logoSize / 2 + 1.5, { align: 'center' })
  }

  const infoX = L + logoSize + 4
  pdf.setFontSize(10); pdf.setFont('helvetica', 'bold'); setColor(C.black)
  pdf.text(schoolName, infoX, Y + 3.5)

  pdf.setFontSize(6); pdf.setFont('helvetica', 'normal'); setColor(C.label)
  let infoY = Y + 6.5
  if (school.fullAddress) { pdf.text(school.fullAddress, infoX, infoY); infoY += 2.5 }
  pdf.text(`${school.phone || '-'}  ·  ${school.email || '-'}`, infoX, infoY); infoY += 2.5

  if (school.schoolCode || school.udiseCode) {
    let tagX = infoX
    pdf.setFontSize(6); pdf.setFont('helvetica', 'bold'); setColor(C.greenDark)
    if (school.schoolCode) {
      const txt = `Code: ${school.schoolCode}`
      const tw = pdf.getTextWidth(txt) + 4
      roundRect(tagX, infoY - 2.5, tw, 4, 1, C.greenBg)
      pdf.text(txt, tagX + 2, infoY); tagX += tw + 2
    }
    if (school.udiseCode) {
      const txt = `UDISE: ${school.udiseCode}`
      const tw = pdf.getTextWidth(txt) + 4
      roundRect(tagX, infoY - 2.5, tw, 4, 1, C.greenBg)
      pdf.text(txt, tagX + 2, infoY)
    }
  }

  Y = Math.max(Y + logoSize, infoY + 2) + 3
  hLine(L, Y, R, C.green, 0.6)
  Y += 4

  // ── RECEIPT BADGE ──
  const badgeH = 7
  roundRect(L, Y, W, badgeH, 2, C.greenBg)
  setFillCol(C.green); pdf.rect(L, Y, 1.2, badgeH, 'F')

  pdf.setFontSize(7); pdf.setFont('helvetica', 'bold'); setColor(C.greenDark)
  pdf.text('PAYMENT RECEIPT', L + 5, Y + 4.5)
  pdf.setFontSize(6.5); pdf.setFont('helvetica', 'normal'); setColor(C.textDark)
  pdf.text(`#${payment.receiptNumber || ''}`, R - 3, Y + 4.5, { align: 'right' })

  Y += badgeH + 4

  // ── TWO-COLUMN INFO GRID ──
  const colGap = 6
  const colW = (W - colGap) / 2
  const col1X = L
  const col2X = L + colW + colGap
  const labelW = 18

  pdf.setFontSize(6); pdf.setFont('helvetica', 'bold'); setColor(C.label)
  pdf.text('STUDENT', col1X, Y); pdf.text('PAYMENT', col2X, Y)
  Y += 1.5
  hLine(col1X, Y, col1X + colW); hLine(col2X, Y, col2X + colW)
  Y += 3.5

  const drawRow = (x, y, label, value, valColor = C.text) => {
    pdf.setFontSize(6); pdf.setFont('helvetica', 'normal'); setColor(C.label)
    pdf.text(label, x, y)
    pdf.setFontSize(7); pdf.setFont('helvetica', 'bold'); setColor(valColor)
    pdf.text(value || '-', x + labelW, y)
  }

  let sY = Y
  drawRow(col1X, sY, 'Name', studentName); sY += 4
  drawRow(col1X, sY, 'Adm. No.', admNo); sY += 4
  drawRow(col1X, sY, 'Class', cls); sY += 4

  let pY = Y
  drawRow(col2X, pY, 'Date', payDate); pY += 4
  drawRow(col2X, pY, 'Mode', payment.paymentMethod || '-'); pY += 4
  if (billingPeriod) {
    drawRow(col2X, pY, 'Period', billingPeriod, C.blue); pY += 4
  }
  drawRow(col2X, pY, 'Initiated By', initiatedByLabel); pY += 4
  drawRow(col2X, pY, 'Status', isPartial ? 'Partial' : 'Paid', C.green); pY += 4

  Y = Math.max(sY, pY) + 2

  // ── FEE BREAKDOWN TABLE ──
  if (invoiceItems.length > 0) {
    pdf.setFontSize(6); pdf.setFont('helvetica', 'bold'); setColor(C.label)
    pdf.text('DESCRIPTION', L, Y)
    pdf.text('AMOUNT (\u20B9)', R, Y, { align: 'right' })
    Y += 1.5
    hLine(L, Y, R, C.border, 0.3)
    Y += 3

    for (const item of invoiceItems) {
      pdf.setFontSize(7); pdf.setFont('helvetica', 'normal'); setColor(C.textDark)
      pdf.text(item.feeHeadName || '', L, Y)
      pdf.setFont('helvetica', 'bold'); setColor(C.text)
      pdf.text((item.netAmount || item.periodAmount || item.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }), R, Y, { align: 'right' })
      Y += 3.5
      hLine(L, Y, R, C.borderLight, 0.2)
      Y += 1.5
    }
    Y += 2
  }

  // ── TOTAL AMOUNT BOX ──
  const amtBoxH = 11
  roundRect(L, Y, W, amtBoxH, 2, C.greenBg, C.greenBorder)

  pdf.setFontSize(6); pdf.setFont('helvetica', 'bold'); setColor(C.greenDark)
  pdf.text('TOTAL AMOUNT PAID', L + 4, Y + 7)

  pdf.setFontSize(14); pdf.setFont('helvetica', 'bold'); setColor(C.green)
  pdf.text(amtStr, R - 4, Y + 7.5, { align: 'right' })

  Y += amtBoxH + 3

  // ── REMAINING BALANCE (partial payments) ──
  if (isPartial) {
    const balBoxH = 8
    roundRect(L, Y, W, balBoxH, 2, C.amberBg, C.amberBorder)
    pdf.setFontSize(5.5); pdf.setFont('helvetica', 'bold'); setColor(C.amber)
    const balLabel = `REMAINING BALANCE${billingPeriod ? ` — ${billingPeriod}` : ''}`
    pdf.text(balLabel, L + 4, Y + 5)
    pdf.setFontSize(10); pdf.setFont('helvetica', 'bold'); setColor(C.amber)
    pdf.text(`\u20B9 ${invoiceBalance.toLocaleString('en-IN')}`, R - 4, Y + 5.5, { align: 'right' })
    Y += balBoxH + 3
  } else {
    Y += 3
  }

  // ── SIGNATURES ──
  const sigLineW = 32
  const sig1X = L + 6
  const sig2X = R - sigLineW - 6

  if (signatureDataUrl) {
    try { pdf.addImage(signatureDataUrl, 'PNG', sig2X + 2, Y - 2, 28, 10) } catch { /* skip */ }
  }

  const sigLineY = Y + 10
  hLine(sig1X, sigLineY, sig1X + sigLineW, '#d1d5db', 0.3)
  hLine(sig2X, sigLineY, sig2X + sigLineW, '#d1d5db', 0.3)

  pdf.setFontSize(5.5); pdf.setFont('helvetica', 'normal'); setColor(C.label)
  pdf.text('Depositor', sig1X + sigLineW / 2, sigLineY + 3, { align: 'center' })
  pdf.text('Principal', sig2X + sigLineW / 2, sigLineY + 3, { align: 'center' })

  Y = sigLineY + 6

  // ── FOOTER ──
  hLine(L, Y, R)
  pdf.setFontSize(5); pdf.setFont('helvetica', 'normal'); setColor(C.muted)
  pdf.text('Computer-generated receipt. Valid without physical signature.  ·  Powered by Learnovo', (L + R) / 2, Y + 3, { align: 'center' })
  pdf.text(`Generated on ${generatedOn}`, (L + R) / 2, Y + 6, { align: 'center' })

  pdf.save(`Receipt-${payment.receiptNumber || 'receipt'}.pdf`)
}
