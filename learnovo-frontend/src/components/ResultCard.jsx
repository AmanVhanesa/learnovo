import React, { useState, useEffect } from 'react';
import { X, Printer, FileText } from 'lucide-react';
import { examsService } from '../services/examsService';
import { settingsService } from '../services/settingsService';
import toast from 'react-hot-toast';

const SERIES_OPTIONS = ['Unit Test', 'Midterm', 'Final', 'Annual', 'Custom'];

/* ─────────────────────────────────────────────────────────
   Build a certificate-style standalone HTML page for print
───────────────────────────────────────────────────────── */
function buildPrintHTML({ cardData, schoolInfo, filterSeries }) {
    const { student, subjects, summary } = cardData;
    const issueDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

    const sName = student?.fullName || student?.name || '—';
    const sClass = student?.class || subjects[0]?.class || '—';
    const sSection = student?.section || subjects[0]?.section || '—';
    const sRoll = student?.rollNumber || '—';
    const sAdm = student?.admissionNumber || '—';

    const gradeColor = (g) => ({ 'A+': '#166534', 'A': '#14532d', 'B': '#134e4a', 'C': '#1e3a8a', 'D': '#713f12', 'F': '#7f1d1d' }[g] || '#1f2937');
    const gradeBg = (g) => ({ 'A+': '#dcfce7', 'A': '#d1fae5', 'B': '#ccfbf1', 'C': '#dbeafe', 'D': '#fef9c3', 'F': '#fee2e2' }[g] || '#f3f4f6');

    const subjectRows = subjects.map((s, i) => `
      <tr style="background:${i % 2 === 0 ? '#fff' : '#f9fafb'}">
        <td style="padding:9px 10px;font-weight:600;color:#111;border-bottom:1px solid #e5e7eb">${s.subject}</td>
        <td style="padding:9px 10px;border-bottom:1px solid #e5e7eb">
          <div style="font-weight:500;color:#374151;font-size:12px">${s.examName}</div>
          <div style="color:#9ca3af;font-size:11px">${new Date(s.date).toLocaleDateString('en-IN')}</div>
        </td>
        <td style="padding:9px 10px;text-align:center;border-bottom:1px solid #e5e7eb;color:#374151">${s.totalMarks}</td>
        <td style="padding:9px 10px;text-align:center;border-bottom:1px solid #e5e7eb;font-weight:700;font-size:15px;color:#111">${s.marksObtained}</td>
        <td style="padding:9px 10px;text-align:center;border-bottom:1px solid #e5e7eb;color:#374151">${s.percentage}%</td>
        <td style="padding:9px 10px;text-align:center;border-bottom:1px solid #e5e7eb">
          <span style="background:${gradeBg(s.grade)};color:${gradeColor(s.grade)};padding:2px 10px;border-radius:4px;font-weight:700;font-size:13px">${s.grade}</span>
        </td>
        <td style="padding:9px 10px;text-align:center;border-bottom:1px solid #e5e7eb">
          <span style="background:${s.isPassed ? '#dcfce7' : '#fee2e2'};color:${s.isPassed ? '#166534' : '#dc2626'};padding:2px 10px;border-radius:12px;font-size:12px;font-weight:600">${s.isPassed ? '✓ Pass' : '✗ Fail'}</span>
        </td>
        <td style="padding:9px 10px;border-bottom:1px solid #e5e7eb;color:#9ca3af;font-size:12px;font-style:italic">${s.remarks || '—'}</td>
      </tr>`).join('');

    const logoTag = schoolInfo.logo
        ? `<img src="${schoolInfo.logo}" alt="School Logo" style="width:70px;height:70px;object-fit:contain;border-radius:8px">`
        : `<div style="width:70px;height:70px;background:#e0e7ff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:900;color:#4f46e5">${(schoolInfo.name || 'S')[0]}</div>`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Report Card — ${sName}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;background:#fff;color:#111;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .page{max-width:800px;margin:20px auto;border:2px solid #000;padding:0}
  .inner-border{border:1px solid #555;margin:6px;padding:0}
  /* Header */
  .header{padding:24px 28px;display:flex;align-items:flex-start;gap:20px;border-bottom:3px solid #1d1d1d}
  .header-mid{flex:1;text-align:center}
  .school-name{font-size:26px;font-weight:900;letter-spacing:-.02em;color:#111}
  .school-sub{font-size:12px;color:#555;margin-top:3px}
  .affil{font-size:11px;color:#555;margin-top:2px}
  .card-label{display:inline-block;margin-top:10px;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#1d4ed8;border-bottom:2px solid #1d4ed8;padding-bottom:1px}
  .header-right{text-align:right;min-width:80px}
  .issue-date{font-size:11px;color:#777}
  /* Student strip */
  .student-strip{background:#f0f4ff;border-bottom:2px solid #c7d2fe;padding:14px 28px;display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
  .info-cell label{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#4338ca;font-weight:700;display:block}
  .info-cell .val{font-size:15px;font-weight:800;color:#1e1b4b;margin-top:2px}
  /* Marks */
  .marks-section{padding:0 28px 20px}
  .marks-title{font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#6b7280;padding:14px 0 8px}
  table{width:100%;border-collapse:collapse;font-size:13px}
  table th{background:#f8fafc;padding:9px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;font-weight:700;border-bottom:2px solid #e5e7eb}
  table th.c,table td.c{text-align:center}
  .grand-row td{background:#1d4ed8;color:#fff;padding:11px 10px;font-weight:700;font-size:14px}
  /* Stats */
  .stats{padding:8px 28px;font-size:12px;color:#555;display:flex;gap:20px}
  /* Result banner */
  .result-banner{margin:16px 28px;border-radius:8px;padding:12px 24px;text-align:center}
  .result-text{font-size:20px;font-weight:900;letter-spacing:.08em}
  /* Separator */
  .sep{border-top:2px dashed #d1d5db;margin:16px 28px 0}
  /* Signatures */
  .sigs{display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;padding:20px 28px 24px;text-align:center}
  .sig-line{border-bottom:1px solid #555;height:40px;margin-bottom:6px}
  .sig-label{font-size:13px;font-weight:700;color:#374151}
  .sig-sub{font-size:11px;color:#9ca3af}
  .stamp{width:64px;height:64px;border-radius:50%;border:2px dashed #d1d5db;margin:0 auto 6px}
  .footer-note{text-align:center;font-size:11px;color:#9ca3af;padding:0 28px 16px;font-style:italic}
  @media print{
    body{background:#fff}
    .page{border:2px solid #000;margin:0;max-width:100%}
    @page{margin:8mm;size:A4}
  }
</style>
</head>
<body>
<div class="page">
<div class="inner-border">

  <!-- Header (matches certificate: logo left, school centered) -->
  <div class="header">
    <div>${logoTag}</div>
    <div class="header-mid">
      <div class="school-name">${schoolInfo.name}</div>
      ${schoolInfo.address ? `<div class="school-sub">${schoolInfo.address}</div>` : ''}
      ${schoolInfo.phone ? `<div class="affil">Phone: ${schoolInfo.phone}${schoolInfo.email ? '  |  Email: ' + schoolInfo.email : ''}</div>` : ''}
      ${schoolInfo.board ? `<div class="affil">${schoolInfo.board} | Affil No: ${schoolInfo.affiliation || '—'} | UDISE: ${schoolInfo.udise || '—'}</div>` : ''}
      <div class="card-label">Student Report Card${filterSeries ? ' — ' + filterSeries : ''}</div>
    </div>
    <div class="header-right">
      <div class="issue-date">Date: ${issueDate}</div>
    </div>
  </div>

  <!-- Student info strip -->
  <div class="student-strip">
    <div class="info-cell"><label>Student Name</label><div class="val">${sName}</div></div>
    <div class="info-cell"><label>Adm. Number</label><div class="val">${sAdm}</div></div>
    <div class="info-cell"><label>Class / Section</label><div class="val">${sClass}${sSection !== '—' ? ' – ' + sSection : ''}</div></div>
    <div class="info-cell"><label>Roll Number</label><div class="val">${sRoll}</div></div>
  </div>

  <!-- Marks table -->
  <div class="marks-section">
    <div class="marks-title">Subject-wise Performance</div>
    <table>
      <thead>
        <tr>
          <th>Subject</th><th>Exam</th><th class="c">Max</th>
          <th class="c">Obtained</th><th class="c">%</th>
          <th class="c">Grade</th><th class="c">Result</th><th>Remarks</th>
        </tr>
      </thead>
      <tbody>${subjectRows}</tbody>
      <tfoot>
        <tr class="grand-row">
          <td colspan="2">Grand Total</td>
          <td class="c">${summary.grandTotal}</td>
          <td class="c">${summary.grandObtained}</td>
          <td class="c">${summary.overallPercentage}%</td>
          <td class="c"><span style="background:${gradeBg(summary.overallGrade)};color:${gradeColor(summary.overallGrade)};padding:2px 10px;border-radius:4px;font-weight:700">${summary.overallGrade}</span></td>
          <td colspan="2" class="c"><span style="background:${summary.overallPassed ? '#16a34a' : '#dc2626'};padding:4px 16px;border-radius:16px;font-weight:800;color:#fff">${summary.overallPassed ? '✓ PASS' : '✗ FAIL'}</span></td>
        </tr>
      </tfoot>
    </table>
  </div>

  <!-- Stats -->
  <div class="stats">
    <span>Total Subjects: <strong>${summary.totalSubjects}</strong></span>
    <span style="color:#166534">Passed: <strong>${summary.passCount}</strong></span>
    ${summary.failCount > 0 ? `<span style="color:#dc2626">Failed: <strong>${summary.failCount}</strong></span>` : ''}
  </div>

  <!-- Result banner -->
  <div class="result-banner" style="background:${summary.overallPassed ? '#f0fdf4' : '#fff1f2'}">
    <div class="result-text" style="color:${summary.overallPassed ? '#15803d' : '#dc2626'}">${summary.overallPassed ? '✅ PROMOTED TO NEXT CLASS' : '❌ DETAINED / FAILED'}</div>
  </div>

  <!-- Signatures (matches certificate footer) -->
  <div class="sep"></div>
  <div class="sigs">
    <div><div class="sig-line"></div><div class="sig-label">Class Teacher</div><div class="sig-sub">Signature &amp; Seal</div></div>
    <div><div class="stamp"></div><div class="sig-label">Official Stamp</div></div>
    <div><div class="sig-line"></div><div class="sig-label">Principal</div><div class="sig-sub">Signature &amp; Seal</div></div>
  </div>
  <div class="footer-note">This is a computer-generated report card issued by ${schoolInfo.name}.</div>

</div>
</div>
<script>window.onload=function(){window.print()}</script>
</body>
</html>`;
}

/* ─────────────────────────────────────────────────────────
   ResultCard screen component
───────────────────────────────────────────────────────── */
const gradeColor = (g) => ({ 'A+': '#166534', 'A': '#14532d', 'B': '#134e4a', 'C': '#1e3a8a', 'D': '#713f12', 'F': '#7f1d1d' }[g] || '#1f2937');
const gradeBg = (g) => ({ 'A+': '#dcfce7', 'A': '#d1fae5', 'B': '#ccfbf1', 'C': '#dbeafe', 'D': '#fef9c3', 'F': '#fee2e2' }[g] || '#f3f4f6');

const ResultCard = ({ studentId, studentName, defaultExamSeries, onClose }) => {
    const [cardData, setCardData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [printing, setPrinting] = useState(false);
    const [schoolInfo, setSchoolInfo] = useState({ name: 'School', address: '', logo: null });
    const [filterSeries, setFilterSeries] = useState(defaultExamSeries || '');

    /* ── settings ── */
    useEffect(() => {
        settingsService.getSettings?.()
            .then(res => {
                const inst = (res?.data || res)?.institution;
                if (!inst) return;
                setSchoolInfo({
                    name: inst.name || 'School',
                    address: [inst.address?.street, inst.address?.city, inst.address?.state].filter(Boolean).join(', '),
                    phone: inst.contact?.phone || '',
                    email: inst.contact?.email || '',
                    board: inst.board || '',
                    affiliation: inst.affiliationNumber || '',
                    udise: inst.udiseCode || '',
                    logo: inst.logo || null,
                });
            })
            .catch(() => { });
    }, []);

    /* ── result card data ── */
    useEffect(() => {
        if (!studentId) return;
        setLoading(true);
        examsService.getResultCard(studentId, { examSeries: filterSeries })
            .then(res => setCardData(res.data))
            .catch(() => toast.error('Failed to load result card'))
            .finally(() => setLoading(false));
    }, [studentId, filterSeries]);

    /* ── print ── */
    const handlePrint = () => {
        if (!cardData?.subjects?.length) return;
        setPrinting(true);
        try {
            const html = buildPrintHTML({ cardData, schoolInfo, filterSeries });
            const win = window.open('', '_blank', 'width=900,height=700');
            if (!win) { toast.error('Popup blocked — allow popups for this site'); setPrinting(false); return; }
            win.document.write(html);
            win.document.close();
        } finally { setPrinting(false); }
    };

    const student = cardData?.student;
    const subjects = cardData?.subjects || [];
    const summary = cardData?.summary;
    const issueDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

    return (
        <div className="modal-overlay" role="dialog" aria-modal="true">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl mx-4 max-h-[92vh] flex flex-col">

                {/* ── Modal Header ── */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
                    <div className="flex items-center gap-2.5">
                        <FileText className="h-5 w-5 text-primary-600 shrink-0" />
                        <div>
                            <h3 className="text-base font-semibold text-gray-900 leading-tight">Student Report Card</h3>
                            {(student?.fullName || student?.name || studentName) && (
                                <p className="text-xs text-gray-400 mt-0.5">{student?.fullName || student?.name || studentName}</p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                        <div className="flex items-center gap-1.5">
                            <label className="text-xs text-gray-500 font-medium whitespace-nowrap">Exam Series:</label>
                            <select
                                className="input w-32 text-sm h-9"
                                value={filterSeries}
                                onChange={e => setFilterSeries(e.target.value)}
                            >
                                <option value="">All Series</option>
                                {SERIES_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <button
                            className="btn btn-primary btn-sm gap-1.5"
                            onClick={handlePrint}
                            disabled={loading || !subjects.length || printing}
                        >
                            <Printer className="h-4 w-4" />
                            {printing ? 'Opening…' : 'Print / PDF'}
                        </button>
                        <button
                            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                            onClick={onClose}
                        >
                            <X className="h-5 w-5 text-gray-500" />
                        </button>
                    </div>
                </div>

                {/* ── Scrollable Body ── */}
                <div className="overflow-y-auto flex-1 bg-gray-100 p-4">

                    {/* Loading */}
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                            <div className="loading-spinner mb-3" />
                            <p className="text-sm">Loading result card…</p>
                        </div>
                    ) : !subjects.length ? (
                        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                            <FileText className="h-10 w-10 mb-3 opacity-40" />
                            <p className="font-medium">No results found</p>
                            <p className="text-sm mt-1 text-center px-8">
                                {filterSeries
                                    ? `No results for "${filterSeries}". Try "All Series".`
                                    : 'No exam results entered yet.'}
                            </p>
                        </div>
                    ) : (

                        /* ══ Certificate Card ══ */
                        <div className="bg-white border-2 border-gray-800 shadow-xl max-w-3xl mx-auto">
                            <div className="border border-gray-400 m-1.5">

                                {/* Certificate Header */}
                                <div className="flex items-start gap-5 px-7 py-5 border-b-2 border-gray-800">
                                    <div className="shrink-0">
                                        {schoolInfo.logo
                                            ? <img src={schoolInfo.logo} alt="Logo" className="w-16 h-16 object-contain rounded-lg" />
                                            : <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center text-2xl font-black text-indigo-600">{(schoolInfo.name || 'S')[0]}</div>
                                        }
                                    </div>
                                    <div className="flex-1 text-center">
                                        <h1 className="text-2xl font-black tracking-tight text-gray-900">{schoolInfo.name}</h1>
                                        {schoolInfo.address && <p className="text-xs text-gray-500 mt-0.5">{schoolInfo.address}</p>}
                                        {schoolInfo.phone && <p className="text-xs text-gray-400 mt-0.5">Phone: {schoolInfo.phone}{schoolInfo.email && `  |  Email: ${schoolInfo.email}`}</p>}
                                        {schoolInfo.board && <p className="text-xs text-gray-400 mt-0.5">{schoolInfo.board}{schoolInfo.affiliation && ` | Affil: ${schoolInfo.affiliation}`}{schoolInfo.udise && ` | UDISE: ${schoolInfo.udise}`}</p>}
                                        <div className="inline-block mt-2 text-xs font-bold tracking-widest uppercase text-blue-700 border-b-2 border-blue-700 pb-0.5">
                                            Student Report Card{filterSeries ? ` — ${filterSeries}` : ''}
                                        </div>
                                    </div>
                                    <div className="shrink-0 text-right text-xs text-gray-400">Date:<br />{issueDate}</div>
                                </div>

                                {/* Student Info Strip */}
                                <div className="grid grid-cols-4 gap-4 bg-indigo-50 border-b-2 border-indigo-200 px-7 py-3">
                                    {[
                                        { label: 'Student Name', value: student?.fullName || student?.name || studentName || '—', bold: true },
                                        { label: 'Adm. Number', value: student?.admissionNumber || '—' },
                                        { label: 'Class / Section', value: `${student?.class || subjects[0]?.class || '—'}${(student?.section || subjects[0]?.section) ? ' – ' + (student?.section || subjects[0]?.section) : ''}` },
                                        { label: 'Roll Number', value: student?.rollNumber || '—' },
                                    ].map(c => (
                                        <div key={c.label}>
                                            <p className="text-[10px] font-bold uppercase tracking-wide text-indigo-500">{c.label}</p>
                                            <p className={`mt-0.5 ${c.bold ? 'text-base font-black text-indigo-900' : 'text-sm font-bold text-gray-800'}`}>{c.value}</p>
                                        </div>
                                    ))}
                                </div>

                                {/* Marks Table */}
                                <div className="px-7 py-4">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Subject-wise Performance</p>
                                    <div className="overflow-x-auto border border-gray-200 rounded">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="bg-gray-50 text-[10px] font-bold uppercase tracking-wide text-gray-500 border-b-2 border-gray-200">
                                                    {['Subject', 'Exam', 'Max', 'Obtained', '%', 'Grade', 'Result', 'Remarks'].map((h, i) => (
                                                        <th key={h} className={`px-3 py-2.5 ${i >= 2 && i <= 6 ? 'text-center' : 'text-left'}`}>{h}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {subjects.map((s, i) => (
                                                    <tr key={s.examId} className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                                                        <td className="px-3 py-2.5 font-semibold text-gray-900">{s.subject}</td>
                                                        <td className="px-3 py-2.5">
                                                            <div className="text-xs font-medium text-gray-700">{s.examName}</div>
                                                            <div className="text-xs text-gray-400">{new Date(s.date).toLocaleDateString('en-IN')}</div>
                                                        </td>
                                                        <td className="px-3 py-2.5 text-center text-gray-600">{s.totalMarks}</td>
                                                        <td className="px-3 py-2.5 text-center font-black text-gray-900 text-base">{s.marksObtained}</td>
                                                        <td className="px-3 py-2.5 text-center text-gray-700">{s.percentage}%</td>
                                                        <td className="px-3 py-2.5 text-center">
                                                            <span style={{ background: gradeBg(s.grade), color: gradeColor(s.grade) }} className="inline-block px-2 py-0.5 rounded font-bold text-sm">{s.grade}</span>
                                                        </td>
                                                        <td className="px-3 py-2.5 text-center">
                                                            {s.isPassed
                                                                ? <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">✓ Pass</span>
                                                                : <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-600">✗ Fail</span>}
                                                        </td>
                                                        <td className="px-3 py-2.5 text-xs text-gray-400 italic">{s.remarks || '—'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                            <tfoot>
                                                <tr className="bg-blue-700 text-white font-bold text-sm">
                                                    <td className="px-3 py-3" colSpan={2}>Grand Total</td>
                                                    <td className="px-3 py-3 text-center">{summary.grandTotal}</td>
                                                    <td className="px-3 py-3 text-center text-base font-black">{summary.grandObtained}</td>
                                                    <td className="px-3 py-3 text-center">{summary.overallPercentage}%</td>
                                                    <td className="px-3 py-3 text-center">
                                                        <span style={{ background: gradeBg(summary.overallGrade), color: gradeColor(summary.overallGrade) }} className="inline-block px-2 py-0.5 rounded font-bold">{summary.overallGrade}</span>
                                                    </td>
                                                    <td className="px-3 py-3 text-center" colSpan={2}>
                                                        <span className={`inline-block px-4 py-1 rounded-full font-black ${summary.overallPassed ? 'bg-green-500' : 'bg-red-500'}`}>{summary.overallPassed ? '✓ PASS' : '✗ FAIL'}</span>
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                    <div className="mt-2 flex gap-4 text-xs text-gray-500">
                                        <span>Total Subjects: <strong className="text-gray-700">{summary.totalSubjects}</strong></span>
                                        <span className="text-green-700">Passed: <strong>{summary.passCount}</strong></span>
                                        {summary.failCount > 0 && <span className="text-red-600">Failed: <strong>{summary.failCount}</strong></span>}
                                    </div>
                                </div>

                                {/* Result Banner */}
                                <div className={`mx-7 mb-5 py-3 rounded text-center ${summary.overallPassed ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                                    <p className={`text-lg font-black tracking-widest uppercase ${summary.overallPassed ? 'text-green-700' : 'text-red-700'}`}>
                                        {summary.overallPassed ? '✅ Promoted to Next Class' : '❌ Detained / Failed'}
                                    </p>
                                </div>

                                {/* Signatures */}
                                <div className="border-t-2 border-dashed border-gray-300 mx-7 pt-5 mb-6 grid grid-cols-3 gap-6 text-center">
                                    <div><div className="h-10 border-b border-gray-500 mb-2" /><p className="text-sm font-bold text-gray-700">Class Teacher</p><p className="text-xs text-gray-400">Signature &amp; Seal</p></div>
                                    <div className="flex flex-col items-center">
                                        <div className="w-14 h-14 rounded-full border-2 border-dashed border-gray-400 mb-2" />
                                        <p className="text-sm text-gray-500">Official Stamp</p>
                                    </div>
                                    <div><div className="h-10 border-b border-gray-500 mb-2" /><p className="text-sm font-bold text-gray-700">Principal</p><p className="text-xs text-gray-400">Signature &amp; Seal</p></div>
                                </div>
                                <p className="text-center text-xs text-gray-400 pb-5 italic px-7">This is a computer-generated report card issued by {schoolInfo.name}.</p>

                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ResultCard;


