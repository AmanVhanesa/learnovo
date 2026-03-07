import React, { useState, useEffect } from 'react';
import { X, Printer, FileText } from 'lucide-react';
import { examsService } from '../services/examsService';
import { settingsService } from '../services/settingsService';
import toast from 'react-hot-toast';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001';
const SERVER_URL = API_BASE.replace(/\/api\/?$/, '');

const getSignatureUrl = (url) => {
    if (!url) return null;
    const full = url.startsWith('http') ? url : `${SERVER_URL}${url}`;
    return encodeURI(full);
};

const SERIES_OPTIONS = ['Unit Test', 'Midterm', 'Final', 'Annual', 'Custom'];

/* ─────────────────────────────────────────────────────────
   Minimal grade helpers — monochrome-first, just a tint
───────────────────────────────────────────────────────── */
const GRADE_COLOR = (g) => ({ 'A+': '#14532d', 'A': '#14532d', 'B': '#134e4a', 'C': '#1e40af', 'D': '#78350f', 'F': '#991b1b' }[g] || '#1f2937');
const GRADE_BG = (g) => ({ 'A+': '#f0fdf4', 'A': '#f0fdf4', 'B': '#f0fdfa', 'C': '#eff6ff', 'D': '#fffbeb', 'F': '#fff1f2' }[g] || '#f9fafb');

/* ─────────────────────────────────────────────────────────
   Build a premium, minimal certificate HTML for print
───────────────────────────────────────────────────────── */
function buildPrintHTML({ cardData, schoolInfo, filterSeries }) {
    const { student, subjects, summary } = cardData;
    const issueDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

    const sName = student?.fullName || student?.name || '—';
    const sClass = student?.class || subjects[0]?.class || '—';
    const sSection = student?.section || subjects[0]?.section || '—';
    const sRoll = student?.rollNumber || '—';
    const sAdm = student?.admissionNumber || '—';

    const subjectRows = subjects.map((s, i) => `
      <tr style="background:${i % 2 === 0 ? '#fff' : '#fafafa'}">
        <td style="padding:9px 12px;font-weight:600;color:#111;border-bottom:1px solid #e5e7eb">${s.subject}</td>
        <td style="padding:9px 12px;border-bottom:1px solid #e5e7eb">
          <div style="font-weight:500;color:#374151;font-size:12px">${s.examName}</div>
          <div style="color:#9ca3af;font-size:11px">${new Date(s.date).toLocaleDateString('en-IN')}</div>
        </td>
        <td style="padding:9px 12px;text-align:center;border-bottom:1px solid #e5e7eb;color:#555">${s.totalMarks}</td>
        <td style="padding:9px 12px;text-align:center;border-bottom:1px solid #e5e7eb;font-weight:800;font-size:15px;color:#111;font-family:'Playfair Display',Georgia,serif">${s.marksObtained}</td>
        <td style="padding:9px 12px;text-align:center;border-bottom:1px solid #e5e7eb;color:#555">${s.percentage}%</td>
        <td style="padding:9px 12px;text-align:center;border-bottom:1px solid #e5e7eb">
          <span style="background:${GRADE_BG(s.grade)};color:${GRADE_COLOR(s.grade)};padding:2px 9px;border-radius:4px;font-weight:700;font-size:12px;letter-spacing:.04em">${s.grade}</span>
        </td>
        <td style="padding:9px 12px;text-align:center;border-bottom:1px solid #e5e7eb">
          <span style="font-size:12px;font-weight:600;color:${s.isPassed ? '#166534' : '#b91c1c'}">${s.isPassed ? '✓ Pass' : '✗ Fail'}</span>
        </td>
        <td style="padding:9px 12px;border-bottom:1px solid #e5e7eb;color:#9ca3af;font-size:11px;font-style:italic">${s.remarks || '—'}</td>
      </tr>`).join('');

    const logoTag = schoolInfo.logo
        ? `<img src="${getSignatureUrl(schoolInfo.logo) || schoolInfo.logo}" alt="Logo" style="width:80px;height:80px;object-fit:contain;border-radius:6px">`
        : `<div style="width:80px;height:80px;background:#f1f5f9;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:30px;font-weight:900;color:#334155">${(schoolInfo.name || 'S')[0]}</div>`;

    const sigUrl = getSignatureUrl(schoolInfo.principalSignature);
    const principalSigTag = sigUrl
        ? `<div style="width:120px;height:52px;display:flex;align-items:flex-end;justify-content:center;margin-bottom:0"><img src="${sigUrl}" alt="Principal Signature" style="max-width:100%;max-height:100%;object-fit:contain"></div>`
        : `<div style="width:120px;height:52px"></div>`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Report Card — ${sName}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Inter',system-ui,sans-serif;background:#fff;color:#1a1a1a;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .page{max-width:820px;margin:20px auto;border:1.5px solid #1a1a1a}
  .inner{border:1px solid #888;margin:5px;padding:0}
  /* ── Header ── */
  .hdr{padding:28px 32px;display:flex;align-items:center;gap:24px;border-bottom:2px solid #1a1a1a}
  .hdr-mid{flex:1;text-align:center}
  .school-name{font-family:'Playfair Display',Georgia,serif;font-size:28px;font-weight:900;letter-spacing:-.01em;color:#0f172a}
  .school-addr{font-size:11.5px;color:#555;margin-top:4px;line-height:1.6}
  .card-badge{display:inline-block;margin-top:10px;padding:3px 14px;border:1px solid #0f172a;font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#0f172a}
  .hdr-right{min-width:72px;text-align:right;font-size:10.5px;color:#777;line-height:1.6}
  /* ── Student strip ── */
  .stu{display:grid;grid-template-columns:repeat(4,1fr);gap:0;border-bottom:1.5px solid #1a1a1a}
  .stu-cell{padding:12px 16px;border-right:1px solid #e5e7eb}
  .stu-cell:last-child{border-right:none}
  .stu-label{font-size:9.5px;text-transform:uppercase;letter-spacing:.1em;color:#94a3b8;font-weight:600;display:block;margin-bottom:4px}
  .stu-val{font-size:14px;font-weight:700;color:#0f172a}
  .stu-val.lg{font-family:'Playfair Display',Georgia,serif;font-size:15px;font-weight:900}
  /* ── Marks ── */
  .marks-wrap{padding:0 28px 16px}
  .marks-ttl{font-size:9.5px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#94a3b8;padding:14px 0 8px}
  table{width:100%;border-collapse:collapse;font-size:12.5px}
  table th{background:#f8fafc;padding:8px 12px;text-align:left;font-size:9.5px;text-transform:uppercase;letter-spacing:.07em;color:#64748b;font-weight:700;border-bottom:1.5px solid #e2e8f0}
  table th.c,table td.c{text-align:center}
  .grand-row td{background:#0f172a;color:#fff;padding:11px 12px;font-weight:700;font-size:13px}
  /* ── Stats ── */
  .stats{padding:8px 28px;font-size:11.5px;color:#64748b;display:flex;gap:20px;border-bottom:1px solid #e5e7eb}
  /* ── Result footer ── */
  .result-area{padding:20px 32px;text-align:center}
  .result-rule{height:1px;background:#1a1a1a;margin:0 60px}
  .result-inner{padding:14px 0;display:flex;align-items:center;justify-content:center;gap:16px}
  .result-line{flex:1;height:1px;background:#d1d5db}
  .result-text{font-family:'Playfair Display',Georgia,serif;font-size:14px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:#0f172a;white-space:nowrap}
  .result-sub{font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#94a3b8;margin-top:4px}
  /* ── Signatures ── */
  .sep{border-top:1px dashed #d1d5db;margin:0 28px}
  .sigs{display:grid;grid-template-columns:1fr 1fr 1fr;gap:24px;padding:20px 32px;text-align:center}
  .sig-line{border-bottom:1px solid #aaa;height:36px;margin-bottom:6px}
  .sig-label{font-size:12px;font-weight:600;color:#1e293b}
  .sig-sub{font-size:10px;color:#94a3b8;margin-top:2px}
  .stamp{width:56px;height:56px;border-radius:50%;border:1.5px dashed #cbd5e1;margin:0 auto 6px}
  .footer-note{text-align:center;font-size:10.5px;color:#94a3b8;padding:0 32px 18px;font-style:italic}
  @media print{body{background:#fff}.page{border:1.5px solid #1a1a1a;margin:0;max-width:100%}@page{margin:8mm;size:A4}}
</style>
</head>
<body>
<div class="page"><div class="inner">

  <!-- Header -->
  <div class="hdr">
    <div>${logoTag}</div>
    <div class="hdr-mid">
      <div class="school-name">${schoolInfo.name}</div>
      <div class="school-addr">
        ${schoolInfo.address ? `${schoolInfo.address}<br>` : ''}
        ${schoolInfo.phone ? `Phone: ${schoolInfo.phone}${schoolInfo.email ? '  ·  Email: ' + schoolInfo.email : ''}<br>` : ''}
        ${schoolInfo.board ? `${schoolInfo.board}${schoolInfo.affiliation ? ' · Affil: ' + schoolInfo.affiliation : ''}${schoolInfo.udise ? ' · UDISE: ' + schoolInfo.udise : ''}` : ''}
      </div>
      <div class="card-badge">Student Report Card${filterSeries ? ' — ' + filterSeries : ''}</div>
    </div>
    <div class="hdr-right">Date<br>${issueDate}</div>
  </div>

  <!-- Student strip -->
  <div class="stu">
    <div class="stu-cell"><span class="stu-label">Student Name</span><div class="stu-val lg">${sName}</div></div>
    <div class="stu-cell"><span class="stu-label">Adm. Number</span><div class="stu-val">${sAdm}</div></div>
    <div class="stu-cell"><span class="stu-label">Class / Section</span><div class="stu-val">${sClass}${sSection !== '—' ? ' — ' + sSection : ''}</div></div>
    <div class="stu-cell"><span class="stu-label">Roll Number</span><div class="stu-val">${sRoll}</div></div>
  </div>

  <!-- Marks table -->
  <div class="marks-wrap">
    <div class="marks-ttl">Subject-wise Performance</div>
    <table>
      <thead><tr>
        <th>Subject</th><th>Exam</th><th class="c">Max</th><th class="c">Obtained</th>
        <th class="c">%</th><th class="c">Grade</th><th class="c">Result</th><th>Remarks</th>
      </tr></thead>
      <tbody>${subjectRows}</tbody>
      <tfoot>
        <tr class="grand-row">
          <td colspan="2">Grand Total</td>
          <td class="c">${summary.grandTotal}</td>
          <td class="c" style="font-size:16px;font-family:'Playfair Display',Georgia,serif">${summary.grandObtained}</td>
          <td class="c">${summary.overallPercentage}%</td>
          <td class="c"><span style="background:${GRADE_BG(summary.overallGrade)};color:${GRADE_COLOR(summary.overallGrade)};padding:2px 10px;border-radius:4px;font-weight:700">${summary.overallGrade}</span></td>
          <td colspan="2" class="c"><span style="font-weight:800;letter-spacing:.06em">${summary.overallPassed ? '✓ PASS' : '✗ FAIL'}</span></td>
        </tr>
      </tfoot>
    </table>
  </div>

  <!-- Stats -->
  <div class="stats">
    <span>Total Subjects: <strong style="color:#0f172a">${summary.totalSubjects}</strong></span>
    <span>Passed: <strong style="color:#166534">${summary.passCount}</strong></span>
    ${summary.failCount > 0 ? `<span>Failed: <strong style="color:#b91c1c">${summary.failCount}</strong></span>` : ''}
  </div>

  <!-- Result footer (elegant) -->
  <div class="result-area">
    <div class="result-rule"></div>
    <div class="result-inner">
      <div class="result-line"></div>
      <div>
        <div class="result-text">${summary.overallPassed ? 'Promoted to Next Class' : 'Detained — Failed'}</div>
        <div class="result-sub">${summary.overallPassed ? 'Academic Year Progress' : 'Please consult the school'}</div>
      </div>
      <div class="result-line"></div>
    </div>
    <div class="result-rule"></div>
  </div>

  <!-- Signatures -->
  <div class="sep"></div>
  <div class="sigs">
    <div><div class="sig-line"></div><div class="sig-label">Class Teacher</div><div class="sig-sub">Signature &amp; Seal</div></div>
    <div><div class="stamp"></div><div class="sig-label">Official Stamp</div></div>
    <div>${principalSigTag}<div class="sig-line"></div><div class="sig-label">Principal</div><div class="sig-sub">Signature &amp; Seal</div></div>
  </div>
  <div class="footer-note">This is a computer-generated report card issued by ${schoolInfo.name}.</div>

</div></div>
<script>window.onload=function(){window.print()}</script>
</body>
</html>`;
}


/* ─────────────────────────────────────────────────────────
   ResultCard screen component
───────────────────────────────────────────────────────── */

const ResultCard = ({ studentId, studentName, defaultExamSeries, onClose }) => {
    const [cardData, setCardData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [printing, setPrinting] = useState(false);
    const [schoolInfo, setSchoolInfo] = useState({ name: 'School', address: '', logo: null, principalSignature: null });
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
                    principalSignature: inst.principalSignature || null,
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
                        <div className="bg-white border border-gray-800 shadow-xl max-w-3xl mx-auto" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
                            {/* Load Playfair Display from Google Fonts */}
                            <link rel="preconnect" href="https://fonts.googleapis.com" />
                            <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
                            <div>

                                {/* ── Certificate Header ── */}
                                <div className="flex items-center gap-6 px-7 py-5 border-b-2 border-gray-800">
                                    {/* Logo — bigger */}
                                    <div className="shrink-0">
                                        {schoolInfo.logo
                                            ? <img src={schoolInfo.logo} alt="Logo" className="w-20 h-20 object-contain" />
                                            : <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center text-3xl font-black text-slate-500">{(schoolInfo.name || 'S')[0]}</div>
                                        }
                                    </div>
                                    {/* School info */}
                                    <div className="flex-1 text-center">
                                        <h1 className="text-2xl font-black tracking-tight text-slate-900 leading-tight" style={{ fontFamily: "'Inter', system-ui, sans-serif", letterSpacing: '-0.02em' }}>{schoolInfo.name}</h1>
                                        {schoolInfo.address && <p className="text-[11px] text-slate-500 mt-1">{schoolInfo.address}</p>}
                                        {schoolInfo.phone && <p className="text-[11px] text-slate-400 mt-0.5">Phone: {schoolInfo.phone}{schoolInfo.email && `  ·  Email: ${schoolInfo.email}`}</p>}
                                        {schoolInfo.board && <p className="text-[11px] text-slate-400 mt-0.5">{schoolInfo.board}{schoolInfo.affiliation && ` · Affil: ${schoolInfo.affiliation}`}{schoolInfo.udise && ` · UDISE: ${schoolInfo.udise}`}</p>}
                                        <div className="inline-block mt-2 px-3 py-0.5 border border-slate-800 text-[10px] font-bold tracking-[.15em] uppercase text-slate-800">
                                            Student Report Card{filterSeries ? ` — ${filterSeries}` : ''}
                                        </div>
                                    </div>
                                    <div className="shrink-0 text-right text-[10px] text-slate-400 leading-relaxed">Date<br />{issueDate}</div>
                                </div>

                                {/* ── Student Info Strip (clean, no color) ── */}
                                <div className="grid grid-cols-4 border-b border-gray-200">
                                    {[
                                        { label: 'Student Name', value: student?.fullName || student?.name || studentName || '—', serif: true },
                                        { label: 'Adm. Number', value: student?.admissionNumber || '—' },
                                        { label: 'Class / Section', value: `${student?.class || subjects[0]?.class || '—'}${(student?.section || subjects[0]?.section) ? ' — ' + (student?.section || subjects[0]?.section) : ''}` },
                                        { label: 'Roll Number', value: student?.rollNumber || '—' },
                                    ].map((c, i) => (
                                        <div key={c.label} className={`px-5 py-3 ${i < 3 ? 'border-r border-gray-200' : ''}`}>
                                            <p className="text-[9.5px] font-semibold uppercase tracking-[.1em] text-slate-400">{c.label}</p>
                                            <p className="mt-1 text-sm font-bold text-slate-900" style={c.serif ? { fontFamily: "'Inter', system-ui, sans-serif", fontSize: '15px', fontWeight: 700 } : {}}>{c.value}</p>
                                        </div>
                                    ))}
                                </div>

                                {/* ── Marks Table ── */}
                                <div className="px-7 py-4">
                                    <p className="text-[9.5px] font-bold uppercase tracking-[.12em] text-slate-400 mb-3">Subject-wise Performance</p>
                                    <div className="overflow-x-auto border border-gray-200">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="bg-slate-50 text-[9.5px] font-bold uppercase tracking-wide text-slate-500 border-b-2 border-slate-200">
                                                    {['Subject', 'Exam', 'Max', 'Obtained', '%', 'Grade', 'Result', 'Remarks'].map((h, i) => (
                                                        <th key={h} className={`px-3 py-2.5 ${i >= 2 && i <= 6 ? 'text-center' : 'text-left'}`}>{h}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {subjects.map((s, i) => (
                                                    <tr key={s.examId} className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}>
                                                        <td className="px-3 py-2.5 font-semibold text-slate-900">{s.subject}</td>
                                                        <td className="px-3 py-2.5">
                                                            <div className="text-xs font-medium text-slate-700">{s.examName}</div>
                                                            <div className="text-xs text-slate-400">{new Date(s.date).toLocaleDateString('en-IN')}</div>
                                                        </td>
                                                        <td className="px-3 py-2.5 text-center text-slate-500">{s.totalMarks}</td>
                                                        <td className="px-3 py-2.5 text-center font-bold text-slate-900 text-base">{s.marksObtained}</td>
                                                        <td className="px-3 py-2.5 text-center text-slate-600">{s.percentage}%</td>
                                                        <td className="px-3 py-2.5 text-center">
                                                            <span style={{ background: GRADE_BG(s.grade), color: GRADE_COLOR(s.grade) }} className="inline-block px-2 py-0.5 text-xs font-bold tracking-wide">{s.grade}</span>
                                                        </td>
                                                        <td className="px-3 py-2.5 text-center">
                                                            <span className={`text-xs font-semibold ${s.isPassed ? 'text-emerald-700' : 'text-red-600'}`}>{s.isPassed ? '✓ Pass' : '✗ Fail'}</span>
                                                        </td>
                                                        <td className="px-3 py-2.5 text-xs text-slate-400 italic">{s.remarks || '—'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                            <tfoot>
                                                {/* Dark navy grand total — no bright blue */}
                                                <tr className="text-white text-sm font-bold" style={{ background: '#0f172a' }}>
                                                    <td className="px-3 py-3" colSpan={2}>Grand Total</td>
                                                    <td className="px-3 py-3 text-center">{summary.grandTotal}</td>
                                                    <td className="px-3 py-3 text-center text-base font-bold">{summary.grandObtained}</td>
                                                    <td className="px-3 py-3 text-center">{summary.overallPercentage}%</td>
                                                    <td className="px-3 py-3 text-center">
                                                        <span style={{ background: GRADE_BG(summary.overallGrade), color: GRADE_COLOR(summary.overallGrade) }} className="inline-block px-2 py-0.5 font-bold text-xs">{summary.overallGrade}</span>
                                                    </td>
                                                    <td className="px-3 py-3 text-center font-black tracking-wide" colSpan={2}>{summary.overallPassed ? '✓ PASS' : '✗ FAIL'}</td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                    <div className="mt-2 flex gap-4 text-xs text-slate-400">
                                        <span>Total Subjects: <strong className="text-slate-600">{summary.totalSubjects}</strong></span>
                                        <span>Passed: <strong className="text-emerald-700">{summary.passCount}</strong></span>
                                        {summary.failCount > 0 && <span>Failed: <strong className="text-red-600">{summary.failCount}</strong></span>}
                                    </div>
                                </div>

                                {/* ── Result Footer — minimal ── */}
                                <div className="mx-7 mb-6 flex items-center gap-4 py-4">
                                    <div className="flex-1 h-px bg-gray-200" />
                                    <div className="text-center px-2">
                                        <p className="text-xs font-semibold tracking-[.14em] uppercase text-slate-700">
                                            {summary.overallPassed ? 'Promoted to Next Class' : 'Detained — Failed'}
                                        </p>
                                        <p className="text-[9.5px] tracking-[.08em] uppercase text-slate-400 mt-0.5">
                                            {summary.overallPassed ? 'Academic Year Progress' : 'Please consult the school'}
                                        </p>
                                    </div>
                                    <div className="flex-1 h-px bg-gray-200" />
                                </div>

                                {/* ── Signatures ── */}
                                <div className="border-t border-dashed border-gray-300 mx-7 pt-5 mb-6 grid grid-cols-3 gap-6 text-center">
                                    <div><div className="h-9 border-b border-gray-400 mb-2" /><p className="text-xs font-semibold text-slate-700">Class Teacher</p><p className="text-[10px] text-slate-400 mt-0.5">Signature &amp; Seal</p></div>
                                    <div className="flex flex-col items-center"><div className="w-12 h-12 rounded-full border border-dashed border-gray-300 mb-2" /><p className="text-xs text-slate-400">Official Stamp</p></div>
                                    <div className="flex flex-col items-end">
                                        {schoolInfo.principalSignature
                                            ? <img src={getSignatureUrl(schoolInfo.principalSignature)} alt="Principal Signature" className="h-12 w-28 object-contain mb-0 ml-auto" />
                                            : <div className="h-9" />}
                                        <div className="w-full border-b border-gray-400 mb-2" />
                                        <p className="text-xs font-semibold text-slate-700 w-full text-center">Principal</p>
                                        <p className="text-[10px] text-slate-400 mt-0.5 w-full text-center">Signature &amp; Seal</p>
                                    </div>
                                </div>
                                <p className="text-center text-[10px] text-slate-300 pb-5 italic px-7">This is a computer-generated report card issued by {schoolInfo.name}.</p>

                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ResultCard;


