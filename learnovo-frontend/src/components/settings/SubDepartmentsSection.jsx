import React, { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, CheckCircle, XCircle, Building2 } from 'lucide-react'
import api from '../../services/authService'
import toast from 'react-hot-toast'

const SubDepartmentsSection = () => {
    const [subDepartments, setSubDepartments] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [isAdding, setIsAdding] = useState(false)
    const [editingId, setEditingId] = useState(null)
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        isActive: true
    })

    useEffect(() => {
        fetchSubDepartments()
    }, [])

    const fetchSubDepartments = async () => {
        try {
            setIsLoading(true)
            const response = await api.get('/sub-departments')
            if (response.data.success) {
                setSubDepartments(response.data.data)
            }
        } catch (error) {
            console.error('Error fetching sub-departments:', error)
            toast.error('Failed to load sub-departments')
        } finally {
            setIsLoading(false)
        }
    }

    const resetForm = () => {
        setFormData({
            name: '',
            description: '',
            isActive: true
        })
        setIsAdding(false)
        setEditingId(null)
    }

    const handleAdd = async () => {
        try {
            const response = await api.post('/sub-departments', formData)
            if (response.data.success) {
                toast.success('Sub-department created')
                fetchSubDepartments()
                resetForm()
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to create sub-department')
        }
    }

    const handleEdit = (subDept) => {
        setFormData({
            name: subDept.name,
            description: subDept.description || '',
            isActive: subDept.isActive
        })
        setEditingId(subDept._id)
        setIsAdding(true)
    }

    const handleUpdate = async () => {
        try {
            const response = await api.put(`/sub-departments/${editingId}`, formData)
            if (response.data.success) {
                toast.success('Sub-department updated')
                fetchSubDepartments()
                resetForm()
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update sub-department')
        }
    }

    const toggleStatus = async (id, currentStatus) => {
        try {
            const response = await api.patch(`/sub-departments/${id}/toggle-status`)
            if (response.data.success) {
                toast.success(`Sub-department ${currentStatus ? 'disabled' : 'enabled'}`)
                fetchSubDepartments()
            }
        } catch (error) {
            toast.error('Failed to update status')
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <Building2 className="h-6 w-6 text-primary-600" />
                    <div>
                        <h2 className="text-xl font-semibold text-gray-900">Sub Departments</h2>
                        <p className="text-sm text-gray-500">Manage configurable sub-departments for students (e.g. 29 LG SEC)</p>
                    </div>
                </div>
                {!isAdding && (
                    <button
                        onClick={() => setIsAdding(true)}
                        className="btn btn-primary"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Add New
                    </button>
                )}
            </div>

            {/* Add/Edit Form */}
            {isAdding && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                    <h3 className="text-sm font-medium text-gray-900 mb-4">
                        {editingId ? 'Edit Sub Department' : 'Add New Sub Department'}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="label">Name *</label>
                            <input
                                type="text"
                                className="input"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value.toUpperCase() })}
                                placeholder="e.g. 29 LG SEC"
                            />
                        </div>
                        <div>
                            <label className="label">Description (Optional)</label>
                            <input
                                type="text"
                                className="input"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Description or notes"
                            />
                        </div>
                    </div>
                    <div className="flex gap-3 mt-6">
                        <button
                            onClick={editingId ? handleUpdate : handleAdd}
                            className="btn btn-primary"
                            disabled={!formData.name}
                        >
                            {editingId ? 'Update' : 'Create'}
                        </button>
                        <button onClick={resetForm} className="btn btn-outline">
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* List */}
            <div className="space-y-4">
                {isLoading ? (
                    <div className="text-center py-4">Loading...</div>
                ) : subDepartments.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
                        <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                        <p className="text-sm text-gray-500">No sub-departments found</p>
                    </div>
                ) : (
                    <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 rounded-lg">
                        <table className="min-w-full divide-y divide-gray-300">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900">Name</th>
                                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Description</th>
                                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Status</th>
                                    <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                                        <span className="sr-only">Actions</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 bg-white">
                                {subDepartments.map((subDept) => (
                                    <tr key={subDept._id}>
                                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900">
                                            {subDept.name}
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                            {subDept.description || '-'}
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-4 text-sm">
                                            <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${subDept.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                {subDept.isActive ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                                            <button
                                                onClick={() => handleEdit(subDept)}
                                                className="text-primary-600 hover:text-primary-900 mr-4"
                                            >
                                                <Edit2 className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={() => toggleStatus(subDept._id, subDept.isActive)}
                                                className={`${subDept.isActive ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'}`}
                                                title={subDept.isActive ? 'Disable' : 'Enable'}
                                            >
                                                {subDept.isActive ? <XCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    )
}

export default SubDepartmentsSection
