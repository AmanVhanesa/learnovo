import React, { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Eye, Power, PowerOff, Edit, Key, Users, AlertTriangle, RefreshCw } from 'lucide-react'
import { employeesService } from '../services/employeesService'
import { formatDate } from '../utils/formatDate'
import ExportColumnPicker from '../components/ExportColumnPicker'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import EmployeeForm from '../components/employees/EmployeeForm'
import toast from 'react-hot-toast'
import { SERVER_URL } from '../constants/config'

const EmployeePhotoCell = ({ employee }) => {
    const [imgFailed, setImgFailed] = React.useState(false)
    const photoUrl = employee.photo
        ? (employee.photo.startsWith('http') ? employee.photo : `${SERVER_URL}${employee.photo}`)
        : null

    if (photoUrl && !imgFailed) {
        return (
            <img
                src={photoUrl}
                alt={employee.name}
                className="h-10 w-10 rounded-full object-cover"
                onError={() => setImgFailed(true)}
            />
        )
    }

    return (
        <div className="h-10 w-10 bg-gradient-to-br from-teal-400 to-teal-700 rounded-full flex items-center justify-center">
            <span className="text-sm font-semibold text-white">
                {employee.name?.charAt(0).toUpperCase() || 'E'}
            </span>
        </div>
    )
}

const Employees = () => {
    const { user } = useAuth()
    const navigate = useNavigate()
    const queryClient = useQueryClient()

    // Filter state
    const [searchQuery, setSearchQuery] = useState('')
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')
    const [roleFilter, setRoleFilter] = useState('')
    const [departmentFilter, setDepartmentFilter] = useState('')
    const [statusFilter, setStatusFilter] = useState('')

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1)
    const [perPage, setPerPage] = useState(50)

    // UI state
    const [showAddModal, setShowAddModal] = useState(false)
    const [editingEmployee, setEditingEmployee] = useState(null)

    // Debounce search query
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchQuery(searchQuery)
        }, 500)

        return () => clearTimeout(timer)
    }, [searchQuery])

    // Reset page on filter change
    useEffect(() => {
        setCurrentPage(1)
    }, [debouncedSearchQuery, roleFilter, departmentFilter, statusFilter])

    // Fetch filter options
    const { data: filterOptions = { roles: [], departments: [] } } = useQuery({
        queryKey: ['employees-filters'],
        queryFn: async () => {
            const response = await employeesService.getFilters()
            return response.success ? response.data : { roles: [], departments: [] }
        },
    })

    // Fetch employees
    const { data: employeesResponse, isLoading, error: employeesError, refetch: refetchEmployees } = useQuery({
        queryKey: ['employees', debouncedSearchQuery, roleFilter, departmentFilter, statusFilter, currentPage, perPage],
        queryFn: async () => {
            const filters = {
                search: debouncedSearchQuery,
                role: roleFilter,
                department: departmentFilter,
                status: statusFilter,
                page: currentPage,
                limit: perPage
            }
            return await employeesService.list(filters)
        },
        placeholderData: (prev) => prev,
    })

    const employees = useMemo(() => {
        const data = employeesResponse?.data || []
        return Array.isArray(data) ? data : []
    }, [employeesResponse])

    const totalEmployees = employeesResponse?.pagination?.total || employees.length
    const totalPages = employeesResponse?.pagination?.pages || 1

    // Save employee mutation
    const saveEmployeeMutation = useMutation({
        mutationFn: async ({ formData, pendingPhotoFile }) => {
            if (editingEmployee) {
                await employeesService.update(editingEmployee._id, formData)
                return { type: 'update' }
            } else {
                const response = await employeesService.create(formData)
                if (pendingPhotoFile && response?.data?.id) {
                    try {
                        await employeesService.uploadPhoto(response.data.id, pendingPhotoFile)
                    } catch (photoErr) {
                        toast.error('Employee saved but photo upload failed. You can re-upload by editing the employee.')
                    }
                }
                return { type: 'create', response }
            }
        },
        onSuccess: (result) => {
            if (result.type === 'update') {
                toast.success('Employee updated successfully')
            } else {
                toast.success('Employee added successfully')
                if (result.response?.data?.credentials) {
                    toast.success(`Login: ${result.response.data.credentials.email || result.response.data.credentials.phone} / ${result.response.data.credentials.password}`, {
                        duration: 10000
                    })
                }
            }
            setShowAddModal(false)
            queryClient.invalidateQueries({ queryKey: ['employees'] })
        },
        onError: (error) => {
            toast.error(error.response?.data?.message || 'Failed to save employee')
        },
    })

    // Toggle status mutation
    const toggleStatusMutation = useMutation({
        mutationFn: async ({ employeeId, reason }) => {
            await employeesService.toggleStatus(employeeId, { reason })
        },
        onSuccess: (_, variables) => {
            toast.success(`Employee ${variables.action}d successfully`)
            queryClient.invalidateQueries({ queryKey: ['employees'] })
        },
        onError: (error, variables) => {
            toast.error(`Failed to ${variables.action} employee`)
        },
    })

    // Reset password mutation
    const resetPasswordMutation = useMutation({
        mutationFn: async ({ employeeId, newPassword }) => {
            return await employeesService.resetPassword(employeeId, {
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
            toast.error('Failed to reset password')
        },
    })

    const handleViewEmployee = (employee) => {
        navigate(`/app/employees/${employee._id}`)
    }

    const handleToggleStatus = (employee) => {
        const action = employee.isActive ? 'deactivate' : 'activate'
        const reason = employee.isActive ? prompt('Reason for deactivation:') : null

        if (employee.isActive && !reason) return

        toggleStatusMutation.mutate({ employeeId: employee._id, reason, action })
    }

    const handleResetPassword = (employee) => {
        const newPassword = prompt('Enter new password (leave empty for default "employee123"):')
        if (newPassword === null) return

        resetPasswordMutation.mutate({ employeeId: employee._id, newPassword })
    }

    const employeeExportColumns = useMemo(() => [
        { key: 'employeeId', label: 'Employee ID', group: 'Basic', getValue: e => e.employeeId || 'N/A' },
        { key: 'name', label: 'Name', group: 'Basic', getValue: e => e.name || '' },
        { key: 'role', label: 'Role', group: 'Basic', getValue: e => e.role || '' },
        { key: 'designation', label: 'Designation', group: 'Basic', getValue: e => e.designation || '' },
        { key: 'department', label: 'Department', group: 'Basic', getValue: e => e.department || '' },
        { key: 'isActive', label: 'Status', group: 'Basic', getValue: e => (e.isActive ? 'Active' : 'Inactive') },
        { key: 'phone', label: 'Phone', group: 'Contact', getValue: e => e.phone || '' },
        { key: 'email', label: 'Email', group: 'Contact', getValue: e => e.email || '' },
        { key: 'address', label: 'Address', group: 'Contact', getValue: e => e.address || '' },
        { key: 'dateOfJoining', label: 'Joining Date', group: 'Employment', getValue: e => e.dateOfJoining ? formatDate(e.dateOfJoining) : '' },
        { key: 'dateOfBirth', label: 'Date of Birth', group: 'Employment', getValue: e => e.dateOfBirth ? formatDate(e.dateOfBirth) : '' },
        { key: 'gender', label: 'Gender', group: 'Employment', getValue: e => e.gender || '' },
        { key: 'salary', label: 'Salary', group: 'Employment', getValue: e => e.salary || '' },
        { key: 'qualification', label: 'Qualification', group: 'Employment', getValue: e => e.qualification || '' },
    ], [])

    const employeeExportPresets = {
        basic: { label: 'Basic Details', fields: ['employeeId', 'name', 'role', 'department', 'isActive'] },
        contact: { label: 'Contact Info', fields: ['employeeId', 'name', 'phone', 'email', 'address'] },
        full: { label: 'Full Record', fields: ['employeeId', 'name', 'role', 'designation', 'department', 'phone', 'email', 'address', 'dateOfJoining', 'dateOfBirth', 'gender', 'salary', 'qualification', 'isActive'] },
    }

    const clearFilters = () => {
        setSearchQuery('')
        setRoleFilter('')
        setDepartmentFilter('')
        setStatusFilter('')
    }

    const handleSaveEmployee = (formData, pendingPhotoFile) => {
        saveEmployeeMutation.mutate({ formData, pendingPhotoFile })
    }

    const isSaving = saveEmployeeMutation.isPending

    const getRoleBadgeColor = (role) => {
        const colors = {
            admin: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
            teacher: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
            accountant: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
            librarian: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
            driver: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
            support_staff: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
            principal: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
            vice_principal: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
            staff: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
        }
        return colors[role] || 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
    }

    const formatRoleName = (role) => {
        const names = {
            admin: 'Admin', teacher: 'Teacher', accountant: 'Accountant',
            librarian: 'Librarian', driver: 'Driver', support_staff: 'Support Staff',
            principal: 'Principal', vice_principal: 'Vice Principal', staff: 'Staff'
        }
        return names[role] || role?.charAt(0).toUpperCase() + role?.slice(1)
    }

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
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Employees</h1>
                    <p className="text-sm text-gray-500 dark:text-[#8E8E93] mt-1">
                        {totalEmployees} employee{totalEmployees !== 1 ? 's' : ''} found
                    </p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    {user?.role === 'admin' && (
                        <button
                            className="btn btn-primary w-full sm:w-auto"
                            onClick={() => {
                                setEditingEmployee(null)
                                setShowAddModal(true)
                            }}
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Add Employee
                        </button>
                    )}
                </div>
            </div>

            {/* Error Message */}
            {employeesError && (
                <div className="bg-red-50 dark:bg-red-500/10 border border-red-200/60 dark:border-red-500/20 rounded-2xl p-4 animate-fade-in">
                    <div className="flex items-center">
                        <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mr-2 flex-shrink-0" />
                        <p className="text-sm text-red-700 dark:text-red-400">{employeesError.response?.data?.message || 'Failed to load employees. Please try again.'}</p>
                    </div>
                    <button onClick={() => refetchEmployees()} className="mt-2 inline-flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 underline">
                        <RefreshCw className="h-3.5 w-3.5" />
                        Try again
                    </button>
                </div>
            )}

            {/* Filters */}
            <div className="card p-3 sm:p-4">
                <div className="flex flex-col lg:flex-row lg:items-center gap-3 sm:gap-4">
                    {/* Search */}
                    <div className="flex-1">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-[#636366]" />
                            <input
                                type="text"
                                placeholder="Search by name, phone, email, employee ID..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="input pl-10"
                            />
                        </div>
                    </div>

                    {/* Filter Dropdowns */}
                    <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:gap-3">
                        <select
                            value={roleFilter}
                            onChange={(e) => setRoleFilter(e.target.value)}
                            className="input w-full sm:w-40"
                        >
                            <option value="">All Roles</option>
                            {filterOptions.roles.map(role => (
                                <option key={role} value={role}>
                                    {role.charAt(0).toUpperCase() + role.slice(1)}
                                </option>
                            ))}
                        </select>

                        <select
                            value={departmentFilter}
                            onChange={(e) => setDepartmentFilter(e.target.value)}
                            className="input w-full sm:w-40"
                        >
                            <option value="">All Departments</option>
                            {filterOptions.departments.map(dept => (
                                <option key={dept} value={dept}>{dept}</option>
                            ))}
                        </select>

                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="input w-full sm:w-32"
                        >
                            <option value="">All Status</option>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                        </select>

                        {(searchQuery || roleFilter || departmentFilter || statusFilter) && (
                            <button onClick={clearFilters} className="btn btn-ghost text-sm w-full sm:w-auto">
                                Clear
                            </button>
                        )}

                        <ExportColumnPicker
                            data={employees}
                            columns={employeeExportColumns}
                            presets={employeeExportPresets}
                            filename="employees"
                            title="Export Employees"
                            sheetName="Employees"
                            buttonClassName="btn btn-outline w-full sm:w-auto col-span-2 sm:col-span-1"
                        />
                    </div>
                </div>
            </div>

            {/* Employees Table */}
            <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="table min-w-[600px]">
                        <thead>
                            <tr>
                                <th>Employee ID</th>
                                <th>Photo</th>
                                <th>Name</th>
                                <th>Role</th>
                                <th>Phone</th>
                                <th>Department</th>
                                <th>Joining Date</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {employees.length === 0 ? (
                                <tr>
                                    <td colSpan="9" className="text-center py-12">
                                        <div className="flex flex-col items-center">
                                            <div className="w-12 h-12 bg-gray-50 dark:bg-[#2C2C2E] rounded-full flex items-center justify-center mb-3">
                                                <Users className="w-6 h-6 text-gray-400 dark:text-[#636366]" />
                                            </div>
                                            <p className="text-sm font-medium text-gray-900 dark:text-white">No employees found</p>
                                            <p className="text-xs text-gray-500 dark:text-[#8E8E93] mt-1">Try adjusting your filters or add a new employee.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                employees.map((employee) => (
                                    <tr key={employee._id}>
                                        <td>
                                            <span className="font-mono text-sm font-semibold text-teal-600">
                                                {employee.employeeId || 'N/A'}
                                            </span>
                                        </td>
                                        <td>
                                            <EmployeePhotoCell employee={employee} />
                                        </td>
                                        <td>
                                            <div>
                                                <div className="text-sm font-medium text-gray-900 dark:text-white">{employee.name?.toUpperCase()}</div>
                                                <div className="text-sm text-gray-500 dark:text-[#8E8E93]">{employee.email || employee.phone}</div>
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleBadgeColor(employee.role)}`}>
                                                {formatRoleName(employee.role)}
                                            </span>
                                        </td>
                                        <td className="text-sm text-gray-900 dark:text-white">{employee.phone || '-'}</td>
                                        <td className="text-sm text-gray-900 dark:text-white">{employee.department || '-'}</td>
                                        <td className="text-sm text-gray-900 dark:text-white">
                                            {employee.dateOfJoining ? formatDate(employee.dateOfJoining) : '-'}
                                        </td>
                                        <td>
                                            <span
                                                className={`status-badge ${employee.isActive
                                                    ? 'status-active'
                                                    : 'status-inactive'
                                                    }`}
                                            >
                                                {employee.isActive ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="flex space-x-2">
                                                <button
                                                    onClick={() => handleViewEmployee(employee)}
                                                    className="btn-icon hover:text-blue-600"
                                                    title="View Details"
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </button>
                                                {user?.role === 'admin' && (
                                                    <>
                                                        <button
                                                            onClick={() => {
                                                                setEditingEmployee(employee)
                                                                setShowAddModal(true)
                                                            }}
                                                            className="btn-icon hover:text-primary-600"
                                                            title="Edit Employee"
                                                        >
                                                            <Edit className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleResetPassword(employee)}
                                                            className="btn-icon hover:text-yellow-600"
                                                            title="Reset Password"
                                                        >
                                                            <Key className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleToggleStatus(employee)}
                                                            className={`btn-icon ${employee.isActive ? 'hover:text-red-600' : 'hover:text-green-600'}`}
                                                            title={employee.isActive ? 'Deactivate' : 'Activate'}
                                                        >
                                                            {employee.isActive ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-1">
                    <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 dark:text-[#8E8E93]">
                        <span>
                            Showing {((currentPage - 1) * perPage) + 1}–{Math.min(currentPage * perPage, totalEmployees)} of <strong>{totalEmployees}</strong> employees
                        </span>
                        <select
                            value={perPage}
                            onChange={(e) => { setPerPage(Number(e.target.value)); setCurrentPage(1) }}
                            className="border border-gray-300 dark:border-[#38383A] rounded px-2 py-1 text-sm dark:bg-[#1C1C1E] dark:text-white"
                        >
                            <option value={50}>50 / page</option>
                            <option value={100}>100 / page</option>
                        </select>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="btn btn-sm btn-ghost"
                        >
                            ← Previous
                        </button>
                        <span className="text-sm text-gray-600 dark:text-[#8E8E93]">
                            Page {currentPage} of {totalPages}
                        </span>
                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="btn btn-sm btn-ghost"
                        >
                            Next →
                        </button>
                    </div>
                </div>
            )}

            {/* Employee Form Modal */}
            {showAddModal && (
                <EmployeeForm
                    employee={editingEmployee}
                    onSave={handleSaveEmployee}
                    onCancel={() => setShowAddModal(false)}
                    isLoading={isSaving}
                />
            )}
        </div>
    )
}

export default Employees
