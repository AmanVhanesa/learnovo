import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Edit, Power, PowerOff, Key, Download, Printer, Loader, TrendingUp, TrendingDown, Clock, CheckCircle, XCircle, AlertCircle, AlertTriangle, X, Eye, EyeOff, FileText, IndianRupee, Loader2 } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { studentsService } from '../services/studentsService'
import { attendanceService } from '../services/attendanceService'
import { examsService } from '../services/examsService'
import { useAuth } from '../contexts/AuthContext'
import StudentForm from '../components/students/StudentForm'
import ClassActionModal from '../components/students/ClassActionModal'
import SubjectPreferences from '../components/students/SubjectPreferences'
import ResultCard from '../components/ResultCard'
import { SERVER_URL } from '../constants/config'
import toast from 'react-hot-toast'
import { formatDate, formatDateShort } from '../utils/formatDate'

const StudentDetail = () => {
    const { id } = useParams()
    const navigate = useNavigate()
    const { user } = useAuth()

    const queryClient = useQueryClient()

    const [activeTab, setActiveTab] = useState('profile')
    const [showEditForm, setShowEditForm] = useState(false)
    const [classActionModal, setClassActionModal] = useState({ isOpen: false, type: null })

    // Modal states for password reset and deactivation
    const [showPasswordModal, setShowPasswordModal] = useState(false)
    const [passwordForm, setPasswordForm] = useState({ newPassword: '', confirmPassword: '' })
    const [showPassword, setShowPassword] = useState(false)
    const [showDeactivateModal, setShowDeactivateModal] = useState(false)
    const [deactivateReason, setDeactivateReason] = useState('')
    const [pendingFees, setPendingFees] = useState(null)
    const [feesLoading, setFeesLoading] = useState(false)
    const [feesSkipped, setFeesSkipped] = useState(false)
    const [showResultCard, setShowResultCard] = useState(false)
    const [detailFormBusy, setDetailFormBusy] = useState(false)

    const handleViewDetailForm = async () => {
        if (detailFormBusy) return
        setDetailFormBusy(true)
        const toastId = toast.loading('Opening detail form...')
        try {
            const html = await studentsService.viewDetailForm(id)
            const blob = new Blob([html], { type: 'text/html' })
            const url = URL.createObjectURL(blob)
            window.open(url, '_blank')
            setTimeout(() => URL.revokeObjectURL(url), 30000)
            toast.dismiss(toastId)
        } catch {
            toast.dismiss(toastId)
            toast.error('Failed to open detail form')
        } finally {
            setDetailFormBusy(false)
        }
    }

    const handleDownloadDetailForm = async () => {
        if (detailFormBusy) return
        setDetailFormBusy(true)
        const toastId = toast.loading('Generating PDF...')
        try {
            const blob = await studentsService.downloadDetailForm(id)
            const url = URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            const safeName = (student?.fullName || student?.name || 'Student').replace(/[^a-zA-Z0-9-_]/g, '_')
            link.download = `Student-Detail-${safeName}-${student?.admissionNumber || id}.pdf`
            document.body.appendChild(link)
            link.click()
            link.remove()
            setTimeout(() => URL.revokeObjectURL(url), 10000)
            toast.dismiss(toastId)
            toast.success('Detail form downloaded')
        } catch {
            toast.dismiss(toastId)
            toast.error('Failed to download detail form')
        } finally {
            setDetailFormBusy(false)
        }
    }

    // Fetch student + class history
    const { data: studentData, isLoading, error: studentError } = useQuery({
        queryKey: ['student', id],
        queryFn: async () => {
            const response = await studentsService.get(id)
            let history = []
            let admClass = 'N/A'
            try {
                const historyRes = await studentsService.getClassHistory(id)
                history = historyRes.data || []
                admClass = historyRes.admissionClass || 'N/A'
            } catch { /* class history not available */ }
            return { student: response.data, classHistory: history, admissionClassInfo: admClass }
        },
        staleTime: 0,
    })

    // Handle student fetch error — redirect back
    useEffect(() => {
        if (studentError) {
            toast.error('Failed to load student details')
            navigate('/app/students')
        }
    }, [studentError, navigate])

    const student = studentData?.student || null
    const classHistory = studentData?.classHistory || []
    const admissionClassInfo = studentData?.admissionClassInfo || 'N/A'

    // Fetch attendance when tab is activated (lazy)
    const { data: attendanceData, isLoading: isLoadingAttendance } = useQuery({
        queryKey: ['student-attendance', id],
        queryFn: async () => {
            const res = await attendanceService.getAttendanceReport({ studentId: id })
            return res.data || res || { summary: null, records: [] }
        },
        enabled: activeTab === 'attendance' && !!student,
        staleTime: 5 * 60 * 1000,
    })

    // Fetch exam results when tab is activated (lazy)
    const { data: examResultData, isLoading: isLoadingExams } = useQuery({
        queryKey: ['student-exams', id],
        queryFn: async () => {
            const res = await examsService.getResultCard(id)
            const d = res.data || res
            return {
                subjects: d?.subjects || [],
                summary: d?.summary || null,
                student: d?.student || null,
            }
        },
        enabled: activeTab === 'exams' && !!student,
        staleTime: 5 * 60 * 1000,
    })
    const examResults = examResultData?.subjects || []
    const examSummary = examResultData?.summary || null

    // Fetch pending fees when deactivation modal opens
    useEffect(() => {
        if (!showDeactivateModal || !id) return
        let cancelled = false
        setFeesLoading(true)
        setPendingFees(null)
        setFeesSkipped(false)
        studentsService.getPendingFees(id)
            .then(res => { if (!cancelled) setPendingFees(res.data) })
            .catch(() => { if (!cancelled) setPendingFees({ hasPending: false, totalAmount: 0, count: 0, breakdown: [] }) })
            .finally(() => { if (!cancelled) setFeesLoading(false) })
        return () => { cancelled = true }
    }, [showDeactivateModal, id])

    // Toggle status mutation
    const toggleStatusMutation = useMutation({
        mutationFn: ({ reason }) => studentsService.toggleStatus(id, reason ? { reason } : {}),
        onMutate: async ({ isDeactivation }) => {
            await queryClient.cancelQueries({ queryKey: ['student', id] })
            const previous = queryClient.getQueryData(['student', id])
            queryClient.setQueryData(['student', id], (old) => {
                if (!old?.student) return old
                return {
                    ...old,
                    student: {
                        ...old.student,
                        isActive: !isDeactivation,
                        ...(isDeactivation ? { inactivatedAt: new Date().toISOString() } : { inactivatedAt: null, removalDate: null, removalReason: null })
                    }
                }
            })
            return { previous }
        },
        onSuccess: (response, { isDeactivation }) => {
            // Update cache with authoritative server response to avoid stale refetch overwriting optimistic update
            if (response?.data) {
                queryClient.setQueryData(['student', id], (old) => ({
                    ...old,
                    student: response.data
                }))
            }
            if (isDeactivation) {
                toast.success('Student deactivated successfully')
                setShowDeactivateModal(false)
                setDeactivateReason('')
            } else {
                toast.success('Student activated successfully')
            }
        },
        onError: (error, { isDeactivation }, context) => {
            if (context?.previous) queryClient.setQueryData(['student', id], context.previous)
            toast.error(`Failed to ${isDeactivation ? 'deactivate' : 'activate'} student`)
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['student', id] })
            queryClient.invalidateQueries({ queryKey: ['students'] })
        },
    })

    const handleToggleStatus = (reason) => {
        if (!student.isActive) {
            toggleStatusMutation.mutate({ reason: undefined, isDeactivation: false })
            return
        }
        toggleStatusMutation.mutate({ reason, isDeactivation: true })
    }

    // Reset password mutation
    const resetPasswordMutation = useMutation({
        mutationFn: (payload) => studentsService.resetPassword(id, payload),
        onSuccess: (response) => {
            toast.success('Password reset successfully')
            if (response.data?.newPassword) {
                toast.success(`New password: ${response.data.newPassword}`, { duration: 10000 })
            }
            setShowPasswordModal(false)
            setPasswordForm({ newPassword: '', confirmPassword: '' })
        },
        onError: (error) => {
            toast.error(error.response?.data?.message || 'Failed to reset password')
        },
    })

    const handleResetPassword = (e) => {
        e.preventDefault()
        if (passwordForm.newPassword && passwordForm.newPassword !== passwordForm.confirmPassword) {
            toast.error('Passwords do not match')
            return
        }
        if (passwordForm.newPassword && passwordForm.newPassword.length < 6) {
            toast.error('Password must be at least 6 characters')
            return
        }
        resetPasswordMutation.mutate({
            newPassword: passwordForm.newPassword || undefined,
            forceChange: true
        })
    }

    // Save student mutation
    const saveMutation = useMutation({
        mutationFn: (formData) => studentsService.update(id, formData),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['student', id] })
            queryClient.invalidateQueries({ queryKey: ['students'] })
            toast.success('Student updated successfully')
            setShowEditForm(false)
        },
        onError: (error) => {
            if (error.response?.data?.errors && Array.isArray(error.response.data.errors)) {
                const errorMessages = error.response.data.errors.map(err => err.msg || err.message).join(', ')
                toast.error(errorMessages)
            } else {
                const errorMessage = error.response?.data?.message || error.response?.data?.error || 'Failed to update student'
                toast.error(errorMessage)
            }
        },
    })

    const handleSaveStudent = (formData) => {
        saveMutation.mutate(formData)
    }

    // Class action mutation (promote/demote)
    const classActionMutation = useMutation({
        mutationFn: async (data) => {
            if (classActionModal.type === 'promote') {
                await studentsService.promoteStudent(id, data)
            } else {
                await studentsService.demoteStudent(id, data)
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['student', id] })
            queryClient.invalidateQueries({ queryKey: ['students'] })
            toast.success(`Student ${classActionModal.type}d successfully`)
            setClassActionModal({ isOpen: false, type: null })
        },
        onError: (error) => {
            if (!error?.response?.data?.requiresOverride) {
                toast.error(error?.response?.data?.message || `Failed to ${classActionModal.type} student`)
            }
            throw error // Passing to modal to show override check if needed
        },
    })

    const handleClassAction = async (data) => {
        return classActionMutation.mutateAsync(data)
    }

    const allTabs = [
        { id: 'profile', label: 'Profile' },
        { id: 'subjects', label: 'Subjects', adminOnly: true },
        { id: 'fees', label: 'Fees', adminOnly: true },
        { id: 'attendance', label: 'Attendance' },
        { id: 'exams', label: 'Exams' },
        { id: 'history', label: 'Class History' },
        { id: 'activity', label: 'Activity Log', adminOnly: true }
    ]
    const tabs = user?.role === 'admin' ? allTabs : allTabs.filter(t => !t.adminOnly)

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader className="h-8 w-8 animate-spin text-primary-600" />
            </div>
        )
    }

    if (!student) {
        return (
            <div className="text-center py-12">
                <p className="text-gray-500 dark:text-[#8E8E93]">Student not found</p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/app/students')}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-[#2C2C2E] rounded-md"
                    >
                        <ArrowLeft className="h-5 w-5 text-gray-600 dark:text-[#8E8E93]" />
                    </button>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Student Details</h1>
                        <p className="text-sm text-gray-500 dark:text-[#8E8E93] mt-1">
                            Admission No: {student.admissionNumber}
                        </p>
                    </div>
                </div>

                {user?.role === 'admin' && (
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={() => setClassActionModal({ isOpen: true, type: 'promote' })}
                            className="btn btn-outline border-green-200 text-green-700 hover:bg-green-50 w-full sm:w-auto"
                            title="Promote Student"
                        >
                            <TrendingUp className="h-4 w-4 mr-1" />
                            Promote
                        </button>
                        <button
                            onClick={() => setClassActionModal({ isOpen: true, type: 'demote' })}
                            className="btn btn-outline border-orange-200 text-orange-700 hover:bg-orange-50 w-full sm:w-auto"
                            title="Demote Student"
                        >
                            <TrendingDown className="h-4 w-4 mr-1" />
                            Demote
                        </button>
                        <button
                            onClick={handleViewDetailForm}
                            disabled={detailFormBusy}
                            className="btn btn-outline w-full sm:w-auto"
                            title="View printable Student Detail Form"
                        >
                            <FileText className="h-4 w-4 mr-2" />
                            View Form
                        </button>
                        <button
                            onClick={handleDownloadDetailForm}
                            disabled={detailFormBusy}
                            className="btn btn-outline w-full sm:w-auto"
                            title="Download Student Detail Form (PDF)"
                        >
                            {detailFormBusy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                            Download Form
                        </button>
                        <button
                            onClick={() => setShowPasswordModal(true)}
                            className="btn btn-outline w-full sm:w-auto"
                            title="Reset Password"
                        >
                            <Key className="h-4 w-4 mr-2" />
                            Reset Password
                        </button>
                        <button
                            onClick={() => student.isActive ? setShowDeactivateModal(true) : handleToggleStatus()}
                            className={`btn w-full sm:w-auto ${student.isActive ? 'btn-outline' : 'btn-primary'}`}
                        >
                            {student.isActive ? (
                                <>
                                    <PowerOff className="h-4 w-4 mr-2" />
                                    Deactivate
                                </>
                            ) : (
                                <>
                                    <Power className="h-4 w-4 mr-2" />
                                    Activate
                                </>
                            )}
                        </button>
                        <button
                            onClick={() => setShowEditForm(true)}
                            className="btn btn-primary w-full sm:w-auto"
                        >
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                        </button>
                    </div>
                )}
            </div>

            {/* Student Card */}
            <div className="card p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6">
                    {/* Photo */}
                    <div className="flex-shrink-0">
                        {student.photo ? (
                            <img
                                src={student.photo.startsWith('http') ? student.photo : `${SERVER_URL}${student.photo}`}
                                alt={student.name}
                                className="h-24 w-24 sm:h-32 sm:w-32 rounded-full object-cover border-4 border-gray-200 dark:border-[#38383A]"
                            />
                        ) : (
                            <div className="h-24 w-24 sm:h-32 sm:w-32 rounded-full bg-gradient-to-br from-teal-400 to-teal-700 flex items-center justify-center border-4 border-gray-200 dark:border-[#38383A]">
                                <span className="text-3xl sm:text-4xl font-medium text-white">
                                    {student.name?.charAt(0)?.toUpperCase() || 'U'}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Basic Info */}
                    <div className="flex-1 text-center sm:text-left w-full">
                        <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-2">
                            <div>
                                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{student.name}</h2>
                                <p className="text-sm text-gray-500 dark:text-[#8E8E93] mt-1">
                                    {student.class} {student.section && `- Section ${student.section}`} • Roll No: {student.rollNumber || 'N/A'}
                                </p>
                            </div>
                            <span
                                className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${student.isActive
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                    : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                                    }`}
                            >
                                {student.isActive ? 'Active' : 'Inactive'}
                            </span>
                        </div>

                        {/* Deactivation Info */}
                        {!student.isActive && (student.removalDate || student.inactivatedAt) && (
                            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 rounded-lg">
                                <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                                    <div>
                                        <span className="text-red-600 dark:text-red-400 font-medium">Deactivated on: </span>
                                        <span className="text-gray-800 dark:text-gray-200">
                                            {formatDateShort(student.removalDate || student.inactivatedAt)}
                                        </span>
                                    </div>
                                    {student.createdAt && (
                                        <div>
                                            <span className="text-red-600 dark:text-red-400 font-medium">Active period: </span>
                                            <span className="text-gray-800 dark:text-gray-200">
                                                {formatDateShort(student.createdAt)}
                                                {' — '}
                                                {formatDateShort(student.removalDate || student.inactivatedAt)}
                                                {' '}
                                                ({(() => {
                                                    const start = new Date(student.createdAt);
                                                    const end = new Date(student.removalDate || student.inactivatedAt);
                                                    const diffMs = end - start;
                                                    const totalDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                                                    const years = Math.floor(totalDays / 365);
                                                    const months = Math.floor((totalDays % 365) / 30);
                                                    const days = totalDays % 30;
                                                    const parts = [];
                                                    if (years > 0) parts.push(`${years} year${years > 1 ? 's' : ''}`);
                                                    if (months > 0) parts.push(`${months} month${months > 1 ? 's' : ''}`);
                                                    if (days > 0 || parts.length === 0) parts.push(`${days} day${days !== 1 ? 's' : ''}`);
                                                    return parts.join(', ');
                                                })()})
                                            </span>
                                        </div>
                                    )}
                                    {student.removalReason && (
                                        <div>
                                            <span className="text-red-600 dark:text-red-400 font-medium">Reason: </span>
                                            <span className="text-gray-800 dark:text-gray-200">{student.removalReason}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                            <div>
                                <p className="text-xs text-gray-500 dark:text-[#8E8E93] uppercase">Email</p>
                                <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">{student.email}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 dark:text-[#8E8E93] uppercase">Phone</p>
                                <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">{student.phone || 'N/A'}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 dark:text-[#8E8E93] uppercase">Academic Year</p>
                                <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">{student.academicYear}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 dark:text-[#8E8E93] uppercase">Admission Class</p>
                                <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">{student.admissionClass || admissionClassInfo}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 dark:text-[#8E8E93] uppercase">Admission Date</p>
                                <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                                    {student.admissionDate
                                        ? formatDate(student.admissionDate)
                                        : 'N/A'}
                                </p>
                            </div>
                            {student.studentType && (
                                <div>
                                    <p className="text-xs text-gray-500 dark:text-[#8E8E93] uppercase">Student Type</p>
                                    <p className="text-sm font-medium mt-1">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                            student.studentType === 'new'
                                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                                        }`}>
                                            {student.studentType === 'new' ? 'New Admission' : 'Old Student'}
                                        </span>
                                    </p>
                                </div>
                            )}
                            <div>
                                <p className="text-xs text-gray-500 dark:text-[#8E8E93] uppercase">Studied For</p>
                                <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                                    {(() => {
                                        if (!student.admissionDate) return 'N/A';
                                        const start = new Date(student.admissionDate);
                                        const now = new Date();
                                        let years = now.getFullYear() - start.getFullYear();
                                        let months = now.getMonth() - start.getMonth();
                                        if (months < 0) { years--; months += 12; }
                                        if (years === 0) return months + ' month' + (months !== 1 ? 's' : '');
                                        if (months === 0) return years + ' year' + (years !== 1 ? 's' : '');
                                        return years + ' year' + (years !== 1 ? 's' : '') + ', ' + months + ' month' + (months !== 1 ? 's' : '');
                                    })()}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 dark:border-[#38383A]">
                <nav className="-mb-px flex space-x-8 overflow-x-auto overflow-y-hidden">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${activeTab === tab.id
                                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                                : 'border-transparent text-gray-500 dark:text-[#8E8E93] hover:text-gray-700 dark:hover:text-white hover:border-gray-300'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Tab Content */}
            <div className="card p-4 sm:p-6">
                {activeTab === 'profile' && (
                    <div className="space-y-6">
                        {/* Personal Details */}
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Personal Details</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <p className="text-xs text-gray-500 dark:text-[#8E8E93] uppercase">Date of Birth</p>
                                    <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                                        {student.dateOfBirth ? formatDate(student.dateOfBirth) : 'N/A'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 dark:text-[#8E8E93] uppercase">Gender</p>
                                    <p className="text-sm font-medium text-gray-900 dark:text-white mt-1 capitalize">{student.gender || 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 dark:text-[#8E8E93] uppercase">Blood Group</p>
                                    <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">{student.bloodGroup || 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 dark:text-[#8E8E93] uppercase">Religion</p>
                                    <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">{student.religion || 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 dark:text-[#8E8E93] uppercase">Category</p>
                                    <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">{student.category || 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 dark:text-[#8E8E93] uppercase">Identification Mark</p>
                                    <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">{student.identificationMark || 'N/A'}</p>
                                </div>
                            </div>
                        </div>

                        {/* Guardian Information */}
                        <div className="border-t border-gray-100 dark:border-[#38383A] pt-6">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Guardian Information</h3>
                            {student.guardians && student.guardians.length > 0 ? (
                                <div className="space-y-4">
                                    {student.guardians.map((guardian, index) => (
                                        <div key={index} className="bg-gray-50 dark:bg-[#2C2C2E] rounded-lg p-4">
                                            <p className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                                                {guardian.relation} {guardian.isPrimary && '(Primary)'}
                                            </p>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <div>
                                                    <p className="text-xs text-gray-500 dark:text-[#8E8E93] uppercase">Name</p>
                                                    <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">{guardian.name}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-500 dark:text-[#8E8E93] uppercase">Phone</p>
                                                    <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">{guardian.phone || 'N/A'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-500 dark:text-[#8E8E93] uppercase">Email</p>
                                                    <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">{guardian.email || 'N/A'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-500 dark:text-[#8E8E93] uppercase">Occupation</p>
                                                    <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">{guardian.occupation || 'N/A'}</p>
                                                </div>
                                                <div className="md:col-span-2">
                                                    <p className="text-xs text-gray-500 dark:text-[#8E8E93] uppercase">Aadhaar Number</p>
                                                    <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">{guardian.aadhaarNumber || 'N/A'}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-gray-500 dark:text-[#8E8E93]">No guardian information available</p>
                            )}
                        </div>

                        {/* Address */}
                        {student.address && (
                            <div className="border-t border-gray-100 dark:border-[#38383A] pt-6">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Address</h3>
                                <p className="text-sm text-gray-700 dark:text-[#8E8E93]">{student.address}</p>
                            </div>
                        )}

                        {/* Academic Background */}
                        {(student.previousSchool || student.previousBoard) && (
                            <div className="border-t border-gray-100 dark:border-[#38383A] pt-6">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Academic Background</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-xs text-gray-500 dark:text-[#8E8E93] uppercase">Previous School</p>
                                        <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">{student.previousSchool || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 dark:text-[#8E8E93] uppercase">Previous Board</p>
                                        <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">{student.previousBoard || 'N/A'}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Medical Information */}
                        {(student.medicalConditions || student.allergies) && (
                            <div className="border-t border-gray-100 dark:border-[#38383A] pt-6">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Medical Information</h3>
                                <div className="space-y-3">
                                    {student.medicalConditions && (
                                        <div>
                                            <p className="text-xs text-gray-500 dark:text-[#8E8E93] uppercase">Medical Conditions</p>
                                            <p className="text-sm text-gray-700 dark:text-[#8E8E93] mt-1">{student.medicalConditions}</p>
                                        </div>
                                    )}
                                    {student.allergies && (
                                        <div>
                                            <p className="text-xs text-gray-500 dark:text-[#8E8E93] uppercase">Allergies</p>
                                            <p className="text-sm text-gray-700 dark:text-[#8E8E93] mt-1">{student.allergies}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'subjects' && student && (
                    <SubjectPreferences
                        studentId={id}
                        studentName={student.fullName || student.name}
                        studentClass={student.class}
                    />
                )}

                {activeTab === 'fees' && (
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Fee Details</h3>
                        {student.isImported && student.studentType !== 'new' && (
                            <div className="flex items-center gap-2 p-3 mb-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/30 rounded-lg">
                                <svg className="h-4 w-4 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" /></svg>
                                <p className="text-xs text-blue-700 dark:text-blue-400">Admission fee not applicable (old student)</p>
                            </div>
                        )}
                        {student.fees && student.fees.length > 0 ? (
                            <div className="space-y-3">
                                {student.fees.map((fee, index) => (
                                    <div key={index} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-[#2C2C2E] rounded-lg">
                                        <div>
                                            <p className="text-sm font-medium text-gray-900 dark:text-white">{fee.title}</p>
                                            <p className="text-xs text-gray-500 dark:text-[#8E8E93] mt-1">
                                                Due: {formatDate(fee.dueDate)}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-semibold text-gray-900 dark:text-white">{fee.formattedAmount}</p>
                                            <span
                                                className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full mt-1 ${fee.status === 'paid'
                                                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                                    : fee.status === 'overdue'
                                                        ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                                                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                                                    }`}
                                            >
                                                {fee.status}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500 dark:text-[#8E8E93]">No fee records found</p>
                        )}
                    </div>
                )}

                {activeTab === 'attendance' && (
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Attendance Summary</h3>
                        {isLoadingAttendance ? (
                            <div className="flex justify-center py-8"><Loader className="h-6 w-6 animate-spin text-primary-500" /></div>
                        ) : attendanceData?.summary ? (
                            <div className="space-y-6">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 text-center">
                                        <CheckCircle className="h-6 w-6 text-green-500 mx-auto mb-1" />
                                        <p className="text-2xl font-bold text-green-700 dark:text-green-400">{attendanceData.summary.present || 0}</p>
                                        <p className="text-xs text-green-600 dark:text-green-500">Present</p>
                                    </div>
                                    <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 text-center">
                                        <XCircle className="h-6 w-6 text-red-500 mx-auto mb-1" />
                                        <p className="text-2xl font-bold text-red-700 dark:text-red-400">{attendanceData.summary.absent || 0}</p>
                                        <p className="text-xs text-red-600 dark:text-red-500">Absent</p>
                                    </div>
                                    <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 text-center">
                                        <AlertCircle className="h-6 w-6 text-yellow-500 mx-auto mb-1" />
                                        <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">{attendanceData.summary.late || 0}</p>
                                        <p className="text-xs text-yellow-600 dark:text-yellow-500">Late</p>
                                    </div>
                                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 text-center">
                                        <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                                            {attendanceData.summary.totalDays
                                                ? `${Math.round(((attendanceData.summary.present || 0) / attendanceData.summary.totalDays) * 100)}%`
                                                : 'N/A'}
                                        </p>
                                        <p className="text-xs text-blue-600 dark:text-blue-500">Attendance Rate</p>
                                    </div>
                                </div>
                                {attendanceData.records && attendanceData.records.length > 0 && (
                                    <div>
                                        <h4 className="text-sm font-semibold text-gray-700 dark:text-[#8E8E93] mb-2">Recent Records</h4>
                                        <div className="space-y-2">
                                            {attendanceData.records.slice(0, 10).map((record, idx) => (
                                                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-[#2C2C2E] rounded-lg">
                                                    <span className="text-sm text-gray-700 dark:text-[#8E8E93]">{formatDate(record.date)}</span>
                                                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                                        record.status === 'present' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                                        record.status === 'absent' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                                        'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                                    }`}>{record.status}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500 dark:text-[#8E8E93] text-center py-8 bg-gray-50 dark:bg-[#2C2C2E] rounded-lg">No attendance records found for this student.</p>
                        )}
                    </div>
                )}

                {activeTab === 'exams' && (
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Exam Results</h3>
                            {examResults.length > 0 && (
                                <button
                                    className="btn btn-primary btn-sm gap-1.5"
                                    onClick={() => setShowResultCard(true)}
                                >
                                    <FileText className="h-4 w-4" />
                                    View Report Card
                                </button>
                            )}
                        </div>

                        {/* Summary cards */}
                        {examSummary && (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                                <div className="bg-blue-50 dark:bg-blue-500/10 rounded-lg p-3 text-center">
                                    <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Overall %</p>
                                    <p className="text-xl font-bold text-blue-700 dark:text-blue-300 mt-1">{examSummary.overallPercentage}%</p>
                                </div>
                                <div className="bg-purple-50 dark:bg-purple-500/10 rounded-lg p-3 text-center">
                                    <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">Grade</p>
                                    <p className="text-xl font-bold text-purple-700 dark:text-purple-300 mt-1">{examSummary.overallGrade}</p>
                                </div>
                                <div className="bg-green-50 dark:bg-green-500/10 rounded-lg p-3 text-center">
                                    <p className="text-xs text-green-600 dark:text-green-400 font-medium">Passed</p>
                                    <p className="text-xl font-bold text-green-700 dark:text-green-300 mt-1">{examSummary.passCount}</p>
                                </div>
                                <div className="bg-red-50 dark:bg-red-500/10 rounded-lg p-3 text-center">
                                    <p className="text-xs text-red-600 dark:text-red-400 font-medium">Failed</p>
                                    <p className="text-xl font-bold text-red-700 dark:text-red-300 mt-1">{examSummary.failCount}</p>
                                </div>
                            </div>
                        )}

                        {isLoadingExams ? (
                            <div className="flex justify-center py-8"><Loader className="h-6 w-6 animate-spin text-primary-500" /></div>
                        ) : examResults.length > 0 ? (
                            <div className="space-y-3">
                                {examResults.map((result, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-[#2C2C2E] rounded-lg">
                                        <div>
                                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                                                {result.examName || result.subject || 'Exam'}
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-[#8E8E93] mt-1">
                                                {result.subject}{result.examSeries ? ` \u2022 ${result.examSeries}` : ''}
                                                {result.date ? ` \u2022 ${formatDate(result.date)}` : ''}
                                            </p>
                                        </div>
                                        <div className="text-right flex items-center gap-3">
                                            <div>
                                                <p className="text-sm font-bold text-gray-900 dark:text-white">
                                                    {result.marksObtained ?? '-'} / {result.totalMarks ?? '-'}
                                                </p>
                                                <div className="flex items-center gap-1.5 justify-end mt-1">
                                                    <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${
                                                        result.isPassed ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                                                        'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                                                    }`}>
                                                        {result.percentage}% — {result.grade}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500 dark:text-[#8E8E93] text-center py-8 bg-gray-50 dark:bg-[#2C2C2E] rounded-lg">No exam results found for this student.</p>
                        )}
                    </div>
                )}

                {/* Result Card Modal */}
                {showResultCard && student && (
                    <ResultCard
                        studentId={id}
                        studentName={student.fullName || student.name}
                        onClose={() => setShowResultCard(false)}
                    />
                )}

                {activeTab === 'activity' && (
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Activity Log</h3>
                        <div className="space-y-3">
                            <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-[#2C2C2E] rounded-lg">
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">Student Created</p>
                                    <p className="text-xs text-gray-500 dark:text-[#8E8E93] mt-1">
                                        {new Date(student.createdAt).toLocaleString()}
                                    </p>
                                </div>
                            </div>
                            {student.updatedAt && student.updatedAt !== student.createdAt && (
                                <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-[#2C2C2E] rounded-lg">
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-gray-900 dark:text-white">Last Updated</p>
                                        <p className="text-xs text-gray-500 dark:text-[#8E8E93] mt-1">
                                            {new Date(student.updatedAt).toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'history' && (
                    <div>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                                <Clock className="h-5 w-5 mr-2 text-gray-400 dark:text-[#636366]" />
                                Class Update History
                            </h3>
                            <span className="text-sm text-gray-500 dark:text-[#8E8E93] bg-gray-100 dark:bg-[#2C2C2E] px-3 py-1 rounded-full whitespace-nowrap">
                                Admitted In: <span className="font-semibold text-gray-800 dark:text-white">{student.admissionClass || admissionClassInfo}</span>
                            </span>
                        </div>
                        {classHistory.length > 0 ? (
                            <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-200 dark:before:via-dark-border before:to-transparent">
                                {classHistory.map((item) => (
                                    <div key={item._id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                                        <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white dark:border-[#1C1C1E] bg-slate-100 dark:bg-[#2C2C2E] text-slate-500 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm z-10">
                                            {item.actionType === 'promoted' ? <TrendingUp className="h-5 w-5 text-green-500" /> : <TrendingDown className="h-5 w-5 text-orange-500" />}
                                        </div>
                                        <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white dark:bg-[#1C1C1E] p-4 rounded-lg border border-gray-100 dark:border-[#38383A] shadow-sm">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className={`font-semibold capitalize ${item.actionType === 'promoted' ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'}`}>{item.actionType}</span>
                                                <time className="text-xs font-medium text-gray-500 dark:text-[#8E8E93]">{formatDate(item.createdAt)}</time>
                                            </div>
                                            <p className="text-sm text-gray-700 dark:text-[#8E8E93]">
                                                Moved from <strong>{item.fromClass} {item.fromSection && `(${item.fromSection})`}</strong> to <strong>{item.toClass} {item.toSection && `(${item.toSection})`}</strong>
                                            </p>
                                            <div className="mt-2 text-xs flex gap-4 text-gray-500 dark:text-[#8E8E93]">
                                                <span>A.Y: {item.academicYear}</span>
                                                <span>By: {item.performedBy?.name || item.performedBy?.fullName || 'System'}</span>
                                            </div>
                                            {item.remarks && <p className="mt-2 text-xs text-gray-600 dark:text-[#8E8E93] italic">Note: {item.remarks}</p>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500 dark:text-[#8E8E93] text-center py-8 bg-gray-50 dark:bg-[#2C2C2E] rounded-lg border border-dashed border-gray-200 dark:border-[#38383A]">No promotion or demotion records found in history.</p>
                        )}
                    </div>
                )}
            </div>

            {/* Edit Form Modal */}
            {showEditForm && (
                <StudentForm
                    student={student}
                    onSave={handleSaveStudent}
                    onCancel={() => setShowEditForm(false)}
                    isLoading={saveMutation.isPending}
                />
            )}

            {/* Class Action Modal */}
            <ClassActionModal
                isOpen={classActionModal.isOpen}
                type={classActionModal.type}
                student={student}
                onClose={() => setClassActionModal({ isOpen: false, type: null })}
                onConfirm={handleClassAction}
                isLoading={classActionMutation.isPending}
            />

            {/* Password Reset Modal */}
            {showPasswordModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
                        <div className="p-6 border-b border-gray-100 dark:border-[#38383A] flex justify-between items-center">
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <Key className="h-5 w-5 text-primary-500" />
                                Reset Password
                            </h2>
                            <button onClick={() => { setShowPasswordModal(false); setPasswordForm({ newPassword: '', confirmPassword: '' }) }} className="p-2 hover:bg-gray-100 dark:hover:bg-[#2C2C2E] rounded-full">
                                <X className="h-5 w-5 text-gray-400 dark:text-[#636366]" />
                            </button>
                        </div>
                        <form onSubmit={handleResetPassword} className="p-6 space-y-4">
                            <p className="text-sm text-gray-600 dark:text-[#8E8E93]">
                                Set a new password for <strong>{student.name}</strong>. Leave blank to auto-generate a secure password.
                            </p>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">New Password</label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        className="w-full px-4 py-2 pr-10 border border-gray-300 dark:border-[#38383A] rounded-xl focus:ring-2 focus:ring-primary-500 outline-none dark:bg-[#2C2C2E] dark:text-white"
                                        placeholder="Leave blank for auto-generated"
                                        value={passwordForm.newPassword}
                                        onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                                        minLength={passwordForm.newPassword ? 6 : undefined}
                                    />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-[#8E8E93]">
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>
                            {passwordForm.newPassword && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">Confirm Password</label>
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        className="w-full px-4 py-2 border border-gray-300 dark:border-[#38383A] rounded-xl focus:ring-2 focus:ring-primary-500 outline-none dark:bg-[#2C2C2E] dark:text-white"
                                        placeholder="Confirm new password"
                                        value={passwordForm.confirmPassword}
                                        onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                                        required
                                    />
                                </div>
                            )}
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg text-xs text-blue-700 dark:text-blue-400">
                                The student will be required to change this password on next login.
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={() => { setShowPasswordModal(false); setPasswordForm({ newPassword: '', confirmPassword: '' }) }} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-[#8E8E93] hover:bg-gray-100 dark:hover:bg-[#2C2C2E] rounded-xl">
                                    Cancel
                                </button>
                                <button type="submit" disabled={resetPasswordMutation.isPending} className="px-6 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-2xl shadow-glass disabled:opacity-50">
                                    {resetPasswordMutation.isPending ? 'Resetting...' : 'Reset Password'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Deactivation Modal */}
            {showDeactivateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col">
                        <div className="p-6 border-b border-gray-100 dark:border-[#38383A] flex justify-between items-center">
                            <h2 className="text-lg font-bold text-red-600 flex items-center gap-2">
                                <PowerOff className="h-5 w-5" />
                                Deactivate Student
                            </h2>
                            <button onClick={() => { setShowDeactivateModal(false); setDeactivateReason(''); setFeesSkipped(false) }} className="p-2 hover:bg-gray-100 dark:hover:bg-[#2C2C2E] rounded-full">
                                <X className="h-5 w-5 text-gray-400 dark:text-[#636366]" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4 overflow-y-auto flex-1 min-h-0">
                            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-xl">
                                <p className="text-sm text-red-700 dark:text-red-400">
                                    You are about to deactivate <strong>{student.name}</strong> ({student.admissionNumber}). This will prevent them from logging in and accessing the system.
                                </p>
                            </div>

                            {/* Pending Fees Section */}
                            {feesLoading ? (
                                <div className="flex items-center justify-center gap-2 py-4 text-gray-500 dark:text-[#8E8E93]">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    <span className="text-sm">Checking pending fees...</span>
                                </div>
                            ) : pendingFees?.hasPending ? (
                                <div className="border border-red-200 dark:border-red-800 rounded-2xl overflow-hidden">
                                    <div className="bg-red-50 dark:bg-red-900/20 px-4 py-3 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                                            <span className="text-sm font-semibold text-red-800 dark:text-red-300">Pending Fees Found</span>
                                        </div>
                                        <span className="text-base font-bold text-red-600 dark:text-red-400 flex items-center">
                                            <IndianRupee className="h-3.5 w-3.5" />
                                            {pendingFees.totalAmount?.toLocaleString('en-IN')}
                                        </span>
                                    </div>
                                    {pendingFees.breakdown?.length > 0 && (
                                        <div className="max-h-36 overflow-y-auto divide-y divide-gray-100 dark:divide-[#38383A]">
                                            {pendingFees.breakdown.map((fee, i) => (
                                                <div key={fee.id || i} className="px-4 py-2 flex items-center justify-between text-sm">
                                                    <div className="min-w-0 flex-1 mr-3">
                                                        <p className="text-gray-800 dark:text-gray-200 font-medium truncate">{fee.description}</p>
                                                        <p className="text-xs text-gray-400 dark:text-[#636366] capitalize">{fee.feeType} · {fee.status}</p>
                                                    </div>
                                                    <span className="font-semibold text-gray-900 dark:text-white whitespace-nowrap flex items-center">
                                                        <IndianRupee className="h-3 w-3" />{fee.balance?.toLocaleString('en-IN')}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {!feesSkipped && (
                                        <div className="px-4 py-3 bg-gray-50 dark:bg-[#2C2C2E] flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => { setShowDeactivateModal(false); setDeactivateReason(''); navigate(`/app/fees?student=${id}`) }}
                                                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-xl"
                                            >
                                                Collect Fees
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setFeesSkipped(true)}
                                                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-xl"
                                            >
                                                Skip & Proceed
                                            </button>
                                        </div>
                                    )}
                                    {feesSkipped && (
                                        <div className="px-4 py-2 bg-amber-50 dark:bg-amber-900/10 text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                                            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                                            Pending fees skipped — proceeding with deactivation
                                        </div>
                                    )}
                                </div>
                            ) : pendingFees && (
                                <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-3 flex items-center gap-2">
                                    <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                                    <span className="text-sm text-emerald-800 dark:text-emerald-300">No pending fees</span>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">Reason for Deactivation <span className="text-red-500">*</span></label>
                                <textarea
                                    className="w-full px-4 py-2 border border-gray-300 dark:border-[#38383A] rounded-xl focus:ring-2 focus:ring-red-500 outline-none dark:bg-[#2C2C2E] dark:text-white"
                                    rows="3"
                                    placeholder="e.g., Left school, Transfer to another institution, Disciplinary action..."
                                    value={deactivateReason}
                                    onChange={(e) => setDeactivateReason(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button onClick={() => { setShowDeactivateModal(false); setDeactivateReason(''); setFeesSkipped(false) }} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-[#8E8E93] hover:bg-gray-100 dark:hover:bg-[#2C2C2E] rounded-xl">
                                    Cancel
                                </button>
                                <button
                                    onClick={() => handleToggleStatus(deactivateReason)}
                                    disabled={!deactivateReason.trim() || toggleStatusMutation.isPending || feesLoading || (pendingFees?.hasPending && !feesSkipped)}
                                    className="px-6 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-2xl shadow-glass disabled:opacity-50"
                                >
                                    {toggleStatusMutation.isPending ? 'Deactivating...' : 'Deactivate Student'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default StudentDetail
