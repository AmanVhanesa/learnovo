import React, { useState, useEffect } from 'react'
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

    // Data state
    const [employees, setEmployees] = useState([])
    const [isLoading, setIsLoading] = useState(true)

    // Filter state
    const [searchQuery, setSearchQuery] = useState('')
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')
    const [roleFilter, setRoleFilter] = useState('')
    const [departmentFilter, setDepartmentFilter] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [filterOptions, setFilterOptions] = useState({ roles: [], departments: [] })

    // UI state
    const [showAddModal, setShowAddModal] = useState(false)
    const [editingEmployee, setEditingEmployee] = useState(null)
    const [isSaving, setIsSaving] = useState(false)

    // Debounce search query
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchQuery(searchQuery)
        }, 500)

        return () => clearTimeout(timer)
    }, [searchQuery])

    useEffect(() => {
        fetchEmployees()
        fetchFilterOptions()
    }, [debouncedSearchQuery, roleFilter, departmentFilter, statusFilter])

    const fetchFilterOptions = async () => {
        try {
            const response = await employeesService.getFilters()
            if (response.success) {
                setFilterOptions(response.data)
            }
        } catch (error) {
            console.error('Error fetching filter options:', error)
        }
    }

    const fetchEmployees = async () => {
        try {
            setIsLoading(true)
            const filters = {
                search: debouncedSearchQuery,
                role: roleFilter,
                department: departmentFilter,
                status: statusFilter,
                limit: 100
            }

            const response = await employeesService.list(filters)
            const employeesData = response?.data || []
            setEmployees(Array.isArray(employeesData) ? employeesData : [])
        } catch (error) {
            console.error('Error fetching employees:', error)
            toast.error('Failed to load employees')
            setEmployees([])
        } finally {
            setIsLoading(false)
        }
    }

    const handleViewEmployee = (employee) => {
        navigate(`/app/employees/${employee._id}`)
    }

    const handleToggleStatus = async (employee) => {
        const action = employee.isActive ? 'deactivate' : 'activate'
        const reason = employee.isActive ? prompt('Reason for deactivation:') : null

        if (employee.isActive && !reason) return

        try {
            await employeesService.toggleStatus(employee._id, { reason })
            toast.success(`Employee ${action}d successfully`)
            fetchEmployees()
        } catch (error) {
            console.error('Toggle status error:', error)
            toast.error(`Failed to ${action} employee`)
        }
    }

    const handleResetPassword = async (employee) => {
        const newPassword = prompt('Enter new password (leave empty for default "employee123"):')
        if (newPassword === null) return

        try {
            const response = await employeesService.resetPassword(employee._id, {
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

    const handleSaveEmployee = async (formData, pendingPhotoFile) => {
        try {
            setIsSaving(true)

            if (editingEmployee) {
                await employeesService.update(editingEmployee._id, formData)
                toast.success('Employee updated successfully')
            } else {
                const response = await employeesService.create(formData)
                toast.success('Employee added successfully')

                // Show credentials if returned
                if (response?.data?.credentials) {
                    toast.success(`Login: ${response.data.credentials.email || response.data.credentials.phone} / ${response.data.credentials.password}`, {
                        duration: 10000
                    })
                }

                // Upload pending photo for new employees
                if (pendingPhotoFile && response?.data?.id) {
                    try {
                        await employeesService.uploadPhoto(response.data.id, pendingPhotoFile)
                    } catch (photoErr) {
                        console.error('Pending photo upload failed:', photoErr)
                        toast.error('Employee saved but photo upload failed. You can re-upload by editing the employee.')
                    }
                }
            }

            setShowAddModal(false)
            fetchEmployees()
        } catch (error) {
            console.error('Save employee error:', error)
            toast.error(error.response?.data?.message || 'Failed to save employee')
        } finally {
            setIsSaving(false)
        }
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
                    <h1 className="text-2xl font-bold text-gray-900">Employees</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        {employees.length} employee{employees.length !== 1 ? 's' : ''} found
                    </p>
                </div>
                <div className="flex gap-2">
                    {user?.role === 'admin' && (
                        <button
                            className="btn btn-primary"
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
            <div className="bg-white rounded-lg shadow-sm p-4">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                    {/* Search */}
                    <div className="flex-1">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
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
                    <div className="flex flex-wrap gap-3">
                        <select
                            value={roleFilter}
                            onChange={(e) => setRoleFilter(e.target.value)}
                            className="input w-40"
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
                            className="input w-40"
                        >
                            <option value="">All Departments</option>
                            {filterOptions.departments.map(dept => (
                                <option key={dept} value={dept}>{dept}</option>
                            ))}
                        </select>

                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="input w-32"
                        >
                            <option value="">All Status</option>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                        </select>

                        {(searchQuery || roleFilter || departmentFilter || statusFilter) && (
                            <button onClick={clearFilters} className="btn btn-ghost text-sm">
                                Clear
                            </button>
                        )}

                        <button onClick={handleExport} className="btn btn-outline">
                            <Download className="h-4 w-4 mr-2" />
                            Export
                        </button>
                    </div>
                </div>
            </div>

            {/* Employees Table */}
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="table">
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
                                    <td colSpan="9" className="text-center py-12 text-gray-500">
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
                                                <div className="h-10 w-10 bg-gray-200 rounded-full flex items-center justify-center">
                                                    <span className="text-sm font-medium text-gray-700">
                                                        {employee.name?.charAt(0).toUpperCase()}
                                                    </span>
                                                </div>
                                            )}
                                        </td>
                                        <td>
                                            <div>
                                                <div className="text-sm font-medium text-gray-900">{employee.name?.toUpperCase()}</div>
                                                <div className="text-sm text-gray-500">{employee.email || employee.phone}</div>
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleBadgeColor(employee.role)}`}>
                                                {employee.role?.charAt(0).toUpperCase() + employee.role?.slice(1)}
                                            </span>
                                        </td>
                                        <td className="text-sm text-gray-900">{employee.phone || '-'}</td>
                                        <td className="text-sm text-gray-900">{employee.department || '-'}</td>
                                        <td className="text-sm text-gray-900">
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
                                                    className="p-1 text-gray-400 hover:text-blue-600"
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
                                                            className="p-1 text-gray-400 hover:text-primary-600"
                                                            title="Edit Employee"
                                                        >
                                                            <Edit className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleResetPassword(employee)}
                                                            className="p-1 text-gray-400 hover:text-yellow-600"
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
