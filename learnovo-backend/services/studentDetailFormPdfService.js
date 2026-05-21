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
      timeout: 8000,
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

const DOC_TYPE_TITLES = {
  student_aadhaar: 'Student Aadhaar Card',
  tc: 'Transfer Certificate (TC)',
  birth_certificate: 'Birth Certificate',
  guardian_aadhaar: 'Guardian Aadhaar Card'
};

async function renderDocBodyFull(doc) {
  const isPdf = (doc.resourceType === 'raw') || /\.pdf$/i.test(doc.url || '') || doc.format === 'pdf';
  if (isPdf) {
    return `
      <div class="doc-pdf-notice">
        <div class="doc-pdf-icon">PDF</div>
        <p class="doc-pdf-name">${esc(doc.name || 'Document')}</p>
        <p class="doc-pdf-link">${esc(doc.url || '')}</p>
        <p class="doc-pdf-hint">This document was uploaded as a PDF. Open the link above to view the original.</p>
      </div>`;
  }
  const imgData = await toBase64DataUri(doc.url);
  if (!imgData) {
    return `
      <div class="doc-pdf-notice">
        <p class="doc-pdf-name">${esc(doc.name || 'Document')}</p>
        <p class="doc-pdf-hint">Image could not be loaded for this PDF rendering.</p>
        <p class="doc-pdf-link">${esc(doc.url || '')}</p>
      </div>`;
  }
  return `<img class="doc-img" src="${imgData}" alt="" />`;
}

async function renderDocBodyHalf(doc) {
  const isPdf = (doc.resourceType === 'raw') || /\.pdf$/i.test(doc.url || '') || doc.format === 'pdf';
  if (isPdf) {
    return `
      <div class="doc-pdf-notice doc-pdf-notice-half">
        <div class="doc-pdf-icon">PDF</div>
        <p class="doc-pdf-name">${esc(doc.name || 'Document')}</p>
        <p class="doc-pdf-link">${esc(doc.url || '')}</p>
      </div>`;
  }
  const imgData = await toBase64DataUri(doc.url);
  if (!imgData) {
    return `<div class="doc-pdf-notice doc-pdf-notice-half"><p class="doc-pdf-name">${esc(doc.name || 'Document')}</p></div>`;
  }
  return `<img class="doc-img-half" src="${imgData}" alt="" />`;
}

function getGuardianLabel(doc, student) {
  const gi = typeof doc.guardianIndex === 'number' ? doc.guardianIndex : null;
  const guardian = (gi != null && Array.isArray(student.guardians)) ? student.guardians[gi] : null;
  if (!guardian) return 'Guardian';
  const relation = guardian.relation || 'Guardian';
  const name = guardian.name ? ` — ${guardian.name}` : '';
  return `${relation}${name}`;
}

async function buildDocumentPagesHtml(student) {
  const docs = Array.isArray(student.documents) ? student.documents : [];
  if (docs.length === 0) return '';

  const ordered = [...docs].sort((a, b) => {
    const order = ['student_aadhaar', 'tc', 'birth_certificate', 'guardian_aadhaar'];
    const ai = order.indexOf(a.type);
    const bi = order.indexOf(b.type);
    if (ai !== bi) return ai - bi;
    if (a.type === 'guardian_aadhaar' && b.type === 'guardian_aadhaar') {
      return (a.guardianIndex ?? 0) - (b.guardianIndex ?? 0);
    }
    return new Date(a.uploadedAt || 0) - new Date(b.uploadedAt || 0);
  });

  const guardianDocs = ordered.filter(d => d.type === 'guardian_aadhaar');
  const otherDocs = ordered.filter(d => d.type !== 'guardian_aadhaar');

  const studentLine = `Student: ${esc(buildStudentName(student))}${student.admissionNumber ? ` &middot; Adm# ${esc(student.admissionNumber)}` : ''}`;

  // Fetch every document body in parallel so a 4-doc student doesn't serialize
  // 4×8s image-fetch waits and trip the 60s request timeout.
  const otherPagesPromise = Promise.all(otherDocs.map(async(doc) => {
    const title = DOC_TYPE_TITLES[doc.type] || 'Document';
    const body = await renderDocBodyFull(doc);
    const uploadedOn = doc.uploadedAt ? fmtDate(doc.uploadedAt) : '';
    return `
      <div class="doc-page">
        <div class="doc-header">
          <div class="doc-title">${esc(title)}</div>
          ${uploadedOn ? `<div class="doc-meta">Uploaded: ${esc(uploadedOn)}</div>` : ''}
        </div>
        <div class="doc-body">${body}</div>
        <div class="doc-footer">${studentLine}</div>
      </div>`;
  }));

  // Group guardian Aadhaar cards two-per-page so father + mother fit on a single page.
  const guardianPairs = [];
  for (let i = 0; i < guardianDocs.length; i += 2) {
    guardianPairs.push(guardianDocs.slice(i, i + 2));
  }
  const guardianPagesPromise = Promise.all(guardianPairs.map(async(pair) => {
    const items = await Promise.all(pair.map(async(doc) => {
      const label = getGuardianLabel(doc, student);
      const body = await renderDocBodyHalf(doc);
      return `
        <div class="doc-multi-item">
          <div class="doc-multi-subtitle">${esc(label)} — Aadhaar Card</div>
          <div class="doc-multi-img-wrap">${body}</div>
        </div>`;
    }));
    return `
      <div class="doc-page">
        <div class="doc-header">
          <div class="doc-title">Guardian Aadhaar Card${pair.length > 1 ? 's' : ''}</div>
        </div>
        <div class="doc-body doc-multi-body">${items.join('')}</div>
        <div class="doc-footer">${studentLine}</div>
      </div>`;
  }));

  const [otherPages, guardianPages] = await Promise.all([otherPagesPromise, guardianPagesPromise]);
  return [...otherPages, ...guardianPages].join('\n');
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

function getMotherName(student) {
  if (!Array.isArray(student.guardians)) return '';
  const mother = student.guardians.find(g => (g.relation || '').toLowerCase() === 'mother');
  return mother?.name || '';
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
        ${row('Aadhaar Number', g.aadhaarNumber)}
      </div>
    </div>`).join('');
}

function buildHtml(student, schoolData, logoDataUri, photoDataUri, photoFallbackUrl) {
  const studentName = buildStudentName(student);
  const motherName = getMotherName(student);
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
    /* Side padding leaves a safe hole-punch margin on both edges */
    padding: 16px 50px;
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
  .title-sec { text-align: center; padding: 8px 0 4px; position: relative; }
  .title-badge { display: inline-block; background: #edf9f7; border-radius: 8px; padding: 6px 24px; }
  .title-badge h1 { font-size: 12px; font-weight: 700; color: #0a5c56; letter-spacing: 4px; text-transform: uppercase; line-height: 1; }
  .title-meta { font-size: 9px; color: #111827; margin-top: 6px; }
  .title-meta b { color: #111827; font-weight: 700; }
  .adm-pill { position: absolute; right: 0; top: 50%; transform: translateY(-50%); background: #fff3bf; border: 1px solid #f1c40f; color: #7a5d00; font-size: 10px; font-weight: 700; letter-spacing: 0.4px; padding: 3px 10px; border-radius: 999px; }
  .adm-pill b { color: #5a4500; font-size: 11px; letter-spacing: 0.8px; }

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

  /* Signatures */
  .signatures {
    margin-top: 28px;
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 28px;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .sig-box { display: flex; flex-direction: column; align-items: stretch; text-align: center; }
  .sig-line {
    width: 100%; border-top: 1.2px solid #111827;
    margin-top: 44px; margin-bottom: 6px;
  }
  .sig-label {
    font-size: 9px; font-weight: 700; color: #111827;
    text-transform: uppercase; letter-spacing: 1px;
  }

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

  /* ─── Appended document pages (one per uploaded document) ─── */
  .doc-page {
    page-break-before: always;
    width: 210mm; min-height: 297mm; box-sizing: border-box;
    padding: 18mm 14mm; display: flex; flex-direction: column;
    background: #ffffff;
  }
  .doc-header { border-bottom: 2px solid #0f766e; padding-bottom: 8px; margin-bottom: 14px; }
  .doc-title { font-size: 16px; font-weight: 700; color: #0f766e; letter-spacing: 0.2px; }
  .doc-meta { font-size: 10px; color: #6b7280; margin-top: 4px; }
  .doc-body { flex: 1; display: flex; align-items: center; justify-content: center; }
  .doc-img { max-width: 100%; max-height: 235mm; object-fit: contain; border: 1px solid #e5e7eb; border-radius: 4px; }
  .doc-pdf-notice {
    width: 100%; max-width: 140mm; padding: 24px; text-align: center;
    border: 2px dashed #cbd5e1; border-radius: 8px; background: #f8fafc;
  }
  .doc-pdf-icon {
    display: inline-block; padding: 8px 18px; margin-bottom: 14px;
    background: #dc2626; color: #ffffff; font-weight: 700; font-size: 12px;
    border-radius: 4px; letter-spacing: 1px;
  }
  .doc-pdf-name { font-size: 13px; font-weight: 600; color: #111827; margin: 4px 0; word-break: break-all; }
  .doc-pdf-link { font-size: 9px; color: #2563eb; margin: 8px 0; word-break: break-all; }
  .doc-pdf-hint { font-size: 10px; color: #6b7280; margin-top: 12px; }
  .doc-footer { text-align: center; font-size: 9px; color: #6b7280; padding-top: 8px; border-top: 1px solid #e5e7eb; margin-top: 8px; }

  /* Multi-document page (groups father + mother Aadhaar onto one page) */
  .doc-body.doc-multi-body {
    flex-direction: column; align-items: stretch; justify-content: stretch;
    gap: 14px;
  }
  .doc-multi-item {
    flex: 1; display: flex; flex-direction: column; min-height: 0;
  }
  .doc-multi-subtitle {
    font-size: 11px; font-weight: 700; color: #0a5c56;
    padding-left: 8px; border-left: 3px solid #0a5c56;
    margin-bottom: 6px;
  }
  .doc-multi-img-wrap {
    flex: 1; display: flex; align-items: center; justify-content: center;
    min-height: 0;
  }
  .doc-img-half {
    max-width: 100%; max-height: 110mm;
    object-fit: contain; border: 1px solid #e5e7eb; border-radius: 4px;
  }
  .doc-pdf-notice-half { max-width: 110mm; padding: 14px; }
  .doc-pdf-notice-half .doc-pdf-icon { margin-bottom: 8px; padding: 6px 14px; font-size: 11px; }
  .doc-pdf-notice-half .doc-pdf-name { font-size: 11px; }
  .doc-pdf-notice-half .doc-pdf-link { font-size: 8px; }
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
    <div class="adm-pill">Admission No: <b>${esc(student.admissionNumber)}</b></div>
    <div class="title-meta">Status: <b>${student.isActive ? 'Active' : 'Inactive'}</b> &nbsp;&middot;&nbsp; Page 1 of 2</div>
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
      ${row('Mother\'s Name', motherName)}
      ${row('Aadhaar Number', student.aadhaarNumber)}
      ${row('Mother Tongue', student.motherTongue)}
      ${row('Religion', student.religion)}
      ${row('Category', student.category)}
      ${row('PEN Number', student.penNumber)}
      ${row('UDISE Code', student.udiseCode || udiseCode)}
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
    <div class="row full-row" style="margin-top:6px"><span class="lbl">Address</span><span class="val" style="font-weight:600">${esc(student.address)}</span></div>
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

  <div class="signatures">
    <div class="sig-box">
      <div class="sig-line"></div>
      <div class="sig-label">Class Teacher</div>
    </div>
    <div class="sig-box">
      <div class="sig-line"></div>
      <div class="sig-label">Parent / Guardian</div>
    </div>
    <div class="sig-box">
      <div class="sig-line"></div>
      <div class="sig-label">Principal</div>
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
  const photoUrl = student.photo || student.avatar;
  const photoFallbackUrl = photoUrl && (photoUrl.startsWith('data:') || photoUrl.startsWith('http') ? photoUrl : `https://api.learnovoportal.com${photoUrl}`);
  const [logoDataUri, photoDataUri, docPagesHtml] = await Promise.all([
    toBase64DataUri(schoolData.logo),
    toBase64DataUri(photoUrl),
    buildDocumentPagesHtml(student)
  ]);
  let html = buildHtml(student, schoolData, logoDataUri, photoDataUri, photoFallbackUrl);
  if (docPagesHtml) {
    html = html.replace('</body>', `${docPagesHtml}\n</body>`);
  }
  const { getBrowser, releaseBrowser } = pdfService._internal;
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 30000 });
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
  const photoUrl = student.photo || student.avatar;
  const photoFallbackUrl = photoUrl && (photoUrl.startsWith('data:') || photoUrl.startsWith('http') ? photoUrl : `https://api.learnovoportal.com${photoUrl}`);
  const [logoDataUri, photoDataUri, docPagesHtml] = await Promise.all([
    toBase64DataUri(schoolData.logo),
    toBase64DataUri(photoUrl),
    buildDocumentPagesHtml(student)
  ]);
  let html = buildHtml(student, schoolData, logoDataUri, photoDataUri, photoFallbackUrl);
  if (docPagesHtml) {
    html = html.replace('</body>', `${docPagesHtml}\n</body>`);
  }

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
