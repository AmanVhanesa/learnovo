import React, { useState, useEffect } from 'react';
import { X, Save, TrendingUp, FileText } from 'lucide-react';
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
    const [students, setStudents] = useState([]);
    const [marks, setMarks] = useState({});
    const [remarks, setRemarks] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [resultCardStudent, setResultCardStudent] = useState(null); // { id, name }

    const passingMarks = exam.passingMarks ?? Math.ceil(exam.totalMarks * 0.4);

    useEffect(() => { fetchData(); }, [exam]);

    const fetchData = async () => {
        try {
            setLoading(true);
            // Use correct filter key 'class' (not 'className')
            const studentsRes = await studentsService.list({ class: exam.class, section: exam.section || undefined, limit: 200 });
            const studentList = studentsRes.data || studentsRes.students || [];
            setStudents(studentList);

            const resultsRes = await examsService.getResults(exam._id);
            const existing = resultsRes.data || [];

            const mks = {}, rmks = {};
            existing.forEach(r => {
                const id = r.student?._id || r.student;
                mks[id] = r.marksObtained;
                rmks[id] = r.remarks || '';
            });
            setMarks(mks);
            setRemarks(rmks);
        } catch (err) {
            console.error('Fetch results error:', err);
            toast.error('Failed to load data');
        } finally { setLoading(false); }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const toSave = Object.keys(marks)
                .filter(id => marks[id] !== undefined && marks[id] !== '')
                .map(id => ({ studentId: id, marks: marks[id], remarks: remarks[id] }));

            await examsService.saveResults(exam._id, toSave);
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

    /* ── Summary row (from filled marks) ── */
    const filled = students.filter(s => marks[s._id] !== undefined && marks[s._id] !== '');
    const passCount = filled.filter(s => Number(marks[s._id]) >= passingMarks).length;
    const failCount = filled.length - passCount;
    const avgPct = filled.length
        ? Math.round(filled.reduce((acc, s) => acc + Number(marks[s._id]), 0) / filled.length / exam.totalMarks * 1000) / 10
        : null;

    return (
        <>
            <div className="modal-overlay" role="dialog" aria-modal="true">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl mx-4 max-h-[92vh] flex flex-col">

                    {/* Header */}
                    <div className="px-6 py-4 border-b border-gray-200 shrink-0 flex items-start justify-between">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900">
                                Results — {exam.name}
                            </h3>
                            <p className="text-sm text-gray-500 mt-0.5">
                                {exam.subject} &nbsp;|&nbsp; Class&nbsp;{exam.class}
                                {exam.section && ` §${exam.section}`}
                                &nbsp;|&nbsp; Max:&nbsp;<strong>{exam.totalMarks}</strong>
                                &nbsp;|&nbsp; Pass:&nbsp;<strong className="text-amber-600">{passingMarks}</strong>
                            </p>
                        </div>
                        <button className="p-2 rounded-lg hover:bg-gray-100" onClick={onClose}>
                            <X className="h-5 w-5 text-gray-500" />
                        </button>
                    </div>

                    {/* Summary bar */}
                    {!loading && filled.length > 0 && (
                        <div className="flex flex-wrap gap-4 px-6 py-3 bg-gray-50 border-b border-gray-100 shrink-0 text-sm">
                            <span className="text-gray-600">Filled: <strong>{filled.length}/{students.length}</strong></span>
                            <span className="text-green-600">Pass: <strong>{passCount}</strong></span>
                            <span className="text-red-500">Fail: <strong>{failCount}</strong></span>
                            {avgPct !== null && (
                                <span className="text-blue-600 flex items-center gap-1">
                                    <TrendingUp className="h-3.5 w-3.5" />
                                    Class Avg: <strong>{avgPct}%</strong>
                                </span>
                            )}
                        </div>
                    )}

                    {/* Table */}
                    <div className="flex-1 overflow-y-auto px-6 py-4">
                        {loading ? (
                            <div className="flex justify-center items-center h-40">
                                <div className="loading-spinner" />
                            </div>
                        ) : students.length === 0 ? (
                            <p className="text-center text-gray-400 py-12">No students found for this class</p>
                        ) : (
                            <table className="table w-full">
                                <thead className="sticky top-0 bg-white z-10 shadow-sm">
                                    <tr>
                                        <th className="w-16">Roll</th>
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
                                    {students.map(student => {
                                        const id = student._id || student.id;
                                        const stats = getStats(id);
                                        return (
                                            <tr key={id}>
                                                <td className="text-gray-500 text-xs">{student.rollNumber || '—'}</td>
                                                <td className="font-medium text-gray-900">{student.fullName || student.name || '—'}</td>
                                                <td>
                                                    <input
                                                        type="number"
                                                        className="input w-24"
                                                        max={exam.totalMarks}
                                                        min="0"
                                                        placeholder="0"
                                                        value={marks[id] !== undefined ? marks[id] : ''}
                                                        onChange={e => setMarks(prev => ({ ...prev, [id]: e.target.value }))}
                                                    />
                                                </td>
                                                <td className="text-sm text-gray-600">
                                                    {stats ? `${stats.pct}%` : '—'}
                                                </td>
                                                <td>
                                                    {stats ? (
                                                        <span className={`text-sm ${stats.grade.color}`}>
                                                            {stats.grade.label}
                                                        </span>
                                                    ) : <span className="text-gray-300">—</span>}
                                                </td>
                                                <td>
                                                    {stats ? (
                                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${stats.passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                                                            {stats.passed ? 'Pass' : 'Fail'}
                                                        </span>
                                                    ) : <span className="text-gray-300 text-xs">—</span>}
                                                </td>
                                                <td>
                                                    <input
                                                        type="text"
                                                        className="input"
                                                        placeholder="Optional…"
                                                        value={remarks[id] || ''}
                                                        onChange={e => setRemarks(prev => ({ ...prev, [id]: e.target.value }))}
                                                    />
                                                </td>
                                                <td>
                                                    <button
                                                        type="button"
                                                        title="View Result Card"
                                                        className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 transition-colors"
                                                        onClick={() => setResultCardStudent({ id, name: student.fullName || student.name })}
                                                    >
                                                        <FileText className="h-4 w-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t border-gray-200 shrink-0 flex justify-end gap-3 bg-gray-50 rounded-b-xl">
                        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
                        <button
                            className="btn btn-primary"
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
    );
};

export default ExamResultsModal;
