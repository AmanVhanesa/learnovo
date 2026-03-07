import React, { useState, useEffect, useMemo } from 'react';
import {
    Plus, Search, Calendar, Trash2, X, ClipboardList,
    Clock, BookOpen, User, MapPin, ChevronDown, AlertCircle, CheckCircle2, FileText
} from 'lucide-react';
import { examsService } from '../services/examsService';
import { classesService } from '../services/classesService';
import { teachersService } from '../services/teachersService';
import ExamResultsModal from '../components/ExamResultsModal';
import ResultCard from '../components/ResultCard';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';

const STATUS_COLORS = {
    Scheduled: 'bg-blue-100 text-blue-700',
    Ongoing: 'bg-amber-100 text-amber-700',
    Completed: 'bg-green-100 text-green-700',
    Cancelled: 'bg-red-100 text-red-700',
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

    /* ── Data lists ── */
    const [exams, setExams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [availableClasses, setClasses] = useState([]);
    const [sections, setSections] = useState([]);
    const [teachers, setTeachers] = useState([]);

    /* ── Modal / selection state ── */
    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedExam, setSelectedExam] = useState(null);
    const [resultCardTarget, setResultCardTarget] = useState(null); // { student, examSeries }
    const [form, setForm] = useState(EMPTY_FORM);
    const [formErrors, setFormErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);

    /* ── Filter state ── */
    const [filterStatus, setFilterStatus] = useState('');
    const [filterClass, setFilterClass] = useState('');
    const [searchText, setSearchText] = useState('');

    /* ── Load data on mount ── */
    useEffect(() => { fetchExams(); fetchClasses(); fetchTeachers(); }, []);

    const fetchExams = async () => {
        try {
            setLoading(true);
            const res = await examsService.list();
            setExams(res.data || []);
        } catch { toast.error('Failed to load exams'); }
        finally { setLoading(false); }
    };

    const fetchClasses = async () => {
        try {
            const res = await classesService.list();
            setClasses(res.data || []);
        } catch { toast.error('Failed to load classes'); }
    };

    const fetchTeachers = async () => {
        try {
            const res = await teachersService.list({ limit: 100 });
            setTeachers(res.data || res.teachers || []);
        } catch { /* non-critical */ }
    };

    /* ── When class changes, load its sections ── */
    useEffect(() => {
        setSections([]);
        setForm(prev => ({ ...prev, section: '' }));
        if (!form.classId) return;
        classesService.getSections(form.classId)
            .then(res => setSections(res.data || []))
            .catch(() => { });
    }, [form.classId]);

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

    /* ── Field change handler ── */
    const handleField = (key, value) => {
        setForm(prev => {
            const next = { ...prev, [key]: value };
            // If class changes, update classId too
            if (key === 'class') {
                const cls = availableClasses.find(c => c.grade === value);
                next.classId = cls ? cls._id : '';
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

    /* ── Submit handler ── */
    const handleCreate = async (e) => {
        e.preventDefault();
        const errors = validate();
        if (Object.keys(errors).length) { setFormErrors(errors); return; }

        setSubmitting(true);
        try {
            await examsService.create(form);
            toast.success('Exam scheduled successfully');
            setShowAddModal(false);
            setForm(EMPTY_FORM);
            setFormErrors({});
            fetchExams();
        } catch (err) {
            const msg = err?.response?.data?.message || 'Failed to create exam';
            toast.error(msg);
        } finally { setSubmitting(false); }
    };

    /* ── Delete handler ── */
    const handleDelete = async (id) => {
        if (!window.confirm('Delete this exam and all its results?')) return;
        try {
            await examsService.delete(id);
            toast.success('Exam deleted');
            fetchExams();
        } catch { toast.error('Failed to delete exam'); }
    };

    /* ── Close / reset modal ── */
    const closeModal = () => {
        setShowAddModal(false);
        setForm(EMPTY_FORM);
        setFormErrors({});
        setSections([]);
    };

    /* ── Render ── */
    return (
        <div className="space-y-6">

            {/* ── Header ── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h1 className="text-2xl font-bold text-gray-900">Exams &amp; Results</h1>
                {(user.role === 'admin' || user.role === 'teacher') && (
                    <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Schedule Exam
                    </button>
                )}
            </div>

            {/* ── Filters ── */}
            <div className="flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[180px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                        className="input pl-9"
                        placeholder="Search exams…"
                        value={searchText}
                        onChange={e => setSearchText(e.target.value)}
                    />
                </div>
                <select className="input w-auto" value={filterClass} onChange={e => setFilterClass(e.target.value)}>
                    <option value="">All Classes</option>
                    {availableClasses.map(c => (
                        <option key={c._id} value={c.grade}>
                            {c.name === c.grade ? c.name : `${c.name} (${c.grade})`}
                        </option>
                    ))}
                </select>
                <select className="input w-auto" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                    <option value="">All Statuses</option>
                    {EXAM_STATUSES.map(s => <option key={s}>{s}</option>)}
                </select>
            </div>

            {/* ── Table ── */}
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Exam Name</th>
                                <th>Class / Section</th>
                                <th>Subject</th>
                                <th>Time</th>
                                <th>Marks</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="8" className="text-center py-10">
                                    <div className="loading-spinner mx-auto" />
                                </td></tr>
                            ) : filteredExams.length === 0 ? (
                                <tr><td colSpan="8" className="text-center py-10 text-gray-400">
                                    No exams found
                                </td></tr>
                            ) : filteredExams.map(exam => (
                                <tr key={exam._id}>
                                    <td>
                                        <div className="flex items-center gap-1.5 text-gray-700">
                                            <Calendar className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                                            {new Date(exam.date).toLocaleDateString()}
                                        </div>
                                    </td>
                                    <td>
                                        <div className="font-medium text-gray-900">{exam.name}</div>
                                        {exam.examSeries && (
                                            <div className="text-xs text-gray-400">{exam.examSeries}</div>
                                        )}
                                    </td>
                                    <td>
                                        <span className="badge badge-blue">{exam.class}</span>
                                        {exam.section && (
                                            <span className="ml-1 text-xs text-gray-500">/ {exam.section}</span>
                                        )}
                                    </td>
                                    <td className="text-gray-700">{exam.subject}</td>
                                    <td>
                                        {exam.startTime && exam.endTime ? (
                                            <div className="flex items-center gap-1 text-xs text-gray-600">
                                                <Clock className="h-3 w-3 text-gray-400" />
                                                {exam.startTime}–{exam.endTime}
                                                <span className="text-gray-400">
                                                    ({calcDuration(exam.startTime, exam.endTime)})
                                                </span>
                                            </div>
                                        ) : (
                                            <span className="text-gray-300 text-xs">—</span>
                                        )}
                                    </td>
                                    <td>
                                        <span className="font-medium">{exam.totalMarks}</span>
                                        {exam.passingMarks != null && (
                                            <span className="text-gray-400 text-xs ml-1">/ {exam.passingMarks} pass</span>
                                        )}
                                    </td>
                                    <td>
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[exam.status] || 'bg-gray-100 text-gray-600'}`}>
                                            {exam.status}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="flex items-center gap-2">
                                            <button
                                                className="btn btn-sm btn-outline text-teal-600 hover:bg-teal-50"
                                                onClick={() => setSelectedExam(exam)}
                                                title="Enter / View Results"
                                            >
                                                <ClipboardList className="h-3.5 w-3.5 mr-1" />
                                                Results
                                            </button>
                                            {(user.role === 'admin' || user.role === 'teacher') && (
                                                <button
                                                    className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                                                    onClick={() => handleDelete(exam._id)}
                                                    title="Delete exam"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ══════════════════════════════════════
                Schedule New Exam Modal
            ══════════════════════════════════════ */}
            {showAddModal && (
                <div className="modal-overlay" role="dialog" aria-modal="true">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[92vh] flex flex-col">

                        {/* Modal header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900">Schedule New Exam</h3>
                                <p className="text-xs text-gray-400 mt-0.5">Fill in all required fields to schedule an exam</p>
                            </div>
                            <button className="p-2 rounded-lg hover:bg-gray-100 transition-colors" onClick={closeModal}>
                                <X className="h-5 w-5 text-gray-500" />
                            </button>
                        </div>

                        {/* Scrollable body */}
                        <form onSubmit={handleCreate} className="overflow-y-auto flex-1 px-6 py-5 space-y-6">

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
                                        <select className="input" value={form.examSeries} onChange={e => handleField('examSeries', e.target.value)}>
                                            {EXAM_SERIES.map(s => <option key={s}>{s}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </ModalSection>

                            {/* ── Section 2: Class Details ── */}
                            <ModalSection icon={<User className="h-4 w-4" />} title="Class Details">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div>
                                        <FieldLabel required>Class</FieldLabel>
                                        <select
                                            className={`input ${formErrors.class ? 'border-red-400' : ''}`}
                                            value={form.class}
                                            onChange={e => handleField('class', e.target.value)}
                                        >
                                            <option value="">Select Class</option>
                                            {availableClasses.map(cls => (
                                                <option key={cls._id} value={cls.grade}>
                                                    {cls.name === cls.grade ? cls.name : `${cls.name} (${cls.grade})`}
                                                </option>
                                            ))}
                                        </select>
                                        <FieldError msg={formErrors.class} />
                                    </div>
                                    <div>
                                        <FieldLabel>Section</FieldLabel>
                                        <select
                                            className="input"
                                            value={form.section}
                                            onChange={e => handleField('section', e.target.value)}
                                            disabled={!form.classId}
                                        >
                                            <option value="">All / Select</option>
                                            {sections.map(s => (
                                                <option key={s._id} value={s.name}>{s.name}</option>
                                            ))}
                                        </select>
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
                                        <input
                                            type="date"
                                            className={`input ${formErrors.date ? 'border-red-400' : ''}`}
                                            value={form.date}
                                            onChange={e => handleField('date', e.target.value)}
                                        />
                                        <FieldError msg={formErrors.date} />
                                    </div>
                                    <div>
                                        <FieldLabel>Start Time</FieldLabel>
                                        <input
                                            type="time"
                                            className="input"
                                            value={form.startTime}
                                            onChange={e => handleField('startTime', e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <FieldLabel>End Time</FieldLabel>
                                        <input
                                            type="time"
                                            className={`input ${formErrors.endTime ? 'border-red-400' : ''}`}
                                            value={form.endTime}
                                            onChange={e => handleField('endTime', e.target.value)}
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
                                        <p className="text-xs text-gray-400 mt-1">
                                            Pass threshold: {Math.round((form.passingMarks / form.totalMarks) * 100)}%
                                        </p>
                                    )}
                            </ModalSection>

                            {/* ── Section 5: Exam Information ── */}
                            <ModalSection icon={<ClipboardList className="h-4 w-4" />} title="Exam Information">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <FieldLabel>Exam Type</FieldLabel>
                                        <select className="input" value={form.examType} onChange={e => handleField('examType', e.target.value)}>
                                            {EXAM_TYPES.map(t => <option key={t}>{t}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <FieldLabel>Exam Mode</FieldLabel>
                                        <select className="input" value={form.examMode} onChange={e => handleField('examMode', e.target.value)}>
                                            {EXAM_MODES.map(m => <option key={m}>{m}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </ModalSection>

                            {/* ── Section 6: Staff & Location ── */}
                            <ModalSection icon={<MapPin className="h-4 w-4" />} title="Staff &amp; Location">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <FieldLabel>Exam Supervisor</FieldLabel>
                                        <select className="input" value={form.supervisor} onChange={e => handleField('supervisor', e.target.value)}>
                                            <option value="">Select Teacher</option>
                                            {teachers.map(t => (
                                                <option key={t._id} value={t._id}>{t.name}</option>
                                            ))}
                                        </select>
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
                                                    : 'border-gray-200 text-gray-500 hover:border-gray-400'}`}
                                        >
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            </ModalSection>

                        </form>

                        {/* Modal Footer */}
                        <div className="px-6 py-4 border-t border-gray-100 shrink-0 flex justify-end gap-3 bg-gray-50 rounded-b-xl">
                            <button type="button" className="btn btn-ghost" onClick={closeModal}>Cancel</button>
                            <button
                                onClick={handleCreate}
                                disabled={submitting}
                                className="btn btn-primary"
                            >
                                {submitting ? 'Scheduling…' : 'Schedule Exam'}
                            </button>
                        </div>
                    </div>
                </div>
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
        </div>
    );
};

/* ── Helpers ── */
const ModalSection = ({ icon, title, children }) => (
    <div>
        <div className="flex items-center gap-2 mb-3">
            <span className="text-primary-600">{icon}</span>
            <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{title}</h4>
        </div>
        <div className="pl-6 border-l-2 border-gray-100">
            {children}
        </div>
    </div>
);

const FieldLabel = ({ children, required }) => (
    <label className="label mb-1 block text-gray-700">
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
