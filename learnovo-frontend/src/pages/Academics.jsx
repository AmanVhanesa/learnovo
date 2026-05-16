import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { Calendar, BookOpen, Users, UserPlus, Plus, Check, Lock, Unlock, Power, Trash2, Edit, X, ChevronDown, GraduationCap } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { academicSessionsService, classesService, subjectsService, classSubjectsService, teacherAssignmentsService } from '../services/academicsService'
import { employeesService } from '../services/employeesService'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'

// Helper function to format dates consistently as DD/MM/YYYY
const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
};

// Helper function to sort classes by grade order
const sortClassesByGrade = (classes) => {
    const gradeOrder = {
        'Nursery': 0,
        'LKG': 1,
        'UKG': 2,
        '1': 3, '2': 4, '3': 5, '4': 6, '5': 7, '6': 8,
        '7': 9, '8': 10, '9': 11, '10': 12, '11': 13, '12': 14
    };

    return [...classes].sort((a, b) => {
        const gradeA = gradeOrder[a.grade] ?? 999;
        const gradeB = gradeOrder[b.grade] ?? 999;
        return gradeA - gradeB;
    });
};

// Format grade for display: 1 → 1st, 2 → 2nd, 3 → 3rd, etc.
const formatGrade = (grade) => {
    const n = parseInt(grade);
    if (isNaN(n)) return grade; // Nursery, LKG, UKG — unchanged
    const suffixes = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    const suffix = suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0];
    return `${n}${suffix}`;
};

const AcademicsManagement = () => {
    const { user } = useAuth()
    const queryClient = useQueryClient()
    const [activeTab, setActiveTab] = useState('sessions')

    // UI state for modals
    const [showSessionForm, setShowSessionForm] = useState(false)
    const [editingSession, setEditingSession] = useState(null)
    const [showClassForm, setShowClassForm] = useState(false)
    const [editingClass, setEditingClass] = useState(null)
    const [showSubjectForm, setShowSubjectForm] = useState(false)
    const [editingSubject, setEditingSubject] = useState(null)
    const [showAssignmentForm, setShowAssignmentForm] = useState(false)

    // Sessions query
    const { data: sessionsData, isLoading } = useQuery({
        queryKey: ['academic-sessions'],
        queryFn: async () => {
            const [sessionsRes, activeRes] = await Promise.all([
                academicSessionsService.list(),
                academicSessionsService.getActive().catch(() => ({ data: null }))
            ])
            return { sessions: sessionsRes.data || [], activeSession: activeRes.data }
        },
    })
    const sessions = sessionsData?.sessions || []
    const activeSession = sessionsData?.activeSession || null

    // Classes query
    const { data: classes = [] } = useQuery({
        queryKey: ['academic-classes'],
        queryFn: async () => { const res = await classesService.list(); return sortClassesByGrade(res.data || []) },
    })

    // Subjects query
    const { data: subjects = [] } = useQuery({
        queryKey: ['academic-subjects'],
        queryFn: async () => { const res = await subjectsService.list(); return res.data || [] },
    })

    // Teachers query
    const { data: teachers = [] } = useQuery({
        queryKey: ['academic-teachers'],
        queryFn: async () => { const res = await employeesService.list({ role: 'teacher', limit: 100 }); return res.data || [] },
    })

    // Assignments query (subjects + assignments tabs need class-subject mappings)
    const { data: assignmentsData } = useQuery({
        queryKey: ['academic-assignments', activeSession?._id],
        queryFn: async () => {
            const [csRes, taRes] = await Promise.all([
                classSubjectsService.list({ academicSessionId: activeSession._id }),
                teacherAssignmentsService.list({ academicSessionId: activeSession._id })
            ])
            return { classSubjects: csRes.data || [], teacherAssignments: taRes.data || [] }
        },
        enabled: (activeTab === 'assignments' || activeTab === 'subjects') && !!activeSession,
    })
    const classSubjects = assignmentsData?.classSubjects || []
    const teacherAssignments = assignmentsData?.teacherAssignments || []

    // Mutations
    const activateSessionMutation = useMutation({
        mutationFn: (id) => academicSessionsService.activate(id),
        onSuccess: () => { toast.success('Academic session activated successfully'); queryClient.invalidateQueries({ queryKey: ['academic-sessions'] }) },
        onError: (error) => { toast.error(error.response?.data?.message || 'Failed to activate session') },
    })
    const lockSessionMutation = useMutation({
        mutationFn: ({ id, lock }) => academicSessionsService.lock(id, lock),
        onSuccess: (_, { lock }) => { toast.success(`Session ${lock ? 'locked' : 'unlocked'} successfully`); queryClient.invalidateQueries({ queryKey: ['academic-sessions'] }) },
        onError: () => { toast.error('Failed to lock/unlock session') },
    })
    const deleteSessionMutation = useMutation({
        mutationFn: (id) => academicSessionsService.remove(id),
        onSuccess: () => { toast.success('Session deleted successfully'); queryClient.invalidateQueries({ queryKey: ['academic-sessions'] }) },
        onError: (error) => { toast.error(error.response?.data?.message || 'Failed to delete session') },
    })
    const deleteClassMutation = useMutation({
        mutationFn: (id) => classesService.remove(id),
        onSuccess: () => { toast.success('Class deleted successfully'); queryClient.invalidateQueries({ queryKey: ['academic-classes'] }) },
        onError: (error) => { toast.error(error.response?.data?.message || 'Failed to delete class') },
    })
    const deleteSubjectMutation = useMutation({
        mutationFn: (id) => subjectsService.remove(id),
        onSuccess: () => { toast.success('Subject deleted successfully'); queryClient.invalidateQueries({ queryKey: ['academic-subjects'] }); queryClient.invalidateQueries({ queryKey: ['academic-assignments'] }) },
        onError: (error) => { toast.error(error.response?.data?.message || 'Failed to delete subject') },
    })
    const toggleSubjectMutation = useMutation({
        mutationFn: (id) => subjectsService.toggle(id),
        onSuccess: () => { toast.success('Subject status updated'); queryClient.invalidateQueries({ queryKey: ['academic-subjects'] }); queryClient.invalidateQueries({ queryKey: ['academic-assignments'] }) },
        onError: () => { toast.error('Failed to update subject status') },
    })
    const deleteClassSubjectMutation = useMutation({
        mutationFn: (id) => classSubjectsService.remove(id),
        onSuccess: () => { toast.success('Subject assignment removed'); queryClient.invalidateQueries({ queryKey: ['academic-assignments'] }) },
        onError: (error) => { toast.error(error.response?.data?.message || 'Failed to remove assignment') },
    })
    const deleteTeacherAssignmentMutation = useMutation({
        mutationFn: (id) => teacherAssignmentsService.remove(id),
        onSuccess: () => { toast.success('Teacher assignment removed'); queryClient.invalidateQueries({ queryKey: ['academic-assignments'] }) },
        onError: (error) => { toast.error(error.response?.data?.message || 'Failed to remove teacher assignment') },
    })

    const handleActivateSession = async (id) => { activateSessionMutation.mutate(id) }
    const handleLockSession = async (id, lock) => { lockSessionMutation.mutate({ id, lock }) }
    const handleDeleteSession = async (id) => {
        if (!confirm('Are you sure you want to delete this academic session?')) return
        deleteSessionMutation.mutate(id)
    }
    const handleDeleteClass = async (id) => {
        if (!confirm('Are you sure you want to delete this class?')) return
        deleteClassMutation.mutate(id)
    }
    const handleDeleteSubject = async (id) => {
        if (!confirm('Are you sure you want to delete this subject?')) return
        deleteSubjectMutation.mutate(id)
    }
    const handleToggleSubject = async (id) => { toggleSubjectMutation.mutate(id) }
    const handleDeleteClassSubject = async (csId, assignments) => {
        if (!confirm('Are you sure you want to remove this subject assignment? This will also remove any teacher assignments for this subject in this class.')) return
        // Delete associated teacher assignments first
        for (const ta of assignments) {
            await teacherAssignmentsService.remove(ta._id).catch(() => {})
        }
        deleteClassSubjectMutation.mutate(csId)
    }
    const handleDeleteTeacherAssignment = async (taId) => {
        if (!confirm('Are you sure you want to remove this teacher from this subject?')) return
        deleteTeacherAssignmentMutation.mutate(taId)
    }

    const tabs = [
        { id: 'sessions', label: 'Academic Sessions', icon: Calendar },
        { id: 'classes', label: 'Classes & Sections', icon: BookOpen },
        { id: 'subjects', label: 'Subjects', icon: BookOpen },
        { id: 'assignments', label: 'Subject Assignments', icon: UserPlus }
    ]

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="loading-spinner"></div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Academics Management</h1>
                    <p className="text-sm text-gray-500 dark:text-[#8E8E93] mt-1">
                        Manage academic sessions, classes, subjects, and assignments
                    </p>
                </div>
            </div>

            {/* Active Session Banner */}
            {activeSession && (
                <div className="bg-gradient-to-r from-primary-50 to-primary-100 dark:from-[#1a3a35] dark:to-[#162e2a] border border-primary-200 dark:border-[#2a5a52] rounded-lg p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary-600 rounded-lg flex-shrink-0">
                                <Calendar className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-primary-900 dark:text-primary-300">Active Academic Session</p>
                                <p className="text-base sm:text-lg font-bold text-primary-700 dark:text-white">{activeSession.name}</p>
                            </div>
                        </div>
                        <div className="text-left sm:text-right ml-12 sm:ml-0">
                            <p className="text-xs text-primary-600 dark:text-primary-400">
                                {formatDate(activeSession.startDate)} - {formatDate(activeSession.endDate)}
                            </p>
                            {activeSession.isLocked && (
                                <span className="inline-flex items-center gap-1 mt-1 px-2 py-1 bg-yellow-100 dark:bg-[#332d1a] text-yellow-800 dark:text-yellow-400 text-xs rounded-full">
                                    <Lock className="h-3 w-3" />
                                    Locked
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="border-b border-gray-200 dark:border-[#38383A] overflow-x-auto overflow-y-hidden">
                <nav className="-mb-px flex space-x-8 whitespace-nowrap">
                    {tabs.map((tab) => {
                        const Icon = tab.icon
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${activeTab === tab.id
                                    ? 'border-primary-500 text-primary-600'
                                    : 'border-transparent text-gray-500 dark:text-[#8E8E93] hover:text-gray-700 dark:hover:text-white hover:border-gray-300 dark:hover:border-[#38383A]'
                                    }`}
                            >
                                <Icon className="h-4 w-4" />
                                {tab.label}
                            </button>
                        )
                    })}
                </nav>
            </div>

            {/* Tab Content */}
            <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass">
                {/* SESSIONS TAB */}
                {activeTab === 'sessions' && (
                    <div className="p-4 sm:p-6">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
                            <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Academic Sessions</h2>
                            {user?.role === 'admin' && (
                                <button
                                    onClick={() => {
                                        setEditingSession(null)
                                        setShowSessionForm(true)
                                    }}
                                    className="btn btn-primary"
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Session
                                </button>
                            )}
                        </div>

                        {sessions.length === 0 ? (
                            <div className="text-center py-12">
                                <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                                <p className="text-gray-500 dark:text-[#8E8E93]">No academic sessions found</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {sessions.map((session) => (
                                    <div
                                        key={session._id}
                                        className={`border rounded-2xl p-4 ${session.isActive ? 'border-primary-300 dark:border-[#2a5a52] bg-primary-50 dark:bg-[#1a3a35]' : 'border-gray-200 dark:border-[#38383A] dark:bg-[#2C2C2E]'
                                            }`}
                                    >
                                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                                            <div className="flex-1">
                                                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                                                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">{session.name}</h3>
                                                    {session.isActive && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-[#1a332a] text-green-800 dark:text-green-400 text-xs font-semibold rounded-full">
                                                            <Check className="h-3 w-3" />
                                                            Active
                                                        </span>
                                                    )}
                                                    {session.isLocked && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 dark:bg-[#332d1a] text-yellow-800 dark:text-yellow-400 text-xs font-semibold rounded-full">
                                                            <Lock className="h-3 w-3" />
                                                            Locked
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-sm text-gray-600 dark:text-[#8E8E93] mt-1">
                                                    {formatDate(session.startDate)} - {formatDate(session.endDate)}
                                                </p>
                                            </div>

                                            {user?.role === 'admin' && (
                                                <div className="flex items-center gap-2">
                                                    {!session.isActive && (
                                                        <button
                                                            onClick={() => handleActivateSession(session._id)}
                                                            className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-[#1a332a] rounded-md"
                                                            title="Activate"
                                                        >
                                                            <Power className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                    {!session.isLocked && (
                                                        <button
                                                            onClick={() => {
                                                                setEditingSession(session)
                                                                setShowSessionForm(true)
                                                            }}
                                                            className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-[#1a2533] rounded-md"
                                                            title="Edit"
                                                        >
                                                            <Edit className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleLockSession(session._id, !session.isLocked)}
                                                        className="p-2 text-yellow-600 hover:bg-yellow-50 dark:hover:bg-[#332d1a] rounded-md"
                                                        title={session.isLocked ? 'Unlock' : 'Lock'}
                                                    >
                                                        {session.isLocked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                                                    </button>
                                                    {!session.isActive && !session.isLocked && (
                                                        <button
                                                            onClick={() => handleDeleteSession(session._id)}
                                                            className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-[#331a1a] rounded-md"
                                                            title="Delete"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* CLASSES TAB */}
                {activeTab === 'classes' && (
                    <div className="p-4 sm:p-6">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
                            <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Classes & Sections</h2>
                            {user?.role === 'admin' && (
                                <button
                                    onClick={() => {
                                        setEditingClass(null)
                                        setShowClassForm(true)
                                    }}
                                    className="btn btn-primary"
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Class
                                </button>
                            )}
                        </div>

                        {classes.length === 0 ? (
                            <div className="text-center py-12">
                                <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                                <p className="text-gray-500 dark:text-[#8E8E93]">No classes found</p>
                            </div>
                        ) : (() => {
                            // Group classes by grade
                            const gradeOrder = { 'Nursery': 0, 'LKG': 1, 'UKG': 2, '1': 3, '2': 4, '3': 5, '4': 6, '5': 7, '6': 8, '7': 9, '8': 10, '9': 11, '10': 12, '11': 13, '12': 14 };
                            const grouped = classes.reduce((acc, cls) => {
                                const g = cls.grade || 'Unknown';
                                if (!acc[g]) acc[g] = [];
                                acc[g].push(cls);
                                return acc;
                            }, {});
                            const sortedGrades = Object.keys(grouped).sort((a, b) => (gradeOrder[a] ?? 99) - (gradeOrder[b] ?? 99));

                            return (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {sortedGrades.map(grade => {
                                        const gradeClasses = grouped[grade];
                                        // Flatten all sections from all classes of this grade
                                        const allSections = gradeClasses.flatMap(cls => cls.sections || []);
                                        const totalStudents = gradeClasses.reduce((sum, cls) => sum + (cls.studentCount || 0), 0);
                                        const academicYear = gradeClasses[0]?.academicYear || '';

                                        return (
                                            <div key={grade} className="border border-gray-200 dark:border-[#38383A] bg-white dark:bg-[#2C2C2E] rounded-2xl p-4 hover:shadow-md dark:hover:shadow-none dark:hover:border-[#48484A] transition-all">
                                                {/* Grade Header */}
                                                <div className="flex items-start justify-between mb-3">
                                                    <div>
                                                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">{formatGrade(grade)}</h3>
                                                        <p className="text-xs text-gray-500 dark:text-[#8E8E93]">{academicYear}</p>
                                                    </div>
                                                    {user?.role === 'admin' && (
                                                        <div className="flex gap-1">
                                                            <button
                                                                onClick={() => {
                                                                    // Build a synthetic edit object with ALL sections from this grade
                                                                    setEditingClass({
                                                                        ...gradeClasses[0],
                                                                        sections: allSections
                                                                    })
                                                                    setShowClassForm(true)
                                                                }}
                                                                className="p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-[#1a2533] rounded"
                                                                title="Edit"
                                                            >
                                                                <Edit className="h-4 w-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteClass(gradeClasses[0]._id)}
                                                                className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-[#331a1a] rounded"
                                                                title="Delete"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Stats */}
                                                <div className="flex gap-4 text-sm mb-3">
                                                    <span className="text-gray-500 dark:text-[#8E8E93]"><strong className="text-gray-800 dark:text-white">{totalStudents}</strong> Students</span>
                                                    <span className="text-gray-500 dark:text-[#8E8E93]"><strong className="text-gray-800 dark:text-white">{allSections.length}</strong> Sections</span>
                                                </div>

                                                {/* Sections List */}
                                                {allSections.length > 0 && (
                                                    <div className="space-y-1.5">
                                                        <p className="text-xs font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wide">Sections</p>
                                                        {allSections.map(section => (
                                                            <div key={section._id} className="flex items-center justify-between bg-gray-50 dark:bg-[#2C2C2E] rounded px-2.5 py-1.5">
                                                                <div>
                                                                    <span className="text-sm font-medium text-gray-800 dark:text-white uppercase">{section.name}</span>
                                                                    {(section.sectionTeacher?.fullName || section.sectionTeacher?.name || section.sectionTeacherName) && (
                                                                        <p className="text-xs text-gray-400 dark:text-[#636366]">{section.sectionTeacher?.fullName || section.sectionTeacher?.name || section.sectionTeacherName}</p>
                                                                    )}
                                                                </div>
                                                                <span className="text-xs font-semibold text-gray-500 dark:text-[#8E8E93] tabular-nums">
                                                                    {section.studentCount ?? 0}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })()}
                    </div>
                )}

                {/* SUBJECTS TAB */}
                {activeTab === 'subjects' && (
                    <div className="p-4 sm:p-6">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
                            <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Subjects</h2>
                            {user?.role === 'admin' && (
                                <button
                                    onClick={() => {
                                        setEditingSubject(null)
                                        setShowSubjectForm(true)
                                    }}
                                    className="btn btn-primary"
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Subject
                                </button>
                            )}
                        </div>

                        {subjects.length === 0 ? (
                            <div className="text-center py-12">
                                <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                                <p className="text-gray-500 dark:text-[#8E8E93]">No subjects found</p>
                            </div>
                        ) : (() => {
                            // Build a lookup for full subject data
                            const subjectById = {}
                            subjects.forEach(s => { subjectById[s._id] = s })

                            // Only consider ClassSubject records whose class still exists
                            // in the current tenant's class list. Orphan records (deleted
                            // class, mismatched session) used to falsely mark every subject
                            // as "assigned", which collapsed the Unassigned Subjects list
                            // and produced an empty page even when subjects existed.
                            const validClassIds = new Set(classes.map(c => c._id.toString()))
                            const validClassSubjects = classSubjects.filter(cs => {
                                const clsId = cs.classId?._id?.toString()
                                return clsId && validClassIds.has(clsId)
                            })

                            // Build class → subjects mapping using full subject data
                            const classSubjectMap = {}
                            validClassSubjects.forEach(cs => {
                                const clsId = cs.classId?._id
                                const clsName = cs.classId?.name
                                const subjId = cs.subjectId?._id
                                if (!clsId || !subjId) return
                                const fullSubject = subjectById[subjId] || cs.subjectId
                                if (!classSubjectMap[clsId]) classSubjectMap[clsId] = { name: clsName, subjects: [] }
                                classSubjectMap[clsId].subjects.push(fullSubject)
                            })
                            // Classes with subjects (sorted by class order)
                            const classesWithSubjects = classes
                                .filter(cls => classSubjectMap[cls._id])
                                .map(cls => ({ ...cls, assignedSubjects: classSubjectMap[cls._id].subjects }))
                            // Subjects not assigned to any (valid) class
                            const assignedSubjectIds = new Set(validClassSubjects.map(cs => cs.subjectId?._id).filter(Boolean))
                            const unassignedSubjects = subjects.filter(s => !assignedSubjectIds.has(s._id))

                            return (
                                <div className="space-y-3">
                                    {/* Summary bar */}
                                    <div className="flex flex-wrap gap-3 mb-4">
                                        <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-[#2C2C2E] rounded-full text-sm">
                                            <span className="font-semibold text-gray-800 dark:text-white">{subjects.length}</span>
                                            <span className="text-gray-500 dark:text-[#8E8E93]">Total Subjects</span>
                                        </div>
                                        <div className="flex items-center gap-2 px-3 py-1.5 bg-teal-50 dark:bg-[#1a332e] rounded-full text-sm">
                                            <span className="font-semibold text-teal-700 dark:text-teal-400">{classesWithSubjects.length}</span>
                                            <span className="text-teal-600 dark:text-teal-500">Classes</span>
                                        </div>
                                    </div>

                                    {/* Classes with their subjects */}
                                    {classesWithSubjects.map(cls => (
                                        <details key={cls._id} className="group border border-gray-200 dark:border-[#38383A] rounded-2xl overflow-hidden" open>
                                            <summary className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer select-none bg-gray-50 dark:bg-[#1C1C1E] hover:bg-gray-100 dark:hover:bg-[#2C2C2E] transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-9 w-9 rounded-xl bg-teal-100 dark:bg-teal-500/20 flex items-center justify-center">
                                                        <GraduationCap className="h-4.5 w-4.5 text-teal-600 dark:text-teal-400" />
                                                    </div>
                                                    <div>
                                                        <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{cls.name}</h3>
                                                        <p className="text-xs text-gray-500 dark:text-[#8E8E93]">{cls.assignedSubjects.length} subject{cls.assignedSubjects.length !== 1 ? 's' : ''}</p>
                                                    </div>
                                                </div>
                                                <ChevronDown className="h-4 w-4 text-gray-400 transition-transform group-open:rotate-180" />
                                            </summary>
                                            <div className="px-4 py-3 border-t border-gray-100 dark:border-[#38383A]">
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                                                    {cls.assignedSubjects.map(subject => (
                                                        <div
                                                            key={subject._id}
                                                            className={`relative border rounded-xl p-3 transition-all hover:shadow-sm ${subject.isActive ? 'border-gray-200 dark:border-[#38383A] bg-white dark:bg-[#1C1C1E]' : 'border-gray-200 dark:border-[#38383A] bg-gray-50 dark:bg-[#2C2C2E] opacity-60'}`}
                                                        >
                                                            <div className="flex items-start justify-between gap-2">
                                                                <div className="min-w-0 flex-1">
                                                                    <h4 className="font-medium text-sm text-gray-900 dark:text-white truncate">{subject.name}</h4>
                                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                                        <span className="font-mono text-[11px] text-gray-400 dark:text-[#636366]">{subject.subjectCode}</span>
                                                                        <span className="text-[10px] text-gray-400 dark:text-[#636366]">
                                                                            {subject.type === 'Practical' ? '🔬' : subject.type === 'Both' ? '📚' : '📖'} {subject.type}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                {user?.role === 'admin' && (
                                                                    <div className="flex gap-0.5 flex-shrink-0">
                                                                        <button onClick={() => { setEditingSubject(subject); setShowSubjectForm(true) }} className="p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-[#1a2533] rounded" title="Edit"><Edit className="h-3 w-3" /></button>
                                                                        <button onClick={() => handleToggleSubject(subject._id)} className="p-1 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-100 dark:hover:bg-[#332d1a] rounded" title={subject.isActive ? 'Deactivate' : 'Activate'}><Power className="h-3 w-3" /></button>
                                                                        <button onClick={() => handleDeleteSubject(subject._id)} className="p-1 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-[#331a1a] rounded" title="Delete"><Trash2 className="h-3 w-3" /></button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-2 mt-1.5 text-[11px] text-gray-500 dark:text-[#8E8E93]">
                                                                <span>Max: <strong className="text-gray-700 dark:text-gray-300">{subject.maxMarks || 100}</strong></span>
                                                                <span className="text-gray-300 dark:text-[#636366]">|</span>
                                                                <span>Pass: <strong className="text-gray-700 dark:text-gray-300">{subject.passingMarks || 33}</strong></span>
                                                                {subject.isOptional && <span className="px-1 py-0.5 rounded text-[9px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400">Optional</span>}
                                                            </div>
                                                            {!subject.isActive && (
                                                                <span className="absolute top-2 right-2 inline-flex px-1.5 py-0.5 text-[9px] font-semibold rounded bg-gray-200 dark:bg-[#38383A] text-gray-500 dark:text-[#8E8E93]">Inactive</span>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </details>
                                    ))}

                                    {/* Unassigned subjects */}
                                    {unassignedSubjects.length > 0 && (
                                        <details className="group border border-dashed border-gray-300 dark:border-[#48484A] rounded-2xl overflow-hidden" open={classesWithSubjects.length === 0}>
                                            <summary className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer select-none bg-gray-50/50 dark:bg-[#1C1C1E] hover:bg-gray-100 dark:hover:bg-[#2C2C2E] transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-9 w-9 rounded-xl bg-gray-100 dark:bg-[#38383A] flex items-center justify-center">
                                                        <BookOpen className="h-4.5 w-4.5 text-gray-400 dark:text-[#8E8E93]" />
                                                    </div>
                                                    <div>
                                                        <h3 className="font-semibold text-gray-600 dark:text-[#8E8E93] text-sm">Unassigned Subjects</h3>
                                                        <p className="text-xs text-gray-400 dark:text-[#636366]">{unassignedSubjects.length} subject{unassignedSubjects.length !== 1 ? 's' : ''} not assigned to any class</p>
                                                    </div>
                                                </div>
                                                <ChevronDown className="h-4 w-4 text-gray-400 transition-transform group-open:rotate-180" />
                                            </summary>
                                            <div className="px-4 py-3 border-t border-gray-100 dark:border-[#38383A]">
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                                                    {unassignedSubjects.map(subject => (
                                                        <div key={subject._id} className="border border-dashed border-gray-200 dark:border-[#48484A] rounded-xl p-3 bg-white dark:bg-[#1C1C1E]">
                                                            <div className="flex items-start justify-between gap-2">
                                                                <div className="min-w-0 flex-1">
                                                                    <h4 className="font-medium text-sm text-gray-900 dark:text-white truncate">{subject.name}</h4>
                                                                    <span className="font-mono text-[11px] text-gray-400 dark:text-[#636366]">{subject.subjectCode}</span>
                                                                </div>
                                                                {user?.role === 'admin' && (
                                                                    <div className="flex gap-0.5 flex-shrink-0">
                                                                        <button onClick={() => { setEditingSubject(subject); setShowSubjectForm(true) }} className="p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-[#1a2533] rounded" title="Edit"><Edit className="h-3 w-3" /></button>
                                                                        <button onClick={() => handleDeleteSubject(subject._id)} className="p-1 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-[#331a1a] rounded" title="Delete"><Trash2 className="h-3 w-3" /></button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </details>
                                    )}

                                    {/* No assignments at all */}
                                    {classesWithSubjects.length === 0 && unassignedSubjects.length === 0 && (
                                        <div className="text-center py-8 text-gray-500 dark:text-[#8E8E93]">
                                            <p>No class-subject assignments found for the active session.</p>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}
                    </div>
                )}

                {/* ASSIGNMENTS TAB */}
                {activeTab === 'assignments' && (
                    <div className="p-4 sm:p-6">
                        {!activeSession ? (
                            <div className="text-center py-12">
                                <UserPlus className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                                <p className="text-gray-500 dark:text-[#8E8E93]">Please activate an academic session first</p>
                            </div>
                        ) : (
                            <>
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
                                    <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Subject Assignments</h2>
                                    {user?.role === 'admin' && (
                                        <button
                                            onClick={() => setShowAssignmentForm(true)}
                                            className="btn btn-primary"
                                        >
                                            <Plus className="h-4 w-4 mr-2" />
                                            Assign Subject
                                        </button>
                                    )}
                                </div>

                                <div className="space-y-6">
                                    {classes.map((cls) => {
                                        // Filter out orphaned records where subject was deleted
                                        const clsSubjects = classSubjects.filter(cs => cs.classId?._id === cls._id && cs.subjectId?._id)
                                        if (clsSubjects.length === 0) return null

                                        // Display class name smartly - avoid redundant "Nursery - Nursery"
                                        const classDisplayName = cls.name === cls.grade || cls.name === `Class ${cls.grade}`
                                            ? `${cls.name}`
                                            : `${cls.name} - ${formatGrade(cls.grade)}`

                                        return (
                                            <div key={cls._id} className="border border-gray-200 dark:border-[#38383A] dark:bg-[#2C2C2E] rounded-2xl p-4">
                                                <h3 className="text-md font-semibold text-gray-900 dark:text-white mb-3">{classDisplayName}</h3>
                                                <div className="space-y-2">
                                                    {clsSubjects.map((cs) => {
                                                        const assignments = teacherAssignments.filter(ta =>
                                                            ta.classId?._id === cls._id && ta.subjectId?._id === cs.subjectId?._id
                                                        )

                                                        return (
                                                            <div key={cs._id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-gray-50 dark:bg-[#1C1C1E] rounded-lg gap-2">
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="font-medium text-gray-900 dark:text-white">{cs.subjectId?.name}</p>
                                                                    <p className="text-sm text-gray-600 dark:text-[#8E8E93]">
                                                                        {assignments.length > 0 ? (
                                                                            <span className="flex flex-wrap items-center gap-1">
                                                                                <span>Teachers:</span>
                                                                                {assignments.map((a, idx) => (
                                                                                    <span key={a._id} className="inline-flex items-center gap-1">
                                                                                        <span>{a.teacherId?.name || 'Unknown'}</span>
                                                                                        {user?.role === 'admin' && (
                                                                                            <button
                                                                                                onClick={() => handleDeleteTeacherAssignment(a._id)}
                                                                                                className="text-red-400 hover:text-red-600 p-0.5"
                                                                                                title="Remove teacher"
                                                                                            >
                                                                                                <X className="h-3 w-3" />
                                                                                            </button>
                                                                                        )}
                                                                                        {idx < assignments.length - 1 && <span>,</span>}
                                                                                    </span>
                                                                                ))}
                                                                            </span>
                                                                        ) : (
                                                                            <span className="text-red-600 dark:text-red-400">No teacher assigned</span>
                                                                        )}
                                                                    </p>
                                                                </div>
                                                                <div className="flex items-center gap-3">
                                                                    <span className="text-sm text-gray-600 dark:text-[#8E8E93] whitespace-nowrap">
                                                                        Max: {cs.maxMarks} | Pass: {cs.passingMarks}
                                                                    </span>
                                                                    {user?.role === 'admin' && (
                                                                        <button
                                                                            onClick={() => handleDeleteClassSubject(cs._id, assignments)}
                                                                            className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                                                                            title="Remove subject from class"
                                                                        >
                                                                            <Trash2 className="h-4 w-4" />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        )
                                    })}

                                    {classSubjects.filter(cs => cs.subjectId?._id).length === 0 && (
                                        <div className="text-center py-12">
                                            <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                                            <p className="text-gray-500 dark:text-[#8E8E93]">No subject assignments found</p>
                                            <p className="text-sm text-gray-400 dark:text-[#636366] mt-1">Start by assigning subjects to classes</p>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Modals */}
            {showSessionForm && (
                <SessionFormModal
                    session={editingSession}
                    onClose={() => setShowSessionForm(false)}
                    onSuccess={() => {
                        setShowSessionForm(false)
                        queryClient.invalidateQueries({ queryKey: ['academic-sessions'] })
                    }}
                />
            )}

            {showClassForm && (
                <ClassFormModal
                    classData={editingClass}
                    teachers={teachers}
                    sessions={sessions}
                    activeSession={activeSession}
                    onClose={() => setShowClassForm(false)}
                    onSuccess={() => {
                        setShowClassForm(false)
                        queryClient.invalidateQueries({ queryKey: ['academic-classes'] })
                    }}
                />
            )}

            {showSubjectForm && (
                <SubjectFormModal
                    subject={editingSubject}
                    classes={classes}
                    activeSession={activeSession}
                    onClose={() => setShowSubjectForm(false)}
                    onSuccess={() => {
                        setShowSubjectForm(false)
                        queryClient.invalidateQueries({ queryKey: ['academic-subjects'] })
                        queryClient.invalidateQueries({ queryKey: ['academic-assignments'] })
                        queryClient.invalidateQueries({ queryKey: ['class-subjects'] })
                    }}
                />
            )}

            {showAssignmentForm && (
                <AssignmentFormModal
                    classes={classes}
                    subjects={subjects}
                    teachers={teachers}
                    activeSession={activeSession}
                    classSubjects={classSubjects}
                    onClose={() => setShowAssignmentForm(false)}
                    onSuccess={() => {
                        setShowAssignmentForm(false)
                        queryClient.invalidateQueries({ queryKey: ['academic-assignments'] })
                    }}
                />
            )}
        </div>
    )
}

// Session Form Modal
const SessionFormModal = ({ session, onClose, onSuccess }) => {
    const [form, setForm] = useState({
        name: session?.name || '',
        startDate: session?.startDate ? session.startDate.substring(0, 10) : '',
        endDate: session?.endDate ? session.endDate.substring(0, 10) : '',
        description: session?.description || '',
        isActive: session?.isActive || false
    })
    const [isSaving, setIsSaving] = useState(false)

    const handleSubmit = async (e) => {
        e.preventDefault()

        if (form.startDate && form.endDate && form.endDate <= form.startDate) {
            toast.error('End date must be after start date')
            return
        }

        try {
            setIsSaving(true)

            if (session) {
                await academicSessionsService.update(session._id, form)
                toast.success('Session updated successfully')
            } else {
                await academicSessionsService.create(form)
                toast.success('Session created successfully')
            }

            onSuccess()
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to save session')
        } finally {
            setIsSaving(false)
        }
    }

    return createPortal(
        <div className="modal-overlay">
            <div className="modal-content max-w-md">
                <div className="flex items-center justify-between border-b border-gray-200 dark:border-[#38383A] p-6">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                        {session ? 'Edit Session' : 'Add Academic Session'}
                    </h3>
                    <button onClick={onClose} className="btn-close">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6">
                    <div className="space-y-4">
                        <div>
                            <label className="label">Session Name *</label>
                            <input
                                className="input"
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                placeholder="e.g., 2024-2025"
                                required
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="label">Start Date *</label>
                                <input
                                    type="date"
                                    className="input"
                                    value={form.startDate}
                                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                                    required
                                />
                            </div>

                            <div>
                                <label className="label">End Date *</label>
                                <input
                                    type="date"
                                    className="input"
                                    value={form.endDate}
                                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                                    min={form.startDate || undefined}
                                    required
                                />
                            </div>
                        </div>
                        {form.startDate && form.endDate && form.endDate <= form.startDate && (
                            <p className="text-xs text-red-500">End date must be after start date</p>
                        )}

                        <div>
                            <label className="label">Description</label>
                            <textarea
                                className="input"
                                rows="3"
                                value={form.description}
                                onChange={(e) => setForm({ ...form, description: e.target.value })}
                                placeholder="Optional description"
                            />
                        </div>

                        {!session && (
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="isActive"
                                    checked={form.isActive}
                                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                                    className="rounded border-gray-300 dark:border-[#38383A] text-primary-600 focus:ring-primary-500"
                                />
                                <label htmlFor="isActive" className="text-sm text-gray-700 dark:text-[#8E8E93]">
                                    Set as active session
                                </label>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-200 dark:border-[#38383A] mt-6">
                        <button type="button" onClick={onClose} className="btn btn-ghost">
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={isSaving}>
                            {isSaving ? 'Saving...' : session ? 'Update' : 'Create'}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    )
}

// Class Form Modal
const ClassFormModal = ({ classData, teachers, sessions = [], activeSession, onClose, onSuccess }) => {
    const [form, setForm] = useState({
        name: classData?.name || '',
        grade: classData?.grade || '',
        // Default to the class's existing year (when editing), then active
        // session, then the first available session. Bound to a select below
        // so Class.academicYear stays aligned with AcademicSession.name.
        academicYear: classData?.academicYear
            || activeSession?.name
            || sessions[0]?.name
            || '',
    })
    // Each section: { name: string, sectionTeacher: string (teacher _id) }
    const [sections, setSections] = useState(
        classData?.sections?.length > 0
            ? classData.sections.map(s => ({
                _id: s._id || null,   // ← preserve ID so backend can delete removed sections
                name: s.name,
                // sectionTeacher may be: raw ObjectId string, populated object, or null
                sectionTeacher: s.sectionTeacher?._id?.toString()
                    || (typeof s.sectionTeacher === 'string' ? s.sectionTeacher : '')
                    || ''
            }))
            : [{ name: '', sectionTeacher: '' }]
    )
    const [isSaving, setIsSaving] = useState(false)

    const addSection = () => setSections(prev => [...prev, { name: '', sectionTeacher: '' }])
    const removeSection = (idx) => setSections(prev => prev.filter((_, i) => i !== idx))
    const updateSection = (idx, field, value) => setSections(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s))

    const handleSubmit = async (e) => {
        e.preventDefault()

        const validSections = sections.filter(s => s.name.trim())
        if (validSections.length === 0) {
            toast.error('Please add at least one section')
            return
        }

        try {
            setIsSaving(true)

            const data = {
                ...form,
                sections: validSections.map(s => ({
                    ...(s._id && { _id: s._id }),   // include _id if exists (for update/delete matching)
                    name: s.name.trim(),
                    sectionTeacher: s.sectionTeacher || null
                }))
            }

            if (classData) {
                await classesService.update(classData._id, data)
                toast.success('Class updated successfully')
            } else {
                await classesService.create(data)
                toast.success('Class created successfully')
            }

            onSuccess()
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to save class')
        } finally {
            setIsSaving(false)
        }
    }

    return createPortal(
        <div className="modal-overlay">
            <div className="modal-content max-w-lg">
                <div className="flex items-center justify-between border-b border-gray-200 dark:border-[#38383A] p-6">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                        {classData ? 'Edit Class' : 'Add Class'}
                    </h3>
                    <button onClick={onClose} className="btn-close">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[75vh]">
                    <div className="space-y-4">
                        {/* Grade */}
                        <div>
                            <label className="label">Grade *</label>
                            <select
                                className="input"
                                value={form.grade}
                                onChange={(e) => {
                                    const grade = e.target.value
                                    const autoName = ['Nursery', 'LKG', 'UKG'].includes(grade) ? grade : grade ? `Class ${grade}` : ''
                                    setForm({ ...form, grade, name: classData ? form.name : autoName })
                                }}
                                required
                            >
                                <option value="">Select Grade</option>
                                <option value="Nursery">Nursery</option>
                                <option value="LKG">LKG</option>
                                <option value="UKG">UKG</option>
                                <option value="1">1st Grade</option>
                                <option value="2">2nd Grade</option>
                                <option value="3">3rd Grade</option>
                                <option value="4">4th Grade</option>
                                <option value="5">5th Grade</option>
                                <option value="6">6th Grade</option>
                                <option value="7">7th Grade</option>
                                <option value="8">8th Grade</option>
                                <option value="9">9th Grade</option>
                                <option value="10">10th Grade</option>
                                <option value="11">11th Grade</option>
                                <option value="12">12th Grade</option>
                            </select>
                        </div>

                        {/* Academic Year — bound to AcademicSession list */}
                        <div>
                            <label className="label">Academic Year *</label>
                            {sessions.length > 0 ? (
                                <select
                                    className="input"
                                    value={form.academicYear}
                                    onChange={(e) => setForm({ ...form, academicYear: e.target.value })}
                                    required
                                >
                                    <option value="">Select Academic Year</option>
                                    {sessions.map(s => (
                                        <option key={s._id} value={s.name}>
                                            {s.name}{s.isActive ? ' (Active)' : ''}
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <input
                                    className="input"
                                    value={form.academicYear}
                                    onChange={(e) => setForm({ ...form, academicYear: e.target.value })}
                                    placeholder="e.g., 2025-2026"
                                    required
                                />
                            )}
                        </div>

                        {/* Sections */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="label mb-0">Sections *</label>
                                <button
                                    type="button"
                                    onClick={addSection}
                                    className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
                                >
                                    <Plus className="h-3.5 w-3.5" /> Add Section
                                </button>
                            </div>

                            <div className="space-y-2">
                                {sections.map((sec, idx) => (
                                    <div key={sec._id || idx} className="flex gap-2 items-center">
                                        <input
                                            className="input flex-1"
                                            value={sec.name}
                                            onChange={(e) => updateSection(idx, 'name', e.target.value)}
                                            placeholder={`Section name (e.g., ${String.fromCharCode(65 + idx)})`}
                                        />
                                        <select
                                            className="input flex-1"
                                            value={sec.sectionTeacher}
                                            onChange={(e) => updateSection(idx, 'sectionTeacher', e.target.value)}
                                        >
                                            <option value="">— No Teacher —</option>
                                            {teachers.map(t => (
                                                <option key={t._id} value={t._id}>
                                                    {t.fullName || t.name}{t.employeeId ? ` (${t.employeeId})` : ''}
                                                </option>
                                            ))}
                                        </select>
                                        {sections.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => removeSection(idx)}
                                                className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-[#331a1a] rounded flex-shrink-0"
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <p className="text-xs text-gray-500 dark:text-[#8E8E93] mt-1">Each section can have its own class teacher</p>
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-200 dark:border-[#38383A] mt-6">
                        <button type="button" onClick={onClose} className="btn btn-ghost">
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={isSaving}>
                            {isSaving ? 'Saving...' : classData ? 'Update' : 'Create'}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    )
}

// Subject Form Modal
const SubjectFormModal = ({ subject, classes = [], activeSession, onClose, onSuccess }) => {
    const [form, setForm] = useState({
        name: subject?.name || '',
        subjectCode: subject?.subjectCode || '',
        type: subject?.type || 'Theory',
        maxMarks: subject?.maxMarks || 100,
        passingMarks: subject?.passingMarks || 33,
        description: subject?.description || '',
        isOptional: subject?.isOptional || false
    })
    const [selectedClassIds, setSelectedClassIds] = useState([])
    const [isSaving, setIsSaving] = useState(false)

    const handleSubmit = async (e) => {
        e.preventDefault()

        if (form.maxMarks > 100) {
            toast.error('Max marks cannot exceed 100')
            return
        }
        if (form.passingMarks > form.maxMarks) {
            toast.error('Passing marks cannot exceed max marks')
            return
        }

        try {
            setIsSaving(true)

            let savedSubject
            if (subject) {
                await subjectsService.update(subject._id, form)
                savedSubject = subject
                toast.success('Subject updated successfully')
            } else {
                const res = await subjectsService.create(form)
                savedSubject = res.data
                toast.success('Subject created successfully')
            }

            // Assign subject to selected classes
            if (!subject && selectedClassIds.length > 0 && activeSession && savedSubject?._id) {
                try {
                    for (const classId of selectedClassIds) {
                        await classSubjectsService.assign({
                            classId,
                            subjectId: savedSubject._id,
                            academicSessionId: activeSession._id,
                            maxMarks: form.maxMarks,
                            passingMarks: form.passingMarks
                        })
                    }
                } catch (assignErr) {
                    console.error('Error assigning subject to classes:', assignErr)
                    toast.error('Subject created but some class assignments failed')
                }
            }

            onSuccess()
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to save subject')
        } finally {
            setIsSaving(false)
        }
    }

    return createPortal(
        <div className="modal-overlay">
            <div className="modal-content max-w-md">
                <div className="flex items-center justify-between border-b border-gray-200 dark:border-[#38383A] p-6">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                        {subject ? 'Edit Subject' : 'Add Subject'}
                    </h3>
                    <button onClick={onClose} className="btn-close">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6">
                    <div className="space-y-4">
                        <div>
                            <label className="label">Subject Name *</label>
                            <input
                                className="input"
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                placeholder="e.g., Mathematics"
                                required
                            />
                        </div>

                        <div>
                            <label className="label">Subject Code</label>
                            <input
                                className="input"
                                value={form.subjectCode}
                                onChange={(e) => setForm({ ...form, subjectCode: e.target.value.toUpperCase() })}
                                placeholder="e.g., MATH101"
                            />
                        </div>

                        <div>
                            <label className="label">Type *</label>
                            <select
                                className="input"
                                value={form.type}
                                onChange={(e) => setForm({ ...form, type: e.target.value })}
                                required
                            >
                                <option value="Theory">Theory</option>
                                <option value="Practical">Practical</option>
                                <option value="Both">Both</option>
                            </select>
                        </div>

                        {/* Class assignment — only shown when creating a new subject */}
                        {!subject && classes.length > 0 && activeSession && (
                            <div>
                                <label className="label">Assign to Classes</label>
                                <div className="max-h-40 overflow-y-auto border border-gray-200 dark:border-[#38383A] rounded-xl p-2 space-y-1">
                                    {classes.map(cls => (
                                        <label key={cls._id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-[#2C2C2E] cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
                                                checked={selectedClassIds.includes(cls._id)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setSelectedClassIds(prev => [...prev, cls._id])
                                                    } else {
                                                        setSelectedClassIds(prev => prev.filter(id => id !== cls._id))
                                                    }
                                                }}
                                            />
                                            <span className="text-sm text-gray-700 dark:text-gray-300">
                                                {cls.name || `Class ${formatGrade(cls.grade)}`}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                                <p className="text-xs text-gray-500 dark:text-[#8E8E93] mt-1">Select the classes this subject will be taught in</p>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="label">Max Marks *</label>
                                <input
                                    type="number"
                                    className="input"
                                    value={form.maxMarks}
                                    onChange={(e) => setForm({ ...form, maxMarks: parseInt(e.target.value) })}
                                    min="0"
                                    max="100"
                                    required
                                />
                            </div>

                            <div>
                                <label className="label">Passing Marks *</label>
                                <input
                                    type="number"
                                    className="input"
                                    value={form.passingMarks}
                                    onChange={(e) => setForm({ ...form, passingMarks: parseInt(e.target.value) })}
                                    min="0"
                                    max={form.maxMarks}
                                    required
                                />
                            </div>
                        </div>
                        {form.maxMarks > 100 && (
                            <p className="text-xs text-red-500">Max marks cannot exceed 100</p>
                        )}
                        {form.passingMarks > form.maxMarks && (
                            <p className="text-xs text-red-500">Passing marks cannot exceed max marks ({form.maxMarks})</p>
                        )}

                        <div>
                            <label className="label">Description</label>
                            <textarea
                                className="input"
                                rows="3"
                                value={form.description}
                                onChange={(e) => setForm({ ...form, description: e.target.value })}
                                placeholder="Optional description"
                            />
                        </div>

                        {/* Optional subject toggle — students can opt out of optional subjects */}
                        <label className="flex items-center gap-3 cursor-pointer p-3 bg-gray-50 dark:bg-[#2C2C2E] border border-gray-200 dark:border-[#38383A] rounded-xl">
                            <input
                                type="checkbox"
                                className="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
                                checked={form.isOptional}
                                onChange={(e) => setForm({ ...form, isOptional: e.target.checked })}
                            />
                            <div>
                                <span className="font-medium text-sm text-gray-900 dark:text-white">Optional Subject</span>
                                <p className="text-xs text-gray-500 dark:text-[#8E8E93] mt-0.5">Students can skip this subject via Subject Preferences (e.g., Punjabi for out-of-state students)</p>
                            </div>
                        </label>
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-200 dark:border-[#38383A] mt-6">
                        <button type="button" onClick={onClose} className="btn btn-ghost">
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={isSaving || form.maxMarks > 100 || form.passingMarks > form.maxMarks}>
                            {isSaving ? 'Saving...' : subject ? 'Update' : 'Create'}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    )
}

// Assignment Form Modal
const AssignmentFormModal = ({ classes, subjects, teachers, activeSession, classSubjects = [], onClose, onSuccess }) => {
    const [form, setForm] = useState({
        classId: '',
        subjectId: '',
        teacherId: '',
        maxMarks: 100,
        passingMarks: 33
    })
    const [isSaving, setIsSaving] = useState(false)

    // Get subjects already assigned to the selected class
    const assignedSubjectIds = form.classId
        ? new Set(classSubjects.filter(cs => cs.classId?._id === form.classId && cs.subjectId?._id).map(cs => cs.subjectId._id))
        : new Set()

    // Filter available subjects (active + not already assigned to selected class)
    const availableSubjects = subjects.filter(s => s.isActive && !assignedSubjectIds.has(s._id))

    const handleSubmit = async (e) => {
        e.preventDefault()

        try {
            setIsSaving(true)

            // First assign subject to class
            await classSubjectsService.assign({
                classId: form.classId,
                subjectId: form.subjectId,
                academicSessionId: activeSession._id,
                maxMarks: form.maxMarks,
                passingMarks: form.passingMarks
            })

            // Then assign teacher
            if (form.teacherId) {
                await teacherAssignmentsService.assign({
                    teacherId: form.teacherId,
                    subjectId: form.subjectId,
                    classId: form.classId,
                    academicSessionId: activeSession._id,
                    isPrimary: true
                })
            }

            toast.success('Subject assigned successfully')
            onSuccess()
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to assign subject')
        } finally {
            setIsSaving(false)
        }
    }

    return createPortal(
        <div className="modal-overlay">
            <div className="modal-content max-w-md">
                <div className="flex items-center justify-between border-b border-gray-200 dark:border-[#38383A] p-6">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Assign Subject to Class</h3>
                    <button onClick={onClose} className="btn-close">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6">
                    <div className="space-y-4">
                        <div>
                            <label className="label">Class *</label>
                            <select
                                className="input"
                                value={form.classId}
                                onChange={(e) => setForm({ ...form, classId: e.target.value, subjectId: '' })}
                                required
                            >
                                <option value="">Select Class</option>
                                {classes.map((cls) => (
                                    <option key={cls._id} value={cls._id}>
                                        {cls.name}{cls.name !== cls.grade && cls.name !== `Class ${cls.grade}` ? ` - ${formatGrade(cls.grade)}` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="label">Subject *</label>
                            <select
                                className="input"
                                value={form.subjectId}
                                onChange={(e) => {
                                    const subject = subjects.find(s => s._id === e.target.value)
                                    setForm({
                                        ...form,
                                        subjectId: e.target.value,
                                        maxMarks: subject?.maxMarks || 100,
                                        passingMarks: subject?.passingMarks || 33
                                    })
                                }}
                                required
                            >
                                <option value="">Select Subject</option>
                                {availableSubjects.map((subject) => (
                                    <option key={subject._id} value={subject._id}>
                                        {subject.name}
                                    </option>
                                ))}
                                {form.classId && availableSubjects.length === 0 && (
                                    <option disabled>All subjects already assigned</option>
                                )}
                            </select>
                            {form.classId && availableSubjects.length === 0 && (
                                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">All active subjects are already assigned to this class</p>
                            )}
                        </div>

                        <div>
                            <label className="label">Teacher</label>
                            <select
                                className="input"
                                value={form.teacherId}
                                onChange={(e) => setForm({ ...form, teacherId: e.target.value })}
                            >
                                <option value="">Select Teacher (Optional)</option>
                                {teachers.map((teacher) => (
                                    <option key={teacher._id} value={teacher._id}>
                                        {teacher.name}
                                        {teacher.employeeId && ` (ID: ${teacher.employeeId})`}
                                        {!teacher.employeeId && teacher.email && ` (${teacher.email})`}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="label">Max Marks *</label>
                                <input
                                    type="number"
                                    className="input"
                                    value={form.maxMarks}
                                    onChange={(e) => setForm({ ...form, maxMarks: parseInt(e.target.value) })}
                                    min="0"
                                    max="100"
                                    required
                                />
                            </div>

                            <div>
                                <label className="label">Passing Marks *</label>
                                <input
                                    type="number"
                                    className="input"
                                    value={form.passingMarks}
                                    onChange={(e) => setForm({ ...form, passingMarks: parseInt(e.target.value) })}
                                    min="0"
                                    max={form.maxMarks}
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-200 dark:border-[#38383A] mt-6">
                        <button type="button" onClick={onClose} className="btn btn-ghost">
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={isSaving}>
                            {isSaving ? 'Assigning...' : 'Assign Subject'}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    )
}

export default AcademicsManagement
