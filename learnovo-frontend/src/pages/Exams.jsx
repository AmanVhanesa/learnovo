import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Plus, Search, Calendar, Trash2, X, ClipboardList, Edit,
    Clock, BookOpen, User, MapPin, ChevronDown, ChevronRight, AlertCircle, CheckCircle2, FileText,
    Award, BarChart3, TrendingUp, Download
} from 'lucide-react';
import { examsService } from '../services/examsService';
import { classesService } from '../services/classesService';
import { teachersService } from '../services/teachersService';
import ExamResultsModal from '../components/ExamResultsModal';
import ResultCard from '../components/ResultCard';
import BulkDownloadProgress from '../components/BulkDownloadProgress';
import toast from 'react-hot-toast';
import { formatDate } from '../utils/formatDate';
import { useAuth } from '../contexts/AuthContext';
import Select from '../components/ui/Select';
import DatePicker from '../components/ui/DatePicker';
import TimePicker from '../components/ui/TimePicker';

const STATUS_COLORS = {
    Scheduled: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
    Ongoing: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
    Completed: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400',
    Cancelled: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400',
};

const EXAM_SERIES = ['Unit Test', 'Midterm', 'Final', 'Custom'];
const EXAM_TYPES = ['Written', 'Practical', 'Oral'];
const EXAM_MODES = ['Offline', 'Online'];
const EXAM_STATUSES = ['Scheduled', 'Ongoing', 'Completed', 'Cancelled'];

const EMPTY_FORM = {
    name: '',
    examSeries: 'Midterm',
    class: '',
    classId: '',
    section: '',
    subject: '',
    date: '',
    startTime: '',
    endTime: '',
    totalMarks: 100,
    passingMarks: 40,
    examType: 'Written',
    examMode: 'Offline',
    supervisor: '',
    examRoom: '',
    status: 'Scheduled',
};

/* ── Auto-calculate duration from HH:MM strings ── */
function calcDuration(start, end) {
    if (!start || !end) return '';
    const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    const diff = toMin(end) - toMin(start);
    if (diff <= 0) return '';
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    return h > 0 ? `${h}h ${m > 0 ? m + 'min' : ''}`.trim() : `${m} min`;
}

const Exams = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    /* ── Modal / selection state ── */
    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedExam, setSelectedExam] = useState(null);
    const [editing, setEditing] = useState(null); // exam being edited
    const [resultCardTarget, setResultCardTarget] = useState(null); // { student, examSeries }
    const [form, setForm] = useState(EMPTY_FORM);
    const [formErrors, setFormErrors] = useState({});

    /* ── Filter state ── */
    const [filterStatus, setFilterStatus] = useState('');
    const [filterClass, setFilterClass] = useState('');
    const [searchText, setSearchText] = useState('');
    const [examSeriesFilter, setExamSeriesFilter] = useState('');

    /* ── Bulk download state ── */
    const [bulkJob, setBulkJob] = useState(null); // { jobId, totalStudents }

    /* ── Accordion collapse state: Set of "class" keys that are collapsed ── */
    const [collapsedClasses, setCollapsedClasses] = useState(new Set());
    const [collapsedSections, setCollapsedSections] = useState(new Set());

    const toggleClass = (cls) => setCollapsedClasses(prev => {
        const next = new Set(prev);
        next.has(cls) ? next.delete(cls) : next.add(cls);
        return next;
    });
    const toggleSection = (key) => setCollapsedSections(prev => {
        const next = new Set(prev);
        next.has(key) ? next.delete(key) : next.add(key);
        return next;
    });

    /* ── Bulk download helpers ── */
    const findSectionId = (className, sectionName) => {
        const cls = availableClasses.find(c => c.name === className || c.grade === className);
        if (!cls?.sections) return null;
        const sec = cls.sections.find(s => s.name === sectionName);
        return sec?._id || null;
    };

    const handleBulkDownload = async (className, sectionName, type = 'regular') => {
        const sectionId = findSectionId(className, sectionName);
        if (!sectionId) {
            toast.error('Could not find section. Please try again.');
            return;
        }
        try {
            const res = await examsService.startBulkDownload(sectionId, { className, type });
            setBulkJob({ jobId: res.data.jobId, totalStudents: res.data.totalStudents });
            toast.success(`Generating ${type === 'blank' ? 'blank ' : ''}report cards for ${res.data.totalStudents} students...`);
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Failed to start bulk download');
        }
    };

    /* ── Data fetching with React Query ── */
    const { data: exams = [], isLoading: loading } = useQuery({
        queryKey: ['exams'],
        queryFn: async () => {
            const res = await examsService.list();
            return res.data || [];
        },
    });

    const { data: availableClasses = [] } = useQuery({
        queryKey: ['exams-classes'],
        queryFn: async () => {
            const res = await classesService.list();
            return res.data || [];
        },
    });

    const { data: teachers = [] } = useQuery({
        queryKey: ['exams-teachers'],
        queryFn: async () => {
            const res = await teachersService.list({ limit: 100 });
            return res.data || res.teachers || [];
        },
    });

    /* ── Student's own result card data ── */
    const isStudent = user.role === 'student';
    const { data: myResultData, isLoading: loadingMyResults } = useQuery({
        queryKey: ['my-results', user._id || user.id, examSeriesFilter],
        queryFn: async () => {
            const res = await examsService.getResultCard(user._id || user.id, examSeriesFilter ? { examSeries: examSeriesFilter } : undefined);
            const d = res.data || res;
            return {
                subjects: d?.subjects || [],
                summary: d?.summary || null,
                student: d?.student || null,
            };
        },
        enabled: isStudent,
        staleTime: 5 * 60 * 1000,
    });

    /* ── Mutations ── */
    const saveMutation = useMutation({
        mutationFn: async ({ isEdit, id, data }) => {
            if (isEdit) {
                return examsService.update(id, data);
            }
            return examsService.create(data);
        },
        onSuccess: (_, variables) => {
            toast.success(variables.isEdit ? 'Exam updated successfully' : 'Exam scheduled successfully');
            closeModal();
            queryClient.invalidateQueries({ queryKey: ['exams'] });
        },
        onError: (err, variables) => {
            const msg = err?.response?.data?.message || (variables.isEdit ? 'Failed to update exam' : 'Failed to create exam');
            toast.error(msg);
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => examsService.delete(id),
        onSuccess: () => {
            toast.success('Exam deleted');
            queryClient.invalidateQueries({ queryKey: ['exams'] });
        },
        onError: () => {
            toast.error('Failed to delete exam');
        },
    });

    /* ── Derive sections from the selected class (no extra API call) ── */
    const sections = useMemo(() => {
        if (!form.classId) return [];
        const cls = availableClasses.find(c => c._id === form.classId);
        return cls?.sections || [];
    }, [form.classId, availableClasses]);

    /* ── Derived: filtered exam list ── */
    const filteredExams = useMemo(() => exams.filter(e => {
        if (filterStatus && e.status !== filterStatus) return false;
        if (filterClass && e.class !== filterClass) return false;
        if (searchText) {
            const q = searchText.toLowerCase();
            return (e.name || '').toLowerCase().includes(q) ||
                (e.subject || '').toLowerCase().includes(q);
        }
        return true;
    }), [exams, filterStatus, filterClass, searchText]);

    /* ── Group filtered exams: { class → { section → exam[] } } ── */
    const groupedExams = useMemo(() => {
        const map = {};
        filteredExams.forEach(e => {
            const cls = e.class || 'Unknown';
            const sec = e.section || 'All';
            if (!map[cls]) map[cls] = {};
            if (!map[cls][sec]) map[cls][sec] = [];
            map[cls][sec].push(e);
        });
        // Sort classes numerically/alphabetically, sections alphabetically
        const sorted = {};
        Object.keys(map).sort((a, b) => {
            const na = Number(a), nb = Number(b);
            if (!isNaN(na) && !isNaN(nb)) return na - nb;
            return a.localeCompare(b);
        }).forEach(cls => {
            sorted[cls] = {};
            Object.keys(map[cls]).sort().forEach(sec => {
                sorted[cls][sec] = map[cls][sec].sort((a, b) => new Date(b.date) - new Date(a.date));
            });
        });
        return sorted;
    }, [filteredExams]);

    /* ── Field change handler ── */
    const handleField = (key, value) => {
        setForm(prev => {
            const next = { ...prev, [key]: value };
            // If class changes, update classId and reset section
            if (key === 'class') {
                const cls = availableClasses.find(c => c.grade === value);
                next.classId = cls ? cls._id : '';
                next.section = '';
            }
            return next;
        });
        // Clear related error
        setFormErrors(prev => { const n = { ...prev }; delete n[key]; return n; });
    };

    /* ── Validate form ── */
    const validate = () => {
        const errors = {};
        if (!form.name.trim()) errors.name = 'Exam name is required';
        if (!form.class) errors.class = 'Class is required';
        if (!form.subject.trim()) errors.subject = 'Subject is required';
        if (!form.date) errors.date = 'Exam date is required';
        if (!form.totalMarks) errors.totalMarks = 'Total marks is required';
        else if (Number(form.totalMarks) > 100) errors.totalMarks = 'Total marks cannot exceed 100';
        if (form.passingMarks !== '' && Number(form.passingMarks) >= Number(form.totalMarks)) {
            errors.passingMarks = 'Passing marks must be less than total marks';
        }
        if (form.startTime && form.endTime) {
            const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
            if (toMin(form.endTime) <= toMin(form.startTime)) {
                errors.endTime = 'End time must be after start time';
            }
        }
        return errors;
    };

    /* ── Open edit modal ── */
    const openEdit = (exam) => {
        setEditing(exam);
        setForm({
            name: exam.name || '',
            examSeries: exam.examSeries || 'Midterm',
            class: exam.class || '',
            classId: exam.classId || '',
            section: exam.section || '',
            subject: exam.subject || '',
            date: exam.date ? exam.date.split('T')[0] : '',
            startTime: exam.startTime || '',
            endTime: exam.endTime || '',
            totalMarks: exam.totalMarks || 100,
            passingMarks: exam.passingMarks ?? 40,
            examType: exam.examType || 'Written',
            examMode: exam.examMode || 'Offline',
            supervisor: exam.supervisor?._id || exam.supervisor || '',
            examRoom: exam.examRoom || '',
            status: exam.status || 'Scheduled',
        });
        // Resolve classId from grade if not set
        if (!exam.classId && exam.class) {
            const cls = availableClasses.find(c => c.grade === exam.class);
            if (cls) setForm(prev => ({ ...prev, classId: cls._id }));
        }
        setShowAddModal(true);
    };

    /* ── Submit handler (create or edit) ── */
    const handleCreate = async (e) => {
        if (e) e.preventDefault();
        const errors = validate();
        if (Object.keys(errors).length) { setFormErrors(errors); return; }

        saveMutation.mutate({
            isEdit: !!editing,
            id: editing?._id,
            data: form
        });
    };

    const submitting = saveMutation.isPending;

    /* ── Delete handler ── */
    const handleDelete = async (id) => {
        if (!window.confirm('Delete this exam and all its results?')) return;
        deleteMutation.mutate(id);
    };

    /* ── Close / reset modal ── */
    const closeModal = () => {
        setShowAddModal(false);
        setEditing(null);
        setForm(EMPTY_FORM);
        setFormErrors({});
    };

    /* ── Render ── */

    /* ═══════════════════════════════════════════
       STUDENT VIEW — dedicated results dashboard
    ═══════════════════════════════════════════ */
    if (isStudent) {
        const mySubjects = myResultData?.subjects || [];
        const mySummary = myResultData?.summary || null;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const { upcomingExams, pastExams } = (() => {
            const upcoming = [];
            const past = [];
            exams.forEach(exam => {
                const examDate = new Date(exam.date);
                examDate.setHours(0, 0, 0, 0);
                if (examDate >= today) {
                    upcoming.push(exam);
                } else {
                    past.push(exam);
                }
            });
            upcoming.sort((a, b) => new Date(a.date) - new Date(b.date));
            past.sort((a, b) => new Date(b.date) - new Date(a.date));
            return { upcomingExams: upcoming, pastExams: past };
        })();

        const renderScheduleTable = (examList) => (
            <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[600px]">
                    <thead>
                        <tr className="bg-gray-50 dark:bg-[#2C2C2E] border-b border-gray-100 dark:border-[#38383A]">
                            <th className="px-5 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase">Date</th>
                            <th className="px-5 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase">Exam</th>
                            <th className="px-5 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase">Subject</th>
                            <th className="px-5 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase">Time</th>
                            <th className="px-5 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase">Venue</th>
                            <th className="px-5 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {examList.map((exam, idx) => (
                            <tr key={exam._id} className={`border-b border-gray-50 dark:border-[#38383A] ${idx % 2 === 0 ? '' : 'bg-gray-50/30 dark:bg-[#2C2C2E]/30'}`}>
                                <td className="px-5 py-3 text-gray-700 dark:text-[#8E8E93]">
                                    <div className="flex items-center gap-1.5">
                                        <Calendar className="h-3.5 w-3.5 text-gray-400 dark:text-[#636366]" />
                                        {formatDate(exam.date)}
                                    </div>
                                </td>
                                <td className="px-5 py-3">
                                    <div className="font-medium text-gray-900 dark:text-white">{exam.name}</div>
                                    {exam.examSeries && <div className="text-xs text-gray-400 dark:text-[#636366]">{exam.examSeries}</div>}
                                </td>
                                <td className="px-5 py-3 text-gray-700 dark:text-[#8E8E93]">{exam.subject}</td>
                                <td className="px-5 py-3 text-xs text-gray-600 dark:text-[#8E8E93]">
                                    {exam.startTime && exam.endTime ? `${exam.startTime}\u2013${exam.endTime}` : '\u2014'}
                                </td>
                                <td className="px-5 py-3 text-gray-700 dark:text-[#8E8E93]">
                                    {exam.examRoom ? (
                                        <div className="flex items-center gap-1.5">
                                            <MapPin className="h-3.5 w-3.5 text-gray-400 dark:text-[#636366]" />
                                            {exam.examRoom}
                                        </div>
                                    ) : '\u2014'}
                                </td>
                                <td className="px-5 py-3">
                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${
                                        exam.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-[rgba(48,209,88,0.12)] dark:text-[#30D158]' :
                                        exam.status === 'Cancelled' ? 'bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-[rgba(255,69,58,0.12)] dark:text-[#FF453A]' :
                                        exam.status === 'Ongoing' ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-[rgba(255,214,10,0.12)] dark:text-[#FFD60A]' :
                                        'bg-blue-50 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-500/12 dark:text-blue-400'
                                    }`}>
                                        {exam.status}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );

        return (
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">My Exams & Results</h1>
                    <button
                        className="btn btn-primary w-full sm:w-auto gap-1.5"
                        onClick={() => setResultCardTarget({
                            studentId: user._id || user.id,
                            studentName: user.name || user.fullName,
                            examSeries: ''
                        })}
                        disabled={!mySubjects.length}
                    >
                        <FileText className="h-4 w-4" />
                        View Report Card
                    </button>
                </div>

                {/* Exam Series Filter */}
                <div className="flex items-center gap-3">
                    <label className="text-sm font-medium text-gray-700 dark:text-[#8E8E93]">Filter by Exam Series:</label>
                    <select
                        value={examSeriesFilter}
                        onChange={(e) => setExamSeriesFilter(e.target.value)}
                        className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-[#38383A] bg-white dark:bg-[#1C1C1E] text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                        <option value="">All Exam Series</option>
                        {EXAM_SERIES.map(series => (
                            <option key={series} value={series}>{series}</option>
                        ))}
                    </select>
                </div>

                {/* Summary Cards */}
                {loadingMyResults ? (
                    <div className="flex justify-center py-12"><div className="loading-spinner" /></div>
                ) : mySummary ? (
                    <>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass border border-gray-100 dark:border-[#38383A] p-4 text-center">
                                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-500/20 mx-auto mb-2">
                                    <BarChart3 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                </div>
                                <p className="text-xs text-gray-500 dark:text-[#8E8E93] font-medium">Overall %</p>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{mySummary.overallPercentage}%</p>
                            </div>
                            <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass border border-gray-100 dark:border-[#38383A] p-4 text-center">
                                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-500/20 mx-auto mb-2">
                                    <Award className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                                </div>
                                <p className="text-xs text-gray-500 dark:text-[#8E8E93] font-medium">Grade</p>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{mySummary.overallGrade}</p>
                            </div>
                            <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass border border-gray-100 dark:border-[#38383A] p-4 text-center">
                                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-green-100 dark:bg-green-500/20 mx-auto mb-2">
                                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                                </div>
                                <p className="text-xs text-gray-500 dark:text-[#8E8E93] font-medium">Passed</p>
                                <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">{mySummary.passCount}/{mySummary.totalSubjects}</p>
                            </div>
                            <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass border border-gray-100 dark:border-[#38383A] p-4 text-center">
                                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-500/20 mx-auto mb-2">
                                    <TrendingUp className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                                </div>
                                <p className="text-xs text-gray-500 dark:text-[#8E8E93] font-medium">Total Marks</p>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{mySummary.grandObtained}/{mySummary.grandTotal}</p>
                            </div>
                        </div>

                        {/* Subject-wise Results */}
                        <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass border border-gray-100 dark:border-[#38383A] overflow-hidden">
                            <div className="px-5 py-3.5 border-b border-gray-100 dark:border-[#38383A]">
                                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Subject-wise Results</h2>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm min-w-[600px]">
                                    <thead>
                                        <tr className="bg-gray-50 dark:bg-[#2C2C2E] border-b border-gray-100 dark:border-[#38383A]">
                                            <th className="px-5 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Subject</th>
                                            <th className="px-5 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Exam</th>
                                            <th className="px-5 py-2.5 text-center text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Marks</th>
                                            <th className="px-5 py-2.5 text-center text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">%</th>
                                            <th className="px-5 py-2.5 text-center text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Grade</th>
                                            <th className="px-5 py-2.5 text-center text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Result</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {mySubjects.map((s, i) => (
                                            <tr key={s.examId + '-' + i} className={`border-b border-gray-50 dark:border-[#38383A] ${s.percentage >= 75 ? 'bg-emerald-50/40 dark:bg-[rgba(48,209,88,0.06)]' : i % 2 === 0 ? '' : 'bg-gray-50/30 dark:bg-[#2C2C2E]/30'}`}>
                                                <td className="px-5 py-3 font-medium text-gray-900 dark:text-white">
                                                    <div className="flex items-center gap-2">
                                                        {s.subject}
                                                        {s.percentage >= 75 && (
                                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-[rgba(48,209,88,0.12)] dark:text-[#30D158]">
                                                                <Award className="h-3 w-3 mr-0.5" />
                                                                Distinction
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-5 py-3">
                                                    <div className="text-gray-700 dark:text-[#8E8E93]">{s.examName}</div>
                                                    <div className="text-xs text-gray-400 dark:text-[#636366]">{s.examSeries} {s.date ? `\u2022 ${formatDate(s.date)}` : ''}</div>
                                                </td>
                                                <td className="px-5 py-3 text-center font-bold text-gray-900 dark:text-white">{s.marksObtained}/{s.totalMarks}</td>
                                                <td className="px-5 py-3 text-center text-gray-700 dark:text-[#8E8E93]">{s.percentage}%</td>
                                                <td className="px-5 py-3 text-center">
                                                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                                                        s.grade === 'A+' || s.grade === 'A' ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' :
                                                        s.grade === 'B' ? 'bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-400' :
                                                        s.grade === 'C' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' :
                                                        s.grade === 'D' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' :
                                                        'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'
                                                    }`}>{s.grade}</span>
                                                </td>
                                                <td className="px-5 py-3 text-center">
                                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${s.isPassed
                                                        ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-[rgba(48,209,88,0.12)] dark:text-[#30D158]'
                                                        : 'bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-[rgba(255,69,58,0.12)] dark:text-[#FF453A]'
                                                    }`}>
                                                        {s.isPassed ? 'Pass' : 'Fail'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass border border-gray-100 dark:border-[#38383A] flex flex-col items-center py-16 text-gray-400 dark:text-[#636366]">
                        <Award className="h-10 w-10 mb-3 opacity-30" />
                        <p className="font-medium">No results published yet</p>
                        <p className="text-sm mt-1">Your exam results will appear here once your teacher publishes them.</p>
                    </div>
                )}

                {/* Exam Schedule - Upcoming */}
                {!loading && (
                    <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass border border-gray-100 dark:border-[#38383A] overflow-hidden">
                        <div className="px-5 py-3.5 border-b border-gray-100 dark:border-[#38383A]">
                            <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                <Clock className="h-4 w-4 text-blue-500" />
                                Upcoming Exams
                            </h2>
                        </div>
                        {upcomingExams.length > 0 ? (
                            renderScheduleTable(upcomingExams)
                        ) : (
                            <div className="flex flex-col items-center py-12 text-gray-400 dark:text-[#636366]">
                                <Clock className="h-10 w-10 mb-3 opacity-30" />
                                <p className="font-medium">No upcoming exams</p>
                                <p className="text-sm mt-1">You are all caught up! New exams will appear here when scheduled.</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Exam Schedule - Past */}
                {!loading && pastExams.length > 0 && (
                    <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass border border-gray-100 dark:border-[#38383A] overflow-hidden">
                        <div className="px-5 py-3.5 border-b border-gray-100 dark:border-[#38383A]">
                            <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-gray-400 dark:text-[#636366]" />
                                Past Exams
                            </h2>
                        </div>
                        {renderScheduleTable(pastExams)}
                    </div>
                )}

                {/* Result Card Modal */}
                {resultCardTarget && (
                    <ResultCard
                        studentId={resultCardTarget.studentId}
                        studentName={resultCardTarget.studentName}
                        defaultExamSeries={resultCardTarget.examSeries}
                        onClose={() => setResultCardTarget(null)}
                    />
                )}
            </div>
        );
    }

    /* ═══════════════════════════════════════════
       ADMIN / TEACHER VIEW — exam management
    ═══════════════════════════════════════════ */
    return (
        <div className="space-y-6">

            {/* ── Header ── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Exams &amp; Results</h1>
                {(user.role === 'admin' || user.role === 'teacher') && (
                    <button className="btn btn-primary w-full sm:w-auto" onClick={() => setShowAddModal(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Schedule Exam
                    </button>
                )}
            </div>

            {/* ── Filters ── */}
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                <div className="relative flex-1 min-w-0">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-[#636366]" />
                    <input
                        className="input pl-9 w-full"
                        placeholder="Search exams…"
                        value={searchText}
                        onChange={e => setSearchText(e.target.value)}
                    />
                </div>
                <Select
                    className="w-full sm:w-auto sm:min-w-[140px]"
                    value={filterClass}
                    onChange={e => setFilterClass(e.target.value)}
                    placeholder="All Classes"
                    options={[
                        { value: '', label: 'All Classes' },
                        ...availableClasses.map(c => ({
                            value: c.grade,
                            label: c.name === c.grade ? c.name : `${c.name} (${c.grade})`
                        }))
                    ]}
                />
                <Select
                    className="w-full sm:w-auto sm:min-w-[130px]"
                    value={filterStatus}
                    onChange={e => setFilterStatus(e.target.value)}
                    placeholder="All Statuses"
                    options={[
                        { value: '', label: 'All Statuses' },
                        ...EXAM_STATUSES.map(s => ({ value: s, label: s }))
                    ]}
                />
            </div>

            {/* ── Grouped Exam List ── */}
            <div className="space-y-3">
                {loading ? (
                    <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass flex justify-center items-center py-16">
                        <div className="loading-spinner" />
                    </div>
                ) : Object.keys(groupedExams).length === 0 ? (
                    <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass flex flex-col items-center py-16 text-gray-400 dark:text-[#636366]">
                        <BookOpen className="h-10 w-10 mb-3 opacity-30" />
                        <p className="font-medium">No exams found</p>
                    </div>
                ) : Object.entries(groupedExams).map(([cls, sectionMap]) => {
                    const isClassCollapsed = collapsedClasses.has(cls);
                    const totalInClass = Object.values(sectionMap).reduce((a, arr) => a + arr.length, 0);
                    return (
                        <div key={cls} className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass overflow-hidden border border-gray-100 dark:border-[#38383A]">
                            {/* Class header */}
                            <button
                                className="w-full flex items-center justify-between px-5 py-3.5 bg-gray-50 dark:bg-[#000000] hover:bg-gray-100 dark:hover:bg-[#2C2C2E] transition-colors border-b border-gray-200 dark:border-[#38383A]"
                                onClick={() => toggleClass(cls)}
                            >
                                <div className="flex items-center gap-3">
                                    {isClassCollapsed
                                        ? <ChevronRight className="h-4 w-4 text-gray-400 dark:text-[#636366]" />
                                        : <ChevronDown className="h-4 w-4 text-gray-400 dark:text-[#636366]" />
                                    }
                                    <span className="font-bold text-gray-900 dark:text-white text-base">Class {cls}</span>
                                    <span className="text-xs font-medium bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full">
                                        {totalInClass} exam{totalInClass !== 1 ? 's' : ''}
                                    </span>
                                </div>
                                <span className="text-xs text-gray-400 dark:text-[#636366]">{Object.keys(sectionMap).length} section{Object.keys(sectionMap).length !== 1 ? 's' : ''}</span>
                            </button>

                            {/* Sections */}
                            {!isClassCollapsed && Object.entries(sectionMap).map(([sec, examList]) => {
                                const sectionKey = `${cls}-${sec}`;
                                const isSecCollapsed = collapsedSections.has(sectionKey);
                                return (
                                    <div key={sec}>
                                        {/* Section sub-header */}
                                        <div className="flex items-center bg-indigo-50/60 dark:bg-indigo-500/10 border-b border-indigo-100 dark:border-indigo-500/20">
                                            <button
                                                className="flex-1 flex items-center gap-2.5 px-6 py-2.5 hover:bg-indigo-100/50 dark:hover:bg-indigo-500/20 transition-colors text-left"
                                                onClick={() => toggleSection(sectionKey)}
                                            >
                                                {isSecCollapsed
                                                    ? <ChevronRight className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                                                    : <ChevronDown className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                                                }
                                                <span className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">
                                                    {sec === 'All' ? 'All Sections' : `Section ${sec}`}
                                                </span>
                                                <span className="text-xs text-indigo-400 ml-auto">{examList.length} exam{examList.length !== 1 ? 's' : ''}</span>
                                            </button>
                                            {!isStudent && sec !== 'All' && (
                                                <div className="flex items-center gap-1.5 px-3 shrink-0">
                                                    <button
                                                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors"
                                                        onClick={(e) => { e.stopPropagation(); handleBulkDownload(cls, sec, 'regular'); }}
                                                        title="Download all report cards as ZIP"
                                                    >
                                                        <Download className="h-3 w-3" />
                                                        All Cards
                                                    </button>
                                                    <button
                                                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#2C2C2E] transition-colors"
                                                        onClick={(e) => { e.stopPropagation(); handleBulkDownload(cls, sec, 'blank'); }}
                                                        title="Download blank report cards (no marks) as ZIP"
                                                    >
                                                        <FileText className="h-3 w-3" />
                                                        Blank
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {/* Exam rows for this section */}
                                        {!isSecCollapsed && (
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm min-w-[700px]">
                                                    <thead>
                                                        <tr className="bg-gray-50 dark:bg-[#000000] border-b border-gray-100 dark:border-[#38383A]">
                                                            <th className="px-5 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Date</th>
                                                            <th className="px-5 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Exam Name</th>
                                                            <th className="px-5 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Subject</th>
                                                            <th className="px-5 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Time</th>
                                                            <th className="px-5 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Marks</th>
                                                            <th className="px-5 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Status</th>
                                                            <th className="px-5 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Actions</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {examList.map((exam, idx) => (
                                                            <tr key={exam._id} className={`border-b border-gray-100 dark:border-[#38383A] transition-colors hover:bg-primary-50/40 ${idx % 2 === 0 ? 'bg-white dark:bg-[#1C1C1E]' : 'bg-gray-50/30 dark:bg-[#000000]/30'}`}>
                                                                <td className="px-5 py-3">
                                                                    <div className="flex items-center gap-1.5 text-gray-700 dark:text-[#8E8E93]">
                                                                        <Calendar className="h-3.5 w-3.5 text-gray-400 dark:text-[#636366] shrink-0" />
                                                                        {formatDate(exam.date)}
                                                                    </div>
                                                                </td>
                                                                <td className="px-5 py-3">
                                                                    <div className="font-semibold text-gray-900 dark:text-white">{exam.name}</div>
                                                                    {exam.examSeries && (
                                                                        <div className="text-xs text-gray-400 dark:text-[#636366]">{exam.examSeries}</div>
                                                                    )}
                                                                </td>
                                                                <td className="px-5 py-3 text-gray-700 dark:text-[#8E8E93] font-medium">{exam.subject}</td>
                                                                <td className="px-5 py-3">
                                                                    {exam.startTime && exam.endTime ? (
                                                                        <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-[#8E8E93]">
                                                                            <Clock className="h-3 w-3 text-gray-400 dark:text-[#636366]" />
                                                                            {exam.startTime}–{exam.endTime}
                                                                            <span className="text-gray-400 dark:text-[#636366]">({calcDuration(exam.startTime, exam.endTime)})</span>
                                                                        </div>
                                                                    ) : <span className="text-gray-300 dark:text-[#636366] text-xs">—</span>}
                                                                </td>
                                                                <td className="px-5 py-3">
                                                                    <span className="font-medium text-gray-900 dark:text-white">{exam.totalMarks}</span>
                                                                    {exam.passingMarks != null && (
                                                                        <span className="text-gray-400 dark:text-[#636366] text-xs ml-1">/ {exam.passingMarks} pass</span>
                                                                    )}
                                                                </td>
                                                                <td className="px-5 py-3">
                                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[exam.status] || 'bg-gray-100 dark:bg-[#2C2C2E] text-gray-600 dark:text-[#8E8E93]'}`}>
                                                                        {exam.status}
                                                                    </span>
                                                                </td>
                                                                <td className="px-5 py-3">
                                                                    <div className="flex items-center gap-2">
                                                                        <button
                                                                            className="btn btn-sm btn-outline text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-500/10"
                                                                            onClick={() => {
                                                                                if (user.role === 'student') {
                                                                                    setResultCardTarget({
                                                                                        studentId: user._id || user.id,
                                                                                        studentName: user.name || user.fullName,
                                                                                        examSeries: exam.examSeries
                                                                                    });
                                                                                } else {
                                                                                    setSelectedExam(exam);
                                                                                }
                                                                            }}
                                                                            title={user.role === 'student' ? "View My Result" : "Enter / View Results"}
                                                                        >
                                                                            <ClipboardList className="h-3.5 w-3.5 mr-1" />
                                                                            Results
                                                                        </button>
                                                                        {(user.role === 'admin' || user.role === 'teacher') && (
                                                                            <>
                                                                                <button
                                                                                    className="p-1 text-gray-400 dark:text-[#636366] hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                                                                    onClick={() => openEdit(exam)}
                                                                                    title="Edit exam"
                                                                                >
                                                                                    <Edit className="h-4 w-4" />
                                                                                </button>
                                                                                <button
                                                                                    className="p-1 text-gray-400 dark:text-[#636366] hover:text-red-600 dark:hover:text-red-400 transition-colors"
                                                                                    onClick={() => handleDelete(exam._id)}
                                                                                    title="Delete exam"
                                                                                >
                                                                                    <Trash2 className="h-4 w-4" />
                                                                                </button>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    );
                })}
            </div>

            {/* ══════════════════════════════════════
                Schedule New Exam Modal
            ══════════════════════════════════════ */}
            {showAddModal && createPortal(
                <div className="modal-overlay" role="dialog" aria-modal="true">
                    <div className="bg-white dark:bg-[#1C1C1E] rounded-xl shadow-2xl w-full max-w-2xl mx-2 sm:mx-4 max-h-[92vh] flex flex-col">

                        {/* Modal header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-[#38383A] shrink-0">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{editing ? 'Edit Exam' : 'Schedule New Exam'}</h3>
                                <p className="text-xs text-gray-400 dark:text-[#636366] mt-0.5">{editing ? 'Update exam details' : 'Fill in all required fields to schedule an exam'}</p>
                            </div>
                            <button className="btn-close" onClick={closeModal}>
                                <X className="h-5 w-5 text-gray-500 dark:text-[#8E8E93]" />
                            </button>
                        </div>

                        {/* Scrollable body */}
                        <form onSubmit={handleCreate} className="overflow-y-auto flex-1 px-4 sm:px-6 py-5 space-y-6">

                            {/* ── Section 1: Exam Details ── */}
                            <ModalSection icon={<BookOpen className="h-4 w-4" />} title="Exam Details">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="sm:col-span-2">
                                        <FieldLabel required>Exam Name</FieldLabel>
                                        <input
                                            className={`input ${formErrors.name ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
                                            placeholder="e.g. Mid Term Physics"
                                            value={form.name}
                                            onChange={e => handleField('name', e.target.value)}
                                        />
                                        <FieldError msg={formErrors.name} />
                                    </div>
                                    <div>
                                        <FieldLabel>Exam Series</FieldLabel>
                                        <Select
                                            value={form.examSeries}
                                            onChange={e => handleField('examSeries', e.target.value)}
                                            options={EXAM_SERIES.map(s => ({ value: s, label: s }))}
                                        />
                                    </div>
                                </div>
                            </ModalSection>

                            {/* ── Section 2: Class Details ── */}
                            <ModalSection icon={<User className="h-4 w-4" />} title="Class Details">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div>
                                        <FieldLabel required>Class</FieldLabel>
                                        <Select
                                            error={!!formErrors.class}
                                            value={form.class}
                                            onChange={e => handleField('class', e.target.value)}
                                            placeholder="Select Class"
                                            options={[
                                                { value: '', label: 'Select Class' },
                                                ...availableClasses.map(cls => ({
                                                    value: cls.grade,
                                                    label: cls.name === cls.grade ? cls.name : `${cls.name} (${cls.grade})`
                                                }))
                                            ]}
                                        />
                                        <FieldError msg={formErrors.class} />
                                    </div>
                                    <div>
                                        <FieldLabel>Section</FieldLabel>
                                        <Select
                                            value={form.section}
                                            onChange={e => handleField('section', e.target.value)}
                                            disabled={!form.classId}
                                            placeholder="All / Select"
                                            options={[
                                                { value: '', label: 'All / Select' },
                                                ...sections.map(s => ({ value: s.name, label: s.name }))
                                            ]}
                                        />
                                    </div>
                                    <div>
                                        <FieldLabel required>Subject</FieldLabel>
                                        <input
                                            className={`input ${formErrors.subject ? 'border-red-400' : ''}`}
                                            placeholder="e.g. Physics"
                                            value={form.subject}
                                            onChange={e => handleField('subject', e.target.value)}
                                        />
                                        <FieldError msg={formErrors.subject} />
                                    </div>
                                </div>
                            </ModalSection>

                            {/* ── Section 3: Schedule Details ── */}
                            <ModalSection icon={<Calendar className="h-4 w-4" />} title="Schedule Details">
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                    <div className="col-span-2">
                                        <FieldLabel required>Exam Date</FieldLabel>
                                        <DatePicker
                                            value={form.date}
                                            onChange={e => handleField('date', e.target.value)}
                                            className={formErrors.date ? '[&_button]:border-red-400' : ''}
                                        />
                                        <FieldError msg={formErrors.date} />
                                    </div>
                                    <div>
                                        <FieldLabel>Start Time</FieldLabel>
                                        <TimePicker
                                            value={form.startTime}
                                            onChange={e => handleField('startTime', e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <FieldLabel>End Time</FieldLabel>
                                        <TimePicker
                                            value={form.endTime}
                                            onChange={e => handleField('endTime', e.target.value)}
                                            className={formErrors.endTime ? '[&_button]:border-red-400' : ''}
                                        />
                                        <FieldError msg={formErrors.endTime} />
                                    </div>
                                </div>
                                {/* Auto-calculated duration */}
                                {form.startTime && form.endTime && calcDuration(form.startTime, form.endTime) && (
                                    <div className="flex items-center gap-1.5 mt-2 text-sm text-teal-600 font-medium">
                                        <Clock className="h-4 w-4" />
                                        Duration: {calcDuration(form.startTime, form.endTime)}
                                    </div>
                                )}
                            </ModalSection>

                            {/* ── Section 4: Marks ── */}
                            <ModalSection icon={<CheckCircle2 className="h-4 w-4" />} title="Marks">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <FieldLabel required>Total Marks</FieldLabel>
                                        <input
                                            type="number"
                                            min="1"
                                            max="100"
                                            className={`input ${formErrors.totalMarks ? 'border-red-400' : ''}`}
                                            value={form.totalMarks}
                                            onChange={e => handleField('totalMarks', e.target.value)}
                                        />
                                        <FieldError msg={formErrors.totalMarks} />
                                    </div>
                                    <div>
                                        <FieldLabel>Passing Marks</FieldLabel>
                                        <input
                                            type="number"
                                            min="0"
                                            className={`input ${formErrors.passingMarks ? 'border-red-400' : ''}`}
                                            value={form.passingMarks}
                                            onChange={e => handleField('passingMarks', e.target.value)}
                                        />
                                        <FieldError msg={formErrors.passingMarks} />
                                    </div>
                                </div>
                                {/* Live passing % hint */}
                                {form.totalMarks > 0 && form.passingMarks > 0 &&
                                    Number(form.passingMarks) < Number(form.totalMarks) && (
                                        <p className="text-xs text-gray-400 dark:text-[#636366] mt-1">
                                            Pass threshold: {Math.round((form.passingMarks / form.totalMarks) * 100)}%
                                        </p>
                                    )}
                            </ModalSection>

                            {/* ── Section 5: Exam Information ── */}
                            <ModalSection icon={<ClipboardList className="h-4 w-4" />} title="Exam Information">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <FieldLabel>Exam Type</FieldLabel>
                                        <Select
                                            value={form.examType}
                                            onChange={e => handleField('examType', e.target.value)}
                                            options={EXAM_TYPES.map(t => ({ value: t, label: t }))}
                                        />
                                    </div>
                                    <div>
                                        <FieldLabel>Exam Mode</FieldLabel>
                                        <Select
                                            value={form.examMode}
                                            onChange={e => handleField('examMode', e.target.value)}
                                            options={EXAM_MODES.map(m => ({ value: m, label: m }))}
                                        />
                                    </div>
                                </div>
                            </ModalSection>

                            {/* ── Section 6: Staff & Location ── */}
                            <ModalSection icon={<MapPin className="h-4 w-4" />} title="Staff &amp; Location">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <FieldLabel>Exam Supervisor</FieldLabel>
                                        <Select
                                            value={form.supervisor}
                                            onChange={e => handleField('supervisor', e.target.value)}
                                            placeholder="Select Teacher"
                                            options={[
                                                { value: '', label: 'Select Teacher' },
                                                ...teachers.map(t => ({ value: t._id, label: t.name }))
                                            ]}
                                        />
                                    </div>
                                    <div>
                                        <FieldLabel>Exam Room / Hall</FieldLabel>
                                        <input
                                            className="input"
                                            placeholder="e.g. Room 201"
                                            value={form.examRoom}
                                            onChange={e => handleField('examRoom', e.target.value)}
                                        />
                                    </div>
                                </div>
                            </ModalSection>

                            {/* ── Section 7: Status ── */}
                            <ModalSection icon={<AlertCircle className="h-4 w-4" />} title="Status">
                                <div className="flex flex-wrap gap-2">
                                    {EXAM_STATUSES.map(s => (
                                        <button
                                            key={s}
                                            type="button"
                                            onClick={() => handleField('status', s)}
                                            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all
                                                ${form.status === s
                                                    ? STATUS_COLORS[s] + ' border-current ring-2 ring-offset-1'
                                                    : 'border-gray-200 dark:border-[#38383A] text-gray-500 dark:text-[#8E8E93] hover:border-gray-400 dark:hover:border-[#48484A]'}`}
                                        >
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            </ModalSection>

                        </form>

                        {/* Modal Footer */}
                        <div className="px-4 sm:px-6 py-4 border-t border-gray-100 dark:border-[#38383A] shrink-0 flex flex-col-reverse sm:flex-row justify-end gap-3 bg-gray-50 dark:bg-[#000000] rounded-b-xl">
                            <button type="button" className="btn btn-ghost w-full sm:w-auto" onClick={closeModal}>Cancel</button>
                            <button
                                onClick={handleCreate}
                                disabled={submitting}
                                className="btn btn-primary w-full sm:w-auto"
                            >
                                {submitting ? 'Saving…' : (editing ? 'Update Exam' : 'Schedule Exam')}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Results Modal */}
            {selectedExam && (
                <ExamResultsModal
                    exam={selectedExam}
                    onClose={() => setSelectedExam(null)}
                />
            )}

            {/* Series-level Result Card (opened from within the ExamResultsModal) */}
            {resultCardTarget && (
                <ResultCard
                    studentId={resultCardTarget.studentId}
                    studentName={resultCardTarget.studentName}
                    defaultExamSeries={resultCardTarget.examSeries}
                    onClose={() => setResultCardTarget(null)}
                />
            )}

            {/* Bulk download progress modal */}
            {bulkJob && (
                <BulkDownloadProgress
                    jobId={bulkJob.jobId}
                    totalStudents={bulkJob.totalStudents}
                    onClose={() => setBulkJob(null)}
                />
            )}
        </div>
    );
};

/* ── Helpers ── */
const ModalSection = ({ icon, title, children }) => (
    <div>
        <div className="flex items-center gap-2 mb-3">
            <span className="text-primary-600">{icon}</span>
            <h4 className="text-sm font-semibold text-gray-700 dark:text-[#8E8E93] uppercase tracking-wide">{title}</h4>
        </div>
        <div className="pl-6 border-l-2 border-gray-100 dark:border-[#38383A]">
            {children}
        </div>
    </div>
);

const FieldLabel = ({ children, required }) => (
    <label className="label mb-1 block text-gray-700 dark:text-[#8E8E93]">
        {children}
        {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
);

const FieldError = ({ msg }) =>
    msg ? (
        <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" /> {msg}
        </p>
    ) : null;

export default Exams;
