import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Edit, Power, PowerOff, Key, Download, Loader, UserCheck, UserX } from 'lucide-react'
import { employeesService } from '../services/employeesService'
import { useAuth } from '../contexts/AuthContext'
import EmployeeForm from '../components/employees/EmployeeForm'
import toast from 'react-hot-toast'

const EmployeeDetail = () => {
    const { id } = useParams()
    const navigate = useNavigate()
    const { user } = useAuth()

    const [employee, setEmployee] = useState(null)
    const [isLoading, setIsLoading] = useState(true)
    const [activeTab, setActiveTab] = useState('profile')
    const [showEditForm, setShowEditForm] = useState(false)
    const [isSaving, setIsSaving] = useState(false)

    useEffect(() => {
        fetchEmployee()
    }, [id])

    const fetchEmployee = async () => {
        try {
            setIsLoading(true)
            const response = await employeesService.get(id)
            setEmployee(response.data)
        } catch (error) {
            console.error('Error fetching employee:', error)
            toast.error('Failed to load employee details')
            navigate('/app/employees')
        } finally {
            setIsLoading(false)
        }
    }

    const handleToggleStatus = async () => {
        const action = employee.isActive ? 'deactivate' : 'activate'
        const reason = employee.isActive ? prompt('Reason for deactivation:') : null

        if (employee.isActive && !reason) return

        try {
            await employeesService.toggleStatus(id, { reason })
            toast.success(`Employee ${action}d successfully`)
            fetchEmployee()
        } catch (error) {
            console.error('Toggle status error:', error)
            toast.error(`Failed to ${action} employee`)
        }
    }

    const handleResetPassword = async () => {
        const newPassword = prompt('Enter new password (leave empty for default "employee123"):')
        if (newPassword === null) return

        try {
            const response = await employeesService.resetPassword(id, {
                newPassword: newPassword || 'employee123',
                forceChange: true
            })
            toast.success('Password reset successfully')
            if (response.data) {
                toast.success(`New password: ${response.data.newPassword}`, { duration: 10000 })
            }
        } catch (error) {
            console.error('Reset password error:', error)
            toast.error('Failed to reset password')
        }
    }

    const handleToggleLogin = async () => {
        try {
            if (employee.loginEnabled) {
                await employeesService.disableLogin(id)
                toast.success('Login disabled successfully')
            } else {
                const email = prompt('Enter email for login (optional):')
                await employeesService.createLogin(id, { email })
                toast.success('Login enabled successfully')
            }
            fetchEmployee()
        } catch (error) {
            console.error('Toggle login error:', error)
            toast.error('Failed to toggle login')
        }
    }

    const handleSaveEmployee = async (formData) => {
        try {
            setIsSaving(true)
            await employeesService.update(id, formData)
            toast.success('Employee updated successfully')
            setShowEditForm(false)
            fetchEmployee()
        } catch (error) {
            console.error('Update employee error:', error)
            toast.error(error.response?.data?.message || 'Failed to update employee')
        } finally {
            setIsSaving(false)
        }
    }

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
                <p className="text-gray-500">Employee not found</p>
            </div>
        )
    }

    const getRoleBadgeColor = (role) => {
        const colors = {
            admin: 'bg-purple-100 text-purple-800',
            teacher: 'bg-blue-100 text-blue-800',
            accountant: 'bg-green-100 text-green-800',
            staff: 'bg-gray-100 text-gray-800'
        }
        return colors[role] || 'bg-gray-100 text-gray-800'
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/app/employees')} className="p-2 hover:bg-gray-100 rounded-md">
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Employee Details</h1>
                        <p className="text-sm text-gray-500 mt-1">
                            Employee ID: {employee.employeeId}
                        </p>
                    </div>
                </div>

                {user?.role === 'admin' && (
                    <div className="flex gap-2">
                        <button onClick={handleResetPassword} className="btn btn-outline" title="Reset Password">
                            <Key className="h-4 w-4 mr-2" />
                            Reset Password
                        </button>
                        <button
                            onClick={handleToggleLogin}
                            className={`btn ${employee.loginEnabled ? 'btn-outline' : 'btn-primary'}`}
                        >
                            {employee.loginEnabled ? (
                                <>
                                    <UserX className="h-4 w-4 mr-2" />
                                    Disable Login
                                </>
                            ) : (
                                <>
                                    <UserCheck className="h-4 w-4 mr-2" />
                                    Enable Login
                                </>
                            )}
                        </button>
                        <button
                            onClick={handleToggleStatus}
                            className={`btn ${employee.isActive ? 'btn-outline' : 'btn-primary'}`}
                        >
                            {employee.isActive ? (
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
                        <button onClick={() => setShowEditForm(true)} className="btn btn-primary">
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                        </button>
                    </div>
                )}
            </div>

            {/* Employee Card */}
            <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-start gap-6">
                    {/* Photo */}
                    <div className="flex-shrink-0">
                        {employee.photo ? (
                            <img
                                src={employee.photo}
                                alt={employee.name}
                                className="h-32 w-32 rounded-full object-cover border-4 border-gray-200"
                            />
                        ) : (
                            <div className="h-32 w-32 rounded-full bg-gray-200 flex items-center justify-center border-4 border-gray-200">
                                <span className="text-4xl font-medium text-gray-700">
                                    {employee.name?.charAt(0).toUpperCase()}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Basic Info */}
                    <div className="flex-1">
                        <div className="flex items-start justify-between">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900">{employee.name?.toUpperCase()}</h2>
                                <p className="text-sm text-gray-500 mt-1">
                                    {employee.designation || employee.role} • {employee.department || 'No Department'}
                                </p>
                            </div>
                            <div className="flex flex-col items-end gap-2">
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

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
                            <div>
                                <p className="text-xs text-gray-500 uppercase">Email</p>
                                <p className="text-sm font-medium text-gray-900 mt-1">{employee.email || 'N/A'}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 uppercase">Phone</p>
                                <p className="text-sm font-medium text-gray-900 mt-1">{employee.phone || 'N/A'}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 uppercase">Joining Date</p>
                                <p className="text-sm font-medium text-gray-900 mt-1">
                                    {employee.dateOfJoining ? new Date(employee.dateOfJoining).toLocaleDateString() : 'N/A'}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 uppercase">Login Status</p>
                                <p className="text-sm font-medium text-gray-900 mt-1">
                                    {employee.loginEnabled ? '✓ Enabled' : '✗ Disabled'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === tab.id
                                ? 'border-primary-500 text-primary-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Tab Content */}
            <div className="bg-white rounded-lg shadow-sm p-6">
                {activeTab === 'profile' && (
                    <div className="space-y-6">
                        {/* Professional Details */}
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Professional Details</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <p className="text-xs text-gray-500 uppercase">Employee ID</p>
                                    <p className="text-sm font-medium text-gray-900 mt-1">{employee.employeeId || 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 uppercase">Designation</p>
                                    <p className="text-sm font-medium text-gray-900 mt-1">{employee.designation || 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 uppercase">Department</p>
                                    <p className="text-sm font-medium text-gray-900 mt-1">{employee.department || 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 uppercase">Monthly Salary</p>
                                    <p className="text-sm font-medium text-gray-900 mt-1">
                                        {employee.salary ? `₹${employee.salary.toLocaleString()}` : 'N/A'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 uppercase">Education</p>
                                    <p className="text-sm font-medium text-gray-900 mt-1">{employee.education || 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 uppercase">Experience</p>
                                    <p className="text-sm font-medium text-gray-900 mt-1">
                                        {employee.experience ? `${employee.experience} years` : 'N/A'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Personal Details */}
                        <div className="border-t border-gray-100 pt-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Personal Details</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <p className="text-xs text-gray-500 uppercase">Father/Husband Name</p>
                                    <p className="text-sm font-medium text-gray-900 mt-1">{employee.fatherOrHusbandName || 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 uppercase">Gender</p>
                                    <p className="text-sm font-medium text-gray-900 mt-1">
                                        {employee.gender ? employee.gender.charAt(0).toUpperCase() + employee.gender.slice(1) : 'N/A'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 uppercase">Date of Birth</p>
                                    <p className="text-sm font-medium text-gray-900 mt-1">
                                        {employee.dateOfBirth ? new Date(employee.dateOfBirth).toLocaleDateString() : 'N/A'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 uppercase">Religion</p>
                                    <p className="text-sm font-medium text-gray-900 mt-1">{employee.religion || 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 uppercase">Blood Group</p>
                                    <p className="text-sm font-medium text-gray-900 mt-1">{employee.bloodGroup || 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 uppercase">National ID</p>
                                    <p className="text-sm font-medium text-gray-900 mt-1">{employee.nationalId || 'N/A'}</p>
                                </div>
                            </div>
                        </div>

                        {/* Address */}
                        {employee.homeAddress && (
                            <div className="border-t border-gray-100 pt-6">
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">Address</h3>
                                <p className="text-sm text-gray-700">{employee.homeAddress}</p>
                            </div>
                        )}

                        {/* Bank Details — admin only */}
                        {user?.role === 'admin' && (
                            <div className="border-t border-gray-100 pt-6">
                                <h3 className="text-lg font-semibold text-gray-900 mb-4">Bank Details</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase">Bank Name</p>
                                        <p className="text-sm font-medium text-gray-900 mt-1">{employee.bankName || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase">Account Number</p>
                                        <p className="text-sm font-medium text-gray-900 mt-1">{employee.accountNumber || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase">IFSC Code</p>
                                        <p className="text-sm font-medium text-gray-900 mt-1">{employee.ifscCode || 'N/A'}</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'attendance' && (
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Attendance Summary</h3>
                        <p className="text-sm text-gray-500">Attendance tracking coming soon...</p>
                    </div>
                )}

                {activeTab === 'salary' && (
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Salary History</h3>
                        <p className="text-sm text-gray-500">Salary records coming soon...</p>
                    </div>
                )}

                {activeTab === 'timetable' && (
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Teaching Schedule</h3>
                        <p className="text-sm text-gray-500">
                            {employee.role === 'teacher' ? 'Timetable coming soon...' : 'Not applicable for this role'}
                        </p>
                    </div>
                )}

                {activeTab === 'activity' && (
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Activity Log</h3>
                        <div className="space-y-3">
                            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-gray-900">Employee Created</p>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {new Date(employee.createdAt).toLocaleString()}
                                    </p>
                                </div>
                            </div>
                            {employee.updatedAt && employee.updatedAt !== employee.createdAt && (
                                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-gray-900">Last Updated</p>
                                        <p className="text-xs text-gray-500 mt-1">
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
