import React, { useState, useMemo, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Plus, Search, Eye, Edit3, Power, PowerOff, Upload, Trash2, X, TrendingUp, AlertTriangle, RefreshCw } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { studentsService } from '../services/studentsService'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate, useSearchParams } from 'react-router-dom'
import StudentForm from '../components/students/StudentForm'
import ImportModal from '../components/ImportModal'
import DeactivateStudentModal from '../components/students/DeactivateStudentModal'
import { exportPDF, exportExcel } from '../utils/exportHelpers'
import toast from 'react-hot-toast'
import { useSettings } from '../contexts/SettingsContext'

import { SERVER_URL } from '../constants/config'
import { formatDate } from '../utils/formatDate'

const StudentPhotoCell = ({ student }) => {
  const [imgFailed, setImgFailed] = React.useState(false)
  const photoUrl = student.photo
    ? (student.photo.startsWith('http') ? student.photo : `${SERVER_URL}${student.photo}`)
    : null

  if (photoUrl && !imgFailed) {
    return (
      <img
        src={photoUrl}
        alt={student.fullName}
        className="h-10 w-10 rounded-full object-cover"
        onError={() => setImgFailed(true)}
      />
    )
  }

  return (
    <div className="h-10 w-10 bg-gradient-to-br from-teal-400 to-teal-700 rounded-full flex items-center justify-center">
      <span className="text-sm font-semibold text-white">
        {student.fullName?.charAt(0).toUpperCase() || 'U'}
      </span>
    </div>
  )
}

const Students = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { settings } = useSettings()

  const queryClient = useQueryClient()

  // Filter state — initialize from URL params (e.g. ?class=5A from dashboard)
  const [searchQuery, setSearchQuery] = useState('')
  const [classFilter, setClassFilter] = useState(searchParams.get('class') || '')
  const [sectionFilter, setSectionFilter] = useState('')
  const [yearFilter, setYearFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('') // active/inactive
  const [driverFilter, setDriverFilter] = useState('')

  // UI state
  const [showForm, setShowForm] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [showDeactivateModal, setShowDeactivateModal] = useState(false)
  const [editingStudent, setEditingStudent] = useState(null)
  const [studentToDeactivate, setStudentToDeactivate] = useState(null)
  const [selectedStudents, setSelectedStudents] = useState([])
  const [showExportModal, setShowExportModal] = useState(false)
  const [selectedFormat, setSelectedFormat] = useState('pdf')

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

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const searchTimerRef = useRef(null)

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery)
    }, 400)
    return () => clearTimeout(searchTimerRef.current)
  }, [searchQuery])

  useEffect(() => {
    setCurrentPage(1) // reset to page 1 on filter change
    setSelectedStudents([]) // clear selection on filter change
  }, [debouncedSearch, classFilter, sectionFilter, yearFilter, statusFilter, driverFilter])

  // Fetch filter options once on mount
  const { data: filterOptions = { classes: [], sections: [], academicYears: [], drivers: [] } } = useQuery({
    queryKey: ['students-filters'],
    queryFn: async () => {
      const response = await studentsService.getFilters()
      if (response.success) return response.data
      return { classes: [], sections: [], academicYears: [], drivers: [] }
    },
    staleTime: 5 * 60 * 1000,
  })

  // Fetch students with React Query
  const { data: studentsResponse, isLoading, error: studentsError, refetch: refetchStudents } = useQuery({
    queryKey: ['students', debouncedSearch, classFilter, sectionFilter, yearFilter, statusFilter, driverFilter, currentPage, perPage],
    queryFn: async () => {
      const filters = {
        search: debouncedSearch,
        class: classFilter,
        section: sectionFilter,
        academicYear: yearFilter,
        status: statusFilter,
        driver: driverFilter,
        page: currentPage,
        limit: perPage
      }
      const response = await studentsService.list(filters)
      return response
    },
    placeholderData: (prev) => prev,
    staleTime: 0,
  })

  const students = useMemo(() => {
    const studentsData = studentsResponse?.data || []
    return Array.isArray(studentsData) ? studentsData : []
  }, [studentsResponse])

  const totalStudents = studentsResponse?.pagination?.total || 0
  const totalPages = studentsResponse?.pagination?.pages || 1

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

  const saveMutation = useMutation({
    mutationFn: async (formData) => {
      if (editingStudent) {
        await studentsService.update(editingStudent._id, formData)
        return { isEdit: true }
      } else {
        const response = await studentsService.create(formData)
        return { isEdit: false, response }
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['students'] })
      if (result.isEdit) {
        toast.success('Student updated successfully')
      } else {
        toast.success('Student added successfully')
        if (result.response?.data?.credentials) {
          toast.success(`Login: ${result.response.data.credentials.email} / ${result.response.data.credentials.password}`, {
            duration: 10000
          })
        }
      }
      setShowForm(false)
    },
    onError: (error) => {
      const data = error.response?.data
      if (data?.errors && Array.isArray(data.errors)) {
        const msgs = data.errors.map(e => e.msg || e.message).filter(Boolean)
        if (msgs.length) {
          msgs.forEach(msg => toast.error(msg, { duration: 5000 }))
          return
        }
      }
      toast.error(data?.message || 'Failed to save student')
    },
  })

  const handleSaveStudent = (formData) => {
    saveMutation.mutate(formData)
  }

  const reactivateMutation = useMutation({
    mutationFn: (studentId) => studentsService.reactivate(studentId),
    onMutate: async (studentId) => {
      await queryClient.cancelQueries({ queryKey: ['students'] })
      const queryKey = ['students', debouncedSearch, classFilter, sectionFilter, yearFilter, statusFilter, driverFilter, currentPage, perPage]
      const previous = queryClient.getQueryData(queryKey)
      queryClient.setQueryData(queryKey, (old) => {
        if (!old?.data) return old
        // If filtering by "inactive", remove from list; otherwise flip the flag
        const shouldRemove = statusFilter === 'inactive'
        return {
          ...old,
          data: shouldRemove
            ? old.data.filter(s => s._id !== studentId)
            : old.data.map(s => s._id === studentId
              ? { ...s, isActive: true, removalDate: null, removalReason: null, inactivatedAt: null }
              : s
            ),
          ...(shouldRemove && old.pagination ? { pagination: { ...old.pagination, total: Math.max(0, (old.pagination.total || 0) - 1) } } : {})
        }
      })
      return { previous, queryKey }
    },
    onSuccess: () => {
      toast.success('Student reactivated successfully')
    },
    onError: (error, _, context) => {
      if (context?.previous) queryClient.setQueryData(context.queryKey, context.previous)
      toast.error(error.response?.data?.message || 'Failed to reactivate student')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] })
      queryClient.invalidateQueries({ queryKey: ['students-filters'] })
    },
  })

  const handleToggleStatus = (student) => {
    if (student.isActive) {
      setStudentToDeactivate(student)
      setShowDeactivateModal(true)
    } else {
      if (window.confirm(`Reactivate ${student.fullName || student.name}?`)) {
        reactivateMutation.mutate(student._id)
      }
    }
  }

  const deleteMutation = useMutation({
    mutationFn: (studentId) => studentsService.remove(studentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] })
      toast.success('Student deleted successfully')
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to delete student')
    },
  })

  const handleDeleteStudent = (student) => {
    if (window.confirm(`Are you sure you want to permanently delete ${student.fullName || student.name}? This action cannot be undone.`)) {
      deleteMutation.mutate(student._id)
    }
  }

  const deactivateMutation = useMutation({
    mutationFn: ({ studentId, formData }) => studentsService.deactivate(studentId, formData),
    onMutate: async ({ studentId, formData }) => {
      await queryClient.cancelQueries({ queryKey: ['students'] })
      const queryKey = ['students', debouncedSearch, classFilter, sectionFilter, yearFilter, statusFilter, driverFilter, currentPage, perPage]
      const previous = queryClient.getQueryData(queryKey)
      queryClient.setQueryData(queryKey, (old) => {
        if (!old?.data) return old
        // If filtering by "active", remove from list; otherwise flip the flag
        const shouldRemove = statusFilter === 'active'
        return {
          ...old,
          data: shouldRemove
            ? old.data.filter(s => s._id !== studentId)
            : old.data.map(s => s._id === studentId
              ? { ...s, isActive: false, removalDate: formData.removalDate || new Date().toISOString(), removalReason: formData.removalReason, inactivatedAt: new Date().toISOString() }
              : s
            ),
          ...(shouldRemove && old.pagination ? { pagination: { ...old.pagination, total: Math.max(0, (old.pagination.total || 0) - 1) } } : {})
        }
      })
      return { previous, queryKey }
    },
    onSuccess: () => {
      toast.success('Student deactivated successfully')
      setShowDeactivateModal(false)
      setStudentToDeactivate(null)
    },
    onError: (error, _, context) => {
      if (context?.previous) queryClient.setQueryData(context.queryKey, context.previous)
      toast.error(error.response?.data?.message || 'Failed to deactivate student')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] })
      queryClient.invalidateQueries({ queryKey: ['students-filters'] })
    },
  })

  const handleDeactivateConfirm = (formData) => {
    deactivateMutation.mutate({ studentId: studentToDeactivate._id, formData })
  }

  const bulkActivateMutation = useMutation({
    mutationFn: (ids) => studentsService.bulkActivate(ids),
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: ['students'] })
      const queryKey = ['students', debouncedSearch, classFilter, sectionFilter, yearFilter, statusFilter, driverFilter, currentPage, perPage]
      const previous = queryClient.getQueryData(queryKey)
      const idSet = new Set(ids)
      const shouldRemove = statusFilter === 'inactive'
      queryClient.setQueryData(queryKey, (old) => {
        if (!old?.data) return old
        return {
          ...old,
          data: shouldRemove
            ? old.data.filter(s => !idSet.has(s._id))
            : old.data.map(s => idSet.has(s._id)
              ? { ...s, isActive: true, removalDate: null, removalReason: null, inactivatedAt: null }
              : s
            ),
          ...(shouldRemove && old.pagination ? { pagination: { ...old.pagination, total: Math.max(0, (old.pagination.total || 0) - ids.length) } } : {})
        }
      })
      return { previous, queryKey }
    },
    onSuccess: () => {
      toast.success(`${selectedStudents.length} students activated`)
      setSelectedStudents([])
    },
    onError: (_, __, context) => {
      if (context?.previous) queryClient.setQueryData(context.queryKey, context.previous)
      toast.error('Failed to activate students')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['students'], refetchType: 'active' })
      queryClient.invalidateQueries({ queryKey: ['students-filters'], refetchType: 'active' })
    },
  })

  const handleBulkActivate = () => {
    if (selectedStudents.length === 0) {
      toast.error('Please select students first')
      return
    }
    bulkActivateMutation.mutate(selectedStudents)
  }

  const bulkDeactivateMutation = useMutation({
    mutationFn: ({ ids, reason }) => studentsService.bulkDeactivate(ids, reason),
    onMutate: async ({ ids }) => {
      await queryClient.cancelQueries({ queryKey: ['students'] })
      const queryKey = ['students', debouncedSearch, classFilter, sectionFilter, yearFilter, statusFilter, driverFilter, currentPage, perPage]
      const previous = queryClient.getQueryData(queryKey)
      const idSet = new Set(ids)
      const shouldRemove = statusFilter === 'active'
      queryClient.setQueryData(queryKey, (old) => {
        if (!old?.data) return old
        return {
          ...old,
          data: shouldRemove
            ? old.data.filter(s => !idSet.has(s._id))
            : old.data.map(s => idSet.has(s._id)
              ? { ...s, isActive: false, inactivatedAt: new Date().toISOString() }
              : s
            ),
          ...(shouldRemove && old.pagination ? { pagination: { ...old.pagination, total: Math.max(0, (old.pagination.total || 0) - ids.length) } } : {})
        }
      })
      return { previous, queryKey }
    },
    onSuccess: () => {
      toast.success(`${selectedStudents.length} students deactivated`)
      setSelectedStudents([])
    },
    onError: (_, __, context) => {
      if (context?.previous) queryClient.setQueryData(context.queryKey, context.previous)
      toast.error('Failed to deactivate students')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['students'], refetchType: 'active' })
      queryClient.invalidateQueries({ queryKey: ['students-filters'], refetchType: 'active' })
    },
  })

  const handleBulkDeactivate = () => {
    if (selectedStudents.length === 0) {
      toast.error('Please select students first')
      return
    }
    const reason = prompt('Reason for bulk deactivation:')
    if (!reason) return
    bulkDeactivateMutation.mutate({ ids: selectedStudents, reason })
  }

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids) => studentsService.bulkDelete(ids),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['students'] })
      toast.success(result.message || `${selectedStudents.length} students deleted`)
      setSelectedStudents([])
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to delete students')
    },
  })

  const handleBulkDelete = () => {
    if (selectedStudents.length === 0) {
      toast.error('Please select students first')
      return
    }
    if (!window.confirm(`Are you sure you want to PERMANENTLY DELETE ${selectedStudents.length} student(s)? This cannot be undone.`)) {
      return
    }
    bulkDeleteMutation.mutate(selectedStudents)
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
    if (debouncedSearch) params.set('search', debouncedSearch)
    if (driverFilter) params.set('driverId', driverFilter)
    if (selectedExportFields.length > 0) {
      params.set('fields', selectedExportFields.join(','))
    }
    const token = localStorage.getItem('token')
    const base = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
    const dateStr = new Date().toISOString().split('T')[0]

    const exportId = `${selectedFormat}-export`
    try {
      toast.loading(`Generating ${selectedFormat.toUpperCase()}…`, { id: exportId })
      const res = await fetch(`${base}/students/export?${params.toString()}&format=json&token=${token}`)
      const json = await res.json()
      if (!json.success) throw new Error(json.message)

      if (selectedFormat === 'pdf') {
        await exportPDF(`students_export_${dateStr}.pdf`, json.headers, json.rows, settings?.institution)
      } else {
        // Excel: build rows array with headers as first row
        const excelRows = [json.headers, ...json.rows]
        exportExcel(`students_export_${dateStr}.xlsx`, excelRows, 'Students')
      }
      toast.success(`${selectedFormat.toUpperCase()} downloaded!`, { id: exportId })
    } catch (err) {
      toast.error(`Failed to generate ${selectedFormat.toUpperCase()}`, { id: exportId })
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

  // O(1) lookup for checked state — avoids O(n) Array.includes per table row
  const selectedSet = useMemo(() => new Set(selectedStudents), [selectedStudents])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Students</h1>
          <p className="text-sm text-gray-500 dark:text-[#8E8E93] mt-1">
            {totalStudents} student{totalStudents !== 1 ? 's' : ''} found
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {user?.role === 'admin' && (
            <>
              <button
                className="btn btn-outline text-gray-700 dark:text-[#8E8E93]"
                onClick={() => navigate('/app/academic/promotion')}
              >
                <TrendingUp className="h-4 w-4 mr-2" />
                Manage Promotions
              </button>
              <button
                className="btn btn-outline text-gray-700 dark:text-[#8E8E93]"
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

      {/* Error Message */}
      {studentsError && (
        <div className="bg-red-50 dark:bg-red-500/10 border border-red-200/60 dark:border-red-500/20 rounded-2xl p-4 animate-fade-in">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mr-2 flex-shrink-0" />
            <p className="text-sm text-red-700 dark:text-red-400">{studentsError.response?.data?.message || 'Failed to load students. Please check your connection and try again.'}</p>
          </div>
          <button
            onClick={() => refetchStudents()}
            className="mt-2 inline-flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 underline"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Try again
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="card p-4">
        {/* Search Bar */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-[#636366]" />
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
          <span className="text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wide">Filters:</span>

          {/* Class Filter */}
          <div className="relative">
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="appearance-none h-8 pl-3 pr-8 text-xs font-medium rounded-md border border-gray-300 dark:border-[#38383A] bg-white dark:bg-[#1C1C1E] hover:bg-gray-50 dark:hover:bg-[#2C2C2E] hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all cursor-pointer"
            >
              <option value="">Class</option>
              {filterOptions.classes.map(cls => (
                <option key={cls} value={cls}>{cls}</option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
              <svg className="h-3 w-3 text-gray-400 dark:text-[#636366]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {/* Section Filter */}
          <div className="relative">
            <select
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              className="appearance-none h-8 pl-3 pr-8 text-xs font-medium rounded-md border border-gray-300 dark:border-[#38383A] bg-white dark:bg-[#1C1C1E] hover:bg-gray-50 dark:hover:bg-[#2C2C2E] hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all cursor-pointer"
            >
              <option value="">Section</option>
              {filterOptions.sections.map(sec => (
                <option key={sec} value={sec}>{sec}</option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
              <svg className="h-3 w-3 text-gray-400 dark:text-[#636366]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {/* Year Filter */}
          <div className="relative">
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="appearance-none h-8 pl-3 pr-8 text-xs font-medium rounded-md border border-gray-300 dark:border-[#38383A] bg-white dark:bg-[#1C1C1E] hover:bg-gray-50 dark:hover:bg-[#2C2C2E] hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all cursor-pointer"
            >
              <option value="">Year</option>
              {filterOptions.academicYears.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
              <svg className="h-3 w-3 text-gray-400 dark:text-[#636366]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {/* Status Filter */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="appearance-none h-8 pl-3 pr-8 text-xs font-medium rounded-md border border-gray-300 dark:border-[#38383A] bg-white dark:bg-[#1C1C1E] hover:bg-gray-50 dark:hover:bg-[#2C2C2E] hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all cursor-pointer"
            >
              <option value="">Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
              <svg className="h-3 w-3 text-gray-400 dark:text-[#636366]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                className="appearance-none h-8 pl-3 pr-8 text-xs font-medium rounded-md border border-gray-300 dark:border-[#38383A] bg-white dark:bg-[#1C1C1E] hover:bg-gray-50 dark:hover:bg-[#2C2C2E] hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all cursor-pointer"
              >
                <option value="">Driver</option>
                {filterOptions.drivers.map(driver => (
                  <option key={driver._id} value={driver._id}>{driver.name}</option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                <svg className="h-3 w-3 text-gray-400 dark:text-[#636366]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          )}

          {/* Clear Filters Button */}
          {(searchQuery || classFilter || sectionFilter || yearFilter || statusFilter || driverFilter) && (
            <button
              onClick={clearFilters}
              className="h-8 px-3 text-xs font-medium text-gray-600 dark:text-[#8E8E93] hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#2C2C2E] rounded-md transition-all"
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
        {showExportModal && createPortal(
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
            <div className="bg-white dark:bg-[#1C1C1E] rounded-xl shadow-xl w-full max-w-md flex flex-col max-h-[90vh]">
              <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">Export Options</h3>
                <button onClick={() => setShowExportModal(false)} className="text-gray-400 hover:text-gray-600 dark:text-[#8E8E93]">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto">
                {/* Active filters summary */}
                <div className="px-6 pt-4">
                  <p className="text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wide mb-2">Active Filters (applied to export)</p>
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
                  <p className="text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wide mb-2">Export Format</p>
                  <div className="flex gap-2 mb-4">
                    {[
                      { id: 'pdf', label: 'PDF', desc: 'Print-ready document' },
                      { id: 'excel', label: 'Excel', desc: '.xlsx spreadsheet' },
                    ].map(fmt => (
                      <button
                        key={fmt.id}
                        onClick={() => setSelectedFormat(fmt.id)}
                        title={fmt.desc}
                        className={`flex-1 py-2 text-xs font-semibold rounded-lg border-2 transition-all ${selectedFormat === fmt.id
                          ? 'border-primary-500 bg-primary-50 text-primary-700'
                          : 'border-gray-200 dark:border-[#38383A] text-gray-500 dark:text-[#8E8E93] hover:border-gray-300 dark:border-[#38383A] hover:bg-gray-50 dark:hover:bg-[#2C2C2E]'
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
                    <p className="text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wide">Select Columns</p>
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
                        className="px-2.5 py-1 text-xs font-medium border border-gray-200 dark:border-[#38383A] rounded-full hover:border-primary-400 hover:bg-primary-50 hover:text-primary-700 transition-colors"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-1 max-h-52 overflow-y-auto pr-1">
                    {ALL_EXPORT_FIELDS.map(field => (
                      <label key={field.key} className="flex items-center gap-2 cursor-pointer p-1.5 rounded hover:bg-gray-50 dark:hover:bg-[#2C2C2E]">
                        <input
                          type="checkbox"
                          checked={selectedExportFields.includes(field.key)}
                          onChange={() => toggleExportField(field.key)}
                          className="h-3.5 w-3.5 text-primary-600 rounded"
                        />
                        <span className="text-sm text-gray-700 dark:text-[#8E8E93]">{field.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="shrink-0 flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 dark:bg-[#000000] rounded-b-xl">
                <button onClick={() => setShowExportModal(false)} className="btn btn-ghost">Cancel</button>
                <button
                  onClick={handleDoExport}
                  disabled={selectedExportFields.length === 0}
                  className="btn btn-primary"
                >
                  Export {selectedExportFields.length} Column{selectedExportFields.length !== 1 ? 's' : ''} as {selectedFormat.toUpperCase()}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Active Filters Display */}
        {(classFilter || sectionFilter || yearFilter || statusFilter || driverFilter) && (
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-[#38383A]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-gray-500 dark:text-[#8E8E93]">Active filters:</span>
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

        {/* Bulk Actions — Admin only */}
        {user?.role === 'admin' && selectedStudents.length > 0 && (
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span className="text-sm font-medium text-blue-900 dark:text-blue-300">
              {selectedStudents.length} student{selectedStudents.length !== 1 ? 's' : ''} selected
            </span>
            <div className="flex flex-wrap gap-2">
              <button onClick={handleBulkActivate} className="btn btn-sm btn-outline w-full sm:w-auto">
                <Power className="h-4 w-4 mr-1" />
                Activate
              </button>
              <button onClick={handleBulkDeactivate} className="btn btn-sm btn-outline w-full sm:w-auto">
                <PowerOff className="h-4 w-4 mr-1" />
                Deactivate
              </button>
              <button
                onClick={handleBulkDelete}
                className="btn btn-sm bg-red-600 text-white hover:bg-red-700 border-red-600 w-full sm:w-auto"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete Selected
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Students Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table min-w-[700px]">
            <thead>
              <tr>
                {user?.role === 'admin' && (
                  <th className="w-12">
                    <input
                      type="checkbox"
                      checked={selectedStudents.length === students.length && students.length > 0}
                      onChange={handleSelectAll}
                      className="rounded border-gray-300 dark:border-[#38383A]"
                    />
                  </th>
                )}
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
                  <td colSpan={user?.role === 'admin' ? 9 : 8} className="text-center py-12">
                    <div className="flex justify-center">
                      <div className="loading-spinner"></div>
                    </div>
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={user?.role === 'admin' ? 9 : 8} className="text-center py-12 text-gray-500 dark:text-[#8E8E93]">
                    No students found
                  </td>
                </tr>
              ) : (
                students.map((student) => (
                  <tr key={student._id}>
                    {user?.role === 'admin' && (
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedSet.has(student._id)}
                          onChange={() => handleSelectStudent(student._id)}
                          className="rounded border-gray-300 dark:border-[#38383A]"
                        />
                      </td>
                    )}
                    <td>
                      <span className="font-mono text-sm font-semibold text-teal-600">
                        {student.admissionNumber || 'N/A'}
                      </span>
                    </td>
                    <td>
                      <StudentPhotoCell student={student} />
                    </td>
                    <td>
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">{student.fullName}</div>
                        <div className="text-sm text-gray-500 dark:text-[#8E8E93]">{student.guardians?.[0]?.name}</div>
                      </div>
                    </td>
                    <td className="text-sm text-gray-900 dark:text-white">{student.rollNumber || '-'}</td>
                    <td className="text-sm text-gray-900 dark:text-white">{student.class || '-'}</td>
                    <td className="text-sm text-gray-900 dark:text-white">{student.section || '-'}</td>
                    <td>
                      <span
                        className={`status-badge ${student.isActive
                          ? 'status-active'
                          : 'status-inactive'
                          }`}
                      >
                        {student.isActive ? 'Active' : 'Inactive'}
                      </span>
                      {!student.isActive && (student.removalDate || student.inactivatedAt) && (
                        <div className="mt-1 text-xs text-gray-500 dark:text-[#8E8E93] space-y-0.5">
                          <div>
                            Deactivated: {formatDate(student.removalDate || student.inactivatedAt)}
                          </div>
                          {student.createdAt && (
                            <div>
                              Active for: {(() => {
                                const start = new Date(student.createdAt);
                                const end = new Date(student.removalDate || student.inactivatedAt);
                                const diffMs = end - start;
                                const totalDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                                const years = Math.floor(totalDays / 365);
                                const months = Math.floor((totalDays % 365) / 30);
                                const days = totalDays % 30;
                                const parts = [];
                                if (years > 0) parts.push(`${years}y`);
                                if (months > 0) parts.push(`${months}m`);
                                if (days > 0 || parts.length === 0) parts.push(`${days}d`);
                                return parts.join(' ');
                              })()}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleViewStudent(student)}
                          className="btn-icon hover:text-blue-600"
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {user?.role === 'admin' && (
                          <>
                            <button
                              onClick={() => handleEditStudent(student)}
                              className="btn-icon hover:text-teal-600"
                              title="Edit Student"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleToggleStatus(student)}
                              className={student.isActive ? 'p-1 text-gray-400 hover:text-orange-500' : 'p-1 text-gray-400 hover:text-green-600'}
                              title={student.isActive ? 'Deactivate' : 'Activate'}
                            >
                              {student.isActive ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                            </button>
                            <button
                              onClick={() => handleDeleteStudent(student)}
                              className="btn-icon hover:text-red-600"
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
        <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-1">
          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 dark:text-[#8E8E93]">
            <span>
              Showing {((currentPage - 1) * perPage) + 1}–{Math.min(currentPage * perPage, totalStudents)} of <strong>{totalStudents}</strong> students
            </span>
            <select
              value={perPage}
              onChange={(e) => { setPerPage(Number(e.target.value)); setCurrentPage(1); }}
              className="border border-gray-300 dark:border-[#38383A] rounded px-2 py-1 text-sm"
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
              className="btn btn-sm btn-ghost"
            >
              ← Previous
            </button>
            <span className="text-sm text-gray-600 dark:text-[#8E8E93]">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="btn btn-sm btn-ghost"
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
          isLoading={saveMutation.isPending}
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
            queryClient.invalidateQueries({ queryKey: ['students'] })
            toast.success(`Successfully imported ${result.success || result.created || 0} students`)
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
          isLoading={deactivateMutation.isPending}
        />
      )}
    </div>
  )
}

export default Students
