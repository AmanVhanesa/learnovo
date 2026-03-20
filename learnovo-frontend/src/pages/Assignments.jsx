import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Download, Eye, Edit, Trash2, Calendar, BookOpen, Users, FileText, X, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { assignmentsService } from '../services/assignmentsService'
import { classesService } from '../services/classesService'
import { subjectsService } from '../services/subjectsService'
import { exportCSV } from '../utils/exportHelpers'
import toast from 'react-hot-toast'

const Assignments = () => {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [classFilter, setClassFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [selectedAssignment, setSelectedAssignment] = useState(null)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({
    title: '',
    description: '',
    class: '',
    className: '',
    subject: '',
    dueDate: '',
    totalMarks: 100,
    instructions: ''
  })

  const isStudent = user?.role === 'student'
  const isTeacher = user?.role === 'teacher'
  const isAdmin = user?.role === 'admin'

  // Fetch classes
  const { data: classes = [] } = useQuery({
    queryKey: ['assignments-classes'],
    queryFn: async () => {
      const res = await classesService.list()
      return (res?.data || res || []).map(cls => ({
        id: cls._id || cls.id,
        name: cls.name || `${cls.grade} ${cls.section || ''}`.trim()
      }))
    },
  })

  // Fetch subjects
  const { data: subjects = [] } = useQuery({
    queryKey: ['assignments-subjects'],
    queryFn: async () => {
      const res = await subjectsService.list()
      return (res?.data || res || []).map(sub => ({
        id: sub._id || sub.id,
        name: sub.name
      }))
    },
  })

  // Fetch assignments
  const { data: assignments = [], isLoading, error } = useQuery({
    queryKey: ['assignments', statusFilter],
    queryFn: async () => {
      const filters = {}
      if (statusFilter) filters.status = statusFilter
      const response = await assignmentsService.list(filters)
      if (response?.success && response?.data) {
        return response.data
      }
      return []
    },
  })

  // Save (create/update) mutation
  const saveMutation = useMutation({
    mutationFn: async ({ isEdit, id, data }) => {
      if (isEdit) {
        return assignmentsService.update(id, data)
      }
      return assignmentsService.create(data)
    },
    onSuccess: (_, variables) => {
      toast.success(variables.isEdit ? 'Assignment updated successfully!' : 'Assignment created successfully!')
      setShowModal(false)
      setEditing(null)
      queryClient.invalidateQueries({ queryKey: ['assignments'] })
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || error.message || 'Error saving assignment.')
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id) => assignmentsService.delete(id),
    onSuccess: () => {
      toast.success('Assignment deleted successfully!')
      queryClient.invalidateQueries({ queryKey: ['assignments'] })
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Error deleting assignment.')
    },
  })

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }) => assignmentsService.update(id, { status }),
    onSuccess: (_, variables) => {
      toast.success(`Assignment marked as ${variables.status}`)
      queryClient.invalidateQueries({ queryKey: ['assignments'] })
    },
    onError: () => {
      toast.error('Failed to update status')
    },
  })

  const openAdd = () => {
    setEditing(null)
    setForm({
      title: '',
      description: '',
      class: '',
      className: '',
      subject: '',
      dueDate: '',
      totalMarks: 100,
      instructions: ''
    })
    setShowModal(true)
  }

  const openEdit = (assignment) => {
    setEditing(assignment)
    // Find the matching class to set the dropdown correctly
    const matchedClass = classes.find(c => c.name === assignment.class)
    setForm({
      title: assignment.title,
      description: assignment.description,
      class: matchedClass?.id || '',
      className: assignment.class,
      subject: assignment.subject,
      dueDate: assignment.dueDate ? assignment.dueDate.split('T')[0] : '',
      totalMarks: assignment.totalMarks || 100,
      instructions: assignment.instructions || ''
    })
    setShowModal(true)
  }

  const handleClassChange = (classId) => {
    const cls = classes.find(c => c.id === classId)
    setForm({ ...form, class: classId, className: cls?.name || '' })
  }

  const saveAssignment = async (e) => {
    e.preventDefault()

    const assignmentData = {
      title: form.title,
      description: form.description,
      class: form.className, // Backend expects class name string
      classId: form.class,   // Also send classId for student lookup
      subject: form.subject,
      dueDate: form.dueDate,
      totalMarks: parseInt(form.totalMarks) || 100,
      instructions: form.instructions
    }

    saveMutation.mutate({
      isEdit: !!editing,
      id: editing?._id || editing?.id,
      data: assignmentData
    })
  }

  const deleteAssignment = async (assignment) => {
    if (!window.confirm('Are you sure you want to delete this assignment?')) return
    deleteMutation.mutate(assignment._id || assignment.id)
  }

  const updateStatus = async (assignment, newStatus) => {
    updateStatusMutation.mutate({ id: assignment._id || assignment.id, status: newStatus })
  }

  const viewDetails = async (assignment) => {
    try {
      const res = await assignmentsService.get(assignment._id || assignment.id)
      if (res?.success && res?.data) {
        setSelectedAssignment(res.data)
      } else {
        setSelectedAssignment(assignment)
      }
    } catch {
      setSelectedAssignment(assignment)
    }
    setShowDetailsModal(true)
  }

  const handleExport = () => {
    const rows = [['Title', 'Class', 'Subject', 'Due Date', 'Status', 'Total Marks']]
    filteredAssignments.forEach(a => {
      rows.push([
        a.title,
        a.class,
        a.subject,
        new Date(a.dueDate).toLocaleDateString(),
        a.status,
        a.totalMarks || 100
      ])
    })
    exportCSV(`Assignments_${new Date().toISOString().split('T')[0]}.csv`, rows)
    toast.success('Assignments exported')
  }

  const filteredAssignments = assignments.filter(assignment => {
    const matchesSearch = !searchQuery ||
      assignment.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (assignment.description || '').toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = !statusFilter || assignment.status === statusFilter
    const matchesClass = !classFilter || assignment.class === classFilter
    return matchesSearch && matchesStatus && matchesClass
  })

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-400'
      case 'completed': return 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-400'
      case 'cancelled': return 'bg-gray-100 text-gray-800 dark:bg-gray-500/20 dark:text-[#8E8E93]'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-500/20 dark:text-[#8E8E93]'
    }
  }

  const isOverdue = (dueDate) => {
    if (!dueDate) return false
    const due = new Date(dueDate)
    due.setHours(23, 59, 59, 999)
    return due < new Date()
  }

  const daysUntilDue = (dueDate) => {
    if (!dueDate) return null
    const due = new Date(dueDate)
    due.setHours(23, 59, 59, 999)
    const now = new Date()
    return Math.ceil((due - now) / (1000 * 60 * 60 * 24))
  }

  // Get unique class names from assignments for filter dropdown
  const classNamesInAssignments = [...new Set(assignments.map(a => a.class).filter(Boolean))]

  if (isLoading && assignments.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            {isStudent ? 'My Assignments' : 'Assignment Management'}
          </h1>
          <p className="text-sm text-gray-500 dark:text-[#8E8E93] mt-1">
            {isStudent
              ? 'View your assignments and deadlines'
              : 'Create and manage assignments for your classes'}
          </p>
        </div>
        {(isTeacher || isAdmin) && (
          <button className="btn btn-primary flex items-center gap-2 w-full sm:w-auto justify-center" onClick={openAdd}>
            <Plus className="h-4 w-4" />
            Create Assignment
          </button>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-2xl p-4">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mr-2" />
            <p className="text-sm text-red-600 dark:text-red-400">{error.response?.data?.message || error.message || 'Failed to load assignments.'}</p>
          </div>
          <button onClick={() => queryClient.invalidateQueries({ queryKey: ['assignments'] })} className="mt-2 text-sm text-red-600 dark:text-red-400 hover:underline">
            Try again
          </button>
        </div>
      )}

      {/* Summary Cards - Teachers/Admins */}
      {!isStudent && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total', value: assignments.length, icon: BookOpen, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-500/20' },
            { label: 'Active', value: assignments.filter(a => a.status === 'active').length, icon: Calendar, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-500/20' },
            { label: 'Completed', value: assignments.filter(a => a.status === 'completed').length, icon: CheckCircle, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-100 dark:bg-indigo-500/20' },
            { label: 'Overdue', value: assignments.filter(a => a.status === 'active' && isOverdue(a.dueDate)).length, icon: AlertTriangle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-500/20' },
          ].map((stat, i) => (
            <div key={i} className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass p-4 dark:border dark:border-[#38383A]">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-lg ${stat.bg}`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-[#8E8E93]">{stat.label}</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-[#636366]" />
            <input
              type="text"
              placeholder="Search assignments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 input"
            />
          </div>
          {!isStudent && (
            <>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full sm:w-40 px-3 py-2 input"
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                className="w-full sm:w-40 px-3 py-2 input"
              >
                <option value="">All Classes</option>
                {classNamesInAssignments.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </>
          )}
          <button className="btn btn-outline flex items-center gap-2 w-full sm:w-auto justify-center" onClick={handleExport}>
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>
      </div>

      {/* Assignments Table */}
      <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[750px]">
            <thead>
              <tr className="border-b border-gray-200 dark:border-[#38383A] bg-gray-50 dark:bg-[#2C2C2E]">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase">Assignment</th>
                {!isStudent && <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase">Class</th>}
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase">Subject</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase">Due Date</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase">Status</th>
                {!isStudent && <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase">Students</th>}
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-[#38383A]">
              {filteredAssignments.length === 0 ? (
                <tr>
                  <td colSpan={isStudent ? 5 : 7} className="text-center py-12">
                    <BookOpen className="h-10 w-10 text-gray-300 dark:text-[#636366] mx-auto mb-3" />
                    <p className="text-gray-500 dark:text-[#8E8E93]">No assignments found</p>
                  </td>
                </tr>
              ) : (
                filteredAssignments.map((assignment) => {
                  const overdue = isOverdue(assignment.dueDate) && assignment.status === 'active'
                  const days = daysUntilDue(assignment.dueDate)
                  return (
                    <tr key={assignment._id || assignment.id} className="hover:bg-gray-50 dark:hover:bg-[#2C2C2E]/50">
                      <td className="px-4 py-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-xs">{assignment.title}</p>
                          <p className="text-xs text-gray-500 dark:text-[#8E8E93] truncate max-w-xs">{assignment.description}</p>
                        </div>
                      </td>
                      {!isStudent && (
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-[#8E8E93]">{assignment.class}</td>
                      )}
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-[#8E8E93]">{assignment.subject}</td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm text-gray-700 dark:text-[#8E8E93]">
                            {new Date(assignment.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                          {overdue && (
                            <span className="text-xs text-red-600 dark:text-red-400 font-medium">Overdue</span>
                          )}
                          {!overdue && assignment.status === 'active' && days != null && (
                            <span className={`text-xs ${days <= 2 ? 'text-red-500 dark:text-red-400' : 'text-orange-500 dark:text-orange-400'}`}>
                              {days <= 0 ? 'Due today' : `${days}d left`}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full capitalize ${getStatusColor(assignment.status)}`}>
                          {assignment.status}
                        </span>
                      </td>
                      {!isStudent && (
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-600 dark:text-[#8E8E93]">
                            {assignment.assignedTo?.length || 0}
                          </span>
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => viewDetails(assignment)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-md hover:bg-blue-50 dark:hover:bg-blue-500/10"
                            title="View details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {(isTeacher || isAdmin) && (
                            <>
                              <button
                                onClick={() => openEdit(assignment)}
                                className="p-1.5 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-md hover:bg-indigo-50 dark:hover:bg-indigo-500/10"
                                title="Edit"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              {assignment.status === 'active' && (
                                <button
                                  onClick={() => updateStatus(assignment, 'completed')}
                                  className="p-1.5 text-gray-400 hover:text-green-600 dark:hover:text-green-400 rounded-md hover:bg-green-50 dark:hover:bg-green-500/10"
                                  title="Mark completed"
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </button>
                              )}
                              {assignment.status === 'active' && (
                                <button
                                  onClick={() => updateStatus(assignment, 'cancelled')}
                                  className="p-1.5 text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 rounded-md hover:bg-orange-50 dark:hover:bg-orange-500/10"
                                  title="Cancel"
                                >
                                  <XCircle className="h-4 w-4" />
                                </button>
                              )}
                              <button
                                onClick={() => deleteAssignment(assignment)}
                                className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-md hover:bg-red-50 dark:hover:bg-red-500/10"
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showModal && !isStudent && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-[#38383A] sticky top-0 bg-white dark:bg-[#1C1C1E] z-10">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editing ? 'Edit Assignment' : 'Create Assignment'}
              </h3>
              <button
                className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-[#2C2C2E] text-gray-400 hover:text-gray-600 dark:hover:text-white"
                onClick={() => { setShowModal(false); setEditing(null) }}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form className="p-6 space-y-4" onSubmit={saveAssignment}>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-3 py-2 input"
                  placeholder="Enter assignment title"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 input"
                  rows={3}
                  placeholder="Describe the assignment"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">
                    Class <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.class}
                    onChange={(e) => handleClassChange(e.target.value)}
                    className="w-full px-3 py-2 input"
                    required
                  >
                    <option value="">Select Class</option>
                    {classes.map(cls => (
                      <option key={cls.id} value={cls.id}>{cls.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">
                    Subject <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    className="w-full px-3 py-2 input"
                    required
                  >
                    <option value="">Select Subject</option>
                    {subjects.map(subject => (
                      <option key={subject.id} value={subject.name}>{subject.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">
                    Due Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={form.dueDate}
                    onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                    className="w-full px-3 py-2 input"
                    min={new Date().toISOString().split('T')[0]}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">
                    Total Marks
                  </label>
                  <input
                    type="number"
                    value={form.totalMarks}
                    onChange={(e) => setForm({ ...form, totalMarks: e.target.value })}
                    className="w-full px-3 py-2 input"
                    min="1"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">
                  Instructions (Optional)
                </label>
                <textarea
                  value={form.instructions}
                  onChange={(e) => setForm({ ...form, instructions: e.target.value })}
                  className="w-full px-3 py-2 input"
                  rows={2}
                  placeholder="Additional instructions for students..."
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 border-t border-gray-200 dark:border-[#38383A]">
                <button
                  type="button"
                  className="btn btn-outline w-full sm:w-auto"
                  onClick={() => { setShowModal(false); setEditing(null) }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary w-full sm:w-auto"
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending ? 'Saving...' : (editing ? 'Update' : 'Create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {showDetailsModal && selectedAssignment && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-[#38383A] sticky top-0 bg-white dark:bg-[#1C1C1E] z-10">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Assignment Details</h3>
              <button
                className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-[#2C2C2E] text-gray-400 dark:text-[#636366]"
                onClick={() => { setShowDetailsModal(false); setSelectedAssignment(null) }}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <h4 className="text-xl font-semibold text-gray-900 dark:text-white">{selectedAssignment.title}</h4>
                <p className="text-gray-600 dark:text-[#8E8E93] mt-2">{selectedAssignment.description}</p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-gray-500 dark:text-[#8E8E93]">Class</p>
                  <p className="font-medium text-gray-900 dark:text-white">{selectedAssignment.class}</p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-[#8E8E93]">Subject</p>
                  <p className="font-medium text-gray-900 dark:text-white">{selectedAssignment.subject}</p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-[#8E8E93]">Due Date</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {new Date(selectedAssignment.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-[#8E8E93]">Total Marks</p>
                  <p className="font-medium text-gray-900 dark:text-white">{selectedAssignment.totalMarks || 100}</p>
                </div>
              </div>

              <div>
                <p className="text-gray-500 dark:text-[#8E8E93] text-sm">Status</p>
                <span className={`inline-block mt-1 px-2.5 py-1 text-xs font-medium rounded-full capitalize ${getStatusColor(selectedAssignment.status)}`}>
                  {selectedAssignment.status}
                </span>
              </div>

              {selectedAssignment.instructions && (
                <div>
                  <p className="text-gray-500 dark:text-[#8E8E93] text-sm mb-1">Instructions</p>
                  <div className="p-3 bg-gray-50 dark:bg-[#2C2C2E] rounded-lg">
                    <p className="text-sm text-gray-700 dark:text-[#8E8E93] whitespace-pre-wrap">{selectedAssignment.instructions}</p>
                  </div>
                </div>
              )}

              {selectedAssignment.teacher && (
                <div>
                  <p className="text-gray-500 dark:text-[#8E8E93] text-sm">Assigned By</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {selectedAssignment.teacher.name || selectedAssignment.teacher.email}
                  </p>
                </div>
              )}

              {/* Assigned Students List (teachers/admins only) */}
              {!isStudent && selectedAssignment.assignedTo && selectedAssignment.assignedTo.length > 0 && (
                <div>
                  <p className="text-gray-500 dark:text-[#8E8E93] text-sm mb-2">
                    Assigned Students ({selectedAssignment.assignedTo.length})
                  </p>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {selectedAssignment.assignedTo.map((student, idx) => (
                      <div key={student._id || idx} className="flex items-center gap-2 text-sm p-2 bg-gray-50 dark:bg-[#2C2C2E] rounded">
                        <Users className="h-3.5 w-3.5 text-gray-400 dark:text-[#636366]" />
                        <span className="text-gray-700 dark:text-[#8E8E93]">
                          {student.name || student.email || 'Unknown'}
                        </span>
                        {student.rollNumber && (
                          <span className="text-xs text-gray-400 dark:text-[#636366]">({student.rollNumber})</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end p-6 border-t border-gray-200 dark:border-[#38383A]">
              <button
                className="btn btn-outline"
                onClick={() => { setShowDetailsModal(false); setSelectedAssignment(null) }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Assignments
