import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  History, Search, RotateCcw, Loader2, ChevronLeft, ChevronRight,
  Filter, X
} from 'lucide-react'
import { transitionsService } from '../services/transitionsService'

const TYPE_LABELS = {
  promotion: { label: 'Promotion', color: 'teal' },
  demotion: { label: 'Demotion', color: 'amber' },
  section_shift: { label: 'Section Shift', color: 'blue' },
  section_merge: { label: 'Section Merge', color: 'purple' },
  section_split: { label: 'Section Split', color: 'indigo' },
  year_rollover: { label: 'Year Rollover', color: 'cyan' },
  graduation: { label: 'Graduation', color: 'emerald' }
}

export default function TransitionHistory() {
  const queryClient = useQueryClient()

  const [filters, setFilters] = useState({
    type: '',
    studentId: '',
    fromDate: '',
    toDate: '',
    page: 1,
    limit: 20
  })
  const [showFilters, setShowFilters] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['transition-history', filters],
    queryFn: () => transitionsService.getHistory(filters)
  })

  const logs = data?.data || []
  const pagination = data?.pagination || { page: 1, limit: 20, total: 0, pages: 0 }

  const undoMutation = useMutation({
    mutationFn: (logId) => transitionsService.undoTransition(logId),
    onSuccess: (data) => {
      toast.success(data.message || 'Transition reversed')
      queryClient.invalidateQueries({ queryKey: ['transition-history'] })
    },
    onError: (error) => toast.error(error.response?.data?.message || error.response?.data?.errors?.[0] || 'Undo failed')
  })

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }))
  }

  const clearFilters = () => {
    setFilters({ type: '', studentId: '', fromDate: '', toDate: '', page: 1, limit: 20 })
  }

  const hasActiveFilters = filters.type || filters.studentId || filters.fromDate || filters.toDate

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const canUndo = (log) => {
    if (log.reversedAt) return false
    const daysSince = (Date.now() - new Date(log.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    return daysSince <= 7 && log.type !== 'year_rollover'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <History className="w-7 h-7 text-teal-500" />
            Transition History
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">View and manage all student transitions</p>
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors ${
            hasActiveFilters
              ? 'border-teal-300 bg-teal-50 text-teal-700 dark:border-teal-700 dark:bg-teal-900/20 dark:text-teal-300'
              : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
        >
          <Filter className="w-4 h-4" />
          Filters
          {hasActiveFilters && <span className="w-2 h-2 rounded-full bg-teal-500" />}
        </button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Filters</h3>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="text-xs text-red-600 hover:underline flex items-center gap-1">
                <X className="w-3 h-3" /> Clear all
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Type</label>
              <select
                value={filters.type}
                onChange={e => handleFilterChange('type', e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm"
              >
                <option value="">All types</option>
                {Object.entries(TYPE_LABELS).map(([key, val]) => (
                  <option key={key} value={key}>{val.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">From Date</label>
              <input
                type="date"
                value={filters.fromDate}
                onChange={e => handleFilterChange('fromDate', e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">To Date</label>
              <input
                type="date"
                value={filters.toDate}
                onChange={e => handleFilterChange('toDate', e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Per Page</label>
              <select
                value={filters.limit}
                onChange={e => handleFilterChange('limit', parseInt(e.target.value))}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm"
              >
                {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-teal-500" />
            <span className="ml-2 text-sm text-gray-500">Loading history...</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="py-16 text-center">
            <History className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">No transition records found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700/50 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Student</th>
                    <th className="px-4 py-3">From</th>
                    <th className="px-4 py-3">To</th>
                    <th className="px-4 py-3">Year</th>
                    <th className="px-4 py-3">By</th>
                    <th className="px-4 py-3">Reason</th>
                    <th className="px-4 py-3 w-20">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {logs.map(log => {
                    const typeInfo = TYPE_LABELS[log.type] || { label: log.type, color: 'gray' }
                    const studentName = log.studentId
                      ? (log.studentId.name || `${log.studentId.firstName || ''} ${log.studentId.lastName || ''}`.trim() || log.studentId.admissionNumber || '-')
                      : 'Bulk operation'
                    const performerName = log.performedBy?.name || log.performedBy?.email || '-'

                    return (
                      <tr key={log._id} className={`hover:bg-gray-50 dark:hover:bg-gray-700/30 ${log.reversedAt ? 'opacity-50 line-through decoration-red-400' : ''}`}>
                        <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{formatDate(log.createdAt)}</td>
                        <td className="px-4 py-2.5">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium bg-${typeInfo.color}-100 text-${typeInfo.color}-700 dark:bg-${typeInfo.color}-900/30 dark:text-${typeInfo.color}-300`}>
                            {typeInfo.label}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-white whitespace-nowrap">{studentName}</td>
                        <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                          {log.fromClass}{log.fromSection ? `-${log.fromSection}` : ''}
                        </td>
                        <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                          {log.toClass}{log.toSection ? `-${log.toSection}` : ''}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                          {log.fromAcademicYear && log.toAcademicYear ? `${log.fromAcademicYear} → ${log.toAcademicYear}` : log.toAcademicYear || '-'}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{performerName}</td>
                        <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 max-w-[150px] truncate" title={log.reason}>{log.reason || '-'}</td>
                        <td className="px-4 py-2.5">
                          {canUndo(log) && (
                            <button
                              onClick={() => undoMutation.mutate(log._id)}
                              disabled={undoMutation.isPending}
                              className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                              title="Undo this transition"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          )}
                          {log.reversedAt && (
                            <span className="text-xs text-red-500">Reversed</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Showing {(pagination.page - 1) * pagination.limit + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
              </p>
              <div className="flex gap-1">
                <button
                  onClick={() => setFilters(prev => ({ ...prev, page: prev.page - 1 }))}
                  disabled={pagination.page <= 1}
                  className="p-1.5 rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300">
                  {pagination.page} / {pagination.pages || 1}
                </span>
                <button
                  onClick={() => setFilters(prev => ({ ...prev, page: prev.page + 1 }))}
                  disabled={pagination.page >= pagination.pages}
                  className="p-1.5 rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
