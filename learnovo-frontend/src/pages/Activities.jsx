import React, { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, formatDistanceToNow, subDays } from 'date-fns'
import {
    Search,
    Calendar,
    Download,
    UserPlus,
    DollarSign,
    CheckCircle,
    BarChart,
    Bus,
    Mail,
    FileText,
    Users,
    AlertTriangle,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    Clock
} from 'lucide-react'
import { reportsService } from '../services/reportsService'
import toast from 'react-hot-toast'

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200]

const Activities = () => {
    const getInitialFilters = () => {
        const today = new Date()
        return {
            search: '',
            dateRange: 'all',
            startDate: '',
            endDate: format(today, 'yyyy-MM-dd'),
            type: 'all'
        }
    }

    const [filters, setFilters] = useState(getInitialFilters())
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 50,
        total: 0,
        totalPages: 0
    })

    useEffect(() => {
        const mainContent = document.querySelector('main')
        if (mainContent) mainContent.scrollTo({ top: 0, behavior: 'instant' })
        window.scrollTo({ top: 0, behavior: 'instant' })
    }, [])

    const { data: queryData, isLoading } = useQuery({
        queryKey: ['activities', filters, pagination.page, pagination.limit],
        queryFn: async () => {
            const res = await reportsService.getRecentActivities({
                ...filters,
                page: pagination.page,
                limit: pagination.limit
            })
            if (res.success) {
                return {
                    activities: res.data || [],
                    total: res.total || res.data?.length || 0,
                }
            }
            return { activities: [], total: 0 }
        },
        placeholderData: (prev) => prev,
    })

    const activities = queryData?.activities || []

    useEffect(() => {
        if (queryData) {
            setPagination(prev => ({
                ...prev,
                total: queryData.total,
                totalPages: Math.ceil(queryData.total / prev.limit)
            }))
        }
    }, [queryData])

    const handleDateRangeChange = (range) => {
        const today = new Date()
        let startDate = ''
        let endDate = format(today, 'yyyy-MM-dd')

        switch (range) {
            case 'today':
                startDate = format(today, 'yyyy-MM-dd')
                break
            case 'last7days':
                startDate = format(subDays(today, 7), 'yyyy-MM-dd')
                break
            case 'last30days':
                startDate = format(subDays(today, 30), 'yyyy-MM-dd')
                break
            case 'last90days':
                startDate = format(subDays(today, 90), 'yyyy-MM-dd')
                break
            case 'custom':
                setFilters(prev => ({ ...prev, dateRange: range }))
                return
            default:
                startDate = ''
                endDate = ''
        }

        setFilters(prev => ({ ...prev, dateRange: range, startDate, endDate }))
        setPagination(prev => ({ ...prev, page: 1 }))
    }

    const handlePageSizeChange = (newSize) => {
        setPagination(prev => ({ ...prev, limit: newSize, page: 1 }))
    }

    const handleExport = async () => {
        try {
            toast.loading('Generating CSV...')
            const res = await reportsService.getRecentActivities({
                ...filters,
                limit: 10000,
                page: 1
            })
            if (!res.success || !res.data || res.data.length === 0) {
                toast.dismiss()
                toast.error('No activities to export')
                return
            }
            const csvData = res.data.map(activity => ({
                'Date': format(new Date(activity.date), 'MMM d, yyyy'),
                'Time': format(new Date(activity.date), 'h:mm a'),
                'Type': activity.type.charAt(0).toUpperCase() + activity.type.slice(1),
                'Activity': activity.message,
                'Student': activity.studentName || 'N/A',
                'Amount': activity.amount ? `\u20B9${activity.amount}` : 'N/A'
            }))
            const headers = Object.keys(csvData[0])
            const csvRows = [
                headers.join(','),
                ...csvData.map(row =>
                    headers.map(header => {
                        const value = row[header]
                        const escaped = String(value).replace(/"/g, '""')
                        return escaped.includes(',') ? `"${escaped}"` : escaped
                    }).join(',')
                )
            ]
            const csvString = csvRows.join('\n')
            const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' })
            const link = document.createElement('a')
            const url = URL.createObjectURL(blob)
            const dateRangeText = filters.dateRange === 'all' ? 'all-time' :
                filters.dateRange === 'today' ? 'today' :
                    filters.dateRange === 'last7days' ? 'last-7-days' :
                        filters.dateRange === 'last30days' ? 'last-30-days' :
                            filters.dateRange === 'last90days' ? 'last-90-days' :
                                'custom'
            const filename = `activities-${dateRangeText}-${format(new Date(), 'yyyy-MM-dd')}.csv`
            link.setAttribute('href', url)
            link.setAttribute('download', filename)
            link.style.visibility = 'hidden'
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            toast.dismiss()
            toast.success(`Exported ${res.data.length} activities to ${filename}`)
        } catch (error) {
            console.error('Export error:', error)
            toast.dismiss()
            toast.error('Failed to export activities')
        }
    }

    const getIcon = (type) => {
        const iconMap = {
            student: UserPlus,
            admission: UserPlus,
            employee: Users,
            fee: DollarSign,
            payment: DollarSign,
            certificate: FileText,
            attendance: CheckCircle,
            exam: BarChart,
            result: BarChart,
            transport: Bus,
            communication: Mail,
            message: Mail,
            document: FileText,
        }
        const Icon = iconMap[type] || Users
        return <Icon className="h-5 w-5" />
    }

    const getColorClasses = (type) => {
        const colorMap = {
            student: { bg: 'bg-blue-100 dark:bg-blue-500/15', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-500/20' },
            admission: { bg: 'bg-blue-100 dark:bg-blue-500/15', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-500/20' },
            employee: { bg: 'bg-purple-100 dark:bg-purple-500/15', text: 'text-purple-600 dark:text-purple-400', border: 'border-purple-200 dark:border-purple-500/20' },
            fee: { bg: 'bg-green-100 dark:bg-green-500/15', text: 'text-green-600 dark:text-green-400', border: 'border-green-200 dark:border-green-500/20' },
            payment: { bg: 'bg-green-100 dark:bg-green-500/15', text: 'text-green-600 dark:text-green-400', border: 'border-green-200 dark:border-green-500/20' },
            certificate: { bg: 'bg-amber-100 dark:bg-amber-500/15', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-500/20' },
            attendance: { bg: 'bg-teal-100 dark:bg-teal-500/15', text: 'text-teal-600 dark:text-teal-400', border: 'border-teal-200 dark:border-teal-500/20' },
            exam: { bg: 'bg-orange-100 dark:bg-orange-500/15', text: 'text-orange-600 dark:text-orange-400', border: 'border-orange-200 dark:border-orange-500/20' },
            result: { bg: 'bg-orange-100 dark:bg-orange-500/15', text: 'text-orange-600 dark:text-orange-400', border: 'border-orange-200 dark:border-orange-500/20' },
            transport: { bg: 'bg-yellow-100 dark:bg-yellow-500/15', text: 'text-yellow-600 dark:text-yellow-400', border: 'border-yellow-200 dark:border-yellow-500/20' },
            communication: { bg: 'bg-indigo-100 dark:bg-indigo-500/15', text: 'text-indigo-600 dark:text-indigo-400', border: 'border-indigo-200 dark:border-indigo-500/20' },
            message: { bg: 'bg-indigo-100 dark:bg-indigo-500/15', text: 'text-indigo-600 dark:text-indigo-400', border: 'border-indigo-200 dark:border-indigo-500/20' },
            document: { bg: 'bg-pink-100 dark:bg-pink-500/15', text: 'text-pink-600 dark:text-pink-400', border: 'border-pink-200 dark:border-pink-500/20' },
        }
        return colorMap[type] || { bg: 'bg-gray-100 dark:bg-[#2C2C2E]', text: 'text-gray-600 dark:text-[#8E8E93]', border: 'border-gray-200 dark:border-[#38383A]' }
    }

    // Group activities by date
    const groupedActivities = activities.reduce((groups, activity) => {
        const date = new Date(activity.date)
        const today = new Date()
        const yesterday = subDays(today, 1)

        let key
        if (format(date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')) {
            key = 'Today'
        } else if (format(date, 'yyyy-MM-dd') === format(yesterday, 'yyyy-MM-dd')) {
            key = 'Yesterday'
        } else {
            key = format(date, 'EEEE, MMM d, yyyy')
        }

        if (!groups[key]) groups[key] = []
        groups[key].push(activity)
        return groups
    }, {})

    const startItem = ((pagination.page - 1) * pagination.limit) + 1
    const endItem = Math.min(pagination.page * pagination.limit, pagination.total)

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Activities</h1>
                    <p className="text-sm text-gray-500 dark:text-[#8E8E93] mt-1">
                        View and filter all system activities
                        {pagination.total > 0 && (
                            <span className="ml-2 text-xs bg-primary-50 dark:bg-primary-500/10 text-primary-700 dark:text-[#3EC4B1] px-2 py-0.5 rounded-full font-medium">
                                {pagination.total.toLocaleString()} total
                            </span>
                        )}
                    </p>
                </div>
                <button
                    onClick={handleExport}
                    className="btn btn-outline gap-2 w-full sm:w-auto justify-center"
                >
                    <Download className="h-4 w-4" />
                    Export
                </button>
            </div>

            {/* Filters */}
            <div className="card p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
                    {/* Search */}
                    <div className="sm:col-span-2 lg:col-span-5">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-[#636366]" />
                            <input
                                type="text"
                                placeholder="Search by activity, student name, amount..."
                                value={filters.search}
                                onChange={(e) => {
                                    setFilters(prev => ({ ...prev, search: e.target.value }))
                                    setPagination(prev => ({ ...prev, page: 1 }))
                                }}
                                className="input pl-10"
                            />
                        </div>
                    </div>

                    {/* Date Range */}
                    <div className="lg:col-span-3">
                        <select
                            value={filters.dateRange}
                            onChange={(e) => handleDateRangeChange(e.target.value)}
                            className="input"
                        >
                            <option value="all">All Time</option>
                            <option value="today">Today</option>
                            <option value="last7days">Last 7 Days</option>
                            <option value="last30days">Last 30 Days</option>
                            <option value="last90days">Last 90 Days</option>
                            <option value="custom">Custom Range</option>
                        </select>
                    </div>

                    {/* Activity Type */}
                    <div className="lg:col-span-2">
                        <select
                            value={filters.type}
                            onChange={(e) => {
                                setFilters(prev => ({ ...prev, type: e.target.value }))
                                setPagination(prev => ({ ...prev, page: 1 }))
                            }}
                            className="input"
                        >
                            <option value="all">All Types</option>
                            <option value="admission">Admissions</option>
                            <option value="student">Students</option>
                            <option value="employee">Employees</option>
                            <option value="fee">Fees</option>
                            <option value="payment">Payments</option>
                            <option value="certificate">Certificates</option>
                            <option value="attendance">Attendance</option>
                            <option value="exam">Exams</option>
                            <option value="transport">Transport</option>
                            <option value="communication">Communication</option>
                            <option value="document">Documents</option>
                        </select>
                    </div>

                    {/* Per Page */}
                    <div className="lg:col-span-2">
                        <select
                            value={pagination.limit}
                            onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                            className="input"
                        >
                            {PAGE_SIZE_OPTIONS.map(size => (
                                <option key={size} value={size}>{size} per page</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Custom Date Range */}
                {filters.dateRange === 'custom' && (
                    <div className="grid grid-cols-2 gap-4 mt-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">
                                Start Date
                            </label>
                            <input
                                type="date"
                                value={filters.startDate}
                                onChange={(e) => {
                                    setFilters(prev => ({ ...prev, startDate: e.target.value }))
                                    setPagination(prev => ({ ...prev, page: 1 }))
                                }}
                                className="input"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">
                                End Date
                            </label>
                            <input
                                type="date"
                                value={filters.endDate}
                                onChange={(e) => {
                                    setFilters(prev => ({ ...prev, endDate: e.target.value }))
                                    setPagination(prev => ({ ...prev, page: 1 }))
                                }}
                                className="input"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Activities List */}
            <div className="card p-4 sm:p-6">
                {isLoading ? (
                    <div className="space-y-4">
                        {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                            <div key={i} className="flex gap-4 animate-pulse">
                                <div className="h-10 w-10 bg-gray-200 dark:bg-[#2C2C2E] rounded-full flex-shrink-0"></div>
                                <div className="flex-1 space-y-2 py-1">
                                    <div className="h-4 bg-gray-200 dark:bg-[#2C2C2E] rounded w-3/4"></div>
                                    <div className="h-3 bg-gray-200 dark:bg-[#2C2C2E] rounded w-2/5"></div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : activities.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-[#636366]">
                        <AlertTriangle className="h-12 w-12 mb-3 opacity-30" />
                        <p className="text-lg font-medium text-gray-500 dark:text-[#8E8E93]">No activities found</p>
                        <p className="text-sm mt-1">Try adjusting your filters or date range</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {Object.entries(groupedActivities).map(([dateLabel, groupItems]) => (
                            <div key={dateLabel}>
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-[#2C2C2E] rounded-lg">
                                        <Calendar className="h-3.5 w-3.5 text-gray-500 dark:text-[#8E8E93]" />
                                        <span className="text-xs font-semibold text-gray-600 dark:text-[#8E8E93] uppercase tracking-wider">
                                            {dateLabel}
                                        </span>
                                    </div>
                                    <span className="text-xs text-gray-400 dark:text-[#636366]">
                                        {groupItems.length} {groupItems.length === 1 ? 'activity' : 'activities'}
                                    </span>
                                    <div className="flex-1 border-t border-gray-100 dark:border-[#2C2C2E]"></div>
                                </div>
                                <div className="space-y-2">
                                    {groupItems.map((activity) => {
                                        const colors = getColorClasses(activity.type)
                                        return (
                                            <div
                                                key={activity.id}
                                                className={`flex items-start gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl border ${colors.border} hover:shadow-sm dark:hover:bg-[#2C2C2E]/30 transition-all`}
                                            >
                                                <div className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center ${colors.bg} ${colors.text}`}>
                                                    {getIcon(activity.type)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                                                        {activity.message}
                                                    </p>
                                                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1.5">
                                                        <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-[#8E8E93]">
                                                            <Clock className="h-3 w-3" />
                                                            {format(new Date(activity.date), 'h:mm a')}
                                                        </span>
                                                        <span className="text-xs text-gray-400 dark:text-[#636366]">
                                                            {formatDistanceToNow(new Date(activity.date), { addSuffix: true })}
                                                        </span>
                                                        {activity.studentName && (
                                                            <>
                                                                <span className="text-gray-300 dark:text-[#48484A]">&bull;</span>
                                                                <span className="text-xs text-gray-600 dark:text-[#8E8E93] font-medium">{activity.studentName}</span>
                                                            </>
                                                        )}
                                                        {activity.amount && (
                                                            <>
                                                                <span className="text-gray-300 dark:text-[#48484A]">&bull;</span>
                                                                <span className="text-xs font-semibold text-green-600 dark:text-green-400">
                                                                    ₹{Number(activity.amount).toLocaleString('en-IN')}
                                                                </span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="hidden sm:block flex-shrink-0">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium uppercase tracking-wider ${colors.bg} ${colors.text}`}>
                                                        {activity.type}
                                                    </span>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Pagination */}
                {!isLoading && activities.length > 0 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between mt-6 pt-6 border-t border-gray-200 dark:border-[#38383A] gap-3">
                        <p className="text-sm text-gray-500 dark:text-[#8E8E93] text-center sm:text-left">
                            Showing <span className="font-medium text-gray-700 dark:text-white">{startItem}</span> to <span className="font-medium text-gray-700 dark:text-white">{endItem}</span> of <span className="font-medium text-gray-700 dark:text-white">{pagination.total.toLocaleString()}</span> activities
                        </p>
                        {pagination.totalPages > 1 && (
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setPagination(prev => ({ ...prev, page: 1 }))}
                                    disabled={pagination.page === 1}
                                    className="btn btn-ghost btn-sm"
                                    title="First page"
                                >
                                    <ChevronsLeft className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                                    disabled={pagination.page === 1}
                                    className="btn btn-ghost btn-sm"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                    <span className="hidden sm:inline">Prev</span>
                                </button>
                                <span className="text-sm text-gray-600 dark:text-[#8E8E93] px-3">
                                    {pagination.page} / {pagination.totalPages}
                                </span>
                                <button
                                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                                    disabled={pagination.page >= pagination.totalPages}
                                    className="btn btn-ghost btn-sm"
                                >
                                    <span className="hidden sm:inline">Next</span>
                                    <ChevronRight className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={() => setPagination(prev => ({ ...prev, page: pagination.totalPages }))}
                                    disabled={pagination.page >= pagination.totalPages}
                                    className="btn btn-ghost btn-sm"
                                    title="Last page"
                                >
                                    <ChevronsRight className="h-4 w-4" />
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

export default Activities
