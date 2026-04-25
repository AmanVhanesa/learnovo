'use strict';

const pdfService = require('./pdfService');
const axios = require('axios');

async function toBase64DataUri(url) {
  if (!url) return '';
  if (url.startsWith('data:')) return url;
  const fullUrl = url.startsWith('http') ? url : `https://api.learnovoportal.com${url}`;
  try {
    const response = await axios.get(fullUrl, {
      responseType: 'arraybuffer',
      timeout: 12000,
      maxRedirects: 5,
      headers: { 'User-Agent': 'Mozilla/5.0 LearnovoPDF/1.0' }
    });
    const mime = response.headers['content-type'] || '';
    const buf = Buffer.from(response.data);
    if (!mime.startsWith('image/') || buf.length < 100) return '';
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch (err) {
    console.warn('[StudentDetailForm] image fetch failed:', fullUrl, err.message);
    return '';
  }
}

const esc = (v) => {
  if (v === null || v === undefined || v === '') return '—';
  return String(v).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;'
  })[c]);
};

const fmtDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const yesNo = (v) => (v ? 'Yes' : 'No');

function buildStudentName(student) {
  return student.fullName
    || student.name
    || [student.firstName, student.middleName, student.lastName].filter(Boolean).join(' ')
    || '—';
}

function row(label, value) {
  return `<div class="row"><span class="lbl">${label}</span><span class="val">${esc(value)}</span></div>`;
}

function section(title, content) {
  return `
    <div class="section">
      <div class="section-title">${title}</div>
      <div class="section-body">${content}</div>
    </div>`;
}

function buildGuardiansHtml(guardians = []) {
  if (!guardians.length) {
    return '<div class="empty">No guardian details on record.</div>';
  }
  return guardians.map((g, idx) => `
    <div class="guardian-card">
      <div class="guardian-head">
        <span class="guardian-num">Guardian ${idx + 1}</span>
        ${g.isPrimary ? '<span class="badge">Primary</span>' : ''}
      </div>
      <div class="grid-2">
        ${row('Relation', g.relation)}
        ${row('Name', g.name)}
        ${row('Phone', g.phone)}
        ${row('Email', g.email)}
        ${row('Occupation', g.occupation)}
      </div>
    </div>`).join('');
}

function buildHtml(student, schoolData, logoDataUri, photoDataUri, photoFallbackUrl) {
  const studentName = buildStudentName(student);
  const className = student.classId?.name || student.class || '—';
  const sectionName = student.section || '—';
  const subDeptName = student.subDepartment?.name || '—';
  const driverName = student.driverId?.name || (student.transportMode === 'Self' ? 'Self Transport' : '—');

  const schoolName = schoolData.schoolName || 'School';
  const fullAddress = schoolData.fullAddress || '';
  const phone = schoolData.phone || '-';
  const email = schoolData.email || '-';
  const schoolCode = schoolData.schoolCode || '';
  const udiseCode = schoolData.udiseCode || '';

  const generatedOn = new Date().toLocaleString('en-IN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800;900&display=swap" rel="stylesheet">
<style>
  @page { size: A4 portrait; margin: 0; }
  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    font-family: 'Helvetica Neue', Arial, 'Noto Sans', sans-serif;
    color: #111827; background: #f9fafb;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
    text-rendering: optimizeLegibility; -webkit-font-smoothing: antialiased;
  }
  .page {
    width: 794px; height: 1123px;
    padding: 16px 20px;
    background: #fff;
    position: relative;
    overflow: hidden;
    page-break-after: always;
    break-after: page;
  }
  .page:last-child { page-break-after: auto; break-after: auto; }
  .section, .identity, .guardian-card, .declaration, .digital-notice, .header, .footer {
    page-break-inside: avoid; break-inside: avoid;
  }
  .page-header-mini {
    display: flex; align-items: center; gap: 10px;
    padding-bottom: 6px; margin-bottom: 8px;
    border-bottom: 2px solid #0a5c56;
  }
  .page-header-mini .logo-mini { width: 52px; height: 52px; flex-shrink: 0; border-radius: 6px; overflow: hidden; }
  .page-header-mini .logo-mini img { width: 100%; height: 100%; object-fit: contain; }
  .page-header-mini .mini-name {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 14px; font-weight: 800; color: #1F6F6D; text-transform: uppercase; letter-spacing: 0.6px;
  }
  .page-header-mini .mini-meta { margin-left: auto; font-size: 9px; color: #111827; font-weight: 500; }
  .page-header-mini .mini-meta b { color: #111827; font-weight: 700; }
  .page-label { font-size: 8px; font-weight: 700; color: #111827; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 4px; }

  /* Header */
  .header { display: flex; align-items: center; gap: 14px; padding-bottom: 10px; border-bottom: 2px solid #0a5c56; }
  .logo-wrap { width: 92px; height: 92px; flex-shrink: 0; border-radius: 8px; overflow: hidden; }
  .logo-wrap img { width: 92px; height: 92px; object-fit: contain; }
  .school-info { flex: 1; text-align: center; }
  .school-name {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 22px; font-weight: 800; color: #1F6F6D;
    letter-spacing: 1px; line-height: 1.15; text-transform: uppercase;
  }
  .school-addr { font-size: 9.5px; color: #111827; font-weight: 500; margin-top: 2px; }
  .aff-row { display: flex; justify-content: center; gap: 14px; margin-top: 3px; }
  .aff-line { font-size: 8.5px; color: #111827; font-weight: 500; }
  .aff-line b { font-weight: 700; color: #111827; }

  /* Title */
  .title-sec { text-align: center; padding: 8px 0 4px; }
  .title-badge { display: inline-block; background: #edf9f7; border-radius: 8px; padding: 6px 24px; }
  .title-badge h1 { font-size: 12px; font-weight: 700; color: #0a5c56; letter-spacing: 4px; text-transform: uppercase; line-height: 1; }
  .title-meta { font-size: 9px; color: #111827; margin-top: 6px; }
  .title-meta b { color: #111827; font-weight: 700; }

  /* Identity strip — photo + key facts */
  .identity {
    display: flex; gap: 14px; margin-top: 4px; padding: 10px;
    background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px;
  }
  .photo-wrap {
    width: 95px; height: 115px; flex-shrink: 0;
    border: 2px solid #0a5c56; border-radius: 6px; overflow: hidden;
    background: #fff; display: flex; align-items: center; justify-content: center;
  }
  .photo-wrap img { width: 100%; height: 100%; object-fit: cover; }
  .photo-placeholder { font-size: 9px; color: #4b5563; text-align: center; padding: 4px; }
  .identity-body { flex: 1; }
  .identity-name { font-size: 18px; font-weight: 800; color: #0a5c56; letter-spacing: 0.3px; }
  .identity-grid {
    display: grid; grid-template-columns: 1fr 1fr; gap: 4px 18px; margin-top: 8px;
  }
  .identity-grid .row { display: flex; align-items: baseline; }

  /* Sections */
  .section { margin-top: 8px; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
  .section-title {
    background: #edf9f7; color: #0a5c56;
    font-size: 10px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase;
    padding: 6px 12px; border-bottom: 1px solid #d1ede9;
  }
  .section-body { padding: 10px 12px; }

  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 18px; }
  .grid-1 { display: block; }

  .row { display: flex; align-items: baseline; padding: 2px 0; min-height: 18px; }
  .lbl { width: 110px; font-size: 9.5px; font-weight: 600; color: #111827; text-transform: uppercase; letter-spacing: 0.4px; flex-shrink: 0; }
  .val { font-size: 10.5px; font-weight: 600; color: #111827; word-break: break-word; }

  .full-row .val { font-size: 10.5px; font-weight: 500; color: #111827; line-height: 1.5; }

  /* Guardian cards */
  .guardian-card { border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px 10px; margin-bottom: 8px; background: #fcfcfc; }
  .guardian-card:last-child { margin-bottom: 0; }
  .guardian-head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
  .guardian-num { font-size: 9px; font-weight: 700; color: #0a5c56; text-transform: uppercase; letter-spacing: 1px; }
  .badge { background: #fef3c7; color: #92400e; font-size: 7.5px; font-weight: 700; padding: 2px 7px; border-radius: 999px; text-transform: uppercase; letter-spacing: 0.5px; }

  .empty { font-size: 10px; color: #4b5563; font-style: italic; }

  /* Digital notice (replaces signatures) */
  .digital-notice {
    margin-top: 18px; padding: 12px 16px;
    background: #edf9f7; border: 1px solid #d1ede9; border-radius: 8px;
    display: flex; align-items: center; gap: 14px;
  }
  .digital-icon {
    width: 32px; height: 32px; flex-shrink: 0; border-radius: 50%;
    background: #0a5c56; color: #fff;
    display: flex; align-items: center; justify-content: center;
    font-size: 18px; font-weight: 700;
  }
  .digital-text { display: flex; flex-direction: column; gap: 2px; }
  .digital-text b { font-size: 11px; font-weight: 700; color: #0a5c56; text-transform: uppercase; letter-spacing: 0.8px; }
  .digital-text span { font-size: 9px; color: #111827; font-style: italic; }

  /* Declaration */
  .declaration {
    margin-top: 14px; padding: 10px 12px;
    background: #f9fafb; border: 1px dashed #d1d5db; border-radius: 6px;
    font-size: 9px; color: #111827; line-height: 1.5; font-style: italic;
  }
  .declaration b { font-style: normal; color: #111827; font-weight: 700; }

  /* Footer */
  .footer { margin-top: 18px; padding-top: 8px; border-top: 1px solid #e5e7eb; text-align: center; }
  .footer span { font-size: 8px; color: #111827; font-weight: 500; text-transform: uppercase; letter-spacing: 1.2px; }
  .footer .brand { font-weight: 700; color: #0f766e; }
  .footer .gen { display: block; margin-top: 2px; font-size: 7.5px; color: #111827; text-transform: none; letter-spacing: 0; font-style: italic; }
</style>
</head>
<body>

<!-- ───────── PAGE 1 (FRONT) ───────── -->
<div class="page">

  <div class="header">
    ${logoDataUri ? `<div class="logo-wrap"><img src="${logoDataUri}" alt="Logo"></div>` : ''}
    <div class="school-info">
      <div class="school-name">${esc(schoolName)}</div>
      ${fullAddress ? `<div class="school-addr">${esc(fullAddress)}</div>` : ''}
      <div class="school-addr">Phone: ${esc(phone)} &nbsp;|&nbsp; Email: ${esc(email)}</div>
      ${(schoolCode || udiseCode) ? `<div class="aff-row">
        ${schoolCode ? `<span class="aff-line">School Code: <b>${esc(schoolCode)}</b></span>` : ''}
        ${udiseCode ? `<span class="aff-line">UDISE: <b>${esc(udiseCode)}</b></span>` : ''}
      </div>` : ''}
    </div>
  </div>

  <div class="title-sec">
    <div class="title-badge"><h1>Student Detail Form</h1></div>
    <div class="title-meta">Admission No: <b>${esc(student.admissionNumber)}</b> &nbsp;&middot;&nbsp; Status: <b>${student.isActive ? 'Active' : 'Inactive'}</b> &nbsp;&middot;&nbsp; Page 1 of 2</div>
  </div>

  <div class="identity">
    <div class="photo-wrap">
      ${photoDataUri ? `<img src="${photoDataUri}" alt="Student Photo">` : (photoFallbackUrl ? `<img src="${photoFallbackUrl}" alt="Student Photo" onerror="this.style.display='none'">` : '')}
    </div>
    <div class="identity-body">
      <div class="identity-name">${esc(studentName)}</div>
      <div class="identity-grid">
        ${row('Class', `${className}${sectionName !== '—' ? ` — Section ${sectionName}` : ''}`)}
        ${row('Roll No.', student.rollNumber)}
        ${row('Academic Year', student.academicYear)}
        ${row('Admission Date', fmtDate(student.admissionDate))}
        ${row('Date of Birth', fmtDate(student.dateOfBirth))}
        ${row('Gender', student.gender)}
        ${row('Blood Group', student.bloodGroup)}
        ${row('Nationality', student.nationality)}
      </div>
    </div>
  </div>

  ${section('Personal Information', `
    <div class="grid-2">
      ${row('Full Name', studentName)}
      ${row('Father\'s Name', student.fatherOrHusbandName)}
      ${row('Religion', student.religion)}
      ${row('Category', student.category)}
      ${row('PEN Number', student.penNumber)}
      ${row('UDISE Code', student.udiseCode)}
      ${row('National ID', student.nationalId)}
      ${row('Identification Mark', student.identificationMark)}
      ${row('Is Orphan', yesNo(student.isOrphan))}
      ${row('Student Type', student.studentType)}
    </div>
  `)}

  ${section('Academic Information', `
    <div class="grid-2">
      ${row('Class', className)}
      ${row('Section', sectionName)}
      ${row('Roll Number', student.rollNumber)}
      ${row('Academic Year', student.academicYear)}
      ${row('Admission Class', student.admissionClass)}
      ${row('Admission Section', student.admissionSection)}
      ${row('Admission Date', fmtDate(student.admissionDate))}
      ${row('Sub-Department', subDeptName)}
    </div>
  `)}

  ${section('Contact Information', `
    <div class="grid-2">
      ${row('Email', student.email)}
      ${row('Phone', student.phone)}
    </div>
    <div class="row full-row" style="margin-top:6px"><span class="lbl">Address</span><span class="val">${esc(student.address)}</span></div>
  `)}

  ${section('Guardian / Family Information', buildGuardiansHtml(student.guardians))}

  ${section('Previous Education', `
    <div class="grid-2">
      ${row('Previous School', student.previousSchool)}
      ${row('Previous Board', student.previousBoard)}
      ${row('Previous Roll No.', student.previousRollNumber)}
    </div>
    ${student.transferNotes ? `<div class="row full-row" style="margin-top:6px"><span class="lbl">Notes</span><span class="val">${esc(student.transferNotes)}</span></div>` : ''}
  `)}

</div>
<!-- ───────── PAGE 2 (BACK) ───────── -->
<div class="page">

  <div class="page-header-mini">
    ${logoDataUri ? `<div class="logo-mini"><img src="${logoDataUri}" alt="Logo"></div>` : ''}
    <div class="mini-name">${esc(schoolName)}</div>
    <div class="mini-meta">Student Detail Form &nbsp;&middot;&nbsp; <b>${esc(studentName)}</b> &nbsp;&middot;&nbsp; Adm No: <b>${esc(student.admissionNumber)}</b></div>
  </div>
  <div class="page-label">Page 2 of 2</div>

  ${section('Medical Information', `
    <div class="grid-2">
      ${row('Blood Group', student.bloodGroup)}
      ${row('Doctor Name', student.doctorName)}
      ${row('Doctor Phone', student.doctorPhone)}
      ${row('Allergies', student.allergies)}
    </div>
    ${student.medicalConditions ? `<div class="row full-row" style="margin-top:6px"><span class="lbl">Conditions</span><span class="val">${esc(student.medicalConditions)}</span></div>` : ''}
  `)}

  ${section('Transport', `
    <div class="grid-2">
      ${row('Transport Mode', student.transportMode)}
      ${row('Driver / Route', driverName)}
    </div>
  `)}

  ${student.notes ? section('Additional Notes', `
    <div class="row full-row"><span class="val">${esc(student.notes)}</span></div>
  `) : ''}

  <div class="declaration">
    <b>Declaration:</b> The information provided above has been verified against the original documents
    submitted at the time of admission. Any discrepancy found later may lead to cancellation of admission
    as per school policy.
  </div>

  <div class="digital-notice">
    <span class="digital-icon">&#10003;</span>
    <div class="digital-text">
      <b>Digitally Generated Document</b>
      <span>This is a system-generated student detail form. No physical signature is required.</span>
    </div>
  </div>

  <div class="footer">
    <span>Powered by <span class="brand">Learnovo</span> &mdash; School Management System</span>
    <span class="gen">Generated: ${generatedOn}</span>
  </div>

</div>
</body>
</html>`;
}

async function generateStudentDetailFormPdf(student, schoolData) {
  const logoDataUri = await toBase64DataUri(schoolData.logo);
  const photoUrl = student.photo || student.avatar;
  const photoDataUri = await toBase64DataUri(photoUrl);
  const photoFallbackUrl = photoUrl && (photoUrl.startsWith('data:') || photoUrl.startsWith('http') ? photoUrl : `https://api.learnovoportal.com${photoUrl}`);
  const html = buildHtml(student, schoolData, logoDataUri, photoDataUri, photoFallbackUrl);
  const { getBrowser, releaseBrowser } = pdfService._internal;
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 });
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

async function generateStudentDetailFormHtml(student, schoolData) {
  const logoDataUri = await toBase64DataUri(schoolData.logo);
  const photoUrl = student.photo || student.avatar;
  const photoDataUri = await toBase64DataUri(photoUrl);
  const photoFallbackUrl = photoUrl && (photoUrl.startsWith('data:') || photoUrl.startsWith('http') ? photoUrl : `https://api.learnovoportal.com${photoUrl}`);
  let html = buildHtml(student, schoolData, logoDataUri, photoDataUri, photoFallbackUrl);

  const studentName = buildStudentName(student);
  const toolbarHtml = `
    <div id="toolbar" style="position:fixed;top:0;left:0;right:0;background:#1C1C1E;color:#fff;padding:10px 24px;display:flex;gap:10px;align-items:center;z-index:999;font-family:'Helvetica Neue',Arial,sans-serif;">
      <span style="flex:1;font-size:13px;font-weight:500;">Student Detail Form — ${esc(studentName)}</span>
      <button onclick="document.getElementById('toolbar').style.display='none';window.print();setTimeout(()=>document.getElementById('toolbar').style.display='flex',500)" style="padding:7px 18px;border:none;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;background:#1F6F6D;color:white;">Print</button>
      <button onclick="window.close()" style="padding:7px 18px;border:none;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;background:#38383A;color:#8E8E93;">Close</button>
    </div>`;

  html = html.replace('<body>', `<body>${toolbarHtml}<div style="height:50px"></div>`);
  html = html.replace('@page { size: A4 portrait; margin: 0; }',
    '@page { size: A4 portrait; margin: 0; } @media print { #toolbar { display: none !important; } body > div[style*="height:50px"] { display: none !important; } }');

  return html;
}

module.exports = { generateStudentDetailFormPdf, generateStudentDetailFormHtml };
