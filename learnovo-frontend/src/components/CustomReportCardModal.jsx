import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    X, Plus, Trash2, Download, UserCheck, Edit3, GraduationCap,
    BookOpen, AlertCircle, Loader2, Search, Layers, FileText, MessageSquare, ChevronDown
} from 'lucide-react';
import { examsService } from '../services/examsService';
import { academicSessionsService } from '../services/academicsService';
import { studentsService } from '../services/studentsService';
import toast from 'react-hot-toast';
import Select from './ui/Select';

const EXAM_SERIES_OPTIONS = ['UT1', 'SA1', 'UT2', 'SA2', 'Custom'];

const EMPTY_SUBJECT = { name: '', totalMarks: 100, passingMarks: 33, marksObtained: '' };

const EMPTY_EXAM = { name: '', examSeries: 'Midterm' };

const REMARK_PRESETS = [
    'Excellent performance. Keep it up!',
    'Very good. Continue the hard work.',
    'Good performance. Can improve further.',
    'Satisfactory. Needs to work harder.',
    'Average performance. Requires more effort.',
    'Below average. Must focus on studies.',
    'Needs significant improvement.',
    'Consistent and dedicated student.',
    'Shows great potential. Keep striving.',
    'Well-disciplined and hardworking.',
];

const CustomReportCardModal = ({ onClose, students = [], classes = [], subjects: subjectsList = [] }) => {
    /* ── Mode: 'system' = pick student from DB, 'manual' = type everything ── */
    const [mode, setMode] = useState('system');

    /* ── Report type: 'single' = one exam, 'cumulative' = multiple exams ── */
    const [reportType, setReportType] = useState('single');

    /* ── Student selection (system mode) ── */
    const [selectedStudentId, setSelectedStudentId] = useState('');
    const [studentSearch, setStudentSearch] = useState('');

    /* ── Manual student fields ── */
    const [studentForm, setStudentForm] = useState({
        name: '', admissionNumber: '', class: '', section: '',
        rollNumber: '', dob: '', guardianName: '',
        fatherName: '', motherName: ''
    });

    /* ── Academic sessions ── */
    const [sessions, setSessions] = useState([]);
    const [selectedSessionId, setSelectedSessionId] = useState('');
    const [sessionsLoading, setSessionsLoading] = useState(true);

    useEffect(() => {
        academicSessionsService.list()
            .then(res => {
                const list = res?.data || res || [];
                setSessions(list);
                // Auto-select the active session
                const active = list.find(s => s.isActive);
                if (active) setSelectedSessionId(active._id);
            })
            .catch(() => { /* silent */ })
            .finally(() => setSessionsLoading(false));
    }, []);

    /* ── Derived session info ── */
    const selectedSession = useMemo(() => {
        if (!selectedSessionId) return null;
        return sessions.find(s => s._id === selectedSessionId) || null;
    }, [selectedSessionId, sessions]);

    /* ── Single exam info ── */
    const [examForm, setExamForm] = useState({
        name: '', examSeries: 'Midterm'
    });

    /* ── Cumulative exams ── */
    const [exams, setExams] = useState([{ ...EMPTY_EXAM, name: 'FA1', examSeries: 'FA1' }, { ...EMPTY_EXAM, name: 'SA1', examSeries: 'SA1' }]);

    /* ── Subjects with marks (single mode) ── */
    const [subjectRows, setSubjectRows] = useState([{ ...EMPTY_SUBJECT }]);

    /* ── Subjects with per-exam marks (cumulative mode) ── */
    const [cumulativeSubjects, setCumulativeSubjects] = useState([
        { name: '', totalMarksPerExam: 100, passingPercentage: 40, marks: {} }
    ]);

    /* ── Two-Term mode ── */
    const [term1Exams, setTerm1Exams] = useState([{ name: 'UT1', maxMarks: 40 }, { name: 'SA1', maxMarks: 60 }]);
    const [term2Exams, setTerm2Exams] = useState([{ name: 'UT2', maxMarks: 40 }, { name: 'SA2', maxMarks: 60 }]);
    const [twoTermSubjects, setTwoTermSubjects] = useState([{ name: '', passingPercentage: 33, marks: {} }]);
    const [coScholastic, setCoScholastic] = useState([
        { area: 'Work Education', term1Grade: '', term2Grade: '' },
        { area: 'Art Education', term1Grade: '', term2Grade: '' },
        { area: 'Health & Physical Education', term1Grade: '', term2Grade: '' },
        { area: 'Discipline', term1Grade: '', term2Grade: '' }
    ]);
    const [resultText, setResultText] = useState('Promoted');

    /* ── General ── */
    const [remarks, setRemarks] = useState('');
    const [generating, setGenerating] = useState(false);
    const [errors, setErrors] = useState({});

    /* ── Generated PDF preview ── */
    const [generatedPdf, setGeneratedPdf] = useState(null);

    /* ── History of generated report cards ── */
    const [history, setHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [deletingId, setDeletingId] = useState(null);
    const [historySearch, setHistorySearch] = useState('');

    const fetchHistory = useCallback(async () => {
        setHistoryLoading(true);
        try {
            const res = await examsService.getCustomReportCardHistory({ limit: 20 });
            setHistory(res.data || []);
        } catch { /* silent */ }
        finally { setHistoryLoading(false); }
    }, []);

    useEffect(() => { fetchHistory(); }, [fetchHistory]);

    /* ── Download helper ── */
    const downloadBlob = (blob, filename) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    };

    const handleDownloadGenerated = () => {
        if (!generatedPdf?.blob) return;
        downloadBlob(generatedPdf.blob, generatedPdf.filename || 'Custom_Report_Card.pdf');
        toast.success('Downloaded!');
    };

    const handleDownloadFromHistory = async (record) => {
        try {
            // Direct S3 URL download
            const a = document.createElement('a');
            a.href = record.pdfUrl;
            a.target = '_blank';
            a.download = `Report_Card_${(record.studentName || 'Student').replace(/\s+/g, '_')}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } catch {
            toast.error('Failed to download');
        }
    };

    const handleDeleteFromHistory = async (id) => {
        if (!window.confirm('Delete this report card permanently?')) return;
        setDeletingId(id);
        try {
            await examsService.deleteCustomReportCard(id);
            setHistory(prev => prev.filter(r => r._id !== id));
            toast.success('Report card deleted');
        } catch {
            toast.error('Failed to delete');
        } finally { setDeletingId(null); }
    };

    const handleEditFromHistory = async (record) => {
        try {
            const res = await examsService.getCustomReportCardPayload(record._id);
            const payload = res.data?.payloadSnapshot;
            if (!payload) { toast.error('No saved data to edit'); return; }

            // Restore form state from payload
            setGeneratedPdf(null);
            setReportType(payload.reportType || 'single');

            if (payload.student?.studentId) {
                setMode('system');
                setSelectedStudentId(payload.student.studentId);
            } else {
                setMode('manual');
                setStudentForm({
                    name: payload.student?.name || '',
                    admissionNumber: payload.student?.admissionNumber || '',
                    class: payload.student?.class || '',
                    section: payload.student?.section || '',
                    rollNumber: payload.student?.rollNumber || '',
                    dob: payload.student?.dob || '',
                    guardianName: payload.student?.guardianName || '',
                    fatherName: payload.student?.fatherName || '',
                    motherName: payload.student?.motherName || ''
                });
            }

            if (payload.reportType === 'single') {
                setExamForm({
                    name: payload.exam?.name || '',
                    examSeries: payload.exam?.examSeries || 'Midterm'
                });
                setSubjectRows((payload.subjects || []).map(s => ({
                    name: s.name || '',
                    totalMarks: s.totalMarks || 100,
                    passingMarks: s.passingMarks || 33,
                    marksObtained: s.marksObtained ?? ''
                })));
            } else if (payload.reportType === 'two-term') {
                setTerm1Exams(payload.term1?.exams || [{ name: 'UT1', maxMarks: 40 }, { name: 'SA1', maxMarks: 60 }]);
                setTerm2Exams(payload.term2?.exams || [{ name: 'UT2', maxMarks: 40 }, { name: 'SA2', maxMarks: 60 }]);
                setTwoTermSubjects((payload.subjects || []).map(s => ({
                    name: s.name || '',
                    passingPercentage: s.passingPercentage || 33,
                    marks: s.marks || {}
                })));
                setCoScholastic(payload.coScholastic || [
                    { area: 'Work Education', term1Grade: '', term2Grade: '' },
                    { area: 'Art Education', term1Grade: '', term2Grade: '' },
                    { area: 'Health & Physical Education', term1Grade: '', term2Grade: '' },
                    { area: 'Discipline', term1Grade: '', term2Grade: '' }
                ]);
                setResultText(payload.result || 'Promoted');
            } else {
                setExams((payload.exams || []).map(e => ({ name: e.name || '', examSeries: e.examSeries || 'Midterm' })));
                setCumulativeSubjects((payload.subjects || []).map(s => ({
                    name: s.name || '',
                    totalMarksPerExam: s.totalMarksPerExam || 100,
                    passingPercentage: s.passingPercentage || 40,
                    marks: s.marks || {}
                })));
            }

            setRemarks(payload.remarks || '');
            toast.success('Report card loaded for editing');
        } catch {
            toast.error('Failed to load report card data');
        }
    };

    /* ── Own student search (API-backed, works independently) ── */
    const [searchResults, setSearchResults] = useState([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const searchTimerRef = React.useRef(null);

    // Combine passed-in students + search results
    const allStudents = useMemo(() => {
        const map = new Map();
        students.forEach(s => map.set(s._id || s.id, s));
        searchResults.forEach(s => map.set(s._id || s.id, s));
        return Array.from(map.values());
    }, [students, searchResults]);

    // Debounced search — fetches from API when user types 2+ chars
    useEffect(() => {
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

        if (!studentSearch.trim() || studentSearch.trim().length < 2) {
            setSearchResults([]);
            return;
        }

        searchTimerRef.current = setTimeout(async () => {
            setSearchLoading(true);
            try {
                const res = await studentsService.list({ search: studentSearch.trim(), limit: 50 });
                setSearchResults(res?.data || res?.students || []);
            } catch { /* silent */ }
            finally { setSearchLoading(false); }
        }, 400);

        return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
    }, [studentSearch]);

    /* ── Filtered students for display ── */
    const filteredStudents = useMemo(() => {
        if (!studentSearch.trim()) return allStudents.slice(0, 50);
        const q = studentSearch.toLowerCase();
        return allStudents.filter(s =>
            (s.fullName || s.name || '').toLowerCase().includes(q)
            || (s.admissionNumber || '').toLowerCase().includes(q)
            || (s.rollNumber || '').toString().includes(q)
        ).slice(0, 50);
    }, [allStudents, studentSearch]);

    /* ── Selected student object ── */
    const selectedStudent = useMemo(() => {
        if (!selectedStudentId) return null;
        return allStudents.find(s => (s._id || s.id) === selectedStudentId) || null;
    }, [selectedStudentId, allStudents]);

    /* ── Subjects filtered by selected student's class ── */
    const filteredSubjectsList = useMemo(() => {
        if (mode === 'system' && selectedStudent?.class) {
            const cls = classes.find(c => c.grade === selectedStudent.class || c.name === selectedStudent.class);
            if (cls?.subjects?.length) {
                const classSubjectNames = new Set();
                const classSubjects = [];
                (cls.subjects || []).forEach(s => {
                    const sub = s.subject;
                    if (!sub) return;
                    const name = sub.name || sub.subjectCode || '';
                    if (name && !classSubjectNames.has(name)) {
                        classSubjectNames.add(name);
                        classSubjects.push(typeof sub === 'object' ? sub : { name: sub, isActive: true });
                    }
                });
                if (classSubjects.length > 0) return classSubjects;
            }
        }
        return subjectsList;
    }, [mode, selectedStudent, classes, subjectsList]);

    /* ── Single mode: Subject row handlers ── */
    const addSubjectRow = () => setSubjectRows(prev => [...prev, { ...EMPTY_SUBJECT }]);

    const removeSubjectRow = (idx) => {
        if (subjectRows.length <= 1) return;
        setSubjectRows(prev => prev.filter((_, i) => i !== idx));
    };

    const updateSubjectRow = (idx, field, value) => {
        setSubjectRows(prev => prev.map((row, i) => i === idx ? { ...row, [field]: value } : row));
    };

    /* ── Cumulative mode: Exam handlers ── */
    const addExam = () => setExams(prev => [...prev, { ...EMPTY_EXAM }]);

    const removeExam = (idx) => {
        if (exams.length <= 2) return;
        const removedName = exams[idx].name;
        setExams(prev => prev.filter((_, i) => i !== idx));
        // Remove marks for this exam from all subjects
        if (removedName) {
            setCumulativeSubjects(prev => prev.map(s => {
                const newMarks = { ...s.marks };
                delete newMarks[removedName];
                return { ...s, marks: newMarks };
            }));
        }
    };

    const updateExam = (idx, field, value) => {
        setExams(prev => {
            const oldName = prev[idx].name;
            const updated = prev.map((e, i) => i === idx ? { ...e, [field]: value } : e);
            // If name changed, migrate marks keys
            if (field === 'name' && oldName && oldName !== value) {
                setCumulativeSubjects(prevSubjects => prevSubjects.map(s => {
                    const newMarks = { ...s.marks };
                    if (oldName in newMarks) {
                        newMarks[value] = newMarks[oldName];
                        delete newMarks[oldName];
                    }
                    return { ...s, marks: newMarks };
                }));
            }
            return updated;
        });
    };

    /* ── Cumulative mode: Subject handlers ── */
    const addCumulativeSubject = () => setCumulativeSubjects(prev => [...prev, { name: '', totalMarksPerExam: 100, passingPercentage: 40, marks: {} }]);

    const removeCumulativeSubject = (idx) => {
        if (cumulativeSubjects.length <= 1) return;
        setCumulativeSubjects(prev => prev.filter((_, i) => i !== idx));
    };

    const updateCumulativeSubject = (idx, field, value) => {
        setCumulativeSubjects(prev => prev.map((row, i) => i === idx ? { ...row, [field]: value } : row));
    };

    const updateCumulativeMarks = (subIdx, examName, value) => {
        setCumulativeSubjects(prev => prev.map((row, i) => {
            if (i !== subIdx) return row;
            return { ...row, marks: { ...row.marks, [examName]: value } };
        }));
    };

    /* ── Populate subjects from system ── */
    const populateFromSystem = useCallback(() => {
        if (filteredSubjectsList.length === 0) {
            toast.error('No subjects found for this class');
            return;
        }
        const active = filteredSubjectsList.filter(s => s.isActive !== false);
        if (reportType === 'single') {
            setSubjectRows(active.map(s => ({
                name: s.name || s.subjectCode || '',
                totalMarks: 100,
                passingMarks: 33,
                marksObtained: ''
            })));
        } else if (reportType === 'two-term') {
            setTwoTermSubjects(active.map(s => ({
                name: s.name || s.subjectCode || '',
                passingPercentage: 33,
                marks: {}
            })));
        } else {
            setCumulativeSubjects(active.map(s => ({
                name: s.name || s.subjectCode || '',
                totalMarksPerExam: 100,
                passingPercentage: 40,
                marks: {}
            })));
        }
        toast.success(`${active.length} subjects loaded`);
    }, [filteredSubjectsList, reportType]);

    /* ── Summary calculation (single mode) ── */
    const singleSummary = useMemo(() => {
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

    /* ── Summary calculation (cumulative mode) ── */
    const cumulativeSummary = useMemo(() => {
        const validExams = exams.filter(e => e.name.trim());
        const validSubjects = cumulativeSubjects.filter(s => s.name.trim());
        if (!validExams.length || !validSubjects.length) return null;

        let grandTotalMax = 0;
        let grandTotalObtained = 0;
        let passCount = 0;

        const subjectDetails = validSubjects.map(sub => {
            let totalMax = 0;
            let totalObtained = 0;
            let examCount = 0;

            validExams.forEach(exam => {
                const marks = sub.marks[exam.name];
                if (marks !== '' && marks !== undefined && marks !== null) {
                    totalMax += Number(sub.totalMarksPerExam) || 0;
                    totalObtained += Number(marks) || 0;
                    examCount++;
                }
            });

            const avgPercentage = totalMax > 0 ? Math.round((totalObtained / totalMax) * 100 * 10) / 10 : 0;
            const isPassed = avgPercentage >= (Number(sub.passingPercentage) || 40);
            if (isPassed) passCount++;

            grandTotalMax += totalMax;
            grandTotalObtained += totalObtained;

            return { name: sub.name, totalMax, totalObtained, avgPercentage, isPassed, examCount };
        });

        const overallPercentage = grandTotalMax > 0 ? Math.round((grandTotalObtained / grandTotalMax) * 100 * 10) / 10 : 0;

        return {
            subjectDetails,
            grandTotalMax,
            grandTotalObtained,
            overallPercentage,
            passCount,
            totalSubjects: validSubjects.length,
            totalExams: validExams.length
        };
    }, [exams, cumulativeSubjects]);

    /* ── Validate ── */
    const validate = () => {
        const errs = {};

        if (mode === 'system' && !selectedStudentId) {
            errs.student = 'Please select a student';
        }
        if (mode === 'manual' && !studentForm.name.trim()) {
            errs.studentName = 'Student name is required';
        }

        if (reportType === 'single') {
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
        } else if (reportType === 'two-term') {
            // Two-term validation
            const allExams = [...term1Exams, ...term2Exams].filter(e => e.name.trim());
            if (allExams.length < 2) errs.exams = 'Add at least 1 exam per term';

            const examNames = allExams.map(e => e.name.trim().toLowerCase());
            if (new Set(examNames).size !== examNames.length) errs.exams = 'Exam names must be unique across both terms';

            const validSubs = twoTermSubjects.filter(s => s.name.trim());
            if (validSubs.length === 0) errs.twoTermSubjects = 'Add at least one subject';
        } else {
            // Cumulative validation
            const validExams = exams.filter(e => e.name.trim());
            if (validExams.length < 2) {
                errs.exams = 'Add at least 2 exams for cumulative report';
            }
            // Check for duplicate exam names
            const examNames = validExams.map(e => e.name.trim().toLowerCase());
            if (new Set(examNames).size !== examNames.length) {
                errs.exams = 'Exam names must be unique';
            }

            const validSubjects = cumulativeSubjects.filter(s => s.name.trim());
            if (validSubjects.length === 0) {
                errs.cumulativeSubjects = 'Add at least one subject';
            }

            for (let si = 0; si < cumulativeSubjects.length; si++) {
                const sub = cumulativeSubjects[si];
                if (!sub.name.trim()) continue;
                let hasAnyMarks = false;
                for (const exam of validExams) {
                    const m = sub.marks[exam.name];
                    if (m !== '' && m !== undefined && m !== null) {
                        hasAnyMarks = true;
                        if (Number(m) > Number(sub.totalMarksPerExam)) {
                            errs[`cum_${si}_${exam.name}`] = 'Exceeds max';
                        } else if (Number(m) < 0) {
                            errs[`cum_${si}_${exam.name}`] = 'Negative';
                        }
                    }
                }
                if (!hasAnyMarks) {
                    errs[`cum_${si}_nomarks`] = 'Enter marks for at least one exam';
                }
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

            let payload;

            if (reportType === 'single') {
                const filledSubjects = subjectRows
                    .filter(s => s.name.trim())
                    .map(s => ({
                        name: s.name,
                        totalMarks: Number(s.totalMarks) || 100,
                        passingMarks: Number(s.passingMarks) || 33,
                        marksObtained: Number(s.marksObtained) || 0,
                        remarks: s.remarks || ''
                    }));

                payload = {
                    reportType: 'single',
                    student: studentPayload,
                    exam: {
                        name: examForm.name,
                        examSeries: examForm.examSeries,
                        academicYear: selectedSession?.name || ''
                    },
                    subjects: filledSubjects,
                    remarks
                };
            } else if (reportType === 'two-term') {
                // Two-term payload
                const validT1 = term1Exams.filter(e => e.name.trim()).map(e => ({ name: e.name.trim(), maxMarks: Number(e.maxMarks) || 0 }));
                const validT2 = term2Exams.filter(e => e.name.trim()).map(e => ({ name: e.name.trim(), maxMarks: Number(e.maxMarks) || 0 }));
                const validSubs = twoTermSubjects.filter(s => s.name.trim()).map(s => ({
                    name: s.name.trim(),
                    passingPercentage: Number(s.passingPercentage) || 33,
                    marks: Object.fromEntries(
                        [...validT1, ...validT2].map(e => [e.name, s.marks[e.name] !== '' && s.marks[e.name] !== undefined ? Number(s.marks[e.name]) : null])
                    )
                }));

                const validCoSch = coScholastic.filter(c => c.area.trim() && (c.term1Grade || c.term2Grade));

                payload = {
                    reportType: 'two-term',
                    student: {
                        ...studentPayload,
                        fatherName: studentForm.fatherName || '',
                        motherName: studentForm.motherName || ''
                    },
                    term1: { exams: validT1 },
                    term2: { exams: validT2 },
                    subjects: validSubs,
                    coScholastic: validCoSch,
                    sessionName: selectedSession?.name || '',
                    remarks,
                    result: resultText
                };
            } else {
                // Cumulative payload
                const validExams = exams.filter(e => e.name.trim()).map(e => ({
                    name: e.name.trim(),
                    examSeries: e.examSeries
                }));

                const validSubjects = cumulativeSubjects
                    .filter(s => s.name.trim())
                    .map(s => ({
                        name: s.name.trim(),
                        totalMarksPerExam: Number(s.totalMarksPerExam) || 100,
                        passingPercentage: Number(s.passingPercentage) || 40,
                        marks: Object.fromEntries(
                            validExams.map(e => [e.name, s.marks[e.name] !== '' && s.marks[e.name] !== undefined ? Number(s.marks[e.name]) : null])
                        )
                    }));

                payload = {
                    reportType: 'cumulative',
                    student: studentPayload,
                    exams: validExams,
                    subjects: validSubjects,
                    academicYear: selectedSession?.name || '',
                    sessionName: selectedSession?.name || '',
                    remarks
                };
            }

            const result = await examsService.generateCustomReportCardPDF(payload);
            const data = result.data || result;

            // Build blob URL from base64 for preview
            const byteChars = atob(data.pdfBase64);
            const byteArray = new Uint8Array(byteChars.length);
            for (let i = 0; i < byteChars.length; i++) byteArray[i] = byteChars.charCodeAt(i);
            const blob = new Blob([byteArray], { type: 'application/pdf' });
            const blobUrl = window.URL.createObjectURL(blob);

            setGeneratedPdf({
                ...data,
                blobUrl,
                blob,
                filename: data.filename
            });

            // Refresh history
            fetchHistory();
            toast.success('Report card generated!');
        } catch (err) {
            let msg = 'Failed to generate custom report card';
            try {
                if (err?.response?.data?.message) {
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
            <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-2xl w-full max-w-4xl mx-2 sm:mx-4 max-h-[92vh] flex flex-col">

                {/* ── Header ── */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-[#38383A] shrink-0">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                            <Edit3 className="h-5 w-5 text-primary-500" />
                            Custom Report Card
                        </h3>
                        <p className="text-xs text-gray-400 dark:text-[#636366] mt-0.5">
                            Generate a single exam, cumulative, or two-term report card PDF
                        </p>
                    </div>
                    <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-[#2C2C2E] transition-colors" onClick={onClose}>
                        <X className="h-5 w-5 text-gray-500 dark:text-[#8E8E93]" />
                    </button>
                </div>

                {/* ── Scrollable body ── */}
                <div className="overflow-y-auto flex-1 px-4 sm:px-6 py-5 space-y-6">

                    {/* ── Report Type Toggle ── */}
                    <div>
                        <label className="text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wide mb-2 block">
                            Report Type
                        </label>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setReportType('single')}
                                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold border-2 transition-all ${
                                    reportType === 'single'
                                        ? 'bg-primary-50 dark:bg-primary-500/10 text-primary-700 dark:text-primary-400 border-primary-300 dark:border-primary-500/30'
                                        : 'bg-white dark:bg-[#2C2C2E] text-gray-500 dark:text-[#8E8E93] border-gray-200 dark:border-[#38383A] hover:border-gray-300'
                                }`}
                            >
                                <FileText className="h-4 w-4" />
                                Single Exam
                            </button>
                            <button
                                type="button"
                                onClick={() => setReportType('cumulative')}
                                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold border-2 transition-all ${
                                    reportType === 'cumulative'
                                        ? 'bg-primary-50 dark:bg-primary-500/10 text-primary-700 dark:text-primary-400 border-primary-300 dark:border-primary-500/30'
                                        : 'bg-white dark:bg-[#2C2C2E] text-gray-500 dark:text-[#8E8E93] border-gray-200 dark:border-[#38383A] hover:border-gray-300'
                                }`}
                            >
                                <Layers className="h-4 w-4" />
                                Cumulative (Multi-Exam)
                            </button>
                            <button
                                type="button"
                                onClick={() => setReportType('two-term')}
                                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold border-2 transition-all ${
                                    reportType === 'two-term'
                                        ? 'bg-primary-50 dark:bg-primary-500/10 text-primary-700 dark:text-primary-400 border-primary-300 dark:border-primary-500/30'
                                        : 'bg-white dark:bg-[#2C2C2E] text-gray-500 dark:text-[#8E8E93] border-gray-200 dark:border-[#38383A] hover:border-gray-300'
                                }`}
                            >
                                <Layers className="h-4 w-4" />
                                Two-Term
                            </button>
                        </div>
                    </div>

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
                                {searchLoading && (
                                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 animate-spin" />
                                )}
                            </div>
                            {!studentSearch.trim() && allStudents.length === 0 ? (
                                <p className="text-xs text-gray-400 dark:text-[#636366] italic py-2">
                                    Start typing to search students across all classes.
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
                                                    {s.class ? ` • Class ${s.class}` : ''}
                                                </span>
                                            </button>
                                        );
                                    })}
                                    {filteredStudents.length === 0 && !searchLoading && studentSearch.trim() && (
                                        <p className="text-xs text-gray-400 py-3 text-center">No students match "{studentSearch}"</p>
                                    )}
                                    {searchLoading && filteredStudents.length === 0 && (
                                        <p className="text-xs text-gray-400 py-3 text-center flex items-center justify-center gap-1.5">
                                            <Loader2 className="h-3 w-3 animate-spin" /> Searching...
                                        </p>
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
                                {reportType === 'two-term' && (
                                    <>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-500 dark:text-[#8E8E93] mb-1">Father's Name</label>
                                            <input type="text" className="input text-sm" value={studentForm.fatherName || ''} onChange={e => setStudentForm(prev => ({ ...prev, fatherName: e.target.value }))} placeholder="Father's Name" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-500 dark:text-[#8E8E93] mb-1">Mother's Name</label>
                                            <input type="text" className="input text-sm" value={studentForm.motherName || ''} onChange={e => setStudentForm(prev => ({ ...prev, motherName: e.target.value }))} placeholder="Mother's Name" />
                                        </div>
                                    </>
                                )}
                            </div>
                        </SectionBlock>
                    )}

                    {/* ═══════════════════════════════════════════════════════════
                        SINGLE EXAM MODE
                    ═══════════════════════════════════════════════════════════ */}
                    {reportType === 'single' && (
                        <>
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
                                        <label className="label mb-1 block text-gray-700 dark:text-[#8E8E93]">Academic Session</label>
                                        <Select
                                            value={selectedSessionId}
                                            onChange={e => setSelectedSessionId(e.target.value)}
                                            disabled={sessionsLoading}
                                            placeholder={sessionsLoading ? 'Loading...' : 'Select Session'}
                                            options={[
                                                { value: '', label: 'Select Session' },
                                                ...sessions.map(s => ({
                                                    value: s._id,
                                                    label: `${s.name}${s.isActive ? ' (Active)' : ''}`
                                                }))
                                            ]}
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
                                            <SubjectComboInput
                                                value={row.name}
                                                onChange={val => updateSubjectRow(idx, 'name', val)}
                                                subjectsList={filteredSubjectsList}
                                                placeholder="Select or type subject"
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
                        </>
                    )}

                    {/* ═══════════════════════════════════════════════════════════
                        CUMULATIVE (MULTI-EXAM) MODE
                    ═══════════════════════════════════════════════════════════ */}
                    {reportType === 'cumulative' && (
                        <>
                            {/* ── Academic Session ── */}
                            <SectionBlock icon={<GraduationCap className="h-4 w-4" />} title="Academic Session">
                                <div className="max-w-sm">
                                    <label className="label mb-1 block text-gray-700 dark:text-[#8E8E93]">Select Session</label>
                                    <Select
                                        value={selectedSessionId}
                                        onChange={e => setSelectedSessionId(e.target.value)}
                                        disabled={sessionsLoading}
                                        placeholder={sessionsLoading ? 'Loading...' : 'Select Session'}
                                        options={[
                                            { value: '', label: 'Select Session' },
                                            ...sessions.map(s => ({
                                                value: s._id,
                                                label: `${s.name}${s.isActive ? ' (Active)' : ''}`
                                            }))
                                        ]}
                                    />
                                    {selectedSession && (
                                        <p className="text-xs text-gray-400 dark:text-[#636366] mt-1.5">
                                            {selectedSession.startDate && selectedSession.endDate
                                                ? `${new Date(selectedSession.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} — ${new Date(selectedSession.endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`
                                                : ''
                                            }
                                            {selectedSession.isLocked ? ' (Locked)' : ''}
                                        </p>
                                    )}
                                </div>
                            </SectionBlock>

                            {/* ── Exams List ── */}
                            <SectionBlock icon={<Layers className="h-4 w-4" />} title="Exams">
                                <p className="text-xs text-gray-400 dark:text-[#636366] mb-3">
                                    Add all exam series to include in the cumulative report. Minimum 2 exams required.
                                </p>
                                {errors.exams && <FieldError msg={errors.exams} />}

                                <div className="space-y-2">
                                    {exams.map((exam, idx) => (
                                        <div key={idx} className="flex items-center gap-2">
                                            <input
                                                className="input text-sm flex-1"
                                                placeholder="Exam name (e.g. FA1)"
                                                value={exam.name}
                                                onChange={e => updateExam(idx, 'name', e.target.value)}
                                            />
                                            <div className="w-36">
                                                <Select
                                                    value={exam.examSeries}
                                                    onChange={e => updateExam(idx, 'examSeries', e.target.value)}
                                                    options={EXAM_SERIES_OPTIONS.map(s => ({ value: s, label: s }))}
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => removeExam(idx)}
                                                disabled={exams.length <= 2}
                                                className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                <button
                                    type="button"
                                    onClick={addExam}
                                    className="mt-3 flex items-center gap-1.5 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 font-medium transition-colors"
                                >
                                    <Plus className="h-4 w-4" /> Add Exam
                                </button>
                            </SectionBlock>

                            {/* ── Cumulative Marks Grid ── */}
                            <SectionBlock icon={<BookOpen className="h-4 w-4" />} title="Subjects & Marks">
                                <div className="flex items-center justify-between mb-3">
                                    <p className="text-xs text-gray-400 dark:text-[#636366]">
                                        {cumulativeSubjects.length} subject{cumulativeSubjects.length !== 1 ? 's' : ''} &middot; {exams.filter(e => e.name.trim()).length} exam{exams.filter(e => e.name.trim()).length !== 1 ? 's' : ''}
                                    </p>
                                    <button
                                        type="button"
                                        onClick={populateFromSystem}
                                        className="text-xs text-primary-600 dark:text-primary-400 hover:underline font-medium"
                                    >
                                        Load subjects from system
                                    </button>
                                </div>

                                {errors.cumulativeSubjects && <FieldError msg={errors.cumulativeSubjects} />}

                                {/* Scrollable marks grid */}
                                <div className="overflow-x-auto border border-gray-200 dark:border-[#38383A] rounded-xl">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="bg-gray-50 dark:bg-[#2C2C2E]">
                                                <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-gray-400 dark:text-[#636366] uppercase tracking-wide whitespace-nowrap min-w-[140px]">
                                                    Subject
                                                </th>
                                                <th className="text-center px-2 py-2.5 text-[10px] font-semibold text-gray-400 dark:text-[#636366] uppercase tracking-wide whitespace-nowrap w-16">
                                                    Max
                                                </th>
                                                {exams.filter(e => e.name.trim()).map((exam, i) => (
                                                    <th key={i} className="text-center px-2 py-2.5 text-[10px] font-semibold text-primary-600 dark:text-primary-400 uppercase tracking-wide whitespace-nowrap min-w-[70px]">
                                                        {exam.name}
                                                    </th>
                                                ))}
                                                <th className="text-center px-2 py-2.5 text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap w-16">
                                                    Total
                                                </th>
                                                <th className="text-center px-2 py-2.5 text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap w-14">
                                                    %
                                                </th>
                                                <th className="w-9"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-[#38383A]">
                                            {cumulativeSubjects.map((sub, si) => {
                                                const validExams = exams.filter(e => e.name.trim());
                                                let totalObt = 0;
                                                let totalMax = 0;
                                                validExams.forEach(e => {
                                                    const m = sub.marks[e.name];
                                                    if (m !== '' && m !== undefined && m !== null) {
                                                        totalObt += Number(m) || 0;
                                                        totalMax += Number(sub.totalMarksPerExam) || 0;
                                                    }
                                                });
                                                const pct = totalMax > 0 ? Math.round((totalObt / totalMax) * 100 * 10) / 10 : '';

                                                return (
                                                    <tr key={si} className="hover:bg-gray-50/50 dark:hover:bg-[#2C2C2E]/50">
                                                        <td className="px-2 py-1.5">
                                                            <SubjectComboInput
                                                                value={sub.name}
                                                                onChange={val => updateCumulativeSubject(si, 'name', val)}
                                                                subjectsList={filteredSubjectsList}
                                                                placeholder="Select or type"
                                                                className="min-w-[140px]"
                                                            />
                                                        </td>
                                                        <td className="px-1 py-1.5">
                                                            <input
                                                                type="number"
                                                                min="1"
                                                                className="input text-sm text-center w-full"
                                                                value={sub.totalMarksPerExam}
                                                                onChange={e => updateCumulativeSubject(si, 'totalMarksPerExam', e.target.value)}
                                                            />
                                                        </td>
                                                        {validExams.map((exam, ei) => (
                                                            <td key={ei} className="px-1 py-1.5">
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    className={`input text-sm text-center w-full min-w-[55px] ${errors[`cum_${si}_${exam.name}`] ? 'border-red-400' : ''}`}
                                                                    placeholder="-"
                                                                    value={sub.marks[exam.name] ?? ''}
                                                                    onChange={e => updateCumulativeMarks(si, exam.name, e.target.value)}
                                                                />
                                                            </td>
                                                        ))}
                                                        <td className="px-2 py-1.5 text-center font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                                            {totalMax > 0 ? `${totalObt}/${totalMax}` : '-'}
                                                        </td>
                                                        <td className={`px-2 py-1.5 text-center font-semibold whitespace-nowrap ${
                                                            pct !== '' && pct >= 40 ? 'text-green-600 dark:text-green-400' : pct !== '' ? 'text-red-500' : 'text-gray-400'
                                                        }`}>
                                                            {pct !== '' ? `${pct}%` : '-'}
                                                        </td>
                                                        <td className="px-1 py-1.5">
                                                            <button
                                                                type="button"
                                                                onClick={() => removeCumulativeSubject(si)}
                                                                disabled={cumulativeSubjects.length <= 1}
                                                                className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Per-subject errors */}
                                {cumulativeSubjects.map((_, si) => (
                                    errors[`cum_${si}_nomarks`] && (
                                        <p key={si} className="text-xs text-red-500 flex items-center gap-1 mt-1 pl-1">
                                            <AlertCircle className="h-3 w-3" /> Row {si + 1}: {errors[`cum_${si}_nomarks`]}
                                        </p>
                                    )
                                ))}

                                <button
                                    type="button"
                                    onClick={addCumulativeSubject}
                                    className="mt-3 flex items-center gap-1.5 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 font-medium transition-colors"
                                >
                                    <Plus className="h-4 w-4" /> Add Subject
                                </button>
                            </SectionBlock>
                        </>
                    )}

                    {/* ═══════════════════════════════════════════════════════════
                        TWO-TERM MODE
                    ═══════════════════════════════════════════════════════════ */}
                    {reportType === 'two-term' && (
                        <>
                            {/* ── Academic Session ── */}
                            <SectionBlock icon={<GraduationCap className="h-4 w-4" />} title="Academic Session">
                                <div className="max-w-sm">
                                    <label className="label mb-1 block text-gray-700 dark:text-[#8E8E93]">Select Session</label>
                                    <Select
                                        value={selectedSessionId}
                                        onChange={e => setSelectedSessionId(e.target.value)}
                                        disabled={sessionsLoading}
                                        placeholder={sessionsLoading ? 'Loading...' : 'Select Session'}
                                        options={[
                                            { value: '', label: 'Select Session' },
                                            ...sessions.map(s => ({
                                                value: s._id,
                                                label: `${s.name}${s.isActive ? ' (Active)' : ''}`
                                            }))
                                        ]}
                                    />
                                </div>
                            </SectionBlock>

                            {/* ── Term Configuration ── */}
                            <SectionBlock title="Term Configuration" icon={<Layers className="h-4 w-4" />}>
                                <div className="grid grid-cols-2 gap-4">
                                    {/* Term 1 */}
                                    <div className="p-3 bg-blue-50/50 dark:bg-blue-500/5 rounded-xl border border-blue-200/50 dark:border-blue-500/20">
                                        <h4 className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-2 uppercase tracking-wide">Term 1</h4>
                                        {term1Exams.map((exam, idx) => (
                                            <div key={idx} className="flex gap-2 mb-2 items-center">
                                                <input type="text" className="input text-sm flex-1" placeholder="Exam name" value={exam.name} onChange={e => setTerm1Exams(prev => prev.map((ex, i) => i === idx ? { ...ex, name: e.target.value } : ex))} />
                                                <input type="number" className="input text-sm w-20 text-center" placeholder="Max" value={exam.maxMarks} onChange={e => setTerm1Exams(prev => prev.map((ex, i) => i === idx ? { ...ex, maxMarks: e.target.value } : ex))} />
                                                {term1Exams.length > 1 && <button type="button" onClick={() => setTerm1Exams(prev => prev.filter((_, i) => i !== idx))} className="p-1 text-red-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>}
                                            </div>
                                        ))}
                                        <button type="button" onClick={() => setTerm1Exams(prev => [...prev, { name: '', maxMarks: 0 }])} className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1 mt-1"><Plus className="h-3 w-3" /> Add Exam</button>
                                    </div>
                                    {/* Term 2 */}
                                    <div className="p-3 bg-emerald-50/50 dark:bg-emerald-500/5 rounded-xl border border-emerald-200/50 dark:border-emerald-500/20">
                                        <h4 className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-2 uppercase tracking-wide">Term 2</h4>
                                        {term2Exams.map((exam, idx) => (
                                            <div key={idx} className="flex gap-2 mb-2 items-center">
                                                <input type="text" className="input text-sm flex-1" placeholder="Exam name" value={exam.name} onChange={e => setTerm2Exams(prev => prev.map((ex, i) => i === idx ? { ...ex, name: e.target.value } : ex))} />
                                                <input type="number" className="input text-sm w-20 text-center" placeholder="Max" value={exam.maxMarks} onChange={e => setTerm2Exams(prev => prev.map((ex, i) => i === idx ? { ...ex, maxMarks: e.target.value } : ex))} />
                                                {term2Exams.length > 1 && <button type="button" onClick={() => setTerm2Exams(prev => prev.filter((_, i) => i !== idx))} className="p-1 text-red-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>}
                                            </div>
                                        ))}
                                        <button type="button" onClick={() => setTerm2Exams(prev => [...prev, { name: '', maxMarks: 0 }])} className="text-xs text-emerald-500 hover:text-emerald-700 flex items-center gap-1 mt-1"><Plus className="h-3 w-3" /> Add Exam</button>
                                    </div>
                                </div>
                                {errors.exams && <p className="text-xs text-red-500 mt-2">{errors.exams}</p>}
                            </SectionBlock>

                            {/* ── Two-Term Subjects & Marks ── */}
                            <SectionBlock icon={<BookOpen className="h-4 w-4" />} title="Subjects & Marks">
                                <div className="flex items-center justify-between mb-3">
                                    <p className="text-xs text-gray-400 dark:text-[#636366]">
                                        {twoTermSubjects.length} subject{twoTermSubjects.length !== 1 ? 's' : ''}
                                    </p>
                                    <button type="button" onClick={populateFromSystem} className="text-xs text-primary-500 hover:text-primary-700 font-medium">Load subjects from system</button>
                                </div>
                                <div className="overflow-x-auto -mx-4 px-4">
                                    <table className="w-full text-sm border-collapse min-w-[600px]">
                                        <thead>
                                            <tr>
                                                <th className="text-left text-[10px] font-semibold text-gray-400 dark:text-[#636366] uppercase pb-1 px-1" rowSpan={2}>Subject</th>
                                                {term1Exams.filter(e => e.name.trim()).map((e, i) => <th key={`t1h-${i}`} className="text-center text-[10px] font-semibold text-blue-500 uppercase pb-1 px-1">{e.name}<br/><span className="text-[9px] text-gray-400">({e.maxMarks})</span></th>)}
                                                <th className="text-center text-[10px] font-semibold text-blue-600 uppercase pb-1 px-1">T1</th>
                                                {term2Exams.filter(e => e.name.trim()).map((e, i) => <th key={`t2h-${i}`} className="text-center text-[10px] font-semibold text-emerald-500 uppercase pb-1 px-1">{e.name}<br/><span className="text-[9px] text-gray-400">({e.maxMarks})</span></th>)}
                                                <th className="text-center text-[10px] font-semibold text-emerald-600 uppercase pb-1 px-1">T2</th>
                                                <th className="text-center text-[10px] font-semibold text-gray-500 uppercase pb-1 px-1 w-12"></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {twoTermSubjects.map((sub, si) => {
                                                const t1Exs = term1Exams.filter(e => e.name.trim());
                                                const t2Exs = term2Exams.filter(e => e.name.trim());
                                                const t1Total = t1Exs.reduce((a, e) => a + (Number(sub.marks[e.name]) || 0), 0);
                                                const t1Max = t1Exs.reduce((a, e) => a + (Number(e.maxMarks) || 0), 0);
                                                const t2Total = t2Exs.reduce((a, e) => a + (Number(sub.marks[e.name]) || 0), 0);
                                                const t2Max = t2Exs.reduce((a, e) => a + (Number(e.maxMarks) || 0), 0);
                                                return (
                                                    <tr key={si}>
                                                        <td className="px-1 py-1">
                                                            <SubjectComboInput
                                                                value={sub.name}
                                                                onChange={val => setTwoTermSubjects(prev => prev.map((s, i) => i === si ? { ...s, name: val } : s))}
                                                                subjectsList={filteredSubjectsList}
                                                                placeholder="Subject"
                                                                className="min-w-[120px]"
                                                            />
                                                        </td>
                                                        {t1Exs.map((e, ei) => (
                                                            <td key={`t1-${ei}`} className="px-1 py-1">
                                                                <input type="number" min="0" max={e.maxMarks} className="input text-sm text-center w-full" placeholder="-" value={sub.marks[e.name] ?? ''} onChange={ev => setTwoTermSubjects(prev => prev.map((s, i) => i === si ? { ...s, marks: { ...s.marks, [e.name]: ev.target.value } } : s))} />
                                                            </td>
                                                        ))}
                                                        <td className="px-1 py-1 text-center text-xs font-semibold text-blue-600">{t1Max > 0 ? `${t1Total}/${t1Max}` : '-'}</td>
                                                        {t2Exs.map((e, ei) => (
                                                            <td key={`t2-${ei}`} className="px-1 py-1">
                                                                <input type="number" min="0" max={e.maxMarks} className="input text-sm text-center w-full" placeholder="-" value={sub.marks[e.name] ?? ''} onChange={ev => setTwoTermSubjects(prev => prev.map((s, i) => i === si ? { ...s, marks: { ...s.marks, [e.name]: ev.target.value } } : s))} />
                                                            </td>
                                                        ))}
                                                        <td className="px-1 py-1 text-center text-xs font-semibold text-emerald-600">{t2Max > 0 ? `${t2Total}/${t2Max}` : '-'}</td>
                                                        <td className="px-1 py-1 text-center">
                                                            <button type="button" onClick={() => { if (twoTermSubjects.length > 1) setTwoTermSubjects(prev => prev.filter((_, i) => i !== si)); }} className="p-1 text-gray-300 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                <button type="button" onClick={() => setTwoTermSubjects(prev => [...prev, { name: '', passingPercentage: 33, marks: {} }])} className="mt-2 text-xs text-primary-500 hover:text-primary-700 font-medium flex items-center gap-1"><Plus className="h-3.5 w-3.5" /> Add Subject</button>
                                {errors.twoTermSubjects && <p className="text-xs text-red-500 mt-1">{errors.twoTermSubjects}</p>}
                            </SectionBlock>

                            {/* ── Co-Scholastic Areas ── */}
                            <SectionBlock title="Co-Scholastic Areas (Optional)" icon={<GraduationCap className="h-4 w-4" />}>
                                {coScholastic.map((item, idx) => (
                                    <div key={idx} className="grid grid-cols-[1fr_80px_80px] gap-2 mb-2 items-center">
                                        <input type="text" className="input text-sm" value={item.area} onChange={e => setCoScholastic(prev => prev.map((c, i) => i === idx ? { ...c, area: e.target.value } : c))} placeholder="Area name" />
                                        <select className="input text-sm text-center" value={item.term1Grade} onChange={e => setCoScholastic(prev => prev.map((c, i) => i === idx ? { ...c, term1Grade: e.target.value } : c))}>
                                            <option value="">T1</option>
                                            <option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option><option value="E">E</option>
                                        </select>
                                        <select className="input text-sm text-center" value={item.term2Grade} onChange={e => setCoScholastic(prev => prev.map((c, i) => i === idx ? { ...c, term2Grade: e.target.value } : c))}>
                                            <option value="">T2</option>
                                            <option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option><option value="E">E</option>
                                        </select>
                                    </div>
                                ))}
                            </SectionBlock>

                            {/* ── Result ── */}
                            <SectionBlock title="Result" icon={<GraduationCap className="h-4 w-4" />}>
                                <select className="input text-sm" value={resultText} onChange={e => setResultText(e.target.value)}>
                                    <option value="Promoted">Promoted</option>
                                    <option value="Not Promoted">Not Promoted</option>
                                    <option value="Detained">Detained</option>
                                </select>
                            </SectionBlock>
                        </>
                    )}

                    {/* ── Remarks ── */}
                    <SectionBlock icon={<MessageSquare className="h-4 w-4" />} title="Remarks (Optional)">
                        <div className="flex flex-wrap gap-1.5 mb-3">
                            {REMARK_PRESETS.map((preset, i) => {
                                const isActive = remarks === preset;
                                return (
                                    <button
                                        key={i}
                                        type="button"
                                        onClick={() => setRemarks(prev => prev === preset ? '' : preset)}
                                        className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-all ${
                                            isActive
                                                ? 'bg-primary-50 dark:bg-primary-500/10 text-primary-700 dark:text-primary-400 border-primary-300 dark:border-primary-500/30 ring-1 ring-primary-500/20'
                                                : 'bg-white dark:bg-[#2C2C2E] text-gray-500 dark:text-[#8E8E93] border-gray-200 dark:border-[#38383A] hover:border-gray-300 dark:hover:border-[#48484A] hover:text-gray-700 dark:hover:text-gray-300'
                                        }`}
                                    >
                                        {preset}
                                    </button>
                                );
                            })}
                        </div>
                        <textarea
                            className="input w-full resize-none"
                            rows={2}
                            placeholder="Type custom remarks or select from above..."
                            value={remarks}
                            onChange={e => setRemarks(e.target.value)}
                        />
                    </SectionBlock>

                    {/* ── Live Summary (Single Mode) ── */}
                    {reportType === 'single' && singleSummary.total > 0 && (
                        <div className="bg-gray-50 dark:bg-[#2C2C2E] rounded-xl p-4 border border-gray-200 dark:border-[#38383A]">
                            <h4 className="text-xs font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wide mb-2">Preview Summary</h4>
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
                                <div>
                                    <div className="text-lg font-bold text-gray-900 dark:text-white">{singleSummary.total}</div>
                                    <div className="text-[10px] text-gray-400 uppercase">Subjects</div>
                                </div>
                                <div>
                                    <div className="text-lg font-bold text-gray-900 dark:text-white">{singleSummary.grandObtained}/{singleSummary.grandTotal}</div>
                                    <div className="text-[10px] text-gray-400 uppercase">Marks</div>
                                </div>
                                <div>
                                    <div className="text-lg font-bold text-primary-600 dark:text-primary-400">{singleSummary.percentage}%</div>
                                    <div className="text-[10px] text-gray-400 uppercase">Percentage</div>
                                </div>
                                <div>
                                    <div className={`text-lg font-bold ${singleSummary.passCount === singleSummary.total ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
                                        {singleSummary.passCount}/{singleSummary.total}
                                    </div>
                                    <div className="text-[10px] text-gray-400 uppercase">Passed</div>
                                </div>
                                <div>
                                    <div className={`text-lg font-bold ${singleSummary.passCount === singleSummary.total ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                        {singleSummary.passCount === singleSummary.total ? 'PASS' : 'FAIL'}
                                    </div>
                                    <div className="text-[10px] text-gray-400 uppercase">Result</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── Live Summary (Cumulative Mode) ── */}
                    {reportType === 'cumulative' && cumulativeSummary && (
                        <div className="bg-gray-50 dark:bg-[#2C2C2E] rounded-xl p-4 border border-gray-200 dark:border-[#38383A]">
                            <h4 className="text-xs font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wide mb-2">
                                Cumulative Summary
                            </h4>
                            <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 text-center">
                                <div>
                                    <div className="text-lg font-bold text-gray-900 dark:text-white">{cumulativeSummary.totalExams}</div>
                                    <div className="text-[10px] text-gray-400 uppercase">Exams</div>
                                </div>
                                <div>
                                    <div className="text-lg font-bold text-gray-900 dark:text-white">{cumulativeSummary.totalSubjects}</div>
                                    <div className="text-[10px] text-gray-400 uppercase">Subjects</div>
                                </div>
                                <div>
                                    <div className="text-lg font-bold text-gray-900 dark:text-white">
                                        {cumulativeSummary.grandTotalObtained}/{cumulativeSummary.grandTotalMax}
                                    </div>
                                    <div className="text-[10px] text-gray-400 uppercase">Total Marks</div>
                                </div>
                                <div>
                                    <div className="text-lg font-bold text-primary-600 dark:text-primary-400">{cumulativeSummary.overallPercentage}%</div>
                                    <div className="text-[10px] text-gray-400 uppercase">Overall %</div>
                                </div>
                                <div>
                                    <div className={`text-lg font-bold ${cumulativeSummary.passCount === cumulativeSummary.totalSubjects ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
                                        {cumulativeSummary.passCount}/{cumulativeSummary.totalSubjects}
                                    </div>
                                    <div className="text-[10px] text-gray-400 uppercase">Passed</div>
                                </div>
                                <div>
                                    <div className={`text-lg font-bold ${cumulativeSummary.passCount === cumulativeSummary.totalSubjects ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                        {cumulativeSummary.passCount === cumulativeSummary.totalSubjects ? 'PASS' : 'FAIL'}
                                    </div>
                                    <div className="text-[10px] text-gray-400 uppercase">Result</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ═══════════════════════════════════════════════════════════
                        GENERATED PDF PREVIEW
                    ═══════════════════════════════════════════════════════════ */}
                    {generatedPdf && (
                        <div className="border-2 border-green-200 dark:border-green-500/20 rounded-2xl overflow-hidden">
                            <div className="bg-green-50 dark:bg-green-500/5 px-5 py-3 flex items-center justify-between border-b border-green-200 dark:border-green-500/20">
                                <div className="flex items-center gap-2">
                                    <FileText className="h-4 w-4 text-green-600 dark:text-green-400" />
                                    <h4 className="text-sm font-semibold text-green-700 dark:text-green-400">Generated Report Card</h4>
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                        generatedPdf.result === 'PASS'
                                            ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400'
                                            : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'
                                    }`}>{generatedPdf.result}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setGeneratedPdf(null)}
                                        className="text-xs text-gray-500 dark:text-[#8E8E93] hover:text-gray-700 dark:hover:text-white font-medium"
                                    >
                                        Edit & Regenerate
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleDownloadGenerated}
                                        className="btn btn-sm gap-1.5 bg-green-600 text-white hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600"
                                    >
                                        <Download className="h-3.5 w-3.5" />
                                        Download PDF
                                    </button>
                                </div>
                            </div>
                            {/* Summary bar */}
                            <div className="px-5 py-3 bg-white dark:bg-[#1C1C1E] border-b border-gray-100 dark:border-[#38383A]">
                                <div className="flex flex-wrap items-center gap-4 text-xs">
                                    <span className="text-gray-500 dark:text-[#8E8E93]">Student: <strong className="text-gray-900 dark:text-white">{generatedPdf.studentName}</strong></span>
                                    {generatedPdf.studentClass && <span className="text-gray-500 dark:text-[#8E8E93]">Class: <strong className="text-gray-900 dark:text-white">{generatedPdf.studentClass}{generatedPdf.studentSection ? ` - ${generatedPdf.studentSection}` : ''}</strong></span>}
                                    <span className="text-gray-500 dark:text-[#8E8E93]">{generatedPdf.examInfo}</span>
                                    <span className="text-primary-600 dark:text-primary-400 font-semibold">{generatedPdf.overallPercentage}% &middot; Grade {generatedPdf.overallGrade}</span>
                                </div>
                            </div>
                            {/* PDF embed */}
                            <div className="bg-gray-100 dark:bg-[#000000]">
                                <iframe
                                    src={generatedPdf.blobUrl}
                                    className="w-full border-0"
                                    style={{ height: '500px' }}
                                    title="Report Card Preview"
                                />
                            </div>
                        </div>
                    )}

                    {/* ═══════════════════════════════════════════════════════════
                        GENERATED REPORT CARDS HISTORY
                    ═══════════════════════════════════════════════════════════ */}
                    {history.length > 0 && (() => {
                        const q = historySearch.toLowerCase().trim();
                        const filtered = q
                            ? history.filter(r =>
                                (r.studentName || '').toLowerCase().includes(q)
                                || (r.studentClass || '').toLowerCase().includes(q)
                                || (r.examInfo || '').toLowerCase().includes(q)
                                || (r.overallGrade || '').toLowerCase().includes(q)
                            )
                            : history;
                        return (
                        <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass border border-gray-100 dark:border-[#38383A] overflow-hidden">
                            <div className="px-4 py-3 border-b border-gray-100 dark:border-[#38383A]">
                                <div className="flex items-center justify-between mb-2.5">
                                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                        <Layers className="h-4 w-4 text-primary-500" />
                                        Generated Report Cards
                                        <span className="text-[10px] text-gray-400 dark:text-[#636366] bg-gray-100 dark:bg-[#2C2C2E] px-2 py-0.5 rounded-full font-medium">{history.length}</span>
                                    </h4>
                                </div>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-[#636366] pointer-events-none" />
                                    <input
                                        type="text"
                                        className="input w-full pl-9 pr-8"
                                        placeholder="Search by student name, class, exam..."
                                        value={historySearch}
                                        onChange={e => setHistorySearch(e.target.value)}
                                    />
                                    {historySearch && (
                                        <button className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-gray-100 dark:hover:bg-[#38383A]" onClick={() => setHistorySearch('')}>
                                            <X className="h-3.5 w-3.5 text-gray-400 dark:text-[#636366]" />
                                        </button>
                                    )}
                                </div>
                            </div>
                            {filtered.length === 0 ? (
                                <div className="flex flex-col items-center py-8 text-gray-400 dark:text-[#636366]">
                                    <Search className="h-6 w-6 mb-2 opacity-30" />
                                    <p className="text-xs">No report cards match "{historySearch}"</p>
                                </div>
                            ) : (
                            <div className="divide-y divide-gray-50 dark:divide-[#38383A] max-h-64 overflow-y-auto">
                                {filtered.map(record => {
                                    const grade = calcGrade(record.overallPercentage || 0);
                                    return (
                                        <div key={record._id} className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-primary-50/40 dark:hover:bg-primary-500/5 transition-colors">
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-medium text-sm text-gray-900 dark:text-white truncate">{record.studentName}</span>
                                                    {record.studentClass && (
                                                        <span className="text-[10px] text-gray-400 dark:text-[#636366] bg-gray-100 dark:bg-[#2C2C2E] px-1.5 py-0.5 rounded">
                                                            {record.studentClass}{record.studentSection ? `-${record.studentSection}` : ''}
                                                        </span>
                                                    )}
                                                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                                                        record.reportType === 'cumulative'
                                                            ? 'bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400'
                                                            : record.reportType === 'two-term'
                                                            ? 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400'
                                                            : 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400'
                                                    }`}>{record.reportType === 'cumulative' ? 'Cumulative' : record.reportType === 'two-term' ? 'Two-Term' : 'Single'}</span>
                                                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                                                        record.result === 'PASS'
                                                            ? 'bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400'
                                                            : 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400'
                                                    }`}>{record.result}</span>
                                                </div>
                                                <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-400 dark:text-[#636366]">
                                                    <span>{record.examInfo}</span>
                                                    <span className={`font-semibold ${grade.color}`}>{record.overallPercentage}% &middot; {record.overallGrade}</span>
                                                    <span>{new Date(record.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={() => handleDownloadFromHistory(record)}
                                                    className="p-1.5 rounded-lg text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-500/10 transition-colors"
                                                    title="Download PDF"
                                                >
                                                    <Download className="h-3.5 w-3.5" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleEditFromHistory(record)}
                                                    className="p-1.5 rounded-lg text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors"
                                                    title="Edit & Regenerate"
                                                >
                                                    <Edit3 className="h-3.5 w-3.5" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteFromHistory(record._id)}
                                                    disabled={deletingId === record._id}
                                                    className="p-1.5 rounded-lg text-gray-400 dark:text-[#636366] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-50"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            )}
                            {historyLoading && (
                                <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 text-gray-400 animate-spin" /></div>
                            )}
                        </div>
                        );
                    })()}
                </div>

                {/* ── Footer ── */}
                <div className="px-4 sm:px-6 py-4 border-t border-gray-100 dark:border-[#38383A] shrink-0 flex flex-col-reverse sm:flex-row justify-end gap-3 bg-gray-50 dark:bg-[#2C2C2E] rounded-b-2xl">
                    <button type="button" className="btn btn-ghost w-full sm:w-auto" onClick={onClose}>
                        {generatedPdf ? 'Close' : 'Cancel'}
                    </button>
                    {generatedPdf ? (
                        <>
                            <button
                                type="button"
                                onClick={() => setGeneratedPdf(null)}
                                className="btn w-full sm:w-auto gap-2 bg-white dark:bg-[#2C2C2E] text-gray-700 dark:text-[#8E8E93] hover:bg-gray-50 dark:hover:bg-[#38383A] border border-gray-200 dark:border-[#38383A]"
                            >
                                <Edit3 className="h-4 w-4" />
                                Edit & Regenerate
                            </button>
                            <button
                                type="button"
                                onClick={handleDownloadGenerated}
                                className="btn btn-primary w-full sm:w-auto gap-2"
                            >
                                <Download className="h-4 w-4" />
                                Download PDF
                            </button>
                        </>
                    ) : (
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
                                    Generate Report Card
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

/* ── Subject combo input — dropdown + free type ── */
const SubjectComboInput = ({ value, onChange, subjectsList = [], placeholder = 'Select or type subject', className = '' }) => {
    const [open, setOpen] = useState(false);
    const [filter, setFilter] = useState('');
    const wrapperRef = React.useRef(null);

    const activeSubjects = useMemo(() =>
        subjectsList.filter(s => s.isActive !== false).map(s => s.name || s.subjectCode || '').filter(Boolean),
    [subjectsList]);

    const filtered = useMemo(() => {
        if (!filter.trim()) return activeSubjects;
        const q = filter.toLowerCase();
        return activeSubjects.filter(n => n.toLowerCase().includes(q));
    }, [activeSubjects, filter]);

    // Close on outside click
    React.useEffect(() => {
        const handler = (e) => { if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleInputChange = (e) => {
        const val = e.target.value;
        onChange(val);
        setFilter(val);
        if (!open && val) setOpen(true);
    };

    const handleSelect = (name) => {
        onChange(name);
        setFilter('');
        setOpen(false);
    };

    return (
        <div ref={wrapperRef} className={`relative ${className}`}>
            <div className="flex">
                <input
                    type="text"
                    className="input text-sm flex-1 rounded-r-none border-r-0"
                    placeholder={placeholder}
                    value={value}
                    onChange={handleInputChange}
                    onFocus={() => { if (activeSubjects.length > 0) setOpen(true); }}
                />
                <button
                    type="button"
                    onClick={() => setOpen(!open)}
                    className="px-2 border border-gray-200 dark:border-[#38383A] border-l-0 rounded-r-xl bg-gray-50 dark:bg-[#2C2C2E] hover:bg-gray-100 dark:hover:bg-[#38383A] transition-colors"
                    tabIndex={-1}
                >
                    <ChevronDown className={`h-3.5 w-3.5 text-gray-400 dark:text-[#636366] transition-transform ${open ? 'rotate-180' : ''}`} />
                </button>
            </div>
            {open && activeSubjects.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white dark:bg-[#2C2C2E] border border-gray-200 dark:border-[#38383A] rounded-xl shadow-lg max-h-36 overflow-y-auto">
                    {filtered.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-gray-400 dark:text-[#636366] italic">No subjects match — type to add custom</p>
                    ) : filtered.map((name, i) => (
                        <button
                            key={i}
                            type="button"
                            onClick={() => handleSelect(name)}
                            className={`w-full text-left px-3 py-2 text-sm transition-colors border-b last:border-b-0 border-gray-50 dark:border-[#38383A] ${
                                value === name
                                    ? 'bg-primary-50 dark:bg-primary-500/10 text-primary-700 dark:text-primary-400 font-medium'
                                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#38383A]'
                            }`}
                        >
                            {name}
                        </button>
                    ))}
                </div>
            )}
        </div>
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

/* ── Grade helper (used by history cards) ── */
function calcGrade(pct) {
    if (pct >= 90) return { label: 'A+', color: 'text-emerald-600 dark:text-emerald-400' };
    if (pct >= 80) return { label: 'A', color: 'text-green-600 dark:text-green-400' };
    if (pct >= 70) return { label: 'B', color: 'text-teal-600 dark:text-teal-400' };
    if (pct >= 60) return { label: 'C', color: 'text-blue-600 dark:text-blue-400' };
    if (pct >= 50) return { label: 'D', color: 'text-amber-600 dark:text-amber-400' };
    return { label: 'F', color: 'text-red-600 dark:text-red-400' };
}

export default CustomReportCardModal;
