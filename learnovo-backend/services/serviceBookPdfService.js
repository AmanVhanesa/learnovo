'use strict';

const PDFDocument = require('pdfkit');
const axios = require('axios');
const User = require('../models/User');
const Settings = require('../models/Settings');

const C = {
  black: '#0f172a',
  text: '#111827',
  label: '#6b7280',
  muted: '#9ca3af',
  border: '#e5e7eb',
  borderLight: '#f3f4f6',
  teal: '#0f766e',
  tealBg: '#f0fdfa',
  tealBorder: '#ccfbf1',
  white: '#ffffff',
  logoBg: '#f3f4f6',
  rowAlt: '#f8fafc'
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
function val(v) {
  if (v === null || v === undefined || v === '') return '—';
  return String(v);
}
function titleCase(s) {
  if (!s) return '—';
  return String(s).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function drawHeader(doc, schoolData, logoBuffer, L, R, startY) {
  let Y = startY;
  const schoolName = (schoolData.schoolName || 'School').toUpperCase();
  const initials = schoolName.split(' ').filter(w => w.length > 1).map(w => w[0]).join('').slice(0, 2);
  const logoSize = 48;

  if (logoBuffer) {
    try {
      roundRect(doc, L, Y, logoSize, logoSize, 8, C.logoBg);
      doc.image(logoBuffer, L + 4, Y + 4, { width: logoSize - 8, height: logoSize - 8, fit: [logoSize - 8, logoSize - 8] });
    } catch (_) {
      roundRect(doc, L, Y, logoSize, logoSize, 8, C.logoBg);
      doc.fontSize(18).font('Helvetica-Bold').fillColor(C.label).text(initials, L, Y + 14, { width: logoSize, align: 'center' });
    }
  } else {
    roundRect(doc, L, Y, logoSize, logoSize, 8, C.logoBg);
    doc.fontSize(18).font('Helvetica-Bold').fillColor(C.label).text(initials, L, Y + 14, { width: logoSize, align: 'center' });
  }

  const infoX = L + logoSize + 14;
  doc.fontSize(14).font('Helvetica-Bold').fillColor(C.black).text(schoolName, infoX, Y, { width: R - infoX });
  Y = doc.y + 1;
  doc.fontSize(7.5).font('Helvetica').fillColor(C.label);
  if (schoolData.fullAddress) {
    doc.text(schoolData.fullAddress, infoX, Y, { width: R - infoX }); Y = doc.y;
  }
  const contactParts = [];
  if (schoolData.phone) contactParts.push(schoolData.phone);
  if (schoolData.email) contactParts.push(schoolData.email);
  if (contactParts.length) {
    doc.text(contactParts.join('  ·  '), infoX, Y, { width: R - infoX }); Y = doc.y;
  }
  const detailParts = [];
  if (schoolData.board) detailParts.push(schoolData.board);
  if (schoolData.affiliationNumber) detailParts.push(`Affn: ${schoolData.affiliationNumber}`);
  if (schoolData.schoolCode) detailParts.push(`Code: ${schoolData.schoolCode}`);
  if (schoolData.udiseCode) detailParts.push(`UDISE: ${schoolData.udiseCode}`);
  if (detailParts.length) {
    doc.text(detailParts.join('  ·  '), infoX, Y, { width: R - infoX }); Y = doc.y;
  }

  Y = Math.max(doc.y, startY + logoSize) + 12;
  line(doc, L, Y, R);
  Y += 14;
  return Y;
}

function ensureSpace(doc, neededY, bottom, schoolData, logoBuffer, L, R) {
  if (neededY > bottom) {
    doc.addPage();
    return drawHeader(doc, schoolData, logoBuffer, L, R, doc.page.margins.top);
  }
  return neededY;
}

function sectionTitle(doc, L, R, Y, label) {
  roundRect(doc, L, Y, R - L, 20, 4, C.tealBg, C.tealBorder);
  doc.fontSize(9.5).font('Helvetica-Bold').fillColor(C.teal).text(label, L + 8, Y + 6);
  return Y + 26;
}

function drawKvGrid(doc, L, R, Y, pairs, cols = 2) {
  const colW = (R - L) / cols;
  const rowH = 26;
  const rows = Math.ceil(pairs.length / cols);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      if (idx >= pairs.length) continue;
      const [k, v] = pairs[idx];
      const x = L + c * colW;
      const y = Y + r * rowH;
      doc.fontSize(7.5).font('Helvetica').fillColor(C.label).text(k.toUpperCase(), x, y, { width: colW - 8 });
      doc.fontSize(9.5).font('Helvetica-Bold').fillColor(C.text).text(val(v), x, y + 10, { width: colW - 8 });
    }
  }
  return Y + rows * rowH + 4;
}

function drawTable(doc, L, R, Y, headers, rows, colWidths) {
  const totalW = R - L;
  const widths = colWidths || headers.map(() => totalW / headers.length);

  // Header
  roundRect(doc, L, Y, totalW, 18, 3, C.borderLight, C.border);
  let x = L + 6;
  doc.fontSize(8).font('Helvetica-Bold').fillColor(C.label);
  headers.forEach((h, i) => {
    doc.text(h.toUpperCase(), x, Y + 5, { width: widths[i] - 6 });
    x += widths[i];
  });
  Y += 18;

  if (rows.length === 0) {
    doc.fontSize(8.5).font('Helvetica-Oblique').fillColor(C.muted).text('No records', L + 6, Y + 4);
    return Y + 18;
  }

  doc.fontSize(8.5).font('Helvetica').fillColor(C.text);
  rows.forEach((row, ri) => {
    const rowH = 22;
    if (ri % 2 === 1) {
      doc.save().rect(L, Y, totalW, rowH).fill(C.rowAlt).restore();
    }
    let cx = L + 6;
    row.forEach((cell, i) => {
      doc.fillColor(C.text).text(val(cell), cx, Y + 6, { width: widths[i] - 8, ellipsis: true });
      cx += widths[i];
    });
    Y += rowH;
  });

  return Y + 4;
}

async function generateServiceBook(employeeId, tenantId) {
  const employee = await User.findOne({ _id: employeeId, tenantId }).lean();
  if (!employee) throw new Error('Employee not found');

  const schoolData = await getSchoolData(tenantId);
  const [logoBuffer, photoBuffer] = await Promise.all([
    fetchImageBuffer(schoolData.logo),
    fetchImageBuffer(employee.photo)
  ]);

  const doc = new PDFDocument({ size: 'A4', margin: 36 });
  const chunks = [];
  doc.on('data', c => chunks.push(c));
  const done = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const L = doc.page.margins.left;
  const R = doc.page.width - doc.page.margins.right;
  const bottom = doc.page.height - doc.page.margins.bottom;

  let Y = drawHeader(doc, schoolData, logoBuffer, L, R, doc.page.margins.top);

  // Document title
  doc.fontSize(13).font('Helvetica-Bold').fillColor(C.black).text('Employee Service Book', L, Y, { width: R - L, align: 'center' });
  Y = doc.y + 4;
  doc.fontSize(8).font('Helvetica').fillColor(C.label).text(`Generated on ${fmtDate(new Date())}`, L, Y, { width: R - L, align: 'center' });
  Y = doc.y + 12;

  // Identity strip: photo + name + employee id
  const stripH = 64;
  roundRect(doc, L, Y, R - L, stripH, 6, C.white, C.border);
  const photoSize = 52;
  if (photoBuffer) {
    try {
      doc.save();
      doc.roundedRect(L + 8, Y + 6, photoSize, photoSize, 4).clip();
      doc.image(photoBuffer, L + 8, Y + 6, { width: photoSize, height: photoSize, fit: [photoSize, photoSize] });
      doc.restore();
    } catch (_) {
      roundRect(doc, L + 8, Y + 6, photoSize, photoSize, 4, C.logoBg);
    }
  } else {
    roundRect(doc, L + 8, Y + 6, photoSize, photoSize, 4, C.logoBg);
  }
  const nx = L + 8 + photoSize + 14;
  doc.fontSize(13).font('Helvetica-Bold').fillColor(C.black).text(employee.name || '—', nx, Y + 8, { width: R - nx - 8 });
  doc.fontSize(8.5).font('Helvetica').fillColor(C.label)
    .text(`${titleCase(employee.role)}${employee.designation ? ` · ${  employee.designation}` : ''}${employee.department ? ` · ${  employee.department}` : ''}`, nx, Y + 26, { width: R - nx - 8 });
  doc.fontSize(8.5).font('Helvetica-Bold').fillColor(C.teal)
    .text(`Employee ID: ${val(employee.employeeId)}`, nx, Y + 42, { width: R - nx - 8 });
  Y += stripH + 14;

  // ── Personal Info ──
  Y = ensureSpace(doc, Y, bottom, schoolData, logoBuffer, L, R);
  Y = sectionTitle(doc, L, R, Y, 'Personal Information');
  Y = drawKvGrid(doc, L, R, Y, [
    ['Full Name', employee.name],
    ['Date of Birth', fmtDate(employee.dateOfBirth)],
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
  Y += 6;

  // ── Appointment Details ──
  Y = ensureSpace(doc, Y + 80, bottom, schoolData, logoBuffer, L, R);
  Y = sectionTitle(doc, L, R, Y, 'Appointment Details');
  Y = drawKvGrid(doc, L, R, Y, [
    ['Role', titleCase(employee.role)],
    ['Designation', employee.designation],
    ['Department', employee.department],
    ['Date of Joining', fmtDate(employee.dateOfJoining)],
    ['Employment Type', titleCase(employee.employmentType)],
    ['Appointment Order No.', employee.appointmentOrderNo],
    ['Probation End Date', fmtDate(employee.probationEndDate)],
    ['Reporting To', employee.reportingTo]
  ]);
  Y += 6;

  // ── Qualifications ──
  Y = ensureSpace(doc, Y + 80, bottom, schoolData, logoBuffer, L, R);
  Y = sectionTitle(doc, L, R, Y, 'Qualifications & Experience');
  Y = drawKvGrid(doc, L, R, Y, [
    ['Highest Education', employee.education],
    ['Specialization', employee.specialization],
    ['Total Experience', employee.experience !== undefined && employee.experience !== null ? `${employee.experience} year(s)` : '—'],
    ['Previous Employer', employee.previousEmployer],
    ['Previous Designation', employee.previousDesignation],
    ['Subjects', Array.isArray(employee.subjects) && employee.subjects.length ? employee.subjects.join(', ') : '—']
  ]);
  if (employee.qualifications) {
    doc.fontSize(7.5).font('Helvetica').fillColor(C.label).text('DETAILED QUALIFICATIONS', L, Y, { width: R - L });
    doc.fontSize(9).font('Helvetica').fillColor(C.text).text(employee.qualifications, L, Y + 10, { width: R - L });
    Y = doc.y + 6;
  }
  if (Array.isArray(employee.certifications) && employee.certifications.length) {
    doc.fontSize(7.5).font('Helvetica').fillColor(C.label).text('CERTIFICATIONS', L, Y, { width: R - L });
    doc.fontSize(9).font('Helvetica').fillColor(C.text).text(employee.certifications.join(' · '), L, Y + 10, { width: R - L });
    Y = doc.y + 6;
  }

  // ── Postings / Transfers ──
  Y = ensureSpace(doc, Y + 80, bottom, schoolData, logoBuffer, L, R);
  Y = sectionTitle(doc, L, R, Y, 'Postings / Transfers');
  {
    const w = R - L;
    Y = drawTable(doc, L, R, Y,
      ['From', 'To', 'Post', 'Location', 'Remarks'],
      (employee.postings || []).map(p => [fmtDate(p.fromDate), fmtDate(p.toDate), val(p.post), val(p.location), val(p.remarks)]),
      [w * 0.14, w * 0.14, w * 0.22, w * 0.22, w * 0.28]
    );
  }

  // ── Promotions ──
  Y = ensureSpace(doc, Y + 60, bottom, schoolData, logoBuffer, L, R);
  Y = sectionTitle(doc, L, R, Y, 'Promotions');
  {
    const w = R - L;
    Y = drawTable(doc, L, R, Y,
      ['Date', 'From', 'To', 'Order No.', 'Remarks'],
      (employee.promotions || []).map(p => [fmtDate(p.date), val(p.fromDesignation), val(p.toDesignation), val(p.orderNo), val(p.remarks)]),
      [w * 0.14, w * 0.22, w * 0.22, w * 0.18, w * 0.24]
    );
  }

  // ── Trainings ──
  Y = ensureSpace(doc, Y + 60, bottom, schoolData, logoBuffer, L, R);
  Y = sectionTitle(doc, L, R, Y, 'Trainings Attended');
  {
    const w = R - L;
    Y = drawTable(doc, L, R, Y,
      ['Training', 'From', 'To', 'Institute', 'Remarks'],
      (employee.trainings || []).map(t => [val(t.name), fmtDate(t.fromDate), fmtDate(t.toDate), val(t.institute), val(t.remarks)]),
      [w * 0.24, w * 0.14, w * 0.14, w * 0.22, w * 0.26]
    );
  }

  // ── Awards ──
  Y = ensureSpace(doc, Y + 60, bottom, schoolData, logoBuffer, L, R);
  Y = sectionTitle(doc, L, R, Y, 'Awards & Recognitions');
  {
    const w = R - L;
    Y = drawTable(doc, L, R, Y,
      ['Award', 'Date', 'Description'],
      (employee.awards || []).map(a => [val(a.name), fmtDate(a.date), val(a.description)]),
      [w * 0.30, w * 0.18, w * 0.52]
    );
  }

  // ── Emergency & Remarks ──
  Y = ensureSpace(doc, Y + 80, bottom, schoolData, logoBuffer, L, R);
  Y = sectionTitle(doc, L, R, Y, 'Emergency Contact & Remarks');
  const ec = employee.emergencyContact || {};
  Y = drawKvGrid(doc, L, R, Y, [
    ['Contact Name', ec.name],
    ['Contact Phone', ec.phone],
    ['Relationship', ec.relation]
  ], 3);
  if (employee.serviceRemarks) {
    doc.fontSize(7.5).font('Helvetica').fillColor(C.label).text('SERVICE REMARKS', L, Y, { width: R - L });
    doc.fontSize(9).font('Helvetica').fillColor(C.text).text(employee.serviceRemarks, L, Y + 10, { width: R - L });
    Y = doc.y + 6;
  }

  // Footer signature line
  Y = ensureSpace(doc, Y + 60, bottom, schoolData, logoBuffer, L, R);
  Y += 24;
  const sigW = 160;
  line(doc, L, Y, L + sigW, C.text);
  line(doc, R - sigW, Y, R, C.text);
  doc.fontSize(8).font('Helvetica').fillColor(C.label)
    .text('Employee Signature', L, Y + 4, { width: sigW, align: 'center' })
    .text('Authorised Signatory', R - sigW, Y + 4, { width: sigW, align: 'center' });

  doc.end();
  return done;
}

module.exports = { generateServiceBook };
