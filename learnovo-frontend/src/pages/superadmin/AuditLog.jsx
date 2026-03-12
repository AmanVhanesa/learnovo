import React, { useState, useEffect } from 'react'
import { Filter, Search, Calendar, Shield, User, Building2, Server, Key, AlertCircle } from 'lucide-react'
import { superAdminService } from '../../services/superAdminService'

const SuperAdminAuditLog = () => {
    const [logs, setLogs] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState(null)

    // Filters
    const [page, setPage] = useState(1)
    const [limit] = useState(20)
    const [totalPages, setTotalPages] = useState(1)
    const [actionFilter, setActionFilter] = useState('')
    const [targetTypeFilter, setTargetTypeFilter] = useState('')

    // Timeline grouping
    const [groupedLogs, setGroupedLogs] = useState({})

    useEffect(() => {
        fetchLogs()
    }, [page, actionFilter, targetTypeFilter])

    const fetchLogs = async () => {
        setIsLoading(true)
        setError(null)
        try {
            const res = await superAdminService.getAuditLogs({
                page, limit, action: actionFilter, targetType: targetTypeFilter
            })
            if (res.success) {
                setLogs(res.data)
                groupLogsByDate(res.data)
                if (res.pagination?.total) setTotalPages(Math.ceil(res.pagination.total / limit))
            }
        } catch (err) {
            console.error('Error fetching audit logs:', err)
            setError(err.response?.data?.message || 'Failed to load audit logs')

            // Fallback Dev Data
            if (process.env.NODE_ENV === 'development') {
                const mockData = [
                    { _id: '1', superAdminId: { name: 'Super Admin' }, action: 'suspend_tenant', targetType: 'tenant', targetId: '123', changes: { reason: 'payment failure' }, timestamp: new Date().toISOString() },
                    { _id: '2', superAdminId: { name: 'Super Admin' }, action: 'change_plan', targetType: 'tenant', targetId: '124', changes: { old: 'basic', new: 'premium' }, timestamp: new Date(Date.now() - 3600000).toISOString() },
                    { _id: '3', superAdminId: { name: 'Super Admin' }, action: 'reset_password', targetType: 'user', targetId: '999', changes: null, timestamp: new Date(Date.now() - 86400000).toISOString() },
                    { _id: '4', superAdminId: { name: 'Super Admin' }, action: 'update_plan_config', targetType: 'system', targetId: 'plans', changes: { plan: 'premium', limit: 1500 }, timestamp: new Date(Date.now() - 172800000).toISOString() },
                ]
                setLogs(mockData)
                groupLogsByDate(mockData)
            }
        } finally {
            setIsLoading(false)
        }
    }

    const groupLogsByDate = (logsData) => {
        const grouped = logsData.reduce((acc, log) => {
            const date = new Date(log.timestamp).toLocaleDateString(undefined, {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            })
            if (!acc[date]) acc[date] = []
            acc[date].push(log)
            return acc
        }, {})
        setGroupedLogs(grouped)
    }

    const clearFilters = () => {
        setActionFilter('')
        setTargetTypeFilter('')
        setPage(1)
    }

    // Visual mappings
    const getEventIcon = (targetType) => {
        switch (targetType) {
            case 'tenant': return <Building2 className="h-4 w-4" />
            case 'user': return <User className="h-4 w-4" />
            case 'system': return <Server className="h-4 w-4" />
            case 'auth': return <Key className="h-4 w-4" />
            default: return <Shield className="h-4 w-4" />
        }
    }

    const getEventColor = (action) => {
        if (action.includes('suspend') || action.includes('delete') || action.includes('deactivate')) {
            return 'bg-red-100 text-red-600 border-red-200'
        }
        if (action.includes('activate') || action.includes('create') || action.includes('extend')) {
            return 'bg-green-100 text-green-600 border-green-200'
        }
        if (action.includes('update') || action.includes('change')) {
            return 'bg-blue-100 text-blue-600 border-blue-200'
        }
        if (action.includes('reset') || action.includes('auth')) {
            return 'bg-yellow-100 text-yellow-600 border-yellow-200'
        }
        return 'bg-gray-100 text-gray-600 border-gray-200'
    }

    const formatActionName = (action) => {
        return action.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Security & Audit Log</h1>
                    <p className="mt-1 text-sm text-gray-500">Track all actions performed by Super Admins across the platform.</p>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4 flex items-center">
                    <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
                    <p className="text-sm text-red-600">{error}</p>
                </div>
            )}

            {/* Filters */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <div className="flex flex-wrap gap-4 items-center">
                    <div className="flex items-center text-sm font-medium text-gray-700 mr-2">
                        <Filter className="h-4 w-4 mr-2 text-gray-400" /> Filters:
                    </div>

                    <select
                        value={targetTypeFilter}
                        onChange={(e) => { setTargetTypeFilter(e.target.value); setPage(1); }}
                        className="block pl-3 pr-10 py-1.5 text-sm border-gray-300 focus:ring-primary-500 focus:border-primary-500 rounded-lg"
                    >
                        <option value="">All Resource Types</option>
                        <option value="tenant">Schools / Tenants</option>
                        <option value="user">Users</option>
                        <option value="system">System / Plans</option>
                        <option value="auth">Authentication</option>
                    </select>

                    <select
                        value={actionFilter}
                        onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
                        className="block pl-3 pr-10 py-1.5 text-sm border-gray-300 focus:ring-primary-500 focus:border-primary-500 rounded-lg"
                    >
                        <option value="">All Actions</option>
                        <option value="SUSPEND_TENANT">Suspend Tenant</option>
                        <option value="ACTIVATE_TENANT">Activate Tenant</option>
                        <option value="CHANGE_PLAN">Change Plan</option>
                        <option value="EXTEND_TRIAL">Extend Trial</option>
                        <option value="OVERRIDE_FEATURES">Override Features</option>
                        <option value="DELETE_TENANT">Delete Tenant</option>
                        <option value="RESET_USER_PASSWORD">Reset Password</option>
                        <option value="DEACTIVATE_USER">Deactivate User</option>
                        <option value="ACTIVATE_USER">Activate User</option>
                    </select>

                    {(targetTypeFilter || actionFilter) && (
                        <button
                            onClick={clearFilters}
                            className="text-sm text-primary-600 hover:text-primary-800 font-medium"
                        >
                            Clear Filters
                        </button>
                    )}
                </div>
            </div>

            {/* Timeline */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                {isLoading ? (
                    <div className="py-12 flex justify-center items-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                    </div>
                ) : Object.keys(groupedLogs).length === 0 ? (
                    <div className="py-12 text-center text-gray-500">
                        <Shield className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                        <p>No audit logs found for the selected criteria.</p>
                    </div>
                ) : (
                    <div className="flow-root">
                        <ul className="-mb-8">
                            {Object.entries(groupedLogs).map(([date, dayLogs], dateIndex, dateArray) => (
                                <React.Fragment key={date}>
                                    {/* Date Header string */}
                                    <li className="mb-4 mt-6 first:mt-0 relative z-10">
                                        <div className="flex items-center">
                                            <div className="bg-gray-100 rounded-full px-3 py-1 flex items-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                                <Calendar className="h-3 w-3 mr-1.5" />
                                                {date}
                                            </div>
                                            <div className="flex-1 border-t border-gray-200 ml-4"></div>
                                        </div>
                                    </li>

                                    {dayLogs.map((log, logIndex) => {
                                        const isLastLocal = logIndex === dayLogs.length - 1
                                        const isLastGlobal = dateIndex === dateArray.length - 1 && isLastLocal

                                        return (
                                            <li key={log._id}>
                                                <div className="relative pb-8">
                                                    {/* Vertical connect line */}
                                                    {!isLastGlobal ? (
                                                        <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true" />
                                                    ) : null}

                                                    <div className="relative flex space-x-4">
                                                        <div>
                                                            <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-4 ring-white border ${getEventColor(log.action)}`}>
                                                                {getEventIcon(log.targetType)}
                                                            </span>
                                                        </div>

                                                        <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                                                            <div className="text-sm text-gray-800">
                                                                <span className="font-semibold text-gray-900">{log.superAdminId?.name || 'Unknown Admin'}</span>
                                                                {' performed '}
                                                                <span className="font-bold text-gray-900">{formatActionName(log.action)}</span>
                                                                {' on '}
                                                                <span className="font-semibold text-gray-700 capitalize">{log.targetType}</span>
                                                                <span className="text-gray-500"> (ID: {String(log.targetId).slice(-6)})</span>

                                                                {/* Changes Payload details */}
                                                                {log.changes && Object.keys(log.changes).length > 0 && (
                                                                    <div className="mt-2 text-xs bg-gray-50 p-2.5 rounded border border-gray-200 font-mono text-gray-600 overflow-x-auto">
                                                                        {JSON.stringify(log.changes, null, 2)}
                                                                    </div>
                                                                )}

                                                                {/* IP address */}
                                                                {log.ip && (
                                                                    <div className="mt-1.5 text-[10px] text-gray-400">
                                                                        IP: {log.ip}
                                                                    </div>
                                                                )}
                                                            </div>

                                                            <div className="text-right text-xs whitespace-nowrap text-gray-500 flex flex-col items-end">
                                                                <time dateTime={log.timestamp}>
                                                                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                </time>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </li>
                                        )
                                    })}
                                </React.Fragment>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            {/* Pagination Controls */}
            {!isLoading && totalPages > 1 && (
                <div className="flex justify-center mt-6">
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                        <button
                            onClick={() => setPage(Math.max(1, page - 1))}
                            disabled={page === 1}
                            className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                        >
                            Previous
                        </button>
                        <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                            Page {page} of {totalPages}
                        </span>
                        <button
                            onClick={() => setPage(Math.min(totalPages, page + 1))}
                            disabled={page === totalPages}
                            className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                        >
                            Next
                        </button>
                    </nav>
                </div>
            )}

        </div>
    )
}

export default SuperAdminAuditLog
