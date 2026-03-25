'use strict';

const PDFDocument = require('pdfkit');
const Payroll = require('../models/Payroll');
const User = require('../models/User');
const Settings = require('../models/Settings');
const axios = require('axios');

/* ── Color palette (matching receipt design) ──────────────────────────── */
const C = {
    black: '#0f172a',
    text: '#111827',
    label: '#6b7280',
    muted: '#9ca3af',
    border: '#e5e7eb',
    borderLight: '#f3f4f6',
    teal: '#0f766e',
    tealDark: '#134e4a',
    tealBg: '#f0fdfa',
    tealBorder: '#ccfbf1',
    tealLight: '#99f6e4',
    blue: '#2563eb',
    blueBg: '#eff6ff',
    green: '#059669',
    greenBg: '#ecfdf5',
    greenBorder: '#d1fae5',
    red: '#dc2626',
    redLight: '#fef2f2',
    white: '#ffffff',
    logoBg: '#f3f4f6',
    rowAlt: '#f8fafc',
    headerBg: '#0f766e',
};

/**
 * Fetch an image from a URL and return a Buffer.
 */
async function fetchImageBuffer(url) {
    if (!url) return null;
    try {
        const fullUrl = url.startsWith('http') ? url : `https://learnovo-backend.onrender.com${url}`;
        const response = await axios.get(fullUrl, {
            responseType: 'arraybuffer',
            timeout: 8000,
            maxRedirects: 5
        });
        const buf = Buffer.from(response.data);
        if (buf.length < 100) return null;
        return buf;
    } catch (err) {
        console.warn('[payrollPdfService] Could not fetch image:', url, '—', err.message);
        return null;
    }
}

/**
 * Get mapped school settings from tenant settings
 */
async function getSchoolData(tenantId) {
    const settings = await Settings.findOne({ tenantId }).lean();
    const inst = settings?.institution || {};
    const addr = inst.address || {};
    const contact = inst.contact || {};

    const addressParts = [addr.street, addr.city, addr.state, addr.pincode].filter(Boolean);

    return {
        schoolName: inst.name || 'School Name',
        logo: inst.logo || null,
        principalSignature: inst.principalSignature || null,
        fullAddress: addressParts.join(', '),
        phone: contact.phone || '',
        email: contact.email || '',
        board: inst.board || '',
        affiliationNumber: inst.affiliationNumber || '',
        schoolCode: inst.schoolCode || '',
        udiseCode: inst.udiseCode || '',
    };
}

/* ── PDF drawing helpers ──────────────────────────────────────────────── */

function line(doc, x1, y, x2, color = C.border, w = 0.5) {
    doc.save().moveTo(x1, y).lineTo(x2, y).lineWidth(w).strokeColor(color).stroke().restore();
}

function roundRect(doc, x, y, w, h, r, fill, stroke) {
    doc.roundedRect(x, y, w, h, r);
    if (fill) doc.fill(fill);
    if (stroke) { doc.roundedRect(x, y, w, h, r); doc.lineWidth(0.75).strokeColor(stroke).stroke(); }
}

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Shared header for all payroll PDFs — matches receipt design
 */
function drawHeader(doc, schoolData, logoBuffer, L, R, W, startY) {
    let Y = startY;

    const schoolName = (schoolData.schoolName || 'School').toUpperCase();
    const initials = schoolName.split(' ').filter(w => w.length > 1).map(w => w[0]).join('').slice(0, 2);

    // Logo
    const logoSize = 48;
    if (logoBuffer) {
        try {
            roundRect(doc, L, Y, logoSize, logoSize, 8, C.logoBg);
            doc.image(logoBuffer, L + 4, Y + 4, { width: logoSize - 8, height: logoSize - 8, fit: [logoSize - 8, logoSize - 8] });
        } catch (_) {
            roundRect(doc, L, Y, logoSize, logoSize, 8, C.logoBg);
            doc.fontSize(18).font('Helvetica-Bold').fillColor(C.label)
                .text(initials, L, Y + 14, { width: logoSize, align: 'center' });
        }
    } else {
        roundRect(doc, L, Y, logoSize, logoSize, 8, C.logoBg);
        doc.fontSize(18).font('Helvetica-Bold').fillColor(C.label)
            .text(initials, L, Y + 14, { width: logoSize, align: 'center' });
    }

    // School info
    const infoX = L + logoSize + 14;
    doc.fontSize(14).font('Helvetica-Bold').fillColor(C.black)
        .text(schoolName, infoX, Y, { width: R - infoX });

    Y = doc.y + 1;
    doc.fontSize(7.5).font('Helvetica').fillColor(C.label);
    if (schoolData.fullAddress) { doc.text(schoolData.fullAddress, infoX, Y, { width: R - infoX }); Y = doc.y; }

    const contactParts = [];
    if (schoolData.phone) contactParts.push(schoolData.phone);
    if (schoolData.email) contactParts.push(schoolData.email);
    if (contactParts.length) { doc.text(contactParts.join('  ·  '), infoX, Y, { width: R - infoX }); Y = doc.y; }

    const detailParts = [];
    if (schoolData.board) detailParts.push(schoolData.board);
    if (schoolData.affiliationNumber) detailParts.push(`Affn: ${schoolData.affiliationNumber}`);
    if (schoolData.schoolCode) detailParts.push(`Code: ${schoolData.schoolCode}`);
    if (schoolData.udiseCode) detailParts.push(`UDISE: ${schoolData.udiseCode}`);
    if (detailParts.length) { doc.text(detailParts.join('  ·  '), infoX, Y, { width: R - infoX }); Y = doc.y; }

    Y = Math.max(doc.y, startY + logoSize) + 12;
    line(doc, L, Y, R);
    Y += 14;

    return Y;
}

/**
 * Draw a colored badge bar (title section)
 */
function drawBadge(doc, L, Y, W, title, subtitle, bgColor = C.tealBg, accentColor = C.teal, textColor = C.teal) {
    const badgeH = subtitle ? 34 : 26;
    roundRect(doc, L, Y, W, badgeH, 4, bgColor);
    roundRect(doc, L, Y, 3.5, badgeH, 2, accentColor);

    doc.fontSize(10).font('Helvetica-Bold').fillColor(textColor)
        .text(title, L + 14, Y + (subtitle ? 5 : 7));

    if (subtitle) {
        doc.fontSize(8).font('Helvetica').fillColor(C.label)
            .text(subtitle, L + 14, Y + 19);
    }

    return Y + badgeH + 16;
}

/**
 * Draw a two-column info row
 */
function drawInfoRow(doc, colX, y, label, value, labelW = 75, colW = 200, valColor = C.text) {
    doc.fontSize(7.5).font('Helvetica').fillColor(C.label).text(label, colX, y, { width: labelW });
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor(valColor).text(value || '-', colX + labelW, y, { width: colW - labelW });
}

/* ═══════════════════════════════════════════════════════════════════════════
   SALARY SLIP — Individual employee
   ═══════════════════════════════════════════════════════════════════════════ */

async function generateSalarySlip(payrollId) {
    const payroll = await Payroll.findById(payrollId)
        .populate('employeeId', 'name employeeId email phone designation department bankName accountNumber ifscCode')
        .populate('advanceDeductions.advanceId', 'amount reason requestDate')
        .lean();

    if (!payroll) throw new Error('Payroll record not found');

    const schoolData = await getSchoolData(payroll.tenantId);
    const logoBuffer = await fetchImageBuffer(schoolData.logo);
    const signatureBuffer = await fetchImageBuffer(schoolData.principalSignature);

    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });
        const chunks = [];
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', err => reject(err));

        try {
            buildSalarySlip(doc, payroll, schoolData, logoBuffer, signatureBuffer);
            doc.end();
        } catch (err) {
            try { doc.destroy(); } catch (_) { /* ignore */ }
            reject(err);
        }
    });
}

function buildSalarySlip(doc, payroll, schoolData, logoBuffer, signatureBuffer) {
    const L = 40;
    const R = 555;
    const W = R - L;
    const emp = payroll.employeeId || {};
    const monthYear = `${MONTH_NAMES[payroll.month - 1]} ${payroll.year}`;

    // ── Header
    let Y = drawHeader(doc, schoolData, logoBuffer, L, R, W, 40);

    // ── Badge
    Y = drawBadge(doc, L, Y, W, 'SALARY SLIP', `For the month of ${monthYear}`);

    // ── Employee Info (two columns)
    const colGap = 30;
    const colW = (W - colGap) / 2;
    const col1X = L;
    const col2X = L + colW + colGap;

    doc.fontSize(7).font('Helvetica-Bold').fillColor(C.label);
    doc.text('EMPLOYEE DETAILS', col1X, Y);
    doc.text('EMPLOYMENT INFO', col2X, Y);
    Y += 10;
    line(doc, col1X, Y, col1X + colW, C.border, 0.75);
    line(doc, col2X, Y, col2X + colW, C.border, 0.75);
    Y += 8;

    drawInfoRow(doc, col1X, Y, 'Name', emp.name, 75, colW);
    drawInfoRow(doc, col2X, Y, 'Employee ID', emp.employeeId || 'N/A', 80, colW);
    Y += 16;
    drawInfoRow(doc, col1X, Y, 'Department', emp.department || 'N/A', 75, colW);
    drawInfoRow(doc, col2X, Y, 'Designation', emp.designation || 'N/A', 80, colW);
    Y += 16;
    drawInfoRow(doc, col1X, Y, 'Phone', emp.phone || '-', 75, colW);
    drawInfoRow(doc, col2X, Y, 'Email', emp.email || '-', 80, colW);
    Y += 24;

    // ── Earnings & Deductions (side by side)
    const earnW = (W - 20) / 2;
    const dedX = L + earnW + 20;

    // Earnings section
    doc.fontSize(7).font('Helvetica-Bold').fillColor(C.teal);
    doc.text('EARNINGS', L, Y);
    doc.text('DEDUCTIONS', dedX, Y);
    Y += 10;

    // Earnings header row
    const earnHeaderY = Y;
    roundRect(doc, L, Y, earnW, 18, 3, C.tealBg);
    doc.fontSize(7).font('Helvetica-Bold').fillColor(C.teal);
    doc.text('Description', L + 8, Y + 5, { width: earnW - 80 });
    doc.text('Amount', L + earnW - 72, Y + 5, { width: 64, align: 'right' });

    // Deductions header row
    roundRect(doc, dedX, Y, earnW, 18, 3, C.redLight);
    doc.fontSize(7).font('Helvetica-Bold').fillColor(C.red);
    doc.text('Description', dedX + 8, Y + 5, { width: earnW - 80 });
    doc.text('Amount', dedX + earnW - 72, Y + 5, { width: 64, align: 'right' });
    Y += 24;

    // Earnings rows
    let earnY = Y;
    const fmtAmt = (n) => `₹${(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

    doc.fontSize(8).font('Helvetica').fillColor(C.text);
    doc.text('Base Salary', L + 8, earnY, { width: earnW - 80 });
    doc.font('Helvetica-Bold').text(fmtAmt(payroll.baseSalary), L + earnW - 72, earnY, { width: 64, align: 'right' });
    earnY += 16;

    if (payroll.bonuses > 0) {
        doc.font('Helvetica').text('Bonuses', L + 8, earnY, { width: earnW - 80 });
        doc.font('Helvetica-Bold').text(fmtAmt(payroll.bonuses), L + earnW - 72, earnY, { width: 64, align: 'right' });
        earnY += 16;
    }

    // Total Earnings
    const totalEarnings = (payroll.baseSalary || 0) + (payroll.bonuses || 0);
    earnY += 4;
    line(doc, L + 4, earnY, L + earnW - 4, C.tealBorder);
    earnY += 6;
    doc.fontSize(8).font('Helvetica-Bold').fillColor(C.teal);
    doc.text('Total Earnings', L + 8, earnY, { width: earnW - 80 });
    doc.text(fmtAmt(totalEarnings), L + earnW - 72, earnY, { width: 64, align: 'right' });

    // Deduction rows
    let dedY = Y;
    doc.fontSize(8).font('Helvetica').fillColor(C.text);

    if (payroll.leaveDeduction > 0) {
        doc.text('Leave Deduction', dedX + 8, dedY, { width: earnW - 80 });
        doc.font('Helvetica-Bold').fillColor(C.red).text(fmtAmt(payroll.leaveDeduction), dedX + earnW - 72, dedY, { width: 64, align: 'right' });
        dedY += 16;
    }

    if (payroll.otherDeductions > 0) {
        doc.font('Helvetica').fillColor(C.text).text('Other Deductions', dedX + 8, dedY, { width: earnW - 80 });
        doc.font('Helvetica-Bold').fillColor(C.red).text(fmtAmt(payroll.otherDeductions), dedX + earnW - 72, dedY, { width: 64, align: 'right' });
        dedY += 16;
    }

    if (payroll.advanceDeductions && payroll.advanceDeductions.length > 0) {
        payroll.advanceDeductions.forEach((adv) => {
            const reason = adv.advanceId?.reason || 'Advance';
            doc.font('Helvetica').fillColor(C.text).fontSize(7.5).text(reason, dedX + 8, dedY, { width: earnW - 80 });
            doc.font('Helvetica-Bold').fillColor(C.red).fontSize(8).text(fmtAmt(adv.amount), dedX + earnW - 72, dedY, { width: 64, align: 'right' });
            dedY += 16;
        });
    }

    if (dedY === Y) {
        // No deductions
        doc.font('Helvetica').fillColor(C.muted).fontSize(8).text('No deductions', dedX + 8, dedY);
        dedY += 16;
    }

    // Total Deductions
    const totalDeductions = (payroll.leaveDeduction || 0) + (payroll.otherDeductions || 0) + (payroll.totalAdvanceDeduction || 0);
    dedY += 4;
    line(doc, dedX + 4, dedY, dedX + earnW - 4, '#fecaca');
    dedY += 6;
    doc.fontSize(8).font('Helvetica-Bold').fillColor(C.red);
    doc.text('Total Deductions', dedX + 8, dedY, { width: earnW - 80 });
    doc.text(fmtAmt(totalDeductions), dedX + earnW - 72, dedY, { width: 64, align: 'right' });

    Y = Math.max(earnY, dedY) + 28;

    // ── Net Salary Box
    const netBoxH = 50;
    roundRect(doc, L, Y, W, netBoxH, 6, C.tealBg, C.tealBorder);
    // Teal accent bar on left
    roundRect(doc, L, Y, 4, netBoxH, 2, C.teal);

    doc.fontSize(8).font('Helvetica-Bold').fillColor(C.teal)
        .text('NET SALARY', L + 16, Y + 10);
    doc.fontSize(7).font('Helvetica').fillColor(C.label)
        .text('Amount payable after all deductions', L + 16, Y + 22);

    const netStr = `₹ ${(payroll.netSalary || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    doc.fontSize(24).font('Helvetica-Bold').fillColor(C.tealDark)
        .text(netStr, L + 16, Y + 8, { width: W - 32, align: 'right' });

    Y += netBoxH + 16;

    // ── Payment Status row
    const statusColor = payroll.paymentStatus === 'paid' ? C.green : '#d97706';
    const statusBg = payroll.paymentStatus === 'paid' ? C.greenBg : '#fffbeb';
    const statusBorder = payroll.paymentStatus === 'paid' ? C.greenBorder : '#fef3c7';

    roundRect(doc, L, Y, W, 22, 4, statusBg, statusBorder);
    doc.fontSize(8).font('Helvetica-Bold').fillColor(statusColor)
        .text(`Payment Status: ${(payroll.paymentStatus || 'pending').toUpperCase()}`, L + 12, Y + 6);

    if (payroll.paymentDate) {
        const payDate = new Date(payroll.paymentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        doc.fontSize(8).font('Helvetica').fillColor(C.label)
            .text(`Paid on: ${payDate}`, L + 12, Y + 6, { width: W - 24, align: 'right' });
    }

    Y += 38;

    // ── Bank Details (if available)
    if (emp.bankName || emp.accountNumber || emp.ifscCode) {
        doc.fontSize(7).font('Helvetica-Bold').fillColor(C.label).text('BANK DETAILS', L, Y);
        Y += 10;
        line(doc, L, Y, R, C.border, 0.75);
        Y += 8;

        const bankParts = [];
        if (emp.bankName) bankParts.push(`Bank: ${emp.bankName}`);
        if (emp.accountNumber) bankParts.push(`A/C: ${emp.accountNumber}`);
        if (emp.ifscCode) bankParts.push(`IFSC: ${emp.ifscCode}`);
        doc.fontSize(8).font('Helvetica').fillColor(C.text).text(bankParts.join('    ·    '), L, Y);
        Y += 24;
    }

    // ── Signatures
    const sigLineW = 140;
    const sig1X = L + 10;
    const sig2X = R - sigLineW - 10;

    // Push signatures to lower area if there's space
    const minSigY = Y + 20;
    const idealSigY = doc.page.height - 140;
    Y = Math.max(minSigY, idealSigY);

    if (signatureBuffer) {
        try {
            doc.image(signatureBuffer, sig2X + 10, Y - 6, { width: 120, height: 42, fit: [120, 42] });
        } catch (_) { /* skip */ }
    }

    const sigLineY = Y + 40;
    doc.save().moveTo(sig1X, sigLineY).lineTo(sig1X + sigLineW, sigLineY)
        .lineWidth(0.75).strokeColor('#d1d5db').stroke().restore();
    doc.save().moveTo(sig2X, sigLineY).lineTo(sig2X + sigLineW, sigLineY)
        .lineWidth(0.75).strokeColor('#d1d5db').stroke().restore();

    doc.fontSize(7.5).font('Helvetica').fillColor(C.label);
    doc.text('Employee Signature', sig1X, sigLineY + 5, { width: sigLineW, align: 'center' });
    doc.text('Authorized Signatory', sig2X, sigLineY + 5, { width: sigLineW, align: 'center' });

    Y = sigLineY + 28;

    // ── Footer
    line(doc, L, Y, R);
    doc.fontSize(6.5).font('Helvetica').fillColor(C.muted)
        .text('Computer-generated salary slip. Valid without physical signature.  ·  Powered by Learnovo',
            L, Y + 6, { align: 'center', width: W });
}

/* ═══════════════════════════════════════════════════════════════════════════
   MONTHLY SALARY REPORT — All employees for a month (landscape)
   ═══════════════════════════════════════════════════════════════════════════ */

async function generateMonthlyReport(tenantId, month, year) {
    const payrolls = await Payroll.find({ tenantId, month, year, isDeleted: { $ne: true } })
        .populate('employeeId', 'name employeeId designation department bankName accountNumber ifscCode')
        .sort({ 'employeeId.name': 1 })
        .lean();

    if (payrolls.length === 0) throw new Error('No payroll records found for this period');

    const schoolData = await getSchoolData(tenantId);
    const logoBuffer = await fetchImageBuffer(schoolData.logo);

    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 36, bufferPages: true });
        const chunks = [];
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', err => reject(err));

        try {
            buildMonthlyReport(doc, payrolls, schoolData, logoBuffer, month, year);
            doc.end();
        } catch (err) {
            try { doc.destroy(); } catch (_) { /* ignore */ }
            reject(err);
        }
    });
}

function buildMonthlyReport(doc, payrolls, schoolData, logoBuffer, month, year) {
    const L = 36;
    const R = doc.page.width - 36;
    const W = R - L;
    const monthYear = `${MONTH_NAMES[month - 1]} ${year}`;

    // Header
    let Y = drawHeader(doc, schoolData, logoBuffer, L, R, W, 36);

    // Badge
    Y = drawBadge(doc, L, Y, W, 'MONTHLY SALARY REPORT', monthYear);

    // Summary cards row
    const totalNet = payrolls.reduce((s, p) => s + (p.netSalary || 0), 0);
    const totalBase = payrolls.reduce((s, p) => s + (p.baseSalary || 0), 0);
    const paidCount = payrolls.filter(p => p.paymentStatus === 'paid').length;
    const fmtCurrency = (n) => `₹${(n || 0).toLocaleString('en-IN')}`;

    const cardW = (W - 24) / 4;
    const cards = [
        { label: 'Total Employees', value: payrolls.length.toString(), color: C.teal, bg: C.tealBg },
        { label: 'Gross Salary', value: fmtCurrency(totalBase), color: C.blue, bg: C.blueBg },
        { label: 'Net Payable', value: fmtCurrency(totalNet), color: C.tealDark, bg: C.tealBg },
        { label: 'Paid', value: `${paidCount} / ${payrolls.length}`, color: C.green, bg: C.greenBg },
    ];

    cards.forEach((card, i) => {
        const x = L + i * (cardW + 8);
        roundRect(doc, x, Y, cardW, 36, 4, card.bg);
        doc.fontSize(6.5).font('Helvetica').fillColor(C.label).text(card.label, x + 10, Y + 6, { width: cardW - 20 });
        doc.fontSize(11).font('Helvetica-Bold').fillColor(card.color).text(card.value, x + 10, Y + 18, { width: cardW - 20 });
    });
    Y += 48;

    // Table setup
    const cols = [
        { label: 'S.No', w: 32, align: 'center' },
        { label: 'Employee ID', w: 72 },
        { label: 'Employee Name', w: 120 },
        { label: 'Designation', w: 90 },
        { label: 'Bank & A/C', w: 120 },
        { label: 'IFSC', w: 72 },
        { label: 'Base Salary', w: 72, align: 'right' },
        { label: 'Deductions', w: 68, align: 'right' },
        { label: 'Net Salary', w: 78, align: 'right' },
    ];

    // Calculate column positions
    const totalColW = cols.reduce((s, c) => s + c.w, 0);
    const scale = W / totalColW;
    let colX = L;
    cols.forEach(c => { c.x = colX; c.w = Math.round(c.w * scale); colX += c.w; });

    function drawTableHeader(startY) {
        const headerH = 20;
        roundRect(doc, L, startY, W, headerH, 3, C.headerBg);
        doc.fontSize(7).font('Helvetica-Bold').fillColor(C.white);
        cols.forEach(c => {
            doc.text(c.label, c.x + 6, startY + 6, { width: c.w - 12, align: c.align || 'left' });
        });
        return startY + headerH + 2;
    }

    Y = drawTableHeader(Y);

    // Table rows
    const rowH = 18;
    let runTotalBase = 0;
    let runTotalDed = 0;
    let runTotalNet = 0;

    payrolls.forEach((p, idx) => {
        // Page break check
        if (Y + rowH > doc.page.height - 70) {
            doc.addPage();
            Y = 36;
            Y = drawTableHeader(Y);
        }

        // Alternating row background
        if (idx % 2 === 0) {
            roundRect(doc, L, Y, W, rowH, 0, C.rowAlt);
        }

        const emp = p.employeeId || {};
        const totalDed = (p.leaveDeduction || 0) + (p.otherDeductions || 0) + (p.totalAdvanceDeduction || 0);
        const bankInfo = emp.bankName ? `${emp.bankName}\n${emp.accountNumber || '-'}` : (emp.accountNumber || '-');

        runTotalBase += p.baseSalary || 0;
        runTotalDed += totalDed;
        runTotalNet += p.netSalary || 0;

        doc.fontSize(7).font('Helvetica').fillColor(C.text);
        doc.text((idx + 1).toString(), cols[0].x + 6, Y + 5, { width: cols[0].w - 12, align: 'center' });
        doc.text(emp.employeeId || '-', cols[1].x + 6, Y + 5, { width: cols[1].w - 12 });
        doc.font('Helvetica-Bold').text(emp.name || '-', cols[2].x + 6, Y + 5, { width: cols[2].w - 12 });
        doc.font('Helvetica').text(emp.designation || '-', cols[3].x + 6, Y + 5, { width: cols[3].w - 12 });
        doc.fontSize(6.5).text(emp.bankName || '-', cols[4].x + 6, Y + 2, { width: cols[4].w - 12 });
        if (emp.accountNumber) doc.text(emp.accountNumber, cols[4].x + 6, Y + 10, { width: cols[4].w - 12 });
        doc.fontSize(7).text(emp.ifscCode || '-', cols[5].x + 6, Y + 5, { width: cols[5].w - 12 });
        doc.text((p.baseSalary || 0).toLocaleString('en-IN'), cols[6].x + 6, Y + 5, { width: cols[6].w - 12, align: 'right' });
        doc.fillColor(totalDed > 0 ? C.red : C.muted).text(totalDed > 0 ? totalDed.toLocaleString('en-IN') : '—', cols[7].x + 6, Y + 5, { width: cols[7].w - 12, align: 'right' });
        doc.font('Helvetica-Bold').fillColor(C.teal).text((p.netSalary || 0).toLocaleString('en-IN'), cols[8].x + 6, Y + 5, { width: cols[8].w - 12, align: 'right' });

        Y += rowH;
    });

    // Total row
    Y += 2;
    const totalH = 22;
    roundRect(doc, L, Y, W, totalH, 3, C.tealBg);
    roundRect(doc, L, Y, 3, totalH, 2, C.teal);

    doc.fontSize(8).font('Helvetica-Bold').fillColor(C.tealDark);
    doc.text(`TOTAL (${payrolls.length} employees)`, cols[0].x + 10, Y + 6, { width: 200 });
    doc.text(runTotalBase.toLocaleString('en-IN'), cols[6].x + 6, Y + 6, { width: cols[6].w - 12, align: 'right' });
    doc.fillColor(C.red).text(runTotalDed.toLocaleString('en-IN'), cols[7].x + 6, Y + 6, { width: cols[7].w - 12, align: 'right' });
    doc.fillColor(C.tealDark).text(runTotalNet.toLocaleString('en-IN'), cols[8].x + 6, Y + 6, { width: cols[8].w - 12, align: 'right' });

    Y += totalH + 14;

    // Footer
    line(doc, L, Y, R);
    Y += 6;
    doc.fontSize(6.5).font('Helvetica').fillColor(C.muted);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`, L, Y);
    doc.text('Powered by Learnovo', L, Y, { width: W, align: 'right' });
}

/* ═══════════════════════════════════════════════════════════════════════════
   YEARLY SALARY REPORT — Single employee for a year
   ═══════════════════════════════════════════════════════════════════════════ */

async function generateYearlyReport(employeeId, tenantId, year) {
    const employee = await User.findById(employeeId).lean();
    if (!employee) throw new Error('Employee not found');

    const payrolls = await Payroll.find({ tenantId, employeeId, year, isDeleted: { $ne: true } })
        .sort({ month: 1 })
        .lean();

    const schoolData = await getSchoolData(tenantId);
    const logoBuffer = await fetchImageBuffer(schoolData.logo);

    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });
        const chunks = [];
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', err => reject(err));

        try {
            buildYearlyReport(doc, employee, payrolls, schoolData, logoBuffer, year);
            doc.end();
        } catch (err) {
            try { doc.destroy(); } catch (_) { /* ignore */ }
            reject(err);
        }
    });
}

function buildYearlyReport(doc, employee, payrolls, schoolData, logoBuffer, year) {
    const L = 40;
    const R = 555;
    const W = R - L;

    // Header
    let Y = drawHeader(doc, schoolData, logoBuffer, L, R, W, 40);

    // Badge
    Y = drawBadge(doc, L, Y, W, 'YEARLY SALARY REPORT', `Financial Year ${year}`);

    // Employee info
    const colGap = 30;
    const colW = (W - colGap) / 2;
    const col1X = L;
    const col2X = L + colW + colGap;

    doc.fontSize(7).font('Helvetica-Bold').fillColor(C.label);
    doc.text('EMPLOYEE DETAILS', col1X, Y);
    Y += 10;
    line(doc, L, Y, R, C.border, 0.75);
    Y += 8;

    drawInfoRow(doc, col1X, Y, 'Name', employee.name, 75, colW);
    drawInfoRow(doc, col2X, Y, 'Employee ID', employee.employeeId || 'N/A', 80, colW);
    Y += 16;
    drawInfoRow(doc, col1X, Y, 'Designation', employee.designation || 'N/A', 75, colW);
    drawInfoRow(doc, col2X, Y, 'Department', employee.department || 'N/A', 80, colW);
    Y += 26;

    // Table setup
    const cols = [
        { label: 'Month', w: 100 },
        { label: 'Base Salary', w: 90, align: 'right' },
        { label: 'Bonuses', w: 70, align: 'right' },
        { label: 'Deductions', w: 80, align: 'right' },
        { label: 'Advances', w: 75, align: 'right' },
        { label: 'Net Salary', w: 100, align: 'right' },
    ];

    const totalColW = cols.reduce((s, c) => s + c.w, 0);
    const scale = W / totalColW;
    let colX = L;
    cols.forEach(c => { c.x = colX; c.w = Math.round(c.w * scale); colX += c.w; });

    // Table header
    const headerH = 20;
    roundRect(doc, L, Y, W, headerH, 3, C.headerBg);
    doc.fontSize(8).font('Helvetica-Bold').fillColor(C.white);
    cols.forEach(c => {
        doc.text(c.label, c.x + 8, Y + 6, { width: c.w - 16, align: c.align || 'left' });
    });
    Y += headerH + 2;

    // Build month map
    const payrollMap = {};
    payrolls.forEach(p => { payrollMap[p.month] = p; });

    let totalBase = 0, totalBonuses = 0, totalDed = 0, totalAdv = 0, totalNet = 0;
    const rowH = 20;
    const fmtNum = (n) => n > 0 ? n.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—';

    for (let m = 1; m <= 12; m++) {
        const p = payrollMap[m];

        // Alternating row
        if ((m - 1) % 2 === 0) {
            roundRect(doc, L, Y, W, rowH, 0, C.rowAlt);
        }

        doc.fontSize(8).font('Helvetica').fillColor(C.text);
        doc.text(MONTH_NAMES[m - 1], cols[0].x + 8, Y + 6, { width: cols[0].w - 16 });

        if (p) {
            const ded = (p.leaveDeduction || 0) + (p.otherDeductions || 0);
            totalBase += p.baseSalary || 0;
            totalBonuses += p.bonuses || 0;
            totalDed += ded;
            totalAdv += p.totalAdvanceDeduction || 0;
            totalNet += p.netSalary || 0;

            doc.text(fmtNum(p.baseSalary), cols[1].x + 8, Y + 6, { width: cols[1].w - 16, align: 'right' });
            doc.text(fmtNum(p.bonuses), cols[2].x + 8, Y + 6, { width: cols[2].w - 16, align: 'right' });
            doc.fillColor(ded > 0 ? C.red : C.muted).text(fmtNum(ded), cols[3].x + 8, Y + 6, { width: cols[3].w - 16, align: 'right' });
            doc.fillColor(p.totalAdvanceDeduction > 0 ? C.red : C.muted).text(fmtNum(p.totalAdvanceDeduction), cols[4].x + 8, Y + 6, { width: cols[4].w - 16, align: 'right' });
            doc.font('Helvetica-Bold').fillColor(C.teal).text(fmtNum(p.netSalary), cols[5].x + 8, Y + 6, { width: cols[5].w - 16, align: 'right' });
        } else {
            doc.fillColor(C.muted);
            for (let i = 1; i < cols.length; i++) {
                doc.text('—', cols[i].x + 8, Y + 6, { width: cols[i].w - 16, align: 'right' });
            }
        }

        Y += rowH;
    }

    // Total row
    Y += 2;
    const totalRowH = 24;
    roundRect(doc, L, Y, W, totalRowH, 3, C.tealBg);
    roundRect(doc, L, Y, 3, totalRowH, 2, C.teal);

    doc.fontSize(9).font('Helvetica-Bold').fillColor(C.tealDark);
    doc.text('ANNUAL TOTAL', cols[0].x + 10, Y + 7, { width: cols[0].w - 16 });
    doc.text(fmtNum(totalBase), cols[1].x + 8, Y + 7, { width: cols[1].w - 16, align: 'right' });
    doc.text(fmtNum(totalBonuses), cols[2].x + 8, Y + 7, { width: cols[2].w - 16, align: 'right' });
    doc.fillColor(C.red).text(fmtNum(totalDed), cols[3].x + 8, Y + 7, { width: cols[3].w - 16, align: 'right' });
    doc.text(fmtNum(totalAdv), cols[4].x + 8, Y + 7, { width: cols[4].w - 16, align: 'right' });
    doc.font('Helvetica-Bold').fillColor(C.tealDark).text(fmtNum(totalNet), cols[5].x + 8, Y + 7, { width: cols[5].w - 16, align: 'right' });

    Y += totalRowH + 14;

    // Summary box
    roundRect(doc, L, Y, W, 46, 6, C.tealBg, C.tealBorder);
    roundRect(doc, L, Y, 4, 46, 2, C.teal);

    doc.fontSize(8).font('Helvetica-Bold').fillColor(C.tealDark).text('ANNUAL SUMMARY', L + 16, Y + 8);
    doc.fontSize(7.5).font('Helvetica').fillColor(C.text);
    doc.text(`Months with salary: ${payrolls.length} / 12`, L + 16, Y + 22);
    doc.text(`Average monthly salary: ₹${payrolls.length > 0 ? Math.round(totalNet / payrolls.length).toLocaleString('en-IN') : '0'}`, L + 16, Y + 34);

    doc.fontSize(20).font('Helvetica-Bold').fillColor(C.tealDark)
        .text(`₹ ${totalNet.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, L + 16, Y + 10, { width: W - 32, align: 'right' });
    doc.fontSize(7).font('Helvetica').fillColor(C.label)
        .text('Total Annual Net', L + 16, Y + 32, { width: W - 32, align: 'right' });

    Y += 60;

    // Footer
    line(doc, L, Y, R);
    Y += 6;
    doc.fontSize(6.5).font('Helvetica').fillColor(C.muted);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`, L, Y);
    doc.text('Powered by Learnovo', L, Y, { width: W, align: 'right' });
}

/* ═══════════════════════════════════════════════════════════════════════════
   EXPORTS (matching old API)
   ═══════════════════════════════════════════════════════════════════════════ */

const payrollPdfService = {
    generateSalarySlip,
    generateMonthlyReport,
    generateYearlyReport,
};

module.exports = payrollPdfService;
