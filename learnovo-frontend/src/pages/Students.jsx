import React, { useState, useEffect } from 'react'
import { Plus, Search, Eye, Power, PowerOff, Upload, Trash2, X, CheckSquare, Square } from 'lucide-react'
import { studentsService } from '../services/studentsService'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import StudentForm from '../components/students/StudentForm'
import ImportModal from '../components/ImportModal'
import ExportButton from '../components/ExportButton'
import DeactivateStudentModal from '../components/students/DeactivateStudentModal'
import { exportPDF } from '../utils/exportHelpers'
import toast from 'react-hot-toast'
import { useSettings } from '../contexts/SettingsContext'

const Students = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { settings } = useSettings()

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
  const [driverFilter, setDriverFilter] = useState('')
  const [filterOptions, setFilterOptions] = useState({ classes: [], sections: [], academicYears: [], drivers: [] })

  // UI state
  const [showForm, setShowForm] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [showDeactivateModal, setShowDeactivateModal] = useState(false)
  const [editingStudent, setEditingStudent] = useState(null)
  const [studentToDeactivate, setStudentToDeactivate] = useState(null)
  const [selectedStudents, setSelectedStudents] = useState([])
  const [showBulkActions, setShowBulkActions] = useState(false)
  const [isDeactivating, setIsDeactivating] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [selectedFormat, setSelectedFormat] = useState('csv')

  // Export column selection — keys must match backend fieldDefinitions
  const ALL_EXPORT_FIELDS = [
    { key: 'admissionNumber', label: 'Admission No' },
    { key: 'name', label: 'Name' },
    { key: 'class', label: 'Class' },
    { key: 'section', label: 'Section' },
    { key: 'rollNumber', label: 'Roll No' },
    { key: 'academicYear', label: 'Academic Year' },
    { key: 'status', label: 'Status' },
    { key: 'fatherName', label: 'Father Name' },
    { key: 'motherName', label: 'Mother Name' },
    { key: 'mobile', label: 'Mobile' },
    { key: 'altMobile', label: 'Alt Mobile' },
    { key: 'email', label: 'Email' },
    { key: 'address', label: 'Address' },
    { key: 'dob', label: 'Date of Birth' },
    { key: 'gender', label: 'Gender' },
    { key: 'bloodGroup', label: 'Blood Group' },
    { key: 'category', label: 'Category' },
    { key: 'religion', label: 'Religion' },
    { key: 'penNumber', label: 'PEN Number' },
    { key: 'subDepartment', label: 'Sub Department' },
    { key: 'admissionDate', label: 'Admission Date' },
    { key: 'driverName', label: 'Driver' },
    { key: 'driverPhone', label: 'Driver Phone' },
    { key: 'transportMode', label: 'Transport Mode' },
  ]
  const [selectedExportFields, setSelectedExportFields] = useState(
    ['admissionNumber', 'name', 'class', 'section', 'rollNumber', 'fatherName', 'mobile', 'email', 'driverName', 'status']
  )

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [perPage, setPerPage] = useState(100)
  const [totalStudents, setTotalStudents] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  useEffect(() => {
    setCurrentPage(1) // reset to page 1 on filter change
  }, [searchQuery, classFilter, sectionFilter, yearFilter, statusFilter, driverFilter])

  useEffect(() => {
    fetchStudents()
    fetchFilterOptions()
  }, [searchQuery, classFilter, sectionFilter, yearFilter, statusFilter, driverFilter, currentPage, perPage])

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
        driver: driverFilter,
        page: currentPage,
        limit: perPage
      }

      const response = await studentsService.list(filters)
      const studentsData = response?.data || []
      setStudents(Array.isArray(studentsData) ? studentsData : [])
      if (response?.pagination) {
        setTotalStudents(response.pagination.total || 0)
        setTotalPages(response.pagination.pages || 1)
      }
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

  const handleDeleteStudent = async (student) => {
    if (window.confirm(`Are you sure you want to permanently delete ${student.fullName || student.name}? This action cannot be undone.`)) {
      try {
        await studentsService.remove(student._id)
        toast.success('Student deleted successfully')
        fetchStudents()
      } catch (error) {
        console.error('Delete error:', error)
        toast.error(error.response?.data?.message || 'Failed to delete student')
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

  const handleBulkDelete = async () => {
    if (selectedStudents.length === 0) {
      toast.error('Please select students first')
      return
    }

    if (!window.confirm(`Are you sure you want to PERMANENTLY DELETE ${selectedStudents.length} student(s)? This cannot be undone.`)) {
      return
    }

    try {
      const result = await studentsService.bulkDelete(selectedStudents)
      toast.success(result.message || `${selectedStudents.length} students deleted`)
      setSelectedStudents([])
      fetchStudents()
    } catch (error) {
      console.error('Bulk delete error:', error)
      toast.error(error.response?.data?.message || 'Failed to delete students')
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
    setShowExportModal(true)
  }

  const handleDoExport = async () => {
    const params = new URLSearchParams()
    if (classFilter) params.set('class', classFilter)
    if (sectionFilter) params.set('section', sectionFilter)
    if (yearFilter) params.set('academicYear', yearFilter)
    if (statusFilter) params.set('status', statusFilter)
    if (searchQuery) params.set('search', searchQuery)
    if (driverFilter) params.set('driverId', driverFilter)
    if (selectedExportFields.length > 0) {
      params.set('fields', selectedExportFields.join(','))
    }
    const token = localStorage.getItem('token')
    const base = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
    const dateStr = new Date().toISOString().split('T')[0]

    if (selectedFormat === 'pdf') {
      // PDF: fetch data as JSON then generate client-side
      try {
        toast.loading('Generating PDF…', { id: 'pdf-export' })
        const res = await fetch(`${base}/students/export?${params.toString()}&format=json&token=${token}`)
        const json = await res.json()
        if (!json.success) throw new Error(json.message)
        await exportPDF(`students_export_${dateStr}.pdf`, json.headers, json.rows, settings?.institution)
        toast.success('PDF downloaded!', { id: 'pdf-export' })
      } catch (err) {
        console.error('PDF export error:', err)
        toast.error('Failed to generate PDF', { id: 'pdf-export' })
      }
    } else {
      // CSV / Excel / TXT: let backend stream the file
      params.set('format', selectedFormat)
      window.open(`${base}/students/export?${params.toString()}&token=${token}`, '_blank')
    }

    setShowExportModal(false)
  }

  const toggleExportField = (key) => {
    setSelectedExportFields(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  const clearFilters = () => {
    setSearchQuery('')
    setClassFilter('')
    setSectionFilter('')
    setYearFilter('')
    setStatusFilter('')
    setDriverFilter('')
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
        {/* Search Bar */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, admission number, roll number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-10"
          />
        </div>

        {/* Filter Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Filters:</span>

          {/* Class Filter */}
          <div className="relative">
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="appearance-none h-8 pl-3 pr-8 text-xs font-medium rounded-md border border-gray-300 bg-white hover:bg-gray-50 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all cursor-pointer"
            >
              <option value="">Class</option>
              {filterOptions.classes.map(cls => (
                <option key={cls} value={cls}>{cls}</option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
              <svg className="h-3 w-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {/* Section Filter */}
          <div className="relative">
            <select
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              className="appearance-none h-8 pl-3 pr-8 text-xs font-medium rounded-md border border-gray-300 bg-white hover:bg-gray-50 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all cursor-pointer"
            >
              <option value="">Section</option>
              {filterOptions.sections.map(sec => (
                <option key={sec} value={sec}>{sec}</option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
              <svg className="h-3 w-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {/* Year Filter */}
          <div className="relative">
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="appearance-none h-8 pl-3 pr-8 text-xs font-medium rounded-md border border-gray-300 bg-white hover:bg-gray-50 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all cursor-pointer"
            >
              <option value="">Year</option>
              {filterOptions.academicYears.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
              <svg className="h-3 w-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {/* Status Filter */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="appearance-none h-8 pl-3 pr-8 text-xs font-medium rounded-md border border-gray-300 bg-white hover:bg-gray-50 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all cursor-pointer"
            >
              <option value="">Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
              <svg className="h-3 w-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {/* Driver Filter */}
          {filterOptions.drivers && filterOptions.drivers.length > 0 && (
            <div className="relative">
              <select
                value={driverFilter}
                onChange={(e) => setDriverFilter(e.target.value)}
                className="appearance-none h-8 pl-3 pr-8 text-xs font-medium rounded-md border border-gray-300 bg-white hover:bg-gray-50 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all cursor-pointer"
              >
                <option value="">Driver</option>
                {filterOptions.drivers.map(driver => (
                  <option key={driver._id} value={driver._id}>{driver.name}</option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                <svg className="h-3 w-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          )}

          {/* Clear Filters Button */}
          {(searchQuery || classFilter || sectionFilter || yearFilter || statusFilter || driverFilter) && (
            <button
              onClick={clearFilters}
              className="h-8 px-3 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-all"
            >
              Clear all
            </button>
          )}

          {/* Spacer */}
          <div className="flex-1"></div>

          {/* Export Button */}
          <button
            onClick={handleExport}
            className="h-8 px-3 text-xs font-medium text-primary-600 border border-primary-600 hover:bg-primary-50 rounded-md transition-all inline-flex items-center gap-1.5"
          >
            <Upload className="h-3.5 w-3.5 rotate-180" />
            <span>Export</span>
          </button>
        </div>

        {/* ── Export Options Modal ── */}
        {showExportModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col max-h-[90vh]">
              <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
                <h3 className="text-base font-semibold text-gray-900">Export Options</h3>
                <button onClick={() => setShowExportModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto">
                {/* Active filters summary */}
                <div className="px-6 pt-4">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Active Filters (applied to export)</p>
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {!classFilter && !sectionFilter && !yearFilter && !statusFilter && !driverFilter && !searchQuery && (
                      <span className="text-xs text-gray-400 italic">None — will export all students</span>
                    )}
                    {classFilter && <span className="px-2 py-0.5 bg-primary-50 text-primary-700 text-xs rounded-full">Class: {classFilter}</span>}
                    {sectionFilter && <span className="px-2 py-0.5 bg-primary-50 text-primary-700 text-xs rounded-full">Section: {sectionFilter}</span>}
                    {yearFilter && <span className="px-2 py-0.5 bg-primary-50 text-primary-700 text-xs rounded-full">Year: {yearFilter}</span>}
                    {statusFilter && <span className="px-2 py-0.5 bg-primary-50 text-primary-700 text-xs rounded-full">Status: {statusFilter}</span>}
                    {driverFilter && <span className="px-2 py-0.5 bg-primary-50 text-primary-700 text-xs rounded-full">Driver: {filterOptions.drivers?.find(d => d._id === driverFilter)?.name || driverFilter}</span>}
                    {searchQuery && <span className="px-2 py-0.5 bg-primary-50 text-primary-700 text-xs rounded-full">Search: {searchQuery}</span>}
                  </div>
                </div>

                {/* Format selection */}
                <div className="px-6 pb-4">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Export Format</p>
                  <div className="flex gap-2 mb-4">
                    {[
                      { id: 'csv', label: '📄 CSV', desc: 'Spreadsheet-compatible' },
                      { id: 'excel', label: '📊 Excel', desc: '.xlsx file' },
                      { id: 'pdf', label: '🖨️ PDF', desc: 'Print-ready' },
                      { id: 'txt', label: '📝 TXT', desc: 'Tab-delimited text' },
                    ].map(fmt => (
                      <button
                        key={fmt.id}
                        onClick={() => setSelectedFormat(fmt.id)}
                        title={fmt.desc}
                        className={`flex-1 py-2 text-xs font-semibold rounded-lg border-2 transition-all ${selectedFormat === fmt.id
                          ? 'border-primary-500 bg-primary-50 text-primary-700'
                          : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                          }`}
                      >
                        {fmt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Column selection */}
                <div className="px-6 pb-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Select Columns</p>
                    <div className="flex gap-2">
                      <button onClick={() => setSelectedExportFields(ALL_EXPORT_FIELDS.map(f => f.key))} className="text-xs text-primary-600 hover:underline">All</button>
                      <span className="text-gray-300">|</span>
                      <button onClick={() => setSelectedExportFields([])} className="text-xs text-gray-400 hover:underline">None</button>
                    </div>
                  </div>

                  {/* Presets */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {[
                      { label: '📋 Basic', fields: ['admissionNumber', 'name', 'class', 'section', 'rollNumber', 'status'] },
                      { label: '📞 Contact', fields: ['admissionNumber', 'name', 'fatherName', 'motherName', 'mobile', 'altMobile', 'email', 'address'] },
                      { label: '🚌 Transport', fields: ['admissionNumber', 'name', 'class', 'section', 'driverName', 'driverPhone', 'transportMode'] },
                      { label: '🎓 Academic', fields: ['admissionNumber', 'name', 'class', 'section', 'rollNumber', 'academicYear', 'penNumber', 'subDepartment'] },
                    ].map(preset => (
                      <button
                        key={preset.label}
                        onClick={() => setSelectedExportFields(preset.fields)}
                        className="px-2.5 py-1 text-xs font-medium border border-gray-200 rounded-full hover:border-primary-400 hover:bg-primary-50 hover:text-primary-700 transition-colors"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-1 max-h-52 overflow-y-auto pr-1">
                    {ALL_EXPORT_FIELDS.map(field => (
                      <label key={field.key} className="flex items-center gap-2 cursor-pointer p-1.5 rounded hover:bg-gray-50">
                        <input
                          type="checkbox"
                          checked={selectedExportFields.includes(field.key)}
                          onChange={() => toggleExportField(field.key)}
                          className="h-3.5 w-3.5 text-primary-600 rounded"
                        />
                        <span className="text-sm text-gray-700">{field.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="shrink-0 flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-xl">
                <button onClick={() => setShowExportModal(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100">Cancel</button>
                <button
                  onClick={handleDoExport}
                  disabled={selectedExportFields.length === 0}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Export {selectedExportFields.length} Column{selectedExportFields.length !== 1 ? 's' : ''} as {selectedFormat.toUpperCase()}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Active Filters Display */}
        {(classFilter || sectionFilter || yearFilter || statusFilter || driverFilter) && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-gray-500">Active filters:</span>
              {classFilter && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary-50 text-primary-700 text-xs font-medium rounded-full">
                  Class: {classFilter}
                  <button
                    onClick={() => setClassFilter('')}
                    className="hover:bg-primary-100 rounded-full p-0.5 transition-colors"
                  >
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              )}
              {sectionFilter && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary-50 text-primary-700 text-xs font-medium rounded-full">
                  Section: {sectionFilter}
                  <button
                    onClick={() => setSectionFilter('')}
                    className="hover:bg-primary-100 rounded-full p-0.5 transition-colors"
                  >
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              )}
              {yearFilter && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary-50 text-primary-700 text-xs font-medium rounded-full">
                  Year: {yearFilter}
                  <button
                    onClick={() => setYearFilter('')}
                    className="hover:bg-primary-100 rounded-full p-0.5 transition-colors"
                  >
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              )}
              {statusFilter && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary-50 text-primary-700 text-xs font-medium rounded-full">
                  Status: {statusFilter === 'active' ? 'Active' : 'Inactive'}
                  <button
                    onClick={() => setStatusFilter('')}
                    className="hover:bg-primary-100 rounded-full p-0.5 transition-colors"
                  >
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              )}
              {driverFilter && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary-50 text-primary-700 text-xs font-medium rounded-full">
                  Driver: {filterOptions.drivers.find(d => d._id === driverFilter)?.name || driverFilter}
                  <button
                    onClick={() => setDriverFilter('')}
                    className="hover:bg-primary-100 rounded-full p-0.5 transition-colors"
                  >
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              )}
            </div>
          </div>
        )}

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
              {user?.role === 'admin' && (
                <button
                  onClick={handleBulkDelete}
                  className="btn btn-sm bg-red-600 text-white hover:bg-red-700 border-red-600"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete Selected
                </button>
              )}
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
                        <div className="h-10 w-10 bg-gradient-to-br from-teal-400 to-teal-700 rounded-full flex items-center justify-center">
                          <span className="text-sm font-semibold text-white">
                            {student.fullName?.charAt(0).toUpperCase()}
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
                              className={`p-1 text-gray-400 hover:${student.isActive ? 'text-orange-500' : 'text-green-600'}`}
                              title={student.isActive ? 'Deactivate' : 'Activate'}
                            >
                              {student.isActive ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                            </button>
                            <button
                              onClick={() => handleDeleteStudent(student)}
                              className="p-1 text-gray-400 hover:text-red-600"
                              title="Delete Permanently"
                            >
                              <Trash2 className="h-4 w-4" />
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
        <div className="mt-4 flex items-center justify-between px-1">
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <span>
              Showing {((currentPage - 1) * perPage) + 1}–{Math.min(currentPage * perPage, totalStudents)} of <strong>{totalStudents}</strong> students
            </span>
            <select
              value={perPage}
              onChange={(e) => { setPerPage(Number(e.target.value)); setCurrentPage(1); }}
              className="border border-gray-300 rounded px-2 py-1 text-sm"
            >
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
              <option value={200}>200 / page</option>
              <option value={500}>500 / page</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ← Previous
            </button>
            <span className="text-sm text-gray-600">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </div>
        </div>
      )}

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
