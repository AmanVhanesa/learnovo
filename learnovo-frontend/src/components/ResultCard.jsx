import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { X, Printer, FileText, Download } from 'lucide-react';
import { examsService } from '../services/examsService';
import { settingsService } from '../services/settingsService';
import toast from 'react-hot-toast';

import { SERVER_URL } from '../constants/config';

const getSignatureUrl = (url) => {
    if (!url) return null;
    const full = url.startsWith('http') ? url : `${SERVER_URL}${url}`;
    return encodeURI(full);
};

const SERIES_OPTIONS = ['Unit Test', 'Midterm', 'Final', 'Custom'];

/* ─────────────────────────────────────────────────────────
   Grade helpers — colored dot system (modern, no badges)
───────────────────────────────────────────────────────── */
const GRADE_DOT_COLOR = (g) => {
    const grade = (g || '').toUpperCase();
    if (grade === 'A+' || grade === 'A') return '#059669';
    if (grade === 'B+' || grade === 'B') return '#2563EB';
    if (grade === 'C+' || grade === 'C') return '#D97706';
    return '#DC2626';
};

/* ─────────────────────────────────────────────────────────
   Build premium print HTML — Plus Jakarta Sans, modern table
───────────────────────────────────────────────────────── */
function buildPrintHTML({ cardData, schoolInfo, filterSeries, studentName }) {
    const { student, subjects, summary } = cardData;
    const issueDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
    const brandColor = schoolInfo.brandColor || '#1E3A5F';

    const sName = student?.fullName || student?.name || studentName || '\u2014';
    const sClass = student?.class || subjects[0]?.class || '\u2014';
    const sSection = student?.section || subjects[0]?.section || '';
    const sRoll = student?.rollNumber || '\u2014';
    const sAdm = student?.admissionNumber || '\u2014';

    const subjectRows = subjects.map((s, i) => {
        const dotColor = GRADE_DOT_COLOR(s.grade);
        const examDate = s.date ? new Date(s.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
        const detail = [s.examName, examDate].filter(Boolean).join(' \u00B7 ');
        return `
      <tr style="background:${i % 2 === 0 ? '#fff' : 'rgba(249,250,251,0.5)'};-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important">
        <td class="subj">${s.subject}<span class="exam-detail">${detail}</span></td>
        <td class="num">${s.totalMarks}</td>
        <td class="num" style="font-weight:600">${s.marksObtained}</td>
        <td class="num">${s.percentage}%</td>
        <td class="ctr"><span class="grade-display"><span class="grade-dot" style="background:${dotColor}"></span> ${s.grade}</span></td>
        <td class="ctr"><span style="color:${s.isPassed ? '#059669' : '#DC2626'};font-weight:500;font-size:10px">${s.isPassed ? 'Pass' : 'Fail'}</span></td>
        <td style="font-size:9px;color:#9CA3AF">${s.remarks || '\u2014'}</td>
      </tr>`;
    }).join('');

    const logoTag = schoolInfo.logo
        ? `<div class="school-logo"><img src="${schoolInfo.logo}" alt="Logo" style="width:100%;height:100%;object-fit:cover;border-radius:50%"></div>`
        : `<div class="school-logo-fb" style="background:${brandColor}">${(schoolInfo.name || 'S')[0]}</div>`;

    const sigUrl = getSignatureUrl(schoolInfo.principalSignature);
    const overallDotColor = GRADE_DOT_COLOR(summary.overallGrade);
    const isPassed = summary.overallPassed;

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Report Card \u2014 ${sName}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
  *{margin:0;padding:0;box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
  @page{size:A4;margin:20mm}
  body{font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Helvetica Neue',Helvetica,Arial,sans-serif;background:#fff;color:#111827}
  .page{width:210mm;min-height:297mm;padding:20mm;margin:0 auto}
  /* Header */
  .header{display:flex;align-items:flex-start;gap:16px;margin-bottom:20px}
  .school-logo{width:52px;height:52px;border-radius:50%;overflow:hidden;flex-shrink:0}
  .school-logo-fb{width:52px;height:52px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:18px;letter-spacing:-0.02em;flex-shrink:0}
  .school-info{flex:1}
  .school-name{font-size:20px;font-weight:700;color:#111827;letter-spacing:-0.02em;line-height:1.2}
  .school-addr{font-size:9px;color:#6B7280;margin-top:4px;line-height:1.5}
  .school-meta{font-size:8px;color:#9CA3AF;margin-top:2px;letter-spacing:0.02em}
  .accent-line{height:2.5px;background:${brandColor};margin:20px 0;border:none;border-radius:2px}
  .title-row{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:28px}
  .report-title{font-size:13px;font-weight:600;color:${brandColor};text-transform:uppercase;letter-spacing:0.1em}
  .report-meta{font-size:10px;color:#9CA3AF;text-align:right;line-height:1.6}
  .report-meta .exam-type{font-weight:600;color:#6B7280;display:block}
  /* Student card */
  .stu-card{background:#F9FAFB;border-radius:10px;padding:20px 24px;margin-bottom:28px}
  .stu-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px 32px}
  .info-label{font-size:7.5px;font-weight:600;text-transform:uppercase;letter-spacing:0.12em;color:#9CA3AF;margin-bottom:3px}
  .info-value{font-size:12px;font-weight:600;color:#111827}
  /* Section label */
  .sec-label{font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:0.14em;color:#9CA3AF;margin-bottom:12px}
  /* Table */
  table{width:100%;border-collapse:collapse;margin-bottom:28px}
  thead th{font-size:8px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:#6B7280;padding:10px 12px;text-align:left;border-bottom:1.5px solid #E5E7EB}
  thead th.num{text-align:right}
  thead th.ctr{text-align:center}
  tbody td{font-size:10.5px;color:#111827;padding:14px 12px;border-bottom:0.5px solid #F3F4F6;font-weight:400}
  tbody td.num{text-align:right;font-variant-numeric:tabular-nums}
  tbody td.ctr{text-align:center}
  tbody td.subj{font-weight:500}
  .exam-detail{display:block;font-size:8px;color:#9CA3AF;font-weight:400;margin-top:2px}
  .grade-display{display:inline-flex;align-items:center;gap:6px;font-weight:600}
  .grade-dot{width:7px;height:7px;border-radius:50%;display:inline-block}
  tfoot td{font-size:11px;font-weight:600;color:#111827;padding:14px 12px;border-top:1.5px solid ${brandColor};background:${brandColor}0A}
  tfoot td.num{text-align:right;font-variant-numeric:tabular-nums}
  tfoot td.ctr{text-align:center}
  /* Result banner */
  .result-banner{border-radius:0 8px 8px 0;padding:18px 24px;margin-bottom:28px;display:flex;align-items:center;justify-content:space-between;border-left:3px solid ${isPassed ? '#059669' : '#DC2626'};background:${isPassed ? 'rgba(5,150,105,0.04)' : 'rgba(220,38,38,0.04)'}}
  .result-dot{width:10px;height:10px;border-radius:50%;background:${isPassed ? '#059669' : '#DC2626'}}
  .result-label{font-size:15px;font-weight:700;letter-spacing:0.04em;color:${isPassed ? '#059669' : '#DC2626'}}
  .result-status{display:flex;align-items:center;gap:10px}
  .result-details{text-align:right}
  .result-perf{font-size:10px;color:#6B7280;margin-bottom:2px}
  .result-stats{font-size:9px;color:#9CA3AF}
  /* Signatures */
  .sigs{display:flex;justify-content:space-between;margin-bottom:32px;padding-top:8px}
  .sig-block{text-align:center;width:140px}
  .sig-line{width:100%;height:1px;background:#E5E7EB;margin-bottom:8px;margin-top:40px;position:relative}
  .sig-img{position:absolute;bottom:4px;left:50%;transform:translateX(-50%);max-height:40px;max-width:120px;object-fit:contain}
  .sig-label{font-size:9px;font-weight:600;color:#6B7280}
  .sig-sub{font-size:7px;color:#9CA3AF;margin-top:2px}
  /* Footer */
  .footer{text-align:center;padding-top:16px;border-top:0.5px solid #F3F4F6}
  .footer-text{font-size:7px;color:#9CA3AF;letter-spacing:0.02em;font-style:italic}
  @media print{body{background:#fff}.page{padding:0}}
</style>
</head>
<body>
<div class="page">
  <div class="header">
    ${logoTag}
    <div class="school-info">
      <div class="school-name">${schoolInfo.name}</div>
      <div class="school-addr">${[schoolInfo.address, schoolInfo.phone ? 'Phone: ' + schoolInfo.phone : '', schoolInfo.email].filter(Boolean).join(' \u00B7 ')}</div>
      <div class="school-meta">${[schoolInfo.board, schoolInfo.affiliation ? 'Affil: ' + schoolInfo.affiliation : '', schoolInfo.udise ? 'UDISE: ' + schoolInfo.udise : ''].filter(Boolean).join(' \u00B7 ')}</div>
    </div>
  </div>
  <hr class="accent-line">
  <div class="title-row">
    <div class="report-title">Student Report Card</div>
    <div class="report-meta">
      <span class="exam-type">${filterSeries || 'Midterm'} Examination</span>
      <span>Issued: ${issueDate}</span>
    </div>
  </div>
  <div class="stu-card">
    <div class="stu-grid">
      <div><div class="info-label">Student Name</div><div class="info-value">${sName}</div></div>
      <div><div class="info-label">Admission No.</div><div class="info-value">${sAdm}</div></div>
      <div><div class="info-label">Class / Section</div><div class="info-value">${sClass}${sSection ? ' \u2014 ' + sSection : ''}</div></div>
      <div><div class="info-label">Roll Number</div><div class="info-value">${sRoll}</div></div>
      <div><div class="info-label">Date of Birth</div><div class="info-value">\u2014</div></div>
      <div><div class="info-label">Parent / Guardian</div><div class="info-value">\u2014</div></div>
    </div>
  </div>
  <div class="sec-label">Academic Performance</div>
  <table>
    <thead><tr>
      <th style="width:28%">Subject</th>
      <th class="num" style="width:10%">Max</th>
      <th class="num" style="width:12%">Obtained</th>
      <th class="num" style="width:10%">%</th>
      <th class="ctr" style="width:12%">Grade</th>
      <th class="ctr" style="width:10%">Result</th>
      <th style="width:18%">Remarks</th>
    </tr></thead>
    <tbody>${subjectRows}</tbody>
    <tfoot><tr>
      <td>Grand Total</td>
      <td class="num">${summary.grandTotal}</td>
      <td class="num">${summary.grandObtained}</td>
      <td class="num">${summary.overallPercentage}%</td>
      <td class="ctr"><span class="grade-display"><span class="grade-dot" style="background:${overallDotColor}"></span> ${summary.overallGrade}</span></td>
      <td class="ctr" colspan="2" style="color:${isPassed ? '#059669' : '#DC2626'};letter-spacing:0.04em">${isPassed ? 'PASS' : 'FAIL'}</td>
    </tr></tfoot>
  </table>
  <div class="result-banner">
    <div class="result-status">
      <div class="result-dot"></div>
      <div class="result-label">${isPassed ? 'PASSED' : 'FAILED'}</div>
    </div>
    <div class="result-details">
      <div class="result-perf">${isPassed ? 'Satisfactory Performance' : 'Needs Improvement'}</div>
      <div class="result-stats">${summary.passCount} of ${summary.totalSubjects} subjects passed \u00B7 Overall: ${summary.overallPercentage}% \u00B7 Grade: ${summary.overallGrade}</div>
    </div>
  </div>
  <div class="sigs">
    <div class="sig-block"><div class="sig-line"></div><div class="sig-label">Class Teacher</div><div class="sig-sub">Signature &amp; Seal</div></div>
    <div class="sig-block"><div class="sig-line">${sigUrl ? `<img class="sig-img" src="${sigUrl}" alt="Principal Signature">` : ''}</div><div class="sig-label">Principal</div><div class="sig-sub">Signature &amp; Seal</div></div>
    <div class="sig-block"><div class="sig-line"></div><div class="sig-label">Parent / Guardian</div><div class="sig-sub">Signature</div></div>
  </div>
  <div class="footer"><div class="footer-text">This is a computer-generated report card issued by ${schoolInfo.name} \u00B7 Powered by Learnovo</div></div>
</div>
<script>window.onload=function(){window.print()}</script>
</body>
</html>`;
}


/* ─────────────────────────────────────────────────────────
   ResultCard screen component — Premium redesign
───────────────────────────────────────────────────────── */

const ResultCard = ({ studentId, studentName, defaultExamSeries, onClose }) => {
    const [cardData, setCardData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [printing, setPrinting] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [schoolInfo, setSchoolInfo] = useState({ name: 'School', address: '', logo: null, principalSignature: null, brandColor: '#1E3A5F' });
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
                    brandColor: inst.brandColor || '#1E3A5F',
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
            const html = buildPrintHTML({ cardData, schoolInfo, filterSeries, studentName });
            const win = window.open('', '_blank', 'width=900,height=700');
            if (!win) { toast.error('Popup blocked \u2014 allow popups for this site'); setPrinting(false); return; }
            win.document.write(html);
            win.document.close();
        } finally { setPrinting(false); }
    };

    /* ── download PDF via backend ── */
    const handleDownloadPDF = async () => {
        if (!cardData?.subjects?.length) return;
        setDownloading(true);
        try {
            const blob = await examsService.downloadReportCardPDF(studentId, { examSeries: filterSeries });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Report_Card_${(cardData?.student?.name || studentName || 'Student').replace(/\s+/g, '_')}_${filterSeries || 'All'}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            toast.success('Report card downloaded');
        } catch {
            toast.error('Failed to download PDF');
        } finally {
            setDownloading(false);
        }
    };

    const student = cardData?.student;
    const subjects = cardData?.subjects || [];
    const summary = cardData?.summary;
    const brandColor = schoolInfo.brandColor || '#1E3A5F';

    return ReactDOM.createPortal(
        <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="bg-white dark:bg-[#1C1C1E] rounded-none sm:rounded-2xl shadow-glass-lg w-full max-w-4xl sm:mx-4 h-full sm:h-auto sm:max-h-[92vh] flex flex-col">

                {/* ── Modal Header ── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-[#38383A] shrink-0 gap-2">
                    <div className="flex items-center gap-2.5">
                        <FileText className="h-5 w-5 text-primary-600 dark:text-primary-400 shrink-0" />
                        <div>
                            <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white leading-tight">Student Report Card</h3>
                            {(student?.fullName || student?.name || studentName) && (
                                <p className="text-xs text-gray-400 dark:text-[#636366] mt-0.5 truncate">{student?.fullName || student?.name || studentName}</p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                        <div className="flex items-center gap-1.5">
                            <label className="text-xs text-gray-500 dark:text-[#8E8E93] font-medium whitespace-nowrap">Exam Series:</label>
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
                            className="btn btn-sm gap-1.5 border border-gray-300 dark:border-[#38383A] text-gray-700 dark:text-[#8E8E93] hover:bg-gray-50 dark:hover:bg-[#2C2C2E]"
                            onClick={handleDownloadPDF}
                            disabled={loading || !subjects.length || downloading}
                        >
                            <Download className="h-4 w-4" />
                            {downloading ? 'Downloading\u2026' : 'Download PDF'}
                        </button>
                        <button
                            className="btn btn-primary btn-sm gap-1.5"
                            onClick={handlePrint}
                            disabled={loading || !subjects.length || printing}
                        >
                            <Printer className="h-4 w-4" />
                            {printing ? 'Opening\u2026' : 'Print'}
                        </button>
                        <button
                            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-[#2C2C2E] transition-colors"
                            onClick={onClose}
                        >
                            <X className="h-5 w-5 text-gray-500 dark:text-[#8E8E93]" />
                        </button>
                    </div>
                </div>

                {/* ── Scrollable Body ── */}
                <div className="overflow-y-auto flex-1 bg-gray-100 dark:bg-[#000000] p-4">

                    {/* Loading */}
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-[#636366]">
                            <div className="loading-spinner mb-3" />
                            <p className="text-sm">Loading result card\u2026</p>
                        </div>
                    ) : !subjects.length ? (
                        <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-[#636366]">
                            <FileText className="h-10 w-10 mb-3 opacity-40" />
                            <p className="font-medium">No results found</p>
                            <p className="text-sm mt-1 text-center px-8">
                                {filterSeries
                                    ? `No results for "${filterSeries}". Try "All Series".`
                                    : 'No exam results entered yet.'}
                            </p>
                        </div>
                    ) : (

                        /* ══ Premium Report Card Preview ══ */
                        <div className="bg-white dark:bg-[#1C1C1E] shadow-xl max-w-3xl mx-auto rounded-xl overflow-hidden" style={{ fontFamily: "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif" }}>
                            <link rel="preconnect" href="https://fonts.googleapis.com" />
                            <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

                            <div className="p-6 sm:p-8">

                                {/* ── Header ── */}
                                <div className="flex items-start gap-4 mb-5">
                                    <div className="shrink-0">
                                        {schoolInfo.logo
                                            ? <img src={schoolInfo.logo} alt="Logo" className="w-[52px] h-[52px] rounded-full object-cover" />
                                            : <div className="w-[52px] h-[52px] rounded-full flex items-center justify-center text-white font-bold text-lg" style={{ background: brandColor, letterSpacing: '-0.02em' }}>{(schoolInfo.name || 'S')[0]}</div>
                                        }
                                    </div>
                                    <div className="flex-1">
                                        <h1 className="text-xl font-bold text-gray-900 dark:text-white" style={{ letterSpacing: '-0.02em', lineHeight: 1.2 }}>{schoolInfo.name}</h1>
                                        {(schoolInfo.address || schoolInfo.phone) && (
                                            <p className="text-[9px] text-gray-500 dark:text-[#8E8E93] mt-1 leading-relaxed">
                                                {[schoolInfo.address, schoolInfo.phone ? `Phone: ${schoolInfo.phone}` : '', schoolInfo.email].filter(Boolean).join(' \u00B7 ')}
                                            </p>
                                        )}
                                        {schoolInfo.board && (
                                            <p className="text-[8px] text-gray-400 dark:text-[#636366] mt-0.5" style={{ letterSpacing: '0.02em' }}>
                                                {[schoolInfo.board, schoolInfo.affiliation ? `Affil: ${schoolInfo.affiliation}` : '', schoolInfo.udise ? `UDISE: ${schoolInfo.udise}` : ''].filter(Boolean).join(' \u00B7 ')}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* ── Accent Line ── */}
                                <div className="h-[2.5px] rounded-sm mb-5" style={{ background: brandColor }} />

                                {/* ── Title Row ── */}
                                <div className="flex justify-between items-baseline mb-7">
                                    <span className="text-[13px] font-semibold uppercase" style={{ color: brandColor, letterSpacing: '0.1em' }}>Student Report Card</span>
                                    <div className="text-right">
                                        <span className="block text-[10px] font-semibold text-gray-500 dark:text-[#8E8E93]">{filterSeries || 'Midterm'} Examination</span>
                                        <span className="block text-[10px] text-gray-400 dark:text-[#636366]">Issued: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
                                    </div>
                                </div>

                                {/* ── Student Info Card ── */}
                                <div className="bg-[#F9FAFB] dark:bg-[#2C2C2E] rounded-[10px] p-5 mb-7">
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-4">
                                        {[
                                            { label: 'Student Name', value: student?.fullName || student?.name || studentName || '\u2014' },
                                            { label: 'Admission No.', value: student?.admissionNumber || '\u2014' },
                                            { label: 'Class / Section', value: `${student?.class || subjects[0]?.class || '\u2014'}${(student?.section || subjects[0]?.section) ? ' \u2014 ' + (student?.section || subjects[0]?.section) : ''}` },
                                            { label: 'Roll Number', value: student?.rollNumber || '\u2014' },
                                            { label: 'Date of Birth', value: '\u2014' },
                                            { label: 'Parent / Guardian', value: '\u2014' },
                                        ].map(f => (
                                            <div key={f.label}>
                                                <p className="text-[7.5px] font-semibold uppercase text-gray-400 dark:text-[#636366] mb-0.5" style={{ letterSpacing: '0.12em' }}>{f.label}</p>
                                                <p className="text-xs font-semibold text-gray-900 dark:text-white">{f.value}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* ── Academic Performance ── */}
                                <p className="text-[9px] font-semibold uppercase text-gray-400 dark:text-[#636366] mb-3" style={{ letterSpacing: '0.14em' }}>Academic Performance</p>
                                <div className="overflow-x-auto mb-7">
                                    <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr>
                                                {[
                                                    { label: 'Subject', cls: 'text-left', w: '28%' },
                                                    { label: 'Max', cls: 'text-right', w: '10%' },
                                                    { label: 'Obtained', cls: 'text-right', w: '12%' },
                                                    { label: '%', cls: 'text-right', w: '10%' },
                                                    { label: 'Grade', cls: 'text-center', w: '12%' },
                                                    { label: 'Result', cls: 'text-center', w: '10%' },
                                                    { label: 'Remarks', cls: 'text-left', w: '18%' },
                                                ].map(h => (
                                                    <th key={h.label} className={`px-3 py-2.5 text-[8px] font-semibold uppercase text-gray-500 dark:text-[#8E8E93] ${h.cls}`} style={{ letterSpacing: '0.08em', borderBottom: '1.5px solid #E5E7EB', width: h.w }}>{h.label}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {subjects.map((s, i) => (
                                                <tr key={s.examId || i} style={{ background: i % 2 === 1 ? 'rgba(249,250,251,0.5)' : 'transparent' }}>
                                                    <td className="px-3 py-3.5 text-[10.5px] font-medium text-gray-900 dark:text-white" style={{ borderBottom: '0.5px solid #F3F4F6' }}>
                                                        {s.subject}
                                                        <span className="block text-[8px] text-gray-400 dark:text-[#636366] font-normal mt-0.5">
                                                            {[s.examName, s.date ? new Date(s.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : ''].filter(Boolean).join(' \u00B7 ')}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-3.5 text-[10.5px] text-gray-900 dark:text-white text-right tabular-nums" style={{ borderBottom: '0.5px solid #F3F4F6' }}>{s.totalMarks}</td>
                                                    <td className="px-3 py-3.5 text-[10.5px] font-semibold text-gray-900 dark:text-white text-right tabular-nums" style={{ borderBottom: '0.5px solid #F3F4F6' }}>{s.marksObtained}</td>
                                                    <td className="px-3 py-3.5 text-[10.5px] text-gray-900 dark:text-white text-right tabular-nums" style={{ borderBottom: '0.5px solid #F3F4F6' }}>{s.percentage}%</td>
                                                    <td className="px-3 py-3.5 text-center" style={{ borderBottom: '0.5px solid #F3F4F6' }}>
                                                        <span className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold text-gray-900 dark:text-white">
                                                            <span className="w-[7px] h-[7px] rounded-full inline-block" style={{ background: GRADE_DOT_COLOR(s.grade) }} />
                                                            {s.grade}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-3.5 text-center text-[10px] font-medium" style={{ borderBottom: '0.5px solid #F3F4F6', color: s.isPassed ? '#059669' : '#DC2626' }}>
                                                        {s.isPassed ? 'Pass' : 'Fail'}
                                                    </td>
                                                    <td className="px-3 py-3.5 text-[9px] text-gray-400 dark:text-[#636366]" style={{ borderBottom: '0.5px solid #F3F4F6' }}>{s.remarks || '\u2014'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr>
                                                <td className="px-3 py-3.5 text-[11px] font-semibold text-gray-900 dark:text-white" style={{ borderTop: `1.5px solid ${brandColor}`, background: `${brandColor}0A` }}>Grand Total</td>
                                                <td className="px-3 py-3.5 text-[11px] font-semibold text-gray-900 dark:text-white text-right tabular-nums" style={{ borderTop: `1.5px solid ${brandColor}`, background: `${brandColor}0A` }}>{summary.grandTotal}</td>
                                                <td className="px-3 py-3.5 text-[11px] font-semibold text-gray-900 dark:text-white text-right tabular-nums" style={{ borderTop: `1.5px solid ${brandColor}`, background: `${brandColor}0A` }}>{summary.grandObtained}</td>
                                                <td className="px-3 py-3.5 text-[11px] font-semibold text-gray-900 dark:text-white text-right tabular-nums" style={{ borderTop: `1.5px solid ${brandColor}`, background: `${brandColor}0A` }}>{summary.overallPercentage}%</td>
                                                <td className="px-3 py-3.5 text-center" style={{ borderTop: `1.5px solid ${brandColor}`, background: `${brandColor}0A` }}>
                                                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-gray-900 dark:text-white">
                                                        <span className="w-[7px] h-[7px] rounded-full inline-block" style={{ background: GRADE_DOT_COLOR(summary.overallGrade) }} />
                                                        {summary.overallGrade}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-3.5 text-center text-[11px] font-semibold" style={{ borderTop: `1.5px solid ${brandColor}`, background: `${brandColor}0A`, color: summary.overallPassed ? '#059669' : '#DC2626', letterSpacing: '0.04em' }} colSpan={2}>
                                                    {summary.overallPassed ? 'PASS' : 'FAIL'}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>

                                {/* ── Result Banner ── */}
                                <div className="mb-7 flex items-center justify-between px-6 py-4.5" style={{
                                    borderLeft: `3px solid ${summary.overallPassed ? '#059669' : '#DC2626'}`,
                                    background: summary.overallPassed ? 'rgba(5,150,105,0.04)' : 'rgba(220,38,38,0.04)',
                                    borderRadius: '0 8px 8px 0',
                                }}>
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: summary.overallPassed ? '#059669' : '#DC2626' }} />
                                        <span className="text-[15px] font-bold" style={{ color: summary.overallPassed ? '#059669' : '#DC2626', letterSpacing: '0.04em' }}>
                                            {summary.overallPassed ? 'PASSED' : 'FAILED'}
                                        </span>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] text-gray-500 dark:text-[#8E8E93] mb-0.5">{summary.overallPassed ? 'Satisfactory Performance' : 'Needs Improvement'}</p>
                                        <p className="text-[9px] text-gray-400 dark:text-[#636366]">{summary.passCount} of {summary.totalSubjects} subjects passed &middot; Overall: {summary.overallPercentage}% &middot; Grade: {summary.overallGrade}</p>
                                    </div>
                                </div>

                                {/* ── Signatures ── */}
                                <div className="flex justify-between pt-2 mb-8">
                                    {[
                                        { label: 'Class Teacher', sub: 'Signature & Seal', sig: null },
                                        { label: 'Principal', sub: 'Signature & Seal', sig: schoolInfo.principalSignature },
                                        { label: 'Parent / Guardian', sub: 'Signature', sig: null },
                                    ].map(s => (
                                        <div key={s.label} className="text-center w-[140px]">
                                            <div className="relative mt-10 mb-2">
                                                {s.sig && <img src={getSignatureUrl(s.sig)} alt={s.label} className="absolute bottom-1 left-1/2 -translate-x-1/2 max-h-10 max-w-[120px] object-contain" />}
                                                <div className="h-px bg-gray-200 dark:bg-[#38383A]" />
                                            </div>
                                            <p className="text-[9px] font-semibold text-gray-500 dark:text-[#8E8E93]">{s.label}</p>
                                            <p className="text-[7px] text-gray-400 dark:text-[#636366] mt-0.5">{s.sub}</p>
                                        </div>
                                    ))}
                                </div>

                                {/* ── Footer ── */}
                                <div className="text-center pt-4" style={{ borderTop: '0.5px solid #F3F4F6' }}>
                                    <p className="text-[7px] text-gray-400 dark:text-[#636366] italic" style={{ letterSpacing: '0.02em' }}>
                                        This is a computer-generated report card issued by {schoolInfo.name} &middot; Powered by Learnovo
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
        , document.body);
};

export default ResultCard;
