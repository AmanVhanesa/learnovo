import React, { useState, useEffect, useRef } from 'react';
import { X, Printer, Award, BookOpen, CheckCircle, XCircle, TrendingUp } from 'lucide-react';
import { examsService } from '../services/examsService';
import { settingsService } from '../services/settingsService';
import toast from 'react-hot-toast';

/* ── Grade colour helpers ── */
const GRADE_COLORS = {
    'A+': 'text-emerald-700 font-bold',
    'A': 'text-green-700 font-semibold',
    'B': 'text-teal-700 font-semibold',
    'C': 'text-blue-700 font-semibold',
    'D': 'text-amber-700 font-semibold',
    'F': 'text-red-700 font-bold',
};

const GRADE_BADGE = {
    'A+': 'bg-emerald-100 text-emerald-800 border-emerald-300',
    'A': 'bg-green-100 text-green-800 border-green-300',
    'B': 'bg-teal-100 text-teal-800 border-teal-300',
    'C': 'bg-blue-100 text-blue-800 border-blue-300',
    'D': 'bg-amber-100 text-amber-800 border-amber-300',
    'F': 'bg-red-100 text-red-800 border-red-300',
};

function GradeBadge({ grade }) {
    const cls = GRADE_BADGE[grade] || 'bg-gray-100 text-gray-800 border-gray-300';
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-sm font-bold ${cls}`}>
            {grade}
        </span>
    );
}

const EXAM_SERIES_OPTIONS = ['Unit Test', 'Midterm', 'Final', 'Custom'];

/* ════════════════════════════════════════════
   Main ResultCard Modal
════════════════════════════════════════════ */
const ResultCard = ({ studentId, studentName, defaultExamSeries, onClose }) => {
    const printRef = useRef(null);

    const [cardData, setCardData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [schoolInfo, setSchoolInfo] = useState({ name: 'Learnovo School', address: '' });
    const [filterSeries, setFilterSeries] = useState(defaultExamSeries || '');

    /* ── Fetch school settings once ── */
    useEffect(() => {
        settingsService.getSettings?.()
            .then(res => {
                const s = res?.data || res;
                const inst = s?.institution;
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

    const handlePrint = () => window.print();

    const student = cardData?.student;
    const subjects = cardData?.subjects || [];
    const summary = cardData?.summary;

    const issueDate = new Date().toLocaleDateString('en-IN', {
        day: '2-digit', month: 'long', year: 'numeric'
    });

    return (
        <>
            {/* ── Print styles injected via <style> ── */}
            <style>{`
                @media print {
                    body > *:not(#result-card-print-root) { display: none !important; }
                    #result-card-print-root { position: static !important; }
                    .no-print { display: none !important; }
                    .print-card { box-shadow: none !important; border: 1px solid #d1d5db !important; }
                    @page { margin: 12mm; size: A4 portrait; }
                }
            `}</style>

            <div
                id="result-card-print-root"
                className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-start justify-center overflow-y-auto py-6 px-4"
                role="dialog"
                aria-modal="true"
            >
                <div className="w-full max-w-3xl">

                    {/* ── Filter + action bar (no-print) ── */}
                    <div className="no-print flex items-center justify-between mb-3 flex-wrap gap-3">
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
                                disabled={loading || !subjects.length}
                            >
                                <Printer className="h-4 w-4" />
                                Print / Save PDF
                            </button>
                            <button
                                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                                onClick={onClose}
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                    </div>

                    {/* ══════════════════════════════════════
                        PRINT CARD
                    ══════════════════════════════════════ */}
                    <div ref={printRef} className="print-card bg-white rounded-2xl shadow-2xl overflow-hidden">

                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                                <div className="loading-spinner mb-3" />
                                <p className="text-sm">Loading result card…</p>
                            </div>
                        ) : !subjects.length ? (
                            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                                <BookOpen className="h-12 w-12 mb-3 opacity-40" />
                                <p className="text-base font-medium">No results found</p>
                                <p className="text-sm mt-1">
                                    {filterSeries ? `No results for "${filterSeries}" series.` : 'No exam results have been entered yet.'}
                                </p>
                            </div>
                        ) : (
                            <>
                                {/* ── School Header ── */}
                                <div className="bg-gradient-to-r from-indigo-700 via-violet-700 to-purple-700 text-white px-8 py-6">
                                    <div className="flex items-center gap-5">
                                        {/* Logo / Icon */}
                                        <div className="h-16 w-16 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                                            <Award className="h-9 w-9 text-white" />
                                        </div>
                                        <div>
                                            <h1 className="text-2xl font-bold tracking-tight">{schoolInfo.name}</h1>
                                            {schoolInfo.address && (
                                                <p className="text-indigo-200 text-sm mt-0.5">{schoolInfo.address}</p>
                                            )}
                                            <p className="text-indigo-200 text-xs mt-1 uppercase tracking-widest font-semibold">
                                                Student Report Card
                                            </p>
                                        </div>
                                        <div className="ml-auto text-right shrink-0">
                                            {filterSeries && (
                                                <div className="inline-block bg-white/20 px-3 py-1 rounded-full text-sm font-semibold mb-1">
                                                    {filterSeries}
                                                </div>
                                            )}
                                            <p className="text-indigo-200 text-xs">Issued: {issueDate}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* ── Student Info Strip ── */}
                                <div className="bg-indigo-50 border-b border-indigo-100 px-8 py-4">
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                        <InfoCell label="Student Name" value={student?.name || studentName || '—'} highlight />
                                        <InfoCell label="Class" value={student?.class || subjects[0]?.class || '—'} />
                                        <InfoCell label="Roll Number" value={student?.rollNumber || '—'} />
                                        <InfoCell label="Section" value={student?.section || subjects[0]?.section || '—'} />
                                    </div>
                                </div>

                                {/* ── Marks Table ── */}
                                <div className="px-8 py-6">
                                    <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
                                        Subject-wise Performance
                                    </h2>

                                    <div className="overflow-x-auto rounded-xl border border-gray-200">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="bg-gray-50 border-b border-gray-200">
                                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Subject</th>
                                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Exam</th>
                                                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide">Max</th>
                                                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide">Obtained</th>
                                                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide">%</th>
                                                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide">Grade</th>
                                                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide">Result</th>
                                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Remarks</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {subjects.map((s, i) => (
                                                    <tr
                                                        key={s.examId}
                                                        className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} hover:bg-indigo-50/30 transition-colors`}
                                                    >
                                                        <td className="px-4 py-3 font-semibold text-gray-900">{s.subject}</td>
                                                        <td className="px-4 py-3 text-gray-600 text-xs">
                                                            <div>{s.examName}</div>
                                                            <div className="text-gray-400">{new Date(s.date).toLocaleDateString()}</div>
                                                        </td>
                                                        <td className="px-4 py-3 text-center text-gray-700">{s.totalMarks}</td>
                                                        <td className="px-4 py-3 text-center font-bold text-gray-900">{s.marksObtained}</td>
                                                        <td className="px-4 py-3 text-center">
                                                            <span className="text-gray-700 font-medium">{s.percentage}%</span>
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <GradeBadge grade={s.grade} />
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            {s.isPassed ? (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                                                                    <CheckCircle className="h-3 w-3" /> Pass
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-600">
                                                                    <XCircle className="h-3 w-3" /> Fail
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3 text-gray-500 text-xs italic">{s.remarks || '—'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>

                                            {/* ── Summary / Grand Total Row ── */}
                                            <tfoot>
                                                <tr className="bg-indigo-700 text-white">
                                                    <td className="px-4 py-3 font-bold text-sm" colSpan={2}>
                                                        Grand Total
                                                    </td>
                                                    <td className="px-4 py-3 text-center font-bold">{summary.grandTotal}</td>
                                                    <td className="px-4 py-3 text-center font-bold">{summary.grandObtained}</td>
                                                    <td className="px-4 py-3 text-center">
                                                        <span className="flex items-center justify-center gap-1 font-bold">
                                                            <TrendingUp className="h-3.5 w-3.5" />
                                                            {summary.overallPercentage}%
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-sm font-bold
                                                            bg-white/20 border-white/40 text-white`}>
                                                            {summary.overallGrade}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-center" colSpan={2}>
                                                        {summary.overallPassed ? (
                                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-bold text-sm bg-green-500 text-white">
                                                                <CheckCircle className="h-4 w-4" /> PASS
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-bold text-sm bg-red-500 text-white">
                                                                <XCircle className="h-4 w-4" /> FAIL
                                                            </span>
                                                        )}
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>

                                    {/* ── Quick stats ── */}
                                    <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-600">
                                        <span>Total Subjects: <strong className="text-gray-900">{summary.totalSubjects}</strong></span>
                                        <span className="text-green-700">Passed: <strong>{summary.passCount}</strong></span>
                                        {summary.failCount > 0 && (
                                            <span className="text-red-600">Failed: <strong>{summary.failCount}</strong></span>
                                        )}
                                    </div>
                                </div>

                                {/* ── Signature / Declaration row ── */}
                                <div className="px-8 pb-8 mt-2">
                                    <div className="border-t-2 border-dashed border-gray-200 pt-6">
                                        <div className="grid grid-cols-3 gap-6 text-center text-xs text-gray-500">
                                            <SignatureBox label="Class Teacher" />
                                            <div className="flex flex-col items-center justify-end">
                                                <div className={`mb-3 text-2xl font-black ${summary.overallPassed ? 'text-green-600' : 'text-red-600'}`}>
                                                    {summary.overallPassed ? '✓ PROMOTED' : '✗ DETAINED'}
                                                </div>
                                                <p className="text-xs text-gray-400">Official Stamp</p>
                                                <div className="mt-2 w-20 h-20 rounded-full border-2 border-dashed border-gray-300" />
                                            </div>
                                            <SignatureBox label="Principal" />
                                        </div>
                                    </div>
                                    <p className="text-center text-xs text-gray-400 mt-6 italic">
                                        This is a computer-generated report card. Issued by {schoolInfo.name}.
                                    </p>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

/* ── Small helper components ── */
const InfoCell = ({ label, value, highlight }) => (
    <div>
        <p className="text-xs text-indigo-500 font-medium uppercase tracking-wide">{label}</p>
        <p className={`mt-0.5 ${highlight ? 'text-lg font-bold text-indigo-900' : 'text-sm font-semibold text-gray-800'}`}>
            {value}
        </p>
    </div>
);

const SignatureBox = ({ label }) => (
    <div className="flex flex-col items-center">
        <div className="w-full border-b border-gray-400 h-10 mb-2" />
        <p className="font-medium text-gray-600">{label}</p>
        <p className="text-gray-400">Signature & Seal</p>
    </div>
);

export default ResultCard;
