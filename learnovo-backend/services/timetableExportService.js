const ExcelJS = require('exceljs');
const { getWeekSchedule: _getWeekSchedule } = require('./timetableViewService');
const TimetableTemplate = require('../models/TimetableTemplate');
const TimetableEntry = require('../models/TimetableEntry');
const SchoolTiming = require('../models/SchoolTiming');
const User = require('../models/User');
const Class = require('../models/Class');
const Section = require('../models/Section');
const DAY_LABELS = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
  thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday'
};

// ── Shared helpers ───────────────────────────────────────────────────────────

/**
 * Load a weekly timetable grid structure for export.
 * Returns { title, timings, grid, workingDays }
 */
async function loadWeeklyGrid(tenantId, options = {}) {
  const { classId, sectionId, teacherId, templateId } = options;

  // Get template
  let template;
  if (templateId) {
    template = await TimetableTemplate.findOne({ _id: templateId, tenantId }).lean();
  } else {
    template = await TimetableTemplate.findOne({ tenantId, status: 'published' })
      .sort({ publishedAt: -1 }).lean();
  }
  if (!template) throw new Error('No published timetable template found');

  // Build title
  let title = template.name;
  if (classId) {
    const cls = await Class.findById(classId).select('grade name').lean();
    title = cls ? `Class ${cls.grade || cls.name}` : title;
    if (sectionId) {
      const sec = await Section.findById(sectionId).select('name').lean();
      if (sec) title += ` - ${sec.name}`;
    }
    title += ' Timetable';
  } else if (teacherId) {
    const teacher = await User.findById(teacherId).select('name fullName').lean();
    title = teacher ? `${teacher.name || teacher.fullName} - Timetable` : title;
  }

  // Load timings
  const timings = await SchoolTiming.find({
    tenantId,
    templateId: template._id,
    isActive: true
  }).sort({ slotNumber: 1 }).lean();

  // Load entries
  const entryFilter = { tenantId, templateId: template._id };
  if (classId) entryFilter.classId = classId;
  if (sectionId) entryFilter.sectionId = sectionId;
  if (teacherId) entryFilter.teacherId = teacherId;

  const entries = await TimetableEntry.find(entryFilter)
    .populate('subjectId', 'name code color')
    .populate('teacherId', 'name fullName')
    .populate('classId', 'grade name')
    .populate('sectionId', 'name')
    .populate('roomId', 'name code')
    .lean();

  // Build grid: grid[dayOfWeek][slotId] = entry
  const grid = {};
  for (const day of template.workingDays) {
    grid[day] = {};
  }
  for (const entry of entries) {
    if (!grid[entry.dayOfWeek]) continue;
    grid[entry.dayOfWeek][entry.timingSlotId.toString()] = entry;
  }

  return { title, template, timings, grid, workingDays: template.workingDays };
}

/**
 * Get cell display text for a timetable entry.
 */
function getCellText(entry, viewType) {
  if (!entry) return '';
  const subject = entry.subjectId?.name || entry.subjectId?.code || '';
  const teacher = entry.teacherId?.name || entry.teacherId?.fullName || '';
  const room = entry.roomId?.code || entry.roomId?.name || '';
  const cls = entry.classId?.grade || entry.classId?.name || '';
  const section = entry.sectionId?.name || '';

  if (viewType === 'teacher') {
    // Teacher view: show subject + class info
    const classInfo = section ? `${cls}-${section}` : cls;
    return `${subject}\n${classInfo}${room ? `\n${room}` : ''}`;
  }
  // Class view: show subject + teacher
  return `${subject}\n${teacher}${room ? `\n${room}` : ''}`;
}

// ── PDF Export ───────────────────────────────────────────────────────────────

/**
 * Generate a PDF buffer for a timetable (class or teacher view).
 * Uses HTML table generation + Puppeteer via the shared pdfService browser.
 */
async function generatePDF(tenantId, options = {}) {
  const { title, timings, grid, workingDays } = await loadWeeklyGrid(tenantId, options);
  const viewType = options.teacherId ? 'teacher' : 'class';

  // Build HTML table
  const html = buildTimetableHTML(title, timings, grid, workingDays, viewType);

  // Render to PDF using the shared Puppeteer browser from pdfService
  const puppeteer = require('puppeteer');

  // Reuse the pdfService browser pattern
  let browser;
  try {
    // Access the same singleton approach — launch or reuse
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    });
    const page = await browser.newPage();

    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 300));

    const pdfUint8 = await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
      margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' }
    });

    await page.close();

    const filename = `timetable-${Date.now()}.pdf`;
    return { buffer: Buffer.from(pdfUint8), filename };
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (e) { /* ignore */ }
    }
  }
}

/**
 * Build an HTML table for the timetable.
 */
function buildTimetableHTML(title, timings, grid, workingDays, viewType) {
  const _periodTimings = timings.filter(t => t.type === 'period' || t.type === 'activity');
  const _breakTimings = timings.filter(t => t.type === 'break' || t.type === 'lunch' || t.type === 'assembly');

  // Build header row
  let headerCells = '<th class="time-col">Period</th>';
  for (const day of workingDays) {
    headerCells += `<th>${DAY_LABELS[day] || day}</th>`;
  }

  // Build body rows
  let bodyRows = '';
  for (const timing of timings) {
    const isBreak = ['break', 'lunch', 'assembly'].includes(timing.type);

    if (isBreak) {
      bodyRows += `<tr class="break-row">
        <td class="time-col break-cell" colspan="${workingDays.length + 1}">
          ${escapeHtml(timing.label)} (${timing.startTime} - ${timing.endTime})
        </td>
      </tr>`;
      continue;
    }

    let cells = `<td class="time-col">
      <strong>${escapeHtml(timing.label)}</strong><br/>
      <span class="time-text">${timing.startTime} - ${timing.endTime}</span>
    </td>`;

    for (const day of workingDays) {
      const entry = grid[day]?.[timing._id.toString()];
      const _cellText = getCellText(entry, viewType);
      const bgColor = entry?.subjectId?.color || '#f8f9fa';

      if (entry) {
        cells += `<td class="entry-cell" style="background-color: ${bgColor}15;">
          <div class="subject-name">${escapeHtml(entry.subjectId?.name || '')}</div>
          <div class="teacher-name">${escapeHtml(viewType === 'teacher'
    ? ((entry.classId?.grade || entry.classId?.name || '') + (entry.sectionId?.name ? `-${  entry.sectionId.name}` : ''))
    : (entry.teacherId?.name || entry.teacherId?.fullName || ''))}</div>
          ${entry.roomId ? `<div class="room-name">${escapeHtml(entry.roomId.code || entry.roomId.name)}</div>` : ''}
        </td>`;
      } else {
        cells += '<td class="empty-cell">—</td>';
      }
    }

    bodyRows += `<tr>${cells}</tr>`;
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; color: #1a1a2e; }
    h1 { text-align: center; font-size: 18px; margin-bottom: 4px; color: #1a1a2e; }
    .subtitle { text-align: center; font-size: 11px; color: #666; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; }
    th { background: #1a1a2e; color: #fff; padding: 8px 6px; text-align: center; font-weight: 600; font-size: 10px; }
    td { padding: 6px; text-align: center; border: 1px solid #e0e0e0; vertical-align: middle; }
    .time-col { width: 90px; text-align: center; background: #f0f2f5; font-size: 9px; }
    .time-text { font-size: 8px; color: #888; }
    .break-row .break-cell { background: #fff3e0; font-weight: 600; font-size: 10px; color: #e65100; text-align: center; border: 1px solid #ffe0b2; }
    .entry-cell { min-width: 80px; }
    .subject-name { font-weight: 600; font-size: 10px; margin-bottom: 2px; }
    .teacher-name { font-size: 9px; color: #555; }
    .room-name { font-size: 8px; color: #888; }
    .empty-cell { color: #ccc; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <div class="subtitle">Generated on ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
  <table>
    <thead><tr>${headerCells}</tr></thead>
    <tbody>${bodyRows}</tbody>
  </table>
</body>
</html>`;
}

// ── Excel Export ─────────────────────────────────────────────────────────────

/**
 * Generate an Excel workbook buffer for a timetable.
 */
async function generateExcel(tenantId, options = {}) {
  const { title, timings, grid, workingDays } = await loadWeeklyGrid(tenantId, options);
  const viewType = options.teacherId ? 'teacher' : 'class';

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Learnovo';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Timetable', {
    properties: { defaultColWidth: 18 }
  });

  // Title row
  const titleRow = sheet.addRow([title]);
  titleRow.font = { bold: true, size: 14, color: { argb: 'FF1A1A2E' } };
  sheet.mergeCells(1, 1, 1, workingDays.length + 1);
  titleRow.alignment = { horizontal: 'center' };

  // Subtitle row
  const subtitleRow = sheet.addRow([`Generated on ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}`]);
  subtitleRow.font = { size: 10, color: { argb: 'FF888888' } };
  sheet.mergeCells(2, 1, 2, workingDays.length + 1);
  subtitleRow.alignment = { horizontal: 'center' };

  // Empty row
  sheet.addRow([]);

  // Header row
  const headers = ['Period', ...workingDays.map(d => DAY_LABELS[d] || d)];
  const headerRow = sheet.addRow(headers);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A1A2E' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin' }, bottom: { style: 'thin' },
      left: { style: 'thin' }, right: { style: 'thin' }
    };
  });

  // Set column widths
  sheet.getColumn(1).width = 16;
  for (let i = 2; i <= workingDays.length + 1; i++) {
    sheet.getColumn(i).width = 20;
  }

  // Data rows
  for (const timing of timings) {
    const isBreak = ['break', 'lunch', 'assembly'].includes(timing.type);

    if (isBreak) {
      const breakRow = sheet.addRow([`${timing.label} (${timing.startTime} - ${timing.endTime})`]);
      sheet.mergeCells(breakRow.number, 1, breakRow.number, workingDays.length + 1);
      breakRow.getCell(1).font = { bold: true, color: { argb: 'FFE65100' }, size: 10 };
      breakRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3E0' } };
      breakRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      breakRow.getCell(1).border = {
        top: { style: 'thin' }, bottom: { style: 'thin' },
        left: { style: 'thin' }, right: { style: 'thin' }
      };
      continue;
    }

    const rowData = [`${timing.label}\n${timing.startTime} - ${timing.endTime}`];

    for (const day of workingDays) {
      const entry = grid[day]?.[timing._id.toString()];
      rowData.push(getCellText(entry, viewType));
    }

    const dataRow = sheet.addRow(rowData);
    dataRow.height = 40;

    dataRow.eachCell((cell, colNumber) => {
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = {
        top: { style: 'thin' }, bottom: { style: 'thin' },
        left: { style: 'thin' }, right: { style: 'thin' }
      };

      if (colNumber === 1) {
        cell.font = { size: 9, color: { argb: 'FF333333' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F2F5' } };
      } else {
        cell.font = { size: 9 };
        // Color-code cells with entries
        const entry = grid[workingDays[colNumber - 2]]?.[timing._id.toString()];
        if (entry?.subjectId?.color) {
          // Use a light tint of the subject color
          const hex = entry.subjectId.color.replace('#', '');
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `20${hex}` } };
        }
      }
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `timetable-${Date.now()}.xlsx`;
  return { buffer: Buffer.from(buffer), filename };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

module.exports = { generatePDF, generateExcel };
