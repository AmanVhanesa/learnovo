import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { X, Printer, FileText, Download } from 'lucide-react';
import { examsService } from '../services/examsService';
import { settingsService } from '../services/settingsService';
import { academicSessionsService } from '../services/academicsService';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { highQualityPrint } from '../utils/highQualityPrint';

import { SERVER_URL } from '../constants/config';

const getSignatureUrl = (url) => {
    if (!url) return null;
    const full = url.startsWith('http') ? url : `${SERVER_URL}${url}`;
    return encodeURI(full);
};

const SERIES_OPTIONS = ['UT1', 'SA1', 'HY1', 'CCE1', 'UT2', 'SA2', 'HY2', 'CCE2', 'Custom'];

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
      <tr style="background:${i % 2 === 0 ? '#fff' : '#F3F4F6'};-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important">
        <td class="subj">${s.subject}<span class="exam-detail">${detail}</span></td>
        <td class="num">${s.totalMarks}</td>
        <td class="num" style="font-weight:600">${s.marksObtained}</td>
        <td class="ctr"><span class="grade-display"><span class="grade-dot" style="background:${dotColor}"></span> ${s.grade}</span></td>
        <td class="ctr"><span style="color:${s.isPassed ? '#059669' : '#DC2626'};font-weight:700;font-size:13px">${s.isPassed ? 'Pass' : 'Fail'}</span></td>
        <td style="font-size:12px;color:#374151">${s.remarks || '\u2014'}</td>
      </tr>`;
    }).join('');

    const logoTag = schoolInfo.logo
        ? `<div class="school-logo"><img src="${schoolInfo.logo}" alt="Logo"></div>`
        : `<div class="school-logo-fb" style="background:${brandColor}">${(schoolInfo.name || 'S')[0]}</div>`;

    const sigUrl = getSignatureUrl(schoolInfo.principalSignature);
    const overallDotColor = GRADE_DOT_COLOR(summary.overallGrade);
    const isPassed = summary.overallPassed;

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Report Card \u2014 ${sName}</title>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800;900&display=swap" rel="stylesheet">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
  *{margin:0;padding:0;box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
  @page{size:A4;margin:0}
  body{font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Helvetica Neue',Helvetica,Arial,sans-serif;background:#fff;color:#111827}
  .page{width:210mm;min-height:297mm;padding:20mm;margin:0 auto}
  /* Header */
  .header{position:relative;text-align:center;padding:0 0 12px;margin-bottom:0}
  .logo-wrap{position:absolute;left:0;top:0;width:110px;height:110px;display:flex;align-items:center;justify-content:center;border-radius:8px;overflow:hidden}
  .school-logo{width:110px;height:110px;border-radius:8px;overflow:hidden;flex-shrink:0}
  .school-logo img{width:100%;height:100%;object-fit:contain}
  .school-logo-fb{width:110px;height:110px;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:28px;letter-spacing:-0.02em;flex-shrink:0}
  .school-info{text-align:center}
  .school-name{font-family:'Playfair Display',Georgia,'Times New Roman',serif;font-size:28px;font-weight:800;color:#1F6F6D;letter-spacing:2px;line-height:1.1;text-transform:uppercase;white-space:nowrap}
  .school-addr{font-size:14px;color:#1f2937;font-weight:500;margin-top:4px;line-height:1.5}
  .school-contact{font-size:14px;color:#1f2937;font-weight:500;margin-top:2px}
  .aff-row{display:flex;justify-content:center;gap:20px;margin-top:6px;flex-wrap:wrap}
  .aff-line{font-size:13px;color:#1f2937;font-weight:500;line-height:1.7}
  .aff-line b{font-weight:700;color:#111827}
  .accent-line{height:1.5px;background:#6B7280;margin:12px 0 16px;border:none}
  .title-row{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:28px}
  .report-title{font-size:16px;font-weight:700;color:${brandColor};text-transform:uppercase;letter-spacing:0.1em}
  .report-meta{font-size:13px;color:#374151;text-align:right;line-height:1.6}
  .report-meta .exam-type{font-weight:700;color:#111827;display:block}
  /* Student card */
  .stu-card{background:#F3F4F6;border-radius:10px;padding:20px 24px;margin-bottom:28px;border:1px solid #D1D5DB}
  .stu-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px 32px}
  .info-label{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#4B5563;margin-bottom:3px}
  .info-value{font-size:15px;font-weight:600;color:#111827}
  /* Section label */
  .sec-label{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.14em;color:#374151;margin-bottom:12px}
  /* Table */
  table{width:100%;border-collapse:collapse;margin-bottom:28px}
  thead th{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#111827;padding:10px 12px;text-align:left;border-bottom:2px solid #6B7280}
  thead th.num{text-align:right}
  thead th.ctr{text-align:center}
  tbody td{font-size:14px;color:#111827;padding:14px 12px;border-bottom:1px solid #D1D5DB;font-weight:400}
  tbody td.num{text-align:right;font-variant-numeric:tabular-nums}
  tbody td.ctr{text-align:center}
  tbody td.subj{font-weight:600}
  .exam-detail{display:block;font-size:11px;color:#374151;font-weight:400;margin-top:2px}
  .grade-display{display:inline-flex;align-items:center;gap:6px;font-weight:700}
  .grade-dot{width:8px;height:8px;border-radius:50%;display:inline-block}
  tfoot td{font-size:14px;font-weight:700;color:#111827;padding:14px 12px;border-top:2px solid ${brandColor};background:${brandColor}0A}
  tfoot td.num{text-align:right;font-variant-numeric:tabular-nums}
  tfoot td.ctr{text-align:center}
  /* Result banner */
  .result-banner{border-radius:0 8px 8px 0;padding:18px 24px;margin-bottom:28px;display:flex;align-items:center;justify-content:space-between;border-left:4px solid ${isPassed ? '#059669' : '#DC2626'};background:${isPassed ? 'rgba(5,150,105,0.08)' : 'rgba(220,38,38,0.08)'}}
  .result-dot{width:10px;height:10px;border-radius:50%;background:${isPassed ? '#059669' : '#DC2626'}}
  .result-label{font-size:18px;font-weight:800;letter-spacing:0.04em;color:${isPassed ? '#059669' : '#DC2626'}}
  .result-status{display:flex;align-items:center;gap:10px}
  .result-details{text-align:right}
  .result-perf{font-size:13px;color:#1f2937;font-weight:500;margin-bottom:2px}
  .result-stats{font-size:12px;color:#374151}
  /* Signatures */
  .sigs{display:flex;justify-content:space-between;margin-bottom:32px;padding-top:8px}
  .sig-block{text-align:center;width:160px}
  .sig-line{width:100%;height:1.5px;background:#6B7280;margin-bottom:8px;margin-top:50px;position:relative}
  .sig-img{position:absolute;bottom:4px;left:50%;transform:translateX(-50%);max-height:70px;max-width:150px;object-fit:contain}
  .sig-label{font-size:12px;font-weight:700;color:#111827}
  .sig-sub{font-size:10px;color:#374151;margin-top:2px}
  /* Footer */
  .footer{text-align:center;padding-top:16px;border-top:1px solid #6B7280}
  .footer-text{font-size:10px;color:#374151;letter-spacing:0.02em;font-style:italic}
  @media print{body{background:#fff}.page{padding:20mm}}
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div class="logo-wrap">${logoTag}</div>
    <div class="school-info">
      <div class="school-name">${schoolInfo.name}</div>
      <div class="school-addr">${schoolInfo.address || ''}</div>
      <div class="school-contact">${[schoolInfo.phone ? 'Phone: ' + schoolInfo.phone : '', schoolInfo.email ? 'Email: ' + schoolInfo.email : ''].filter(Boolean).join(' \u00A0|\u00A0 ')}</div>
      <div class="aff-row">
        ${schoolInfo.affiliation ? `<div class="aff-line">Affiliation No: <b>${schoolInfo.affiliation}</b></div>` : ''}
        ${schoolInfo.board ? `<div class="aff-line">Board: <b>${schoolInfo.board}</b></div>` : ''}
        ${schoolInfo.udise ? `<div class="aff-line">UDISE: <b>${schoolInfo.udise}</b></div>` : ''}
      </div>
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
      <th style="width:30%">Subject</th>
      <th class="num" style="width:12%">Max</th>
      <th class="num" style="width:14%">Obtained</th>
      <th class="ctr" style="width:14%">Grade</th>
      <th class="ctr" style="width:12%">Result</th>
      <th style="width:18%">Remarks</th>
    </tr></thead>
    <tbody>${subjectRows}</tbody>
    <tfoot><tr>
      <td>Grand Total</td>
      <td class="num">${summary.grandTotal}</td>
      <td class="num">${summary.grandObtained}</td>
      <td class="ctr"><span class="grade-display"><span class="grade-dot" style="background:${overallDotColor}"></span> ${summary.overallGrade}</span></td>
      <td class="ctr" style="color:${isPassed ? '#059669' : '#DC2626'};letter-spacing:0.04em">${isPassed ? 'PASS' : 'FAIL'}</td>
      <td class="num">${summary.overallPercentage}%</td>
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
    const { user } = useAuth();
    const isStudent = user?.role === 'student';
    const [cardData, setCardData] = useState(null);
    const [twoTermData, setTwoTermData] = useState(null);
    const [activeSessionId, setActiveSessionId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [printing, setPrinting] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [downloadingBlank, setDownloadingBlank] = useState(false);
    const [schoolInfo, setSchoolInfo] = useState({ name: 'School', address: '', logo: null, principalSignature: null, brandColor: '#1E3A5F' });
    const [filterSeries, setFilterSeries] = useState(defaultExamSeries || '');
    const reportCardPrintRef = useRef(null);
    const isFullYear = !filterSeries;

    /* ── active academic session ── */
    useEffect(() => {
        academicSessionsService.getActive?.()
            .then(res => {
                const s = res?.data || res;
                if (s?._id) setActiveSessionId(s._id);
            })
            .catch(() => { });
    }, []);

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
        // Full Year mode: needs active session before fetching
        if (isFullYear) {
            if (!activeSessionId) return;
            setLoading(true);
            setCardData(null);
            examsService.getFinalReportCard(studentId, activeSessionId)
                .then(res => setTwoTermData(res.data))
                .catch(() => { setTwoTermData(null); toast.error('Failed to load full year report card'); })
                .finally(() => setLoading(false));
            return;
        }
        // Single-series mode
        setLoading(true);
        setTwoTermData(null);
        examsService.getResultCard(studentId, { examSeries: filterSeries })
            .then(res => setCardData(res.data))
            .catch(() => toast.error('Failed to load result card'))
            .finally(() => setLoading(false));
    }, [studentId, filterSeries, isFullYear, activeSessionId]);

    /* ── print (opens backend-generated PDF in new tab for native print) ── */
    const handlePrint = async () => {
        const hasData = isFullYear ? !!twoTermData?.subjectRows?.length : !!cardData?.subjects?.length;
        if (!hasData) return;
        setPrinting(true);
        try {
            const blob = isFullYear
                ? await examsService.downloadFinalReportCardPDF(studentId, activeSessionId)
                : await examsService.downloadReportCardPDF(studentId, { examSeries: filterSeries });
            const url = window.URL.createObjectURL(blob);
            const w = window.open(url, '_blank');
            if (!w) {
                toast.error('Popup blocked. Allow popups to print.');
                window.URL.revokeObjectURL(url);
                return;
            }
            const cleanup = () => window.URL.revokeObjectURL(url);
            w.addEventListener('load', () => {
                try { w.focus(); w.print(); } catch { /* user can still print manually */ }
            });
            setTimeout(cleanup, 60000);
        } catch (error) {
            console.error('Print failed:', error);
            toast.error('Failed to prepare print. Please try again.');
        } finally { setPrinting(false); }
    };

    /* ── download PDF via backend ── */
    const handleDownloadPDF = async () => {
        const hasData = isFullYear ? !!twoTermData?.subjectRows?.length : !!cardData?.subjects?.length;
        if (!hasData) return;
        setDownloading(true);
        try {
            const blob = isFullYear
                ? await examsService.downloadFinalReportCardPDF(studentId, activeSessionId)
                : await examsService.downloadReportCardPDF(studentId, { examSeries: filterSeries });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const sName = (isFullYear ? twoTermData?.student?.name : cardData?.student?.name) || studentName || 'Student';
            a.download = `Report_Card_${sName.replace(/\s+/g, '_')}_${filterSeries || 'FullYear'}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            toast.success('Report card downloaded');
        } catch (err) {
            let msg = 'Failed to download PDF';
            try {
                const errorBlob = err.response?.data;
                if (errorBlob instanceof Blob) {
                    const text = await errorBlob.text();
                    const json = JSON.parse(text);
                    msg = json.message || msg;
                } else if (err.response?.data?.message) {
                    msg = err.response.data.message;
                }
            } catch { /* use default msg */ }
            toast.error(msg);
        } finally {
            setDownloading(false);
        }
    };

    /* ── download blank PDF ── */
    const handleDownloadBlank = async () => {
        setDownloadingBlank(true);
        try {
            const blob = isFullYear && activeSessionId
                ? await examsService.downloadBlankFinalReportCardPDF(studentId, activeSessionId)
                : await examsService.downloadBlankReportCardPDF(studentId, { examSeries: filterSeries });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Blank_Report_Card_${(cardData?.student?.name || studentName || 'Student').replace(/\s+/g, '_')}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            toast.success('Blank report card downloaded');
        } catch (err) {
            // Blob responses need special error parsing
            let msg = 'Failed to download blank PDF';
            try {
                const errorBlob = err.response?.data;
                if (errorBlob instanceof Blob) {
                    const text = await errorBlob.text();
                    const json = JSON.parse(text);
                    msg = json.message || msg;
                } else if (err.response?.data?.message) {
                    msg = err.response.data.message;
                }
            } catch { /* use default msg */ }
            toast.error(msg);
        } finally {
            setDownloadingBlank(false);
        }
    };

    const student = (isFullYear ? twoTermData?.student : cardData?.student);
    const subjects = (isFullYear ? (twoTermData?.subjectRows || []) : (cardData?.subjects || []));
    const summary = (isFullYear ? twoTermData?.summary : cardData?.summary);
    const brandColor = schoolInfo.brandColor || '#1E3A5F';
    const t1Exams = twoTermData?.term1?.exams || [];
    const t2Exams = twoTermData?.term2?.exams || [];

    const customExamNames = filterSeries === 'Custom'
        ? [...new Set((subjects || []).map(s => s.examName).filter(Boolean))].join(' / ')
        : '';
    const examTitle = filterSeries === 'Custom' && customExamNames
        ? customExamNames
        : `${filterSeries} Examination`;

    return ReactDOM.createPortal(
        <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="bg-white dark:bg-[#1C1C1E] rounded-none sm:rounded-2xl shadow-glass-lg w-full max-w-4xl sm:mx-4 h-full sm:h-auto sm:max-h-[92vh] flex flex-col">

                {/* ── Modal Header ── */}
                <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-[#38383A] shrink-0 space-y-3">
                    {/* Top row: Title + Close */}
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2.5">
                            <FileText className="h-5 w-5 text-primary-600 dark:text-primary-400 shrink-0" />
                            <div>
                                <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white leading-tight">Student Report Card</h3>
                                {(student?.fullName || student?.name || studentName) && (
                                    <p className="text-xs text-gray-400 dark:text-[#636366] mt-0.5 truncate">{student?.fullName || student?.name || studentName}</p>
                                )}
                            </div>
                        </div>
                        <button
                            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-[#2C2C2E] transition-colors shrink-0"
                            onClick={onClose}
                        >
                            <X className="h-5 w-5 text-gray-500 dark:text-[#8E8E93]" />
                        </button>
                    </div>
                    {/* Bottom row: Filter + Action buttons */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-1.5">
                            <label className="text-xs text-gray-500 dark:text-[#8E8E93] font-medium whitespace-nowrap">Exam Series:</label>
                            <select
                                className="input w-36 text-sm h-9"
                                value={filterSeries}
                                onChange={e => setFilterSeries(e.target.value)}
                            >
                                <option value="">Full Year Report Card</option>
                                {SERIES_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            {!isStudent && (
                            <button
                                className="btn btn-sm gap-1.5 bg-gray-100 dark:bg-[#2C2C2E] text-gray-700 dark:text-[#8E8E93] hover:bg-gray-200 dark:hover:bg-[#38383A] border border-gray-200 dark:border-[#38383A]"
                                onClick={handleDownloadBlank}
                                disabled={loading || downloadingBlank}
                                title="Download blank report card (no marks filled)"
                            >
                                <FileText className="h-4 w-4" />
                                {downloadingBlank ? 'Downloading\u2026' : 'Blank PDF'}
                            </button>
                            )}
                            <button
                                className="btn btn-sm gap-1.5 bg-white dark:bg-[#2C2C2E] text-gray-700 dark:text-[#8E8E93] hover:bg-gray-50 dark:hover:bg-[#38383A] border border-gray-200 dark:border-[#38383A]"
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
                                {printing ? 'Preparing\u2026' : 'Print'}
                            </button>
                        </div>
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
                                    ? `No results for "${filterSeries}". Try "Full Year Report Card".`
                                    : 'No exam results entered yet.'}
                            </p>
                        </div>
                    ) : (

                        /* ══ Premium Report Card Preview ══ */
                        <div ref={reportCardPrintRef} className="bg-white dark:bg-[#1C1C1E] shadow-xl max-w-3xl mx-auto rounded-xl overflow-hidden" style={{ fontFamily: "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif" }}>
                            <link rel="preconnect" href="https://fonts.googleapis.com" />
                            <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Playfair+Display:wght@700;800;900&display=swap" rel="stylesheet" />

                            <div className="p-6 sm:p-8">

                                {/* ── Header ── */}
                                <div className="relative text-center pb-3 mb-0">
                                    <div className="absolute left-0 top-0 w-[110px] h-[110px] flex items-center justify-center rounded-lg overflow-hidden">
                                        {schoolInfo.logo
                                            ? <img src={schoolInfo.logo} alt="Logo" className="w-[110px] h-[110px] object-contain" />
                                            : <div className="w-[110px] h-[110px] rounded-lg flex items-center justify-center text-white font-bold text-[28px]" style={{ background: brandColor, letterSpacing: '-0.02em' }}>{(schoolInfo.name || 'S')[0]}</div>
                                        }
                                    </div>
                                    <div className="text-center">
                                        <h1 className="text-[28px] font-extrabold text-[#1F6F6D] uppercase whitespace-nowrap" style={{ fontFamily: "'Playfair Display', Georgia, 'Times New Roman', serif", letterSpacing: '2px', lineHeight: 1.1 }}>{schoolInfo.name}</h1>
                                        {schoolInfo.address && (
                                            <p className="text-[13px] text-gray-600 dark:text-[#8E8E93] mt-1 font-medium leading-relaxed">{schoolInfo.address}</p>
                                        )}
                                        {(schoolInfo.phone || schoolInfo.email) && (
                                            <p className="text-[13px] text-gray-600 dark:text-[#8E8E93] mt-0.5 font-medium">
                                                {[schoolInfo.phone ? `Phone: ${schoolInfo.phone}` : '', schoolInfo.email ? `Email: ${schoolInfo.email}` : ''].filter(Boolean).join(' \u00A0|\u00A0 ')}
                                            </p>
                                        )}
                                        {(schoolInfo.affiliation || schoolInfo.board || schoolInfo.udise) && (
                                            <div className="flex justify-center gap-5 mt-1.5 flex-wrap">
                                                {schoolInfo.affiliation && <span className="text-[12px] text-gray-600 dark:text-[#8E8E93] font-medium">Affiliation No: <b className="text-gray-900 dark:text-white">{schoolInfo.affiliation}</b></span>}
                                                {schoolInfo.board && <span className="text-[12px] text-gray-600 dark:text-[#8E8E93] font-medium">Board: <b className="text-gray-900 dark:text-white">{schoolInfo.board}</b></span>}
                                                {schoolInfo.udise && <span className="text-[12px] text-gray-600 dark:text-[#8E8E93] font-medium">UDISE: <b className="text-gray-900 dark:text-white">{schoolInfo.udise}</b></span>}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* ── Accent Line ── */}
                                <div className="h-px bg-gray-200 dark:bg-[#38383A] my-3 mb-4" />

                                {/* ── Title Row ── */}
                                <div className="flex justify-between items-baseline mb-7">
                                    <span className="text-[15px] font-semibold uppercase" style={{ color: brandColor, letterSpacing: '0.1em' }}>Student Report Card</span>
                                    <div className="text-right">
                                        <span className="block text-[12px] font-semibold text-gray-500 dark:text-[#8E8E93]">{isFullYear ? `Full Year ${twoTermData?.session?.name || ''}`.trim() : examTitle}</span>
                                        <span className="block text-[12px] text-gray-400 dark:text-[#636366]">Issued: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
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
                                                <p className="text-[9.5px] font-semibold uppercase text-gray-400 dark:text-[#636366] mb-0.5" style={{ letterSpacing: '0.12em' }}>{f.label}</p>
                                                <p className="text-sm font-semibold text-gray-900 dark:text-white">{f.value}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* ── Academic Performance ── */}
                                <p className="text-[11px] font-semibold uppercase text-gray-400 dark:text-[#636366] mb-3" style={{ letterSpacing: '0.14em' }}>Scholastic Areas</p>
                                {isFullYear && twoTermData ? (
                                    <div className="overflow-x-auto mb-7">
                                        <table className="w-full text-[11.5px]" style={{ borderCollapse: 'collapse' }}>
                                            <thead>
                                                <tr>
                                                    <th rowSpan={2} className="px-2 py-2 text-left font-semibold uppercase text-gray-500 dark:text-[#8E8E93]" style={{ letterSpacing: '0.06em', borderBottom: '1.5px solid #E5E7EB' }}>Subject</th>
                                                    <th colSpan={t1Exams.length + 2} className="px-2 py-2 text-center font-semibold uppercase text-gray-600 dark:text-[#8E8E93]" style={{ letterSpacing: '0.08em', borderBottom: '1px solid #E5E7EB' }}>Term 1</th>
                                                    <th colSpan={t2Exams.length + 2} className="px-2 py-2 text-center font-semibold uppercase text-gray-600 dark:text-[#8E8E93]" style={{ letterSpacing: '0.08em', borderBottom: '1px solid #E5E7EB' }}>Term 2</th>
                                                </tr>
                                                <tr>
                                                    {t1Exams.map(e => (
                                                        <th key={`t1-${e.name}`} className="px-2 py-1.5 text-center text-[10px] font-semibold text-gray-500 dark:text-[#8E8E93]" style={{ borderBottom: '1.5px solid #E5E7EB' }}>{e.name}<div className="text-[9px] font-normal text-gray-400">({e.maxMarks})</div></th>
                                                    ))}
                                                    <th className="px-2 py-1.5 text-center text-[10px] font-semibold text-gray-500 dark:text-[#8E8E93]" style={{ borderBottom: '1.5px solid #E5E7EB' }}>Total</th>
                                                    <th className="px-2 py-1.5 text-center text-[10px] font-semibold text-gray-500 dark:text-[#8E8E93]" style={{ borderBottom: '1.5px solid #E5E7EB' }}>Grade</th>
                                                    {t2Exams.map(e => (
                                                        <th key={`t2-${e.name}`} className="px-2 py-1.5 text-center text-[10px] font-semibold text-gray-500 dark:text-[#8E8E93]" style={{ borderBottom: '1.5px solid #E5E7EB' }}>{e.name}<div className="text-[9px] font-normal text-gray-400">({e.maxMarks})</div></th>
                                                    ))}
                                                    <th className="px-2 py-1.5 text-center text-[10px] font-semibold text-gray-500 dark:text-[#8E8E93]" style={{ borderBottom: '1.5px solid #E5E7EB' }}>Total</th>
                                                    <th className="px-2 py-1.5 text-center text-[10px] font-semibold text-gray-500 dark:text-[#8E8E93]" style={{ borderBottom: '1.5px solid #E5E7EB' }}>Grade</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {subjects.map((r, i) => (
                                                    <tr key={r.subject || i} style={{ background: i % 2 === 1 ? 'rgba(249,250,251,0.5)' : 'transparent' }}>
                                                        <td className="px-2 py-2.5 font-medium text-gray-900 dark:text-white" style={{ borderBottom: '0.5px solid #F3F4F6' }}>{r.subject}</td>
                                                        {t1Exams.map(e => (
                                                            <td key={`c-t1-${e.name}`} className="px-2 py-2.5 text-center tabular-nums text-gray-900 dark:text-white" style={{ borderBottom: '0.5px solid #F3F4F6' }}>{r.marks?.[e.name] ?? '\u2014'}</td>
                                                        ))}
                                                        <td className="px-2 py-2.5 text-center font-semibold tabular-nums text-gray-900 dark:text-white" style={{ borderBottom: '0.5px solid #F3F4F6' }}>{r.term1Total}</td>
                                                        <td className="px-2 py-2.5 text-center" style={{ borderBottom: '0.5px solid #F3F4F6' }}>
                                                            <span className="inline-flex items-center gap-1 font-semibold text-gray-900 dark:text-white">
                                                                <span className="w-[6px] h-[6px] rounded-full inline-block" style={{ background: GRADE_DOT_COLOR(r.term1Grade) }} />
                                                                {r.term1Grade}
                                                            </span>
                                                        </td>
                                                        {t2Exams.map(e => (
                                                            <td key={`c-t2-${e.name}`} className="px-2 py-2.5 text-center tabular-nums text-gray-900 dark:text-white" style={{ borderBottom: '0.5px solid #F3F4F6' }}>{r.marks?.[e.name] ?? '\u2014'}</td>
                                                        ))}
                                                        <td className="px-2 py-2.5 text-center font-semibold tabular-nums text-gray-900 dark:text-white" style={{ borderBottom: '0.5px solid #F3F4F6' }}>{r.term2Total}</td>
                                                        <td className="px-2 py-2.5 text-center" style={{ borderBottom: '0.5px solid #F3F4F6' }}>
                                                            <span className="inline-flex items-center gap-1 font-semibold text-gray-900 dark:text-white">
                                                                <span className="w-[6px] h-[6px] rounded-full inline-block" style={{ background: GRADE_DOT_COLOR(r.term2Grade) }} />
                                                                {r.term2Grade}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                                <tr>
                                                    <td className="px-2 py-2.5 font-semibold text-gray-900 dark:text-white" style={{ borderTop: `1.5px solid ${brandColor}`, background: `${brandColor}0A` }}>Grand Total</td>
                                                    <td colSpan={t1Exams.length} style={{ borderTop: `1.5px solid ${brandColor}`, background: `${brandColor}0A` }} />
                                                    <td className="px-2 py-2.5 text-center font-semibold tabular-nums text-gray-900 dark:text-white" style={{ borderTop: `1.5px solid ${brandColor}`, background: `${brandColor}0A` }}>{summary?.term1Total} / {summary?.term1Max}</td>
                                                    <td className="px-2 py-2.5 text-center font-semibold text-gray-900 dark:text-white" style={{ borderTop: `1.5px solid ${brandColor}`, background: `${brandColor}0A` }}>{summary?.term1Grade}</td>
                                                    <td colSpan={t2Exams.length} style={{ borderTop: `1.5px solid ${brandColor}`, background: `${brandColor}0A` }} />
                                                    <td className="px-2 py-2.5 text-center font-semibold tabular-nums text-gray-900 dark:text-white" style={{ borderTop: `1.5px solid ${brandColor}`, background: `${brandColor}0A` }}>{summary?.term2Total} / {summary?.term2Max}</td>
                                                    <td className="px-2 py-2.5 text-center font-semibold text-gray-900 dark:text-white" style={{ borderTop: `1.5px solid ${brandColor}`, background: `${brandColor}0A` }}>{summary?.term2Grade}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                        <div className="grid grid-cols-3 gap-3 mt-4 text-center">
                                            <div className="p-3 rounded-lg bg-gray-50 dark:bg-[#2C2C2E]">
                                                <div className="text-[10px] uppercase text-gray-500 font-semibold tracking-wider">Term 1</div>
                                                <div className="text-sm font-semibold text-gray-900 dark:text-white mt-1">{summary?.term1Total} / {summary?.term1Max}</div>
                                                <div className="text-[11px] text-gray-500">{summary?.term1Percentage}% &middot; Grade {summary?.term1Grade}</div>
                                            </div>
                                            <div className="p-3 rounded-lg bg-gray-50 dark:bg-[#2C2C2E]">
                                                <div className="text-[10px] uppercase text-gray-500 font-semibold tracking-wider">Term 2</div>
                                                <div className="text-sm font-semibold text-gray-900 dark:text-white mt-1">{summary?.term2Total} / {summary?.term2Max}</div>
                                                <div className="text-[11px] text-gray-500">{summary?.term2Percentage}% &middot; Grade {summary?.term2Grade}</div>
                                            </div>
                                            <div className="p-3 rounded-lg" style={{ background: `${brandColor}12` }}>
                                                <div className="text-[10px] uppercase text-gray-500 font-semibold tracking-wider">Overall</div>
                                                <div className="text-sm font-semibold text-gray-900 dark:text-white mt-1">{summary?.overallPercentage}%</div>
                                                <div className="text-[11px] text-gray-500">Grade {summary?.overallGrade} &middot; {twoTermData?.result || (summary?.overallPassed ? 'Promoted' : 'Not Promoted')}</div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                <div className="overflow-x-auto mb-7">
                                    <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr>
                                                {[
                                                    { label: 'Subject', cls: 'text-left', w: '30%' },
                                                    { label: 'Max', cls: 'text-right', w: '12%' },
                                                    { label: 'Obtained', cls: 'text-right', w: '14%' },
                                                    { label: 'Grade', cls: 'text-center', w: '14%' },
                                                    { label: 'Result', cls: 'text-center', w: '12%' },
                                                    { label: 'Remarks', cls: 'text-left', w: '18%' },
                                                ].map(h => (
                                                    <th key={h.label} className={`px-3 py-2.5 text-[10px] font-semibold uppercase text-gray-500 dark:text-[#8E8E93] ${h.cls}`} style={{ letterSpacing: '0.08em', borderBottom: '1.5px solid #E5E7EB', width: h.w }}>{h.label}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {subjects.map((s, i) => (
                                                <tr key={s.examId || i} style={{ background: i % 2 === 1 ? 'rgba(249,250,251,0.5)' : 'transparent' }}>
                                                    <td className="px-3 py-3.5 text-[12.5px] font-medium text-gray-900 dark:text-white" style={{ borderBottom: '0.5px solid #F3F4F6' }}>
                                                        {s.subject}
                                                        <span className="block text-[10px] text-gray-600 dark:text-[#8E8E93] font-normal mt-0.5">
                                                            {[s.examName, s.date ? new Date(s.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : ''].filter(Boolean).join(' \u00B7 ')}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-3.5 text-[12.5px] text-gray-900 dark:text-white text-right tabular-nums" style={{ borderBottom: '0.5px solid #F3F4F6' }}>{s.totalMarks}</td>
                                                    <td className="px-3 py-3.5 text-[12.5px] font-semibold text-gray-900 dark:text-white text-right tabular-nums" style={{ borderBottom: '0.5px solid #F3F4F6' }}>{s.marksObtained}</td>
                                                    <td className="px-3 py-3.5 text-center" style={{ borderBottom: '0.5px solid #F3F4F6' }}>
                                                        <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-gray-900 dark:text-white">
                                                            <span className="w-[7px] h-[7px] rounded-full inline-block" style={{ background: GRADE_DOT_COLOR(s.grade) }} />
                                                            {s.grade}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-3.5 text-center text-[12px] font-medium" style={{ borderBottom: '0.5px solid #F3F4F6', color: s.isPassed ? '#059669' : '#DC2626' }}>
                                                        {s.isPassed ? 'Pass' : 'Fail'}
                                                    </td>
                                                    <td className="px-3 py-3.5 text-[11px] text-gray-400 dark:text-[#636366]" style={{ borderBottom: '0.5px solid #F3F4F6' }}>{s.remarks || '\u2014'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr>
                                                <td className="px-3 py-3.5 text-[13px] font-semibold text-gray-900 dark:text-white" style={{ borderTop: `1.5px solid ${brandColor}`, background: `${brandColor}0A` }}>Grand Total</td>
                                                <td className="px-3 py-3.5 text-[13px] font-semibold text-gray-900 dark:text-white text-right tabular-nums" style={{ borderTop: `1.5px solid ${brandColor}`, background: `${brandColor}0A` }}>{summary.grandTotal}</td>
                                                <td className="px-3 py-3.5 text-[13px] font-semibold text-gray-900 dark:text-white text-right tabular-nums" style={{ borderTop: `1.5px solid ${brandColor}`, background: `${brandColor}0A` }}>{summary.grandObtained}</td>
                                                <td className="px-3 py-3.5 text-center" style={{ borderTop: `1.5px solid ${brandColor}`, background: `${brandColor}0A` }}>
                                                    <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-gray-900 dark:text-white">
                                                        <span className="w-[7px] h-[7px] rounded-full inline-block" style={{ background: GRADE_DOT_COLOR(summary.overallGrade) }} />
                                                        {summary.overallGrade}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-3.5 text-center text-[13px] font-semibold" style={{ borderTop: `1.5px solid ${brandColor}`, background: `${brandColor}0A`, color: summary.overallPassed ? '#059669' : '#DC2626', letterSpacing: '0.04em' }}>
                                                    {summary.overallPassed ? 'PASS' : 'FAIL'}
                                                </td>
                                                <td className="px-3 py-3.5 text-[13px] font-semibold text-gray-900 dark:text-white text-right tabular-nums" style={{ borderTop: `1.5px solid ${brandColor}`, background: `${brandColor}0A` }}>{summary.overallPercentage}%</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                                )}

                                {/* ── Result Banner (single-series only) ── */}
                                {!isFullYear && summary && (
                                <div className="mb-7 flex items-center justify-between px-6 py-4.5" style={{
                                    borderLeft: `3px solid ${summary.overallPassed ? '#059669' : '#DC2626'}`,
                                    background: summary.overallPassed ? 'rgba(5,150,105,0.04)' : 'rgba(220,38,38,0.04)',
                                    borderRadius: '0 8px 8px 0',
                                }}>
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: summary.overallPassed ? '#059669' : '#DC2626' }} />
                                        <span className="text-[17px] font-bold" style={{ color: summary.overallPassed ? '#059669' : '#DC2626', letterSpacing: '0.04em' }}>
                                            {summary.overallPassed ? 'PASSED' : 'FAILED'}
                                        </span>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[12px] text-gray-500 dark:text-[#8E8E93] mb-0.5">{summary.overallPassed ? 'Satisfactory Performance' : 'Needs Improvement'}</p>
                                        <p className="text-[11px] text-gray-400 dark:text-[#636366]">{summary.passCount} of {summary.totalSubjects} subjects passed &middot; Overall: {summary.overallPercentage}% &middot; Grade: {summary.overallGrade}</p>
                                    </div>
                                </div>
                                )}

                                {/* ── Signatures ── */}
                                <div className="flex justify-between pt-2 mb-8">
                                    {[
                                        { label: 'Class Teacher', sub: 'Signature & Seal', sig: null },
                                        { label: 'Principal', sub: 'Signature & Seal', sig: schoolInfo.principalSignature },
                                        { label: 'Parent / Guardian', sub: 'Signature', sig: null },
                                    ].map(s => (
                                        <div key={s.label} className="text-center w-[160px]">
                                            <div className="relative mt-12 mb-2">
                                                {s.sig && <img src={getSignatureUrl(s.sig)} alt={s.label} className="absolute bottom-1 left-1/2 -translate-x-1/2 max-h-[70px] max-w-[150px] object-contain" />}
                                                <div className="h-px bg-gray-200 dark:bg-[#38383A]" />
                                            </div>
                                            <p className="text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93]">{s.label}</p>
                                            <p className="text-[9px] text-gray-400 dark:text-[#636366] mt-0.5">{s.sub}</p>
                                        </div>
                                    ))}
                                </div>

                                {/* ── Footer ── */}
                                <div className="text-center pt-4" style={{ borderTop: '0.5px solid #F3F4F6' }}>
                                    <p className="text-[9px] text-gray-400 dark:text-[#636366] italic" style={{ letterSpacing: '0.02em' }}>
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
