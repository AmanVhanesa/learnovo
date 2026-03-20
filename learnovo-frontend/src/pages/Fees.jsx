import React, { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Navigate } from 'react-router-dom'
import { Plus, Search, Download, Eye, Edit, CheckCircle, AlertTriangle, X } from 'lucide-react'
import { useSettings } from '../contexts/SettingsContext'
import { useAuth } from '../contexts/AuthContext'
import { feesService } from '../services/feesService'
import { studentsService } from '../services/studentsService'
import { exportCSV } from '../utils/exportHelpers'
import toast from 'react-hot-toast'
import { sortByRelevance } from '../utils/searchRelevance'

const Fees = () => {
  const { formatCurrency } = useSettings()
  const { user } = useAuth()

  // Students and parents should use the Student Fees Dashboard (invoice-based)
  if (user?.role === 'student' || user?.role === 'parent') {
    return <Navigate to="/app/student/fees" replace />
  }
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({
    student: '',
    amount: '',
    currency: 'INR',
    description: '',
    dueDate: '',
    feeType: 'tuition',
    term: 'annual',
    academicYear: '',
    status: 'pending'
  })

  // Fetch fees via useQuery
  const { data: fees = [], isLoading, error } = useQuery({
    queryKey: ['fees', statusFilter],
    queryFn: async () => {
      const { data } = await feesService.list({ status: statusFilter, limit: 100 })
      return data || []
    },
  })

  // Fetch students for dropdown via useQuery
  const { data: studentOptions = [], isLoading: loadingStudents, refetch: refetchStudents } = useQuery({
    queryKey: ['students-for-fees'],
    queryFn: async () => {
      const response = await studentsService.list({ limit: 100 })
      let studentsArray = []

      if (response) {
        if (response.success === true && Array.isArray(response.data)) {
          studentsArray = response.data
        } else if (Array.isArray(response.data)) {
          studentsArray = response.data
        } else if (Array.isArray(response)) {
          studentsArray = response
        } else if (Array.isArray(response.students)) {
          studentsArray = response.students
        } else {
          for (const key in response) {
            if (Array.isArray(response[key]) && response[key].length > 0) {
              studentsArray = response[key]
              break
            }
          }
        }
      }

      return studentsArray.map((s, index) => ({
        id: s._id || s.id || `temp-${index}`,
        name: s.name || 'Unknown',
        class: s.class || s.className || ''
      }))
    },
  })

  // Save fee mutation
  const saveFeeMutation = useMutation({
    mutationFn: async (feeData) => {
      if (editing) {
        return feesService.update(editing._id || editing.id, feeData)
      } else {
        return feesService.create(feeData)
      }
    },
    onSuccess: () => {
      setShowModal(false)
      setEditing(null)
      queryClient.invalidateQueries({ queryKey: ['fees'] })
      queryClient.invalidateQueries({ queryKey: ['students-for-fees'] })
    },
    onError: (err) => {
      let errorMessage = 'Failed to save fee'
      if (err.response?.data) {
        const errorData = err.response.data
        const parts = []
        if (errorData.message) parts.push(errorData.message)
        if (errorData.errorName) parts.push(`\nError Type: ${errorData.errorName}`)
        if (errorData.error && errorData.error !== errorData.message) parts.push(`\nDetails: ${errorData.error}`)
        if (errorData.validationErrors && Array.isArray(errorData.validationErrors) && errorData.validationErrors.length > 0) {
          const validationParts = errorData.validationErrors.map(e => `  - ${e.field || 'Field'}: ${e.message || e.msg}`)
          parts.push('\nValidation Errors:', ...validationParts)
        } else if (errorData.errors && Array.isArray(errorData.errors) && errorData.errors.length > 0) {
          const validationParts = errorData.errors.map(e => `  - ${e.field || e.path || 'Field'}: ${e.message || e.msg}`)
          parts.push('\nValidation Errors:', ...validationParts)
        }
        if (errorData.duplicateKey) {
          const dupField = Object.keys(errorData.duplicateKey.pattern || {})[0]
          parts.push(`\nDuplicate: ${dupField} already exists`)
        }
        errorMessage = parts.join('\n')
        if (errorMessage === 'Failed to save fee' && errorData.error) errorMessage = errorData.error
      } else if (err.message) {
        errorMessage = err.message
      }
      alert(errorMessage)
    },
  })

  // Pay fee mutation
  const payFeeMutation = useMutation({
    mutationFn: async ({ feeId, paymentMethod }) => {
      return feesService.pay(feeId, { paymentMethod, notes: 'Marked as collected by admin' })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fees'] })
      alert('Fee marked as collected successfully!')
    },
    onError: (err) => {
      alert(err?.response?.data?.message || 'Failed to mark as collected')
    },
  })

  // Delete fee mutation
  const deleteFeeMutation = useMutation({
    mutationFn: async (feeId) => {
      return feesService.remove(feeId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fees'] })
    },
    onError: (err) => {
      alert(err?.response?.data?.message || 'Failed to delete fee')
    },
  })

  const openAdd = async () => {
    setEditing(null)
    const currentYear = new Date().getFullYear()
    const nextYear = currentYear + 1
    setForm({
      student: '',
      amount: '',
      currency: 'INR',
      description: '',
      dueDate: '',
      feeType: 'tuition',
      term: 'annual',
      academicYear: `${currentYear}-${nextYear}`,
      status: 'pending'
    })
    setShowModal(true)
    if (studentOptions.length === 0) {
      refetchStudents()
    }
  }

  const openEdit = (fee) => {
    setEditing(fee)
    setForm({
      student: fee.student?._id || fee.student || '',
      amount: fee.amount || '',
      currency: fee.currency || 'INR',
      description: fee.description || '',
      dueDate: fee.dueDate ? (fee.dueDate.substring ? fee.dueDate.substring(0,10) : new Date(fee.dueDate).toISOString().substring(0,10)) : '',
      feeType: fee.feeType || 'tuition',
      term: fee.term || 'annual',
      academicYear: fee.academicYear || '',
      status: fee.status || 'pending'
    })
    setShowModal(true)
  }

  const saveFee = async (e) => {
    e.preventDefault()
    if (!form.student || form.student.trim() === '') { alert('Please select a student'); return }
    if (!form.amount || form.amount.trim() === '') { alert('Please enter an amount'); return }
    const amountNum = parseFloat(form.amount)
    if (isNaN(amountNum) || amountNum <= 0) { alert('Please enter a valid amount (greater than 0)'); return }
    if (!form.dueDate || form.dueDate.trim() === '') { alert('Please select a due date'); return }
    if (!form.description || form.description.trim().length < 5) { alert('Description must be at least 5 characters long'); return }
    if (form.description.trim().length > 200) { alert('Description must be less than 200 characters'); return }

    const feeData = {
      student: form.student.trim(),
      amount: amountNum,
      currency: (form.currency || 'INR').trim().toUpperCase(),
      description: form.description.trim(),
      dueDate: form.dueDate,
      feeType: form.feeType || 'tuition',
      academicYear: form.academicYear || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
      term: form.term || 'annual',
      status: form.status || 'pending'
    }

    if (feeData.status === 'paid') {
      feeData.paymentMethod = 'cash'
      feeData.paidDate = new Date().toISOString()
    }

    saveFeeMutation.mutate(feeData)
  }

  const payFee = async (fee) => {
    if (!window.confirm(`Mark fee for ${fee.student?.name || 'student'} as Collected/Paid?`)) return
    const method = prompt('Payment method?\n(cash/bank_transfer/online/cheque/other)', 'cash')
    if (!method) return
    const validMethods = ['cash', 'bank_transfer', 'online', 'cheque', 'other']
    const paymentMethod = validMethods.includes(method.toLowerCase()) ? method.toLowerCase() : 'cash'
    payFeeMutation.mutate({ feeId: fee._id || fee.id, paymentMethod })
  }

  const deleteFee = async (fee) => {
    if (!window.confirm('Delete this fee?')) return
    deleteFeeMutation.mutate(fee._id || fee.id)
  }

  const filteredFees = useMemo(() => {
    let filtered = fees.filter(fee => {
      const matchesSearch = (fee.student?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                           (fee.description || '').toLowerCase().includes(searchQuery.toLowerCase())
      const matchesStatus = !statusFilter || fee.status === statusFilter
      return matchesSearch && matchesStatus
    })
    if (searchQuery.trim()) {
      filtered = sortByRelevance(filtered, searchQuery, [
        { key: 'student.name', weight: 1 },
        { key: 'description', weight: 0.7 }
      ])
    }
    return filtered
  }, [fees, searchQuery, statusFilter])

  const summary = useMemo(() => fees.reduce((acc, fee) => {
    acc.total += fee.amount
    if (fee.status === 'paid') acc.paid += fee.amount
    else if (fee.status === 'pending') acc.pending += fee.amount
    else if (fee.status === 'overdue') acc.overdue += fee.amount
    acc[fee.status + 'Count'] = (acc[fee.status + 'Count'] || 0) + 1
    return acc
  }, { total: 0, paid: 0, pending: 0, overdue: 0, paidCount: 0, pendingCount: 0, overdueCount: 0 }), [fees])

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
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
          {user?.role === 'teacher' ? 'Student Fee Status' : user?.role === 'student' ? 'My Fees' : user?.role === 'parent' ? 'Children\'s Fees' : 'Fee Management'}
        </h1>
        {user?.role === 'admin' && (
          <button className="btn btn-primary w-full sm:w-auto self-start" onClick={openAdd}>
            <Plus className="h-4 w-4 mr-2" />
            Add Fee
          </button>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mr-2" />
            <p className="text-sm text-red-600 dark:text-red-400">{error.response?.data?.message || 'Failed to load fees. Please check your connection and try again.'}</p>
          </div>
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['fees'] })}
            className="mt-2 text-sm text-red-600 dark:text-red-400 hover:text-red-800 underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Fee Summary - Only show for admin */}
      {user?.role === 'admin' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
          <div className="stat-card">
            <div className="flex items-center">
              <div className="p-3 rounded-lg bg-green-100">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-[#8E8E93]">Total Collected</p>
                <p className="text-lg sm:text-2xl font-semibold text-gray-900 dark:text-white">
                  {formatCurrency(summary.paid)}
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
                <p className="text-sm font-medium text-gray-600 dark:text-[#8E8E93]">Pending Dues</p>
                <p className="text-lg sm:text-2xl font-semibold text-gray-900 dark:text-white">
                  {formatCurrency(summary.pending)}
                </p>
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="flex items-center">
              <div className="p-3 rounded-lg bg-blue-100">
                <CheckCircle className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-[#8E8E93]">This Month</p>
                <p className="text-lg sm:text-2xl font-semibold text-gray-900 dark:text-white">
                  {formatCurrency(summary.paid)}
                </p>
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="flex items-center">
              <div className="p-3 rounded-lg bg-red-100">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-[#8E8E93]">Overdue</p>
                <p className="text-lg sm:text-2xl font-semibold text-gray-900 dark:text-white">
                  {formatCurrency(summary.overdue)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Teacher-specific fee summary */}
      {user?.role === 'teacher' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
          <div className="stat-card">
            <div className="flex items-center">
              <div className="p-3 rounded-lg bg-green-100">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-[#8E8E93]">Students with Paid Fees</p>
                <p className="text-lg sm:text-2xl font-semibold text-gray-900 dark:text-white">
                  {summary.paidCount}
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
                <p className="text-sm font-medium text-gray-600 dark:text-[#8E8E93]">Students with Pending Fees</p>
                <p className="text-lg sm:text-2xl font-semibold text-gray-900 dark:text-white">
                  {summary.pendingCount}
                </p>
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="flex items-center">
              <div className="p-3 rounded-lg bg-red-100">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-[#8E8E93]">Students with Overdue Fees</p>
                <p className="text-lg sm:text-2xl font-semibold text-gray-900 dark:text-white">
                  {summary.overdueCount}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card p-3 sm:p-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 sm:gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search fees..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input pl-10"
              />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 lg:gap-4">
            <div className="sm:w-48">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="input"
              >
                <option value="">All Status</option>
                <option value="paid">Collected</option>
                <option value="pending">Pending</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>
            <button
              className="btn btn-outline w-full sm:w-auto flex-shrink-0"
              onClick={() => {
                if (filteredFees.length === 0) { toast.error('No fees to export'); return; }
                const rows = [
                  ['Student', 'Admission No', 'Class', 'Fee Type', 'Amount', 'Status', 'Due Date', 'Payment Method', 'Description']
                ].concat(filteredFees.map(f => [
                  f.student?.name || f.student?.fullName || '',
                  f.student?.admissionNumber || f.student?.studentId || '',
                  f.student?.class || '',
                  f.feeType || '',
                  f.amount || 0,
                  f.status || '',
                  f.dueDate ? new Date(f.dueDate).toLocaleDateString() : '',
                  f.paymentMethod || '',
                  f.description || ''
                ]))
                exportCSV('fees.csv', rows)
                toast.success('Fees exported successfully')
              }}
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Student Fee Summary */}
      {user?.role === 'student' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
          <div className="stat-card">
            <div className="flex items-center">
              <div className="p-3 rounded-lg bg-green-100">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-[#8E8E93]">Paid</p>
                <p className="text-lg sm:text-2xl font-semibold text-gray-900 dark:text-white">
                  {formatCurrency(summary.paid)}
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
                <p className="text-sm font-medium text-gray-600 dark:text-[#8E8E93]">Pending</p>
                <p className="text-lg sm:text-2xl font-semibold text-gray-900 dark:text-white">
                  {formatCurrency(summary.pending)}
                </p>
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="flex items-center">
              <div className="p-3 rounded-lg bg-red-100">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-[#8E8E93]">Overdue</p>
                <p className="text-lg sm:text-2xl font-semibold text-gray-900 dark:text-white">
                  {formatCurrency(summary.overdue)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fees table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table min-w-[700px]">
          <thead>
            <tr>
              {user?.role === 'admin' && <th>Student</th>}
              {user?.role === 'admin' && <th>Class</th>}
              <th>Description</th>
              <th>Amount</th>
              <th>Due Date</th>
              <th>Status</th>
              {user?.role === 'admin' && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filteredFees.map((fee) => (
              <tr key={fee._id || fee.id}>
                {user?.role === 'admin' && (
                  <>
                    <td>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{fee.student?.name}</div>
                    </td>
                    <td className="text-sm text-gray-900 dark:text-white">{fee.student?.class}</td>
                  </>
                )}
                <td>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">{fee.description}</div>
                  {fee.feeType && (
                    <div className="text-xs text-gray-500 dark:text-[#8E8E93]">{fee.feeType}</div>
                  )}
                </td>
                <td className="text-sm text-gray-900 dark:text-white">
                  {formatCurrency(fee.amount, fee.currency)}
                </td>
                <td className="text-sm text-gray-900 dark:text-white">
                  {new Date(fee.dueDate).toLocaleDateString()}
                </td>
                <td>
                  <span className={`status-badge status-${fee.status}`}>
                    {fee.status === 'paid' ? 'Paid' : fee.status === 'pending' ? 'Pending' : fee.status === 'overdue' ? 'Overdue' : fee.status}
                  </span>
                </td>
                {user?.role === 'admin' && (
                  <td>
                    <div className="flex space-x-2">
                      <button className="btn-icon hover:text-blue-600">
                        <Eye className="h-4 w-4" />
                      </button>
                      <button className="btn-icon hover:text-blue-600" onClick={() => openEdit(fee)} title="Edit Fee">
                        <Edit className="h-4 w-4" />
                      </button>
                      {(fee.status === 'pending' || fee.status === 'overdue') && (
                        <button
                          className="btn-icon hover:text-green-600"
                          onClick={() => payFee(fee)}
                            title="Mark as Collected"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </button>
                        )}
                        {fee.status !== 'paid' && (
                          <button
                            className="btn-icon hover:text-red-600"
                            onClick={() => deleteFee(fee)}
                            title="Delete Fee"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {/* Add/Edit Fee Modal */}
      {showModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-content p-2 sm:p-4">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-[#38383A] p-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{editing ? 'Edit Fee' : 'Add Fee'}</h3>
              <button className="btn-close" onClick={() => { setShowModal(false); setEditing(null); }}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <form className="p-4 space-y-4" onSubmit={saveFee}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <div className="flex items-center justify-between">
                    <label className="label">Student</label>
                    <button type="button" className="text-xs text-primary-600 hover:text-primary-700" onClick={() => refetchStudents()}>
                      Refresh
                    </button>
                  </div>
                  <select className="input" value={form.student} onChange={(e) => setForm({ ...form, student: e.target.value })} required disabled={loadingStudents}>
                    {(loadingStudents) && (
                      <option value="">Loading students...</option>
                    )}
                    {!loadingStudents && studentOptions.length === 0 && (
                      <option value="">No students found - add a student first (Click Refresh to reload)</option>
                    )}
                    {!loadingStudents && studentOptions.length > 0 && (
                      <>
                        <option value="">Select student</option>
                        {studentOptions.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.name} {s.class ? `(${s.class})` : ''}
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                  {/* Debug info */}
                  {process.env.NODE_ENV === 'development' && (
                    <p className="text-xs text-gray-500 dark:text-[#8E8E93] mt-1">
                      Students loaded: {studentOptions.length} | Loading: {loadingStudents ? 'Yes' : 'No'}
                    </p>
                  )}
                </div>
                <div>
                  <label className="label">Amount</label>
                  <input type="number" className="input" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
                </div>
                <div>
                  <label className="label">Currency</label>
                  <select className="input" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} required>
                    <option value="INR">INR - Indian Rupee</option>
                    <option value="USD">USD ($) - US Dollar</option>
                    <option value="EUR">EUR - Euro</option>
                    <option value="GBP">GBP - British Pound</option>
                    <option value="JPY">JPY - Japanese Yen</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="label">Description</label>
                  <input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g., Tuition fee for January 2024" required />
                </div>
                <div>
                  <label className="label">Due Date</label>
                  <input type="date" className="input" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} required />
                </div>
                <div>
                  <label className="label">Fee Type</label>
                  <select className="input" value={form.feeType} onChange={(e) => setForm({ ...form, feeType: e.target.value })} required>
                    <option value="tuition">Tuition</option>
                    <option value="transport">Transport</option>
                    <option value="library">Library</option>
                    <option value="sports">Sports</option>
                    <option value="exam">Exam</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="label">Term</label>
                  <select className="input" value={form.term} onChange={(e) => setForm({ ...form, term: e.target.value })} required>
                    <option value="1st_term">1st Term</option>
                    <option value="2nd_term">2nd Term</option>
                    <option value="3rd_term">3rd Term</option>
                    <option value="annual">Annual</option>
                  </select>
                </div>
                <div>
                  <label className="label">Payment Status</label>
                  <select
                    className="input"
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    required
                  >
                    <option value="pending">Pending (Not Paid)</option>
                    <option value="paid">Collected/Paid</option>
                  </select>
                  <p className="text-xs text-gray-500 dark:text-[#8E8E93] mt-1">Select if fee is already collected</p>
                </div>
                <div>
                  <label className="label">Academic Year</label>
                  <input
                    type="text"
                    className="input"
                    value={form.academicYear}
                    onChange={(e) => setForm({ ...form, academicYear: e.target.value })}
                    placeholder="e.g., 2024-2025"
                    pattern="\d{4}-\d{4}"
                    required
                  />
                  <p className="text-xs text-gray-500 dark:text-[#8E8E93] mt-1">Format: YYYY-YYYY (e.g., 2024-2025)</p>
                </div>
              </div>
              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
                <button type="button" className="btn btn-ghost w-full sm:w-auto" onClick={() => { setShowModal(false); setEditing(null); }}>Cancel</button>
                <button type="submit" className="btn btn-primary w-full sm:w-auto" disabled={saveFeeMutation.isPending}>
                  {saveFeeMutation.isPending ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Fees
