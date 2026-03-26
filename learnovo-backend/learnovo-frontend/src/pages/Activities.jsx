import React, { useState, useEffect } from 'react'
import { format, formatDistanceToNow, subDays } from 'date-fns'
import {
    Search,
    Calendar,
    Filter,
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
    ChevronRight
} from 'lucide-react'
import { reportsService } from '../services/reportsService'
import toast from 'react-hot-toast'

const Activities = () => {
    const [activities, setActivities] = useState([])
    const [isLoading, setIsLoading] = useState(true)

    // Initialize with proper date values for 'last7days'
    const getInitialFilters = () => {
        const today = new Date()
        const sevenDaysAgo = subDays(today, 7)
        return {
            search: '',
            dateRange: 'last7days',
            startDate: format(sevenDaysAgo, 'yyyy-MM-dd'),
            endDate: format(today, 'yyyy-MM-dd'),
            type: 'all'
        }
    }

    const [filters, setFilters] = useState(getInitialFilters())
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0
    })

    // Scroll to top when component mounts
    useEffect(() => {
        // Find the scrollable main container and scroll it to top
        const mainContent = document.querySelector('main')
        if (mainContent) {
            mainContent.scrollTo({ top: 0, behavior: 'instant' })
        }
        // Also scroll window as fallback
        window.scrollTo({ top: 0, behavior: 'instant' })
    }, [])

    useEffect(() => {
        fetchActivities()
    }, [filters, pagination.page])

    const fetchActivities = async () => {
        try {
            setIsLoading(true)
            const res = await reportsService.getRecentActivities({
                ...filters,
                page: pagination.page,
                limit: pagination.limit
            })

            if (res.success) {
                setActivities(res.data || [])
                setPagination(prev => ({
                    ...prev,
                    total: res.total || res.data?.length || 0,
                    totalPages: Math.ceil((res.total || res.data?.length || 0) / prev.limit)
                }))
            }
        } catch (error) {
            console.error('Error fetching activities:', error)
            toast.error('Failed to load activities')
        } finally {
            setIsLoading(false)
        }
    }

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
            case 'custom':
                // User will set custom dates - don't update dates yet
                setFilters(prev => ({
                    ...prev,
                    dateRange: range
                }))
                return
            default:
                // 'all' - clear date filters
                startDate = ''
                endDate = ''
        }

        setFilters(prev => ({
            ...prev,
            dateRange: range,
            startDate,
            endDate
        }))
        setPagination(prev => ({ ...prev, page: 1 }))
    }

    const handleExport = async () => {
        try {
            toast.loading('Generating CSV...')

            // Fetch all activities with current filters (no pagination limit)
            const res = await reportsService.getRecentActivities({
                ...filters,
                limit: 10000, // Get all activities
                page: 1
            })

            if (!res.success || !res.data || res.data.length === 0) {
                toast.dismiss()
                toast.error('No activities to export')
                return
            }

            // Prepare CSV data
            const csvData = res.data.map(activity => ({
                'Date': format(new Date(activity.date), 'MMM d, yyyy'),
                'Time': format(new Date(activity.date), 'h:mm a'),
                'Type': activity.type.charAt(0).toUpperCase() + activity.type.slice(1),
                'Activity': activity.message,
                'Student': activity.studentName || 'N/A',
                'Amount': activity.amount ? `₹${activity.amount}` : 'N/A'
            }))

            // Convert to CSV string
            const headers = Object.keys(csvData[0])
            const csvRows = [
                headers.join(','), // Header row
                ...csvData.map(row =>
                    headers.map(header => {
                        const value = row[header]
                        // Escape quotes and wrap in quotes if contains comma
                        const escaped = String(value).replace(/"/g, '""')
                        return escaped.includes(',') ? `"${escaped}"` : escaped
                    }).join(',')
                )
            ]
            const csvString = csvRows.join('\n')

            // Create blob and download
            const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' })
            const link = document.createElement('a')
            const url = URL.createObjectURL(blob)

            // Generate filename with date range
            const dateRangeText = filters.dateRange === 'all' ? 'all-time' :
                filters.dateRange === 'today' ? 'today' :
                    filters.dateRange === 'last7days' ? 'last-7-days' :
                        filters.dateRange === 'last30days' ? 'last-30-days' :
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
            student: { bg: 'bg-blue-100', text: 'text-blue-600', border: 'border-blue-200' },
            admission: { bg: 'bg-blue-100', text: 'text-blue-600', border: 'border-blue-200' },
            employee: { bg: 'bg-purple-100', text: 'text-purple-600', border: 'border-purple-200' },
            fee: { bg: 'bg-green-100', text: 'text-green-600', border: 'border-green-200' },
            payment: { bg: 'bg-green-100', text: 'text-green-600', border: 'border-green-200' },
            certificate: { bg: 'bg-amber-100', text: 'text-amber-600', border: 'border-amber-200' },
            attendance: { bg: 'bg-teal-100', text: 'text-teal-600', border: 'border-teal-200' },
            exam: { bg: 'bg-orange-100', text: 'text-orange-600', border: 'border-orange-200' },
            result: { bg: 'bg-orange-100', text: 'text-orange-600', border: 'border-orange-200' },
            transport: { bg: 'bg-yellow-100', text: 'text-yellow-600', border: 'border-yellow-200' },
            communication: { bg: 'bg-indigo-100', text: 'text-indigo-600', border: 'border-indigo-200' },
            message: { bg: 'bg-indigo-100', text: 'text-indigo-600', border: 'border-indigo-200' },
            document: { bg: 'bg-pink-100', text: 'text-pink-600', border: 'border-pink-200' },
        }
        return colorMap[type] || { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200' }
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
            key = format(date, 'MMM d, yyyy')
        }

        if (!groups[key]) groups[key] = []
        groups[key].push(activity)
        return groups
    }, {})

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Activities</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        View and filter all system activities
                    </p>
                </div>
                <button
                    onClick={handleExport}
                    className="btn btn-outline gap-2"
                >
                    <Download className="h-4 w-4" />
                    Export
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-lg shadow-sm p-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Search */}
                    <div className="md:col-span-2">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search activities..."
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
                    <div>
                        <select
                            value={filters.dateRange}
                            onChange={(e) => handleDateRangeChange(e.target.value)}
                            className="input"
                        >
                            <option value="all">All Time</option>
                            <option value="today">Today</option>
                            <option value="last7days">Last 7 Days</option>
                            <option value="last30days">Last 30 Days</option>
                            <option value="custom">Custom Range</option>
                        </select>
                    </div>

                    {/* Activity Type */}
                    <div>
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
                            <option value="employee">Employees</option>
                            <option value="fee">Fees</option>
                            <option value="certificate">Certificates</option>
                            <option value="attendance">Attendance</option>
                            <option value="exam">Exams</option>
                            <option value="transport">Transport</option>
                            <option value="communication">Communication</option>
                            <option value="document">Documents</option>
                        </select>
                    </div>
                </div>

                {/* Custom Date Range */}
                {filters.dateRange === 'custom' && (
                    <div className="grid grid-cols-2 gap-4 mt-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Start Date
                            </label>
                            <input
                                type="date"
                                value={filters.startDate}
                                onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                                className="input"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                End Date
                            </label>
                            <input
                                type="date"
                                value={filters.endDate}
                                onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                                className="input"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Activities List */}
            <div className="bg-white rounded-lg shadow-sm p-6">
                {isLoading ? (
                    <div className="space-y-4">
                        {[1, 2, 3, 4, 5].map(i => (
                            <div key={i} className="flex gap-4 animate-pulse">
                                <div className="h-12 w-12 bg-gray-200 rounded-full"></div>
                                <div className="flex-1 space-y-2">
                                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                                    <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : activities.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                        <AlertTriangle className="h-12 w-12 mb-3 opacity-30" />
                        <p className="text-lg font-medium">No activities found</p>
                        <p className="text-sm">Try adjusting your filters</p>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {Object.entries(groupedActivities).map(([dateLabel, groupItems]) => (
                            <div key={dateLabel}>
                                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <Calendar className="h-4 w-4" />
                                    {dateLabel}
                                </h3>
                                <div className="space-y-3">
                                    {groupItems.map((activity) => {
                                        const colors = getColorClasses(activity.type)
                                        return (
                                            <div
                                                key={activity.id}
                                                className={`flex items-start gap-4 p-4 rounded-lg border ${colors.border} hover:shadow-sm transition-shadow`}
                                            >
                                                <div className={`flex-shrink-0 h-12 w-12 rounded-full flex items-center justify-center ${colors.bg} ${colors.text}`}>
                                                    {getIcon(activity.type)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-gray-900">
                                                        {activity.message}
                                                    </p>
                                                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                                                        <span>
                                                            {formatDistanceToNow(new Date(activity.date), { addSuffix: true })}
                                                        </span>
                                                        {activity.studentName && (
                                                            <>
                                                                <span>•</span>
                                                                <span>{activity.studentName}</span>
                                                            </>
                                                        )}
                                                        <span>•</span>
                                                        <span>{format(new Date(activity.date), 'h:mm a')}</span>
                                                    </div>
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
                {!isLoading && activities.length > 0 && pagination.totalPages > 1 && (
                    <div className="flex items-center justify-between mt-6 pt-6 border-t">
                        <p className="text-sm text-gray-500">
                            Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} activities
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                                disabled={pagination.page === 1}
                                className="btn btn-ghost btn-sm"
                            >
                                <ChevronLeft className="h-4 w-4" />
                                Previous
                            </button>
                            <span className="text-sm text-gray-600">
                                Page {pagination.page} of {pagination.totalPages}
                            </span>
                            <button
                                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                                disabled={pagination.page >= pagination.totalPages}
                                className="btn btn-ghost btn-sm"
                            >
                                Next
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

export default Activities
