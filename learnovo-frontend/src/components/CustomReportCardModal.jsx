import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
    X, Plus, Trash2, Download, UserCheck, Edit3, GraduationCap,
    BookOpen, AlertCircle, Loader2, ChevronDown, Search
} from 'lucide-react';
import { examsService } from '../services/examsService';
import toast from 'react-hot-toast';
import Select from './ui/Select';

const EXAM_SERIES_OPTIONS = ['FA1', 'FA2', 'FA3', 'FA4', 'SA1', 'SA2', 'Unit Test', 'Midterm', 'Final', 'Custom'];

const EMPTY_SUBJECT = { name: '', totalMarks: 100, passingMarks: 33, marksObtained: '' };

const CustomReportCardModal = ({ onClose, students = [], classes = [], subjects: subjectsList = [] }) => {
    /* ── Mode: 'system' = pick student from DB, 'manual' = type everything ── */
    const [mode, setMode] = useState('system');

    /* ── Student selection (system mode) ── */
    const [selectedStudentId, setSelectedStudentId] = useState('');
    const [studentSearch, setStudentSearch] = useState('');

    /* ── Manual student fields ── */
    const [studentForm, setStudentForm] = useState({
        name: '', admissionNumber: '', class: '', section: '',
        rollNumber: '', dob: '', guardianName: ''
    });

    /* ── Exam info ── */
    const [examForm, setExamForm] = useState({
        name: '', examSeries: 'Midterm', academicYear: ''
    });

    /* ── Subjects with marks ── */
    const [subjectRows, setSubjectRows] = useState([{ ...EMPTY_SUBJECT }]);

    /* ── General ── */
    const [remarks, setRemarks] = useState('');
    const [generating, setGenerating] = useState(false);
    const [errors, setErrors] = useState({});

    /* ── Filtered students for search ── */
    const filteredStudents = useMemo(() => {
        if (!studentSearch.trim()) return students.slice(0, 50);
        const q = studentSearch.toLowerCase();
        return students.filter(s =>
            (s.fullName || s.name || '').toLowerCase().includes(q)
            || (s.admissionNumber || '').toLowerCase().includes(q)
            || (s.rollNumber || '').toString().includes(q)
        ).slice(0, 50);
    }, [students, studentSearch]);

    /* ── Selected student object ── */
    const selectedStudent = useMemo(() => {
        if (!selectedStudentId) return null;
        return students.find(s => (s._id || s.id) === selectedStudentId) || null;
    }, [selectedStudentId, students]);

    /* ── Subject row handlers ── */
    const addSubjectRow = () => setSubjectRows(prev => [...prev, { ...EMPTY_SUBJECT }]);

    const removeSubjectRow = (idx) => {
        if (subjectRows.length <= 1) return;
        setSubjectRows(prev => prev.filter((_, i) => i !== idx));
    };

    const updateSubjectRow = (idx, field, value) => {
        setSubjectRows(prev => prev.map((row, i) => i === idx ? { ...row, [field]: value } : row));
    };

    /* ── Populate subjects from system ── */
    const populateFromSystem = () => {
        if (subjectsList.length === 0) {
            toast.error('No subjects found in the system');
            return;
        }
        setSubjectRows(subjectsList.filter(s => s.isActive !== false).map(s => ({
            name: s.name || s.subjectCode || '',
            totalMarks: 100,
            passingMarks: 33,
            marksObtained: ''
        })));
        toast.success(`${subjectsList.filter(s => s.isActive !== false).length} subjects loaded from system`);
    };

    /* ── Summary calculation ── */
    const summary = useMemo(() => {
        const valid = subjectRows.filter(s => s.name && s.marksObtained !== '');
        const grandTotal = valid.reduce((a, s) => a + (Number(s.totalMarks) || 0), 0);
        const grandObtained = valid.reduce((a, s) => a + (Number(s.marksObtained) || 0), 0);
        const percentage = grandTotal > 0 ? Math.round((grandObtained / grandTotal) * 100 * 10) / 10 : 0;
        const passCount = valid.filter(s => {
            const passMark = Number(s.passingMarks) || Math.ceil((Number(s.totalMarks) || 0) * 0.33);
            return (Number(s.marksObtained) || 0) >= passMark;
        }).length;
        return { grandTotal, grandObtained, percentage, passCount, total: valid.length };
    }, [subjectRows]);

    /* ── Validate ── */
    const validate = () => {
        const errs = {};

        if (mode === 'system' && !selectedStudentId) {
            errs.student = 'Please select a student';
        }
        if (mode === 'manual' && !studentForm.name.trim()) {
            errs.studentName = 'Student name is required';
        }

        const filledSubjects = subjectRows.filter(s => s.name.trim());
        if (filledSubjects.length === 0) {
            errs.subjects = 'Add at least one subject with a name';
        }

        for (let i = 0; i < subjectRows.length; i++) {
            const s = subjectRows[i];
            if (!s.name.trim()) continue;
            if (s.marksObtained === '' || s.marksObtained === null || s.marksObtained === undefined) {
                errs[`subject_${i}_marks`] = 'Marks required';
            } else if (Number(s.marksObtained) > Number(s.totalMarks)) {
                errs[`subject_${i}_marks`] = 'Marks exceed total';
            } else if (Number(s.marksObtained) < 0) {
                errs[`subject_${i}_marks`] = 'Marks cannot be negative';
            }
        }

        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    /* ── Generate PDF ── */
    const handleGenerate = async () => {
        if (!validate()) return;

        setGenerating(true);
        try {
            const studentPayload = mode === 'system'
                ? { studentId: selectedStudentId }
                : {
                    name: studentForm.name,
                    admissionNumber: studentForm.admissionNumber,
                    class: studentForm.class,
                    section: studentForm.section,
                    rollNumber: studentForm.rollNumber,
                    dob: studentForm.dob,
                    guardianName: studentForm.guardianName
                };

            const filledSubjects = subjectRows
                .filter(s => s.name.trim())
                .map(s => ({
                    name: s.name,
                    totalMarks: Number(s.totalMarks) || 100,
                    passingMarks: Number(s.passingMarks) || 33,
                    marksObtained: Number(s.marksObtained) || 0,
                    remarks: s.remarks || ''
                }));

            const payload = {
                student: studentPayload,
                exam: {
                    name: examForm.name,
                    examSeries: examForm.examSeries,
                    academicYear: examForm.academicYear
                },
                subjects: filledSubjects,
                remarks
            };

            const blob = await examsService.generateCustomReportCardPDF(payload);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const name = mode === 'system'
                ? (selectedStudent?.fullName || selectedStudent?.name || 'Student').replace(/\s+/g, '_')
                : (studentForm.name || 'Student').replace(/\s+/g, '_');
            a.download = `Custom_Report_Card_${name}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            toast.success('Custom report card downloaded!');
        } catch (err) {
            let msg = 'Failed to generate custom report card';
            try {
                const errorBlob = err?.response?.data;
                if (errorBlob instanceof Blob) {
                    const text = await errorBlob.text();
                    const json = JSON.parse(text);
                    msg = json.message || msg;
                } else if (err?.response?.data?.message) {
                    msg = err.response.data.message;
                }
            } catch { /* use default */ }
            toast.error(msg);
        } finally {
            setGenerating(false);
        }
    };

    return createPortal(
        <div className="modal-overlay" role="dialog" aria-modal="true">
            <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-2xl w-full max-w-3xl mx-2 sm:mx-4 max-h-[92vh] flex flex-col">

                {/* ── Header ── */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-[#38383A] shrink-0">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                            <Edit3 className="h-5 w-5 text-primary-500" />
                            Custom Report Card
                        </h3>
                        <p className="text-xs text-gray-400 dark:text-[#636366] mt-0.5">
                            Manually fill in all details and generate a report card PDF
                        </p>
                    </div>
                    <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-[#2C2C2E] transition-colors" onClick={onClose}>
                        <X className="h-5 w-5 text-gray-500 dark:text-[#8E8E93]" />
                    </button>
                </div>

                {/* ── Scrollable body ── */}
                <div className="overflow-y-auto flex-1 px-4 sm:px-6 py-5 space-y-6">

                    {/* ── Mode toggle ── */}
                    <div>
                        <label className="text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wide mb-2 block">
                            Student Data Source
                        </label>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setMode('system')}
                                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold border-2 transition-all ${
                                    mode === 'system'
                                        ? 'bg-primary-50 dark:bg-primary-500/10 text-primary-700 dark:text-primary-400 border-primary-300 dark:border-primary-500/30'
                                        : 'bg-white dark:bg-[#2C2C2E] text-gray-500 dark:text-[#8E8E93] border-gray-200 dark:border-[#38383A] hover:border-gray-300'
                                }`}
                            >
                                <UserCheck className="h-4 w-4" />
                                Select from System
                            </button>
                            <button
                                type="button"
                                onClick={() => setMode('manual')}
                                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold border-2 transition-all ${
                                    mode === 'manual'
                                        ? 'bg-primary-50 dark:bg-primary-500/10 text-primary-700 dark:text-primary-400 border-primary-300 dark:border-primary-500/30'
                                        : 'bg-white dark:bg-[#2C2C2E] text-gray-500 dark:text-[#8E8E93] border-gray-200 dark:border-[#38383A] hover:border-gray-300'
                                }`}
                            >
                                <Edit3 className="h-4 w-4" />
                                Enter Manually
                            </button>
                        </div>
                    </div>

                    {/* ── Student: System mode ── */}
                    {mode === 'system' && (
                        <SectionBlock icon={<UserCheck className="h-4 w-4" />} title="Select Student">
                            <div className="relative mb-2">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                                <input
                                    type="text"
                                    className="input w-full pl-9"
                                    placeholder="Search by name, admission no, or roll no..."
                                    value={studentSearch}
                                    onChange={e => setStudentSearch(e.target.value)}
                                />
                            </div>
                            {students.length === 0 ? (
                                <p className="text-xs text-gray-400 dark:text-[#636366] italic py-2">
                                    Select a class & section on the Report Cards tab first, or use Manual mode.
                                </p>
                            ) : (
                                <div className="max-h-40 overflow-y-auto border border-gray-200 dark:border-[#38383A] rounded-xl">
                                    {filteredStudents.map(s => {
                                        const sid = s._id || s.id;
                                        const isSelected = sid === selectedStudentId;
                                        return (
                                            <button
                                                key={sid}
                                                type="button"
                                                onClick={() => setSelectedStudentId(isSelected ? '' : sid)}
                                                className={`w-full flex items-center justify-between px-4 py-2.5 text-left text-sm transition-colors border-b last:border-b-0 border-gray-100 dark:border-[#38383A] ${
                                                    isSelected
                                                        ? 'bg-primary-50 dark:bg-primary-500/10 text-primary-700 dark:text-primary-400'
                                                        : 'hover:bg-gray-50 dark:hover:bg-[#2C2C2E] text-gray-700 dark:text-gray-300'
                                                }`}
                                            >
                                                <span className="font-medium">{s.fullName || s.name}</span>
                                                <span className="text-xs text-gray-400 dark:text-[#636366]">
                                                    {s.admissionNumber || ''} {s.rollNumber ? `• Roll ${s.rollNumber}` : ''}
                                                </span>
                                            </button>
                                        );
                                    })}
                                    {filteredStudents.length === 0 && (
                                        <p className="text-xs text-gray-400 py-3 text-center">No students match your search</p>
                                    )}
                                </div>
                            )}
                            {selectedStudent && (
                                <div className="mt-3 p-3 bg-primary-50/50 dark:bg-primary-500/5 rounded-xl border border-primary-200/50 dark:border-primary-500/20">
                                    <p className="text-sm font-medium text-primary-700 dark:text-primary-400">
                                        Selected: {selectedStudent.fullName || selectedStudent.name}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-[#8E8E93] mt-0.5">
                                        {selectedStudent.class && `Class ${selectedStudent.class}`}
                                        {selectedStudent.section && ` - ${selectedStudent.section}`}
                                        {selectedStudent.admissionNumber && ` • Adm: ${selectedStudent.admissionNumber}`}
                                    </p>
                                </div>
                            )}
                            {errors.student && <FieldError msg={errors.student} />}
                        </SectionBlock>
                    )}

                    {/* ── Student: Manual mode ── */}
                    {mode === 'manual' && (
                        <SectionBlock icon={<Edit3 className="h-4 w-4" />} title="Student Details">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="sm:col-span-2">
                                    <label className="label mb-1 block text-gray-700 dark:text-[#8E8E93]">
                                        Student Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        className={`input ${errors.studentName ? 'border-red-400' : ''}`}
                                        placeholder="e.g. Rahul Sharma"
                                        value={studentForm.name}
                                        onChange={e => setStudentForm(p => ({ ...p, name: e.target.value }))}
                                    />
                                    {errors.studentName && <FieldError msg={errors.studentName} />}
                                </div>
                                <div>
                                    <label className="label mb-1 block text-gray-700 dark:text-[#8E8E93]">Admission No.</label>
                                    <input className="input" placeholder="e.g. ADM-2025-001"
                                        value={studentForm.admissionNumber}
                                        onChange={e => setStudentForm(p => ({ ...p, admissionNumber: e.target.value }))}
                                    />
                                </div>
                                <div>
                                    <label className="label mb-1 block text-gray-700 dark:text-[#8E8E93]">Roll Number</label>
                                    <input className="input" placeholder="e.g. 12"
                                        value={studentForm.rollNumber}
                                        onChange={e => setStudentForm(p => ({ ...p, rollNumber: e.target.value }))}
                                    />
                                </div>
                                <div>
                                    <label className="label mb-1 block text-gray-700 dark:text-[#8E8E93]">Class</label>
                                    <input className="input" placeholder="e.g. 10"
                                        value={studentForm.class}
                                        onChange={e => setStudentForm(p => ({ ...p, class: e.target.value }))}
                                    />
                                </div>
                                <div>
                                    <label className="label mb-1 block text-gray-700 dark:text-[#8E8E93]">Section</label>
                                    <input className="input" placeholder="e.g. A"
                                        value={studentForm.section}
                                        onChange={e => setStudentForm(p => ({ ...p, section: e.target.value }))}
                                    />
                                </div>
                                <div>
                                    <label className="label mb-1 block text-gray-700 dark:text-[#8E8E93]">Date of Birth</label>
                                    <input type="date" className="input"
                                        value={studentForm.dob}
                                        onChange={e => setStudentForm(p => ({ ...p, dob: e.target.value }))}
                                    />
                                </div>
                                <div>
                                    <label className="label mb-1 block text-gray-700 dark:text-[#8E8E93]">Parent / Guardian</label>
                                    <input className="input" placeholder="e.g. Mr. Sharma"
                                        value={studentForm.guardianName}
                                        onChange={e => setStudentForm(p => ({ ...p, guardianName: e.target.value }))}
                                    />
                                </div>
                            </div>
                        </SectionBlock>
                    )}

                    {/* ── Exam Info ── */}
                    <SectionBlock icon={<GraduationCap className="h-4 w-4" />} title="Exam Details">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                                <label className="label mb-1 block text-gray-700 dark:text-[#8E8E93]">Exam Name</label>
                                <input className="input" placeholder="e.g. Midterm Examination"
                                    value={examForm.name}
                                    onChange={e => setExamForm(p => ({ ...p, name: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label className="label mb-1 block text-gray-700 dark:text-[#8E8E93]">Exam Series</label>
                                <Select
                                    value={examForm.examSeries}
                                    onChange={e => setExamForm(p => ({ ...p, examSeries: e.target.value }))}
                                    options={EXAM_SERIES_OPTIONS.map(s => ({ value: s, label: s }))}
                                />
                            </div>
                            <div>
                                <label className="label mb-1 block text-gray-700 dark:text-[#8E8E93]">Academic Year</label>
                                <input className="input" placeholder="e.g. 2025-26"
                                    value={examForm.academicYear}
                                    onChange={e => setExamForm(p => ({ ...p, academicYear: e.target.value }))}
                                />
                            </div>
                        </div>
                    </SectionBlock>

                    {/* ── Subjects & Marks ── */}
                    <SectionBlock icon={<BookOpen className="h-4 w-4" />} title="Subjects & Marks">
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-xs text-gray-400 dark:text-[#636366]">
                                {subjectRows.length} subject{subjectRows.length !== 1 ? 's' : ''} added
                            </p>
                            <button
                                type="button"
                                onClick={populateFromSystem}
                                className="text-xs text-primary-600 dark:text-primary-400 hover:underline font-medium"
                            >
                                Load subjects from system
                            </button>
                        </div>

                        {errors.subjects && <FieldError msg={errors.subjects} />}

                        {/* Header row */}
                        <div className="hidden sm:grid sm:grid-cols-[1fr_80px_80px_80px_36px] gap-2 mb-1.5 px-1">
                            <span className="text-[10px] font-semibold text-gray-400 dark:text-[#636366] uppercase tracking-wide">Subject</span>
                            <span className="text-[10px] font-semibold text-gray-400 dark:text-[#636366] uppercase tracking-wide text-center">Max</span>
                            <span className="text-[10px] font-semibold text-gray-400 dark:text-[#636366] uppercase tracking-wide text-center">Pass</span>
                            <span className="text-[10px] font-semibold text-gray-400 dark:text-[#636366] uppercase tracking-wide text-center">Obtained</span>
                            <span></span>
                        </div>

                        <div className="space-y-2">
                            {subjectRows.map((row, idx) => (
                                <div key={idx} className="grid grid-cols-1 sm:grid-cols-[1fr_80px_80px_80px_36px] gap-2 items-start">
                                    <input
                                        className="input text-sm"
                                        placeholder="Subject name"
                                        value={row.name}
                                        onChange={e => updateSubjectRow(idx, 'name', e.target.value)}
                                    />
                                    <input
                                        type="number"
                                        min="1"
                                        className="input text-sm text-center"
                                        placeholder="Max"
                                        value={row.totalMarks}
                                        onChange={e => updateSubjectRow(idx, 'totalMarks', e.target.value)}
                                    />
                                    <input
                                        type="number"
                                        min="0"
                                        className="input text-sm text-center"
                                        placeholder="Pass"
                                        value={row.passingMarks}
                                        onChange={e => updateSubjectRow(idx, 'passingMarks', e.target.value)}
                                    />
                                    <input
                                        type="number"
                                        min="0"
                                        className={`input text-sm text-center ${errors[`subject_${idx}_marks`] ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
                                        placeholder="Marks"
                                        value={row.marksObtained}
                                        onChange={e => updateSubjectRow(idx, 'marksObtained', e.target.value)}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => removeSubjectRow(idx)}
                                        disabled={subjectRows.length <= 1}
                                        className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                    {errors[`subject_${idx}_marks`] && (
                                        <p className="sm:col-span-5 text-xs text-red-500 flex items-center gap-1 -mt-1 pl-1">
                                            <AlertCircle className="h-3 w-3" /> {errors[`subject_${idx}_marks`]}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>

                        <button
                            type="button"
                            onClick={addSubjectRow}
                            className="mt-3 flex items-center gap-1.5 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 font-medium transition-colors"
                        >
                            <Plus className="h-4 w-4" /> Add Subject
                        </button>
                    </SectionBlock>

                    {/* ── Remarks ── */}
                    <SectionBlock icon={<Edit3 className="h-4 w-4" />} title="Remarks (Optional)">
                        <textarea
                            className="input w-full resize-none"
                            rows={2}
                            placeholder="e.g. Excellent performance. Keep it up!"
                            value={remarks}
                            onChange={e => setRemarks(e.target.value)}
                        />
                    </SectionBlock>

                    {/* ── Live Summary ── */}
                    {summary.total > 0 && (
                        <div className="bg-gray-50 dark:bg-[#2C2C2E] rounded-xl p-4 border border-gray-200 dark:border-[#38383A]">
                            <h4 className="text-xs font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wide mb-2">Preview Summary</h4>
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
                                <div>
                                    <div className="text-lg font-bold text-gray-900 dark:text-white">{summary.total}</div>
                                    <div className="text-[10px] text-gray-400 uppercase">Subjects</div>
                                </div>
                                <div>
                                    <div className="text-lg font-bold text-gray-900 dark:text-white">{summary.grandObtained}/{summary.grandTotal}</div>
                                    <div className="text-[10px] text-gray-400 uppercase">Marks</div>
                                </div>
                                <div>
                                    <div className="text-lg font-bold text-primary-600 dark:text-primary-400">{summary.percentage}%</div>
                                    <div className="text-[10px] text-gray-400 uppercase">Percentage</div>
                                </div>
                                <div>
                                    <div className={`text-lg font-bold ${summary.passCount === summary.total ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
                                        {summary.passCount}/{summary.total}
                                    </div>
                                    <div className="text-[10px] text-gray-400 uppercase">Passed</div>
                                </div>
                                <div>
                                    <div className={`text-lg font-bold ${summary.passCount === summary.total ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                        {summary.passCount === summary.total ? 'PASS' : 'FAIL'}
                                    </div>
                                    <div className="text-[10px] text-gray-400 uppercase">Result</div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Footer ── */}
                <div className="px-4 sm:px-6 py-4 border-t border-gray-100 dark:border-[#38383A] shrink-0 flex flex-col-reverse sm:flex-row justify-end gap-3 bg-gray-50 dark:bg-[#2C2C2E] rounded-b-2xl">
                    <button type="button" className="btn btn-ghost w-full sm:w-auto" onClick={onClose}>
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleGenerate}
                        disabled={generating}
                        className="btn btn-primary w-full sm:w-auto gap-2"
                    >
                        {generating ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Generating...
                            </>
                        ) : (
                            <>
                                <Download className="h-4 w-4" />
                                Generate & Download PDF
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

/* ── Helpers ── */
const SectionBlock = ({ icon, title, children }) => (
    <div>
        <div className="flex items-center gap-2 mb-3">
            <span className="text-primary-600 dark:text-primary-400">{icon}</span>
            <h4 className="text-sm font-semibold text-gray-700 dark:text-[#8E8E93] uppercase tracking-wide">{title}</h4>
        </div>
        <div className="pl-6 border-l-2 border-gray-100 dark:border-[#38383A]">
            {children}
        </div>
    </div>
);

const FieldError = ({ msg }) =>
    msg ? (
        <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" /> {msg}
        </p>
    ) : null;

export default CustomReportCardModal;
