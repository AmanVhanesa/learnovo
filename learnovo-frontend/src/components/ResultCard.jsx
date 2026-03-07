import React, { useState, useEffect } from 'react';
import { X, Printer, CheckCircle, XCircle, TrendingUp, FileText } from 'lucide-react';
import { examsService } from '../services/examsService';
import { settingsService } from '../services/settingsService';
import toast from 'react-hot-toast';

const EXAM_SERIES_OPTIONS = ['Unit Test', 'Midterm', 'Final', 'Custom'];

/* ── Grade badge colours (matching Learnovo palette) ── */
const GRADE_INFO = {
    'A+': { bg: '#dcfce7', color: '#15803d', border: '#86efac' },
    'A': { bg: '#d1fae5', color: '#047857', border: '#6ee7b7' },
    'B': { bg: '#ccfbf1', color: '#0f766e', border: '#5eead4' },
    'C': { bg: '#dbeafe', color: '#1d4ed8', border: '#93c5fd' },
    'D': { bg: '#fef9c3', color: '#a16207', border: '#fde047' },
    'F': { bg: '#fee2e2', color: '#dc2626', border: '#fca5a5' },
};

/* ══════════════════════════════════════════════════════
   Generates standalone HTML and opens in new tab to print
══════════════════════════════════════════════════════ */
function buildPrintHTML(cardData, schoolInfo, filterSeries) {
    const { student, subjects, summary } = cardData;
    const issueDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
    const studentName = student?.fullName || student?.name || '—';
    const studentClass = student?.class || subjects[0]?.class || '—';
    const studentSection = student?.section || subjects[0]?.section || '—';
    const rollNumber = student?.rollNumber || '—';

    const gradeColors = {
        'A+': '#15803d', 'A': '#047857', 'B': '#0f766e',
        'C': '#1d4ed8', 'D': '#a16207', 'F': '#dc2626',
    };
    const gradeBg = {
        'A+': '#dcfce7', 'A': '#d1fae5', 'B': '#ccfbf1',
        'C': '#dbeafe', 'D': '#fef9c3', 'F': '#fee2e2',
    };

    const subjectRows = subjects.map((s, i) => `
        <tr style="background:${i % 2 === 0 ? '#fff' : '#f9fafb'}">
            <td style="padding:10px 12px;font-weight:600;color:#111">${s.subject}</td>
            <td style="padding:10px 12px;color:#555;font-size:12px">
                <div>${s.examName}</div>
                <div style="color:#9ca3af">${new Date(s.date).toLocaleDateString('en-IN')}</div>
            </td>
            <td style="padding:10px 12px;text-align:center;color:#374151">${s.totalMarks}</td>
            <td style="padding:10px 12px;text-align:center;font-weight:700;color:#111">${s.marksObtained}</td>
            <td style="padding:10px 12px;text-align:center;color:#374151">${s.percentage}%</td>
            <td style="padding:10px 12px;text-align:center">
                <span style="background:${gradeBg[s.grade] || '#f3f4f6'};color:${gradeColors[s.grade] || '#374151'};
                    border-radius:6px;padding:2px 10px;font-weight:700;font-size:13px">${s.grade}</span>
            </td>
            <td style="padding:10px 12px;text-align:center">
                <span style="background:${s.isPassed ? '#dcfce7' : '#fee2e2'};
                    color:${s.isPassed ? '#15803d' : '#dc2626'};
                    border-radius:20px;padding:2px 10px;font-size:12px;font-weight:600">
                    ${s.isPassed ? '✓ Pass' : '✗ Fail'}</span>
            </td>
            <td style="padding:10px 12px;color:#6b7280;font-size:12px;font-style:italic">${s.remarks || '—'}</td>
        </tr>`).join('');

    const overallColor = summary.overallPassed ? '#15803d' : '#dc2626';
    const overallBg = summary.overallPassed ? '#dcfce7' : '#fee2e2';
    const overallGradeBg = gradeBg[summary.overallGrade] || '#f3f4f6';
    const overallGradeColor = gradeColors[summary.overallGrade] || '#374151';

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Report Card — ${studentName}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
         background: #f3f4f6; color: #111; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { background: #fff; max-width: 900px; margin: 20px auto; border-radius: 12px;
          overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,.12); }
  /* ─── Header ─── */
  .header { background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
            color: #fff; padding: 28px 32px; display: flex; align-items: center; gap: 20px; }
  .logo-circle { width: 60px; height: 60px; border-radius: 50%; background: rgba(255,255,255,.2);
                 display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .logo-circle svg { width: 32px; height: 32px; }
  .header-text { flex: 1; }
  .school-name { font-size: 22px; font-weight: 800; letter-spacing: -.02em; }
  .school-address { font-size: 13px; color: rgba(255,255,255,.75); margin-top: 2px; }
  .card-title { font-size: 11px; letter-spacing: .12em; text-transform: uppercase;
                color: rgba(255,255,255,.6); margin-top: 6px; font-weight: 600; }
  .header-right { text-align: right; flex-shrink: 0; }
  .series-badge { background: rgba(255,255,255,.2); border-radius: 20px;
                  padding: 4px 14px; font-size: 13px; font-weight: 600; margin-bottom: 4px; display: inline-block; }
  .issue-date { font-size: 12px; color: rgba(255,255,255,.65); }
  /* ─── Student Strip ─── */
  .student-strip { background: #f0f0ff; border-bottom: 1px solid #e0e7ff; padding: 16px 32px; }
  .student-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
  .info-cell label { font-size: 10px; text-transform: uppercase; letter-spacing: .08em;
                     color: #6366f1; font-weight: 600; }
  .info-cell .value { font-size: 15px; font-weight: 700; color: #1e1b4b; margin-top: 2px; }
  /* ─── Section heading ─── */
  .section-heading { padding: 20px 32px 12px; font-size: 12px; text-transform: uppercase;
                     letter-spacing: .1em; color: #6b7280; font-weight: 600; }
  /* ─── Table ─── */
  .marks-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .marks-table th { background: #f9fafb; padding: 10px 12px; text-align: left;
                    font-size: 11px; text-transform: uppercase; letter-spacing: .07em;
                    color: #6b7280; font-weight: 600; border-bottom: 2px solid #e5e7eb; }
  .marks-table th.center, .marks-table td.center { text-align: center; }
  .marks-table tbody tr { border-bottom: 1px solid #f3f4f6; }
  /* Grand Total */
  .grand-row td { background: #4f46e5; color: #fff; padding: 12px; font-weight: 700; }
  .grand-row td.center { text-align: center; }
  /* Stats row */
  .stats-row { padding: 12px 32px; font-size: 13px; color: #4b5563; display: flex; gap: 24px; }
  .stat-item { display: inline-flex; align-items: center; gap: 4px; }
  /* Result banner */
  .result-banner { margin: 20px 32px; border-radius: 10px; padding: 14px 24px;
                   display: flex; align-items: center; justify-content: center; gap: 12px; }
  .result-banner .result-text { font-size: 20px; font-weight: 900; letter-spacing: .05em; }
  /* Signature */
  .signature-section { padding: 24px 32px 32px; border-top: 2px dashed #e5e7eb; display: grid;
                       grid-template-columns: 1fr 1fr 1fr; gap: 20px; text-align: center; }
  .sig-box { display: flex; flex-direction: column; align-items: center; }
  .sig-line { width: 100%; border-bottom: 1px solid #9ca3af; height: 40px; margin-bottom: 8px; }
  .sig-label { font-size: 13px; font-weight: 600; color: #374151; }
  .sig-sub { font-size: 11px; color: #9ca3af; margin-top: 2px; }
  .stamp-circle { width: 72px; height: 72px; border-radius: 50%; border: 2px dashed #d1d5db;
                  margin: 0 auto 8px; }
  /* Footer note */
  .footer-note { text-align: center; font-size: 11px; color: #9ca3af; padding: 0 32px 20px; font-style: italic; }
  @media print {
    body { background: #fff; }
    .page { box-shadow: none; border-radius: 0; margin: 0; max-width: 100%; }
    @page { margin: 10mm; size: A4; }
  }
</style>
</head>
<body>
<div class="page">
  <!-- Header -->
  <div class="header">
    <div class="logo-circle">
      <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4 12 14.01l-3-3"/>
      </svg>
    </div>
    <div class="header-text">
      <div class="school-name">${schoolInfo.name}</div>
      ${schoolInfo.address ? `<div class="school-address">${schoolInfo.address}</div>` : ''}
      <div class="card-title">Student Report Card</div>
    </div>
    <div class="header-right">
      ${filterSeries ? `<div class="series-badge">${filterSeries}</div>` : ''}
      <div class="issue-date">Issued: ${issueDate}</div>
    </div>
  </div>

  <!-- Student Info -->
  <div class="student-strip">
    <div class="student-grid">
      <div class="info-cell"><label>Student Name</label><div class="value">${studentName}</div></div>
      <div class="info-cell"><label>Class</label><div class="value">${studentClass}</div></div>
      <div class="info-cell"><label>Roll Number</label><div class="value">${rollNumber}</div></div>
      <div class="info-cell"><label>Section</label><div class="value">${studentSection}</div></div>
    </div>
  </div>

  <!-- Marks Table -->
  <div class="section-heading">Subject-wise Performance</div>
  <table class="marks-table">
    <thead>
      <tr>
        <th>Subject</th>
        <th>Exam</th>
        <th class="center">Max</th>
        <th class="center">Obtained</th>
        <th class="center">%</th>
        <th class="center">Grade</th>
        <th class="center">Result</th>
        <th>Remarks</th>
      </tr>
    </thead>
    <tbody>${subjectRows}</tbody>
    <tfoot>
      <tr class="grand-row">
        <td colspan="2">Grand Total</td>
        <td class="center">${summary.grandTotal}</td>
        <td class="center">${summary.grandObtained}</td>
        <td class="center">${summary.overallPercentage}%</td>
        <td class="center">
          <span style="background:${overallGradeBg};color:${overallGradeColor};
            border-radius:6px;padding:2px 10px;font-weight:700">${summary.overallGrade}</span>
        </td>
        <td class="center" colspan="2">
          <span style="background:${overallBg};color:${overallColor};
            border-radius:20px;padding:4px 16px;font-weight:700;font-size:14px">
            ${summary.overallPassed ? '✓ PASS' : '✗ FAIL'}</span>
        </td>
      </tr>
    </tfoot>
  </table>

  <!-- Stats -->
  <div class="stats-row">
    <span class="stat-item">Total Subjects: <strong>${summary.totalSubjects}</strong></span>
    <span class="stat-item" style="color:#15803d">Passed: <strong>${summary.passCount}</strong></span>
    ${summary.failCount > 0 ? `<span class="stat-item" style="color:#dc2626">Failed: <strong>${summary.failCount}</strong></span>` : ''}
  </div>

  <!-- Result Banner -->
  <div class="result-banner" style="background:${overallBg}">
    <span style="font-size:22px">${summary.overallPassed ? '✅' : '❌'}</span>
    <span class="result-text" style="color:${overallColor}">
      ${summary.overallPassed ? 'PROMOTED TO NEXT CLASS' : 'DETAINED / FAILED'}
    </span>
  </div>

  <!-- Signatures -->
  <div class="signature-section">
    <div class="sig-box">
      <div class="sig-line"></div>
      <div class="sig-label">Class Teacher</div>
      <div class="sig-sub">Signature &amp; Seal</div>
    </div>
    <div class="sig-box">
      <div class="stamp-circle"></div>
      <div class="sig-label">Official Stamp</div>
    </div>
    <div class="sig-box">
      <div class="sig-line"></div>
      <div class="sig-label">Principal</div>
      <div class="sig-sub">Signature &amp; Seal</div>
    </div>
  </div>

  <div class="footer-note">
    This is a computer-generated report card issued by ${schoolInfo.name}. No signature required.
  </div>
</div>
<script>
  window.onload = function() { window.print(); };
</script>
</body>
</html>`;
}

/* ══════════════════════════════════════════════════════
   ResultCard Modal Component
══════════════════════════════════════════════════════ */
const ResultCard = ({ studentId, studentName, defaultExamSeries, onClose }) => {
    const [cardData, setCardData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [printing, setPrinting] = useState(false);
    const [schoolInfo, setSchoolInfo] = useState({ name: 'Learnovo School', address: '' });
    const [filterSeries, setFilterSeries] = useState(defaultExamSeries || '');

    /* ── Fetch school info ── */
    useEffect(() => {
        settingsService.getSettings?.()
            .then(res => {
                const inst = (res?.data || res)?.institution;
                if (inst?.name) {
                    const addr = inst.address
                        ? [inst.address.street, inst.address.city, inst.address.state].filter(Boolean).join(', ')
                        : '';
                    setSchoolInfo({ name: inst.name, address: addr });
                }
            })
            .catch(() => { });
    }, []);

    /* ── Fetch result card data ── */
    useEffect(() => {
        if (!studentId) return;
        setLoading(true);
        examsService.getResultCard(studentId, { examSeries: filterSeries })
            .then(res => setCardData(res.data))
            .catch(() => toast.error('Failed to load result card'))
            .finally(() => setLoading(false));
    }, [studentId, filterSeries]);

    /* ── Open print window ── */
    const handlePrint = () => {
        if (!cardData || !cardData.subjects.length) return;
        setPrinting(true);
        try {
            const html = buildPrintHTML(cardData, schoolInfo, filterSeries);
            const win = window.open('', '_blank', 'width=980,height=720');
            if (!win) {
                toast.error('Popup blocked — please allow popups for this site.');
                setPrinting(false);
                return;
            }
            win.document.write(html);
            win.document.close();
        } catch (err) {
            toast.error('Failed to open print preview');
        } finally {
            setPrinting(false);
        }
    };

    const student = cardData?.student;
    const subjects = cardData?.subjects || [];
    const summary = cardData?.summary;
    const issueDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

    return (
        <div
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-start justify-center overflow-y-auto py-6 px-4"
            role="dialog"
            aria-modal="true"
        >
            <div className="w-full max-w-4xl">

                {/* ── Action bar ── */}
                <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                        <label className="text-sm text-white font-medium">Exam Series:</label>
                        <select
                            className="input w-40 text-sm"
                            value={filterSeries}
                            onChange={e => setFilterSeries(e.target.value)}
                        >
                            <option value="">All Series</option>
                            {EXAM_SERIES_OPTIONS.map(s => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            className="btn btn-primary flex items-center gap-2"
                            onClick={handlePrint}
                            disabled={loading || !subjects.length || printing}
                        >
                            <Printer className="h-4 w-4" />
                            {printing ? 'Opening…' : 'Print / Save PDF'}
                        </button>
                        <button
                            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                            onClick={onClose}
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                {/* ══ CARD PREVIEW ══ */}
                <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">

                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                            <div className="loading-spinner mb-3" />
                            <p className="text-sm">Loading result card…</p>
                        </div>
                    ) : !subjects.length ? (
                        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                            <FileText className="h-12 w-12 mb-3 opacity-40" />
                            <p className="text-base font-medium">No results found</p>
                            <p className="text-sm mt-1 text-center px-8">
                                {filterSeries
                                    ? `No results for "${filterSeries}" series. Try "All Series".`
                                    : 'No exam results have been entered for this student yet.'}
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* ── Header ── */}
                            <div className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-8 py-6 flex items-center gap-5">
                                <div className="h-14 w-14 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                                    <CheckCircle className="h-8 w-8 text-white" />
                                </div>
                                <div className="flex-1">
                                    <h1 className="text-xl font-bold tracking-tight">{schoolInfo.name}</h1>
                                    {schoolInfo.address && <p className="text-indigo-200 text-xs mt-0.5">{schoolInfo.address}</p>}
                                    <p className="text-indigo-200 text-xs mt-1 uppercase tracking-widest font-semibold">Student Report Card</p>
                                </div>
                                <div className="text-right shrink-0">
                                    {filterSeries && (
                                        <div className="inline-block bg-white/20 px-3 py-1 rounded-full text-sm font-semibold mb-1">{filterSeries}</div>
                                    )}
                                    <p className="text-indigo-200 text-xs">Issued: {issueDate}</p>
                                </div>
                            </div>

                            {/* ── Student Info ── */}
                            <div className="bg-indigo-50 border-b border-indigo-100 px-8 py-4">
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                    {[
                                        { label: 'Student Name', value: student?.fullName || student?.name || studentName || '—', lg: true },
                                        { label: 'Class', value: student?.class || subjects[0]?.class || '—' },
                                        { label: 'Roll Number', value: student?.rollNumber || '—' },
                                        { label: 'Section', value: student?.section || subjects[0]?.section || '—' },
                                    ].map(c => (
                                        <div key={c.label}>
                                            <p className="text-xs text-indigo-500 font-semibold uppercase tracking-wide">{c.label}</p>
                                            <p className={`mt-0.5 ${c.lg ? 'text-base font-bold text-indigo-900' : 'text-sm font-semibold text-gray-800'}`}>{c.value}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* ── Marks Table ── */}
                            <div className="px-8 py-5">
                                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Subject-wise Performance</p>
                                <div className="overflow-x-auto rounded-xl border border-gray-200">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                                <th className="px-4 py-3 text-left">Subject</th>
                                                <th className="px-4 py-3 text-left">Exam</th>
                                                <th className="px-4 py-3 text-center">Max</th>
                                                <th className="px-4 py-3 text-center">Obtained</th>
                                                <th className="px-4 py-3 text-center">%</th>
                                                <th className="px-4 py-3 text-center">Grade</th>
                                                <th className="px-4 py-3 text-center">Result</th>
                                                <th className="px-4 py-3 text-left">Remarks</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {subjects.map((s, i) => {
                                                const gi = GRADE_INFO[s.grade] || { bg: '#f3f4f6', color: '#374151', border: '#d1d5db' };
                                                return (
                                                    <tr key={s.examId} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}>
                                                        <td className="px-4 py-3 font-semibold text-gray-900">{s.subject}</td>
                                                        <td className="px-4 py-3 text-xs text-gray-500">
                                                            <div className="font-medium text-gray-700">{s.examName}</div>
                                                            <div>{new Date(s.date).toLocaleDateString('en-IN')}</div>
                                                        </td>
                                                        <td className="px-4 py-3 text-center text-gray-600">{s.totalMarks}</td>
                                                        <td className="px-4 py-3 text-center font-bold text-gray-900">{s.marksObtained}</td>
                                                        <td className="px-4 py-3 text-center font-medium">{s.percentage}%</td>
                                                        <td className="px-4 py-3 text-center">
                                                            <span style={{ background: gi.bg, color: gi.color, border: `1px solid ${gi.border}` }}
                                                                className="inline-flex items-center px-2 py-0.5 rounded-md text-sm font-bold">
                                                                {s.grade}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            {s.isPassed
                                                                ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700"><CheckCircle className="h-3 w-3" />Pass</span>
                                                                : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-600"><XCircle className="h-3 w-3" />Fail</span>}
                                                        </td>
                                                        <td className="px-4 py-3 text-xs text-gray-400 italic">{s.remarks || '—'}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                        {/* Grand Total */}
                                        <tfoot>
                                            <tr className="bg-indigo-600 text-white text-sm font-bold">
                                                <td className="px-4 py-3" colSpan={2}>Grand Total</td>
                                                <td className="px-4 py-3 text-center">{summary.grandTotal}</td>
                                                <td className="px-4 py-3 text-center">{summary.grandObtained}</td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className="flex items-center justify-center gap-1">
                                                        <TrendingUp className="h-3.5 w-3.5" />{summary.overallPercentage}%
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span style={{ background: GRADE_INFO[summary.overallGrade]?.bg || '#fff', color: GRADE_INFO[summary.overallGrade]?.color || '#000' }}
                                                        className="inline-flex items-center px-2 py-0.5 rounded-md font-bold text-sm">
                                                        {summary.overallGrade}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-center" colSpan={2}>
                                                    {summary.overallPassed
                                                        ? <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-bold bg-green-500 text-white"><CheckCircle className="h-4 w-4" />PASS</span>
                                                        : <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-bold bg-red-500 text-white"><XCircle className="h-4 w-4" />FAIL</span>}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>

                                {/* Stats */}
                                <div className="mt-3 flex flex-wrap gap-4 text-sm text-gray-500">
                                    <span>Total Subjects: <strong className="text-gray-800">{summary.totalSubjects}</strong></span>
                                    <span className="text-green-700">Passed: <strong>{summary.passCount}</strong></span>
                                    {summary.failCount > 0 && <span className="text-red-600">Failed: <strong>{summary.failCount}</strong></span>}
                                </div>
                            </div>

                            {/* ── Result Banner ── */}
                            <div className={`mx-8 mb-6 rounded-xl px-6 py-4 flex items-center justify-center gap-3 ${summary.overallPassed ? 'bg-green-50' : 'bg-red-50'}`}>
                                <span className="text-2xl">{summary.overallPassed ? '✅' : '❌'}</span>
                                <span className={`text-xl font-black tracking-wide ${summary.overallPassed ? 'text-green-700' : 'text-red-700'}`}>
                                    {summary.overallPassed ? 'PROMOTED TO NEXT CLASS' : 'DETAINED / FAILED'}
                                </span>
                            </div>

                            {/* ── Signatures ── */}
                            <div className="mx-8 mb-8 border-t-2 border-dashed border-gray-200 pt-6 grid grid-cols-3 gap-6 text-center text-xs text-gray-400">
                                <div><div className="h-10 border-b border-gray-400 mb-2" /><p className="font-medium text-gray-600">Class Teacher</p><p>Signature &amp; Seal</p></div>
                                <div className="flex flex-col items-center">
                                    <div className="w-16 h-16 rounded-full border-2 border-dashed border-gray-300 mb-2" />
                                    <p className="text-gray-500">Official Stamp</p>
                                </div>
                                <div><div className="h-10 border-b border-gray-400 mb-2" /><p className="font-medium text-gray-600">Principal</p><p>Signature &amp; Seal</p></div>
                            </div>

                            <p className="text-center text-xs text-gray-400 pb-6 italic px-8">
                                This is a computer-generated report card issued by {schoolInfo.name}.
                            </p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ResultCard;
