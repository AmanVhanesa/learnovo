import React, { useState, useEffect } from 'react'
import { Plus, Search, Download, Eye, Edit, Trash2, X, AlertTriangle, Copy, Check } from 'lucide-react'
import { studentsService } from '../services/studentsService'
import { exportCSV } from '../utils/exportHelpers'
import { useAuth } from '../contexts/AuthContext'
import ClassSelector from '../components/ClassSelector'
import toast from 'react-hot-toast'

const Students = () => {
  const { user } = useAuth()
  const [students, setStudents] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [classFilter, setClassFilter] = useState('')
  const [selectedClass, setSelectedClass] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [showCredentialsModal, setShowCredentialsModal] = useState(false)
  const [credentials, setCredentials] = useState(null)
  const [copiedField, setCopiedField] = useState(null)
  const [newStudentAdmissionNumber, setNewStudentAdmissionNumber] = useState(null)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    class: '',
    rollNumber: '',
    admissionDate: '',
    guardianName: '',
    guardianPhone: '',
    address: '',
    password: ''
  })

  useEffect(() => {
    fetchStudents()
  }, [selectedClass, searchQuery])

  const fetchStudents = async () => {
    try {
      setIsLoading(true)
      setError(null) // Clear previous errors
      let filters = { search: searchQuery, limit: 100 }
      
      // For teachers, filter by selected class
      if (user?.role === 'teacher' && selectedClass) {
        filters.classId = selectedClass._id
      } else if (classFilter) {
        filters.className = classFilter
      }
      
      const response = await studentsService.list(filters)
      console.log('Students API response:', response)
      
      // Handle different response formats
      const studentsData = response?.data || response?.students || response || []
      setStudents(Array.isArray(studentsData) ? studentsData : [])
      
      if (!Array.isArray(studentsData)) {
        console.warn('Unexpected students response format:', response)
      }
      
      // Clear error if we got data (even if empty)
      if (Array.isArray(studentsData)) {
        setError(null) // No error if we got a valid array response
      }
    } catch (error) {
      console.error('Error fetching students:', error)
      setError(error.response?.data?.message || 'Failed to load students. Please check your connection and try again.')
      setStudents([]) // Clear students on error
    } finally {
      setIsLoading(false)
    }
  }

  const openAdd = () => {
    setEditing(null)
    setForm({ name: '', email: '', phone: '', class: '', rollNumber: '', admissionDate: '', guardianName: '', guardianPhone: '', address: '', password: '' })
    setShowModal(true)
  }

  const openEdit = (student) => {
    setEditing(student)
    setForm({
      name: student.name || '',
      email: student.email || '',
      phone: student.phone || '',
      class: student.class || '',
      rollNumber: student.rollNumber || '',
      admissionDate: student.admissionDate ? student.admissionDate.substring(0,10) : '',
      guardianName: student.guardianName || '',
      guardianPhone: student.guardianPhone || '',
      address: student.address || '',
      password: ''
    })
    setShowModal(true)
  }

  const saveStudent = async (e) => {
    e.preventDefault()
    try {
      if (editing) {
        const { password, ...rest } = form
        const payload = password ? { ...rest, password } : rest
        await studentsService.update(editing._id || editing.id, payload)
      } else {
        // For new students, provide a default password if none is given
        const studentData = { ...form }
        
        // Ensure password is provided
        if (!studentData.password || studentData.password.trim() === '') {
          studentData.password = 'student123' // Default password for new students
        }
        
        // Format phone number - remove spaces and ensure it starts with a valid digit
        if (studentData.phone) {
          studentData.phone = studentData.phone.trim().replace(/\s+/g, '')
          // If phone doesn't start with + and starts with 0, remove leading 0 or add country code
          if (studentData.phone.startsWith('0')) {
            studentData.phone = studentData.phone.substring(1) // Remove leading 0
          }
        }
        
        // Format guardian phone similarly
        if (studentData.guardianPhone) {
          studentData.guardianPhone = studentData.guardianPhone.trim().replace(/\s+/g, '')
          if (studentData.guardianPhone.startsWith('0')) {
            studentData.guardianPhone = studentData.guardianPhone.substring(1)
          }
        }
        
        // Ensure admissionDate is in ISO format if provided
        if (studentData.admissionDate) {
          const date = new Date(studentData.admissionDate)
          if (!isNaN(date.getTime())) {
            studentData.admissionDate = date.toISOString()
          }
        }
        
        console.log('Creating student with data:', studentData)
        const response = await studentsService.create(studentData)
        
        // Show credentials and admission number if returned
        if (response?.data) {
          if (response.data.credentials) {
            setCredentials({
              ...response.data.credentials,
              admissionNumber: response.data.admissionNumber
            })
            setShowCredentialsModal(true)
          }
          if (response.data.admissionNumber) {
            setNewStudentAdmissionNumber(response.data.admissionNumber)
          }
        } else {
          toast.success('Student created successfully!')
        }
      }
      setShowModal(false)
      await fetchStudents()
    } catch (err) {
      console.error('Save student error:', err)
      console.error('Error response:', err.response?.data)
      console.error('Error status:', err.response?.status)
      console.error('Full error object:', JSON.stringify(err.response?.data || err, null, 2))
      
      // Show detailed error message
      let errorMessage = 'Failed to save student'
      if (err.response?.data) {
        const errorData = err.response.data
        console.error('Parsing error data:', errorData)
        
        // Check for validation errors array
        if (errorData.errors && Array.isArray(errorData.errors)) {
          const errorList = errorData.errors.map(e => {
            if (typeof e === 'string') return e;
            return `${e.field || e.path || 'Field'}: ${e.message || e.msg || 'Invalid value'}`;
          }).join('\n');
          errorMessage = `Validation errors:\n${errorList}`
        } else if (errorData.message) {
          errorMessage = errorData.message
          // Include error details if available
          if (errorData.error) {
            errorMessage += `\n\nDetails: ${errorData.error}`
          }
          if (errorData.details) {
            console.error('Error details:', errorData.details)
            if (errorData.details.validationErrors) {
              const validationErrors = Object.values(errorData.details.validationErrors).map(err => 
                `${err.path}: ${err.message}`
              ).join('\n');
              errorMessage += `\n\nValidation errors:\n${validationErrors}`
            }
          }
        } else if (errorData.error) {
          errorMessage = errorData.error
        }
      } else if (err.message) {
        errorMessage = err.message
      }
      
      console.error('Final error message:', errorMessage)
      alert(errorMessage)
    }
  }

  const deleteStudent = async (student) => {
    if (!window.confirm(`Delete ${student.name}?`)) return
    try {
      await studentsService.remove(student._id || student.id)
      await fetchStudents()
    } catch (err) {
      console.error('Delete student error:', err)
      alert(err?.response?.data?.message || 'Failed to delete student')
    }
  }

  const filteredStudents = students.filter(student => {
    const matchesSearch = student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (student.rollNumber && student.rollNumber.toLowerCase().includes(searchQuery.toLowerCase()))
    const matchesClass = !classFilter || student.class === classFilter
    return matchesSearch && matchesClass
  })

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
        <h1 className="text-2xl font-bold text-gray-900">Student Management</h1>
        <button className="btn btn-primary" onClick={openAdd}>
          <Plus className="h-4 w-4 mr-2" />
          Add Student
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
            onClick={() => fetchStudents()}
            className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search students..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input pl-10"
              />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 lg:gap-4">
            {user?.role === 'teacher' ? (
              <div className="sm:w-64">
                <ClassSelector
                  selectedClass={selectedClass}
                  onClassChange={setSelectedClass}
                />
              </div>
            ) : (
              <div className="sm:w-48">
                <select
                  value={classFilter}
                  onChange={(e) => setClassFilter(e.target.value)}
                  className="input"
                >
                  <option value="">All Classes</option>
                  <option value="1st Grade">1st Grade</option>
                  <option value="2nd Grade">2nd Grade</option>
                  <option value="3rd Grade">3rd Grade</option>
                  <option value="4th Grade">4th Grade</option>
                  <option value="5th Grade">5th Grade</option>
                  <option value="6th Grade">6th Grade</option>
                  <option value="7th Grade">7th Grade</option>
                  <option value="8th Grade">8th Grade</option>
                  <option value="9th Grade">9th Grade</option>
                  <option value="10th Grade">10th Grade</option>
                  <option value="11th Grade">11th Grade</option>
                  <option value="12th Grade">12th Grade</option>
                </select>
              </div>
            )}
            <button className="btn btn-outline flex-shrink-0" onClick={() => {
              const rows = [["Admission No","Name","Roll No","Class","Guardian","Guardian Phone"]].concat(
                filteredStudents.map(s => [s.admissionNumber || 'N/A', s.name, s.rollNumber, s.class, s.guardianName || '', s.guardianPhone || ''])
              )
              exportCSV('students.csv', rows)
            }}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Students table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table">
          <thead>
            <tr>
              <th>Admission No.</th>
              <th>Photo</th>
              <th>Name</th>
              <th>Roll No.</th>
              <th>Class</th>
              <th>Admission Date</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredStudents.map((student) => (
              <tr key={student._id || student.id}>
                <td>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-teal-600">
                      {student.admissionNumber || 'N/A'}
                    </span>
                    {student.admissionNumber && (
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(student.admissionNumber)
                          toast.success('Admission number copied!')
                        }}
                        className="text-gray-400 hover:text-teal-600 transition-colors"
                        title="Copy admission number"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
                <td>
                  <div className="h-10 w-10 bg-gray-200 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-gray-700">
                      {student.name.charAt(0)}
                    </span>
                  </div>
                </td>
                <td>
                  <div>
                    <div className="text-sm font-medium text-gray-900">{student.name}</div>
                    <div className="text-sm text-gray-500">{student.guardianName}</div>
                  </div>
                </td>
                <td className="text-sm text-gray-900">{student.rollNumber}</td>
                <td className="text-sm text-gray-900">{student.class}</td>
                <td className="text-sm text-gray-900">
                  {student.admissionDate ? new Date(student.admissionDate).toLocaleDateString() : 'N/A'}
                </td>
                <td>
                  <span className={`status-badge status-${student.status}`}>
                    {student.status}
                  </span>
                </td>
                <td>
                  <div className="flex space-x-2">
                    <button className="p-1 text-gray-400 hover:text-blue-600">
                      <Eye className="h-4 w-4" />
                    </button>
                    <button className="p-1 text-gray-400 hover:text-green-600" onClick={() => openEdit(student)}>
                      <Edit className="h-4 w-4" />
                    </button>
                    <button className="p-1 text-gray-400 hover:text-red-600" onClick={() => deleteStudent(student)}>
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

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-content p-4">
            <div className="flex items-center justify-between border-b border-gray-200 p-4">
              <h3 className="text-lg font-semibold text-gray-900">{editing ? 'Edit Student' : 'Add Student'}</h3>
              <button className="p-2 rounded-md hover:bg-gray-100" onClick={() => setShowModal(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <form className="p-4 space-y-4" onSubmit={saveStudent}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Full name</label>
                  <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div>
                  <label className="label">Email</label>
                  <input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required={!editing} />
                </div>
                {!editing && (
                <div>
                  <label className="label">Password (optional)</label>
                  <input 
                    type="password" 
                    className="input" 
                    value={form.password} 
                    onChange={(e) => setForm({ ...form, password: e.target.value })} 
                    placeholder="Leave empty for default password (student123)"
                  />
                </div>
                )}
                <div>
                  <label className="label">Phone</label>
                  <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="e.g., +919876543210" />
                </div>
                <div>
                  <label className="label">Class</label>
                  <input className="input" value={form.class} onChange={(e) => setForm({ ...form, class: e.target.value })} required />
                </div>
                <div>
                  <label className="label">Roll Number</label>
                  <input className="input" value={form.rollNumber} onChange={(e) => setForm({ ...form, rollNumber: e.target.value })} required />
                </div>
                <div>
                  <label className="label">Admission Date</label>
                  <input type="date" className="input" value={form.admissionDate} onChange={(e) => setForm({ ...form, admissionDate: e.target.value })} />
                </div>
                <div>
                  <label className="label">Guardian Name</label>
                  <input className="input" value={form.guardianName} onChange={(e) => setForm({ ...form, guardianName: e.target.value })} />
                </div>
                <div>
                  <label className="label">Guardian Phone</label>
                  <input className="input" value={form.guardianPhone} onChange={(e) => setForm({ ...form, guardianPhone: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                  <label className="label">Address</label>
                  <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
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
              <h3 className="text-lg font-semibold text-gray-900">Student Credentials</h3>
              <button className="p-2 rounded-md hover:bg-gray-100" onClick={() => {
                setShowCredentialsModal(false)
                setCredentials(null)
              }}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <p className="text-sm text-gray-600 mb-4">
                Please save these credentials. You can share them with the student. This information will not be shown again.
              </p>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                {credentials.admissionNumber && (
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase mb-1 block">Admission Number</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={credentials.admissionNumber}
                        className="flex-1 input bg-white font-bold"
                        onClick={(e) => e.target.select()}
                      />
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(credentials.admissionNumber)
                          setCopiedField('admissionNumber')
                          toast.success('Admission Number copied!')
                          setTimeout(() => setCopiedField(null), 2000)
                        }}
                        className="p-2 rounded hover:bg-blue-100"
                      >
                        {copiedField === 'admissionNumber' ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4 text-blue-600" />
                        )}
                      </button>
                    </div>
                  </div>
                )}
                
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

export default Students
