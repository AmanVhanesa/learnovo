import React, { useState, useEffect } from 'react';
import { Plus, Search, Calendar, BookOpen, Clock, CheckCircle, XCircle, Eye, Edit, Trash2, Filter } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import homeworkService from '../services/homeworkService';
import { classesService } from '../services/classesService';
import { subjectsService } from '../services/subjectsService';
import HomeworkForm from '../components/homework/HomeworkForm';
import HomeworkDetailsModal from '../components/homework/HomeworkDetailsModal';
import HomeworkSubmissionForm from '../components/homework/HomeworkSubmissionForm';
import toast from 'react-hot-toast';

const Homework = () => {
    const { user } = useAuth();
    const isTeacher = user?.role === 'teacher' || user?.role === 'admin';
    const isStudent = user?.role === 'student';

    // Data state
    const [homework, setHomework] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [classes, setClasses] = useState([]);
    const [subjects, setSubjects] = useState([]);

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

    useEffect(() => {
        fetchHomework();
        fetchFilterOptions();
    }, [subjectFilter, classFilter, statusFilter]);

    const fetchFilterOptions = async () => {
        try {
            const [classesRes, subjectsRes] = await Promise.all([
                classesService.list(),
                subjectsService.list()
            ]);

            if (classesRes.success) setClasses(classesRes.data || []);
            if (subjectsRes.success) setSubjects(subjectsRes.data || []);
        } catch (error) {
            console.error('Error fetching filter options:', error);
        }
    };

    const fetchHomework = async () => {
        try {
            setIsLoading(true);
            const filters = {
                subject: subjectFilter,
                class: classFilter
            };

            const response = await homeworkService.getHomeworkList(filters);
            if (response.success) {
                let homeworkData = response.data || [];

                // For students, filter by status if selected
                if (isStudent && statusFilter) {
                    homeworkData = homeworkData.filter(hw => {
                        if (statusFilter === 'pending') {
                            return !hw.mySubmission || hw.mySubmission.status === 'pending';
                        } else if (statusFilter === 'submitted') {
                            return hw.mySubmission && hw.mySubmission.status !== 'pending';
                        }
                        return true;
                    });
                }

                // Apply search filter
                if (searchQuery) {
                    homeworkData = homeworkData.filter(hw =>
                        hw.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        hw.description.toLowerCase().includes(searchQuery.toLowerCase())
                    );
                }

                setHomework(homeworkData);
            }
        } catch (error) {
            console.error('Error fetching homework:', error);
            toast.error('Failed to load homework');
        } finally {
            setIsLoading(false);
        }
    };

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

        try {
            await homeworkService.deleteHomework(id);
            toast.success('Homework deleted successfully');
            fetchHomework();
        } catch (error) {
            toast.error('Failed to delete homework');
        }
    };

    const handleViewDetails = (hw) => {
        setSelectedHomework(hw);
        setShowDetailsModal(true);
    };

    const handleSubmitHomework = (hw) => {
        setSelectedHomework(hw);
        setShowSubmissionModal(true);
    };

    const handleFormSuccess = () => {
        setShowCreateModal(false);
        setEditingHomework(null);
        fetchHomework();
    };

    const handleSubmissionSuccess = () => {
        setShowSubmissionModal(false);
        setSelectedHomework(null);
        fetchHomework();
    };

    const getStatusBadge = (hw) => {
        if (!isStudent) return null;

        const submission = hw.mySubmission;
        const isOverdue = new Date(hw.dueDate) < new Date() && (!submission || submission.status === 'pending');

        if (isOverdue) {
            return <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">Overdue</span>;
        } else if (submission?.status === 'reviewed') {
            return <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">Reviewed</span>;
        } else if (submission?.status === 'submitted') {
            return <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">Submitted</span>;
        } else {
            return <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">Pending</span>;
        }
    };

    const formatDate = (date) => {
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                        {isTeacher ? 'Homework Management' : 'My Homework'}
                    </h1>
                    <p className="text-gray-600 mt-1">
                        {isTeacher
                            ? 'Create and manage homework assignments for your classes'
                            : 'View and submit your homework assignments'}
                    </p>
                </div>
                {isTeacher && (
                    <button
                        onClick={handleCreateHomework}
                        className="btn btn-primary flex items-center gap-2"
                    >
                        <Plus className="h-5 w-5" />
                        Create Homework
                    </button>
                )}
            </div>

            {/* Filters */}
            <div className="bg-white rounded-lg shadow-sm p-4">
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
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
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
                            className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
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
                                className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                            >
                                <option value="">All Classes</option>
                                {classes.map((cls) => (
                                    <option key={cls._id} value={cls._id}>
                                        {cls.name}
                                    </option>
                                ))}
                            </select>
                        )}

                        {/* Status Filter (for students) */}
                        {isStudent && (
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                            >
                                <option value="">All Status</option>
                                <option value="pending">Pending</option>
                                <option value="submitted">Submitted</option>
                            </select>
                        )}
                    </div>
                </div>
            </div>

            {/* Homework List */}
            {isLoading ? (
                <div className="flex justify-center items-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
                </div>
            ) : homework.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm p-12 text-center">
                    <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No homework found</h3>
                    <p className="text-gray-600">
                        {isTeacher
                            ? 'Create your first homework assignment to get started'
                            : 'No homework assignments available at the moment'}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {homework.map((hw) => (
                        <div
                            key={hw._id}
                            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
                        >
                            {/* Header */}
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex-1">
                                    <h3 className="text-lg font-semibold text-gray-900 mb-1">{hw.title}</h3>
                                    <p className="text-sm text-gray-600">{hw.subject?.name}</p>
                                </div>
                                {getStatusBadge(hw)}
                            </div>

                            {/* Description */}
                            <p className="text-gray-700 text-sm mb-4 line-clamp-2">{hw.description}</p>

                            {/* Meta Info */}
                            <div className="space-y-2 mb-4">
                                {isTeacher && (
                                    <div className="flex items-center text-sm text-gray-600">
                                        <BookOpen className="h-4 w-4 mr-2" />
                                        {hw.class?.name} {hw.section?.name && `- ${hw.section.name}`}
                                    </div>
                                )}
                                <div className="flex items-center text-sm text-gray-600">
                                    <Calendar className="h-4 w-4 mr-2" />
                                    Assigned: {formatDate(hw.assignedDate)}
                                </div>
                                <div className="flex items-center text-sm text-gray-600">
                                    <Clock className="h-4 w-4 mr-2" />
                                    Due: {formatDate(hw.dueDate)}
                                </div>
                                {isTeacher && hw.submissionStats && (
                                    <div className="flex items-center text-sm text-gray-600">
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
                                            className="btn btn-sm btn-outline text-red-600 hover:bg-red-50 flex items-center justify-center gap-1"
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
                                        {(!hw.mySubmission || hw.mySubmission.status === 'pending') && (
                                            <button
                                                onClick={() => handleSubmitHomework(hw)}
                                                className="flex-1 btn btn-sm btn-primary flex items-center justify-center gap-1"
                                            >
                                                {hw.mySubmission ? 'Edit' : 'Submit'}
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
                    onRefresh={fetchHomework}
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
