import React, { useState, useEffect } from 'react'
import { Plus, Search, Download, Eye, Edit, CheckCircle, AlertTriangle, X } from 'lucide-react'
import { useSettings } from '../contexts/SettingsContext'
import { useAuth } from '../contexts/AuthContext'
import { feesService } from '../services/feesService'
import { studentsService } from '../services/studentsService'

const Fees = () => {
  const { formatCurrency } = useSettings()
  const { user } = useAuth()
  const [fees, setFees] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
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
  const [studentOptions, setStudentOptions] = useState([])
  const [loadingStudents, setLoadingStudents] = useState(false)

  const fetchStudents = async () => {
    try {
      setLoadingStudents(true)
      console.log('🔍 Fetching students for fee dropdown...')
      
      const response = await studentsService.list({ limit: 100 })
      console.log('📦 Raw studentsService.list() response:', response)
      console.log('📦 Response type:', typeof response)
      console.log('📦 Is array?', Array.isArray(response))
      console.log('📦 Has success?', response?.success)
      console.log('📦 Has data?', !!response?.data)
      console.log('📦 Data type:', Array.isArray(response?.data))
      console.log('📦 Full response JSON:', JSON.stringify(response, null, 2))
      
      // studentsService.list() returns res.data from axios, which is the API response
      // API response format: { success: true, data: [...], pagination: {...} }
      let studentsArray = []
      
      if (response) {
        // Try different response formats
        if (response.success === true && Array.isArray(response.data)) {
          // Standard API response format: { success: true, data: [...] }
          studentsArray = response.data
          console.log('✅ Using response.data (standard format):', studentsArray.length, 'students')
        } else if (Array.isArray(response.data)) {
          // Response with data array (no success flag or success is false)
          studentsArray = response.data
          console.log('✅ Using response.data (array found):', studentsArray.length, 'students')
        } else if (Array.isArray(response)) {
          // Direct array response
          studentsArray = response
          console.log('✅ Using direct array response:', studentsArray.length, 'students')
        } else if (Array.isArray(response.students)) {
          // Response with students property
          studentsArray = response.students
          console.log('✅ Using response.students:', studentsArray.length, 'students')
        } else {
          // Last resort - check if response itself is object with array-like structure
          console.warn('⚠️ Unexpected response format. Response keys:', Object.keys(response || {}))
          console.warn('⚠️ Full response structure:', response)
          // Try to extract any array from response
          for (const key in response) {
            if (Array.isArray(response[key]) && response[key].length > 0) {
              studentsArray = response[key]
              console.log(`✅ Found array in response.${key}:`, studentsArray.length, 'students')
              break
            }
          }
        }
      } else {
        console.warn('⚠️ Response is null or undefined')
      }
      
      console.log('📊 Final students array:', studentsArray)
      console.log('📊 Students count:', studentsArray.length)
      
      if (studentsArray.length === 0) {
        console.warn('⚠️ No students found in array!')
        console.warn('⚠️ Response was:', response)
      }
      
      const mappedOptions = studentsArray.map((s, index) => {
        const option = { 
          id: s._id || s.id || `temp-${index}`, 
          name: s.name || 'Unknown', 
          class: s.class || s.className || ''
        }
        console.log(`📝 [${index}] Mapped student option:`, option, 'from student:', s)
        return option
      })
      
      console.log('✅ Setting studentOptions with', mappedOptions.length, 'options')
      console.log('✅ Options array:', mappedOptions)
      
      // Force a state update
      setStudentOptions([])
      setTimeout(() => {
        setStudentOptions(mappedOptions)
        console.log('✅ StudentOptions updated after timeout')
      }, 100)
    } catch (e) {
      console.error('❌ Failed to load students for picker', e)
      console.error('❌ Error status:', e.response?.status)
      console.error('❌ Error details:', e.response?.data)
      console.error('❌ Error message:', e.message)
      console.error('❌ Full error:', e)
      
      // Show user-friendly error
      if (e.response?.status === 400) {
        const errorData = e.response.data
        if (errorData?.errors && Array.isArray(errorData.errors)) {
          const errorMessages = errorData.errors.map(err => err.msg || err.message).join(', ')
          console.error('❌ Validation errors:', errorMessages)
        } else {
          console.error('❌ 400 Error:', errorData?.message || 'Bad request')
        }
      }
      
      setStudentOptions([])
    } finally {
      setLoadingStudents(false)
      console.log('✅ fetchStudents completed')
    }
  }

  useEffect(() => {
    fetchFees()
    fetchStudents()
  }, [])

  const fetchFees = async () => {
    try {
      setIsLoading(true)
      setError(null) // Clear previous errors
      const { data } = await feesService.list({ status: statusFilter, limit: 100 })
      setFees(data || [])
    } catch (error) {
      console.error('Error fetching fees:', error)
      setError(error.response?.data?.message || 'Failed to load fees. Please check your connection and try again.')
      setFees([]) // Clear fees on error
    } finally {
      setIsLoading(false)
    }
  }

  const openAdd = async () => {
    setEditing(null)
    // Set defaults with academic year
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
    // Refresh student list when opening add modal to get newly added students
    if (studentOptions.length === 0) {
      await fetchStudents()
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
    try {
      console.log('💾 Saving fee with form data:', form)
      
      // Validate form data first
      if (!form.student || form.student.trim() === '') {
        alert('Please select a student')
        return
      }
      if (!form.amount || form.amount.trim() === '') {
        alert('Please enter an amount')
        return
      }
      const amountNum = parseFloat(form.amount)
      if (isNaN(amountNum) || amountNum <= 0) {
        alert('Please enter a valid amount (greater than 0)')
        return
      }
      if (!form.dueDate || form.dueDate.trim() === '') {
        alert('Please select a due date')
        return
      }
      if (!form.description || form.description.trim().length < 5) {
        alert('Description must be at least 5 characters long')
        return
      }
      if (form.description.trim().length > 200) {
        alert('Description must be less than 200 characters')
        return
      }
      
      // Prepare fee data
      const feeData = {
        student: form.student.trim(),
        amount: amountNum,
        currency: (form.currency || 'INR').trim().toUpperCase(),
        description: form.description.trim(),
        dueDate: form.dueDate, // Send as-is, backend will convert
        feeType: form.feeType || 'tuition',
        academicYear: form.academicYear || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
        term: form.term || 'annual',
        status: form.status || 'pending'
      }
      
      // If status is 'paid', also set payment method and paid date
      if (feeData.status === 'paid') {
        feeData.paymentMethod = 'cash'
        feeData.paidDate = new Date().toISOString()
      }
      
      console.log('💾 Fee data to send:', feeData)
      console.log('💾 Data validation:', {
        studentValid: !!feeData.student && feeData.student.length > 0,
        amountValid: !isNaN(feeData.amount) && feeData.amount > 0,
        descriptionValid: feeData.description.length >= 1,
        dueDateValid: !!feeData.dueDate,
        academicYearValid: !!feeData.academicYear
      })
      
      if (editing) {
        await feesService.update(editing._id || editing.id, feeData)
      } else {
        await feesService.create(feeData)
      }
      
      setShowModal(false)
      setEditing(null)
      await fetchFees()
      // Refresh student list after saving fee to ensure it's up to date
      await fetchStudents()
    } catch (err) {
      console.error('❌ Save fee error:', err)
      console.error('❌ Error status:', err.response?.status)
      console.error('❌ Error response:', err.response?.data)
      // Log complete error details
      console.error('❌ Full error object:', err.response?.data || err)
      console.error('❌ Full error JSON:', JSON.stringify(err.response?.data || err, null, 2))
      
      if (err.response?.data) {
        const errorData = err.response.data
        console.error('❌ Error data keys:', Object.keys(errorData))
        console.error('❌ error field:', errorData.error)
        console.error('❌ errorName field:', errorData.errorName)
        console.error('❌ errorCode field:', errorData.errorCode)
        console.error('❌ validationErrors:', errorData.validationErrors)
        console.error('❌ duplicateKey:', errorData.duplicateKey)
        console.error('❌ stack:', errorData.stack)
      }
      
      // Show detailed error message
      let errorMessage = 'Failed to save fee'
      if (err.response?.data) {
        const errorData = err.response.data
        
        // Build comprehensive error message
        const parts = []
        
        if (errorData.message) {
          parts.push(errorData.message)
        }
        
        // Add error type
        if (errorData.errorName) {
          parts.push(`\nError Type: ${errorData.errorName}`)
        }
        
        // Add specific error message
        if (errorData.error && errorData.error !== errorData.message) {
          parts.push(`\nDetails: ${errorData.error}`)
        }
        
        // Add validation errors
        if (errorData.validationErrors && Array.isArray(errorData.validationErrors) && errorData.validationErrors.length > 0) {
          const validationParts = errorData.validationErrors.map(e => 
            `  • ${e.field || 'Field'}: ${e.message || e.msg}`
          )
          parts.push('\nValidation Errors:')
          parts.push(...validationParts)
        } else if (errorData.errors && Array.isArray(errorData.errors) && errorData.errors.length > 0) {
          const validationParts = errorData.errors.map(e => 
            `  • ${e.field || e.path || 'Field'}: ${e.message || e.msg}`
          )
          parts.push('\nValidation Errors:')
          parts.push(...validationParts)
        }
        
        // Add duplicate key info
        if (errorData.duplicateKey) {
          const dupField = Object.keys(errorData.duplicateKey.pattern || {})[0]
          parts.push(`\nDuplicate: ${dupField} already exists`)
        }
        
        errorMessage = parts.join('\n')
        
        // If no specific message, use error field
        if (errorMessage === 'Failed to save fee' && errorData.error) {
          errorMessage = errorData.error
        }
      } else if (err.message) {
        errorMessage = err.message
      }
      
      console.error('📝 Final error message for user:', errorMessage)
      alert(errorMessage)
    }
  }

  const payFee = async (fee) => {
    if (!window.confirm(`Mark fee for ${fee.student?.name || 'student'} as Collected/Paid?`)) return
    
    const method = prompt('Payment method?\n(cash/bank_transfer/online/cheque/other)', 'cash')
    if (!method) return
    
    // Validate payment method
    const validMethods = ['cash', 'bank_transfer', 'online', 'cheque', 'other']
    const paymentMethod = validMethods.includes(method.toLowerCase()) ? method.toLowerCase() : 'cash'
    
    try {
      await feesService.pay(fee._id || fee.id, { paymentMethod: paymentMethod, notes: 'Marked as collected by admin' })
      await fetchFees()
      alert('Fee marked as collected successfully!')
    } catch (err) {
      alert(err?.response?.data?.message || 'Failed to mark as collected')
    }
  }

  const deleteFee = async (fee) => {
    if (!window.confirm('Delete this fee?')) return
    try {
      await feesService.remove(fee._id || fee.id)
      await fetchFees()
    } catch (err) {
      alert(err?.response?.data?.message || 'Failed to delete fee')
    }
  }

  const filteredFees = fees.filter(fee => {
    const matchesSearch = (fee.student?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (fee.description || '').toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = !statusFilter || fee.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const getFeeSummary = () => {
    const total = fees.reduce((sum, fee) => sum + fee.amount, 0)
    const paid = fees.filter(fee => fee.status === 'paid').reduce((sum, fee) => sum + fee.amount, 0)
    const pending = fees.filter(fee => fee.status === 'pending').reduce((sum, fee) => sum + fee.amount, 0)
    const overdue = fees.filter(fee => fee.status === 'overdue').reduce((sum, fee) => sum + fee.amount, 0)
    
    return { total, paid, pending, overdue }
  }

  const summary = getFeeSummary()

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
        <h1 className="text-2xl font-bold text-gray-900">
          {user?.role === 'teacher' ? 'Student Fee Status' : user?.role === 'student' ? 'My Fees' : user?.role === 'parent' ? 'Children\'s Fees' : 'Fee Management'}
        </h1>
        {user?.role === 'admin' && (
          <button className="btn btn-primary" onClick={openAdd}>
            <Plus className="h-4 w-4 mr-2" />
            Add Fee
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
            onClick={() => fetchFees()}
            className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Fee Summary - Only show for admin */}
      {user?.role === 'admin' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="stat-card">
            <div className="flex items-center">
              <div className="p-3 rounded-lg bg-green-100">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Collected</p>
                <p className="text-2xl font-semibold text-gray-900">
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
                <p className="text-sm font-medium text-gray-600">Pending Dues</p>
                <p className="text-2xl font-semibold text-gray-900">
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
                <p className="text-sm font-medium text-gray-600">This Month</p>
                <p className="text-2xl font-semibold text-gray-900">
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
                <p className="text-sm font-medium text-gray-600">Overdue</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {formatCurrency(summary.overdue)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Teacher-specific fee summary */}
      {user?.role === 'teacher' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="stat-card">
            <div className="flex items-center">
              <div className="p-3 rounded-lg bg-green-100">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Students with Paid Fees</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {fees.filter(fee => fee.status === 'paid').length}
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
                <p className="text-sm font-medium text-gray-600">Students with Pending Fees</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {fees.filter(fee => fee.status === 'pending').length}
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
                <p className="text-sm font-medium text-gray-600">Students with Overdue Fees</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {fees.filter(fee => fee.status === 'overdue').length}
                </p>
              </div>
            </div>
          </div>
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
            <button className="btn btn-outline flex-shrink-0">
              <Download className="h-4 w-4 mr-2" />
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Student Fee Summary */}
      {user?.role === 'student' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="stat-card">
            <div className="flex items-center">
              <div className="p-3 rounded-lg bg-green-100">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Paid</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {formatCurrency(fees.filter(f => f.status === 'paid').reduce((sum, f) => sum + f.amount, 0))}
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
                <p className="text-sm font-medium text-gray-600">Pending</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {formatCurrency(fees.filter(f => f.status === 'pending').reduce((sum, f) => sum + f.amount, 0))}
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
                <p className="text-sm font-medium text-gray-600">Overdue</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {formatCurrency(fees.filter(f => f.status === 'overdue').reduce((sum, f) => sum + f.amount, 0))}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fees table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table">
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
                      <div className="text-sm font-medium text-gray-900">{fee.student?.name}</div>
                    </td>
                    <td className="text-sm text-gray-900">{fee.student?.class}</td>
                  </>
                )}
                <td>
                  <div className="text-sm font-medium text-gray-900">{fee.description}</div>
                  {fee.feeType && (
                    <div className="text-xs text-gray-500">{fee.feeType}</div>
                  )}
                </td>
                <td className="text-sm text-gray-900">
                  {formatCurrency(fee.amount, fee.currency)}
                </td>
                <td className="text-sm text-gray-900">
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
                      <button className="p-1 text-gray-400 hover:text-blue-600">
                        <Eye className="h-4 w-4" />
                      </button>
                      <button className="p-1 text-gray-400 hover:text-blue-600" onClick={() => openEdit(fee)} title="Edit Fee">
                        <Edit className="h-4 w-4" />
                      </button>
                      {(fee.status === 'pending' || fee.status === 'overdue') && (
                        <button 
                          className="p-1 text-gray-400 hover:text-green-600" 
                          onClick={() => payFee(fee)}
                            title="Mark as Collected"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </button>
                        )}
                        {fee.status !== 'paid' && (
                          <button 
                            className="p-1 text-gray-400 hover:text-red-600" 
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
          <div className="modal-content p-4">
            <div className="flex items-center justify-between border-b border-gray-200 p-4">
              <h3 className="text-lg font-semibold text-gray-900">{editing ? 'Edit Fee' : 'Add Fee'}</h3>
              <button className="p-2 rounded-md hover:bg-gray-100" onClick={() => { setShowModal(false); setEditing(null); }}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <form className="p-4 space-y-4" onSubmit={saveFee}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <div className="flex items-center justify-between">
                    <label className="label">Student</label>
                    <button type="button" className="text-xs text-primary-600 hover:text-primary-700" onClick={fetchStudents}>
                      Refresh
                    </button>
                  </div>
                  <select className="input" value={form.student} onChange={(e) => setForm({ ...form, student: e.target.value })} required disabled={loadingStudents}>
                    {(loadingStudents) && (
                      <option value="">Loading students...</option>
                    )}
                    {!loadingStudents && studentOptions.length === 0 && (
                      <option value="">No students found — add a student first (Click Refresh to reload)</option>
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
                    <p className="text-xs text-gray-500 mt-1">
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
                    <option value="INR">INR (₹) - Indian Rupee</option>
                    <option value="USD">USD ($) - US Dollar</option>
                    <option value="EUR">EUR (€) - Euro</option>
                    <option value="GBP">GBP (£) - British Pound</option>
                    <option value="JPY">JPY (¥) - Japanese Yen</option>
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
                  <p className="text-xs text-gray-500 mt-1">Select if fee is already collected</p>
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
                  <p className="text-xs text-gray-500 mt-1">Format: YYYY-YYYY (e.g., 2024-2025)</p>
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
    </div>
  )
}

export default Fees

