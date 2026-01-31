import React, { useState, useEffect } from 'react'
import { Plus, Search, Eye, Power, PowerOff, Upload } from 'lucide-react'
import { studentsService } from '../services/studentsService'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import StudentForm from '../components/students/StudentForm'
import ImportModal from '../components/ImportModal'
import ExportButton from '../components/ExportButton'
import DeactivateStudentModal from '../components/students/DeactivateStudentModal'
import toast from 'react-hot-toast'

const Students = () => {
  const { user } = useAuth()
  const navigate = useNavigate()

  // Data state
  const [students, setStudents] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // Filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [classFilter, setClassFilter] = useState('')
  const [sectionFilter, setSectionFilter] = useState('')
  const [yearFilter, setYearFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('') // active/inactive
  const [filterOptions, setFilterOptions] = useState({ classes: [], sections: [], academicYears: [] })

  // UI state
  const [showForm, setShowForm] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [showDeactivateModal, setShowDeactivateModal] = useState(false)
  const [editingStudent, setEditingStudent] = useState(null)
  const [studentToDeactivate, setStudentToDeactivate] = useState(null)
  const [selectedStudents, setSelectedStudents] = useState([])
  const [showBulkActions, setShowBulkActions] = useState(false)
  const [isDeactivating, setIsDeactivating] = useState(false)

  useEffect(() => {
    fetchStudents()
    fetchFilterOptions()
  }, [searchQuery, classFilter, sectionFilter, yearFilter, statusFilter])

  const fetchFilterOptions = async () => {
    try {
      const response = await studentsService.getFilters()
      if (response.success) {
        setFilterOptions(response.data)
      }
    } catch (error) {
      console.error('Error fetching filter options:', error)
    }
  }

  const fetchStudents = async () => {
    try {
      setIsLoading(true)
      const filters = {
        search: searchQuery,
        class: classFilter,
        section: sectionFilter,
        academicYear: yearFilter,
        status: statusFilter,
        limit: 100
      }

      const response = await studentsService.list(filters)
      const studentsData = response?.data || []
      setStudents(Array.isArray(studentsData) ? studentsData : [])
    } catch (error) {
      console.error('Error fetching students:', error)
      toast.error('Failed to load students')
      setStudents([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddStudent = () => {
    setEditingStudent(null)
    setShowForm(true)
  }

  const handleEditStudent = (student) => {
    setEditingStudent(student)
    setShowForm(true)
  }

  const handleViewStudent = (student) => {
    navigate(`/app/students/${student._id}`)
  }

  const handleSaveStudent = async (formData) => {
    try {
      setIsSaving(true)

      if (editingStudent) {
        await studentsService.update(editingStudent._id, formData)
        toast.success('Student updated successfully')
      } else {
        const response = await studentsService.create(formData)
        toast.success('Student added successfully')

        // Show credentials if returned
        if (response?.data?.credentials) {
          toast.success(`Login: ${response.data.credentials.email} / ${response.data.credentials.password}`, {
            duration: 10000
          })
        }
      }

      setShowForm(false)
      fetchStudents()
    } catch (error) {
      console.error('Save student error:', error)
      toast.error(error.response?.data?.message || 'Failed to save student')
    } finally {
      setIsSaving(false)
    }
  }

  const handleToggleStatus = async (student) => {
    if (student.isActive) {
      // Show deactivate modal
      setStudentToDeactivate(student)
      setShowDeactivateModal(true)
    } else {
      // Reactivate directly with confirmation
      if (window.confirm(`Reactivate ${student.fullName || student.name}?`)) {
        try {
          await studentsService.reactivate(student._id)
          toast.success('Student reactivated successfully')
          fetchStudents()
        } catch (error) {
          console.error('Reactivate error:', error)
          toast.error(error.response?.data?.message || 'Failed to reactivate student')
        }
      }
    }
  }

  const handleDeactivateConfirm = async (formData) => {
    try {
      setIsDeactivating(true)
      await studentsService.deactivate(studentToDeactivate._id, formData)
      toast.success('Student deactivated successfully')
      setShowDeactivateModal(false)
      setStudentToDeactivate(null)
      fetchStudents()
    } catch (error) {
      console.error('Deactivate error:', error)
      toast.error(error.response?.data?.message || 'Failed to deactivate student')
    } finally {
      setIsDeactivating(false)
    }
  }

  const handleBulkActivate = async () => {
    if (selectedStudents.length === 0) {
      toast.error('Please select students first')
      return
    }

    try {
      await studentsService.bulkActivate(selectedStudents)
      toast.success(`${selectedStudents.length} students activated`)
      setSelectedStudents([])
      fetchStudents()
    } catch (error) {
      console.error('Bulk activate error:', error)
      toast.error('Failed to activate students')
    }
  }

  const handleBulkDeactivate = async () => {
    if (selectedStudents.length === 0) {
      toast.error('Please select students first')
      return
    }

    const reason = prompt('Reason for bulk deactivation:')
    if (!reason) return

    try {
      await studentsService.bulkDeactivate(selectedStudents, reason)
      toast.success(`${selectedStudents.length} students deactivated`)
      setSelectedStudents([])
      fetchStudents()
    } catch (error) {
      console.error('Bulk deactivate error:', error)
      toast.error('Failed to deactivate students')
    }
  }

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedStudents(students.map(s => s._id))
    } else {
      setSelectedStudents([])
    }
  }

  const handleSelectStudent = (studentId) => {
    setSelectedStudents(prev =>
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    )
  }

  const handleExport = () => {
    const rows = [
      ['Admission No', 'Name', 'Roll No', 'Class', 'Section', 'Year', 'Guardian', 'Phone', 'Status']
    ].concat(
      students.map(s => [
        s.admissionNumber || 'N/A',
        s.fullName || s.name,
        s.rollNumber || '',
        s.class || '',
        s.section || '',
        s.academicYear || '',
        s.guardians?.[0]?.name || '',
        s.guardians?.[0]?.phone || '',
        s.isActive ? 'Active' : 'Inactive'
      ])
    )
    exportCSV('students.csv', rows)
    toast.success('Students exported successfully')
  }

  const clearFilters = () => {
    setSearchQuery('')
    setClassFilter('')
    setSectionFilter('')
    setYearFilter('')
    setStatusFilter('')
  }

  // if (isLoading) {
  //   return (
  //     <div className="flex items-center justify-center h-64">
  //       <div className="loading-spinner"></div>
  //     </div>
  //   )
  // }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Students</h1>
          <p className="text-sm text-gray-500 mt-1">
            {students.length} student{students.length !== 1 ? 's' : ''} found
          </p>
        </div>
        <div className="flex gap-2">
          {user?.role === 'admin' && (
            <>
              <button
                className="btn btn-outline"
                onClick={() => setShowImportModal(true)}
              >
                <Upload className="h-4 w-4 mr-2" />
                Import CSV
              </button>
              <button className="btn btn-primary" onClick={handleAddStudent}>
                <Plus className="h-4 w-4 mr-2" />
                Add Student
              </button>
            </>
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
                placeholder="Search by name, admission number, roll number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input pl-10"
              />
            </div>
          </div>

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap gap-3">
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="input w-32"
            >
              <option value="">All Classes</option>
              {filterOptions.classes.map(cls => (
                <option key={cls} value={cls}>{cls}</option>
              ))}
            </select>

            <select
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              className="input w-32"
            >
              <option value="">All Sections</option>
              {filterOptions.sections.map(sec => (
                <option key={sec} value={sec}>{sec}</option>
              ))}
            </select>

            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="input w-40"
            >
              <option value="">All Years</option>
              {filterOptions.academicYears.map(year => (
                <option key={year} value={year}>{year}</option>
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

            {(searchQuery || classFilter || sectionFilter || yearFilter || statusFilter) && (
              <button onClick={clearFilters} className="btn btn-ghost text-sm">
                Clear
              </button>
            )}

            <button
              onClick={() => {
                const params = new URLSearchParams({
                  class: classFilter,
                  section: sectionFilter,
                  academicYear: yearFilter,
                  status: statusFilter,
                  search: searchQuery
                });
                // Trigger backend download
                window.open(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/students/export?${params.toString()}&token=${localStorage.getItem('token')}`, '_blank');
              }}
              className="btn btn-outline gap-2"
            >
              <Upload className="h-4 w-4 rotate-180" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedStudents.length > 0 && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md flex items-center justify-between">
            <span className="text-sm font-medium text-blue-900">
              {selectedStudents.length} student{selectedStudents.length !== 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-2">
              <button onClick={handleBulkActivate} className="btn btn-sm btn-outline">
                <Power className="h-4 w-4 mr-1" />
                Activate
              </button>
              <button onClick={handleBulkDeactivate} className="btn btn-sm btn-outline">
                <PowerOff className="h-4 w-4 mr-1" />
                Deactivate
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Students Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th className="w-12">
                  <input
                    type="checkbox"
                    checked={selectedStudents.length === students.length && students.length > 0}
                    onChange={handleSelectAll}
                    className="rounded border-gray-300"
                  />
                </th>
                <th>Admission No.</th>
                <th>Photo</th>
                <th>Name</th>
                <th>Roll No.</th>
                <th>Class</th>
                <th>Section</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan="9" className="text-center py-12">
                    <div className="flex justify-center">
                      <div className="loading-spinner"></div>
                    </div>
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan="9" className="text-center py-12 text-gray-500">
                    No students found
                  </td>
                </tr>
              ) : (
                students.map((student) => (
                  <tr key={student._id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedStudents.includes(student._id)}
                        onChange={() => handleSelectStudent(student._id)}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td>
                      <span className="font-mono text-sm font-semibold text-teal-600">
                        {student.admissionNumber || 'N/A'}
                      </span>
                    </td>
                    <td>
                      {student.photo ? (
                        <img
                          src={student.photo}
                          alt={student.fullName}
                          className="h-10 w-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="h-10 w-10 bg-gray-200 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-gray-700">
                            {student.fullName?.charAt(0)}
                          </span>
                        </div>
                      )}
                    </td>
                    <td>
                      <div>
                        <div className="text-sm font-medium text-gray-900">{student.fullName}</div>
                        <div className="text-sm text-gray-500">{student.guardians?.[0]?.name}</div>
                      </div>
                    </td>
                    <td className="text-sm text-gray-900">{student.rollNumber || '-'}</td>
                    <td className="text-sm text-gray-900">{student.class || '-'}</td>
                    <td className="text-sm text-gray-900">{student.section || '-'}</td>
                    <td>
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${student.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                          }`}
                      >
                        {student.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleViewStudent(student)}
                          className="p-1 text-gray-400 hover:text-blue-600"
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {user?.role === 'admin' && (
                          <>
                            <button
                              onClick={() => handleToggleStatus(student)}
                              className={`p-1 text-gray-400 hover:${student.isActive ? 'text-red-600' : 'text-green-600'}`}
                              title={student.isActive ? 'Deactivate' : 'Activate'}
                            >
                              {student.isActive ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
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

      {/* Student Form Modal */}
      {showForm && (
        <StudentForm
          student={editingStudent}
          onSave={handleSaveStudent}
          onCancel={() => setShowForm(false)}
          isLoading={isSaving}
        />
      )}

      {/* Import Modal */}
      {showImportModal && (
        <ImportModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          module="students"
          title="Import Students"
          templateUrl="/students/import/template"
          previewUrl="/students/import/preview"
          executeUrl="/students/import/execute"
          onSuccess={(result) => {
            setShowImportModal(false)
            fetchStudents()
            toast.success(`Successfully imported ${result.created} students`)
          }}
        />
      )}

      {/* Deactivate Student Modal */}
      {showDeactivateModal && studentToDeactivate && (
        <DeactivateStudentModal
          student={studentToDeactivate}
          onConfirm={handleDeactivateConfirm}
          onCancel={() => {
            setShowDeactivateModal(false)
            setStudentToDeactivate(null)
          }}
          isLoading={isDeactivating}
        />
      )}
    </div>
  )
}

export default Students
