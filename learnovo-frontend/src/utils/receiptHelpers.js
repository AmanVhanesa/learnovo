import { SERVER_URL } from '../constants/config'
import jsPDF from 'jspdf'

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

/* ═══════════════════════════════════════════════════════════
   HTML PREVIEW — used for in-browser view & browser print
   ═══════════════════════════════════════════════════════════ */

function buildReceiptBlock(payment, school, logoSrc, signatureSrc) {
  const studentName = payment.studentId?.name || payment.studentId?.fullName || 'N/A'
  const studentAdmNo = payment.studentId?.admissionNumber || payment.studentId?.studentId || '-'
  const studentClass = payment.studentId?.classId?.name || payment.studentId?.class || '-'
  const studentSection = payment.studentId?.section || ''
  const parentName = payment.studentId?.parentName || ''
  const invoiceItems = payment.invoiceId?.items || []
  const feeBreakdownRows = invoiceItems.map(item =>
    `<tr><td>${item.feeHeadName}</td><td>${(item.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td></tr>`
  ).join('')
  const paymentDate = payment.paymentDate ? new Date(payment.paymentDate).toLocaleDateString('en-IN') : '-'
  const amountFormatted = typeof payment.amount === 'number' ? payment.amount.toLocaleString('en-IN') : '0'
  const initials = (school.schoolName || 'S').split(' ').filter(w => w.length > 1).map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const generatedOn = getGeneratedTimestamp()

  return `
      <div class="header">
        <div class="logo-box">
          ${logoSrc ? `<img src="${logoSrc}" alt="Logo" crossorigin="anonymous">` : `<span class="logo-initials">${initials}</span>`}
        </div>
        <div class="school-info">
          <div class="school-name">${school.schoolName}</div>
          ${school.fullAddress ? `<div class="school-address">${school.fullAddress}</div>` : ''}
          <div class="school-contact">${school.phone || '-'} &middot; ${school.email || '-'}</div>
          <div class="school-codes">
            ${school.schoolCode ? `<span class="school-code-tag">Code: ${school.schoolCode}</span>` : ''}
            ${school.udiseCode ? `<span class="school-code-tag">UDISE: ${school.udiseCode}</span>` : ''}
          </div>
        </div>
      </div>
      <div class="receipt-badge">
        <span class="badge-title">Payment Receipt</span>
        <span class="badge-number">#${payment.receiptNumber}</span>
      </div>
      <div class="grid-wrapper">
        <div class="grid">
          <div>
            <div class="col-title">Student</div>
            <div class="row"><span class="lbl">Name</span><span class="val">${studentName}</span></div>
            <div class="row"><span class="lbl">Adm. No.</span><span class="val">${studentAdmNo}</span></div>
            <div class="row"><span class="lbl">Class</span><span class="val">${studentClass}${studentSection ? ` (${studentSection})` : ''}</span></div>
            ${parentName ? `<div class="row"><span class="lbl">Parent</span><span class="val">${parentName}</span></div>` : ''}
          </div>
          <div>
            <div class="col-title">Payment</div>
            <div class="row"><span class="lbl">Date</span><span class="val">${paymentDate}</span></div>
            <div class="row"><span class="lbl">Mode</span><span class="val">${payment.paymentMethod}</span></div>
            ${payment.transactionRefId ? `<div class="row"><span class="lbl">Ref. No.</span><span class="val">${payment.transactionRefId}</span></div>` : (payment.initiatedBy === 'admin' ? `<div class="row"><span class="lbl">Ref. No.</span><span class="val">Recorded by Admin</span></div>` : '')}
            ${payment.invoiceId?.billingPeriod?.displayText ? `<div class="row"><span class="lbl">Period</span><span class="val accent">${payment.invoiceId.billingPeriod.displayText}</span></div>` : ''}
            <div class="row"><span class="lbl">Initiated By</span><span class="val">${payment.initiatedBy === 'admin' ? `Admin: ${payment.verifiedByName || 'Admin'}` : 'Student'}</span></div>
            ${payment.verifiedByName ? `<div class="row"><span class="lbl">Verified By</span><span class="val">${payment.verifiedByName}</span></div>` : ''}
            <div class="row"><span class="lbl">Status</span><span class="val status">Paid</span></div>
          </div>
        </div>
      </div>
      ${invoiceItems.length > 0 ? `
      <div class="table-wrapper">
        <table class="fee-tbl">
          <thead><tr><th>Description</th><th>Amount (&#8377;)</th></tr></thead>
          <tbody>${feeBreakdownRows}</tbody>
        </table>
      </div>` : ''}
      <div class="amount-wrapper">
        <div class="amount-box">
          <span class="amt-label">Total Amount Paid</span>
          <span class="amt-value"><span class="rs">&#8377;</span>${amountFormatted}</span>
        </div>
      </div>
      <div class="sigs-wrapper">
        <div class="sigs">
          <div class="sig-block"><div class="sig-empty"></div><div class="sig-line"></div><div class="sig-text">Depositor</div></div>
          <div class="sig-block">
            ${signatureSrc ? `<div class="sig-img"><img src="${signatureSrc}" alt="Signature" crossorigin="anonymous"></div>` : '<div class="sig-empty"></div>'}
            <div class="sig-line"></div><div class="sig-text">Authorized Signatory</div>
          </div>
        </div>
      </div>
      <div class="footer">
        Computer-generated receipt. Valid without physical signature. &middot; Powered by <span class="brand">Learnovo</span>
        <div class="generated-on">Generated on ${generatedOn}</div>
      </div>`
}

const RECEIPT_STYLES = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'DM Sans', system-ui, -apple-system, sans-serif; padding: 0; margin: 0; color: #334155; -webkit-print-color-adjust: exact; print-color-adjust: exact; -webkit-font-smoothing: antialiased; }
    .header { display: flex; align-items: center; gap: 14px; padding: 14px 24px 12px; border-bottom: 1.5px solid #e5e7eb; }
    .logo-box { width: 50px; height: 50px; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #eff6ff, #dbeafe); border-radius: 12px; flex-shrink: 0; overflow: hidden; }
    .logo-box img { width: 100%; height: 100%; object-fit: contain; }
    .logo-initials { font-size: 20px; font-weight: 700; color: #2563eb; letter-spacing: 1px; }
    .school-info { flex: 1; min-width: 0; }
    .school-name { font-size: 15px; font-weight: 700; color: #0f172a; text-transform: uppercase; margin-bottom: 2px; letter-spacing: .3px; line-height: 1.2; }
    .school-address { font-size: 7.5px; color: #475569; line-height: 1.5; font-weight: 500; margin-bottom: 1px; }
    .school-contact { font-size: 7px; color: #6b7280; line-height: 1.5; font-weight: 500; }
    .school-codes { display: inline-flex; gap: 8px; margin-top: 2px; }
    .school-code-tag { font-size: 6.5px; font-weight: 600; color: #3b82f6; background: #eff6ff; padding: 1.5px 6px; border-radius: 3px; letter-spacing: .3px; }
    .receipt-badge { display: flex; justify-content: space-between; align-items: center; margin: 8px 24px 0; background: linear-gradient(90deg, #eff6ff, #f8fafc); padding: 6px 14px; border-radius: 6px; border-left: 3px solid #2563eb; }
    .badge-title { font-size: 9.5px; font-weight: 700; color: #2563eb; text-transform: uppercase; letter-spacing: .8px; }
    .badge-number { font-size: 8.5px; font-weight: 600; color: #475569; font-family: 'DM Sans', monospace; }
    .grid-wrapper { padding: 8px 24px 4px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 3px 28px; }
    .col-title { font-size: 7px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: .7px; padding-bottom: 2px; margin-bottom: 3px; border-bottom: 1px solid #e5e7eb; }
    .row { display: flex; margin-bottom: 2px; }
    .lbl { width: 65px; min-width: 65px; font-size: 7.5px; font-weight: 500; color: #6b7280; }
    .val { flex: 1; font-size: 8.5px; font-weight: 600; color: #111827; }
    .val.accent { color: #2563eb; }
    .val.status { color: #059669; font-weight: 700; }
    .table-wrapper { padding: 0 24px; }
    .fee-tbl { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
    .fee-tbl thead th { font-size: 6.5px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: .5px; padding: 4px 0; text-align: left; border-bottom: 1.5px solid #e5e7eb; }
    .fee-tbl thead th:last-child { text-align: right; }
    .fee-tbl tbody td { font-size: 8.5px; font-weight: 500; color: #374151; padding: 3px 0; border-bottom: 1px solid #f3f4f6; }
    .fee-tbl tbody td:last-child { text-align: right; font-weight: 600; color: #111827; font-variant-numeric: tabular-nums; }
    .amount-wrapper { padding: 0 24px; }
    .amount-box { background: linear-gradient(135deg, #eff6ff, #dbeafe); border: 1.5px solid #93c5fd; border-radius: 8px; padding: 8px 16px; display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
    .amt-label { font-size: 8px; font-weight: 700; color: #2563eb; text-transform: uppercase; letter-spacing: .5px; }
    .amt-value { font-size: 22px; font-weight: 700; color: #1e40af; letter-spacing: -.3px; font-variant-numeric: tabular-nums; }
    .amt-value .rs { font-size: 14px; font-weight: 600; margin-right: 2px; }
    .sigs-wrapper { padding: 0 24px; }
    .sigs { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 6px; padding: 0 6px; }
    .sig-block { text-align: center; display: flex; flex-direction: column; align-items: center; }
    .sig-empty { width: 110px; height: 34px; }
    .sig-img { width: 110px; height: 34px; display: flex; align-items: flex-end; justify-content: center; }
    .sig-img img { max-width: 100%; max-height: 100%; object-fit: contain; }
    .sig-line { width: 110px; border-top: 1px solid #d1d5db; }
    .sig-text { font-size: 7px; font-weight: 500; color: #6b7280; margin-top: 2px; }
    .footer { margin-top: 8px; text-align: center; font-size: 6.5px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding: 5px 24px 4px; font-weight: 500; }
    .footer .brand { color: #2563eb; font-weight: 600; }
    .footer .generated-on { margin-top: 2px; font-size: 6.5px; color: #9ca3af; font-weight: 500; }
`

export function buildReceiptHtml(rawPayment, rawSchool, opts = {}) {
  const school = normalizeSchool(rawSchool)
  const payment = normalizePayment(rawPayment)
  const logoSrc = opts.logoDataUrl || getLogoUrl(school.logo)
  const signatureSrc = opts.signatureDataUrl || getLogoUrl(school.principalSignature)
  const receiptBlock = buildReceiptBlock(payment, school, logoSrc, signatureSrc)

  return `<!DOCTYPE html>
<html>
<head>
  <title>Receipt #${payment.receiptNumber}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap" rel="stylesheet">
  <meta charset="UTF-8">
  <style>
    ${RECEIPT_STYLES}
    .container { width: 480px; margin: 0 auto; padding: 0; background: #fff; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      @page { size: A4 portrait; margin: 0; }
      .toolbar { display: none !important; }
      .page-body { padding-top: 0 !important; }
      .print-page { width: 210mm; min-height: 297mm; padding: 8mm 14mm; margin: 0 auto; }
      .container { width: 100%; }
    }
    .toolbar { position: fixed; top: 0; left: 0; right: 0; background: #fff; color: #1f2937; padding: 10px 24px; display: flex; gap: 10px; align-items: center; z-index: 999; box-shadow: 0 1px 3px rgba(0,0,0,.08); border-bottom: 1px solid #e5e7eb; font-family: 'DM Sans', sans-serif; }
    .toolbar-title { flex: 1; font-size: 13px; font-weight: 500; }
    .btn { padding: 6px 16px; border: none; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 500; font-family: 'DM Sans', sans-serif; transition: opacity .15s; }
    .btn:hover { opacity: .85; }
    .btn-print { background: #3b82f6; color: white; }
    .btn-close { background: #f3f4f6; color: #6b7280; }
    .page-body { padding-top: 54px; }
  </style>
</head>
<body>
  <div class="toolbar">
    <span class="toolbar-title">Receipt #${payment.receiptNumber}</span>
    <button class="btn btn-print" onclick="window.print()">Print / Save as PDF</button>
    <button class="btn btn-close" onclick="window.close()">Close</button>
  </div>
  <div class="page-body">
    <div class="print-page">
      <div class="container">${receiptBlock}</div>
    </div>
  </div>
</body>
</html>`
}

/* ═══════════════════════════════════════════════════════════
   PDF DOWNLOAD — draws directly with jsPDF (vector text, no html2canvas)
   ═══════════════════════════════════════════════════════════ */

const C = {
  black: '#0f172a',
  text: '#111827',
  textDark: '#374151',
  label: '#6b7280',
  muted: '#9ca3af',
  border: '#e5e7eb',
  borderLight: '#f3f4f6',
  blue: '#2563eb',
  blueDark: '#1e40af',
  blueBg: '#eff6ff',
  blueBorder: '#93c5fd',
  green: '#059669',
  white: '#ffffff',
  logoBg: '#dbeafe',
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return [r, g, b]
}

export async function downloadReceiptAsPdf(rawPayment, rawSchool) {
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
  const parentName = student.parentName || ''
  const invoiceItems = payment.invoiceId?.items || []
  const schoolName = (school.schoolName || 'School').toUpperCase()
  const payDate = payment.paymentDate ? new Date(payment.paymentDate).toLocaleDateString('en-IN') : '-'
  const amtStr = `Rs. ${(payment.amount || 0).toLocaleString('en-IN')}`
  const generatedOn = getGeneratedTimestamp()

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const L = 15       // left margin
  const R = 195      // right edge
  const W = R - L    // usable width
  let Y = 12         // current Y cursor

  // ── Helpers ──
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
  const logoSize = 14
  if (logoDataUrl) {
    try {
      roundRect(L, Y, logoSize, logoSize, 2, C.blueBg)
      pdf.addImage(logoDataUrl, 'PNG', L + 1, Y + 1, logoSize - 2, logoSize - 2)
    } catch {
      roundRect(L, Y, logoSize, logoSize, 2, C.blueBg)
      pdf.setFontSize(8); pdf.setFont('helvetica', 'bold'); setColor(C.blue)
      const initials = schoolName.split(' ').filter(w => w.length > 1).map(w => w[0]).join('').slice(0, 2)
      pdf.text(initials, L + logoSize / 2, Y + logoSize / 2 + 1.5, { align: 'center' })
    }
  } else {
    roundRect(L, Y, logoSize, logoSize, 2, C.blueBg)
    pdf.setFontSize(8); pdf.setFont('helvetica', 'bold'); setColor(C.blue)
    const initials = schoolName.split(' ').filter(w => w.length > 1).map(w => w[0]).join('').slice(0, 2)
    pdf.text(initials, L + logoSize / 2, Y + logoSize / 2 + 1.5, { align: 'center' })
  }

  const infoX = L + logoSize + 4
  pdf.setFontSize(12); pdf.setFont('helvetica', 'bold'); setColor(C.black)
  pdf.text(schoolName, infoX, Y + 4)

  pdf.setFontSize(7); pdf.setFont('helvetica', 'normal'); setColor(C.label)
  let infoY = Y + 7.5
  if (school.fullAddress) { pdf.text(school.fullAddress, infoX, infoY); infoY += 3 }
  pdf.text(`${school.phone || '-'}  ·  ${school.email || '-'}`, infoX, infoY); infoY += 3

  // Code tags
  if (school.schoolCode || school.udiseCode) {
    let tagX = infoX
    pdf.setFontSize(6); pdf.setFont('helvetica', 'bold'); setColor(C.blue)
    if (school.schoolCode) {
      const txt = `Code: ${school.schoolCode}`
      const tw = pdf.getTextWidth(txt) + 4
      roundRect(tagX, infoY - 2.5, tw, 4, 1, C.blueBg)
      pdf.text(txt, tagX + 2, infoY); tagX += tw + 2
    }
    if (school.udiseCode) {
      const txt = `UDISE: ${school.udiseCode}`
      const tw = pdf.getTextWidth(txt) + 4
      roundRect(tagX, infoY - 2.5, tw, 4, 1, C.blueBg)
      pdf.text(txt, tagX + 2, infoY)
    }
  }

  Y = Math.max(Y + logoSize, infoY + 2) + 3
  hLine(L, Y, R, C.border, 0.4)
  Y += 4

  // ── RECEIPT BADGE ──
  const badgeH = 8
  roundRect(L, Y, W, badgeH, 2, C.blueBg)
  // Blue left accent
  setFillCol(C.blue); pdf.rect(L, Y, 1.2, badgeH, 'F')

  pdf.setFontSize(8); pdf.setFont('helvetica', 'bold'); setColor(C.blue)
  pdf.text('PAYMENT RECEIPT', L + 5, Y + 5.2)
  pdf.setFontSize(7.5); pdf.setFont('helvetica', 'normal'); setColor(C.textDark)
  pdf.text(`#${payment.receiptNumber || ''}`, R - 4, Y + 5.2, { align: 'right' })

  Y += badgeH + 5

  // ── TWO-COLUMN INFO GRID ──
  const colGap = 10
  const colW = (W - colGap) / 2
  const col1X = L
  const col2X = L + colW + colGap
  const labelW = 22

  // Column headers
  pdf.setFontSize(6.5); pdf.setFont('helvetica', 'bold'); setColor(C.label)
  pdf.text('STUDENT', col1X, Y); pdf.text('PAYMENT', col2X, Y)
  Y += 2
  hLine(col1X, Y, col1X + colW); hLine(col2X, Y, col2X + colW)
  Y += 4

  const drawRow = (x, y, label, value, valColor = C.text) => {
    pdf.setFontSize(7); pdf.setFont('helvetica', 'normal'); setColor(C.label)
    pdf.text(label, x, y)
    pdf.setFontSize(8); pdf.setFont('helvetica', 'bold'); setColor(valColor)
    pdf.text(value || '-', x + labelW, y)
  }

  // Student column
  let sY = Y
  drawRow(col1X, sY, 'Name', studentName); sY += 5
  drawRow(col1X, sY, 'Adm. No.', admNo); sY += 5
  drawRow(col1X, sY, 'Class', cls); sY += 5
  if (parentName) { drawRow(col1X, sY, 'Parent', parentName); sY += 5 }

  // Payment column
  let pY = Y
  drawRow(col2X, pY, 'Date', payDate); pY += 5
  drawRow(col2X, pY, 'Mode', payment.paymentMethod || '-'); pY += 5
  if (payment.transactionRefId) {
    drawRow(col2X, pY, 'Ref. No.', payment.transactionRefId); pY += 5
  } else if (payment.initiatedBy === 'admin') {
    drawRow(col2X, pY, 'Ref. No.', 'Recorded by Admin'); pY += 5
  }
  if (payment.invoiceId?.billingPeriod?.displayText) {
    drawRow(col2X, pY, 'Period', payment.invoiceId.billingPeriod.displayText, C.blue); pY += 5
  }
  drawRow(col2X, pY, 'Initiated By', payment.initiatedBy === 'admin' ? `Admin: ${payment.verifiedByName || 'Admin'}` : 'Student'); pY += 5
  if (payment.verifiedByName) {
    drawRow(col2X, pY, 'Verified By', payment.verifiedByName); pY += 5
  }
  drawRow(col2X, pY, 'Status', 'Paid', C.green); pY += 5

  Y = Math.max(sY, pY) + 3

  // ── FEE BREAKDOWN TABLE ──
  if (invoiceItems.length > 0) {
    pdf.setFontSize(6.5); pdf.setFont('helvetica', 'bold'); setColor(C.label)
    pdf.text('DESCRIPTION', L, Y)
    pdf.text('AMOUNT (\u20B9)', R, Y, { align: 'right' })
    Y += 2
    hLine(L, Y, R, C.border, 0.4)
    Y += 4

    for (const item of invoiceItems) {
      pdf.setFontSize(8); pdf.setFont('helvetica', 'normal'); setColor(C.textDark)
      pdf.text(item.feeHeadName || '', L, Y)
      pdf.setFont('helvetica', 'bold'); setColor(C.text)
      pdf.text((item.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }), R, Y, { align: 'right' })
      Y += 4.5
      hLine(L, Y, R, C.borderLight, 0.2)
      Y += 2
    }
    Y += 2
  }

  // ── TOTAL AMOUNT BOX ──
  const amtBoxH = 14
  roundRect(L, Y, W, amtBoxH, 3, C.blueBg, C.blueBorder)

  pdf.setFontSize(7); pdf.setFont('helvetica', 'bold'); setColor(C.blue)
  pdf.text('TOTAL AMOUNT PAID', L + 6, Y + 8.5)

  pdf.setFontSize(18); pdf.setFont('helvetica', 'bold'); setColor(C.blueDark)
  pdf.text(amtStr, R - 6, Y + 9.5, { align: 'right' })

  Y += amtBoxH + 8

  // ── SIGNATURES ──
  const sigLineW = 40
  const sig1X = L + 8
  const sig2X = R - sigLineW - 8

  if (signatureDataUrl) {
    try { pdf.addImage(signatureDataUrl, 'PNG', sig2X + 2, Y - 2, 36, 12) } catch { /* skip */ }
  }

  const sigLineY = Y + 12
  hLine(sig1X, sigLineY, sig1X + sigLineW, '#d1d5db', 0.4)
  hLine(sig2X, sigLineY, sig2X + sigLineW, '#d1d5db', 0.4)

  pdf.setFontSize(6.5); pdf.setFont('helvetica', 'normal'); setColor(C.label)
  pdf.text('Depositor', sig1X + sigLineW / 2, sigLineY + 3.5, { align: 'center' })
  pdf.text('Authorized Signatory', sig2X + sigLineW / 2, sigLineY + 3.5, { align: 'center' })

  Y = sigLineY + 8

  // ── FOOTER ──
  hLine(L, Y, R)
  pdf.setFontSize(6); pdf.setFont('helvetica', 'normal'); setColor(C.muted)
  pdf.text('Computer-generated receipt. Valid without physical signature.  ·  Powered by Learnovo', (L + R) / 2, Y + 3.5, { align: 'center' })
  pdf.text(`Generated on ${generatedOn}`, (L + R) / 2, Y + 7, { align: 'center' })

  // ── SAVE ──
  pdf.save(`Receipt-${payment.receiptNumber || 'receipt'}.pdf`)
}
