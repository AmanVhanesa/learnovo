import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Eye, X, Edit, Trash2, AlertTriangle, Copy, Check, Download } from 'lucide-react'
import { teachersService } from '../services/teachersService'
import { exportCSV } from '../utils/exportHelpers'
import toast from 'react-hot-toast'

const Teachers = () => {
  const queryClient = useQueryClient()

  const [showModal, setShowModal] = useState(false)
  const [showCredentialsModal, setShowCredentialsModal] = useState(false)
  const [credentials, setCredentials] = useState(null)
  const [copiedField, setCopiedField] = useState(null)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    subjects: [],
    qualifications: '',
    assignedClasses: []
  })

  // Fetch teachers
  const { data: teachers = [], isLoading, error } = useQuery({
    queryKey: ['teachers'],
    queryFn: async () => {
      const { data } = await teachersService.list({ limit: 100 })
      return data || []
    },
  })

  const errorMessage = error?.response?.data?.message || (error ? 'Failed to load teachers. Please check your connection and try again.' : null)

  // Save teacher mutation
  const saveTeacherMutation = useMutation({
    mutationFn: async (payload) => {
      if (editing) {
        await teachersService.update(editing._id || editing.id, payload)
        return { type: 'update' }
      } else {
        const response = await teachersService.create(payload)
        return { type: 'create', response }
      }
    },
    onSuccess: (result) => {
      if (result.type === 'update') {
        toast.success('Teacher updated successfully!')
      } else if (result.response?.data?.credentials) {
        setCredentials(result.response.data.credentials)
        setShowCredentialsModal(true)
      } else {
        toast.success('Teacher created successfully!')
      }
      setShowModal(false)
      setEditing(null)
      queryClient.invalidateQueries({ queryKey: ['teachers'] })
    },
    onError: (err) => {
      alert(err?.response?.data?.message || 'Failed to add teacher')
    },
  })

  // Delete teacher mutation
  const deleteTeacherMutation = useMutation({
    mutationFn: async (teacherId) => {
      await teachersService.remove(teacherId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] })
    },
    onError: (err) => {
      alert(err?.response?.data?.message || 'Failed to delete teacher')
    },
  })

  const openAdd = () => {
    setForm({ name: '', email: '', password: '', phone: '', subjects: [], qualifications: '', assignedClasses: [] })
    setShowModal(true)
  }

  const openEdit = (teacher) => {
    setEditing(teacher)
    setForm({
      name: teacher.name || '',
      email: teacher.email || '',
      password: '',
      phone: teacher.phone || '',
      subjects: Array.isArray(teacher.subjects) ? teacher.subjects : [],
      qualifications: teacher.qualifications || '',
      assignedClasses: Array.isArray(teacher.assignedClasses) ? teacher.assignedClasses : []
    })
    setShowModal(true)
  }

  const saveTeacher = (e) => {
    e.preventDefault()
    const payload = { ...form, subjects: form.subjects.filter(Boolean), assignedClasses: form.assignedClasses.filter(Boolean) }
    saveTeacherMutation.mutate(payload)
  }

  const deleteTeacher = (teacher) => {
    if (!window.confirm(`Delete ${teacher.name}?`)) return
    deleteTeacherMutation.mutate(teacher._id || teacher.id)
  }

  const handleExport = () => {
    if (teachers.length === 0) {
      toast.error('No teachers to export')
      return
    }
    const rows = [
      ['Name', 'Email', 'Phone', 'Subject', 'Qualification', 'Assigned Classes', 'Status']
    ].concat(
      teachers.map(t => [
        t.name || '',
        t.email || '',
        t.phone || '',
        Array.isArray(t.subjects) ? t.subjects.join(', ') : (t.subject || ''),
        t.qualification || '',
        Array.isArray(t.assignedClasses) ? t.assignedClasses.join(', ') : '',
        t.status || (t.isActive ? 'Active' : 'Inactive')
      ])
    )
    exportCSV('teachers.csv', rows)
    toast.success('Teachers exported successfully')
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
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Teacher Management</h1>
        <div className="flex gap-2 w-full sm:w-auto">
          <button onClick={handleExport} className="btn btn-outline w-full sm:w-auto">
            <Download className="h-4 w-4 mr-2" />
            Export
          </button>
          <button className="btn btn-primary w-full sm:w-auto" onClick={openAdd}>
            <Plus className="h-4 w-4 mr-2" />
            Add Teacher
          </button>
        </div>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mr-2" />
            <p className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
          </div>
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['teachers'] })}
            className="mt-2 text-sm text-red-600 dark:text-red-400 hover:text-red-800 underline"
          >
            Try again
          </button>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto table-scroll">
        <table className="table min-w-[600px]">
          <thead>
            <tr>
              <th>Photo</th>
              <th>Name</th>
              <th>Subject</th>
              <th>Qualification</th>
              <th>Assigned Classes</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {teachers.map((teacher) => (
              <tr key={teacher._id || teacher.id}>
                <td>
                  <div className="h-10 w-10 bg-gray-200 dark:bg-[#2C2C2E] rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-gray-700 dark:text-[#8E8E93]">
                      {teacher.name.charAt(0)}
                    </span>
                  </div>
                </td>
                <td className="text-sm font-medium text-gray-900 dark:text-white">{teacher.name}</td>
                <td className="text-sm text-gray-900 dark:text-white">{Array.isArray(teacher.subjects) ? teacher.subjects.join(', ') : teacher.subject || ''}</td>
                <td className="text-sm text-gray-900 dark:text-white">{teacher.qualification}</td>
                <td className="text-sm text-gray-900 dark:text-white">{Array.isArray(teacher.assignedClasses) ? teacher.assignedClasses.join(', ') : ''}</td>
                <td>
                  <span className={`status-badge status-${teacher.status}`}>
                    {teacher.status}
                  </span>
                </td>
                <td>
                  <div className="flex space-x-2">
                    <button className="btn-icon hover:text-blue-600">
                      <Eye className="h-4 w-4" />
                    </button>
                    <button className="btn-icon hover:text-green-600" onClick={() => openEdit(teacher)}>
                      <Edit className="h-4 w-4" />
                    </button>
                    <button className="btn-icon hover:text-red-600" onClick={() => deleteTeacher(teacher)}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {/* Add Teacher Modal */}
      {showModal && createPortal(
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-content p-3 sm:p-4">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-[#38383A] p-4">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">{editing ? 'Edit Teacher' : 'Add Teacher'}</h3>
              <button className="btn-close" onClick={() => setShowModal(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <form className="p-3 sm:p-4 space-y-4" onSubmit={saveTeacher}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Full name</label>
                  <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div>
                  <label className="label">Email</label>
                  <input type="email" autoComplete="off" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                </div>
                <div>
                  <label className="label">Password</label>
                  <input type="password" autoComplete="new-password" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
                </div>
                <div>
                  <label className="label">Phone</label>
                  <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                  <label className="label">Subjects (comma separated)</label>
                  <input className="input" value={form.subjects.join(', ')} onChange={(e) => setForm({ ...form, subjects: e.target.value.split(',').map(s => s.trim()) })} />
                </div>
                <div className="md:col-span-2">
                  <label className="label">Qualifications</label>
                  <input className="input" value={form.qualifications} onChange={(e) => setForm({ ...form, qualifications: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                  <label className="label">Assigned Classes (comma separated)</label>
                  <input className="input" value={form.assignedClasses.join(', ')} onChange={(e) => setForm({ ...form, assignedClasses: e.target.value.split(',').map(s => s.trim()) })} />
                </div>
              </div>
              <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
                <button type="button" className="btn btn-ghost w-full sm:w-auto" onClick={() => { setShowModal(false); setEditing(null); }}>Cancel</button>
                <button type="submit" className="btn btn-primary w-full sm:w-auto" disabled={saveTeacherMutation.isPending}>
                  {saveTeacherMutation.isPending ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Credentials Modal */}
      {showCredentialsModal && credentials && createPortal(
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-content p-6 max-w-md">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-[#38383A] pb-4 mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Teacher Credentials</h3>
              <button className="btn-close" onClick={() => {
                setShowCredentialsModal(false)
                setCredentials(null)
              }}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-[#8E8E93] mb-4">
                Please save these credentials. You can share them with the teacher. This information will not be shown again.
              </p>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase mb-1 block">Email</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={credentials.email}
                      className="flex-1 input bg-white dark:bg-[#1C1C1E]"
                      onClick={(e) => e.target.select()}
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(credentials.email)
                        setCopiedField('email')
                        toast.success('Email copied!')
                        setTimeout(() => setCopiedField(null), 2000)
                      }}
                      className="btn-icon hover:bg-blue-100 hover:text-blue-600"
                    >
                      {copiedField === 'email' ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4 text-blue-600" />
                      )}
                    </button>
                  </div>
                </div>
                
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase mb-1 block">Password</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={credentials.password}
                      className="flex-1 input bg-white dark:bg-[#1C1C1E] font-mono"
                      onClick={(e) => e.target.select()}
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(credentials.password)
                        setCopiedField('password')
                        toast.success('Password copied!')
                        setTimeout(() => setCopiedField(null), 2000)
                      }}
                      className="btn-icon hover:bg-blue-100 hover:text-blue-600"
                    >
                      {copiedField === 'password' ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4 text-blue-600" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setShowCredentialsModal(false)
                    setCredentials(null)
                  }}
                >
                  Got it
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

export default Teachers
