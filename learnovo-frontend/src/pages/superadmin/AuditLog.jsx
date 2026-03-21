import { useState, useCallback, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
    Search, Clock, Download, ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
    X, RefreshCw, Shield, Building2, User, Settings, CreditCard, FileText,
    LogIn, AlertTriangle, Globe
} from 'lucide-react'
import { superAdminService } from '../../services/superAdminService'
import toast from 'react-hot-toast'

const ACTION_OPTIONS = [
    { value: '', label: 'All Actions' },
    { value: 'SUSPEND_TENANT', label: 'Suspend Tenant' },
    { value: 'ACTIVATE_TENANT', label: 'Activate Tenant' },
    { value: 'CHANGE_PLAN', label: 'Change Plan' },
    { value: 'EXTEND_TRIAL', label: 'Extend Trial' },
    { value: 'OVERRIDE_FEATURES', label: 'Override Features' },
    { value: 'DELETE_TENANT', label: 'Delete Tenant' },
    { value: 'RESET_USER_PASSWORD', label: 'Reset User Password' },
    { value: 'DEACTIVATE_USER', label: 'Deactivate User' },
    { value: 'ACTIVATE_USER', label: 'Activate User' },
    { value: 'CREATE_PLAN', label: 'Create Plan' },
    { value: 'UPDATE_PLAN', label: 'Update Plan' },
    { value: 'DELETE_PLAN', label: 'Delete Plan' },
    { value: 'UPDATE_SETTINGS', label: 'Update Settings' },
    { value: 'LOGIN', label: 'Login' }
]

const TARGET_TYPE_OPTIONS = [
    { value: '', label: 'All Types' },
    { value: 'tenant', label: 'Tenant' },
    { value: 'user', label: 'User' },
    { value: 'plan', label: 'Plan' },
    { value: 'system', label: 'System' },
    { value: 'auth', label: 'Auth' },
    { value: 'settings', label: 'Settings' },
    { value: 'invoice', label: 'Invoice' }
]

const getActionBadgeClass = (action) => {
    const upper = (action || '').toUpperCase()
    if (upper.includes('CREATE') || upper.includes('ACTIVATE') || upper.includes('EXTEND'))
        return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
    if (upper.includes('UPDATE') || upper.includes('CHANGE') || upper.includes('OVERRIDE') || upper.includes('RESET'))
        return 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
    if (upper.includes('SUSPEND') || upper.includes('DELETE') || upper.includes('DEACTIVATE'))
        return 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
    if (upper === 'LOGIN' || upper.includes('AUTH'))
        return 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
    return 'bg-gray-50 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
}

const getTargetIcon = (type) => {
    switch ((type || '').toLowerCase()) {
        case 'tenant': return <Building2 className="w-3.5 h-3.5" />
        case 'user': return <User className="w-3.5 h-3.5" />
        case 'plan': return <CreditCard className="w-3.5 h-3.5" />
        case 'system': return <Settings className="w-3.5 h-3.5" />
        case 'auth': return <LogIn className="w-3.5 h-3.5" />
        case 'settings': return <Settings className="w-3.5 h-3.5" />
        case 'invoice': return <FileText className="w-3.5 h-3.5" />
        default: return <Globe className="w-3.5 h-3.5" />
    }
}

const formatAction = (action) => {
    if (!action) return '—'
    return action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

const formatTimestamp = (ts) => {
    if (!ts) return '—'
    return new Date(ts).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
}

const formatFullTimestamp = (ts) => {
    if (!ts) return '—'
    return new Date(ts).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    })
}

const formatTargetName = (log) => {
    if (log.targetName) return log.targetName
    if (log.targetId) {
        const id = String(log.targetId)
        return id.length > 8 ? `...${id.slice(-8)}` : id
    }
    return '—'
}

const summarizeChanges = (changes) => {
    if (!changes) return null
    if (typeof changes === 'string') return changes
    if (typeof changes === 'object') {
        const keys = Object.keys(changes)
        if (keys.length === 0) return null
        if (changes.before && changes.after) {
            const changedFields = Object.keys(changes.after)
            return `${changedFields.length} field${changedFields.length !== 1 ? 's' : ''} changed`
        }
        return `${keys.slice(0, 3).join(', ')}${keys.length > 3 ? ` +${keys.length - 3} more` : ''}`
    }
    return null
}

const AuditLog = () => {
    const [page, setPage] = useState(1)
    const [limit] = useState(20)
    const [expandedRow, setExpandedRow] = useState(null)
    const [filters, setFilters] = useState({
        action: '',
        targetType: '',
        superAdminId: '',
        ip: '',
        startDate: '',
        endDate: '',
        search: ''
    })
    const [searchInput, setSearchInput] = useState('')
    const debounceRef = useRef(null)

    const hasActiveFilters = filters.action || filters.targetType || filters.superAdminId ||
        filters.ip || filters.startDate || filters.endDate || filters.search

    const updateFilter = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }))
        setPage(1)
        setExpandedRow(null)
    }

    const handleSearchInput = useCallback((value) => {
        setSearchInput(value)
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => {
            setFilters(prev => ({ ...prev, search: value }))
            setPage(1)
        }, 300)
    }, [])

    const clearFilters = () => {
        setFilters({ action: '', targetType: '', superAdminId: '', ip: '', startDate: '', endDate: '', search: '' })
        setSearchInput('')
        setPage(1)
        setExpandedRow(null)
    }

    const { data: logsData, isLoading, error, refetch } = useQuery({
        queryKey: ['superadmin-audit-logs', page, limit, filters],
        queryFn: async () => {
            const params = { page, limit }
            if (filters.action) params.action = filters.action
            if (filters.targetType) params.targetType = filters.targetType
            if (filters.superAdminId) params.superAdminId = filters.superAdminId
            if (filters.ip) params.ip = filters.ip
            if (filters.startDate) params.startDate = filters.startDate
            if (filters.endDate) params.endDate = filters.endDate
            if (filters.search) params.search = filters.search
            const res = await superAdminService.getAuditLogs(params)
            if (res.success) {
                return {
                    logs: res.data || [],
                    total: res.pagination?.total || 0,
                    totalPages: res.pagination?.pages || 1
                }
            }
            return { logs: [], total: 0, totalPages: 1 }
        }
    })

    const { data: adminsData } = useQuery({
        queryKey: ['superadmin-admins-list'],
        queryFn: async () => {
            const res = await superAdminService.getSuperAdmins()
            return res.data || []
        },
        staleTime: 5 * 60 * 1000
    })

    const logs = logsData?.logs || []
    const totalPages = logsData?.totalPages || 1
    const total = logsData?.total || 0
    const admins = adminsData || []

    const handleExport = async () => {
        try {
            const blob = await superAdminService.exportAuditLogs({
                startDate: filters.startDate,
                endDate: filters.endDate,
                action: filters.action,
                targetType: filters.targetType
            })
            const url = window.URL.createObjectURL(new Blob([blob]))
            const link = document.createElement('a')
            link.href = url
            link.setAttribute('download', `audit-logs-${new Date().toISOString().split('T')[0]}.csv`)
            document.body.appendChild(link)
            link.click()
            link.remove()
            window.URL.revokeObjectURL(url)
            toast.success('Audit log exported')
        } catch {
            toast.error('Export failed')
        }
    }

    const toggleRow = (id) => {
        setExpandedRow(prev => prev === id ? null : id)
    }

    // Loading skeleton
    const renderSkeleton = () => (
        <div className="space-y-0">
            {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-gray-50 dark:border-[#2C2C2E]">
                    <div className="w-32 h-4 bg-gray-200/60 rounded-xl animate-pulse dark:bg-[#2C2C2E]" />
                    <div className="w-24 h-4 bg-gray-200/60 rounded-xl animate-pulse dark:bg-[#2C2C2E]" />
                    <div className="w-28 h-5 bg-gray-200/60 rounded-xl animate-pulse dark:bg-[#2C2C2E]" />
                    <div className="w-20 h-4 bg-gray-200/60 rounded-xl animate-pulse dark:bg-[#2C2C2E]" />
                    <div className="w-24 h-4 bg-gray-200/60 rounded-xl animate-pulse dark:bg-[#2C2C2E]" />
                    <div className="w-28 h-4 bg-gray-200/60 rounded-xl animate-pulse dark:bg-[#2C2C2E]" />
                    <div className="w-20 h-4 bg-gray-200/60 rounded-xl animate-pulse dark:bg-[#2C2C2E]" />
                </div>
            ))}
        </div>
    )

    // Error state
    const renderError = () => (
        <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="w-12 h-12 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="w-6 h-6 text-red-500" />
            </div>
            <p className="text-gray-900 dark:text-white font-semibold mb-1">Failed to load audit logs</p>
            <p className="text-gray-500 dark:text-[#8E8E93] text-sm mb-4">{error?.message || 'Something went wrong'}</p>
            <button onClick={() => refetch()} className="btn btn-outline btn-sm flex items-center gap-2">
                <RefreshCw className="w-4 h-4" />
                Retry
            </button>
        </div>
    )

    // Empty state
    const renderEmpty = () => (
        <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="w-12 h-12 bg-gray-50 dark:bg-[#2C2C2E] rounded-full flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-gray-400 dark:text-[#636366]" />
            </div>
            <p className="text-gray-900 dark:text-white font-semibold mb-1">No audit logs found</p>
            <p className="text-gray-500 dark:text-[#8E8E93] text-sm">
                {hasActiveFilters ? 'Try adjusting your filters' : 'No activity has been logged yet'}
            </p>
            {hasActiveFilters && (
                <button onClick={clearFilters} className="btn btn-outline btn-sm mt-4">
                    Clear Filters
                </button>
            )}
        </div>
    )

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Audit Logs</h1>
                    <p className="text-sm text-gray-500 dark:text-[#8E8E93] mt-1">Track all super admin actions across the platform</p>
                    <div className="mt-2">
                        <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 px-3 py-1.5 rounded-xl text-xs font-medium">
                            <Clock className="w-3.5 h-3.5" />
                            Logs retained for 2 years
                        </span>
                    </div>
                </div>
                <button onClick={handleExport} className="btn btn-primary flex items-center gap-2 shrink-0">
                    <Download className="w-4 h-4" />
                    Export CSV
                </button>
            </div>

            {/* Filters Card */}
            <div className="card p-3 sm:p-4 lg:p-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {/* Date From */}
                    <div>
                        <label className="block text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider mb-1.5">From Date</label>
                        <input
                            type="date"
                            value={filters.startDate}
                            onChange={(e) => updateFilter('startDate', e.target.value)}
                            className="input w-full"
                        />
                    </div>

                    {/* Date To */}
                    <div>
                        <label className="block text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider mb-1.5">To Date</label>
                        <input
                            type="date"
                            value={filters.endDate}
                            onChange={(e) => updateFilter('endDate', e.target.value)}
                            className="input w-full"
                        />
                    </div>

                    {/* Action Type */}
                    <div>
                        <label className="block text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider mb-1.5">Action</label>
                        <select
                            value={filters.action}
                            onChange={(e) => updateFilter('action', e.target.value)}
                            className="input w-full"
                        >
                            {ACTION_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Super Admin */}
                    <div>
                        <label className="block text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider mb-1.5">Super Admin</label>
                        <select
                            value={filters.superAdminId}
                            onChange={(e) => updateFilter('superAdminId', e.target.value)}
                            className="input w-full"
                        >
                            <option value="">All Admins</option>
                            {admins.map(admin => (
                                <option key={admin._id} value={admin._id}>{admin.name || admin.email}</option>
                            ))}
                        </select>
                    </div>

                    {/* Target Type */}
                    <div>
                        <label className="block text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider mb-1.5">Target Type</label>
                        <select
                            value={filters.targetType}
                            onChange={(e) => updateFilter('targetType', e.target.value)}
                            className="input w-full"
                        >
                            {TARGET_TYPE_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* IP Address */}
                    <div>
                        <label className="block text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider mb-1.5">IP Address</label>
                        <input
                            type="text"
                            value={filters.ip}
                            onChange={(e) => updateFilter('ip', e.target.value)}
                            placeholder="e.g. 192.168.1.1"
                            className="input w-full"
                        />
                    </div>

                    {/* Search */}
                    <div className="sm:col-span-2 lg:col-span-2">
                        <label className="block text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider mb-1.5">Search</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-[#636366]" />
                            <input
                                type="text"
                                value={searchInput}
                                onChange={(e) => handleSearchInput(e.target.value)}
                                placeholder="Search by target name or ID..."
                                className="input w-full pl-10"
                            />
                        </div>
                    </div>

                    {/* Clear Filters */}
                    {hasActiveFilters && (
                        <div className="flex items-end">
                            <button onClick={clearFilters} className="btn btn-outline btn-sm flex items-center gap-2 w-full justify-center">
                                <X className="w-4 h-4" />
                                Clear Filters
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Table */}
            <div className="rounded-2xl overflow-hidden shadow-glass">
                <div className="overflow-x-auto">
                    <div className="min-w-[800px]">
                        {/* Table Header */}
                        <div className="bg-gray-50/80 dark:bg-[#2C2C2E]">
                            <div className="grid grid-cols-[160px_120px_160px_100px_140px_120px_1fr] gap-2 px-4 py-3">
                                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Timestamp</span>
                                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Admin</span>
                                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Action</span>
                                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Target Type</span>
                                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Target</span>
                                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">IP</span>
                                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Changes</span>
                            </div>
                        </div>

                        {/* Table Body */}
                        <div className="bg-white dark:bg-[#1C1C1E]">
                            {isLoading ? renderSkeleton() : error ? renderError() : logs.length === 0 ? renderEmpty() : (
                                logs.map((log) => {
                                    const isExpanded = expandedRow === log._id
                                    const changesSummary = summarizeChanges(log.changes)
                                    return (
                                        <div key={log._id}>
                                            {/* Row */}
                                            <div
                                                className="grid grid-cols-[160px_120px_160px_100px_140px_120px_1fr] gap-2 px-4 py-3 items-center border-b border-gray-50 dark:border-[#2C2C2E] hover:bg-primary-50 dark:hover:bg-[#2C2C2E] cursor-pointer transition-colors"
                                                onClick={() => toggleRow(log._id)}
                                            >
                                                <span className="text-xs sm:text-sm text-gray-700 dark:text-white truncate">
                                                    {formatTimestamp(log.createdAt || log.timestamp)}
                                                </span>
                                                <span className="text-xs sm:text-sm text-gray-700 dark:text-white truncate">
                                                    {log.superAdminId?.name || log.adminName || '—'}
                                                </span>
                                                <span>
                                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${getActionBadgeClass(log.action)}`}>
                                                        {formatAction(log.action)}
                                                    </span>
                                                </span>
                                                <span className="text-xs sm:text-sm text-gray-700 dark:text-white flex items-center gap-1.5 truncate">
                                                    {getTargetIcon(log.targetType)}
                                                    <span className="capitalize">{log.targetType || '—'}</span>
                                                </span>
                                                <span className="text-xs sm:text-sm text-gray-700 dark:text-white truncate">
                                                    {formatTargetName(log)}
                                                </span>
                                                <span className="text-xs sm:text-sm text-gray-500 dark:text-[#8E8E93] font-mono truncate">
                                                    {log.ip || '—'}
                                                </span>
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-xs text-gray-500 dark:text-[#8E8E93] truncate">
                                                        {changesSummary || '—'}
                                                    </span>
                                                    <button
                                                        className="shrink-0 text-gray-400 dark:text-[#636366] hover:text-gray-600 dark:hover:text-white transition-colors"
                                                        onClick={(e) => { e.stopPropagation(); toggleRow(log._id) }}
                                                    >
                                                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Expanded Detail */}
                                            {isExpanded && (
                                                <div className="bg-gray-50/50 dark:bg-[#1A1A1C] border-b border-gray-50 dark:border-[#2C2C2E] px-4 py-4">
                                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                                        {/* Details */}
                                                        <div className="space-y-3">
                                                            <h4 className="text-xs font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Details</h4>
                                                            <div className="space-y-2">
                                                                <div className="flex justify-between">
                                                                    <span className="text-xs text-gray-500 dark:text-[#8E8E93]">Full Timestamp</span>
                                                                    <span className="text-xs text-gray-900 dark:text-white font-medium">
                                                                        {formatFullTimestamp(log.createdAt || log.timestamp)}
                                                                    </span>
                                                                </div>
                                                                <div className="flex justify-between">
                                                                    <span className="text-xs text-gray-500 dark:text-[#8E8E93]">Admin</span>
                                                                    <span className="text-xs text-gray-900 dark:text-white font-medium">
                                                                        {log.superAdminId?.name || log.adminName || '—'}
                                                                    </span>
                                                                </div>
                                                                <div className="flex justify-between">
                                                                    <span className="text-xs text-gray-500 dark:text-[#8E8E93]">Action</span>
                                                                    <span className="text-xs text-gray-900 dark:text-white font-medium">{log.action}</span>
                                                                </div>
                                                                <div className="flex justify-between">
                                                                    <span className="text-xs text-gray-500 dark:text-[#8E8E93]">Target</span>
                                                                    <span className="text-xs text-gray-900 dark:text-white font-medium">
                                                                        {log.targetType ? `${log.targetType}: ` : ''}{formatTargetName(log)}
                                                                    </span>
                                                                </div>
                                                                <div className="flex justify-between">
                                                                    <span className="text-xs text-gray-500 dark:text-[#8E8E93]">IP Address</span>
                                                                    <span className="text-xs text-gray-900 dark:text-white font-mono">{log.ip || '—'}</span>
                                                                </div>
                                                                {log.userAgent && (
                                                                    <div>
                                                                        <span className="text-xs text-gray-500 dark:text-[#8E8E93]">User Agent</span>
                                                                        <p className="text-xs text-gray-700 dark:text-gray-300 mt-0.5 break-all">{log.userAgent}</p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Changes Before/After */}
                                                        {log.changes && (
                                                            <div className="space-y-3">
                                                                <h4 className="text-xs font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Changes</h4>
                                                                {log.changes.before && log.changes.after ? (
                                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                                        <div>
                                                                            <span className="text-[11px] font-semibold text-red-500 uppercase tracking-wider mb-1 block">Before</span>
                                                                            <pre className="bg-gray-50 dark:bg-[#2C2C2E] rounded-xl p-3 font-mono text-xs text-gray-700 dark:text-gray-300 overflow-auto max-h-48">
                                                                                {JSON.stringify(log.changes.before, null, 2)}
                                                                            </pre>
                                                                        </div>
                                                                        <div>
                                                                            <span className="text-[11px] font-semibold text-emerald-500 uppercase tracking-wider mb-1 block">After</span>
                                                                            <pre className="bg-gray-50 dark:bg-[#2C2C2E] rounded-xl p-3 font-mono text-xs text-gray-700 dark:text-gray-300 overflow-auto max-h-48">
                                                                                {JSON.stringify(log.changes.after, null, 2)}
                                                                            </pre>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <pre className="bg-gray-50 dark:bg-[#2C2C2E] rounded-xl p-3 font-mono text-xs text-gray-700 dark:text-gray-300 overflow-auto max-h-48">
                                                                        {typeof log.changes === 'string' ? log.changes : JSON.stringify(log.changes, null, 2)}
                                                                    </pre>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </div>
                </div>

                {/* Pagination */}
                {!isLoading && !error && logs.length > 0 && (
                    <div className="bg-white dark:bg-[#1C1C1E] border-t border-gray-100 dark:border-[#2C2C2E] px-4 py-3 flex items-center justify-between">
                        <p className="text-xs text-gray-500 dark:text-[#8E8E93]">
                            Showing {((page - 1) * limit) + 1}–{Math.min(page * limit, total)} of {total} logs
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page <= 1}
                                className="btn btn-outline btn-sm flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <ChevronLeft className="w-4 h-4" />
                                Previous
                            </button>
                            <span className="text-xs text-gray-700 dark:text-white font-medium px-2">
                                {page} / {totalPages}
                            </span>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page >= totalPages}
                                className="btn btn-outline btn-sm flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Next
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

export default AuditLog
