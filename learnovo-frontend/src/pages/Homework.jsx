import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Calendar, BookOpen, Clock, CheckCircle, XCircle, Eye, Edit, Trash2, Filter, Download } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import homeworkService from '../services/homeworkService';
import { classesService } from '../services/classesService';
import { subjectsService } from '../services/subjectsService';
import { attendanceService } from '../services/attendanceService';
import { teacherAssignmentsService } from '../services/academicsService';
import { sortClassObjects } from '../utils/classOrder';
import HomeworkForm from '../components/homework/HomeworkForm';
import HomeworkDetailsModal from '../components/homework/HomeworkDetailsModal';
import HomeworkSubmissionForm from '../components/homework/HomeworkSubmissionForm';
import toast from 'react-hot-toast';
import { formatDateShort } from '../utils/formatDate';

const Homework = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const isTeacher = user?.role === 'teacher' || user?.role === 'admin';
    const isStudent = user?.role === 'student';

    // Filter state
    const [searchQuery, setSearchQuery] = useState('');
    const [subjectFilter, setSubjectFilter] = useState('');
    const [classFilter, setClassFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState(''); // For students: all, pending, submitted
    const [showFilters, setShowFilters] = useState(false);

    // UI state
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [showSubmissionModal, setShowSubmissionModal] = useState(false);
    const [selectedHomework, setSelectedHomework] = useState(null);
    const [editingHomework, setEditingHomework] = useState(null);

    // Fetch filter options (classes + subjects) — teacher sees only their assigned ones
    const { data: classes = [] } = useQuery({
        queryKey: ['homework-classes', user?.role],
        queryFn: async () => {
            if (user?.role === 'teacher') {
                const res = await attendanceService.getTeacherClasses();
                return sortClassObjects(res?.data || [], 'name');
            }
            const res = await classesService.list();
            return sortClassObjects(res.success ? (res.data || []) : [], 'name');
        },
    });

    const { data: subjects = [] } = useQuery({
        queryKey: ['homework-subjects', user?.role, classes],
        queryFn: async () => {
            if (user?.role === 'teacher') {
                const [subjectsRes, assignmentsRes] = await Promise.all([
                    subjectsService.list(),
                    teacherAssignmentsService.list({ teacherId: user._id })
                ]);
                const allSubjects = subjectsRes.success ? (subjectsRes.data || []) : [];
                const mySubjectIds = new Set((assignmentsRes.data || []).map(a => (a.subjectId?._id || a.subjectId)));
                let filtered = allSubjects.filter(s => mySubjectIds.has(s._id));
                // Fallback: use subjects from teacher's class data
                if (filtered.length === 0 && classes.length > 0) {
                    const classSubjectIds = new Set();
                    classes.forEach(cls => (cls.subjects || []).forEach(s => {
                        if (s._id) classSubjectIds.add(s._id.toString());
                    }));
                    filtered = allSubjects.filter(s => classSubjectIds.has(s._id));
                    if (filtered.length === 0) {
                        const subjectMap = new Map();
                        classes.forEach(cls => (cls.subjects || []).forEach(s => {
                            if (s._id && s.name) subjectMap.set(s._id, s);
                        }));
                        filtered = Array.from(subjectMap.values());
                    }
                }
                return filtered;
            }
            const res = await subjectsService.list();
            return res.success ? (res.data || []) : [];
        },
    });

    // Fetch homework list
    const { data: rawHomework = [], isLoading } = useQuery({
        queryKey: ['homework', subjectFilter, classFilter],
        queryFn: async () => {
            const filters = { subject: subjectFilter, class: classFilter };
            const response = await homeworkService.getHomeworkList(filters);
            return response.success ? (response.data || []) : [];
        },
    });

    // Client-side filtering for status and search
    const homework = useMemo(() => {
        let data = rawHomework;

        if (statusFilter) {
            if (isStudent) {
                // Student submission-based filtering
                data = data.filter(hw => {
                    if (statusFilter === 'pending') {
                        return !hw.mySubmission || hw.mySubmission.status === 'pending';
                    } else if (statusFilter === 'submitted') {
                        return hw.mySubmission && hw.mySubmission.status !== 'pending';
                    }
                    return true;
                });
            } else {
                // Teacher/admin: filter by homework lifecycle status from backend
                data = data.filter(hw => hw.status === statusFilter);
            }
        }

        // Apply search filter
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            data = data.filter(hw =>
                (hw.title || '').toLowerCase().includes(q) ||
                (hw.description || '').toLowerCase().includes(q)
            );
        }

        return data;
    }, [rawHomework, isStudent, isTeacher, statusFilter, searchQuery]);

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: (id) => homeworkService.deleteHomework(id),
        onSuccess: () => {
            toast.success('Homework deleted successfully');
            queryClient.invalidateQueries({ queryKey: ['homework'] });
        },
        onError: () => {
            toast.error('Failed to delete homework');
        },
    });

    const handleCreateHomework = () => {
        setEditingHomework(null);
        setShowCreateModal(true);
    };

    const handleEditHomework = (hw) => {
        setEditingHomework(hw);
        setShowCreateModal(true);
    };

    const handleDeleteHomework = async (id) => {
        if (!window.confirm('Are you sure you want to delete this homework?')) return;
        deleteMutation.mutate(id);
    };

    const handleViewDetails = (hw) => {
        setSelectedHomework(hw);
        setShowDetailsModal(true);
    };

    const handleSubmitHomework = (hw) => {
        setSelectedHomework(hw);
        setShowSubmissionModal(true);
    };

    const handleDeleteSubmission = async (hw) => {
        if (!window.confirm('Are you sure you want to delete your submission?')) return;
        try {
            await homeworkService.deleteSubmission(hw._id);
            toast.success('Submission deleted successfully');
            queryClient.invalidateQueries({ queryKey: ['homework'] });
        } catch {
            toast.error('Failed to delete submission');
        }
    };

    const handleFormSuccess = () => {
        setShowCreateModal(false);
        setEditingHomework(null);
        queryClient.invalidateQueries({ queryKey: ['homework'] });
    };

    const handleSubmissionSuccess = () => {
        setShowSubmissionModal(false);
        setSelectedHomework(null);
        queryClient.invalidateQueries({ queryKey: ['homework'] });
    };

    const HOMEWORK_STATUS_COLORS = {
        pending: 'bg-gray-100 text-gray-700 dark:bg-gray-500/20 dark:text-gray-400',
        active: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
        overdue: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400',
        expired: 'bg-gray-200 text-gray-500 dark:bg-[#2C2C2E] dark:text-[#636366]',
    };

    const getStatusBadge = (hw) => {
        if (isStudent) {
            const submission = hw.mySubmission;
            const isOverdue = new Date(hw.dueDate) < new Date() && (!submission || submission.status === 'pending');

            if (isOverdue) {
                return <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-400">Overdue</span>;
            } else if (submission?.status === 'reviewed') {
                return <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-400">Reviewed</span>;
            } else if (submission?.status === 'submitted') {
                return <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-400">Submitted</span>;
            } else {
                return <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-400">Pending</span>;
            }
        }

        // For teachers/admins — show homework lifecycle status
        if (hw.status) {
            const label = hw.status.charAt(0).toUpperCase() + hw.status.slice(1);
            return (
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${HOMEWORK_STATUS_COLORS[hw.status] || ''}`}>
                    {label}
                </span>
            );
        }
        return null;
    };

    const formatDate = (date) => formatDateShort(date);

    const [exportingHw, setExportingHw] = useState(false);
    const handleExportHomework = async () => {
        try {
            setExportingHw(true);
            const response = await homeworkService.exportHomework();
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `homework_export_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            toast.success('Homework exported successfully');
        } catch (err) {
            toast.error('Failed to export homework');
        } finally {
            setExportingHw(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                        {isTeacher ? 'Homework Management' : 'My Homework'}
                    </h1>
                    <p className="text-gray-600 dark:text-[#8E8E93] mt-1">
                        {isTeacher
                            ? 'Create and manage homework assignments for your classes'
                            : 'View and submit your homework assignments'}
                    </p>
                </div>
                {isTeacher && (
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button
                            onClick={handleExportHomework}
                            disabled={exportingHw}
                            className="btn btn-outline flex items-center gap-2 justify-center"
                        >
                            <Download className="h-4 w-4" />
                            {exportingHw ? 'Exporting...' : 'Export'}
                        </button>
                        <button
                            onClick={handleCreateHomework}
                            className="btn btn-primary flex items-center gap-2 flex-1 sm:flex-none justify-center"
                        >
                            <Plus className="h-5 w-5" />
                            Create Homework
                        </button>
                    </div>
                )}
            </div>

            {/* Filters */}
            <div className="card p-4">
                <div className="flex flex-col lg:flex-row gap-4">
                    {/* Search */}
                    <div className="flex-1">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                            <input
                                type="text"
                                placeholder="Search homework..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-[#38383A] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-[#1C1C1E] dark:text-white"
                            />
                        </div>
                    </div>

                    {/* Filter Toggle */}
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className="btn btn-outline flex items-center gap-2 lg:hidden"
                    >
                        <Filter className="h-5 w-5" />
                        Filters
                    </button>

                    {/* Filters Row */}
                    <div className={`flex flex-col sm:flex-row gap-4 ${showFilters ? 'block' : 'hidden lg:flex'}`}>
                        {/* Subject Filter */}
                        <select
                            value={subjectFilter}
                            onChange={(e) => setSubjectFilter(e.target.value)}
                            className="px-4 py-2 border border-gray-300 dark:border-[#38383A] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-[#1C1C1E] dark:text-white"
                        >
                            <option value="">All Subjects</option>
                            {subjects.map((subject) => (
                                <option key={subject._id} value={subject._id}>
                                    {subject.name}
                                </option>
                            ))}
                        </select>

                        {/* Class Filter (for teachers) */}
                        {isTeacher && (
                            <select
                                value={classFilter}
                                onChange={(e) => setClassFilter(e.target.value)}
                                className="px-4 py-2 border border-gray-300 dark:border-[#38383A] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-[#1C1C1E] dark:text-white"
                            >
                                <option value="">All Classes</option>
                                {classes.map((cls) => (
                                    <option key={cls._id} value={cls._id}>
                                        {cls.name}
                                    </option>
                                ))}
                            </select>
                        )}

                        {/* Status Filter */}
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="px-4 py-2 border border-gray-300 dark:border-[#38383A] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-[#1C1C1E] dark:text-white"
                        >
                            <option value="">All Status</option>
                            {isStudent ? (
                                <>
                                    <option value="pending">Pending</option>
                                    <option value="submitted">Submitted</option>
                                </>
                            ) : (
                                <>
                                    <option value="active">Active</option>
                                    <option value="overdue">Overdue</option>
                                    <option value="expired">Expired</option>
                                    <option value="pending">Pending</option>
                                </>
                            )}
                        </select>
                    </div>
                </div>
            </div>

            {/* Homework List */}
            {isLoading ? (
                <div className="flex justify-center items-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
                </div>
            ) : homework.length === 0 ? (
                <div className="card p-12 text-center">
                    <BookOpen className="h-12 w-12 text-gray-400 dark:text-[#636366] mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No homework found</h3>
                    <p className="text-gray-600 dark:text-[#8E8E93]">
                        {isTeacher
                            ? 'Create your first homework assignment to get started'
                            : 'No homework assignments available at the moment'}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                    {homework.map((hw) => (
                        <div
                            key={hw._id}
                            className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass border border-gray-200 dark:border-[#38383A] p-4 sm:p-6 hover:shadow-glass-md transition-shadow"
                        >
                            {/* Header */}
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex-1">
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">{hw.title}</h3>
                                    <p className="text-sm text-gray-600 dark:text-[#8E8E93]">{hw.subject?.name}</p>
                                </div>
                                {getStatusBadge(hw)}
                            </div>

                            {/* Description */}
                            <p className="text-gray-700 dark:text-[#8E8E93] text-sm mb-4 line-clamp-2">{hw.description}</p>

                            {/* Meta Info */}
                            <div className="space-y-2 mb-4">
                                {isTeacher && (
                                    <div className="flex items-center text-sm text-gray-600 dark:text-[#8E8E93]">
                                        <BookOpen className="h-4 w-4 mr-2" />
                                        {hw.class?.name} {hw.section?.name && `- ${hw.section.name}`}
                                    </div>
                                )}
                                <div className="flex items-center text-sm text-gray-600 dark:text-[#8E8E93]">
                                    <Calendar className="h-4 w-4 mr-2" />
                                    Assigned: {formatDate(hw.assignedDate)}
                                </div>
                                {(() => {
                                    const due = new Date(hw.dueDate);
                                    due.setHours(23, 59, 59, 999);
                                    const now = new Date();
                                    const daysLeft = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
                                    const isOverdue = daysLeft < 0;
                                    const isDueToday = daysLeft === 0;
                                    const colorClass = isOverdue
                                        ? 'text-red-600 dark:text-red-400'
                                        : isDueToday
                                            ? 'text-amber-600 dark:text-amber-400'
                                            : 'text-emerald-600 dark:text-emerald-400';
                                    return (
                                        <div className={`flex items-center text-sm font-medium ${colorClass}`}>
                                            <Clock className="h-4 w-4 mr-2" />
                                            Due: {formatDate(hw.dueDate)}
                                            {isOverdue && <span className="ml-2 text-xs">(Overdue)</span>}
                                            {isDueToday && <span className="ml-2 text-xs">(Due Today)</span>}
                                            {!isOverdue && !isDueToday && <span className="ml-2 text-xs">({daysLeft}d left)</span>}
                                        </div>
                                    );
                                })()}
                                {isTeacher && hw.submissionStats && (
                                    <div className="flex items-center text-sm text-gray-600 dark:text-[#8E8E93]">
                                        <CheckCircle className="h-4 w-4 mr-2" />
                                        {hw.submissionStats.submitted}/{hw.submissionStats.total} submitted
                                    </div>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2">
                                {isTeacher ? (
                                    <>
                                        <button
                                            onClick={() => handleViewDetails(hw)}
                                            className="flex-1 btn btn-sm btn-outline flex items-center justify-center gap-1"
                                        >
                                            <Eye className="h-4 w-4" />
                                            View
                                        </button>
                                        <button
                                            onClick={() => handleEditHomework(hw)}
                                            className="btn btn-sm btn-outline flex items-center justify-center gap-1"
                                        >
                                            <Edit className="h-4 w-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteHomework(hw._id)}
                                            className="btn btn-sm btn-outline text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 flex items-center justify-center gap-1"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button
                                            onClick={() => handleViewDetails(hw)}
                                            className="flex-1 btn btn-sm btn-outline flex items-center justify-center gap-1"
                                        >
                                            <Eye className="h-4 w-4" />
                                            View
                                        </button>
                                        <button
                                            onClick={() => handleSubmitHomework(hw)}
                                            className="flex-1 btn btn-sm btn-primary flex items-center justify-center gap-1"
                                        >
                                            <Edit className="h-4 w-4" />
                                            {hw.mySubmission && hw.mySubmission.status !== 'pending' ? 'Edit Submission' : hw.mySubmission ? 'Edit' : 'Submit'}
                                        </button>
                                        {hw.mySubmission && hw.mySubmission.status !== 'pending' && (
                                            <button
                                                onClick={() => handleDeleteSubmission(hw)}
                                                className="btn btn-sm btn-outline text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 flex items-center justify-center gap-1"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modals */}
            {showCreateModal && (
                <HomeworkForm
                    homework={editingHomework}
                    onClose={() => {
                        setShowCreateModal(false);
                        setEditingHomework(null);
                    }}
                    onSuccess={handleFormSuccess}
                />
            )}

            {showDetailsModal && selectedHomework && (
                <HomeworkDetailsModal
                    homework={selectedHomework}
                    onClose={() => {
                        setShowDetailsModal(false);
                        setSelectedHomework(null);
                    }}
                    onRefresh={() => queryClient.invalidateQueries({ queryKey: ['homework'] })}
                />
            )}

            {showSubmissionModal && selectedHomework && (
                <HomeworkSubmissionForm
                    homework={selectedHomework}
                    onClose={() => {
                        setShowSubmissionModal(false);
                        setSelectedHomework(null);
                    }}
                    onSuccess={handleSubmissionSuccess}
                />
            )}
        </div>
    );
};

export default Homework;
