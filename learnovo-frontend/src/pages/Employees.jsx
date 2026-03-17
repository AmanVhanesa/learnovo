import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Download, Eye, Power, PowerOff, Edit, Key } from 'lucide-react'
import { employeesService } from '../services/employeesService'
import { exportCSV } from '../utils/exportHelpers'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import EmployeeForm from '../components/employees/EmployeeForm'
import toast from 'react-hot-toast'

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

    // Fetch filter options
    const { data: filterOptions = { roles: [], departments: [] } } = useQuery({
        queryKey: ['employees-filters'],
        queryFn: async () => {
            const response = await employeesService.getFilters()
            return response.success ? response.data : { roles: [], departments: [] }
        },
    })

    // Fetch employees
    const { data: employees = [], isLoading } = useQuery({
        queryKey: ['employees', debouncedSearchQuery, roleFilter, departmentFilter, statusFilter],
        queryFn: async () => {
            const filters = {
                search: debouncedSearchQuery,
                role: roleFilter,
                department: departmentFilter,
                status: statusFilter,
                limit: 100
            }
            const response = await employeesService.list(filters)
            const employeesData = response?.data || []
            return Array.isArray(employeesData) ? employeesData : []
        },
    })

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
                        console.error('Pending photo upload failed:', photoErr)
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
            console.error('Save employee error:', error)
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
            console.error('Toggle status error:', error)
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
            console.error('Reset password error:', error)
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

    const handleExport = () => {
        const rows = [
            ['Employee ID', 'Name', 'Role', 'Phone', 'Email', 'Department', 'Joining Date', 'Salary', 'Status']
        ].concat(
            employees.map(e => [
                e.employeeId || 'N/A',
                e.name,
                e.role,
                e.phone || '',
                e.email || '',
                e.department || '',
                e.dateOfJoining ? new Date(e.dateOfJoining).toLocaleDateString() : '',
                e.salary || '',
                e.isActive ? 'Active' : 'Inactive'
            ])
        )
        exportCSV('employees.csv', rows)
        toast.success('Employees exported successfully')
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
            admin: 'bg-purple-100 text-purple-800',
            teacher: 'bg-blue-100 text-blue-800',
            accountant: 'bg-green-100 text-green-800',
            staff: 'bg-gray-100 text-gray-800'
        }
        return colors[role] || 'bg-gray-100 text-gray-800'
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
                        {employees.length} employee{employees.length !== 1 ? 's' : ''} found
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

            {/* Filters */}
            <div className="bg-white dark:bg-[#1C1C1E] rounded-lg shadow-sm p-3 sm:p-4">
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

                        <button onClick={handleExport} className="btn btn-outline w-full sm:w-auto col-span-2 sm:col-span-1">
                            <Download className="h-4 w-4 mr-2" />
                            Export
                        </button>
                    </div>
                </div>
            </div>

            {/* Employees Table */}
            <div className="bg-white dark:bg-[#1C1C1E] rounded-lg shadow-sm overflow-hidden">
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
                                    <td colSpan="9" className="text-center py-12 text-gray-500 dark:text-[#8E8E93]">
                                        No employees found
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
                                            {employee.photo ? (
                                                <img
                                                    src={employee.photo}
                                                    alt={employee.name}
                                                    className="h-10 w-10 rounded-full object-cover"
                                                />
                                            ) : (
                                                <div className="h-10 w-10 bg-gradient-to-br from-teal-400 to-teal-700 rounded-full flex items-center justify-center">
                                                    <span className="text-sm font-semibold text-white">
                                                        {employee.name?.charAt(0).toUpperCase()}
                                                    </span>
                                                </div>
                                            )}
                                        </td>
                                        <td>
                                            <div>
                                                <div className="text-sm font-medium text-gray-900 dark:text-white">{employee.name?.toUpperCase()}</div>
                                                <div className="text-sm text-gray-500 dark:text-[#8E8E93]">{employee.email || employee.phone}</div>
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleBadgeColor(employee.role)}`}>
                                                {employee.role?.charAt(0).toUpperCase() + employee.role?.slice(1)}
                                            </span>
                                        </td>
                                        <td className="text-sm text-gray-900 dark:text-white">{employee.phone || '-'}</td>
                                        <td className="text-sm text-gray-900 dark:text-white">{employee.department || '-'}</td>
                                        <td className="text-sm text-gray-900 dark:text-white">
                                            {employee.dateOfJoining ? new Date(employee.dateOfJoining).toLocaleDateString() : '-'}
                                        </td>
                                        <td>
                                            <span
                                                className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${employee.isActive
                                                    ? 'bg-green-100 text-green-800'
                                                    : 'bg-red-100 text-red-800'
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
                                                            className={`p-1 text-gray-400 hover:${employee.isActive ? 'text-red-600' : 'text-green-600'}`}
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
