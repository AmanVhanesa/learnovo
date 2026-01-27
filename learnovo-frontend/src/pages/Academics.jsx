import React, { useState, useEffect } from 'react'
import { Calendar, BookOpen, Users, UserPlus, Plus, Check, Lock, Unlock, Power, Trash2, Edit, X } from 'lucide-react'
import { academicSessionsService, classesService, subjectsService, classSubjectsService, teacherAssignmentsService } from '../services/academicsService'
import { employeesService } from '../services/employeesService'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'

const AcademicsManagement = () => {
    const { user } = useAuth()
    const [activeTab, setActiveTab] = useState('sessions')
    const [isLoading, setIsLoading] = useState(true)

    // Sessions state
    const [sessions, setSessions] = useState([])
    const [activeSession, setActiveSession] = useState(null)
    const [showSessionForm, setShowSessionForm] = useState(false)
    const [editingSession, setEditingSession] = useState(null)

    // Classes state
    const [classes, setClasses] = useState([])
    const [showClassForm, setShowClassForm] = useState(false)
    const [editingClass, setEditingClass] = useState(null)

    // Subjects state
    const [subjects, setSubjects] = useState([])
    const [showSubjectForm, setShowSubjectForm] = useState(false)
    const [editingSubject, setEditingSubject] = useState(null)

    // Assignments state
    const [classSubjects, setClassSubjects] = useState([])
    const [teacherAssignments, setTeacherAssignments] = useState([])
    const [teachers, setTeachers] = useState([])
    const [showAssignmentForm, setShowAssignmentForm] = useState(false)

    useEffect(() => {
        fetchSessions()
        fetchClasses()
        fetchSubjects()
        fetchTeachers()
    }, [])

    useEffect(() => {
        if (activeTab === 'assignments' && activeSession) {
            fetchAssignments()
        }
    }, [activeTab, activeSession])

    const fetchSessions = async () => {
        try {
            setIsLoading(true)
            const [sessionsRes, activeRes] = await Promise.all([
                academicSessionsService.list(),
                academicSessionsService.getActive().catch(() => ({ data: null }))
            ])

            setSessions(sessionsRes.data || [])
            setActiveSession(activeRes.data)
        } catch (error) {
            console.error('Fetch sessions error:', error)
            toast.error('Failed to load academic sessions')
        } finally {
            setIsLoading(false)
        }
    }

    const fetchClasses = async () => {
        try {
            const res = await classesService.list()
            setClasses(res.data || [])
        } catch (error) {
            console.error('Fetch classes error:', error)
            toast.error('Failed to load classes')
        }
    }

    const fetchSubjects = async () => {
        try {
            const res = await subjectsService.list()
            setSubjects(res.data || [])
        } catch (error) {
            console.error('Fetch subjects error:', error)
            toast.error('Failed to load subjects')
        }
    }

    const fetchTeachers = async () => {
        try {
            const res = await employeesService.list({ role: 'teacher' })
            setTeachers(res.data || [])
        } catch (error) {
            console.error('Fetch teachers error:', error)
        }
    }

    const fetchAssignments = async () => {
        try {
            const [csRes, taRes] = await Promise.all([
                classSubjectsService.list({ academicSessionId: activeSession._id }),
                teacherAssignmentsService.list({ academicSessionId: activeSession._id })
            ])
            setClassSubjects(csRes.data || [])
            setTeacherAssignments(taRes.data || [])
        } catch (error) {
            console.error('Fetch assignments error:', error)
        }
    }

    const handleActivateSession = async (id) => {
        try {
            await academicSessionsService.activate(id)
            toast.success('Academic session activated successfully')
            fetchSessions()
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to activate session')
        }
    }

    const handleLockSession = async (id, lock) => {
        try {
            await academicSessionsService.lock(id, lock)
            toast.success(`Session ${lock ? 'locked' : 'unlocked'} successfully`)
            fetchSessions()
        } catch (error) {
            toast.error('Failed to lock/unlock session')
        }
    }

    const handleDeleteSession = async (id) => {
        if (!confirm('Are you sure you want to delete this academic session?')) return

        try {
            await academicSessionsService.remove(id)
            toast.success('Session deleted successfully')
            fetchSessions()
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to delete session')
        }
    }

    const handleDeleteClass = async (id) => {
        if (!confirm('Are you sure you want to delete this class?')) return

        try {
            await classesService.remove(id)
            toast.success('Class deleted successfully')
            fetchClasses()
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to delete class')
        }
    }

    const handleDeleteSubject = async (id) => {
        if (!confirm('Are you sure you want to delete this subject?')) return

        try {
            await subjectsService.remove(id)
            toast.success('Subject deleted successfully')
            fetchSubjects()
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to delete subject')
        }
    }

    const handleToggleSubject = async (id) => {
        try {
            await subjectsService.toggle(id)
            toast.success('Subject status updated')
            fetchSubjects()
        } catch (error) {
            toast.error('Failed to update subject status')
        }
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
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Academics Management</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Manage academic sessions, classes, subjects, and assignments
                    </p>
                </div>
            </div>

            {/* Active Session Banner */}
            {activeSession && (
                <div className="bg-gradient-to-r from-primary-50 to-primary-100 border border-primary-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary-600 rounded-lg">
                                <Calendar className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-primary-900">Active Academic Session</p>
                                <p className="text-lg font-bold text-primary-700">{activeSession.name}</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-primary-600">
                                {new Date(activeSession.startDate).toLocaleDateString()} - {new Date(activeSession.endDate).toLocaleDateString()}
                            </p>
                            {activeSession.isLocked && (
                                <span className="inline-flex items-center gap-1 mt-1 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                                    <Lock className="h-3 w-3" />
                                    Locked
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8">
                    {tabs.map((tab) => {
                        const Icon = tab.icon
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${activeTab === tab.id
                                        ? 'border-primary-500 text-primary-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
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
            <div className="bg-white rounded-lg shadow-sm">
                {/* SESSIONS TAB */}
                {activeTab === 'sessions' && (
                    <div className="p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-lg font-semibold text-gray-900">Academic Sessions</h2>
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
                                <p className="text-gray-500">No academic sessions found</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {sessions.map((session) => (
                                    <div
                                        key={session._id}
                                        className={`border rounded-lg p-4 ${session.isActive ? 'border-primary-300 bg-primary-50' : 'border-gray-200'
                                            }`}
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3">
                                                    <h3 className="text-lg font-semibold text-gray-900">{session.name}</h3>
                                                    {session.isActive && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
                                                            <Check className="h-3 w-3" />
                                                            Active
                                                        </span>
                                                    )}
                                                    {session.isLocked && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded-full">
                                                            <Lock className="h-3 w-3" />
                                                            Locked
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-sm text-gray-600 mt-1">
                                                    {new Date(session.startDate).toLocaleDateString()} - {new Date(session.endDate).toLocaleDateString()}
                                                </p>
                                            </div>

                                            {user?.role === 'admin' && (
                                                <div className="flex items-center gap-2">
                                                    {!session.isActive && (
                                                        <button
                                                            onClick={() => handleActivateSession(session._id)}
                                                            className="p-2 text-green-600 hover:bg-green-50 rounded-md"
                                                            title="Activate"
                                                        >
                                                            <Power className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleLockSession(session._id, !session.isLocked)}
                                                        className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-md"
                                                        title={session.isLocked ? 'Unlock' : 'Lock'}
                                                    >
                                                        {session.isLocked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                                                    </button>
                                                    {!session.isActive && !session.isLocked && (
                                                        <button
                                                            onClick={() => handleDeleteSession(session._id)}
                                                            className="p-2 text-red-600 hover:bg-red-50 rounded-md"
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
                    <div className="p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-lg font-semibold text-gray-900">Classes & Sections</h2>
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
                                <p className="text-gray-500">No classes found</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {classes.map((cls) => (
                                    <div key={cls._id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                                        <div className="flex items-start justify-between mb-3">
                                            <div>
                                                <h3 className="text-lg font-semibold text-gray-900">{cls.name}</h3>
                                                <p className="text-sm text-gray-600">Grade: {cls.grade}</p>
                                                <p className="text-xs text-gray-500">{cls.academicYear}</p>
                                            </div>
                                            {user?.role === 'admin' && (
                                                <div className="flex gap-1">
                                                    <button
                                                        onClick={() => {
                                                            setEditingClass(cls)
                                                            setShowClassForm(true)
                                                        }}
                                                        className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                                        title="Edit"
                                                    >
                                                        <Edit className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteClass(cls._id)}
                                                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        <div className="space-y-2 text-sm">
                                            <div className="flex items-center justify-between">
                                                <span className="text-gray-600">Class Teacher:</span>
                                                <span className="font-medium">{cls.classTeacher?.name || 'Not assigned'}</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-gray-600">Students:</span>
                                                <span className="font-medium">{cls.studentCount || 0}</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-gray-600">Sections:</span>
                                                <span className="font-medium">{cls.sections?.length || 0}</span>
                                            </div>
                                            {cls.sections && cls.sections.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mt-2">
                                                    {cls.sections.map((section) => (
                                                        <span key={section._id} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                                                            {section.name}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* SUBJECTS TAB */}
                {activeTab === 'subjects' && (
                    <div className="p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-lg font-semibold text-gray-900">Subjects</h2>
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
                                <p className="text-gray-500">No subjects found</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>Subject Name</th>
                                            <th>Code</th>
                                            <th>Type</th>
                                            <th>Max Marks</th>
                                            <th>Passing Marks</th>
                                            <th>Status</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {subjects.map((subject) => (
                                            <tr key={subject._id}>
                                                <td className="font-medium">{subject.name}</td>
                                                <td className="font-mono text-sm">{subject.subjectCode || '-'}</td>
                                                <td>{subject.type || 'Theory'}</td>
                                                <td>{subject.maxMarks || 100}</td>
                                                <td>{subject.passingMarks || 33}</td>
                                                <td>
                                                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${subject.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                                        }`}>
                                                        {subject.isActive ? 'Active' : 'Inactive'}
                                                    </span>
                                                </td>
                                                <td>
                                                    {user?.role === 'admin' && (
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => {
                                                                    setEditingSubject(subject)
                                                                    setShowSubjectForm(true)
                                                                }}
                                                                className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                                                title="Edit"
                                                            >
                                                                <Edit className="h-4 w-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleToggleSubject(subject._id)}
                                                                className="p-1 text-yellow-600 hover:bg-yellow-50 rounded"
                                                                title="Toggle Status"
                                                            >
                                                                <Power className="h-4 w-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteSubject(subject._id)}
                                                                className="p-1 text-red-600 hover:bg-red-50 rounded"
                                                                title="Delete"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* ASSIGNMENTS TAB */}
                {activeTab === 'assignments' && (
                    <div className="p-6">
                        {!activeSession ? (
                            <div className="text-center py-12">
                                <UserPlus className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                                <p className="text-gray-500">Please activate an academic session first</p>
                            </div>
                        ) : (
                            <>
                                <div className="flex justify-between items-center mb-6">
                                    <h2 className="text-lg font-semibold text-gray-900">Subject Assignments</h2>
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
                                        const clsSubjects = classSubjects.filter(cs => cs.classId?._id === cls._id)
                                        if (clsSubjects.length === 0) return null

                                        return (
                                            <div key={cls._id} className="border border-gray-200 rounded-lg p-4">
                                                <h3 className="text-md font-semibold text-gray-900 mb-3">{cls.name} - {cls.grade}</h3>
                                                <div className="space-y-2">
                                                    {clsSubjects.map((cs) => {
                                                        const assignments = teacherAssignments.filter(ta =>
                                                            ta.classId?._id === cls._id && ta.subjectId?._id === cs.subjectId?._id
                                                        )

                                                        return (
                                                            <div key={cs._id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                                                                <div className="flex-1">
                                                                    <p className="font-medium text-gray-900">{cs.subjectId?.name}</p>
                                                                    <p className="text-sm text-gray-600">
                                                                        {assignments.length > 0 ? (
                                                                            <>Teachers: {assignments.map(a => a.teacherId?.name).join(', ')}</>
                                                                        ) : (
                                                                            <span className="text-red-600">No teacher assigned</span>
                                                                        )}
                                                                    </p>
                                                                </div>
                                                                <div className="text-sm text-gray-600">
                                                                    Max: {cs.maxMarks} | Pass: {cs.passingMarks}
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        )
                                    })}

                                    {classSubjects.length === 0 && (
                                        <div className="text-center py-12">
                                            <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                                            <p className="text-gray-500">No subject assignments found</p>
                                            <p className="text-sm text-gray-400 mt-1">Start by assigning subjects to classes</p>
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
                        fetchSessions()
                    }}
                />
            )}

            {showClassForm && (
                <ClassFormModal
                    classData={editingClass}
                    teachers={teachers}
                    onClose={() => setShowClassForm(false)}
                    onSuccess={() => {
                        setShowClassForm(false)
                        fetchClasses()
                    }}
                />
            )}

            {showSubjectForm && (
                <SubjectFormModal
                    subject={editingSubject}
                    onClose={() => setShowSubjectForm(false)}
                    onSuccess={() => {
                        setShowSubjectForm(false)
                        fetchSubjects()
                    }}
                />
            )}

            {showAssignmentForm && (
                <AssignmentFormModal
                    classes={classes}
                    subjects={subjects}
                    teachers={teachers}
                    activeSession={activeSession}
                    onClose={() => setShowAssignmentForm(false)}
                    onSuccess={() => {
                        setShowAssignmentForm(false)
                        fetchAssignments()
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

    return (
        <div className="modal-overlay">
            <div className="modal-content max-w-md">
                <div className="flex items-center justify-between border-b border-gray-200 p-6">
                    <h3 className="text-xl font-semibold text-gray-900">
                        {session ? 'Edit Session' : 'Add Academic Session'}
                    </h3>
                    <button onClick={onClose} className="p-2 rounded-md hover:bg-gray-100">
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
                                    required
                                />
                            </div>
                        </div>

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
                                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                />
                                <label htmlFor="isActive" className="text-sm text-gray-700">
                                    Set as active session
                                </label>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-200 mt-6">
                        <button type="button" onClick={onClose} className="btn btn-ghost">
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={isSaving}>
                            {isSaving ? 'Saving...' : session ? 'Update' : 'Create'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

// Class Form Modal
const ClassFormModal = ({ classData, teachers, onClose, onSuccess }) => {
    const [form, setForm] = useState({
        name: classData?.name || '',
        grade: classData?.grade || '',
        academicYear: classData?.academicYear || new Date().getFullYear().toString(),
        classTeacher: classData?.classTeacher?._id || '',
        sections: classData?.sections?.map(s => s.name).join(', ') || 'A'
    })
    const [isSaving, setIsSaving] = useState(false)

    const handleSubmit = async (e) => {
        e.preventDefault()

        try {
            setIsSaving(true)

            const data = {
                ...form,
                sections: form.sections.split(',').map(s => s.trim()).filter(Boolean)
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

    return (
        <div className="modal-overlay">
            <div className="modal-content max-w-md">
                <div className="flex items-center justify-between border-b border-gray-200 p-6">
                    <h3 className="text-xl font-semibold text-gray-900">
                        {classData ? 'Edit Class' : 'Add Class'}
                    </h3>
                    <button onClick={onClose} className="p-2 rounded-md hover:bg-gray-100">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6">
                    <div className="space-y-4">
                        <div>
                            <label className="label">Class Name *</label>
                            <input
                                className="input"
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                placeholder="e.g., Class 10"
                                required
                            />
                        </div>

                        <div>
                            <label className="label">Grade *</label>
                            <input
                                className="input"
                                value={form.grade}
                                onChange={(e) => setForm({ ...form, grade: e.target.value })}
                                placeholder="e.g., 10"
                                required
                            />
                        </div>

                        <div>
                            <label className="label">Academic Year *</label>
                            <input
                                className="input"
                                value={form.academicYear}
                                onChange={(e) => setForm({ ...form, academicYear: e.target.value })}
                                placeholder="e.g., 2024"
                                required
                            />
                        </div>

                        <div>
                            <label className="label">Class Teacher *</label>
                            <select
                                className="input"
                                value={form.classTeacher}
                                onChange={(e) => setForm({ ...form, classTeacher: e.target.value })}
                                required
                            >
                                <option value="">Select Teacher</option>
                                {teachers.map((teacher) => (
                                    <option key={teacher._id} value={teacher._id}>
                                        {teacher.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="label">Sections *</label>
                            <input
                                className="input"
                                value={form.sections}
                                onChange={(e) => setForm({ ...form, sections: e.target.value })}
                                placeholder="e.g., A, B, C"
                                required
                            />
                            <p className="text-xs text-gray-500 mt-1">Comma-separated section names</p>
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-200 mt-6">
                        <button type="button" onClick={onClose} className="btn btn-ghost">
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={isSaving}>
                            {isSaving ? 'Saving...' : classData ? 'Update' : 'Create'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

// Subject Form Modal
const SubjectFormModal = ({ subject, onClose, onSuccess }) => {
    const [form, setForm] = useState({
        name: subject?.name || '',
        subjectCode: subject?.subjectCode || '',
        type: subject?.type || 'Theory',
        maxMarks: subject?.maxMarks || 100,
        passingMarks: subject?.passingMarks || 33,
        description: subject?.description || ''
    })
    const [isSaving, setIsSaving] = useState(false)

    const handleSubmit = async (e) => {
        e.preventDefault()

        try {
            setIsSaving(true)

            if (subject) {
                await subjectsService.update(subject._id, form)
                toast.success('Subject updated successfully')
            } else {
                await subjectsService.create(form)
                toast.success('Subject created successfully')
            }

            onSuccess()
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to save subject')
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <div className="modal-overlay">
            <div className="modal-content max-w-md">
                <div className="flex items-center justify-between border-b border-gray-200 p-6">
                    <h3 className="text-xl font-semibold text-gray-900">
                        {subject ? 'Edit Subject' : 'Add Subject'}
                    </h3>
                    <button onClick={onClose} className="p-2 rounded-md hover:bg-gray-100">
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

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="label">Max Marks *</label>
                                <input
                                    type="number"
                                    className="input"
                                    value={form.maxMarks}
                                    onChange={(e) => setForm({ ...form, maxMarks: parseInt(e.target.value) })}
                                    min="0"
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
                                    required
                                />
                            </div>
                        </div>

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
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-200 mt-6">
                        <button type="button" onClick={onClose} className="btn btn-ghost">
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={isSaving}>
                            {isSaving ? 'Saving...' : subject ? 'Update' : 'Create'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

// Assignment Form Modal
const AssignmentFormModal = ({ classes, subjects, teachers, activeSession, onClose, onSuccess }) => {
    const [form, setForm] = useState({
        classId: '',
        subjectId: '',
        teacherId: '',
        maxMarks: 100,
        passingMarks: 33
    })
    const [isSaving, setIsSaving] = useState(false)

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

    return (
        <div className="modal-overlay">
            <div className="modal-content max-w-md">
                <div className="flex items-center justify-between border-b border-gray-200 p-6">
                    <h3 className="text-xl font-semibold text-gray-900">Assign Subject to Class</h3>
                    <button onClick={onClose} className="p-2 rounded-md hover:bg-gray-100">
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
                                onChange={(e) => setForm({ ...form, classId: e.target.value })}
                                required
                            >
                                <option value="">Select Class</option>
                                {classes.map((cls) => (
                                    <option key={cls._id} value={cls._id}>
                                        {cls.name} - {cls.grade}
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
                                {subjects.filter(s => s.isActive).map((subject) => (
                                    <option key={subject._id} value={subject._id}>
                                        {subject.name}
                                    </option>
                                ))}
                            </select>
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
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-200 mt-6">
                        <button type="button" onClick={onClose} className="btn btn-ghost">
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={isSaving}>
                            {isSaving ? 'Assigning...' : 'Assign Subject'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

export default AcademicsManagement
