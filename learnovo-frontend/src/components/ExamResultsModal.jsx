import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { X, Save, TrendingUp, FileText, Eye, EyeOff, Search } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { studentsService } from '../services/studentsService';
import { examsService } from '../services/examsService';
import ResultCard from './ResultCard';
import toast from 'react-hot-toast';

/* ── Grade from percentage ── */
function getGrade(pct) {
    if (pct >= 90) return { label: 'A+', color: 'text-emerald-600 font-bold' };
    if (pct >= 80) return { label: 'A', color: 'text-green-600 font-semibold' };
    if (pct >= 70) return { label: 'B', color: 'text-teal-600 font-semibold' };
    if (pct >= 60) return { label: 'C', color: 'text-blue-600 font-semibold' };
    if (pct >= 50) return { label: 'D', color: 'text-amber-600 font-semibold' };
    return { label: 'F', color: 'text-red-600 font-bold' };
}

const ExamResultsModal = ({ exam, onClose }) => {
    const queryClient = useQueryClient();
    const [students, setStudents] = useState([]);
    const [marks, setMarks] = useState({});
    const [remarks, setRemarks] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [isPublished, setIsPublished] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [resultCardStudent, setResultCardStudent] = useState(null); // { id, name }

    const passingMarks = exam.passingMarks ?? Math.ceil(exam.totalMarks * 0.4);

    useEffect(() => { fetchData(); }, [exam]);
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = 'unset'; };
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            // Pass both class name and classId for robust matching
            const studentsRes = await studentsService.list({ class: exam.class, classId: exam.classId || undefined, section: exam.section || undefined, limit: 200 });
            let studentList = studentsRes.data || studentsRes.students || [];

            // Tag students who have skipped this exam's subject (optional subject opt-out)
            studentList = studentList.map(s => ({
                ...s,
                _subjectSkipped: Array.isArray(s.skippedSubjects) && s.skippedSubjects.includes(exam.subject)
            }));
            setStudents(studentList);

            const resultsRes = await examsService.getResults(exam._id);
            const existing = resultsRes.data || [];

            const mks = {}, rmks = {};
            let published = false;
            existing.forEach(r => {
                const id = r.student?._id || r.student;
                mks[id] = r.marksObtained;
                rmks[id] = r.remarks || '';
                if (r.isPublished) published = true;
            });
            setMarks(mks);
            setRemarks(rmks);
            setIsPublished(published);
        } catch (err) {
            toast.error('Failed to load data');
        } finally { setLoading(false); }
    };

    const handlePublishToggle = async () => {
        setPublishing(true);
        try {
            const newState = !isPublished;
            await examsService.publishResults(exam._id, newState);
            setIsPublished(newState);
            queryClient.invalidateQueries({ queryKey: ['exams'] });
            queryClient.invalidateQueries({ queryKey: ['my-results'] });
            queryClient.invalidateQueries({ queryKey: ['student-exams'] });
            toast.success(newState ? 'Results published — students can now see them' : 'Results unpublished');
        } catch {
            toast.error('Failed to update publish status');
        } finally { setPublishing(false); }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // Exclude students who have this subject skipped
            const skippedStudentIds = new Set(students.filter(s => s._subjectSkipped).map(s => s._id || s.id));
            const toSave = Object.keys(marks)
                .filter(id => marks[id] !== undefined && marks[id] !== '' && !skippedStudentIds.has(id))
                .map(id => ({ studentId: id, marks: marks[id], remarks: remarks[id] }));

            await examsService.saveResults(exam._id, toSave);
            // Invalidate all result-related queries so other panels reflect the change
            queryClient.invalidateQueries({ queryKey: ['exams'] });
            queryClient.invalidateQueries({ queryKey: ['student-exams'] });
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
            toast.success('Results saved successfully');
            onClose();
        } catch {
            toast.error('Failed to save results');
        } finally { setSaving(false); }
    };

    /* ── Per-student computed stats ── */
    const getStats = (studentId) => {
        const m = marks[studentId];
        if (m === undefined || m === '') return null;
        const pct = exam.totalMarks > 0 ? Math.round((Number(m) / exam.totalMarks) * 100 * 10) / 10 : 0;
        const grade = getGrade(pct);
        const passed = Number(m) >= passingMarks;
        return { pct, grade, passed };
    };

    /* ── Summary row (from filled marks, excluding skipped students) ── */
    const filled = students.filter(s => !s._subjectSkipped && marks[s._id] !== undefined && marks[s._id] !== '');
    const passCount = filled.filter(s => Number(marks[s._id]) >= passingMarks).length;
    const failCount = filled.length - passCount;
    const avgPct = filled.length
        ? Math.round(filled.reduce((acc, s) => acc + Number(marks[s._id]), 0) / filled.length / exam.totalMarks * 1000) / 10
        : null;

    /* ── Filtered students based on search ── */
    const filteredStudents = searchText.trim()
        ? students.filter(s => {
            const q = searchText.toLowerCase();
            return (s.fullName || s.name || '').toLowerCase().includes(q)
                || (s.admissionNumber || '').toLowerCase().includes(q)
                || (s.rollNumber || '').toLowerCase().includes(q);
        })
        : students;

    return ReactDOM.createPortal(
        <>
            <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', overflowY: 'auto', padding: '24px 0', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
                <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass-lg w-full max-w-5xl mx-2 sm:mx-4 my-auto shrink-0 flex flex-col" style={{ maxHeight: 'calc(100vh - 48px)' }}>

                    {/* Header */}
                    <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-[#38383A] shrink-0 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white truncate">
                                Results — {exam.name}
                            </h3>
                            <p className="text-xs sm:text-sm text-gray-500 dark:text-[#8E8E93] mt-0.5">
                                {exam.subject} &nbsp;|&nbsp; Class&nbsp;{exam.class}
                                {exam.section && ` – Section ${exam.section}`}
                                &nbsp;|&nbsp; Max:&nbsp;<strong>{exam.totalMarks}</strong>
                                &nbsp;|&nbsp; Pass:&nbsp;<strong className="text-amber-600 dark:text-amber-400">{passingMarks}</strong>
                                {!loading && (
                                    <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${isPublished
                                        ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400'
                                        : 'bg-gray-100 text-gray-500 dark:bg-[#38383A] dark:text-[#8E8E93]'
                                    }`}>
                                        {isPublished ? 'Published' : 'Draft'}
                                    </span>
                                )}
                            </p>
                        </div>
                        <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-[#2C2C2E]" onClick={onClose}>
                            <X className="h-5 w-5 text-gray-500 dark:text-[#8E8E93]" />
                        </button>
                    </div>

                    {/* Summary bar */}
                    {!loading && filled.length > 0 && (
                        <div className="flex flex-wrap gap-3 sm:gap-4 px-4 sm:px-6 py-3 bg-gray-50 dark:bg-[#2C2C2E] border-b border-gray-100 dark:border-[#38383A] shrink-0 text-xs sm:text-sm">
                            <span className="text-gray-600 dark:text-[#8E8E93]">Filled: <strong>{filled.length}/{students.length}</strong></span>
                            <span className="text-green-600 dark:text-green-400">Pass: <strong>{passCount}</strong></span>
                            <span className="text-red-500 dark:text-red-400">Fail: <strong>{failCount}</strong></span>
                            {avgPct !== null && (
                                <span className="text-blue-600 dark:text-blue-400 flex items-center gap-1">
                                    <TrendingUp className="h-3.5 w-3.5" />
                                    Class Avg: <strong>{avgPct}%</strong>
                                </span>
                            )}
                        </div>
                    )}

                    {/* Search bar */}
                    {!loading && students.length > 0 && (
                        <div className="px-4 sm:px-6 pt-3 pb-1 shrink-0">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-[#636366] pointer-events-none" />
                                <input
                                    type="text"
                                    className="input w-full pl-9 pr-8"
                                    placeholder="Search by name, admission no, or roll no…"
                                    value={searchText}
                                    onChange={e => setSearchText(e.target.value)}
                                />
                                {searchText && (
                                    <button
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-gray-100 dark:hover:bg-[#38383A]"
                                        onClick={() => setSearchText('')}
                                    >
                                        <X className="h-3.5 w-3.5 text-gray-400 dark:text-[#636366]" />
                                    </button>
                                )}
                            </div>
                            {searchText.trim() && (
                                <p className="text-xs text-gray-400 dark:text-[#636366] mt-1.5">
                                    Showing {filteredStudents.length} of {students.length} students
                                </p>
                            )}
                        </div>
                    )}

                    {/* Table */}
                    <div className="flex-1 overflow-y-auto overflow-x-auto px-4 sm:px-6 py-4">
                        {loading ? (
                            <div className="flex justify-center items-center h-40">
                                <div className="loading-spinner" />
                            </div>
                        ) : students.length === 0 ? (
                            <p className="text-center text-gray-400 dark:text-[#636366] py-12">No students found for this class</p>
                        ) : filteredStudents.length === 0 ? (
                            <p className="text-center text-gray-400 dark:text-[#636366] py-12">No students match "{searchText}"</p>
                        ) : (
                            <table className="table w-full min-w-[700px]">
                                <thead className="sticky top-0 bg-white dark:bg-[#1C1C1E] z-10 shadow-sm">
                                    <tr>
                                        <th className="w-16">Roll</th>
                                        <th className="w-28">Adm. No</th>
                                        <th>Student Name</th>
                                        <th className="w-32">Marks / {exam.totalMarks}</th>
                                        <th className="w-20">%</th>
                                        <th className="w-16">Grade</th>
                                        <th className="w-24">Status</th>
                                        <th>Remarks</th>
                                        <th className="w-20">Card</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredStudents.map(student => {
                                        const id = student._id || student.id;
                                        const stats = getStats(id);
                                        const isSkipped = student._subjectSkipped;
                                        return (
                                            <tr key={id} className={isSkipped ? 'opacity-50' : ''}>
                                                <td className="text-gray-500 dark:text-[#8E8E93] text-xs">{student.rollNumber || '—'}</td>
                                                <td className="text-gray-500 dark:text-[#8E8E93] text-xs font-mono">{student.admissionNumber || '—'}</td>
                                                <td className="font-medium text-gray-900 dark:text-white">
                                                    {student.fullName || student.name || '—'}
                                                    {isSkipped && (
                                                        <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500 dark:bg-[#38383A] dark:text-[#8E8E93]">N/A — Subject Skipped</span>
                                                    )}
                                                </td>
                                                <td>
                                                    {isSkipped ? (
                                                        <span className="text-xs text-gray-400 dark:text-[#636366] italic">N/A</span>
                                                    ) : (
                                                        <input
                                                            type="number"
                                                            className="input w-24"
                                                            max={exam.totalMarks}
                                                            min="0"
                                                            placeholder="0"
                                                            value={marks[id] !== undefined ? marks[id] : ''}
                                                            onChange={e => setMarks(prev => ({ ...prev, [id]: e.target.value }))}
                                                        />
                                                    )}
                                                </td>
                                                <td className="text-sm text-gray-600 dark:text-[#8E8E93]">
                                                    {isSkipped ? '—' : stats ? `${stats.pct}%` : '—'}
                                                </td>
                                                <td>
                                                    {isSkipped ? <span className="text-gray-300 dark:text-[#636366]">—</span> : stats ? (
                                                        <span className={`text-sm ${stats.grade.color}`}>
                                                            {stats.grade.label}
                                                        </span>
                                                    ) : <span className="text-gray-300 dark:text-[#636366]">—</span>}
                                                </td>
                                                <td>
                                                    {isSkipped ? <span className="text-gray-300 dark:text-[#636366] text-xs">—</span> : stats ? (
                                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${stats.passed ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' : 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400'}`}>
                                                            {stats.passed ? 'Pass' : 'Fail'}
                                                        </span>
                                                    ) : <span className="text-gray-300 dark:text-[#636366] text-xs">—</span>}
                                                </td>
                                                <td>
                                                    {isSkipped ? (
                                                        <span className="text-xs text-gray-400 dark:text-[#636366]">—</span>
                                                    ) : (
                                                        <input
                                                            type="text"
                                                            className="input"
                                                            placeholder="Optional…"
                                                            value={remarks[id] || ''}
                                                            onChange={e => setRemarks(prev => ({ ...prev, [id]: e.target.value }))}
                                                        />
                                                    )}
                                                </td>
                                                <td>
                                                    {!isSkipped && (
                                                        <button
                                                            type="button"
                                                            title="View Result Card"
                                                            className="p-1.5 rounded-lg text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors"
                                                            onClick={() => setResultCardStudent({ id, name: student.fullName || student.name })}
                                                        >
                                                            <FileText className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-4 sm:px-6 py-4 border-t border-gray-200 dark:border-[#38383A] shrink-0 flex flex-col-reverse sm:flex-row items-center gap-3 bg-gray-50 dark:bg-[#2C2C2E] rounded-b-xl">
                        <button className="btn btn-ghost w-full sm:w-auto" onClick={onClose}>Cancel</button>

                        {/* Publish toggle — only show if results exist */}
                        {filled.length > 0 && (
                            <button
                                className={`btn w-full sm:w-auto gap-1.5 ${isPublished
                                    ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-500/20 dark:text-amber-400 dark:hover:bg-amber-500/30'
                                    : 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-500/20 dark:text-green-400 dark:hover:bg-green-500/30'
                                }`}
                                onClick={handlePublishToggle}
                                disabled={publishing || saving || loading}
                            >
                                {isPublished ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                {publishing ? 'Updating…' : isPublished ? 'Unpublish' : 'Publish to Students'}
                            </button>
                        )}

                        <div className="flex-1" />
                        <button
                            className="btn btn-primary w-full sm:w-auto"
                            onClick={handleSave}
                            disabled={saving || loading}
                        >
                            <Save className="h-4 w-4 mr-2" />
                            {saving ? 'Saving…' : 'Save Results'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Result Card Modal */}
            {resultCardStudent && (
                <ResultCard
                    studentId={resultCardStudent.id}
                    studentName={resultCardStudent.name}
                    defaultExamSeries={exam.examSeries}
                    onClose={() => setResultCardStudent(null)}
                />
            )}
        </>
        , document.body);
};

export default ExamResultsModal;
