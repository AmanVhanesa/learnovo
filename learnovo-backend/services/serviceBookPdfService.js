'use strict';

const PDFDocument = require('pdfkit');
const axios = require('axios');
const User = require('../models/User');
const Settings = require('../models/Settings');

/* TC-inspired palette */
const C = {
  black: '#0f172a',
  text: '#111827',
  textSoft: '#374151',
  label: '#4b5563',
  muted: '#9ca3af',
  border: '#e5e7eb',
  borderLight: '#f3f4f6',
  teal: '#1F6F6D',         // matches TC school name
  tealDark: '#0a5c56',     // matches TC title
  tealBg: '#edf9f7',       // matches TC title badge
  tealBgSoft: '#f0fdfa',
  tealBorder: '#ccfbf1',
  white: '#ffffff',
  logoBg: '#f3f4f6',
  rowAlt: '#f0fdfa'        // matches TC alt rows
};

async function fetchImageBuffer(url) {
  if (!url) return null;
  try {
    const fullUrl = url.startsWith('http') ? url : `https://api.learnovoportal.com${url}`;
    const response = await axios.get(fullUrl, { responseType: 'arraybuffer', timeout: 8000, maxRedirects: 5 });
    const buf = Buffer.from(response.data);
    if (buf.length < 100) return null;
    return buf;
  } catch (err) {
    return null;
  }
}

async function getSchoolData(tenantId) {
  const settings = await Settings.findOne({ tenantId }).lean();
  const inst = settings?.institution || {};
  const addr = inst.address || {};
  const contact = inst.contact || {};
  const addressParts = [addr.street, addr.city, addr.state, addr.pincode].filter(Boolean);
  return {
    schoolName: inst.name || 'School Name',
    logo: inst.logo || null,
    fullAddress: addressParts.join(', '),
    phone: contact.phone || '',
    email: contact.email || '',
    board: inst.board || '',
    affiliationNumber: inst.affiliationNumber || '',
    schoolCode: inst.schoolCode || '',
    udiseCode: inst.udiseCode || ''
  };
}

function line(doc, x1, y, x2, color = C.border, w = 0.5) {
  doc.save().moveTo(x1, y).lineTo(x2, y).lineWidth(w).strokeColor(color).stroke().restore();
}
function roundRect(doc, x, y, w, h, r, fill, stroke) {
  doc.roundedRect(x, y, w, h, r);
  if (fill) doc.fill(fill);
  if (stroke) {
    doc.roundedRect(x, y, w, h, r); doc.lineWidth(0.75).strokeColor(stroke).stroke();
  }
}

function fmtDate(d) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
}
function hasVal(v) {
  if (v === null || v === undefined) return false;
  if (typeof v === 'string' && v.trim() === '') return false;
  if (Array.isArray(v) && v.length === 0) return false;
  return true;
}
function val(v) {
  if (!hasVal(v)) return '—';
  return String(v);
}
function titleCase(s) {
  if (!s) return '';
  return String(s).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
function fmtDateOpt(d) {
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
}
function filterPairs(pairs) {
  return pairs.filter(([, v]) => hasVal(v));
}

/* ── TC-style header: centred school info, logo on left, title badge ─────── */
function drawHeader(doc, schoolData, logoBuffer, L, R, startY, pageLabel) {
  const logoSize = 56;
  const headerTop = startY;
  let cursorY = headerTop + 2;

  // Logo (left)
  if (logoBuffer) {
    try {
      doc.image(logoBuffer, L, headerTop, { width: logoSize, height: logoSize, fit: [logoSize, logoSize] });
    } catch (_) {
      roundRect(doc, L, headerTop, logoSize, logoSize, 6, C.logoBg);
    }
  } else {
    roundRect(doc, L, headerTop, logoSize, logoSize, 6, C.logoBg);
    const initials = (schoolData.schoolName || 'S').toUpperCase().split(' ').filter(w => w.length > 1).map(w => w[0]).join('').slice(0, 2) || 'S';
    doc.fontSize(20).font('Helvetica-Bold').fillColor(C.label).text(initials, L, headerTop + 17, { width: logoSize, align: 'center' });
  }

  // Centred school name (serif, uppercase, letter-spaced, teal)
  const schoolName = (schoolData.schoolName || 'School').toUpperCase();
  doc.fontSize(18).font('Times-Bold').fillColor(C.teal)
    .text(schoolName, L, cursorY, { width: R - L, align: 'center', characterSpacing: 1 });
  cursorY = doc.y + 1;

  // Address
  if (schoolData.fullAddress) {
    doc.fontSize(8.5).font('Helvetica').fillColor(C.label)
      .text(schoolData.fullAddress, L, cursorY, { width: R - L, align: 'center' });
    cursorY = doc.y;
  }

  // Phone | Email
  const contactParts = [];
  if (schoolData.phone) contactParts.push(`Phone: ${schoolData.phone}`);
  if (schoolData.email) contactParts.push(`Email: ${schoolData.email}`);
  if (contactParts.length) {
    doc.fontSize(8).font('Helvetica').fillColor(C.label)
      .text(contactParts.join('   |   '), L, cursorY, { width: R - L, align: 'center' });
    cursorY = doc.y;
  }

  // Affiliation row
  const affParts = [];
  if (schoolData.board) affParts.push(`Board: ${schoolData.board}`);
  if (schoolData.affiliationNumber) affParts.push(`Affn No: ${schoolData.affiliationNumber}`);
  if (schoolData.schoolCode) affParts.push(`School Code: ${schoolData.schoolCode}`);
  if (schoolData.udiseCode) affParts.push(`UDISE: ${schoolData.udiseCode}`);
  if (affParts.length) {
    doc.fontSize(7.5).font('Helvetica').fillColor(C.label)
      .text(affParts.join('   ·   '), L, cursorY + 1, { width: R - L, align: 'center' });
    cursorY = doc.y;
  }

  cursorY = Math.max(cursorY, headerTop + logoSize) + 8;
  line(doc, L, cursorY, R, C.border, 0.7);
  cursorY += 12;

  // Title badge (TC-style)
  const title = 'EMPLOYEE SERVICE BOOK';
  const badgeW = 240;
  const badgeH = 22;
  const badgeX = L + (R - L - badgeW) / 2;
  roundRect(doc, badgeX, cursorY, badgeW, badgeH, 6, C.tealBg);
  doc.fontSize(10).font('Helvetica-Bold').fillColor(C.tealDark)
    .text(title, badgeX, cursorY + 6, { width: badgeW, align: 'center', characterSpacing: 2.5 });
  cursorY += badgeH + 4;

  // Page label (small, right-aligned)
  if (pageLabel) {
    doc.fontSize(7.5).font('Helvetica-Oblique').fillColor(C.muted)
      .text(pageLabel, L, cursorY, { width: R - L, align: 'right' });
    cursorY = doc.y + 2;
  }

  return cursorY + 6;
}

function sectionTitle(doc, L, R, Y, label) {
  // Slim left-bar style title to save space
  doc.save().rect(L, Y + 2, 3, 12).fill(C.teal).restore();
  doc.fontSize(9.5).font('Helvetica-Bold').fillColor(C.tealDark)
    .text(label.toUpperCase(), L + 8, Y + 2, { characterSpacing: 1.2 });
  const newY = Math.max(doc.y, Y + 14);
  line(doc, L, newY + 1, R, C.borderLight, 0.5);
  return newY + 6;
}

function drawKvGrid(doc, L, R, Y, pairs, cols = 2, rowH = 22) {
  pairs = filterPairs(pairs);
  if (pairs.length === 0) return Y;
  const colW = (R - L) / cols;
  const rows = Math.ceil(pairs.length / cols);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      if (idx >= pairs.length) continue;
      const [k, v] = pairs[idx];
      const x = L + c * colW;
      const y = Y + r * rowH;
      doc.fontSize(7).font('Helvetica').fillColor(C.label).text(k.toUpperCase(), x, y, { width: colW - 8, characterSpacing: 0.5 });
      doc.fontSize(9).font('Helvetica-Bold').fillColor(C.text).text(val(v), x, y + 9, { width: colW - 8 });
    }
  }
  return Y + rows * rowH + 2;
}

function drawTable(doc, L, R, Y, headers, rows, colWidths, opts = {}) {
  const totalW = R - L;
  const widths = colWidths || headers.map(() => totalW / headers.length);
  const headerH = 16;
  const rowH = opts.rowH || 18;

  // Header row
  doc.save().rect(L, Y, totalW, headerH).fill(C.tealBgSoft).restore();
  doc.save().rect(L, Y, totalW, headerH).lineWidth(0.5).strokeColor(C.tealBorder).stroke().restore();
  let x = L + 6;
  doc.fontSize(7.5).font('Helvetica-Bold').fillColor(C.tealDark);
  headers.forEach((h, i) => {
    doc.text(h.toUpperCase(), x, Y + 4, { width: widths[i] - 6, characterSpacing: 0.5 });
    x += widths[i];
  });
  Y += headerH;

  if (rows.length === 0) {
    doc.save().rect(L, Y, totalW, rowH).lineWidth(0.5).strokeColor(C.border).stroke().restore();
    doc.fontSize(8).font('Helvetica-Oblique').fillColor(C.muted)
      .text('— No records on file —', L, Y + 5, { width: totalW, align: 'center' });
    return Y + rowH + 2;
  }

  doc.fontSize(8).font('Helvetica').fillColor(C.text);
  rows.forEach((row, ri) => {
    if (ri % 2 === 1) {
      doc.save().rect(L, Y, totalW, rowH).fill(C.rowAlt).restore();
    }
    let cx = L + 6;
    row.forEach((cell, i) => {
      doc.fillColor(C.text).text(val(cell), cx, Y + 5, { width: widths[i] - 8, ellipsis: true, lineBreak: false });
      cx += widths[i];
    });
    Y += rowH;
  });
  doc.save().rect(L, Y - rows.length * rowH, totalW, rows.length * rowH).lineWidth(0.5).strokeColor(C.border).stroke().restore();
  return Y + 2;
}

async function generateServiceBook(employeeId, tenantId) {
  const employee = await User.findOne({ _id: employeeId, tenantId }).lean();
  if (!employee) throw new Error('Employee not found');

  const schoolData = await getSchoolData(tenantId);
  const [logoBuffer, photoBuffer] = await Promise.all([
    fetchImageBuffer(schoolData.logo),
    fetchImageBuffer(employee.photo)
  ]);

  // Wider left/right margins leave a safe hole-punch margin on both edges
  const doc = new PDFDocument({ size: 'A4', margins: { top: 32, bottom: 32, left: 40, right: 40 } });
  const chunks = [];
  doc.on('data', c => chunks.push(c));
  const done = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const L = doc.page.margins.left;
  const R = doc.page.width - doc.page.margins.right;

  const ec = employee.emergencyContact || {};
  const ecPairs = filterPairs([
    ['Contact Name', ec.name],
    ['Contact Phone', ec.phone],
    ['Relationship', ec.relation]
  ]);
  const hasPage2Content = (
    (Array.isArray(employee.postings) && employee.postings.length) ||
    (Array.isArray(employee.promotions) && employee.promotions.length) ||
    (Array.isArray(employee.trainings) && employee.trainings.length) ||
    (Array.isArray(employee.awards) && employee.awards.length) ||
    ecPairs.length ||
    !!employee.serviceRemarks
  );

  /* ════════ PAGE 1 ════════ */
  let Y = drawHeader(doc, schoolData, logoBuffer, L, R, doc.page.margins.top, hasPage2Content ? 'Page 1 of 2' : 'Page 1 of 1');

  // Identity strip with photo, name, role, employee id
  const stripH = 70;
  roundRect(doc, L, Y, R - L, stripH, 6, C.tealBgSoft, C.tealBorder);
  const photoSize = 56;
  if (photoBuffer) {
    try {
      doc.save();
      doc.roundedRect(L + 8, Y + 7, photoSize, photoSize, 4).clip();
      doc.image(photoBuffer, L + 8, Y + 7, { width: photoSize, height: photoSize, fit: [photoSize, photoSize] });
      doc.restore();
    } catch (_) {
      roundRect(doc, L + 8, Y + 7, photoSize, photoSize, 4, C.logoBg);
    }
  } else {
    roundRect(doc, L + 8, Y + 7, photoSize, photoSize, 4, C.logoBg);
    doc.fontSize(20).font('Helvetica-Bold').fillColor(C.muted)
      .text((employee.name || '?').charAt(0).toUpperCase(), L + 8, Y + 24, { width: photoSize, align: 'center' });
  }
  const nx = L + 8 + photoSize + 14;
  doc.fontSize(14).font('Helvetica-Bold').fillColor(C.black).text(employee.name || '—', nx, Y + 10, { width: R - nx - 110 });
  const subtitleParts = [titleCase(employee.role), employee.designation, employee.department].filter(Boolean);
  if (subtitleParts.length) {
    doc.fontSize(8.5).font('Helvetica').fillColor(C.label)
      .text(subtitleParts.join(' · '), nx, Y + 30, { width: R - nx - 110 });
  }
  if (employee.dateOfJoining) {
    doc.fontSize(8).font('Helvetica').fillColor(C.label)
      .text(`Date of Joining: ${fmtDate(employee.dateOfJoining)}`, nx, Y + 46, { width: R - nx - 110 });
  }

  // Right side: Employee ID box
  const idBoxW = 100;
  const idBoxX = R - idBoxW - 8;
  roundRect(doc, idBoxX, Y + 12, idBoxW, 46, 5, C.white, C.tealBorder);
  doc.fontSize(7).font('Helvetica').fillColor(C.label)
    .text('EMPLOYEE ID', idBoxX, Y + 18, { width: idBoxW, align: 'center', characterSpacing: 1 });
  doc.fontSize(11).font('Helvetica-Bold').fillColor(C.tealDark)
    .text(val(employee.employeeId), idBoxX, Y + 32, { width: idBoxW, align: 'center' });
  Y += stripH + 12;

  // Personal Info
  const personalPairs = filterPairs([
    ['Full Name', employee.name],
    ['Date of Birth', fmtDateOpt(employee.dateOfBirth)],
    ['Gender', titleCase(employee.gender)],
    ['Marital Status', titleCase(employee.maritalStatus)],
    ['Father / Husband Name', employee.fatherOrHusbandName],
    ['Blood Group', employee.bloodGroup],
    ['Religion', employee.religion],
    ['Nationality', employee.nationality],
    ['National ID (Aadhaar)', employee.nationalId],
    ['Phone', employee.phone],
    ['Email', employee.email],
    ['Home Address', employee.homeAddress]
  ]);
  if (personalPairs.length) {
    Y = sectionTitle(doc, L, R, Y, 'Personal Information');
    Y = drawKvGrid(doc, L, R, Y, personalPairs, 2, 22);
    Y += 4;
  }

  // Appointment Details
  const appointmentPairs = filterPairs([
    ['Role', titleCase(employee.role)],
    ['Designation', employee.designation],
    ['Department', employee.department],
    ['Date of Joining', fmtDateOpt(employee.dateOfJoining)],
    ['Employment Type', titleCase(employee.employmentType)],
    ['Appointment Order No.', employee.appointmentOrderNo],
    ['Probation End Date', fmtDateOpt(employee.probationEndDate)],
    ['Reporting To', employee.reportingTo]
  ]);
  if (appointmentPairs.length) {
    Y = sectionTitle(doc, L, R, Y, 'Appointment Details');
    Y = drawKvGrid(doc, L, R, Y, appointmentPairs, 2, 22);
    Y += 4;
  }

  // Qualifications & Experience
  const qualPairs = filterPairs([
    ['Highest Education', employee.education],
    ['Specialization', employee.specialization],
    ['Total Experience', hasVal(employee.experience) ? `${employee.experience} year(s)` : ''],
    ['Previous Employer', employee.previousEmployer],
    ['Previous Designation', employee.previousDesignation],
    ['Subjects', Array.isArray(employee.subjects) && employee.subjects.length ? employee.subjects.join(', ') : '']
  ]);
  const hasQualSection = qualPairs.length || employee.qualifications || (Array.isArray(employee.certifications) && employee.certifications.length);
  if (hasQualSection) {
    Y = sectionTitle(doc, L, R, Y, 'Qualifications & Experience');
    Y = drawKvGrid(doc, L, R, Y, qualPairs, 2, 22);
  }

  if (employee.qualifications) {
    doc.fontSize(7).font('Helvetica').fillColor(C.label).text('DETAILED QUALIFICATIONS', L, Y, { width: R - L, characterSpacing: 0.5 });
    doc.fontSize(9).font('Helvetica-Bold').fillColor(C.text).text(employee.qualifications, L, Y + 9, { width: R - L });
    Y = doc.y + 4;
  }
  if (Array.isArray(employee.certifications) && employee.certifications.length) {
    doc.fontSize(7).font('Helvetica').fillColor(C.label).text('CERTIFICATIONS', L, Y, { width: R - L, characterSpacing: 0.5 });
    doc.fontSize(9).font('Helvetica-Bold').fillColor(C.text).text(employee.certifications.join(' · '), L, Y + 9, { width: R - L });
    Y = doc.y + 4;
  }

  // Educational Qualifications (structured table)
  if (Array.isArray(employee.educationalQualifications) && employee.educationalQualifications.length) {
    Y = sectionTitle(doc, L, R, Y, 'Educational Qualifications');
    const w = R - L;
    Y = drawTable(doc, L, R, Y,
      ['Examination / Degree', 'Board / University', 'Year', 'Division', '% / CGPA'],
      employee.educationalQualifications.map(q => [val(q.degree), val(q.boardOrUniversity), val(q.yearOfPassing), val(q.division), val(q.percentage)]),
      [w * 0.24, w * 0.32, w * 0.12, w * 0.16, w * 0.16]
    );
    Y += 4;
  }

  if (hasPage2Content) {
    // Page 1 footer
    const p1FooterY = doc.page.height - doc.page.margins.bottom - 12;
    doc.fontSize(7).font('Helvetica-Oblique').fillColor(C.muted)
      .text(`Service Book — ${employee.name || ''} (${employee.employeeId || ''})   ·   continued on next page`, L, p1FooterY, { width: R - L, align: 'center' });

    /* ════════ PAGE 2 ════════ */
    doc.addPage();
    Y = drawHeader(doc, schoolData, logoBuffer, L, R, doc.page.margins.top, 'Page 2 of 2');
  }

  // Postings
  if (Array.isArray(employee.postings) && employee.postings.length) {
    Y = sectionTitle(doc, L, R, Y, 'Postings / Transfers');
    const w = R - L;
    Y = drawTable(doc, L, R, Y,
      ['From', 'To', 'Post', 'Location', 'Remarks'],
      employee.postings.map(p => [fmtDate(p.fromDate), fmtDate(p.toDate), val(p.post), val(p.location), val(p.remarks)]),
      [w * 0.14, w * 0.14, w * 0.22, w * 0.22, w * 0.28]
    );
    Y += 6;
  }

  // Promotions
  if (Array.isArray(employee.promotions) && employee.promotions.length) {
    Y = sectionTitle(doc, L, R, Y, 'Promotions');
    const w = R - L;
    Y = drawTable(doc, L, R, Y,
      ['Date', 'From', 'To', 'Order No.', 'Remarks'],
      employee.promotions.map(p => [fmtDate(p.date), val(p.fromDesignation), val(p.toDesignation), val(p.orderNo), val(p.remarks)]),
      [w * 0.14, w * 0.22, w * 0.22, w * 0.18, w * 0.24]
    );
    Y += 6;
  }

  // Trainings
  if (Array.isArray(employee.trainings) && employee.trainings.length) {
    Y = sectionTitle(doc, L, R, Y, 'Trainings Attended');
    const w = R - L;
    Y = drawTable(doc, L, R, Y,
      ['Training', 'From', 'To', 'Institute', 'Remarks'],
      employee.trainings.map(t => [val(t.name), fmtDate(t.fromDate), fmtDate(t.toDate), val(t.institute), val(t.remarks)]),
      [w * 0.24, w * 0.14, w * 0.14, w * 0.22, w * 0.26]
    );
    Y += 6;
  }

  // Awards
  if (Array.isArray(employee.awards) && employee.awards.length) {
    Y = sectionTitle(doc, L, R, Y, 'Awards & Recognitions');
    const w = R - L;
    Y = drawTable(doc, L, R, Y,
      ['Award', 'Date', 'Description'],
      employee.awards.map(a => [val(a.name), fmtDate(a.date), val(a.description)]),
      [w * 0.30, w * 0.18, w * 0.52]
    );
    Y += 6;
  }

  // Emergency contact
  if (ecPairs.length) {
    Y = sectionTitle(doc, L, R, Y, 'Emergency Contact');
    Y = drawKvGrid(doc, L, R, Y, ecPairs, 3, 22);
    Y += 2;
  }

  // Service remarks
  if (employee.serviceRemarks) {
    Y = sectionTitle(doc, L, R, Y, 'Service Remarks');
    doc.fontSize(8.5).font('Helvetica').fillColor(C.text).text(employee.serviceRemarks, L, Y, { width: R - L });
    Y = doc.y + 6;
  }

  // Signature block at fixed position above footer
  const sigY = doc.page.height - doc.page.margins.bottom - 70;
  const sigW = 170;
  line(doc, L, sigY, L + sigW, C.text, 0.7);
  line(doc, R - sigW, sigY, R, C.text, 0.7);
  doc.fontSize(8.5).font('Helvetica-Bold').fillColor(C.text)
    .text('Employee Signature', L, sigY + 5, { width: sigW, align: 'center' })
    .text('Authorised Signatory', R - sigW, sigY + 5, { width: sigW, align: 'center' });
  doc.fontSize(7.5).font('Helvetica').fillColor(C.label)
    .text(`Date: ${fmtDate(new Date())}`, L, sigY + 22, { width: sigW, align: 'center' })
    .text('Principal / HR Head', R - sigW, sigY + 22, { width: sigW, align: 'center' });

  // Final footer (page 2 if added, otherwise page 1)
  const finalFooterY = doc.page.height - doc.page.margins.bottom - 12;
  doc.fontSize(7).font('Helvetica-Oblique').fillColor(C.muted)
    .text(`Generated on ${fmtDate(new Date())} · ${schoolData.schoolName} · Confidential`, L, finalFooterY, { width: R - L, align: 'center' });

  doc.end();
  return done;
}

module.exports = { generateServiceBook };
