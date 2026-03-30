import React, { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Search, X, Filter, Download, Eye, Edit, Trash2, DollarSign, Tag,
  FileText, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  IndianRupee, Clock, CheckCircle2, AlertTriangle, CircleDot
} from 'lucide-react'
import { invoicesService } from '../../services/feesService'
import { classesService } from '../../services/academicsService'
import { formatCurrency } from '../../utils/formatCurrency'
import StatusBadge from '../StatusBadge'
import EmptyState from '../EmptyState'
import LoadingSpinner from '../LoadingSpinner'
import InvoiceDetailModal from './InvoiceDetailModal'
import DiscountModal from './DiscountModal'
import toast from 'react-hot-toast'

const PAGE_SIZE = 50

const AllInvoicesTab = ({
  activeSession,
  onEditInvoice,
  onCollectPayment,
  onPrintReceipt,
  onDownloadReceipt,
  onDeleteInvoice,
}) => {
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState({
    search: '',
    status: 'All',
    classId: '',
    startDate: '',
    endDate: '',
  })
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [showFilters, setShowFilters] = useState(false)
  const [viewingInvoice, setViewingInvoice] = useState(null)
  const [discountInvoice, setDiscountInvoice] = useState(null)
  const [selectedIds, setSelectedIds] = useState([])
  const [isDeleting, setIsDeleting] = useState(false)

  // Debounce search input
  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(filters.search)
      setPage(1)
    }, 400)
    return () => clearTimeout(timeout)
  }, [filters.search])

  const { data: classes = [] } = useQuery({
    queryKey: ['fees-classes'],
    queryFn: async () => { const res = await classesService.list(); return res.data || [] },
  })

  // Server-side paginated query
  const { data: invoicesResponse, isLoading, isError, error } = useQuery({
    queryKey: ['all-invoices', activeSession?._id, filters.status, filters.classId, filters.startDate, filters.endDate, page, debouncedSearch],
    queryFn: async () => {
      const params = {
        page,
        limit: PAGE_SIZE,
      }
      if (activeSession?._id) params.academicSessionId = activeSession._id
      if (filters.status && filters.status !== 'All') params.status = filters.status
      if (filters.classId) params.classId = filters.classId
      if (filters.startDate) params.startDate = filters.startDate
      if (filters.endDate) params.endDate = filters.endDate
      if (debouncedSearch) params.search = debouncedSearch
      return await invoicesService.list(params)
    },
    enabled: !!activeSession,
    placeholderData: (prev) => prev,
    retry: 2,
  })

  const invoices = invoicesResponse?.data || []
  const pagination = invoicesResponse?.pagination || { page: 1, limit: PAGE_SIZE, total: 0, pages: 0 }
  const serverStats = invoicesResponse?.stats || null

  // Stats from server (covers ALL invoices, not just current page)
  const stats = serverStats || {
    total: pagination.total,
    totalAmount: 0,
    pendingAmount: 0,
    pending: 0,
    partial: 0,
    paid: 0,
    overdue: 0,
  }

  // Reset selected when page changes
  useEffect(() => { setSelectedIds([]) }, [page])

  const handleSelectAll = (checked) => {
    setSelectedIds(checked ? invoices.map(i => i._id) : [])
  }

  const handleToggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  // Single delete with immediate UI update
  const handleSingleDelete = async (id) => {
    if (!window.confirm('Delete this invoice? This cannot be undone.')) return
    try {
      await invoicesService.delete(id)
      toast.success('Invoice deleted')
      // Remove from selection if selected
      setSelectedIds(prev => prev.filter(x => x !== id))
      // Immediately refetch to update UI
      queryClient.invalidateQueries({ queryKey: ['all-invoices'] })
      queryClient.invalidateQueries({ queryKey: ['fees-dashboard'] })
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete invoice')
    }
  }

  // Batch delete selected invoices
  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return

    const confirmMsg = selectedIds.length === 1
      ? 'Delete 1 selected invoice? This cannot be undone.'
      : `Delete ${selectedIds.length} selected invoices? This cannot be undone.`

    if (!window.confirm(confirmMsg)) return

    try {
      setIsDeleting(true)
      const res = await invoicesService.deleteBatch(selectedIds)
      const data = res.data || res
      const deleted = data.deleted || selectedIds.length
      const skipped = data.skipped || 0

      if (skipped > 0) {
        toast.success(`Deleted ${deleted} invoice(s). ${skipped} skipped (have payments).`)
      } else {
        toast.success(`Deleted ${deleted} invoice(s)`)
      }

      setSelectedIds([])
      // Immediately refetch to update UI
      queryClient.invalidateQueries({ queryKey: ['all-invoices'] })
      queryClient.invalidateQueries({ queryKey: ['fees-dashboard'] })
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete invoices')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleExportCSV = () => {
    const data = selectedIds.length > 0 ? invoices.filter(i => selectedIds.includes(i._id)) : invoices
    if (data.length === 0) { toast.error('No invoices to export'); return }
    const headers = ['Invoice No', 'Student', 'Admission No', 'Class', 'Total Amount', 'Paid Amount', 'Balance', 'Status', 'Due Date', 'Billing Period']
    const rows = data.map(inv => [
      inv.invoiceNumber,
      inv.studentId?.fullName || inv.studentId?.name || 'N/A',
      inv.studentId?.admissionNumber || inv.studentId?.studentId || '',
      inv.classId?.name || '',
      (inv.totalAmount || 0) + (inv.lateFeeApplied || 0),
      inv.paidAmount || 0,
      inv.balanceAmount || 0,
      inv.status,
      inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('en-IN') : '',
      inv.billingPeriod?.displayText || '',
    ])
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `invoices-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success(`Exported ${data.length} invoices`)
  }

  const clearFilters = () => {
    setFilters({ search: '', status: 'All', classId: '', startDate: '', endDate: '' })
    setDebouncedSearch('')
    setPage(1)
  }

  const hasActiveFilters = filters.classId || filters.startDate || filters.endDate

  const statusTabs = [
    { key: 'All', label: 'All', count: stats.total, icon: FileText },
    { key: 'Pending', label: 'Pending', count: stats.pending, icon: Clock },
    { key: 'Partial', label: 'Partial', count: stats.partial, icon: CircleDot },
    { key: 'Paid', label: 'Paid', count: stats.paid, icon: CheckCircle2 },
    { key: 'Overdue', label: 'Overdue', count: stats.overdue, icon: AlertTriangle },
  ]

  const getStudentInitials = (student) => {
    const name = student?.fullName || student?.name || ''
    if (!name || name === 'N/A') return '?'
    return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  }

  const totalPages = pagination.pages

  return (
    <div className="space-y-5">
      {/* Summary strip */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="stat-card flex items-center gap-4">
          <div className="p-3 rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
            <IndianRupee className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wide">Total Billed</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white mt-0.5">{formatCurrency(stats.totalAmount)}</p>
          </div>
        </div>
        <div className="stat-card flex items-center gap-4">
          <div className="p-3 rounded-xl bg-red-100 dark:bg-red-900/30">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wide">Outstanding</p>
            <p className="text-xl font-bold text-red-600 dark:text-red-400 mt-0.5">{formatCurrency(stats.pendingAmount)}</p>
          </div>
        </div>
        <div className="stat-card hidden lg:flex items-center gap-4">
          <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-900/30">
            <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wide">Total Invoices</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white mt-0.5">{stats.total}</p>
          </div>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 -mb-1 scrollbar-hide">
        {statusTabs.map(tab => {
          const isActive = filters.status === tab.key
          const TabIcon = tab.icon
          return (
            <button
              key={tab.key}
              onClick={() => { setFilters(f => ({ ...f, status: tab.key })); setPage(1) }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-primary-600 text-white shadow-md dark:bg-[#3EC4B1] dark:text-black'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 hover:border-gray-300 dark:bg-[#1C1C1E] dark:text-[#8E8E93] dark:border-[#38383A] dark:hover:bg-[#2C2C2E] dark:hover:border-[#48484A]'
              }`}
            >
              <TabIcon className="h-3.5 w-3.5" />
              {tab.label}
              <span className={`min-w-[20px] h-5 flex items-center justify-center px-1.5 rounded-md text-xs font-bold ${
                isActive
                  ? 'bg-white/20 text-white dark:bg-black/20 dark:text-black'
                  : 'bg-gray-100 text-gray-500 dark:bg-[#2C2C2E] dark:text-[#8E8E93]'
              }`}>
                {tab.count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Search + filter bar */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-[#636366]" />
            <input
              type="text"
              placeholder="Search by name, admission no, or invoice no..."
              value={filters.search}
              onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
              className="input pl-10 pr-10"
            />
            {filters.search && (
              <button onClick={() => setFilters(f => ({ ...f, search: '' }))} className="absolute right-3.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-gray-100 dark:hover:bg-[#38383A]">
                <X className="h-3.5 w-3.5 text-gray-400 dark:text-[#636366]" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`btn btn-sm ${hasActiveFilters ? 'btn-primary' : 'btn-outline'}`}
            >
              <Filter className="h-3.5 w-3.5 mr-1.5" />
              Filters
              {hasActiveFilters && <span className="ml-1 w-1.5 h-1.5 bg-white rounded-full" />}
            </button>
            <button onClick={handleExportCSV} className="btn btn-sm btn-outline">
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Export
              {selectedIds.length > 0 && (
                <span className="ml-1 text-[10px] font-bold text-primary-600 dark:text-[#3EC4B1]">({selectedIds.length})</span>
              )}
            </button>
          </div>
        </div>

        {/* Expandable filters */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-[#38383A] grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
            <div>
              <label className="label mb-1.5 block">Class</label>
              <select
                value={filters.classId}
                onChange={e => { setFilters(f => ({ ...f, classId: e.target.value })); setPage(1) }}
                className="input"
              >
                <option value="">All Classes</option>
                {classes.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label mb-1.5 block">From Date</label>
              <input type="date" value={filters.startDate} onChange={e => { setFilters(f => ({ ...f, startDate: e.target.value })); setPage(1) }} className="input" />
            </div>
            <div>
              <label className="label mb-1.5 block">To Date</label>
              <input type="date" value={filters.endDate} onChange={e => { setFilters(f => ({ ...f, endDate: e.target.value })); setPage(1) }} className="input" />
            </div>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="btn btn-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 border border-red-200 dark:border-red-800/30 justify-center">
                <X className="h-3.5 w-3.5 mr-1" /> Clear Filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Error state */}
      {isError && (
        <div className="card p-6 text-center">
          <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-2" />
          <p className="text-sm font-medium text-red-600 dark:text-red-400 mb-1">Failed to load invoices</p>
          <p className="text-xs text-gray-500 dark:text-[#8E8E93]">{error?.message || 'Please try again'}</p>
        </div>
      )}

      {/* Invoice table */}
      <div className="card overflow-hidden">
        {/* Table header bar */}
        <div className="px-5 py-3.5 border-b border-gray-100 dark:border-[#38383A] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <p className="text-sm font-medium text-gray-500 dark:text-[#8E8E93]">
              <span className="font-semibold text-gray-900 dark:text-white">{pagination.total}</span> invoices
            </p>
            {debouncedSearch && (
              <span className="text-xs text-gray-400 dark:text-[#636366]">
                matching &ldquo;{debouncedSearch}&rdquo;
              </span>
            )}
          </div>
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-primary-600 dark:text-[#3EC4B1]">{selectedIds.length} selected</span>
              <button
                onClick={handleDeleteSelected}
                disabled={isDeleting}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 border border-red-200 dark:border-red-800/30 rounded-lg transition-colors disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {isDeleting ? 'Deleting...' : `Delete (${selectedIds.length})`}
              </button>
              <button onClick={() => setSelectedIds([])} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-white">
                Clear
              </button>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="py-16"><LoadingSpinner /></div>
        ) : invoices.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={hasActiveFilters || debouncedSearch ? 'No invoices match your filters' : 'No invoices generated yet'}
            description={hasActiveFilters || debouncedSearch ? 'Try adjusting your search or filters' : 'Generate invoices from the Generate Invoices tab'}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr className="bg-gray-50/80 dark:bg-[#2C2C2E]">
                    <th className="px-5 py-3.5 w-12 text-left">
                      <input
                        type="checkbox"
                        checked={selectedIds.length === invoices.length && invoices.length > 0}
                        onChange={e => handleSelectAll(e.target.checked)}
                        className="rounded border-gray-300 dark:border-[#48484A] text-primary-600 focus:ring-primary-500 dark:bg-[#1C1C1E]"
                      />
                    </th>
                    <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Invoice</th>
                    <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Student</th>
                    <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Class</th>
                    <th className="px-4 py-3.5 text-right text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Amount</th>
                    <th className="px-4 py-3.5 text-right text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Balance</th>
                    <th className="px-4 py-3.5 text-center text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Due Date</th>
                    <th className="px-5 py-3.5 text-right text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-[#2C2C2E]">
                  {invoices.map(invoice => {
                    const isOverdue = invoice.status === 'Overdue' || (invoice.status === 'Pending' && invoice.dueDate && new Date(invoice.dueDate) < new Date())
                    const student = invoice.studentId || {}
                    const studentName = student.fullName || student.name || ''
                    return (
                      <tr
                        key={invoice._id}
                        className={`group transition-colors cursor-pointer ${
                          selectedIds.includes(invoice._id)
                            ? 'bg-primary-50/60 dark:bg-primary-900/10'
                            : isOverdue
                              ? 'bg-red-50/40 hover:bg-red-50/70 dark:bg-red-950/10 dark:hover:bg-red-950/20'
                              : 'bg-white hover:bg-gray-50/80 dark:bg-[#1C1C1E] dark:hover:bg-[#2C2C2E]'
                        }`}
                        onClick={() => setViewingInvoice(invoice)}
                      >
                        <td className="px-5 py-3.5" onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(invoice._id)}
                            onChange={() => handleToggleSelect(invoice._id)}
                            className="rounded border-gray-300 dark:border-[#48484A] text-primary-600 focus:ring-primary-500 dark:bg-[#1C1C1E]"
                          />
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="text-sm font-mono font-semibold text-primary-600 dark:text-[#3EC4B1]">{invoice.invoiceNumber}</span>
                          {invoice.billingPeriod?.displayText && (
                            <p className="text-xs font-medium text-primary-600 dark:text-primary-400 mt-0.5">
                              {invoice.billingPeriod.displayText}
                              {invoice.items?.some(item => item.frequency === 'One-time') && (
                                <span className="ml-1.5 px-1.5 py-0.5 text-[9px] font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded">ONE TIME</span>
                              )}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-[#2C2C2E] flex items-center justify-center flex-shrink-0">
                              <span className="text-xs font-bold text-gray-500 dark:text-[#8E8E93]">{getStudentInitials(student)}</span>
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                {studentName || 'Unknown'}
                              </p>
                              <p className="text-[11px] text-gray-400 dark:text-[#636366]">
                                {student.admissionNumber || student.studentId || ''}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="text-sm text-gray-600 dark:text-[#8E8E93]">{invoice.classId?.name || '-'}</span>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <span className="text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency((invoice.totalAmount || 0) + (invoice.lateFeeApplied || 0))}</span>
                          {invoice.lateFeeApplied > 0 && (
                            <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">+{formatCurrency(invoice.lateFeeApplied)} late fee</p>
                          )}
                          {invoice.discountAmount > 0 && (
                            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">-{formatCurrency(invoice.discountAmount)}</p>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <span className={`text-sm font-bold tabular-nums ${
                            (invoice.balanceAmount || 0) > 0
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }`}>
                            {formatCurrency(invoice.balanceAmount || 0)}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <StatusBadge status={invoice.status} />
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`text-sm ${isOverdue ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-500 dark:text-[#8E8E93]'}`}>
                            {invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5" onClick={e => e.stopPropagation()}>
                          <div className="flex justify-end items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => setViewingInvoice(invoice)} className="btn-icon !p-1.5 !rounded-lg" title="View Details">
                              <Eye className="h-4 w-4" />
                            </button>
                            {(invoice.status === 'Pending' || invoice.status === 'Partial' || invoice.status === 'Overdue') && (
                              <button onClick={() => onCollectPayment(invoice)} className="!p-1.5 !rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors" title="Collect Payment">
                                <DollarSign className="h-4 w-4" />
                              </button>
                            )}
                            {invoice.status !== 'Paid' && !invoice.discountAmount && (
                              <button onClick={() => setDiscountInvoice(invoice)} className="!p-1.5 !rounded-lg text-blue-500 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors" title="Apply Discount">
                                <Tag className="h-4 w-4" />
                              </button>
                            )}
                            {invoice.status !== 'Paid' && (
                              <button onClick={() => onEditInvoice(invoice)} className="btn-icon !p-1.5 !rounded-lg" title="Edit Invoice">
                                <Edit className="h-4 w-4" />
                              </button>
                            )}
                            {invoice.status === 'Pending' && (
                              <button onClick={() => handleSingleDelete(invoice._id)} className="!p-1.5 !rounded-lg text-gray-400 dark:text-[#636366] hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="Delete Invoice">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-5 py-3.5 border-t border-gray-100 dark:border-[#38383A] flex flex-col sm:flex-row items-center justify-between gap-3">
                <p className="text-xs text-gray-500 dark:text-[#8E8E93]">
                  Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, pagination.total)} of {pagination.total}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(1)}
                    disabled={page === 1}
                    className="p-1.5 text-gray-400 dark:text-[#636366] hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#2C2C2E] rounded-lg disabled:opacity-20 disabled:pointer-events-none transition-colors"
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1.5 text-gray-400 dark:text-[#636366] hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#2C2C2E] rounded-lg disabled:opacity-20 disabled:pointer-events-none transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum
                    if (totalPages <= 5) pageNum = i + 1
                    else if (page <= 3) pageNum = i + 1
                    else if (page >= totalPages - 2) pageNum = totalPages - 4 + i
                    else pageNum = page - 2 + i
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={`min-w-[32px] h-8 px-2 text-xs font-semibold rounded-lg transition-colors ${
                          page === pageNum
                            ? 'bg-primary-600 text-white dark:bg-[#3EC4B1] dark:text-black'
                            : 'text-gray-600 dark:text-[#8E8E93] hover:bg-gray-100 dark:hover:bg-[#2C2C2E]'
                        }`}
                      >
                        {pageNum}
                      </button>
                    )
                  })}
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-1.5 text-gray-400 dark:text-[#636366] hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#2C2C2E] rounded-lg disabled:opacity-20 disabled:pointer-events-none transition-colors"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setPage(totalPages)}
                    disabled={page === totalPages}
                    className="p-1.5 text-gray-400 dark:text-[#636366] hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#2C2C2E] rounded-lg disabled:opacity-20 disabled:pointer-events-none transition-colors"
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Invoice Detail Modal */}
      {viewingInvoice && (
        <InvoiceDetailModal
          invoice={viewingInvoice}
          onClose={() => setViewingInvoice(null)}
          onCollectPayment={(inv) => { setViewingInvoice(null); onCollectPayment(inv) }}
          onEdit={(inv) => { setViewingInvoice(null); onEditInvoice(inv) }}
          onApplyDiscount={(inv) => { setViewingInvoice(null); setDiscountInvoice(inv) }}
          onPrintReceipt={onPrintReceipt}
          onDownloadReceipt={onDownloadReceipt}
        />
      )}

      {/* Discount Modal */}
      <DiscountModal
        isOpen={!!discountInvoice}
        onClose={() => setDiscountInvoice(null)}
        invoice={discountInvoice}
        onSuccess={() => {
          setDiscountInvoice(null)
          queryClient.invalidateQueries({ queryKey: ['all-invoices'] })
        }}
      />
    </div>
  )
}

export default AllInvoicesTab
