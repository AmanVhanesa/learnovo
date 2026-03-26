import React, { useState, useEffect } from 'react'
import { Plus, Search, Download, Eye, Edit, Trash2, Calendar, BookOpen, Users, FileText, X, AlertTriangle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import ClassSelector from '../components/ClassSelector'
import { assignmentsService } from '../services/assignmentsService'
import toast from 'react-hot-toast'

const Assignments = () => {
  const { user } = useAuth()
  const [assignments, setAssignments] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [classFilter, setClassFilter] = useState('')
  const [selectedClass, setSelectedClass] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({
    title: '',
    description: '',
    class: '',
    subject: '',
    dueDate: '',
    totalMarks: 100,
    instructions: '',
    attachments: []
  })

  // Mock data for classes and subjects (could be fetched from API)
  const classes = [
    { id: '10A', name: 'Class 10A' },
    { id: '11B', name: 'Class 11B' },
    { id: '12A', name: 'Class 12A' }
  ]

  const subjects = [
    { id: 'math', name: 'Mathematics' },
    { id: 'physics', name: 'Physics' },
    { id: 'chemistry', name: 'Chemistry' },
    { id: 'english', name: 'English' },
    { id: 'biology', name: 'Biology' }
  ]

  useEffect(() => {
    fetchAssignments()
  }, [selectedClass, statusFilter])

  const fetchAssignments = async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      const filters = {}
      if (statusFilter) filters.status = statusFilter
      if (selectedClass) filters.class = selectedClass.name
      
      const response = await assignmentsService.list(filters)
      
      if (response?.success && response?.data) {
        setAssignments(response.data)
      } else {
        setAssignments([])
      }
    } catch (error) {
      console.error('Error fetching assignments:', error)
      setError(error.response?.data?.message || 'Failed to load assignments. Please check your connection and try again.')
      setAssignments([])
    } finally {
      setIsLoading(false)
    }
  }

  const openAdd = () => {
    setEditing(null)
    setForm({
      title: '',
      description: '',
      class: '',
      subject: '',
      dueDate: '',
      totalMarks: 100,
      instructions: '',
      attachments: []
    })
    setShowModal(true)
  }

  const openEdit = (assignment) => {
    setEditing(assignment)
    setForm({
      title: assignment.title,
      description: assignment.description,
      class: assignment.class,
      subject: assignment.subject,
      dueDate: assignment.dueDate ? assignment.dueDate.split('T')[0] : '',
      totalMarks: assignment.totalMarks || 100,
      instructions: assignment.instructions || '',
      attachments: assignment.attachments || []
    })
    setShowModal(true)
  }

  const saveAssignment = async (e) => {
    e.preventDefault()
    try {
      setIsLoading(true)
      
      const assignmentData = {
        title: form.title,
        description: form.description,
        class: form.class,
        subject: form.subject,
        dueDate: form.dueDate,
        totalMarks: parseInt(form.totalMarks) || 100,
        instructions: form.instructions
      }

      if (editing) {
        await assignmentsService.update(editing._id || editing.id, assignmentData)
        toast.success('Assignment updated successfully!')
      } else {
        await assignmentsService.create(assignmentData)
        toast.success('Assignment created successfully!')
      }
      
      setShowModal(false)
      setEditing(null)
      await fetchAssignments()
    } catch (error) {
      console.error('Error saving assignment:', error)
      toast.error(error.response?.data?.message || 'Error saving assignment. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const deleteAssignment = async (assignment) => {
    if (!window.confirm('Are you sure you want to delete this assignment?')) return
    
    try {
      await assignmentsService.delete(assignment._id || assignment.id)
      toast.success('Assignment deleted successfully!')
      await fetchAssignments()
    } catch (error) {
      console.error('Error deleting assignment:', error)
      toast.error(error.response?.data?.message || 'Error deleting assignment. Please try again.')
    }
  }

  const filteredAssignments = assignments.filter(assignment => {
    const matchesSearch = assignment.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         assignment.description.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = !statusFilter || assignment.status === statusFilter
    const matchesClass = !classFilter || assignment.class === classFilter
    return matchesSearch && matchesStatus && matchesClass
  })

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'completed':
        return 'bg-blue-100 text-blue-800'
      case 'cancelled':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const isOverdue = (dueDate) => {
    if (!dueDate) return false
    const due = new Date(dueDate)
    const now = new Date()
    return due < now && !isSameDay(due, now)
  }

  const isSameDay = (date1, date2) => {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate()
  }

  const daysUntilDue = (dueDate) => {
    if (!dueDate) return null
    const due = new Date(dueDate)
    const now = new Date()
    const diff = Math.ceil((due - now) / (1000 * 60 * 60 * 24))
    return diff
  }

  const getStatusBadge = (status) => {
    if (status === 'paid') return 'Collected'
    if (status === 'pending') return 'Pending'
    if (status === 'overdue') return 'Overdue'
    return status
  }

  if (isLoading && assignments.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading-spinner"></div>
      </div>
    )
  }

  const isStudent = user?.role === 'student'
  const isTeacher = user?.role === 'teacher'
  const isAdmin = user?.role === 'admin'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">
          {isStudent ? 'My Assignments' : 'Assignment Management'}
        </h1>
        {(isTeacher || isAdmin) && (
          <button className="btn btn-primary" onClick={openAdd}>
            <Plus className="h-4 w-4 mr-2" />
            Create Assignment
          </button>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
            <p className="text-sm text-red-600">{error}</p>
          </div>
          <button
            onClick={() => fetchAssignments()}
            className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Assignment Summary - Only for teachers/admins */}
      {!isStudent && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="stat-card">
            <div className="flex items-center">
              <div className="p-3 rounded-lg bg-blue-100">
                <BookOpen className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Assignments</p>
                <p className="text-2xl font-semibold text-gray-900">{assignments.length}</p>
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="flex items-center">
              <div className="p-3 rounded-lg bg-green-100">
                <Calendar className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active Assignments</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {assignments.filter(a => a.status === 'active').length}
                </p>
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="flex items-center">
              <div className="p-3 rounded-lg bg-blue-100">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Completed</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {assignments.filter(a => a.status === 'completed').length}
                </p>
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="flex items-center">
              <div className="p-3 rounded-lg bg-yellow-100">
                <AlertTriangle className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Upcoming</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {assignments.filter(a => a.status === 'active' && new Date(a.dueDate) > new Date()).length}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search assignments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input pl-10"
              />
            </div>
          </div>
          {!isStudent && (
            <>
              <div className="sm:w-48">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="input"
                >
                  <option value="">All Status</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div className="sm:w-48">
                <select
                  value={classFilter}
                  onChange={(e) => setClassFilter(e.target.value)}
                  className="input"
                >
                  <option value="">All Classes</option>
                  {classes.map(cls => (
                    <option key={cls.id} value={cls.id}>{cls.name}</option>
                  ))}
                </select>
              </div>
            </>
          )}
          <button className="btn btn-outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </button>
        </div>
      </div>

      {/* Assignments table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="table">
          <thead>
            <tr>
              <th>Assignment</th>
              {!isStudent && <th>Class</th>}
              <th>Subject</th>
              <th>Due Date</th>
              <th>Status</th>
              {!isStudent && <th>Actions</th>}
              {isStudent && <th>Details</th>}
            </tr>
          </thead>
          <tbody>
            {isLoading && assignments.length === 0 ? (
              <tr>
                <td colSpan={isStudent ? 5 : 6} className="text-center py-8">
                  <div className="loading-spinner"></div>
                </td>
              </tr>
            ) : filteredAssignments.length === 0 ? (
              <tr>
                <td colSpan={isStudent ? 5 : 6} className="text-center py-8 text-gray-500">
                  No assignments found
                </td>
              </tr>
            ) : (
              filteredAssignments.map((assignment) => (
                <tr key={assignment._id || assignment.id}>
                  <td>
                    <div>
                      <div className="text-sm font-medium text-gray-900">{assignment.title}</div>
                      <div className="text-sm text-gray-500 truncate max-w-xs">
                        {assignment.description}
                      </div>
                    </div>
                  </td>
                  {!isStudent && (
                    <td className="text-sm text-gray-900">{assignment.class}</td>
                  )}
                  <td className="text-sm text-gray-900">{assignment.subject}</td>
                  <td className="text-sm text-gray-900">
                    <div className="flex flex-col">
                      <span>{new Date(assignment.dueDate).toLocaleDateString()}</span>
                      {isOverdue(assignment.dueDate) && (
                        <span className="text-red-500 text-xs">(Overdue)</span>
                      )}
                      {!isOverdue(assignment.dueDate) && assignment.status === 'active' && (
                        <span className="text-orange-500 text-xs">
                          {daysUntilDue(assignment.dueDate) > 0 
                            ? `${daysUntilDue(assignment.dueDate)} days left`
                            : 'Due today'
                          }
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <span className={`status-badge ${getStatusColor(assignment.status)}`}>
                      {assignment.status}
                    </span>
                  </td>
                  {!isStudent && (
                    <td>
                      <div className="flex space-x-2">
                        <button 
                          className="p-1 text-gray-400 hover:text-blue-600"
                          onClick={() => openEdit(assignment)}
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button 
                          className="p-1 text-gray-400 hover:text-red-600" 
                          onClick={() => deleteAssignment(assignment)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  )}
                  {isStudent && (
                    <td>
                      <button className="p-1 text-blue-600 hover:text-blue-800">
                        <Eye className="h-4 w-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Assignment Modal - Only for teachers/admins */}
      {showModal && !isStudent && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-content p-6">
            <div className="flex items-center justify-between border-b border-gray-200 pb-4 mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {editing ? 'Edit Assignment' : 'Create Assignment'}
              </h3>
              <button 
                className="p-2 rounded-md hover:bg-gray-100"
                onClick={() => { setShowModal(false); setEditing(null); }}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form className="space-y-4" onSubmit={saveAssignment}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Assignment Title
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({...form, title: e.target.value})}
                  className="input"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({...form, description: e.target.value})}
                  className="input"
                  rows={4}
                  required
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Class
                  </label>
                  <select
                    value={form.class}
                    onChange={(e) => setForm({...form, class: e.target.value})}
                    className="input"
                    required
                  >
                    <option value="">Select Class</option>
                    {classes.map(cls => (
                      <option key={cls.id} value={cls.id}>{cls.name}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Subject
                  </label>
                  <select
                    value={form.subject}
                    onChange={(e) => setForm({...form, subject: e.target.value})}
                    className="input"
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={form.dueDate}
                    onChange={(e) => setForm({...form, dueDate: e.target.value})}
                    className="input"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Total Marks
                  </label>
                  <input
                    type="number"
                    value={form.totalMarks}
                    onChange={(e) => setForm({...form, totalMarks: e.target.value})}
                    className="input"
                    min="0"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Instructions (Optional)
                </label>
                <textarea
                  value={form.instructions}
                  onChange={(e) => setForm({...form, instructions: e.target.value})}
                  className="input"
                  rows={3}
                  placeholder="Additional instructions for students..."
                />
              </div>
              
              <div className="flex justify-end space-x-3 pt-4">
                <button 
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => { setShowModal(false); setEditing(null); }}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="btn btn-primary"
                  disabled={isLoading}
                >
                  {isLoading ? 'Saving...' : (editing ? 'Update' : 'Create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Assignments
