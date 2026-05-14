const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// ── Image cache — avoids re-fetching the same logo/signature from Cloudinary ──
const imageCache = new Map();
const IMAGE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ── Template cache — avoids re-reading HTML from disk every call ──
const templateCache = new Map();

function getCachedTemplate(templatePath) {
  try {
    const stat = fs.statSync(templatePath);
    const cached = templateCache.get(templatePath);
    if (cached && cached.mtime === stat.mtimeMs) return cached.html;
    const html = fs.readFileSync(templatePath, 'utf8');
    templateCache.set(templatePath, { html, mtime: stat.mtimeMs });
    return html;
  } catch {
    return fs.readFileSync(templatePath, 'utf8');
  }
}

/**
 * Strip external Google Fonts <link> and @import from HTML so Puppeteer
 * doesn't make network requests per page (fonts fall back to system fonts).
 * This is critical for bulk PDF performance.
 */
function stripExternalFonts(html) {
  html = html.replace(/<link[^>]*fonts\.googleapis\.com[^>]*>/gi, '');
  html = html.replace(/@import\s+url\(['"]?[^)]*fonts\.googleapis\.com[^)]*['"]?\)\s*;?/gi, '');
  return html;
}

// ── Lazy browser instance — launches on demand, closes after idle ──
let browserInstance = null;
let activePages = 0;
let idleTimer = null;
const IDLE_TIMEOUT_MS = 60_000; // Close Chromium after 60s of no PDF requests

async function getBrowser() {
  clearIdleTimer();
  if (!browserInstance || !browserInstance.isConnected()) {
    // Close stale instance if it exists but disconnected
    if (browserInstance) {
      try {
        await browserInstance.close();
      } catch (e) { /* ignore */ }
      browserInstance = null;
    }
    browserInstance = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--font-render-hinting=none',
        '--force-device-scale-factor=3',
        '--no-first-run',
        '--no-zygote',
        '--disable-extensions',
        '--force-color-profile=srgb'
      ]
    });
  }
  activePages++;
  return browserInstance;
}

function releaseBrowser() {
  activePages = Math.max(0, activePages - 1);
  if (activePages === 0) {
    scheduleIdleClose();
  }
}

function scheduleIdleClose() {
  clearIdleTimer();
  idleTimer = setTimeout(async() => {
    if (activePages === 0) {
      await closeBrowser();
    }
  }, IDLE_TIMEOUT_MS);
}

function clearIdleTimer() {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
}

/**
 * Gracefully close the shared browser (call on server shutdown)
 */
async function closeBrowser() {
  clearIdleTimer();
  if (browserInstance) {
    try {
      await browserInstance.close();
    } catch (e) { /* ignore */ }
    browserInstance = null;
  }
  activePages = 0;
}

// ── Template helpers ──

function getTemplatePath(type) {
  if (type === 'REPORT_CARD') {
    return path.join(__dirname, '..', 'templates', 'report-cards', 'report-card.html');
  }
  const filename = type === 'TC' ? 'tc-minimal.html' : 'bonafide-minimal.html';
  return path.join(__dirname, '..', 'templates', 'certificates', filename);
}

/**
 * Build the mapping from controller camelCase fields → template {{snake_case}} placeholders
 */
function buildPlaceholderMap(data) {
  return {
    school_name: data.schoolName || '',
    school_address: data.schoolAddress || '',
    school_phone: data.schoolPhone || '',
    school_email: data.schoolEmail || '',
    affiliation_no: data.affiliationNumber || '',
    school_code: data.schoolCode || '',
    udise_no: data.udiseCode || '',
    school_board: data.schoolBoard || '',
    student_name: data.studentName || '',
    father_name: data.fatherName || '',
    mother_name: data.motherName || '',
    dob: data.dob || '',
    dob_in_words: data.dobWords || data.dob || '',
    admission_no: data.admissionNumber || '',
    class: data.class || '',
    section: data.section || '',
    academic_year: data.academicYear || '',
    certificate_number: data.certificateNumber || '',
    issue_date: data.issueDate || '',
    place: data.place || '',
    nationality: data.nationality || 'Indian',
    category: data.categoryOverride || data.category || '-',
    admission_date: data.admissionDate || '',
    class_last_studied: data.classOverride || data.class || '-',
    board_exam_result: data.boardResult || '',
    promotion_status: data.promotionStatus || '',
    subjects: data.subjects || '',
    fee_status: data.feeStatus || '',
    conduct: data.conduct || 'Good',
    application_date: data.applicationDate || '',
    reason_for_leaving: data.leavingReason || '',
    remarks: data.remarks || '-',
    purpose: data.purpose || 'general purpose',
    pen_number: data.penNumber || '-',
    sr_number: data.srNumber || data.admissionNumber || '-'
  };
}

/**
 * Replace all {{key}} placeholders in the HTML string
 */
function fillTemplate(html, placeholderMap) {
  let result = html;
  for (const [key, value] of Object.entries(placeholderMap)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    // Escape HTML special chars in values to prevent XSS
    const safeValue = String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
    result = result.replace(regex, safeValue);
  }
  return result;
}

/**
 * Fetch an image (URL or local path) and return as base64 data URI.
 * Results are cached for 5 minutes to avoid re-fetching the same
 * school logo / signature on every student in a bulk job.
 */
async function fetchImageAsDataUri(imagePath) {
  if (!imagePath) return null;

  // Check cache first
  const cached = imageCache.get(imagePath);
  if (cached && Date.now() - cached.ts < IMAGE_CACHE_TTL) {
    return cached.dataUri;
  }

  try {
    let imageBuffer;
    if (imagePath.startsWith('http')) {
      const response = await axios.get(imagePath, { responseType: 'arraybuffer', timeout: 5000 });
      imageBuffer = Buffer.from(response.data);
    } else {
      let localPath = imagePath;
      if (localPath.startsWith('/')) localPath = path.join(process.cwd(), localPath);
      if (!fs.existsSync(localPath)) {
        localPath = path.resolve(process.cwd(), imagePath);
      }
      if (!fs.existsSync(localPath)) {
        localPath = path.join(process.cwd(), 'uploads', path.basename(imagePath));
      }
      if (!fs.existsSync(localPath)) {
        console.warn(`Image file not found at: ${imagePath}`);
        return null;
      }
      imageBuffer = fs.readFileSync(localPath);
    }

    const ext = path.extname(imagePath).toLowerCase();
    let mimeType = 'image/png';
    if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
    else if (ext === '.svg') mimeType = 'image/svg+xml';
    else if (ext === '.webp') mimeType = 'image/webp';

    const base64 = imageBuffer.toString('base64');
    const dataUri = `data:${mimeType};base64,${base64}`;

    // Cache the result
    imageCache.set(imagePath, { dataUri, ts: Date.now() });

    return dataUri;
  } catch (err) {
    console.warn(`Failed to load image from ${imagePath}:`, err.message);
    return null;
  }
}

/**
 * Inject school logo into the template HTML
 * Replaces <!-- LOGO_PLACEHOLDER --> with an <img> tag or fallback SVG
 */
async function injectLogo(html, logoPath) {
  const fallbackSvg = '<svg width="50" height="50" viewBox="0 0 50 50" fill="none"><circle cx="25" cy="25" r="20" stroke="rgba(255,255,255,0.5)" stroke-width="1.5"/><text x="25" y="30" text-anchor="middle" fill="rgba(255,255,255,0.7)" font-size="10" font-family="Georgia,serif">LOGO</text></svg>';

  if (!logoPath) {
    return html.replace('<!-- LOGO_PLACEHOLDER -->', fallbackSvg);
  }

  const dataUri = await fetchImageAsDataUri(logoPath);
  if (dataUri) {
    return html.replace('<!-- LOGO_PLACEHOLDER -->', `<img src="${dataUri}" alt="School Logo" />`);
  }

  return html.replace('<!-- LOGO_PLACEHOLDER -->', fallbackSvg);
}

/**
 * Build the Bonafide declaration paragraph HTML.
 * - Active student: standard "currently studying in" wording.
 * - Inactive student: "was a student" wording with from/to academic sessions.
 * Values are HTML-escaped inline because this function bypasses fillTemplate.
 */
function buildBonafideDeclarationHtml(data) {
  const esc = (v) => String(v || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  const studentName = esc(data.studentName);
  const fatherName = esc(data.fatherName);
  const motherName = esc(data.motherName);
  const classText = esc(`${data.class || ''} (${data.section || ''})`);
  const academicYear = esc(data.academicYear);
  const dob = esc(data.dob);
  const fromSession = esc(data.fromSession || data.academicYear);
  const toSession = esc(data.toSession || data.academicYear);

  const tenureSentence = data.isActive === false
    ? `was a bonafide student of this institution and studied here from the Academic Session <span class="hl">${fromSession}</span> to <span class="hl">${toSession}</span>. The last class attended was Class <span class="hl">${classText}</span>.`
    : `is a bonafide student of this institution. He/She is currently studying in Class <span class="hl">${classText}</span> for the Academic Session <span class="hl">${academicYear}</span>.`;

  return `<p class="declaration-text">
      This is to certify that <span class="hl">${studentName}</span>,
      Son/Daughter of Shri <span class="hl">${fatherName}</span>
      and Smt. <span class="hl">${motherName}</span>,
      ${tenureSentence}
      His/Her date of birth as per our school records is
      <span class="hl">${dob}</span>.
    </p>`;
}

function injectBonafideDeclaration(html, data) {
  return html.replace('<!-- DECLARATION_PLACEHOLDER -->', buildBonafideDeclarationHtml(data));
}

/**
 * Inject principal signature into the template HTML
 * Replaces <!-- PRINCIPAL_SIGNATURE_PLACEHOLDER --> with an <img> or empty string
 */
async function injectPrincipalSignature(html, signaturePath) {
  if (!signaturePath) {
    return html.replace('<!-- PRINCIPAL_SIGNATURE_PLACEHOLDER -->', '');
  }

  const dataUri = await fetchImageAsDataUri(signaturePath);
  if (dataUri) {
    return html.replace('<!-- PRINCIPAL_SIGNATURE_PLACEHOLDER -->', `<img class="sig-img" src="${dataUri}" alt="Principal Signature" />`);
  }

  return html.replace('<!-- PRINCIPAL_SIGNATURE_PLACEHOLDER -->', '');
}

// ── Report Card helpers ──

function getGradeClass(grade) {
  const g = (grade || '').toUpperCase();
  if (g === 'A+' || g === 'A') return 'excellent';
  if (g === 'B+' || g === 'B') return 'good';
  if (g === 'C+' || g === 'C') return 'average';
  return 'poor';
}

function buildBlankSubjectRow(subject) {
  return `<tr>
        <td class="subject-name">${escapeHtml(subject.subject || subject.name || '')}</td>
        <td class="num">${subject.totalMarks || ''}</td>
        <td class="num" style="font-weight:600; border-bottom: 1px solid #d1d5db; min-width:40px">&nbsp;</td>
        <td class="center" style="border-bottom: 1px solid #d1d5db">&nbsp;</td>
        <td class="center" style="border-bottom: 1px solid #d1d5db">&nbsp;</td>
        <td style="border-bottom: 1px solid #d1d5db">&nbsp;</td>
    </tr>`;
}

function buildFinalSubjectRow(subject, examSeriesList) {
  const examCells = examSeriesList.map(series => {
    const data = subject.exams[series];
    if (!data) return '<td class="no-data">\u2014</td>';
    return `<td>${data.marksObtained}</td>`;
  }).join('\n');

  const totalGc = getGradeClass(subject.finalGrade);
  const isPassed = subject.isPassed;
  const resultClass = isPassed ? 'pass-text' : 'fail-text';
  const resultText = isPassed ? 'Pass' : 'Fail';
  return `<tr>
        <td class="subject-cell">${escapeHtml(subject.subject)}</td>
        ${examCells}
        <td style="font-weight:700">${subject.totalObtained}</td>
        <td>${subject.totalMax}</td>
        <td style="font-weight:600">${subject.averagePercentage}%</td>
        <td><span class="grade-display"><span class="grade-dot ${totalGc}"></span> ${escapeHtml(subject.finalGrade)}</span></td>
        <td class="center"><span class="${resultClass}">${resultText}</span></td>
    </tr>`;
}

function buildFinalReportCardPlaceholders(data) {
  const { school, student, session, examSeries, subjectRows, summary } = data;
  const brandColor = school.brand_color || school.brandColor || '#1E3A5F';

  // Build exam series header columns — show exam name with max marks
  const examHeaderCells = examSeries.map(s => {
    // Find the max marks for this exam series from the first subject that has data
    const sampleRow = subjectRows.find(r => r.exams[s]);
    const maxMarks = sampleRow?.exams[s]?.totalMarks || '';
    const label = maxMarks ? `${escapeHtml(s)}<br><span style="font-weight:400;font-size:8px;color:var(--rc-text-muted)">(${maxMarks})</span>` : escapeHtml(s);
    return `<th class="num">${label}</th>`;
  }).join('\n');

  // Build subject rows
  const subjectRowsHtml = subjectRows.map(row => buildFinalSubjectRow(row, examSeries)).join('\n');

  // Grand total exam cells — show total marks obtained per exam series
  const grandTotalExamCells = examSeries.map(series => {
    const withData = subjectRows.filter(r => r.exams[series]);
    if (!withData.length) return '<td>\u2014</td>';
    const totalObt = withData.reduce((acc, r) => acc + (r.exams[series]?.marksObtained || 0), 0);
    return `<td style="font-weight:700">${totalObt}</td>`;
  }).join('\n');

  const dob = student.dob
    ? new Date(student.dob).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
    : '\u2014';

  const overallGrade = summary.overallGrade || '\u2014';
  const isPassed = summary.overallPassed;

  return {
    brand_color: brandColor,
    brand_color_light: `${brandColor}0A`,
    school_name: school.name || '',
    school_address: school.address || '',
    school_phone: school.phone || '',
    school_email: school.email || '',
    affiliation_no: school.affiliation || '',
    school_code: school.schoolCode || '',
    udise_no: school.udise || '',
    session_name: session.name || '',
    student_name: student.name || student.fullName || '',
    adm_number: student.admissionNumber || '\u2014',
    class_section: `${student.class || ''}${student.section ? ` \u2014 ${student.section}` : ''}`,
    roll_number: student.rollNumber || '\u2014',
    dob,
    parent_name: student.guardianName || student.fatherOrHusbandName || '\u2014',
    exam_header_cells: examHeaderCells,
    subject_rows: subjectRowsHtml,
    grand_total_exam_cells: grandTotalExamCells,
    grand_total_max: summary.grandTotalMax || 0,
    grand_total_obtained: summary.grandTotalObtained || 0,
    overall_percentage: summary.overallPercentage || 0,
    overall_grade: overallGrade,
    overall_grade_class: getGradeClass(overallGrade),
    overall_result: isPassed ? 'PASS' : 'FAIL',
    overall_result_color: isPassed ? 'pass' : 'fail',
    result_banner_class: isPassed ? 'pass' : 'fail',
    result_text: isPassed ? 'PASSED' : 'FAILED',
    performance_tag: isPassed ? 'Satisfactory Performance' : 'Needs Improvement',
    result_stats: `${summary.passCount || 0} of ${summary.totalSubjects || 0} subjects passed \u00B7 Overall: ${summary.overallPercentage || 0}% \u00B7 Grade: ${overallGrade}`
  };
}

// ── Two-Term Report Card helpers ──

function buildTwoTermPlaceholders(data) {
  const { school, student, session, term1, term2, subjectRows, coScholastic, summary, remarks, result, attendance } = data;
  const brandColor = school.brand_color || school.brandColor || '#1E3A5F';

  // Term exam headers
  const t1Exams = term1.exams || [];
  const t2Exams = term2.exams || [];

  const term1ExamHeaders = t1Exams.map(e =>
    `<th class="num term1-sub">${escapeHtml(e.name)}<br><span style="font-weight:400;font-size:9px;color:#6B7280">(${e.maxMarks})</span></th>`
  ).join('');

  const term2ExamHeaders = t2Exams.map(e =>
    `<th class="num term2-sub">${escapeHtml(e.name)}<br><span style="font-weight:400;font-size:9px;color:#6B7280">(${e.maxMarks})</span></th>`
  ).join('');

  // Subject rows
  const subjectRowsHtml = subjectRows.map(row => {
    const t1Cells = t1Exams.map(e => {
      const v = row.marks[e.name];
      return v !== undefined && v !== null && v !== '' ? `<td>${v}</td>` : '<td class="no-data">\u2014</td>';
    }).join('');

    const t2Cells = t2Exams.map(e => {
      const v = row.marks[e.name];
      return v !== undefined && v !== null && v !== '' ? `<td>${v}</td>` : '<td class="no-data">\u2014</td>';
    }).join('');

    const t1gc = getGradeClass(row.term1Grade);
    const t2gc = getGradeClass(row.term2Grade);

    return `<tr>
      <td class="subject-cell">${escapeHtml(row.subject)}</td>
      ${t1Cells}
      <td style="font-weight:700">${row.term1Total}</td>
      <td><span class="grade-display"><span class="grade-dot ${t1gc}"></span> ${escapeHtml(row.term1Grade)}</span></td>
      ${t2Cells}
      <td style="font-weight:700">${row.term2Total}</td>
      <td><span class="grade-display"><span class="grade-dot ${t2gc}"></span> ${escapeHtml(row.term2Grade)}</span></td>
    </tr>`;
  }).join('\n');

  // Grand total row
  const t1GrandCells = t1Exams.map(e => {
    const total = subjectRows.reduce((a, r) => a + (Number(r.marks[e.name]) || 0), 0);
    return `<td style="font-weight:700">${total}</td>`;
  }).join('');

  const t2GrandCells = t2Exams.map(e => {
    const total = subjectRows.reduce((a, r) => a + (Number(r.marks[e.name]) || 0), 0);
    return `<td style="font-weight:700">${total}</td>`;
  }).join('');

  const grandTotalRow = `<tr>
    <td class="subject-cell">Grand Total</td>
    ${t1GrandCells}
    <td style="font-weight:700">${summary.term1Total}</td>
    <td><span class="grade-display"><span class="grade-dot ${getGradeClass(summary.term1Grade)}"></span> ${summary.term1Grade}</span></td>
    ${t2GrandCells}
    <td style="font-weight:700">${summary.term2Total}</td>
    <td><span class="grade-display"><span class="grade-dot ${getGradeClass(summary.term2Grade)}"></span> ${summary.term2Grade}</span></td>
  </tr>`;

  // Co-Scholastic section
  let coScholasticHtml = '';
  if (coScholastic && coScholastic.length > 0 && coScholastic.some(c => c.term1Grade || c.term2Grade)) {
    const rows = coScholastic.filter(c => c.area).map(c =>
      `<tr><td style="text-align:left;padding:3px 8px;font-size:11px">${escapeHtml(c.area)}</td><td style="text-align:center;padding:3px;font-size:11px;font-weight:600">${escapeHtml(c.term1Grade || '\u2014')}</td><td style="text-align:center;padding:3px;font-size:11px;font-weight:600">${escapeHtml(c.term2Grade || '\u2014')}</td></tr>`
    ).join('');
    coScholasticHtml = `
      <div style="margin-bottom:6px">
        <div class="section-label">Co-Scholastic Areas</div>
        <table style="width:100%;border-collapse:collapse;table-layout:fixed">
          <thead><tr>
            <th style="text-align:left;padding:3px 8px;font-size:9px;font-weight:700;text-transform:uppercase;border-bottom:1.5px solid #D1D5DB;width:60%">Area</th>
            <th style="text-align:center;padding:3px;font-size:9px;font-weight:700;text-transform:uppercase;border-bottom:1.5px solid #D1D5DB;width:20%">Term 1</th>
            <th style="text-align:center;padding:3px;font-size:9px;font-weight:700;text-transform:uppercase;border-bottom:1.5px solid #D1D5DB;width:20%">Term 2</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  // Attendance section
  let attendanceHtml = '';
  if (attendance && (
    attendance.term1WorkingDays != null || attendance.term1PresentDays != null ||
    attendance.term2WorkingDays != null || attendance.term2PresentDays != null
  )) {
    const t1Working = attendance.term1WorkingDays;
    const t1Present = attendance.term1PresentDays;
    const t2Working = attendance.term2WorkingDays;
    const t2Present = attendance.term2PresentDays;
    const pct = (p, w) => (w && Number(w) > 0 && p != null) ? `${Math.round((Number(p) / Number(w)) * 1000) / 10}%` : '\u2014';
    const dash = v => (v == null || v === '') ? '\u2014' : v;
    const totalWorking = (Number(t1Working) || 0) + (Number(t2Working) || 0);
    const totalPresent = (Number(t1Present) || 0) + (Number(t2Present) || 0);
    const totalPct = totalWorking > 0 ? `${Math.round((totalPresent / totalWorking) * 1000) / 10}%` : '\u2014';

    attendanceHtml = `
      <div style="margin-bottom:6px">
        <div class="section-label">Attendance</div>
        <table style="width:100%;border-collapse:collapse;table-layout:fixed">
          <thead><tr>
            <th style="text-align:left;padding:3px 8px;font-size:9px;font-weight:700;text-transform:uppercase;border-bottom:1.5px solid #D1D5DB;width:40%">Term</th>
            <th style="text-align:center;padding:3px;font-size:9px;font-weight:700;text-transform:uppercase;border-bottom:1.5px solid #D1D5DB;width:20%">Working Days</th>
            <th style="text-align:center;padding:3px;font-size:9px;font-weight:700;text-transform:uppercase;border-bottom:1.5px solid #D1D5DB;width:20%">Present Days</th>
            <th style="text-align:center;padding:3px;font-size:9px;font-weight:700;text-transform:uppercase;border-bottom:1.5px solid #D1D5DB;width:20%">%</th>
          </tr></thead>
          <tbody>
            <tr>
              <td style="text-align:left;padding:3px 8px;font-size:11px">Term 1</td>
              <td style="text-align:center;padding:3px;font-size:11px;font-weight:600">${dash(t1Working)}</td>
              <td style="text-align:center;padding:3px;font-size:11px;font-weight:600">${dash(t1Present)}</td>
              <td style="text-align:center;padding:3px;font-size:11px;font-weight:700">${pct(t1Present, t1Working)}</td>
            </tr>
            <tr style="background:rgba(249,250,251,0.5)">
              <td style="text-align:left;padding:3px 8px;font-size:11px">Term 2</td>
              <td style="text-align:center;padding:3px;font-size:11px;font-weight:600">${dash(t2Working)}</td>
              <td style="text-align:center;padding:3px;font-size:11px;font-weight:600">${dash(t2Present)}</td>
              <td style="text-align:center;padding:3px;font-size:11px;font-weight:700">${pct(t2Present, t2Working)}</td>
            </tr>
            <tr>
              <td style="text-align:left;padding:3px 8px;font-size:11px;font-weight:700;border-top:1px solid #D1D5DB">Overall</td>
              <td style="text-align:center;padding:3px;font-size:11px;font-weight:700;border-top:1px solid #D1D5DB">${totalWorking || '\u2014'}</td>
              <td style="text-align:center;padding:3px;font-size:11px;font-weight:700;border-top:1px solid #D1D5DB">${totalPresent || '\u2014'}</td>
              <td style="text-align:center;padding:3px;font-size:11px;font-weight:700;border-top:1px solid #D1D5DB;color:#1F6F6D">${totalPct}</td>
            </tr>
          </tbody>
        </table>
      </div>`;
  }

  const dob = student.dob
    ? new Date(student.dob).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
    : '\u2014';

  const isPassed = summary.overallPassed;

  return {
    brand_color: brandColor,
    brand_color_light: `${brandColor}0A`,
    school_name: school.name || '',
    school_address: school.address || '',
    school_phone: school.phone || '',
    school_email: school.email || '',
    affiliation_no: school.affiliation || '',
    school_code: school.schoolCode || '',
    udise_no: school.udise || '',
    session_name: session.name || '',
    student_name: student.name || '',
    adm_number: student.admissionNumber || '\u2014',
    class_section: `${student.class || ''}${student.section ? ` \u2014 ${  student.section}` : ''}`,
    roll_number: student.rollNumber || '\u2014',
    dob,
    father_name: student.fatherName || '\u2014',
    mother_name: student.motherName || '\u2014',
    term1_colspan: String(t1Exams.length + 2),
    term2_colspan: String(t2Exams.length + 2),
    term1_exam_headers: term1ExamHeaders,
    term2_exam_headers: term2ExamHeaders,
    subject_rows: subjectRowsHtml,
    grand_total_row: grandTotalRow,
    term1_total: `${summary.term1Total} / ${summary.term1Max}`,
    term1_percentage: `${summary.term1Percentage}%`,
    term1_grade: summary.term1Grade,
    term2_total: `${summary.term2Total} / ${summary.term2Max}`,
    term2_percentage: `${summary.term2Percentage}%`,
    term2_grade: summary.term2Grade,
    overall_percentage: `${summary.overallPercentage}%`,
    overall_grade: summary.overallGrade,
    result_banner_class: isPassed ? 'pass' : 'fail',
    result_text: isPassed ? 'PASSED' : 'FAILED',
    result_detail: `Overall: ${summary.overallPercentage}% \u00B7 Grade: ${summary.overallGrade}`,
    co_scholastic_html: coScholasticHtml,
    attendance_html: attendanceHtml,
    remarks_text: remarks || '',
    result_status: result || (isPassed ? 'Promoted' : 'Not Promoted'),
    result_status_class: (result || '').toLowerCase().includes('not') || (result || '').toLowerCase().includes('detained') || !isPassed ? 'not-promoted' : 'promoted'
  };
}

function buildSubjectRow(subject) {
  const gradeClass = getGradeClass(subject.grade);
  const resultClass = subject.isPassed ? 'pass-text' : 'fail-text';
  const resultText = subject.isPassed ? 'Pass' : 'Fail';
  const examDate = subject.date
    ? new Date(subject.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '';
  const examDetail = [subject.examName, examDate].filter(Boolean).join(' \u00B7 ');
  const remarks = subject.remarks || '\u2014';

  return `<tr>
        <td class="subject-name">${escapeHtml(subject.subject || subject.name || '')}<span class="exam-detail">${escapeHtml(examDetail)}</span></td>
        <td class="num">${subject.totalMarks}</td>
        <td class="num" style="font-weight:600">${subject.marksObtained}</td>
        <td class="center"><span class="grade-display"><span class="grade-dot ${gradeClass}"></span> ${escapeHtml(subject.grade)}</span></td>
        <td class="center"><span class="${resultClass}">${resultText}</span></td>
        <td style="font-size:11px; color: #374151">${escapeHtml(remarks)}</td>
    </tr>`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildReportCardPlaceholders(data) {
  const { school, student, exam, subjects, summary, attendance: _attendance } = data;
  const brandColor = school.brand_color || school.brandColor || '#1E3A5F';

  // Address line (just the address, no phone/email)
  const addressLine = school.address || '';

  // Build subject rows HTML
  const subjectRowsHtml = (subjects || []).map(s => buildSubjectRow(s)).join('\n');

  // Format date
  const dateIssued = exam.date_issued
    ? new Date(exam.date_issued).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

  // Format DOB
  const dob = student.dob
    ? new Date(student.dob).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
    : '\u2014';

  const overallResult = summary.overall_result === 'PASS' || summary.overallPassed ? 'PASS' : 'FAIL';
  const isPassed = overallResult === 'PASS';
  const overallGrade = summary.overall_grade || summary.overallGrade || '\u2014';

  return {
    brand_color: brandColor,
    brand_color_light: `${brandColor}0A`,
    school_name: school.name || '',
    school_address: addressLine,
    school_phone: school.phone || '',
    school_email: school.email || '',
    affiliation_no: school.affiliation || '',
    school_code: school.schoolCode || school.school_code || '',
    udise_no: school.udise || '',
    exam_type: exam.type || exam.examSeries || 'Mid Term',
    academic_year: exam.academic_year || exam.academicYear || '',
    date_issued: dateIssued,
    student_name: student.name || student.fullName || '',
    adm_number: student.adm_number || student.admissionNumber || '\u2014',
    class_section: student.class_section || `${student.class || ''}${student.section ? ` \u2014 ${  student.section}` : ''}`,
    roll_number: student.roll_number || student.rollNumber || '\u2014',
    dob: dob,
    parent_name: student.parent_name || student.guardianName || student.fatherOrHusbandName || '\u2014',
    subject_rows: subjectRowsHtml,
    grand_total_max: summary.total_max || summary.grandTotal || 0,
    grand_total_obtained: summary.total_obtained || summary.grandObtained || 0,
    overall_percentage: summary.overall_percentage || summary.overallPercentage || 0,
    overall_grade: overallGrade,
    overall_grade_class: getGradeClass(overallGrade),
    overall_result: overallResult,
    overall_result_color: isPassed ? 'pass' : 'fail',
    result_banner_class: isPassed ? 'pass' : 'fail',
    result_text: isPassed ? 'PASSED' : 'FAILED',
    performance_tag: summary.performance_tag || summary.performanceTag || (isPassed ? 'Satisfactory Performance' : 'Needs Improvement'),
    result_stats: `${summary.subjects_passed || summary.passCount || 0} of ${summary.total_subjects || summary.totalSubjects || 0} subjects passed \u00B7 Overall: ${summary.overall_percentage || summary.overallPercentage || 0}% \u00B7 Grade: ${overallGrade}`
  };
}

async function injectReportCardLogo(html, logoPath, brandColor) {
  const initial = brandColor ? `style="background:${brandColor}"` : '';
  const fallback = `<div class="school-logo-fallback" ${initial}>S</div>`;

  if (!logoPath) {
    return html.replace('<!-- LOGO_PLACEHOLDER -->', fallback);
  }

  const dataUri = await fetchImageAsDataUri(logoPath);
  if (dataUri) {
    return html.replace('<!-- LOGO_PLACEHOLDER -->', `<div class="school-logo"><img src="${dataUri}" alt="School Logo" /></div>`);
  }

  return html.replace('<!-- LOGO_PLACEHOLDER -->', fallback);
}

function injectAttendanceSection(html, attendance) {
  if (!attendance || !attendance.working_days) {
    return html.replace('<!-- ATTENDANCE_SECTION -->', '');
  }

  const section = `
    <div class="attendance-section">
        <div class="section-label">Attendance</div>
        <div class="attendance-row">
            <div class="att-card">
                <div class="att-value">${attendance.working_days || 0}</div>
                <div class="att-label">Working Days</div>
            </div>
            <div class="att-card">
                <div class="att-value">${attendance.days_present || 0}</div>
                <div class="att-label">Days Present</div>
            </div>
            <div class="att-card">
                <div class="att-value">${attendance.percentage || 0}%</div>
                <div class="att-label">Attendance</div>
            </div>
        </div>
    </div>`;

  return html.replace('<!-- ATTENDANCE_SECTION -->', section);
}

function injectRemarksSection(html, remarks) {
  if (!remarks) {
    return html.replace('<!-- REMARKS_SECTION -->', '');
  }

  const section = `
    <div class="remarks-section">
        <div class="section-label">Teacher's Remarks</div>
        <div class="remarks-text">${escapeHtml(remarks)}</div>
    </div>`;

  return html.replace('<!-- REMARKS_SECTION -->', section);
}

async function injectSignature(html, placeholder, signaturePath) {
  if (!signaturePath) {
    return html.replace(placeholder, '');
  }

  const dataUri = await fetchImageAsDataUri(signaturePath);
  if (dataUri) {
    return html.replace(placeholder, `<img class="sig-img" src="${dataUri}" alt="Signature" />`);
  }

  return html.replace(placeholder, '');
}

/**
 * Service to generate PDF certificates using Puppeteer
 */
const pdfService = {
  /**
     * Generate a PDF certificate buffer
     * @param {Object} data - Certificate data (camelCase fields from controller)
     * @param {Object} template - Template configuration ({ type: 'TC' | 'BONAFIDE' })
     * @returns {Promise<Buffer>} PDF buffer
     */
  generateCertificate: async(data, template) => {
    // 1. Load HTML template
    const templatePath = getTemplatePath(template.type);
    let html = fs.readFileSync(templatePath, 'utf8');

    // 2. Inject images (logo + principal signature) as base64
    html = await injectLogo(html, data.schoolLogo);
    html = await injectPrincipalSignature(html, data.principalSignature);

    // 2a. Bonafide declaration paragraph is built server-side because its wording
    // changes between active and inactive students (and contains HTML)
    if (template.type === 'BONAFIDE') {
      html = injectBonafideDeclaration(html, data);
    }

    // 3. Fill all {{placeholder}} values
    const placeholders = buildPlaceholderMap(data);
    html = fillTemplate(html, placeholders);

    // 4. Render to PDF via Puppeteer
    const browser = await getBrowser();
    const page = await browser.newPage();

    try {
      // Set high-DPI viewport for sharper rendering (A5: 559×794px)
      await page.setViewport({ width: 559, height: 794, deviceScaleFactor: 3 });

      // Wait for Google Fonts (Playfair Display) to fully load
      await page.setContent(html, {
        waitUntil: 'networkidle0',
        timeout: 15000
      });

      // Ensure all fonts are rendered before generating PDF
      await page.evaluateHandle('document.fonts.ready');

      const pdfUint8 = await page.pdf({
        format: 'A5',
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: 0, right: 0, bottom: 0, left: 0 }
      });

      // Puppeteer 24.x returns Uint8Array — convert to Node Buffer for Express compat
      return Buffer.from(pdfUint8);
    } finally {
      await page.close();
      releaseBrowser();
    }
  },

  /**
     * Generate a report card PDF buffer
     * @param {Object} data - Report card data payload (school, student, exam, subjects, summary, attendance, signatures)
     * @returns {Promise<Buffer>} PDF buffer
     */
  generateReportCard: async(data) => {
    // 1. Load HTML template (cached)
    const templatePath = getTemplatePath('REPORT_CARD');
    let html = getCachedTemplate(templatePath);

    // 2. Build and fill placeholders
    const placeholders = buildReportCardPlaceholders(data);

    // Subject rows contain raw HTML — inject before fillTemplate (which escapes HTML)
    html = html.replace('{{subject_rows}}', placeholders.subject_rows);
    delete placeholders.subject_rows;

    html = fillTemplate(html, placeholders);

    // 3. Inject images (cached — same logo/sig reused across bulk jobs)
    const brandColor = data.school?.brand_color || data.school?.brandColor || '#1E3A5F';
    html = await injectReportCardLogo(html, data.school?.logo_url || data.school?.logo, brandColor);
    html = await injectSignature(html, '<!-- PRINCIPAL_SIGNATURE_PLACEHOLDER -->', data.signatures?.principal);
    html = await injectSignature(html, '<!-- CLASS_TEACHER_SIGNATURE_PLACEHOLDER -->', data.signatures?.class_teacher);

    // 4. Inject conditional sections
    html = injectAttendanceSection(html, data.attendance);
    html = injectRemarksSection(html, data.summary?.teacher_remarks || data.summary?.teacherRemarks);

    // 5. Strip external font requests to avoid network calls per page
    html = stripExternalFonts(html);

    // 6. Render to PDF via Puppeteer
    let browser, page;
    try {
      browser = await getBrowser();
      page = await browser.newPage();

      await page.setContent(html, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });

      const pdfUint8 = await page.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: 0, right: 0, bottom: 0, left: 0 }
      });

      return Buffer.from(pdfUint8);
    } catch (err) {
      // If Puppeteer crashed, reset the browser instance so next call gets a fresh one
      if (err.message && (err.message.includes('Target closed') || err.message.includes('Protocol error') || err.message.includes('Session closed'))) {
        console.error('[pdfService] Browser crashed, resetting instance');
        browserInstance = null;
        activePages = 0;
      }
      throw err;
    } finally {
      if (page) {
        try {
          await page.close();
        } catch { /* ignore */ }
      }
      releaseBrowser();
    }
  },

  /**
   * Generate a blank report card PDF (marks cells empty for hand-filling).
   * Reuses the standard report-card.html template.
   */
  generateBlankReportCard: async(data) => {
    const templatePath = getTemplatePath('REPORT_CARD');
    let html = getCachedTemplate(templatePath);

    // Build blank subject rows
    const blankRowsHtml = (data.subjects || []).map(s => buildBlankSubjectRow(s)).join('\n');

    // Use standard placeholders but override subject rows and blank out totals
    const placeholders = buildReportCardPlaceholders({
      ...data,
      summary: {
        ...data.summary,
        grandTotal: data.summary.grandTotal || '',
        grandObtained: '',
        overallPercentage: '',
        overallGrade: '',
        overallPassed: null,
        passCount: '',
        totalSubjects: data.summary.totalSubjects
      }
    });

    // Replace subject rows with blank version
    html = html.replace('{{subject_rows}}', blankRowsHtml);
    delete placeholders.subject_rows;

    // Blank out summary fields in the footer
    placeholders.grand_total_obtained = '';
    placeholders.overall_percentage = '';
    placeholders.overall_grade = '';
    placeholders.overall_grade_class = '';
    placeholders.overall_result = '';
    placeholders.overall_result_color = 'pass';
    placeholders.result_banner_class = 'pass';
    placeholders.result_text = '';
    placeholders.performance_tag = '';
    placeholders.result_stats = '';

    html = fillTemplate(html, placeholders);

    // Inject images (cached)
    const brandColor = data.school?.brand_color || data.school?.brandColor || '#1E3A5F';
    html = await injectReportCardLogo(html, data.school?.logo_url || data.school?.logo, brandColor);
    html = await injectSignature(html, '<!-- PRINCIPAL_SIGNATURE_PLACEHOLDER -->', data.signatures?.principal);
    html = await injectSignature(html, '<!-- CLASS_TEACHER_SIGNATURE_PLACEHOLDER -->', data.signatures?.class_teacher);
    html = injectAttendanceSection(html, null);
    html = injectRemarksSection(html, null);

    // Hide result banner for blank cards
    html = html.replace(
      /<div class="result-banner[^"]*">/,
      '<div class="result-banner pass" style="display:none">'
    );

    // Strip external font requests for speed
    html = stripExternalFonts(html);

    let browser, page;
    try {
      browser = await getBrowser();
      page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 30000 });
      const pdfUint8 = await page.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: 0, right: 0, bottom: 0, left: 0 }
      });
      return Buffer.from(pdfUint8);
    } catch (err) {
      if (err.message && (err.message.includes('Target closed') || err.message.includes('Protocol error') || err.message.includes('Session closed'))) {
        console.error('[pdfService] Browser crashed, resetting instance');
        browserInstance = null;
        activePages = 0;
      }
      throw err;
    } finally {
      if (page) {
        try {
          await page.close();
        } catch { /* ignore */ }
      }
      releaseBrowser();
    }
  },

  /**
   * Generate a final/cumulative report card PDF (landscape, multi-exam columns).
   */
  generateFinalReportCard: async(data) => {
    const templatePath = path.join(__dirname, '..', 'templates', 'report-cards', 'final-report-card.html');
    let html = getCachedTemplate(templatePath);

    const placeholders = buildFinalReportCardPlaceholders(data);

    // Inject raw HTML placeholders before fillTemplate escapes them
    html = html.replace('{{exam_header_cells}}', placeholders.exam_header_cells);
    delete placeholders.exam_header_cells;
    html = html.replace('{{subject_rows}}', placeholders.subject_rows);
    delete placeholders.subject_rows;
    html = html.replace('{{grand_total_exam_cells}}', placeholders.grand_total_exam_cells);
    delete placeholders.grand_total_exam_cells;

    html = fillTemplate(html, placeholders);

    // Inject images (cached)
    const brandColor = data.school?.brand_color || data.school?.brandColor || '#1E3A5F';
    html = await injectReportCardLogo(html, data.school?.logo_url || data.school?.logo, brandColor);
    html = await injectSignature(html, '<!-- PRINCIPAL_SIGNATURE_PLACEHOLDER -->', data.signatures?.principal);
    html = await injectSignature(html, '<!-- CLASS_TEACHER_SIGNATURE_PLACEHOLDER -->', data.signatures?.class_teacher);
    html = injectAttendanceSection(html, data.attendance);
    html = injectRemarksSection(html, null);

    // Strip external font requests for speed
    html = stripExternalFonts(html);

    let browser, page;
    try {
      browser = await getBrowser();
      page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 30000 });
      const pdfUint8 = await page.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: 0, right: 0, bottom: 0, left: 0 }
      });
      return Buffer.from(pdfUint8);
    } catch (err) {
      if (err.message && (err.message.includes('Target closed') || err.message.includes('Protocol error') || err.message.includes('Session closed'))) {
        console.error('[pdfService] Browser crashed, resetting instance');
        browserInstance = null;
        activePages = 0;
      }
      throw err;
    } finally {
      if (page) {
        try {
          await page.close();
        } catch { /* ignore */ }
      }
      releaseBrowser();
    }
  },

  /**
   * Generate a two-term report card PDF.
   */
  generateTwoTermReportCard: async(data) => {
    const templatePath = path.join(__dirname, '..', 'templates', 'report-cards', 'two-term-report-card.html');
    let html = getCachedTemplate(templatePath);

    const placeholders = buildTwoTermPlaceholders(data);

    // Inject raw HTML placeholders before fillTemplate escapes them
    const rawKeys = ['term1_exam_headers', 'term2_exam_headers', 'subject_rows', 'grand_total_row'];
    rawKeys.forEach(key => {
      if (placeholders[key]) {
        html = html.replace(`{{${key}}}`, placeholders[key]);
        delete placeholders[key];
      }
    });

    // Inject co-scholastic section
    html = html.replace('<!-- CO_SCHOLASTIC_SECTION -->', placeholders.co_scholastic_html || '');
    delete placeholders.co_scholastic_html;

    // Inject attendance section
    html = html.replace('<!-- ATTENDANCE_SECTION -->', placeholders.attendance_html || '');
    delete placeholders.attendance_html;

    html = fillTemplate(html, placeholders);

    // Inject images
    const brandColor = data.school?.brand_color || data.school?.brandColor || '#1E3A5F';
    html = await injectReportCardLogo(html, data.school?.logo_url || data.school?.logo, brandColor);
    html = await injectSignature(html, '<!-- PRINCIPAL_SIGNATURE_PLACEHOLDER -->', data.signatures?.principal);
    html = await injectSignature(html, '<!-- CLASS_TEACHER_SIGNATURE_PLACEHOLDER -->', data.signatures?.class_teacher);

    // Strip external font requests for speed
    html = stripExternalFonts(html);

    let browser, page;
    try {
      browser = await getBrowser();
      page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 30000 });
      const pdfUint8 = await page.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: 0, right: 0, bottom: 0, left: 0 }
      });
      return Buffer.from(pdfUint8);
    } catch (err) {
      if (err.message && (err.message.includes('Target closed') || err.message.includes('Protocol error') || err.message.includes('Session closed'))) {
        console.error('[pdfService] Browser crashed, resetting instance');
        browserInstance = null;
        activePages = 0;
      }
      throw err;
    } finally {
      if (page) {
        try {
          await page.close();
        } catch { /* ignore */ }
      }
      releaseBrowser();
    }
  },

  closeBrowser
};

// Expose browser helpers for other services (e.g. receiptPdfService) to share the Puppeteer instance
pdfService._internal = { getBrowser, releaseBrowser };

module.exports = pdfService;
