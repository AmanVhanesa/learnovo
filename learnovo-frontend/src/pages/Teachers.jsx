import React, { useState, useEffect } from 'react'
import { Plus, Eye, X, Edit, Trash2, AlertTriangle, Copy, Check } from 'lucide-react'
import { teachersService } from '../services/teachersService'
import toast from 'react-hot-toast'

const Teachers = () => {
  const [teachers, setTeachers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
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

  useEffect(() => {
    fetchTeachers()
  }, [])

  const fetchTeachers = async () => {
    try {
      setIsLoading(true)
      setError(null) // Clear previous errors
      const { data } = await teachersService.list({ limit: 100 })
      setTeachers(data || [])
    } catch (error) {
      console.error('Error fetching teachers:', error)
      setError(error.response?.data?.message || 'Failed to load teachers. Please check your connection and try again.')
      setTeachers([]) // Clear teachers on error
    } finally {
      setIsLoading(false)
    }
  }

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

  const saveTeacher = async (e) => {
    e.preventDefault()
    try {
      const payload = { ...form, subjects: form.subjects.filter(Boolean), assignedClasses: form.assignedClasses.filter(Boolean) }
      if (editing) {
        await teachersService.update(editing._id || editing.id, payload)
        toast.success('Teacher updated successfully!')
      } else {
        const response = await teachersService.create(payload)
        // Show credentials if returned
        if (response?.data?.credentials) {
          setCredentials(response.data.credentials)
          setShowCredentialsModal(true)
        } else {
          toast.success('Teacher created successfully!')
        }
      }
      setShowModal(false)
      setEditing(null)
      await fetchTeachers()
    } catch (err) {
      console.error('Save teacher error:', err)
      alert(err?.response?.data?.message || 'Failed to add teacher')
    }
  }

  const deleteTeacher = async (teacher) => {
    if (!window.confirm(`Delete ${teacher.name}?`)) return
    try {
      await teachersService.remove(teacher._id || teacher.id)
      await fetchTeachers()
    } catch (err) {
      console.error('Delete teacher error:', err)
      alert(err?.response?.data?.message || 'Failed to delete teacher')
    }
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
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Teacher Management</h1>
        <button className="btn btn-primary" onClick={openAdd}>
          <Plus className="h-4 w-4 mr-2" />
          Add Teacher
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
            <p className="text-sm text-red-600">{error}</p>
          </div>
          <button
            onClick={() => fetchTeachers()}
            className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
          >
            Try again
          </button>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="table">
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
                  <div className="h-10 w-10 bg-gray-200 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-gray-700">
                      {teacher.name.charAt(0)}
                    </span>
                  </div>
                </td>
                <td className="text-sm font-medium text-gray-900">{teacher.name}</td>
                <td className="text-sm text-gray-900">{Array.isArray(teacher.subjects) ? teacher.subjects.join(', ') : teacher.subject || ''}</td>
                <td className="text-sm text-gray-900">{teacher.qualification}</td>
                <td className="text-sm text-gray-900">{Array.isArray(teacher.assignedClasses) ? teacher.assignedClasses.join(', ') : ''}</td>
                <td>
                  <span className={`status-badge status-${teacher.status}`}>
                    {teacher.status}
                  </span>
                </td>
                <td>
                  <div className="flex space-x-2">
                    <button className="p-1 text-gray-400 hover:text-blue-600">
                      <Eye className="h-4 w-4" />
                    </button>
                    <button className="p-1 text-gray-400 hover:text-green-600" onClick={() => openEdit(teacher)}>
                      <Edit className="h-4 w-4" />
                    </button>
                    <button className="p-1 text-gray-400 hover:text-red-600" onClick={() => deleteTeacher(teacher)}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Teacher Modal */}
      {showModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-content p-4">
            <div className="flex items-center justify-between border-b border-gray-200 p-4">
              <h3 className="text-lg font-semibold text-gray-900">{editing ? 'Edit Teacher' : 'Add Teacher'}</h3>
              <button className="p-2 rounded-md hover:bg-gray-100" onClick={() => setShowModal(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <form className="p-4 space-y-4" onSubmit={saveTeacher}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Full name</label>
                  <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div>
                  <label className="label">Email</label>
                  <input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                </div>
                <div>
                  <label className="label">Password</label>
                  <input type="password" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
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
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="btn btn-ghost" onClick={() => { setShowModal(false); setEditing(null); }}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Credentials Modal */}
      {showCredentialsModal && credentials && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-content p-6 max-w-md">
            <div className="flex items-center justify-between border-b border-gray-200 pb-4 mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Teacher Credentials</h3>
              <button className="p-2 rounded-md hover:bg-gray-100" onClick={() => {
                setShowCredentialsModal(false)
                setCredentials(null)
              }}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <p className="text-sm text-gray-600 mb-4">
                Please save these credentials. You can share them with the teacher. This information will not be shown again.
              </p>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase mb-1 block">Email</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={credentials.email}
                      className="flex-1 input bg-white"
                      onClick={(e) => e.target.select()}
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(credentials.email)
                        setCopiedField('email')
                        toast.success('Email copied!')
                        setTimeout(() => setCopiedField(null), 2000)
                      }}
                      className="p-2 rounded hover:bg-blue-100"
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
                  <label className="text-xs font-medium text-gray-500 uppercase mb-1 block">Password</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={credentials.password}
                      className="flex-1 input bg-white font-mono"
                      onClick={(e) => e.target.select()}
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(credentials.password)
                        setCopiedField('password')
                        toast.success('Password copied!')
                        setTimeout(() => setCopiedField(null), 2000)
                      }}
                      className="p-2 rounded hover:bg-blue-100"
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
        </div>
      )}
    </div>
  )
}

export default Teachers
