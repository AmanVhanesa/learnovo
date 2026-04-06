import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Plus, Search, Calendar, Trash2, X, ClipboardList, Edit,
    Clock, BookOpen, User, MapPin, ChevronDown, ChevronRight, AlertCircle, CheckCircle2, FileText,
    Award, BarChart3, TrendingUp, Download, RefreshCw, AlertTriangle, Layers, GraduationCap
} from 'lucide-react';
import { examsService } from '../services/examsService';
import { classesService } from '../services/classesService';
import { subjectsService } from '../services/subjectsService';
import { teachersService } from '../services/teachersService';
import { studentsService } from '../services/studentsService';
import { academicSessionsService } from '../services/academicsService';
import ExamResultsModal from '../components/ExamResultsModal';
import ResultCard from '../components/ResultCard';
import BulkDownloadProgress from '../components/BulkDownloadProgress';
import CustomReportCardModal from '../components/CustomReportCardModal';
import toast from 'react-hot-toast';
import { formatDate } from '../utils/formatDate';
import { useAuth } from '../contexts/AuthContext';
import Select from '../components/ui/Select';
import DatePicker from '../components/ui/DatePicker';
import TimePicker from '../components/ui/TimePicker';
import { getClassOrder, sortClassObjects } from '../utils/classOrder';

const STATUS_COLORS = {
    Scheduled: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
    Ongoing: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
    Completed: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400',
    Cancelled: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400',
};

const STATUS_RING = {
    Scheduled: 'ring-1 ring-blue-200 dark:ring-blue-500/30',
    Ongoing: 'ring-1 ring-amber-200 dark:ring-amber-500/30',
    Completed: 'ring-1 ring-green-200 dark:ring-green-500/30',
    Cancelled: 'ring-1 ring-red-200 dark:ring-red-500/30',
};

const TERMS = ['Term 1', 'Term 2'];

const TERM_EXAM_TYPES = {
    'Term 1': ['UT1', 'SA1', 'Custom'],
    'Term 2': ['UT2', 'SA2', 'Custom']
};

const EXAM_SERIES = ['UT1', 'UT2', 'SA1', 'SA2', 'Custom', 'FA1', 'FA2', 'FA3', 'FA4', 'Unit Test', 'Midterm', 'Final'];
const EXAM_TYPES = ['Written', 'Practical', 'Oral'];
const EXAM_MODES = ['Offline', 'Online'];
const EXAM_STATUSES = ['Scheduled', 'Ongoing', 'Completed', 'Cancelled'];

/* ── Exam series display config ── */
const SERIES_CONFIG = {
    UT1: { label: 'Unit Test 1', short: 'UT1', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10', border: 'border-blue-200 dark:border-blue-500/20' },
    SA1: { label: 'Summative Assessment 1', short: 'SA1', color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-500/10', border: 'border-purple-200 dark:border-purple-500/20' },
    UT2: { label: 'Unit Test 2', short: 'UT2', color: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-50 dark:bg-teal-500/10', border: 'border-teal-200 dark:border-teal-500/20' },
    SA2: { label: 'Summative Assessment 2', short: 'SA2', color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-500/10', border: 'border-orange-200 dark:border-orange-500/20' },
    Custom: { label: 'Custom Exam', short: 'Custom', color: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-50 dark:bg-gray-500/10', border: 'border-gray-200 dark:border-gray-500/20' },
    // Keep legacy entries for backwards compat display
    FA1: { label: 'FA 1', short: 'FA1', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10', border: 'border-blue-200 dark:border-blue-500/20' },
    FA2: { label: 'FA 2', short: 'FA2', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10', border: 'border-blue-200 dark:border-blue-500/20' },
    FA3: { label: 'FA 3', short: 'FA3', color: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-50 dark:bg-cyan-500/10', border: 'border-cyan-200 dark:border-cyan-500/20' },
    FA4: { label: 'FA 4', short: 'FA4', color: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-50 dark:bg-cyan-500/10', border: 'border-cyan-200 dark:border-cyan-500/20' },
    'Unit Test': { label: 'Unit Test', short: 'UT', color: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-50 dark:bg-teal-500/10', border: 'border-teal-200 dark:border-teal-500/20' },
    Midterm: { label: 'Midterm', short: 'Mid', color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-500/10', border: 'border-orange-200 dark:border-orange-500/20' },
    Final: { label: 'Final', short: 'Final', color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-500/10', border: 'border-rose-200 dark:border-rose-500/20' },
};

const EMPTY_FORM = {
    name: '',
    term: 'Term 1',
    examSeries: 'UT1',
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

/* ── Exam series sort order ── */
const SERIES_ORDER = ['UT1', 'SA1', 'UT2', 'SA2', 'Custom', 'FA1', 'FA2', 'FA3', 'FA4', 'Unit Test', 'Midterm', 'Final'];
function seriesSortKey(s) {
    const idx = SERIES_ORDER.indexOf(s);
    return idx >= 0 ? idx : 999;
}

const Exams = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    /* ── Admin tab state ── */
    const [activeTab, setActiveTab] = useState('exams'); // 'exams' | 'reportCards'

    /* ── Modal / selection state ── */
    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedExam, setSelectedExam] = useState(null);
    const [editing, setEditing] = useState(null);
    const [resultCardTarget, setResultCardTarget] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [formErrors, setFormErrors] = useState({});

    /* ── Filter state ── */
    const [filterStatus, setFilterStatus] = useState('');
    const [filterClass, setFilterClass] = useState('');
    const [filterTerm, setFilterTerm] = useState('');
    const [searchText, setSearchText] = useState('');
    const [examSeriesFilter, setExamSeriesFilter] = useState('');

    /* ── Bulk download state ── */
    const [bulkJob, setBulkJob] = useState(null);

    /* ── Report cards tab state ── */
    const [rcClass, setRcClass] = useState('');
    const [rcSection, setRcSection] = useState('');
    const [rcStudentSearch, setRcStudentSearch] = useState('');
    const [rcDownloading, setRcDownloading] = useState({}); // { [studentId]: true }
    const [showCustomReportCard, setShowCustomReportCard] = useState(false);

    /* ── Accordion collapse state ── */
    const [collapsedClasses, setCollapsedClasses] = useState(new Set());
    const [collapsedSections, setCollapsedSections] = useState(new Set());
    const [collapsedSeries, setCollapsedSeries] = useState(new Set());

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
    const toggleSeries = (key) => setCollapsedSeries(prev => {
        const next = new Set(prev);
        next.has(key) ? next.delete(key) : next.add(key);
        return next;
    });

    /* ── Bulk download helpers ── */
    const handleBulkDownload = async (sectionId, className, type = 'regular') => {
        if (!sectionId) {
            toast.error('Could not find section. Please select a valid class and section.');
            return;
        }
        try {
            const res = await examsService.startBulkDownload(sectionId, { className, type });
            setBulkJob({ jobId: res.data.jobId, totalStudents: res.data.totalStudents });
            toast.success(`Generating ${type === 'blank' ? 'blank ' : ''}report cards for ${res.data.totalStudents} students...`);
        } catch (err) {
            const msg = err?.response?.data?.message || err?.message || 'Failed to start bulk download';
            toast.error(msg);
            console.error('Bulk download error:', err);
        }
    };

    const handleCumulativeDownload = async (sectionId) => {
        if (!sectionId) {
            toast.error('Could not find section. Please select a valid class and section.');
            return;
        }
        try {
            const sessionRes = await academicSessionsService.getActive();
            const session = sessionRes?.data || sessionRes;
            if (!session?._id) {
                toast.error('No active academic session found. Please set one in Settings.');
                return;
            }
            const res = await examsService.startFinalBulkDownload(sectionId, session._id);
            setBulkJob({ jobId: res.data.jobId, totalStudents: res.data.totalStudents });
            toast.success(`Generating cumulative report cards for ${res.data.totalStudents} students...`);
        } catch (err) {
            const msg = err?.response?.data?.message || err?.message || 'Failed to start cumulative download';
            toast.error(msg);
            console.error('Cumulative download error:', err);
        }
    };

    /* ── Data fetching with React Query ── */
    const { data: exams = [], isLoading: loading, error: examsError, refetch: refetchExams } = useQuery({
        queryKey: ['exams'],
        queryFn: async () => {
            const res = await examsService.list();
            return res.data || [];
        },
        retry: 2,
        staleTime: 2 * 60 * 1000,
    });

    const { data: availableClassesRaw = [] } = useQuery({
        queryKey: ['exams-classes'],
        queryFn: async () => {
            const res = await classesService.list();
            return res.data || [];
        },
    });

    const availableClasses = useMemo(() => sortClassObjects(availableClassesRaw, 'grade'), [availableClassesRaw]);

    const { data: teachers = [] } = useQuery({
        queryKey: ['exams-teachers'],
        queryFn: async () => {
            const res = await teachersService.list({ limit: 100 });
            return res.data || res.teachers || [];
        },
    });

    const { data: allSubjects = [] } = useQuery({
        queryKey: ['exams-subjects'],
        queryFn: async () => {
            const res = await subjectsService.list();
            return res.data || [];
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
            if (isEdit) return examsService.update(id, data);
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
        onError: () => toast.error('Failed to delete exam'),
    });

    /* ── Derive sections from the selected class ── */
    const sections = useMemo(() => {
        if (!form.classId) return [];
        const cls = availableClasses.find(c => c._id === form.classId);
        return cls?.sections || [];
    }, [form.classId, availableClasses]);

    /* ── Derived: subjects for the selected class ── */
    const classSubjects = useMemo(() => {
        if (form.classId) {
            const cls = availableClasses.find(c => c._id === form.classId);
            const assigned = (cls?.subjects || [])
                .filter(s => s.subject)
                .map(s => ({
                    _id: s.subject._id || s.subject,
                    name: s.subject.name || s.subject.subjectCode || s.subject
                }));
            if (assigned.length > 0) return assigned;
        }
        return allSubjects
            .filter(s => s.isActive !== false)
            .map(s => ({ _id: s._id, name: s.name }));
    }, [form.classId, availableClasses, allSubjects]);

    /* ── Derived: filtered exam list ── */
    const filteredExams = useMemo(() => exams.filter(e => {
        if (filterStatus && e.status !== filterStatus) return false;
        if (filterClass && e.class !== filterClass) return false;
        if (filterTerm && (e.term || 'Term 1') !== filterTerm) return false;
        if (examSeriesFilter && e.examSeries !== examSeriesFilter) return false;
        if (searchText) {
            const q = searchText.toLowerCase();
            return (e.name || '').toLowerCase().includes(q) ||
                (e.subject || '').toLowerCase().includes(q);
        }
        return true;
    }), [exams, filterStatus, filterClass, filterTerm, examSeriesFilter, searchText]);

    /* ── Group: { term → { class → { section → { examSeries → exam[] } } } } ── */
    const groupedExams = useMemo(() => {
        const map = {};
        filteredExams.forEach(e => {
            const term = e.term || 'Term 1';
            const cls = e.class || 'Unknown';
            const sec = e.section || 'All';
            const series = e.examSeries || 'Custom';
            if (!map[term]) map[term] = {};
            if (!map[term][cls]) map[term][cls] = {};
            if (!map[term][cls][sec]) map[term][cls][sec] = {};
            if (!map[term][cls][sec][series]) map[term][cls][sec][series] = [];
            map[term][cls][sec][series].push(e);
        });
        // Sort
        const sorted = {};
        ['Term 1', 'Term 2'].forEach(term => {
            if (!map[term]) return;
            sorted[term] = {};
            Object.keys(map[term]).sort((a, b) => getClassOrder(a) - getClassOrder(b)).forEach(cls => {
                sorted[term][cls] = {};
                Object.keys(map[term][cls]).sort().forEach(sec => {
                    sorted[term][cls][sec] = {};
                    Object.keys(map[term][cls][sec]).sort((a, b) => seriesSortKey(a) - seriesSortKey(b)).forEach(series => {
                        sorted[term][cls][sec][series] = map[term][cls][sec][series].sort((a, b) => new Date(b.date) - new Date(a.date));
                    });
                });
            });
        });
        return sorted;
    }, [filteredExams]);

    /* ── Stats ── */
    const stats = useMemo(() => {
        const total = exams.length;
        const scheduled = exams.filter(e => e.status === 'Scheduled').length;
        const ongoing = exams.filter(e => e.status === 'Ongoing').length;
        const completed = exams.filter(e => e.status === 'Completed').length;
        return { total, scheduled, ongoing, completed };
    }, [exams]);

    /* ── Student exams grouped by series ── */
    const studentExamsBySeries = useMemo(() => {
        if (!isStudent) return [];
        const map = {};
        exams.forEach(e => {
            const series = e.examSeries || 'Custom';
            if (!map[series]) map[series] = [];
            map[series].push(e);
        });
        return Object.entries(map).sort((a, b) => seriesSortKey(a[0]) - seriesSortKey(b[0]));
    }, [exams, isStudent]);

    /* ── Report Cards: sections for selected class ── */
    const rcSections = useMemo(() => {
        if (!rcClass) return [];
        const cls = availableClasses.find(c => c.grade === rcClass || c.name === rcClass);
        return cls?.sections || [];
    }, [rcClass, availableClasses]);

    /* ── Report Cards: get section ID directly ── */
    const rcSectionId = useMemo(() => {
        if (!rcSection || !rcSections.length) return null;
        const sec = rcSections.find(s => s.name === rcSection);
        return sec?._id || null;
    }, [rcSection, rcSections]);

    /* ── Report Cards: students for individual download ── */
    const { data: rcStudents = [], isLoading: rcStudentsLoading } = useQuery({
        queryKey: ['rc-students', rcClass, rcSection],
        queryFn: async () => {
            const cls = availableClasses.find(c => c.grade === rcClass || c.name === rcClass);
            const res = await studentsService.list({
                class: rcClass,
                classId: cls?._id,
                section: rcSection,
                limit: 200
            });
            return res.data || res.students || [];
        },
        enabled: !isStudent && !!rcClass && !!rcSection,
        staleTime: 5 * 60 * 1000,
    });

    /* ── Field change handler ── */
    const handleField = (key, value) => {
        setForm(prev => {
            const next = { ...prev, [key]: value };
            if (key === 'class') {
                const cls = availableClasses.find(c => c.grade === value);
                next.classId = cls ? cls._id : '';
                next.section = '';
                next.subject = '';
            }
            return next;
        });
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

    const openEdit = (exam) => {
        setEditing(exam);
        setForm({
            name: exam.name || '',
            term: exam.term || 'Term 1',
            examSeries: exam.examSeries || 'UT1',
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
        if (!exam.classId && exam.class) {
            const cls = availableClasses.find(c => c.grade === exam.class);
            if (cls) setForm(prev => ({ ...prev, classId: cls._id }));
        }
        setShowAddModal(true);
    };

    const handleCreate = async (e) => {
        if (e) e.preventDefault();
        const errors = validate();
        if (Object.keys(errors).length) { setFormErrors(errors); return; }
        saveMutation.mutate({ isEdit: !!editing, id: editing?._id, data: form });
    };

    const submitting = saveMutation.isPending;

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this exam and all its results?')) return;
        deleteMutation.mutate(id);
    };

    const closeModal = () => {
        setShowAddModal(false);
        setEditing(null);
        setForm(EMPTY_FORM);
        setFormErrors({});
    };

    /* ═══════════════════════════════════════════
       STUDENT VIEW
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
                if (examDate >= today) upcoming.push(exam);
                else past.push(exam);
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
                            <th className="px-5 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase">Marks</th>
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
                                    {exam.startTime && exam.endTime ? `${exam.startTime}–${exam.endTime}` : '—'}
                                </td>
                                <td className="px-5 py-3 text-gray-700 dark:text-[#8E8E93] font-medium">{exam.totalMarks}</td>
                                <td className="px-5 py-3">
                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${STATUS_COLORS[exam.status] || ''} ${STATUS_RING[exam.status] || ''}`}>
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
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">My Exams & Results</h1>
                        <p className="text-sm text-gray-500 dark:text-[#8E8E93] mt-1">View your exam schedule and academic performance</p>
                    </div>
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

                {/* Exam Series Filter — only show series that have exams for this student */}
                {(() => {
                    const availableSeries = [...new Set(exams.map(e => e.examSeries || 'Custom'))];
                    const orderedSeries = EXAM_SERIES.filter(s => availableSeries.includes(s));
                    if (orderedSeries.length === 0) return null;
                    return (
                        <div className="flex items-center gap-3 flex-wrap">
                            <label className="text-sm font-medium text-gray-700 dark:text-[#8E8E93]">Filter:</label>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={() => setExamSeriesFilter('')}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${!examSeriesFilter ? 'bg-primary-600 text-white shadow-sm' : 'bg-gray-100 dark:bg-[#2C2C2E] text-gray-600 dark:text-[#8E8E93] hover:bg-gray-200 dark:hover:bg-[#38383A]'}`}
                                >
                                    All
                                </button>
                                {orderedSeries.map(series => (
                                    <button
                                        key={series}
                                        onClick={() => setExamSeriesFilter(series)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${examSeriesFilter === series ? 'bg-primary-600 text-white shadow-sm' : 'bg-gray-100 dark:bg-[#2C2C2E] text-gray-600 dark:text-[#8E8E93] hover:bg-gray-200 dark:hover:bg-[#38383A]'}`}
                                    >
                                        {series}
                                    </button>
                                ))}
                            </div>
                        </div>
                    );
                })()}

                {/* Summary Cards */}
                {loadingMyResults ? (
                    <div className="flex justify-center py-12"><div className="loading-spinner" /></div>
                ) : mySummary ? (
                    <>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {[
                                { label: 'Overall %', value: `${mySummary.overallPercentage}%`, icon: BarChart3, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-500/20' },
                                { label: 'Grade', value: mySummary.overallGrade, icon: Award, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-100 dark:bg-purple-500/20' },
                                { label: 'Passed', value: `${mySummary.passCount}/${mySummary.totalSubjects}`, icon: CheckCircle2, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-500/20' },
                                { label: 'Total Marks', value: `${mySummary.grandObtained}/${mySummary.grandTotal}`, icon: TrendingUp, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-500/20' },
                            ].map((stat, i) => (
                                <div key={i} className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass border border-gray-100 dark:border-[#38383A] p-4 text-center">
                                    <div className={`flex items-center justify-center w-10 h-10 rounded-full ${stat.bg} mx-auto mb-2`}>
                                        <stat.icon className={`h-5 w-5 ${stat.color}`} />
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-[#8E8E93] font-medium">{stat.label}</p>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stat.value}</p>
                                </div>
                            ))}
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
                                                    <div className="text-xs text-gray-400 dark:text-[#636366]">{s.examSeries} {s.date ? `• ${formatDate(s.date)}` : ''}</div>
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
                    <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass border border-gray-100 dark:border-[#38383A] flex flex-col items-center justify-center py-16 px-6 text-center text-gray-400 dark:text-[#636366]">
                        <Award className="h-10 w-10 mb-3 opacity-30" />
                        <p className="font-medium text-gray-500 dark:text-[#8E8E93]">No results published yet</p>
                        <p className="text-sm mt-1 max-w-xs">Your exam results will appear here once your teacher publishes them.</p>
                    </div>
                )}

                {/* Exam Schedule grouped by Series */}
                {!loading && studentExamsBySeries.length > 0 && (
                    <div className="space-y-3">
                        <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                            <Layers className="h-4 w-4 text-primary-500" />
                            Exam Schedule by Series
                        </h2>
                        {studentExamsBySeries.map(([series, seriesExams]) => {
                            const cfg = SERIES_CONFIG[series] || SERIES_CONFIG.Custom;
                            return (
                                <div key={series} className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass border border-gray-100 dark:border-[#38383A] overflow-hidden">
                                    <div className={`px-5 py-3 border-b ${cfg.border} ${cfg.bg} flex items-center justify-between`}>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-sm font-semibold ${cfg.color}`}>{cfg.label || series}</span>
                                            <span className="text-xs text-gray-400 dark:text-[#636366] bg-white/60 dark:bg-[#1C1C1E]/60 px-2 py-0.5 rounded-full">{seriesExams.length} exam{seriesExams.length !== 1 ? 's' : ''}</span>
                                        </div>
                                    </div>
                                    {renderScheduleTable(seriesExams.sort((a, b) => new Date(a.date) - new Date(b.date)))}
                                </div>
                            );
                        })}
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
       ADMIN / TEACHER VIEW
    ═══════════════════════════════════════════ */

    const adminTabs = [
        { id: 'exams', label: 'Exam Management', icon: ClipboardList },
        { id: 'reportCards', label: 'Report Cards', icon: GraduationCap },
    ];

    return (
        <div className="space-y-6">

            {/* ── Header ── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Exams & Results</h1>
                    <p className="text-sm text-gray-500 dark:text-[#8E8E93] mt-1">Manage exams, enter marks, and download report cards</p>
                </div>
                {(user.role === 'admin' || user.role === 'teacher') && activeTab === 'exams' && (
                    <button className="btn btn-primary w-full sm:w-auto" onClick={() => setShowAddModal(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Schedule Exam
                    </button>
                )}
            </div>

            {/* ── Stats ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: 'Total Exams', value: stats.total, icon: BookOpen, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-500/20' },
                    { label: 'Scheduled', value: stats.scheduled, icon: Calendar, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-500/20' },
                    { label: 'Ongoing', value: stats.ongoing, icon: Clock, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-100 dark:bg-orange-500/20' },
                    { label: 'Completed', value: stats.completed, icon: CheckCircle2, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-500/20' },
                ].map((stat, i) => (
                    <div key={i} className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass p-4 border border-gray-100 dark:border-[#38383A]">
                        <div className="flex items-center gap-3">
                            <div className={`p-2.5 rounded-xl ${stat.bg}`}>
                                <stat.icon className={`h-5 w-5 ${stat.color}`} />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 dark:text-[#8E8E93]">{stat.label}</p>
                                <p className="text-xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Tabs ── */}
            <div className="border-b border-gray-200 dark:border-[#38383A]">
                <nav className="-mb-px flex space-x-6">
                    {adminTabs.map(tab => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
                                    activeTab === tab.id
                                        ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                                        : 'border-transparent text-gray-500 dark:text-[#8E8E93] hover:text-gray-700 dark:hover:text-white hover:border-gray-300'
                                }`}
                            >
                                <Icon className="h-4 w-4" />
                                {tab.label}
                            </button>
                        );
                    })}
                </nav>
            </div>

            {/* ── Error ── */}
            {examsError && (
                <div className="bg-red-50 dark:bg-red-500/10 border border-red-200/60 dark:border-red-500/20 rounded-2xl p-4">
                    <div className="flex items-center">
                        <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mr-2 flex-shrink-0" />
                        <p className="text-sm text-red-700 dark:text-red-400">{examsError.response?.data?.message || 'Failed to load exams.'}</p>
                    </div>
                    <button onClick={() => refetchExams()} className="mt-2 inline-flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400 hover:text-red-800 underline">
                        <RefreshCw className="h-3.5 w-3.5" /> Try again
                    </button>
                </div>
            )}

            {/* ══════════════════════════════════════
                EXAMS TAB
            ══════════════════════════════════════ */}
            {activeTab === 'exams' && (
                <>
                    {/* ── Filters ── */}
                    <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass border border-gray-100 dark:border-[#38383A] p-4">
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
                                className="w-full sm:w-auto sm:min-w-[120px]"
                                value={filterTerm}
                                onChange={e => setFilterTerm(e.target.value)}
                                placeholder="All Terms"
                                options={[
                                    { value: '', label: 'All Terms' },
                                    { value: 'Term 1', label: 'Term 1' },
                                    { value: 'Term 2', label: 'Term 2' }
                                ]}
                            />
                            <Select
                                className="w-full sm:w-auto sm:min-w-[140px]"
                                value={filterClass}
                                onChange={e => setFilterClass(e.target.value)}
                                placeholder="All Classes"
                                options={[
                                    { value: '', label: 'All Classes' },
                                    ...availableClasses.map(c => ({ value: c.grade, label: c.name }))
                                ]}
                            />
                            <Select
                                className="w-full sm:w-auto sm:min-w-[140px]"
                                value={examSeriesFilter}
                                onChange={e => setExamSeriesFilter(e.target.value)}
                                placeholder="All Series"
                                options={[
                                    { value: '', label: 'All Series' },
                                    ...EXAM_SERIES.map(s => ({ value: s, label: s }))
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
                    </div>

                    {/* ── Grouped Exam List: Term > Class > Section > Exam Series ── */}
                    <div className="space-y-4">
                        {loading ? (
                            <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass flex justify-center items-center py-16">
                                <div className="loading-spinner" />
                            </div>
                        ) : Object.keys(groupedExams).length === 0 ? (
                            <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass flex flex-col items-center py-16 text-gray-400 dark:text-[#636366]">
                                <BookOpen className="h-10 w-10 mb-3 opacity-30" />
                                <p className="font-medium">No exams found</p>
                                <p className="text-sm mt-1">Schedule your first exam to get started.</p>
                            </div>
                        ) : Object.entries(groupedExams).map(([term, classes]) => (
                            <div key={term} className="mb-6">
                                {/* Term Header */}
                                <div className={`flex items-center gap-3 mb-3 px-2 py-2 rounded-lg ${term === 'Term 1' ? 'bg-blue-50/50 dark:bg-blue-500/5' : 'bg-emerald-50/50 dark:bg-emerald-500/5'}`}>
                                    <div className={`w-2 h-8 rounded-full ${term === 'Term 1' ? 'bg-blue-500' : 'bg-emerald-500'}`} />
                                    <h3 className={`text-base font-bold ${term === 'Term 1' ? 'text-blue-700 dark:text-blue-400' : 'text-emerald-700 dark:text-emerald-400'}`}>{term}</h3>
                                    <span className="text-xs text-gray-400">
                                        {Object.values(classes).reduce((a, secs) => a + Object.values(secs).reduce((b, series) => b + Object.values(series).reduce((c, exams) => c + exams.length, 0), 0), 0)} exams
                                    </span>
                                </div>

                                {/* Classes within this term */}
                                <div className="space-y-4">
                                {Object.entries(classes).map(([cls, sectionMap]) => {
                            const isClassCollapsed = collapsedClasses.has(`${term}-${cls}`);
                            const totalInClass = Object.values(sectionMap).reduce((a, seriesMap) =>
                                a + Object.values(seriesMap).reduce((b, arr) => b + arr.length, 0), 0);
                            return (
                                <div key={cls} className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass overflow-hidden border border-gray-100 dark:border-[#38383A]">
                                    {/* Class header */}
                                    <button
                                        className="w-full flex items-center justify-between px-5 py-3.5 bg-gray-50 dark:bg-[#2C2C2E] hover:bg-gray-100 dark:hover:bg-[#38383A] transition-colors border-b border-gray-200 dark:border-[#38383A]"
                                        onClick={() => toggleClass(`${term}-${cls}`)}
                                    >
                                        <div className="flex items-center gap-3">
                                            {isClassCollapsed
                                                ? <ChevronRight className="h-4 w-4 text-gray-400 dark:text-[#636366]" />
                                                : <ChevronDown className="h-4 w-4 text-gray-400 dark:text-[#636366]" />
                                            }
                                            <span className="font-bold text-gray-900 dark:text-white text-base">Class {cls}</span>
                                            <span className="text-xs font-medium bg-primary-100 dark:bg-primary-500/20 text-primary-700 dark:text-primary-400 px-2.5 py-0.5 rounded-full">
                                                {totalInClass} exam{totalInClass !== 1 ? 's' : ''}
                                            </span>
                                        </div>
                                        <span className="text-xs text-gray-400 dark:text-[#636366]">{Object.keys(sectionMap).length} section{Object.keys(sectionMap).length !== 1 ? 's' : ''}</span>
                                    </button>

                                    {/* Sections */}
                                    {!isClassCollapsed && Object.entries(sectionMap).map(([sec, seriesMap]) => {
                                        const sectionKey = `${cls}-${sec}`;
                                        const isSecCollapsed = collapsedSections.has(sectionKey);
                                        const totalInSection = Object.values(seriesMap).reduce((a, arr) => a + arr.length, 0);
                                        // Collect all exams in this section for bulk download
                                        const allExamsInSection = Object.values(seriesMap).flat();

                                        return (
                                            <div key={sec}>
                                                {/* Section sub-header */}
                                                <div className="flex items-center justify-between bg-indigo-50/60 dark:bg-indigo-500/8 border-b border-indigo-100 dark:border-indigo-500/15 px-5 py-2.5">
                                                    <button
                                                        className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
                                                        onClick={() => toggleSection(sectionKey)}
                                                    >
                                                        {isSecCollapsed
                                                            ? <ChevronRight className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                                                            : <ChevronDown className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                                                        }
                                                        <span className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">
                                                            {sec === 'All' ? 'All Sections' : `Section ${sec}`}
                                                        </span>
                                                        <span className="text-xs text-indigo-400 dark:text-indigo-500">{totalInSection} exam{totalInSection !== 1 ? 's' : ''}</span>
                                                    </button>
                                                </div>

                                                {/* Exam Series sub-groups within this section */}
                                                {!isSecCollapsed && Object.entries(seriesMap).map(([series, examList]) => {
                                                    const seriesKey = `${cls}-${sec}-${series}`;
                                                    const isSeriesCollapsed = collapsedSeries.has(seriesKey);
                                                    const cfg = SERIES_CONFIG[series] || SERIES_CONFIG.Custom;

                                                    return (
                                                        <div key={series}>
                                                            {/* Exam Series header */}
                                                            <button
                                                                className={`w-full flex items-center justify-between px-6 py-2 border-b ${cfg.border} ${cfg.bg} hover:opacity-90 transition-opacity`}
                                                                onClick={() => toggleSeries(seriesKey)}
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                    {isSeriesCollapsed
                                                                        ? <ChevronRight className={`h-3 w-3 ${cfg.color}`} />
                                                                        : <ChevronDown className={`h-3 w-3 ${cfg.color}`} />
                                                                    }
                                                                    <Layers className={`h-3.5 w-3.5 ${cfg.color}`} />
                                                                    <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label || series}</span>
                                                                    <span className="text-[10px] text-gray-400 dark:text-[#636366] bg-white/60 dark:bg-[#1C1C1E]/60 px-1.5 py-0.5 rounded-full">
                                                                        {examList.length}
                                                                    </span>
                                                                </div>
                                                            </button>

                                                            {/* Exam rows */}
                                                            {!isSeriesCollapsed && (
                                                                <div className="overflow-x-auto">
                                                                    <table className="w-full text-sm min-w-[700px]">
                                                                        <thead>
                                                                            <tr className="bg-gray-50/80 dark:bg-[#2C2C2E]/80 border-b border-gray-100 dark:border-[#38383A]">
                                                                                <th className="px-5 py-2 text-left text-[11px] font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Date</th>
                                                                                <th className="px-5 py-2 text-left text-[11px] font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Exam Name</th>
                                                                                <th className="px-5 py-2 text-left text-[11px] font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Subject</th>
                                                                                <th className="px-5 py-2 text-left text-[11px] font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Time</th>
                                                                                <th className="px-5 py-2 text-left text-[11px] font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Marks</th>
                                                                                <th className="px-5 py-2 text-left text-[11px] font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Status</th>
                                                                                <th className="px-5 py-2 text-right text-[11px] font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Actions</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody>
                                                                            {examList.map((exam, idx) => (
                                                                                <tr key={exam._id} className={`border-b border-gray-50 dark:border-[#38383A] transition-colors hover:bg-primary-50/40 dark:hover:bg-primary-500/5 ${idx % 2 === 0 ? 'bg-white dark:bg-[#1C1C1E]' : 'bg-gray-50/30 dark:bg-[#2C2C2E]/20'}`}>
                                                                                    <td className="px-5 py-3">
                                                                                        <div className="flex items-center gap-1.5 text-gray-700 dark:text-[#8E8E93]">
                                                                                            <Calendar className="h-3.5 w-3.5 text-gray-400 dark:text-[#636366] shrink-0" />
                                                                                            {formatDate(exam.date)}
                                                                                        </div>
                                                                                    </td>
                                                                                    <td className="px-5 py-3">
                                                                                        <div className="font-semibold text-gray-900 dark:text-white">{exam.name}</div>
                                                                                        <div className="text-xs text-gray-400 dark:text-[#636366]">{exam.examType}</div>
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
                                                                                            <span className="text-gray-400 dark:text-[#636366] text-xs ml-1">pass: {exam.passingMarks}</span>
                                                                                        )}
                                                                                    </td>
                                                                                    <td className="px-5 py-3">
                                                                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${STATUS_COLORS[exam.status] || ''} ${STATUS_RING[exam.status] || ''}`}>
                                                                                            {exam.status}
                                                                                        </span>
                                                                                    </td>
                                                                                    <td className="px-5 py-3">
                                                                                        <div className="flex items-center gap-1.5 justify-end">
                                                                                            <button
                                                                                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-500/10 hover:bg-teal-100 dark:hover:bg-teal-500/20 transition-colors"
                                                                                                onClick={() => setSelectedExam(exam)}
                                                                                                title="Enter / View Results"
                                                                                            >
                                                                                                <ClipboardList className="h-3.5 w-3.5" />
                                                                                                Results
                                                                                            </button>
                                                                                            {(user.role === 'admin' || user.role === 'teacher') && (
                                                                                                <>
                                                                                                    <button
                                                                                                        className="p-1.5 rounded-lg text-gray-400 dark:text-[#636366] hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors"
                                                                                                        onClick={() => openEdit(exam)}
                                                                                                        title="Edit exam"
                                                                                                    >
                                                                                                        <Edit className="h-3.5 w-3.5" />
                                                                                                    </button>
                                                                                                    <button
                                                                                                        className="p-1.5 rounded-lg text-gray-400 dark:text-[#636366] hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                                                                                                        onClick={() => handleDelete(exam._id)}
                                                                                                        title="Delete exam"
                                                                                                    >
                                                                                                        <Trash2 className="h-3.5 w-3.5" />
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
                            );
                        })}
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {/* ══════════════════════════════════════
                REPORT CARDS TAB
            ══════════════════════════════════════ */}
            {activeTab === 'reportCards' && (() => {
                const filteredRcStudents = rcStudentSearch.trim()
                    ? rcStudents.filter(s => {
                        const q = rcStudentSearch.toLowerCase();
                        return (s.fullName || s.name || '').toLowerCase().includes(q)
                            || (s.admissionNumber || '').toLowerCase().includes(q)
                            || (s.rollNumber || '').toLowerCase().includes(q);
                    })
                    : rcStudents;

                const handleIndividualDownload = async (studentId, studentName, type = 'regular') => {
                    const key = `${studentId}-${type}`;
                    setRcDownloading(prev => ({ ...prev, [key]: true }));
                    try {
                        let blob;
                        if (type === 'blank') {
                            blob = await examsService.downloadBlankReportCardPDF(studentId, {});
                        } else {
                            blob = await examsService.downloadReportCardPDF(studentId, {});
                        }
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${type === 'blank' ? 'Blank_' : ''}Report_Card_${(studentName || 'Student').replace(/\s+/g, '_')}.pdf`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        window.URL.revokeObjectURL(url);
                        toast.success(`${type === 'blank' ? 'Blank r' : 'R'}eport card downloaded`);
                    } catch (err) {
                        let msg = 'Failed to download report card';
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
                        console.error('Download error:', err);
                    } finally {
                        setRcDownloading(prev => ({ ...prev, [key]: false }));
                    }
                };

                return (
                <div className="space-y-6">
                    {/* Class & Section Selection */}
                    <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass border border-gray-100 dark:border-[#38383A] p-6">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                            <GraduationCap className="h-4 w-4 text-primary-500" />
                            Select Class & Section
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
                            <div>
                                <label className="label mb-1.5 block text-gray-600 dark:text-[#8E8E93] text-xs font-medium">Class</label>
                                <Select
                                    value={rcClass}
                                    onChange={e => { setRcClass(e.target.value); setRcSection(''); setRcStudentSearch(''); }}
                                    placeholder="Select Class"
                                    options={[
                                        { value: '', label: 'Select Class' },
                                        ...availableClasses.map(c => ({ value: c.grade, label: c.name }))
                                    ]}
                                />
                            </div>
                            <div>
                                <label className="label mb-1.5 block text-gray-600 dark:text-[#8E8E93] text-xs font-medium">Section</label>
                                <Select
                                    value={rcSection}
                                    onChange={e => { setRcSection(e.target.value); setRcStudentSearch(''); }}
                                    disabled={!rcClass}
                                    placeholder="Select Section"
                                    options={[
                                        { value: '', label: 'Select Section' },
                                        ...rcSections.map(s => ({ value: s.name, label: `Section ${s.name}` }))
                                    ]}
                                />
                            </div>
                        </div>
                        {rcClass && rcSection && !rcSectionId && (
                            <p className="mt-3 text-xs text-red-500 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" /> Could not resolve section ID. Please verify the class and section exist.
                            </p>
                        )}
                    </div>

                    {/* Custom Report Card — always visible */}
                    <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass border border-gray-100 dark:border-[#38383A] p-5 hover:shadow-lg transition-shadow">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-violet-100 dark:bg-violet-500/20">
                                    <Edit className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                                </div>
                                <div>
                                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Custom Report Card</h4>
                                    <p className="text-xs text-gray-500 dark:text-[#8E8E93]">Manually fill in subjects, marks & exam details to generate a report card</p>
                                </div>
                            </div>
                            <button
                                className="btn gap-2 bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-500/20 border border-violet-200 dark:border-violet-500/20 shrink-0"
                                onClick={() => setShowCustomReportCard(true)}
                            >
                                <Edit className="h-4 w-4" /> Create Custom
                            </button>
                        </div>
                    </div>

                    {/* Bulk Download Actions */}
                    {rcClass && rcSection && rcSectionId && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass border border-gray-100 dark:border-[#38383A] p-5 hover:shadow-lg transition-shadow">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="p-2.5 rounded-xl bg-teal-100 dark:bg-teal-500/20">
                                        <Download className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white">All Report Cards</h4>
                                        <p className="text-xs text-gray-500 dark:text-[#8E8E93]">With marks filled in</p>
                                    </div>
                                </div>
                                <button className="btn btn-primary w-full gap-2" onClick={() => handleBulkDownload(rcSectionId, rcClass, 'regular')}>
                                    <Download className="h-4 w-4" /> Download All
                                </button>
                            </div>
                            <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass border border-gray-100 dark:border-[#38383A] p-5 hover:shadow-lg transition-shadow">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="p-2.5 rounded-xl bg-gray-100 dark:bg-gray-500/20">
                                        <FileText className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Blank Report Cards</h4>
                                        <p className="text-xs text-gray-500 dark:text-[#8E8E93]">Without marks</p>
                                    </div>
                                </div>
                                <button className="btn w-full gap-2 bg-gray-100 dark:bg-[#2C2C2E] text-gray-700 dark:text-[#8E8E93] hover:bg-gray-200 dark:hover:bg-[#38383A] border border-gray-200 dark:border-[#38383A]" onClick={() => handleBulkDownload(rcSectionId, rcClass, 'blank')}>
                                    <FileText className="h-4 w-4" /> Download Blank
                                </button>
                            </div>
                            <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass border border-gray-100 dark:border-[#38383A] p-5 hover:shadow-lg transition-shadow">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-500/20">
                                        <BarChart3 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Cumulative</h4>
                                        <p className="text-xs text-gray-500 dark:text-[#8E8E93]">All exams combined</p>
                                    </div>
                                </div>
                                <button className="btn w-full gap-2 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-500/20" onClick={() => handleCumulativeDownload(rcSectionId)}>
                                    <BarChart3 className="h-4 w-4" /> Download Cumulative
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Individual Student Report Cards with Search */}
                    {rcClass && rcSection && rcSectionId && (
                        <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass border border-gray-100 dark:border-[#38383A] overflow-hidden">
                            <div className="px-5 py-3.5 border-b border-gray-100 dark:border-[#38383A]">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                        <User className="h-4 w-4 text-primary-500" />
                                        Individual Student Report Cards
                                    </h3>
                                    <span className="text-xs text-gray-400 dark:text-[#636366]">
                                        {rcStudentSearch.trim() ? `${filteredRcStudents.length} of ` : ''}{rcStudents.length} student{rcStudents.length !== 1 ? 's' : ''}
                                    </span>
                                </div>
                                {/* Search bar */}
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-[#636366] pointer-events-none" />
                                    <input
                                        type="text"
                                        className="input w-full pl-9 pr-8"
                                        placeholder="Search by name, admission no, or roll no..."
                                        value={rcStudentSearch}
                                        onChange={e => setRcStudentSearch(e.target.value)}
                                    />
                                    {rcStudentSearch && (
                                        <button className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-gray-100 dark:hover:bg-[#38383A]" onClick={() => setRcStudentSearch('')}>
                                            <X className="h-3.5 w-3.5 text-gray-400 dark:text-[#636366]" />
                                        </button>
                                    )}
                                </div>
                            </div>
                            {rcStudentsLoading ? (
                                <div className="flex justify-center py-12"><div className="loading-spinner" /></div>
                            ) : rcStudents.length === 0 ? (
                                <div className="flex flex-col items-center py-12 text-gray-400 dark:text-[#636366]">
                                    <User className="h-8 w-8 mb-2 opacity-30" />
                                    <p className="text-sm">No students found in this class and section.</p>
                                </div>
                            ) : filteredRcStudents.length === 0 ? (
                                <div className="flex flex-col items-center py-12 text-gray-400 dark:text-[#636366]">
                                    <Search className="h-8 w-8 mb-2 opacity-30" />
                                    <p className="text-sm">No students match "{rcStudentSearch}"</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="bg-gray-50 dark:bg-[#2C2C2E] border-b border-gray-100 dark:border-[#38383A]">
                                                <th className="px-5 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase">Roll</th>
                                                <th className="px-5 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase">Student Name</th>
                                                <th className="px-5 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase">Adm. No</th>
                                                <th className="px-5 py-2.5 text-right text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredRcStudents.map((student, idx) => {
                                                const sid = student._id || student.id;
                                                const sname = student.fullName || student.name || 'Student';
                                                return (
                                                <tr key={sid} className={`border-b border-gray-50 dark:border-[#38383A] hover:bg-primary-50/40 dark:hover:bg-primary-500/5 ${idx % 2 === 0 ? '' : 'bg-gray-50/30 dark:bg-[#2C2C2E]/20'}`}>
                                                    <td className="px-5 py-3 text-gray-500 dark:text-[#8E8E93] text-xs">{student.rollNumber || '—'}</td>
                                                    <td className="px-5 py-3 font-medium text-gray-900 dark:text-white">{sname}</td>
                                                    <td className="px-5 py-3 text-gray-500 dark:text-[#8E8E93] text-xs font-mono">{student.admissionNumber || '—'}</td>
                                                    <td className="px-5 py-3">
                                                        <div className="flex items-center gap-1.5 justify-end flex-wrap">
                                                            <button
                                                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-500/10 hover:bg-primary-100 dark:hover:bg-primary-500/20 transition-colors"
                                                                onClick={() => setResultCardTarget({ studentId: sid, studentName: sname, examSeries: '' })}
                                                            >
                                                                <FileText className="h-3.5 w-3.5" />
                                                                View
                                                            </button>
                                                            <button
                                                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-500/10 hover:bg-teal-100 dark:hover:bg-teal-500/20 transition-colors disabled:opacity-50"
                                                                onClick={() => handleIndividualDownload(sid, sname, 'regular')}
                                                                disabled={rcDownloading[`${sid}-regular`]}
                                                            >
                                                                <Download className="h-3.5 w-3.5" />
                                                                {rcDownloading[`${sid}-regular`] ? 'Downloading...' : 'PDF'}
                                                            </button>
                                                            <button
                                                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-[#2C2C2E] hover:bg-gray-200 dark:hover:bg-[#38383A] transition-colors disabled:opacity-50"
                                                                onClick={() => handleIndividualDownload(sid, sname, 'blank')}
                                                                disabled={rcDownloading[`${sid}-blank`]}
                                                            >
                                                                <FileText className="h-3.5 w-3.5" />
                                                                {rcDownloading[`${sid}-blank`] ? 'Downloading...' : 'Blank'}
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {!rcClass && (
                        <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass border border-gray-100 dark:border-[#38383A] flex flex-col items-center py-16 text-gray-400 dark:text-[#636366]">
                            <GraduationCap className="h-10 w-10 mb-3 opacity-30" />
                            <p className="font-medium">Select a class and section</p>
                            <p className="text-sm mt-1">Choose a class and section above to download report cards.</p>
                        </div>
                    )}

                    {rcClass && !rcSection && (
                        <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass border border-gray-100 dark:border-[#38383A] flex flex-col items-center py-16 text-gray-400 dark:text-[#636366]">
                            <Layers className="h-10 w-10 mb-3 opacity-30" />
                            <p className="font-medium">Select a section</p>
                            <p className="text-sm mt-1">Choose a section for Class {rcClass} to proceed.</p>
                        </div>
                    )}
                </div>
                );
            })()}

            {/* ══════════════════════════════════════
                Schedule New Exam Modal
            ══════════════════════════════════════ */}
            {showAddModal && createPortal(
                <div className="modal-overlay" role="dialog" aria-modal="true">
                    <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-2xl w-full max-w-2xl mx-2 sm:mx-4 max-h-[92vh] flex flex-col">

                        {/* Modal header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-[#38383A] shrink-0">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{editing ? 'Edit Exam' : 'Schedule New Exam'}</h3>
                                <p className="text-xs text-gray-400 dark:text-[#636366] mt-0.5">{editing ? 'Update exam details' : 'Select exam pattern, class, and subject to schedule'}</p>
                            </div>
                            <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-[#2C2C2E] transition-colors" onClick={closeModal}>
                                <X className="h-5 w-5 text-gray-500 dark:text-[#8E8E93]" />
                            </button>
                        </div>

                        {/* Scrollable body */}
                        <form onSubmit={handleCreate} className="overflow-y-auto flex-1 px-4 sm:px-6 py-5 space-y-6">

                            {/* ── Section 1: Term Selection ── */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-white">
                                    <Layers className="h-4 w-4 text-primary-500" />
                                    SELECT TERM
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    {TERMS.map(term => (
                                        <button
                                            key={term}
                                            type="button"
                                            onClick={() => {
                                                setForm(prev => ({
                                                    ...prev,
                                                    term,
                                                    examSeries: TERM_EXAM_TYPES[term][0]
                                                }));
                                            }}
                                            className={`px-4 py-4 rounded-xl text-sm font-bold border-2 transition-all ${
                                                form.term === term
                                                    ? term === 'Term 1'
                                                        ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-500/30 ring-2 ring-blue-200 dark:ring-blue-500/20'
                                                        : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/30 ring-2 ring-emerald-200 dark:ring-emerald-500/20'
                                                    : 'bg-white dark:bg-[#2C2C2E] text-gray-500 dark:text-[#8E8E93] border-gray-200 dark:border-[#38383A] hover:border-gray-300'
                                            }`}
                                        >
                                            {term}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* ── Section 1b: Exam Type ── */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-white">
                                    <GraduationCap className="h-4 w-4 text-primary-500" />
                                    EXAM TYPE
                                </div>
                                <p className="text-xs text-gray-400 dark:text-[#636366]">Select the type of exam for {form.term}</p>
                                <div className="flex flex-wrap gap-2">
                                    {(TERM_EXAM_TYPES[form.term] || []).map(series => {
                                        const cfg = SERIES_CONFIG[series] || SERIES_CONFIG.Custom;
                                        const isActive = form.examSeries === series;
                                        return (
                                            <button
                                                key={series}
                                                type="button"
                                                onClick={() => setForm(prev => ({ ...prev, examSeries: series }))}
                                                className={`px-4 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${
                                                    isActive
                                                        ? `${cfg.bg} ${cfg.color} ${cfg.border} ring-2 ring-offset-1 dark:ring-offset-[#1C1C1E] ${cfg.border}`
                                                        : 'bg-white dark:bg-[#2C2C2E] text-gray-500 dark:text-[#8E8E93] border-gray-200 dark:border-[#38383A] hover:border-gray-300'
                                                }`}
                                            >
                                                {cfg.short}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* ── Section 2: Exam Details ── */}
                            <ModalSection icon={<BookOpen className="h-4 w-4" />} title="Exam Details">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="sm:col-span-2">
                                        <FieldLabel required>Exam Name</FieldLabel>
                                        <input
                                            className={`input ${formErrors.name ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
                                            placeholder={`e.g. ${form.examSeries} Physics`}
                                            value={form.name}
                                            onChange={e => handleField('name', e.target.value)}
                                        />
                                        <FieldError msg={formErrors.name} />
                                    </div>
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

                            {/* ── Section 3: Class & Subject ── */}
                            <ModalSection icon={<User className="h-4 w-4" />} title="Class & Subject">
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
                                                ...availableClasses.map(cls => ({ value: cls.grade, label: cls.name }))
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
                                            placeholder="All Sections"
                                            options={[
                                                { value: '', label: 'All Sections' },
                                                ...sections.map(s => ({ value: s.name, label: `Section ${s.name}` }))
                                            ]}
                                        />
                                    </div>
                                    <div>
                                        <FieldLabel required>Subject</FieldLabel>
                                        {classSubjects.length > 0 ? (
                                            <Select
                                                value={form.subject}
                                                onChange={e => handleField('subject', e.target.value)}
                                                placeholder="Select Subject"
                                                className={formErrors.subject ? '[&_button]:border-red-400' : ''}
                                                options={[
                                                    { value: '', label: 'Select Subject' },
                                                    ...classSubjects.map(s => ({ value: typeof s.name === 'string' ? s.name : String(s.name), label: typeof s.name === 'string' ? s.name : String(s.name) }))
                                                ]}
                                            />
                                        ) : (
                                            <input
                                                className={`input ${formErrors.subject ? 'border-red-400' : ''}`}
                                                placeholder="Type subject name"
                                                value={form.subject}
                                                onChange={e => handleField('subject', e.target.value)}
                                            />
                                        )}
                                        <FieldError msg={formErrors.subject} />
                                    </div>
                                </div>
                            </ModalSection>

                            {/* ── Section 4: Schedule ── */}
                            <ModalSection icon={<Calendar className="h-4 w-4" />} title="Schedule">
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
                                {form.startTime && form.endTime && calcDuration(form.startTime, form.endTime) && (
                                    <div className="flex items-center gap-1.5 mt-2 text-sm text-teal-600 dark:text-teal-400 font-medium">
                                        <Clock className="h-4 w-4" />
                                        Duration: {calcDuration(form.startTime, form.endTime)}
                                    </div>
                                )}
                            </ModalSection>

                            {/* ── Section 5: Marks ── */}
                            <ModalSection icon={<CheckCircle2 className="h-4 w-4" />} title="Marks">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <FieldLabel required>Total Marks</FieldLabel>
                                        <input type="number" min="1" max="100" className={`input ${formErrors.totalMarks ? 'border-red-400' : ''}`} value={form.totalMarks} onChange={e => handleField('totalMarks', e.target.value)} />
                                        <FieldError msg={formErrors.totalMarks} />
                                    </div>
                                    <div>
                                        <FieldLabel>Passing Marks</FieldLabel>
                                        <input type="number" min="0" className={`input ${formErrors.passingMarks ? 'border-red-400' : ''}`} value={form.passingMarks} onChange={e => handleField('passingMarks', e.target.value)} />
                                        <FieldError msg={formErrors.passingMarks} />
                                    </div>
                                </div>
                                {form.totalMarks > 0 && form.passingMarks > 0 && Number(form.passingMarks) < Number(form.totalMarks) && (
                                    <p className="text-xs text-gray-400 dark:text-[#636366] mt-1">Pass threshold: {Math.round((form.passingMarks / form.totalMarks) * 100)}%</p>
                                )}
                            </ModalSection>

                            {/* ── Section 6: Staff & Location ── */}
                            <ModalSection icon={<MapPin className="h-4 w-4" />} title="Staff & Location">
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
                                        <input className="input" placeholder="e.g. Room 201" value={form.examRoom} onChange={e => handleField('examRoom', e.target.value)} />
                                    </div>
                                </div>
                            </ModalSection>

                            {/* ── Section 7: Status (edit only) ── */}
                            {editing && (
                                <ModalSection icon={<AlertCircle className="h-4 w-4" />} title="Status">
                                    <div className="flex items-center gap-3 flex-wrap">
                                        <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${STATUS_COLORS[form.status] || 'bg-gray-100 dark:bg-[#2C2C2E] text-gray-600 dark:text-[#8E8E93]'} ${STATUS_RING[form.status] || ''}`}>
                                            {form.status}
                                        </span>
                                        <p className="text-xs text-gray-400 dark:text-[#636366]">Status updates automatically based on date & time</p>
                                        {form.status !== 'Cancelled' && (
                                            <button type="button" onClick={() => handleField('status', 'Cancelled')}
                                                className="ml-auto px-3 py-1.5 rounded-lg text-xs font-medium border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                                            >Cancel Exam</button>
                                        )}
                                        {form.status === 'Cancelled' && (
                                            <button type="button" onClick={() => handleField('status', 'Scheduled')}
                                                className="ml-auto px-3 py-1.5 rounded-lg text-xs font-medium border border-blue-200 dark:border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors"
                                            >Restore Exam</button>
                                        )}
                                    </div>
                                </ModalSection>
                            )}

                        </form>

                        {/* Modal Footer */}
                        <div className="px-4 sm:px-6 py-4 border-t border-gray-100 dark:border-[#38383A] shrink-0 flex flex-col-reverse sm:flex-row justify-end gap-3 bg-gray-50 dark:bg-[#2C2C2E] rounded-b-2xl">
                            <button type="button" className="btn btn-ghost w-full sm:w-auto" onClick={closeModal}>Cancel</button>
                            <button onClick={handleCreate} disabled={submitting} className="btn btn-primary w-full sm:w-auto">
                                {submitting ? 'Saving…' : (editing ? 'Update Exam' : 'Schedule Exam')}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Results Modal */}
            {selectedExam && (
                <ExamResultsModal exam={selectedExam} onClose={() => setSelectedExam(null)} />
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

            {/* Bulk download progress modal */}
            {bulkJob && (
                <BulkDownloadProgress jobId={bulkJob.jobId} totalStudents={bulkJob.totalStudents} onClose={() => setBulkJob(null)} />
            )}

            {/* Custom Report Card modal */}
            {showCustomReportCard && (
                <CustomReportCardModal
                    onClose={() => setShowCustomReportCard(false)}
                    students={rcStudents}
                    classes={availableClasses}
                    subjects={allSubjects}
                />
            )}
        </div>
    );
};

/* ── Helpers ── */
const ModalSection = ({ icon, title, children }) => (
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
