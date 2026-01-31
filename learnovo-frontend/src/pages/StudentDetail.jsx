import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Edit, Power, PowerOff, Key, Download, Printer, Loader } from 'lucide-react'
import { studentsService } from '../services/studentsService'
import { useAuth } from '../contexts/AuthContext'
import StudentForm from '../components/students/StudentForm'
import toast from 'react-hot-toast'

const StudentDetail = () => {
    const { id } = useParams()
    const navigate = useNavigate()
    const { user } = useAuth()

    const [student, setStudent] = useState(null)
    const [isLoading, setIsLoading] = useState(true)
    const [activeTab, setActiveTab] = useState('profile')
    const [showEditForm, setShowEditForm] = useState(false)
    const [isSaving, setIsSaving] = useState(false)

    useEffect(() => {
        fetchStudent()
    }, [id])

    const fetchStudent = async () => {
        try {
            setIsLoading(true)
            const response = await studentsService.get(id)
            setStudent(response.data)
        } catch (error) {
            console.error('Error fetching student:', error)
            toast.error('Failed to load student details')
            navigate('/app/students')
        } finally {
            setIsLoading(false)
        }
    }

    const handleToggleStatus = async () => {
        const action = student.isActive ? 'deactivate' : 'activate'
        const reason = student.isActive ? prompt('Reason for deactivation:') : null

        if (student.isActive && !reason) return

        try {
            await studentsService.toggleStatus(id, { reason })
            toast.success(`Student ${action}d successfully`)
            fetchStudent()
        } catch (error) {
            console.error('Toggle status error:', error)
            toast.error(`Failed to ${action} student`)
        }
    }

    const handleResetPassword = async () => {
        const newPassword = prompt('Enter new password (leave empty for default "student123"):')
        if (newPassword === null) return

        try {
            const response = await studentsService.resetPassword(id, {
                newPassword: newPassword || 'student123',
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

    const handleSaveStudent = async (formData) => {
        try {
            setIsSaving(true)
            console.log('Sending student update:', formData) // Debug log
            await studentsService.update(id, formData)
            toast.success('Student updated successfully')
            setShowEditForm(false)
            fetchStudent()
        } catch (error) {
            console.error('Update student error:', error)
            console.error('Error response:', error.response?.data) // Debug log

            // Handle validation errors array
            if (error.response?.data?.errors && Array.isArray(error.response.data.errors)) {
                console.error('Validation errors:', error.response.data.errors) // Debug log
                const errorMessages = error.response.data.errors.map(err => err.msg || err.message).join(', ')
                toast.error(errorMessages)
            } else {
                const errorMessage = error.response?.data?.message || error.response?.data?.error || 'Failed to update student'
                toast.error(errorMessage)
            }
        } finally {
            setIsSaving(false)
        }
    }

    const tabs = [
        { id: 'profile', label: 'Profile' },
        { id: 'fees', label: 'Fees' },
        { id: 'attendance', label: 'Attendance' },
        { id: 'exams', label: 'Exams' },
        { id: 'activity', label: 'Activity Log' }
    ]

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
                <p className="text-gray-500">Student not found</p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/app/students')}
                        className="p-2 hover:bg-gray-100 rounded-md"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Student Details</h1>
                        <p className="text-sm text-gray-500 mt-1">
                            Admission No: {student.admissionNumber}
                        </p>
                    </div>
                </div>

                {user?.role === 'admin' && (
                    <div className="flex gap-2">
                        <button
                            onClick={handleResetPassword}
                            className="btn btn-outline"
                            title="Reset Password"
                        >
                            <Key className="h-4 w-4 mr-2" />
                            Reset Password
                        </button>
                        <button
                            onClick={handleToggleStatus}
                            className={`btn ${student.isActive ? 'btn-outline' : 'btn-primary'}`}
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
                            className="btn btn-primary"
                        >
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                        </button>
                    </div>
                )}
            </div>

            {/* Student Card */}
            <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-start gap-6">
                    {/* Photo */}
                    <div className="flex-shrink-0">
                        {student.photo ? (
                            <img
                                src={student.photo}
                                alt={student.name}
                                className="h-32 w-32 rounded-full object-cover border-4 border-gray-200"
                            />
                        ) : (
                            <div className="h-32 w-32 rounded-full bg-gray-200 flex items-center justify-center border-4 border-gray-200">
                                <span className="text-4xl font-medium text-gray-700">
                                    {student.name?.charAt(0)}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Basic Info */}
                    <div className="flex-1">
                        <div className="flex items-start justify-between">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900">{student.name}</h2>
                                <p className="text-sm text-gray-500 mt-1">
                                    {student.class} {student.section && `- Section ${student.section}`} • Roll No: {student.rollNumber || 'N/A'}
                                </p>
                            </div>
                            <span
                                className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${student.isActive
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-red-100 text-red-800'
                                    }`}
                            >
                                {student.isActive ? 'Active' : 'Inactive'}
                            </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                            <div>
                                <p className="text-xs text-gray-500 uppercase">Email</p>
                                <p className="text-sm font-medium text-gray-900 mt-1">{student.email}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 uppercase">Phone</p>
                                <p className="text-sm font-medium text-gray-900 mt-1">{student.phone || 'N/A'}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 uppercase">Academic Year</p>
                                <p className="text-sm font-medium text-gray-900 mt-1">{student.academicYear}</p>
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
                        {/* Personal Details */}
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Personal Details</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <p className="text-xs text-gray-500 uppercase">Date of Birth</p>
                                    <p className="text-sm font-medium text-gray-900 mt-1">
                                        {student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString() : 'N/A'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 uppercase">Blood Group</p>
                                    <p className="text-sm font-medium text-gray-900 mt-1">{student.bloodGroup || 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 uppercase">Religion</p>
                                    <p className="text-sm font-medium text-gray-900 mt-1">{student.religion || 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 uppercase">Category</p>
                                    <p className="text-sm font-medium text-gray-900 mt-1">{student.category || 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 uppercase">Identification Mark</p>
                                    <p className="text-sm font-medium text-gray-900 mt-1">{student.identificationMark || 'N/A'}</p>
                                </div>
                            </div>
                        </div>

                        {/* Guardian Information */}
                        <div className="border-t border-gray-100 pt-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Guardian Information</h3>
                            {student.guardians && student.guardians.length > 0 ? (
                                <div className="space-y-4">
                                    {student.guardians.map((guardian, index) => (
                                        <div key={index} className="bg-gray-50 rounded-lg p-4">
                                            <p className="text-sm font-semibold text-gray-900 mb-2">
                                                {guardian.relation} {guardian.isPrimary && '(Primary)'}
                                            </p>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <div>
                                                    <p className="text-xs text-gray-500 uppercase">Name</p>
                                                    <p className="text-sm font-medium text-gray-900 mt-1">{guardian.name}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-500 uppercase">Phone</p>
                                                    <p className="text-sm font-medium text-gray-900 mt-1">{guardian.phone || 'N/A'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-500 uppercase">Email</p>
                                                    <p className="text-sm font-medium text-gray-900 mt-1">{guardian.email || 'N/A'}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-gray-500">No guardian information available</p>
                            )}
                        </div>

                        {/* Address */}
                        {student.address && (
                            <div className="border-t border-gray-100 pt-6">
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">Address</h3>
                                <p className="text-sm text-gray-700">{student.address}</p>
                            </div>
                        )}

                        {/* Academic Background */}
                        {(student.previousSchool || student.previousBoard) && (
                            <div className="border-t border-gray-100 pt-6">
                                <h3 className="text-lg font-semibold text-gray-900 mb-4">Academic Background</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase">Previous School</p>
                                        <p className="text-sm font-medium text-gray-900 mt-1">{student.previousSchool || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase">Previous Board</p>
                                        <p className="text-sm font-medium text-gray-900 mt-1">{student.previousBoard || 'N/A'}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Medical Information */}
                        {(student.medicalConditions || student.allergies) && (
                            <div className="border-t border-gray-100 pt-6">
                                <h3 className="text-lg font-semibold text-gray-900 mb-4">Medical Information</h3>
                                <div className="space-y-3">
                                    {student.medicalConditions && (
                                        <div>
                                            <p className="text-xs text-gray-500 uppercase">Medical Conditions</p>
                                            <p className="text-sm text-gray-700 mt-1">{student.medicalConditions}</p>
                                        </div>
                                    )}
                                    {student.allergies && (
                                        <div>
                                            <p className="text-xs text-gray-500 uppercase">Allergies</p>
                                            <p className="text-sm text-gray-700 mt-1">{student.allergies}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'fees' && (
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Fee Details</h3>
                        {student.fees && student.fees.length > 0 ? (
                            <div className="space-y-3">
                                {student.fees.map((fee, index) => (
                                    <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                                        <div>
                                            <p className="text-sm font-medium text-gray-900">{fee.title}</p>
                                            <p className="text-xs text-gray-500 mt-1">
                                                Due: {new Date(fee.dueDate).toLocaleDateString()}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-semibold text-gray-900">{fee.formattedAmount}</p>
                                            <span
                                                className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full mt-1 ${fee.status === 'paid'
                                                    ? 'bg-green-100 text-green-800'
                                                    : fee.status === 'overdue'
                                                        ? 'bg-red-100 text-red-800'
                                                        : 'bg-yellow-100 text-yellow-800'
                                                    }`}
                                            >
                                                {fee.status}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500">No fee records found</p>
                        )}
                    </div>
                )}

                {activeTab === 'attendance' && (
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Attendance Summary</h3>
                        <p className="text-sm text-gray-500">Attendance tracking coming soon...</p>
                    </div>
                )}

                {activeTab === 'exams' && (
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Exam Results</h3>
                        <p className="text-sm text-gray-500">Exam results coming soon...</p>
                    </div>
                )}

                {activeTab === 'activity' && (
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Activity Log</h3>
                        <div className="space-y-3">
                            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-gray-900">Student Created</p>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {new Date(student.createdAt).toLocaleString()}
                                    </p>
                                </div>
                            </div>
                            {student.updatedAt && student.updatedAt !== student.createdAt && (
                                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-gray-900">Last Updated</p>
                                        <p className="text-xs text-gray-500 mt-1">
                                            {new Date(student.updatedAt).toLocaleString()}
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
                <StudentForm
                    student={student}
                    onSave={handleSaveStudent}
                    onCancel={() => setShowEditForm(false)}
                    isLoading={isSaving}
                />
            )}
        </div>
    )
}

export default StudentDetail
