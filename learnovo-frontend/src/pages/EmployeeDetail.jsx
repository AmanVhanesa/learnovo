import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Edit, Power, PowerOff, Key, Download, Loader, UserCheck, UserX, CheckCircle, XCircle, AlertCircle, Clock, Calendar, BookOpen, IndianRupee, FileText, User, Briefcase } from 'lucide-react'
import { employeesService } from '../services/employeesService'
import { attendanceService } from '../services/attendanceService'
import payrollService from '../services/payrollService'
import { teacherAssignmentsService } from '../services/academicsService'
import { useAuth } from '../contexts/AuthContext'
import EmployeeForm from '../components/employees/EmployeeForm'
import toast from 'react-hot-toast'

const EmployeeDetail = () => {
    const { id } = useParams()
    const navigate = useNavigate()
    const { user } = useAuth()
    const queryClient = useQueryClient()

    const [activeTab, setActiveTab] = useState('profile')
    const [showEditForm, setShowEditForm] = useState(false)
    const [salaryYear, setSalaryYear] = useState(new Date().getFullYear())

    // Fetch employee
    const { data: employee = null, isLoading } = useQuery({
        queryKey: ['employee', id],
        queryFn: async () => {
            const response = await employeesService.get(id)
            return response.data
        },
    })

    // Fetch attendance when tab is active (lazy)
    const { data: attendanceData, isLoading: isLoadingAttendance } = useQuery({
        queryKey: ['employee-attendance', id],
        queryFn: async () => {
            const [summaryRes, recordsRes] = await Promise.allSettled([
                attendanceService.getEmployeeSummary(id),
                attendanceService.getEmployeeAttendance(id, { limit: 20 })
            ])
            return {
                summary: summaryRes.status === 'fulfilled' ? (summaryRes.value?.data || summaryRes.value) : null,
                records: recordsRes.status === 'fulfilled' ? (recordsRes.value?.data || recordsRes.value?.records || recordsRes.value || []) : []
            }
        },
        enabled: activeTab === 'attendance' && !!employee,
        staleTime: 5 * 60 * 1000,
    })

    // Fetch payroll history when tab is active (lazy)
    const { data: payrollData, isLoading: isLoadingPayroll } = useQuery({
        queryKey: ['employee-payroll', id, salaryYear],
        queryFn: async () => {
            const res = await payrollService.getEmployeePayrollHistory(id, salaryYear)
            return res.data || res || []
        },
        enabled: activeTab === 'salary' && !!employee,
        staleTime: 5 * 60 * 1000,
    })

    // Fetch teacher assignments when tab is active (lazy, only for teachers)
    const { data: assignmentsData, isLoading: isLoadingAssignments } = useQuery({
        queryKey: ['employee-assignments', id],
        queryFn: async () => {
            const res = await teacherAssignmentsService.getTeacherAssignments(id)
            return res.data || res || []
        },
        enabled: activeTab === 'timetable' && !!employee && employee.role === 'teacher',
        staleTime: 5 * 60 * 1000,
    })

    // Update employee mutation
    const updateEmployeeMutation = useMutation({
        mutationFn: async (formData) => {
            await employeesService.update(id, formData)
        },
        onSuccess: () => {
            toast.success('Employee updated successfully')
            setShowEditForm(false)
            queryClient.invalidateQueries({ queryKey: ['employee', id] })
            queryClient.invalidateQueries({ queryKey: ['employees'] })
        },
        onError: (error) => {
            console.error('Update employee error:', error)
            toast.error(error.response?.data?.message || 'Failed to update employee')
        },
    })

    // Toggle status mutation
    const toggleStatusMutation = useMutation({
        mutationFn: async ({ reason }) => {
            await employeesService.toggleStatus(id, { reason })
        },
        onSuccess: () => {
            const action = employee?.isActive ? 'deactivate' : 'activate'
            toast.success(`Employee ${action}d successfully`)
            queryClient.invalidateQueries({ queryKey: ['employee', id] })
            queryClient.invalidateQueries({ queryKey: ['employees'] })
        },
        onError: (error) => {
            const action = employee?.isActive ? 'deactivate' : 'activate'
            console.error('Toggle status error:', error)
            toast.error(`Failed to ${action} employee`)
        },
    })

    // Reset password mutation
    const resetPasswordMutation = useMutation({
        mutationFn: async ({ newPassword }) => {
            return await employeesService.resetPassword(id, {
                newPassword: newPassword || 'employee123',
                forceChange: true
            })
        },
        onSuccess: (response) => {
            toast.success('Password reset successfully')
            if (response.data) {
                toast.success(`New password: ${response.data.newPassword}`, { duration: 10000 })
            }
        },
        onError: (error) => {
            console.error('Reset password error:', error)
            toast.error('Failed to reset password')
        },
    })

    // Toggle login mutation
    const toggleLoginMutation = useMutation({
        mutationFn: async () => {
            if (employee.loginEnabled) {
                await employeesService.disableLogin(id)
            } else {
                const email = prompt('Enter email for login (optional):')
                await employeesService.createLogin(id, { email })
            }
        },
        onSuccess: () => {
            toast.success(employee?.loginEnabled ? 'Login disabled successfully' : 'Login enabled successfully')
            queryClient.invalidateQueries({ queryKey: ['employee', id] })
            queryClient.invalidateQueries({ queryKey: ['employees'] })
        },
        onError: (error) => {
            console.error('Toggle login error:', error)
            toast.error('Failed to toggle login')
        },
    })

    const handleToggleStatus = () => {
        const reason = employee.isActive ? prompt('Reason for deactivation:') : null
        if (employee.isActive && !reason) return
        toggleStatusMutation.mutate({ reason })
    }

    const handleResetPassword = () => {
        const newPassword = prompt('Enter new password (leave empty for default "employee123"):')
        if (newPassword === null) return
        resetPasswordMutation.mutate({ newPassword })
    }

    const handleToggleLogin = () => {
        toggleLoginMutation.mutate()
    }

    const handleSaveEmployee = (formData) => {
        updateEmployeeMutation.mutate(formData)
    }

    const handleDownloadSlip = async (payrollId) => {
        try {
            const blob = await payrollService.downloadSalarySlip(payrollId)
            const url = window.URL.createObjectURL(new Blob([blob]))
            const link = document.createElement('a')
            link.href = url
            link.setAttribute('download', `salary_slip_${payrollId}.pdf`)
            document.body.appendChild(link)
            link.click()
            link.remove()
            window.URL.revokeObjectURL(url)
        } catch {
            toast.error('Failed to download salary slip')
        }
    }

    const isSaving = updateEmployeeMutation.isPending

    const tabs = [
        { id: 'profile', label: 'Profile' },
        { id: 'attendance', label: 'Attendance' },
        { id: 'salary', label: 'Salary' },
        { id: 'timetable', label: 'Timetable' },
        { id: 'activity', label: 'Activity Log' }
    ]

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader className="h-8 w-8 animate-spin text-primary-600" />
            </div>
        )
    }

    if (!employee) {
        return (
            <div className="text-center py-12">
                <p className="text-gray-500 dark:text-[#8E8E93]">Employee not found</p>
            </div>
        )
    }

    const getRoleBadgeColor = (role) => {
        const colors = {
            admin: 'bg-purple-100 text-purple-800',
            teacher: 'bg-blue-100 text-blue-800',
            accountant: 'bg-green-100 text-green-800',
            staff: 'bg-gray-100 dark:bg-[#2C2C2E] text-gray-800 dark:text-[#8E8E93]'
        }
        return colors[role] || 'bg-gray-100 dark:bg-[#2C2C2E] text-gray-800 dark:text-[#8E8E93]'
    }

    const getStatusBadge = (status) => {
        const styles = {
            present: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
            absent: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
            late: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
            half_day: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
            on_leave: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
        }
        return styles[status] || 'bg-gray-100 text-gray-700 dark:bg-[#2C2C2E] dark:text-[#8E8E93]'
    }

    const getPaymentStatusBadge = (status) => {
        const styles = {
            paid: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
            pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
            processing: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
        }
        return styles[status] || 'bg-gray-100 text-gray-700'
    }

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

    // Parse attendance summary safely
    const attSummary = attendanceData?.summary
    const attRecords = Array.isArray(attendanceData?.records) ? attendanceData.records : []
    const totalDays = (attSummary?.present || 0) + (attSummary?.absent || 0) + (attSummary?.late || 0) + (attSummary?.halfDay || 0) + (attSummary?.onLeave || 0)
    const attendanceRate = totalDays > 0 ? Math.round(((attSummary?.present || 0) + (attSummary?.late || 0)) / totalDays * 100) : null

    // Parse payroll data
    const payrollRecords = Array.isArray(payrollData) ? payrollData : []

    // Parse assignments
    const assignments = Array.isArray(assignmentsData) ? assignmentsData : []

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3 sm:gap-4">
                    <button onClick={() => navigate('/app/employees')} className="p-2 hover:bg-gray-100 dark:hover:bg-[#2C2C2E] rounded-md flex-shrink-0">
                        <ArrowLeft className="h-5 w-5 text-gray-600 dark:text-[#8E8E93]" />
                    </button>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Employee Details</h1>
                        <p className="text-xs sm:text-sm text-gray-500 dark:text-[#8E8E93] mt-1">
                            Employee ID: {employee.employeeId}
                        </p>
                    </div>
                </div>

                {user?.role === 'admin' && (
                    <div className="grid grid-cols-2 sm:flex gap-2">
                        <button onClick={handleResetPassword} className="btn btn-outline w-full sm:w-auto text-sm" title="Reset Password">
                            <Key className="h-4 w-4 mr-1 sm:mr-2" />
                            <span className="hidden sm:inline">Reset </span>Password
                        </button>
                        <button
                            onClick={handleToggleLogin}
                            className={`btn w-full sm:w-auto text-sm ${employee.loginEnabled ? 'btn-outline' : 'btn-primary'}`}
                        >
                            {employee.loginEnabled ? (
                                <>
                                    <UserX className="h-4 w-4 mr-1 sm:mr-2" />
                                    <span className="hidden sm:inline">Disable </span>Login
                                </>
                            ) : (
                                <>
                                    <UserCheck className="h-4 w-4 mr-1 sm:mr-2" />
                                    <span className="hidden sm:inline">Enable </span>Login
                                </>
                            )}
                        </button>
                        <button
                            onClick={handleToggleStatus}
                            className={`btn w-full sm:w-auto text-sm ${employee.isActive ? 'btn-outline' : 'btn-primary'}`}
                        >
                            {employee.isActive ? (
                                <>
                                    <PowerOff className="h-4 w-4 mr-1 sm:mr-2" />
                                    Deactivate
                                </>
                            ) : (
                                <>
                                    <Power className="h-4 w-4 mr-1 sm:mr-2" />
                                    Activate
                                </>
                            )}
                        </button>
                        <button onClick={() => setShowEditForm(true)} className="btn btn-primary w-full sm:w-auto text-sm">
                            <Edit className="h-4 w-4 mr-1 sm:mr-2" />
                            Edit
                        </button>
                    </div>
                )}
            </div>

            {/* Employee Card */}
            <div className="card p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6">
                    {/* Photo */}
                    <div className="flex-shrink-0">
                        {employee.photo ? (
                            <img
                                src={employee.photo}
                                alt={employee.name}
                                className="h-24 w-24 sm:h-32 sm:w-32 rounded-full object-cover border-4 border-gray-200 dark:border-[#38383A]"
                            />
                        ) : (
                            <div className="h-24 w-24 sm:h-32 sm:w-32 rounded-full bg-gray-200 dark:bg-[#3A3A3C] flex items-center justify-center border-4 border-gray-200 dark:border-[#38383A]">
                                <span className="text-3xl sm:text-4xl font-medium text-gray-700 dark:text-white">
                                    {employee.name?.charAt(0).toUpperCase()}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Basic Info */}
                    <div className="flex-1 w-full text-center sm:text-left">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                            <div>
                                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{employee.name?.toUpperCase()}</h2>
                                <p className="text-sm text-gray-500 dark:text-[#8E8E93] mt-1">
                                    {employee.designation || employee.role} • {employee.department || 'No Department'}
                                </p>
                            </div>
                            <div className="flex justify-center sm:justify-end sm:flex-col items-center sm:items-end gap-2">
                                <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getRoleBadgeColor(employee.role)}`}>
                                    {employee.role?.charAt(0).toUpperCase() + employee.role?.slice(1)}
                                </span>
                                <span
                                    className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${employee.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                        }`}
                                >
                                    {employee.isActive ? 'Active' : 'Inactive'}
                                </span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 sm:mt-6">
                            <div>
                                <p className="text-xs text-gray-500 dark:text-[#8E8E93] uppercase">Email</p>
                                <p className="text-sm font-medium text-gray-900 dark:text-white mt-1 break-all">{employee.email || 'N/A'}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 dark:text-[#8E8E93] uppercase">Phone</p>
                                <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">{employee.phone || 'N/A'}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 dark:text-[#8E8E93] uppercase">Joining Date</p>
                                <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                                    {employee.dateOfJoining ? new Date(employee.dateOfJoining).toLocaleDateString() : 'N/A'}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 dark:text-[#8E8E93] uppercase">Login Status</p>
                                <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                                    {employee.loginEnabled ? 'Enabled' : 'Disabled'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 dark:border-[#38383A]">
                <nav className="-mb-px flex overflow-x-auto whitespace-nowrap space-x-4 sm:space-x-8">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`py-3 sm:py-4 px-1 border-b-2 font-medium text-sm transition-colors flex-shrink-0 ${activeTab === tab.id
                                ? 'border-primary-500 text-primary-600'
                                : 'border-transparent text-gray-500 dark:text-[#8E8E93] hover:text-gray-700 dark:hover:text-white hover:border-gray-300 dark:hover:border-[#38383A]'
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
                        {/* Professional Details */}
                        <div>
                            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">Professional Details</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                <div>
                                    <p className="text-xs text-gray-500 dark:text-[#8E8E93] uppercase">Employee ID</p>
                                    <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">{employee.employeeId || 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 dark:text-[#8E8E93] uppercase">Designation</p>
                                    <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">{employee.designation || 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 dark:text-[#8E8E93] uppercase">Department</p>
                                    <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">{employee.department || 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 dark:text-[#8E8E93] uppercase">Monthly Salary</p>
                                    <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                                        {employee.salary ? `₹${employee.salary.toLocaleString()}` : 'N/A'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 dark:text-[#8E8E93] uppercase">Education</p>
                                    <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">{employee.education || 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 dark:text-[#8E8E93] uppercase">Experience</p>
                                    <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                                        {employee.experience ? `${employee.experience} years` : 'N/A'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Personal Details */}
                        <div className="border-t border-gray-100 dark:border-[#38383A] pt-6">
                            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">Personal Details</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                <div>
                                    <p className="text-xs text-gray-500 dark:text-[#8E8E93] uppercase">Father/Husband Name</p>
                                    <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">{employee.fatherOrHusbandName || 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 dark:text-[#8E8E93] uppercase">Gender</p>
                                    <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                                        {employee.gender ? employee.gender.charAt(0).toUpperCase() + employee.gender.slice(1) : 'N/A'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 dark:text-[#8E8E93] uppercase">Date of Birth</p>
                                    <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                                        {employee.dateOfBirth ? new Date(employee.dateOfBirth).toLocaleDateString() : 'N/A'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 dark:text-[#8E8E93] uppercase">Religion</p>
                                    <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">{employee.religion || 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 dark:text-[#8E8E93] uppercase">Blood Group</p>
                                    <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">{employee.bloodGroup || 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 dark:text-[#8E8E93] uppercase">National ID</p>
                                    <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">{employee.nationalId || 'N/A'}</p>
                                </div>
                            </div>
                        </div>

                        {/* Address */}
                        {employee.homeAddress && (
                            <div className="border-t border-gray-100 dark:border-[#38383A] pt-6">
                                <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-2">Address</h3>
                                <p className="text-sm text-gray-700 dark:text-[#8E8E93]">{employee.homeAddress}</p>
                            </div>
                        )}

                        {/* Bank Details — admin only */}
                        {user?.role === 'admin' && (
                            <div className="border-t border-gray-100 dark:border-[#38383A] pt-6">
                                <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">Bank Details</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                    <div>
                                        <p className="text-xs text-gray-500 dark:text-[#8E8E93] uppercase">Bank Name</p>
                                        <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">{employee.bankName || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 dark:text-[#8E8E93] uppercase">Account Number</p>
                                        <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">{employee.accountNumber || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 dark:text-[#8E8E93] uppercase">IFSC Code</p>
                                        <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">{employee.ifscCode || 'N/A'}</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ── ATTENDANCE TAB ────────────────────────────────────────── */}
                {activeTab === 'attendance' && (
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Attendance Summary</h3>
                        {isLoadingAttendance ? (
                            <div className="flex justify-center py-8"><Loader className="h-6 w-6 animate-spin text-primary-500" /></div>
                        ) : attSummary ? (
                            <div className="space-y-6">
                                {/* Summary Cards */}
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                    <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 text-center">
                                        <CheckCircle className="h-5 w-5 text-green-500 mx-auto mb-1" />
                                        <p className="text-2xl font-bold text-green-700 dark:text-green-400">{attSummary.present || 0}</p>
                                        <p className="text-xs text-green-600 dark:text-green-500">Present</p>
                                    </div>
                                    <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 text-center">
                                        <XCircle className="h-5 w-5 text-red-500 mx-auto mb-1" />
                                        <p className="text-2xl font-bold text-red-700 dark:text-red-400">{attSummary.absent || 0}</p>
                                        <p className="text-xs text-red-600 dark:text-red-500">Absent</p>
                                    </div>
                                    <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 text-center">
                                        <AlertCircle className="h-5 w-5 text-yellow-500 mx-auto mb-1" />
                                        <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">{attSummary.late || 0}</p>
                                        <p className="text-xs text-yellow-600 dark:text-yellow-500">Late</p>
                                    </div>
                                    <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4 text-center">
                                        <Clock className="h-5 w-5 text-orange-500 mx-auto mb-1" />
                                        <p className="text-2xl font-bold text-orange-700 dark:text-orange-400">{attSummary.halfDay || attSummary.onLeave || 0}</p>
                                        <p className="text-xs text-orange-600 dark:text-orange-500">Half Day / Leave</p>
                                    </div>
                                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 text-center">
                                        <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                                            {attendanceRate !== null ? `${attendanceRate}%` : 'N/A'}
                                        </p>
                                        <p className="text-xs text-blue-600 dark:text-blue-500">Attendance Rate</p>
                                    </div>
                                </div>

                                {/* Recent Records */}
                                {attRecords.length > 0 && (
                                    <div>
                                        <h4 className="text-sm font-semibold text-gray-700 dark:text-[#8E8E93] mb-3">Recent Records</h4>
                                        <div className="space-y-2">
                                            {attRecords.slice(0, 15).map((record, idx) => (
                                                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-[#2C2C2E] rounded-lg">
                                                    <div className="flex items-center gap-3">
                                                        <Calendar className="h-4 w-4 text-gray-400" />
                                                        <span className="text-sm text-gray-700 dark:text-[#8E8E93]">
                                                            {new Date(record.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                                                        </span>
                                                    </div>
                                                    <span className={`px-2 py-1 text-xs font-semibold rounded-full capitalize ${getStatusBadge(record.status)}`}>
                                                        {record.status?.replace('_', ' ')}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-center py-8 bg-gray-50 dark:bg-[#2C2C2E] rounded-lg">
                                <Calendar className="h-10 w-10 text-gray-300 dark:text-[#636366] mx-auto mb-2" />
                                <p className="text-sm text-gray-500 dark:text-[#8E8E93]">No attendance records found for this employee.</p>
                            </div>
                        )}
                    </div>
                )}

                {/* ── SALARY TAB ────────────────────────────────────────────── */}
                {activeTab === 'salary' && (
                    <div>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Salary History</h3>
                            <div className="flex items-center gap-2">
                                <label className="text-sm text-gray-500 dark:text-[#8E8E93]">Year:</label>
                                <select
                                    value={salaryYear}
                                    onChange={(e) => setSalaryYear(Number(e.target.value))}
                                    className="px-3 py-1.5 text-sm border border-gray-300 dark:border-[#38383A] rounded-lg bg-white dark:bg-[#2C2C2E] text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none"
                                >
                                    {[...Array(5)].map((_, i) => {
                                        const y = new Date().getFullYear() - i
                                        return <option key={y} value={y}>{y}</option>
                                    })}
                                </select>
                            </div>
                        </div>

                        {/* Current Salary Info */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                            <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl p-4 border border-green-100 dark:border-green-900/30">
                                <div className="flex items-center gap-2 mb-1">
                                    <IndianRupee className="h-4 w-4 text-green-600 dark:text-green-400" />
                                    <p className="text-xs text-green-600 dark:text-green-400 font-medium uppercase">Base Salary</p>
                                </div>
                                <p className="text-xl font-bold text-green-700 dark:text-green-300">
                                    {employee.salary ? `₹${employee.salary.toLocaleString()}` : 'N/A'}
                                </p>
                            </div>
                            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-4 border border-blue-100 dark:border-blue-900/30">
                                <div className="flex items-center gap-2 mb-1">
                                    <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                    <p className="text-xs text-blue-600 dark:text-blue-400 font-medium uppercase">Payslips in {salaryYear}</p>
                                </div>
                                <p className="text-xl font-bold text-blue-700 dark:text-blue-300">{payrollRecords.length}</p>
                            </div>
                            <div className="bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20 rounded-xl p-4 border border-purple-100 dark:border-purple-900/30">
                                <div className="flex items-center gap-2 mb-1">
                                    <IndianRupee className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                                    <p className="text-xs text-purple-600 dark:text-purple-400 font-medium uppercase">Total Paid ({salaryYear})</p>
                                </div>
                                <p className="text-xl font-bold text-purple-700 dark:text-purple-300">
                                    ₹{payrollRecords.reduce((sum, r) => sum + (r.netSalary || r.baseSalary || 0), 0).toLocaleString()}
                                </p>
                            </div>
                        </div>

                        {isLoadingPayroll ? (
                            <div className="flex justify-center py-8"><Loader className="h-6 w-6 animate-spin text-primary-500" /></div>
                        ) : payrollRecords.length > 0 ? (
                            <div className="space-y-3">
                                {payrollRecords.map((record) => (
                                    <div key={record._id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gray-50 dark:bg-[#2C2C2E] rounded-lg gap-3">
                                        <div className="flex-1">
                                            <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                                {monthNames[(record.month || 1) - 1]} {record.year}
                                            </p>
                                            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                                                <span className="text-xs text-gray-500 dark:text-[#8E8E93]">
                                                    Base: ₹{(record.baseSalary || 0).toLocaleString()}
                                                </span>
                                                {record.totalBonuses > 0 && (
                                                    <span className="text-xs text-green-600 dark:text-green-400">
                                                        + Bonus: ₹{record.totalBonuses.toLocaleString()}
                                                    </span>
                                                )}
                                                {record.totalDeductions > 0 && (
                                                    <span className="text-xs text-red-600 dark:text-red-400">
                                                        - Deductions: ₹{record.totalDeductions.toLocaleString()}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="text-right">
                                                <p className="text-sm font-bold text-gray-900 dark:text-white">
                                                    ₹{(record.netSalary || record.baseSalary || 0).toLocaleString()}
                                                </p>
                                                <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full capitalize ${getPaymentStatusBadge(record.paymentStatus)}`}>
                                                    {record.paymentStatus || 'pending'}
                                                </span>
                                            </div>
                                            <button
                                                onClick={() => handleDownloadSlip(record._id)}
                                                className="p-2 hover:bg-gray-200 dark:hover:bg-[#2C2C2E] rounded-lg transition-colors"
                                                title="Download Salary Slip"
                                            >
                                                <Download className="h-4 w-4 text-gray-500 dark:text-[#8E8E93]" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8 bg-gray-50 dark:bg-[#2C2C2E] rounded-lg">
                                <IndianRupee className="h-10 w-10 text-gray-300 dark:text-[#636366] mx-auto mb-2" />
                                <p className="text-sm text-gray-500 dark:text-[#8E8E93]">No salary records found for {salaryYear}.</p>
                            </div>
                        )}
                    </div>
                )}

                {/* ── TIMETABLE TAB ─────────────────────────────────────────── */}
                {activeTab === 'timetable' && (
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Teaching Schedule</h3>
                        {employee.role !== 'teacher' ? (
                            <div className="text-center py-8 bg-gray-50 dark:bg-[#2C2C2E] rounded-lg">
                                <Briefcase className="h-10 w-10 text-gray-300 dark:text-[#636366] mx-auto mb-2" />
                                <p className="text-sm text-gray-500 dark:text-[#8E8E93]">Timetable is only available for employees with the Teacher role.</p>
                            </div>
                        ) : isLoadingAssignments ? (
                            <div className="flex justify-center py-8"><Loader className="h-6 w-6 animate-spin text-primary-500" /></div>
                        ) : assignments.length > 0 ? (
                            <div className="space-y-4">
                                {/* Summary */}
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-2">
                                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
                                        <p className="text-xl font-bold text-blue-700 dark:text-blue-400">{assignments.length}</p>
                                        <p className="text-xs text-blue-600 dark:text-blue-500">Total Assignments</p>
                                    </div>
                                    <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 text-center">
                                        <p className="text-xl font-bold text-purple-700 dark:text-purple-400">
                                            {new Set(assignments.map(a => a.subject?.name || a.subjectId)).size}
                                        </p>
                                        <p className="text-xs text-purple-600 dark:text-purple-500">Subjects</p>
                                    </div>
                                    <div className="bg-teal-50 dark:bg-teal-900/20 rounded-lg p-3 text-center">
                                        <p className="text-xl font-bold text-teal-700 dark:text-teal-400">
                                            {new Set(assignments.map(a => a.class?.name || a.classId)).size}
                                        </p>
                                        <p className="text-xs text-teal-600 dark:text-teal-500">Classes</p>
                                    </div>
                                </div>

                                {/* Assignment List */}
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-gray-200 dark:border-[#38383A]">
                                                <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 dark:text-[#8E8E93] uppercase">Class</th>
                                                <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 dark:text-[#8E8E93] uppercase">Section</th>
                                                <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 dark:text-[#8E8E93] uppercase">Subject</th>
                                                <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 dark:text-[#8E8E93] uppercase">Type</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-[#38383A]">
                                            {assignments.map((assignment, idx) => (
                                                <tr key={assignment._id || idx} className="hover:bg-gray-50 dark:hover:bg-[#2C2C2E]">
                                                    <td className="py-3 px-3 font-medium text-gray-900 dark:text-white">
                                                        {assignment.class?.name || assignment.className || 'N/A'}
                                                    </td>
                                                    <td className="py-3 px-3 text-gray-600 dark:text-[#8E8E93]">
                                                        {assignment.section || 'All'}
                                                    </td>
                                                    <td className="py-3 px-3">
                                                        <div className="flex items-center gap-2">
                                                            <BookOpen className="h-3.5 w-3.5 text-primary-500" />
                                                            <span className="text-gray-900 dark:text-white">{assignment.subject?.name || assignment.subjectName || 'N/A'}</span>
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-3">
                                                        <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                                                            assignment.isClassTeacher
                                                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                                                : 'bg-gray-100 text-gray-600 dark:bg-[#2C2C2E] dark:text-[#8E8E93]'
                                                        }`}>
                                                            {assignment.isClassTeacher ? 'Class Teacher' : 'Subject Teacher'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-8 bg-gray-50 dark:bg-[#2C2C2E] rounded-lg">
                                <BookOpen className="h-10 w-10 text-gray-300 dark:text-[#636366] mx-auto mb-2" />
                                <p className="text-sm text-gray-500 dark:text-[#8E8E93]">No teaching assignments found for this teacher.</p>
                            </div>
                        )}
                    </div>
                )}

                {/* ── ACTIVITY LOG TAB ──────────────────────────────────────── */}
                {activeTab === 'activity' && (
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Activity Log</h3>
                        <div className="space-y-3">
                            {/* Account creation */}
                            <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-[#2C2C2E] rounded-lg">
                                <div className="p-1.5 bg-green-100 dark:bg-green-900/30 rounded-full mt-0.5">
                                    <User className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">Employee Created</p>
                                    <p className="text-xs text-gray-500 dark:text-[#8E8E93] mt-1">
                                        {new Date(employee.createdAt).toLocaleString()}
                                    </p>
                                </div>
                            </div>

                            {/* Login status */}
                            <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-[#2C2C2E] rounded-lg">
                                <div className={`p-1.5 rounded-full mt-0.5 ${employee.loginEnabled ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-gray-100 dark:bg-[#2C2C2E]'}`}>
                                    <Key className={`h-3.5 w-3.5 ${employee.loginEnabled ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-[#636366]'}`} />
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                                        Login {employee.loginEnabled ? 'Enabled' : 'Disabled'}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-[#8E8E93] mt-1">
                                        {employee.email ? `Login email: ${employee.email}` : 'No login email set'}
                                    </p>
                                </div>
                            </div>

                            {/* Status */}
                            <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-[#2C2C2E] rounded-lg">
                                <div className={`p-1.5 rounded-full mt-0.5 ${employee.isActive ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                                    {employee.isActive
                                        ? <CheckCircle className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                                        : <XCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                                    }
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                                        Status: {employee.isActive ? 'Active' : 'Inactive'}
                                    </p>
                                    {employee.deactivationReason && (
                                        <p className="text-xs text-gray-500 dark:text-[#8E8E93] mt-1">
                                            Reason: {employee.deactivationReason}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Joining date */}
                            {employee.dateOfJoining && (
                                <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-[#2C2C2E] rounded-lg">
                                    <div className="p-1.5 bg-purple-100 dark:bg-purple-900/30 rounded-full mt-0.5">
                                        <Briefcase className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-gray-900 dark:text-white">Joined Organization</p>
                                        <p className="text-xs text-gray-500 dark:text-[#8E8E93] mt-1">
                                            {new Date(employee.dateOfJoining).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                                            {' — '}
                                            {(() => {
                                                const diff = Math.floor((new Date() - new Date(employee.dateOfJoining)) / (1000 * 60 * 60 * 24))
                                                if (diff < 30) return `${diff} days ago`
                                                if (diff < 365) return `${Math.floor(diff / 30)} months ago`
                                                return `${Math.floor(diff / 365)} year(s) ${Math.floor((diff % 365) / 30)} month(s) ago`
                                            })()}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Last updated */}
                            {employee.updatedAt && employee.updatedAt !== employee.createdAt && (
                                <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-[#2C2C2E] rounded-lg">
                                    <div className="p-1.5 bg-orange-100 dark:bg-orange-900/30 rounded-full mt-0.5">
                                        <Edit className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-gray-900 dark:text-white">Profile Last Updated</p>
                                        <p className="text-xs text-gray-500 dark:text-[#8E8E93] mt-1">
                                            {new Date(employee.updatedAt).toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Edit Form Modal */}
            {showEditForm && (
                <EmployeeForm
                    employee={employee}
                    onSave={handleSaveEmployee}
                    onCancel={() => setShowEditForm(false)}
                    isLoading={isSaving}
                />
            )}
        </div>
    )
}

export default EmployeeDetail
