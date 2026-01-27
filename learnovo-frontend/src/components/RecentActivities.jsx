import React, { useState } from 'react'
import { format, isToday, isYesterday } from 'date-fns'
import {
    CreditCard,
    AlertTriangle,
    Users,
    FileText,
    Clock,
    ChevronRight
} from 'lucide-react'
import FeeDetailsModal from './FeeDetailsModal'

const RecentActivities = ({ activities = [], isLoading = false }) => {
    const [selectedActivity, setSelectedActivity] = useState(null)
    const [detailsModalOpen, setDetailsModalOpen] = useState(false)

    // Group activities by date
    const groupedActivities = activities.reduce((groups, activity) => {
        const date = new Date(activity.date)
        let key = format(date, 'yyyy-MM-dd')

        if (isToday(date)) key = 'Today'
        else if (isYesterday(date)) key = 'Yesterday'
        else key = format(date, 'MMM d, yyyy')

        if (!groups[key]) groups[key] = []
        groups[key].push(activity)
        return groups
    }, {})

    const handleActivityClick = (activity) => {
        // Only drill down for 'fee' type activities that are successful payments
        if (activity.type === 'fee' && activity.status === 'success') {
            setSelectedActivity(activity)
            setDetailsModalOpen(true)
        }
    }

    const getIcon = (type, status) => {
        if (status === 'danger') return <AlertTriangle className="h-4 w-4 text-red-600" />
        if (type === 'student') return <Users className="h-4 w-4 text-blue-600" />
        if (type === 'fee') return <CreditCard className="h-4 w-4 text-teal-600" />
        return <FileText className="h-4 w-4 text-gray-600" />
    }

    const getBgColor = (status) => {
        if (status === 'danger') return 'bg-red-100'
        if (status === 'success') return 'bg-teal-100'
        return 'bg-gray-100'
    }

    if (isLoading) {
        return (
            <div className="bg-white rounded-lg shadow-sm p-6 h-full">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Activities</h3>
                <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="flex gap-3 animate-pulse">
                            <div className="h-8 w-8 bg-gray-200 rounded-full"></div>
                            <div className="flex-1 space-y-2">
                                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                                <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    return (
        <>
            <div className="bg-white rounded-lg shadow-sm p-6 h-full flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium text-gray-900">Recent Activities</h3>
                    {/* <button className="text-sm text-teal-600 hover:text-teal-700 font-medium">View All</button> */}
                </div>

                <div className="flex-1 overflow-y-auto pr-2 space-y-6 custom-scrollbar">
                    {activities.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                            <Clock className="h-8 w-8 mb-2 opacity-30" />
                            <p className="text-sm">No recent activities</p>
                        </div>
                    ) : (
                        Object.entries(groupedActivities).map(([dateLabel, groupItems]) => (
                            <div key={dateLabel}>
                                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 pl-1">
                                    {dateLabel}
                                </h4>
                                <div className="space-y-3">
                                    {groupItems.map((activity) => (
                                        <div
                                            key={activity.id}
                                            onClick={() => handleActivityClick(activity)}
                                            className={`group flex items-start space-x-3 p-2 rounded-lg transition-colors ${activity.type === 'fee' && activity.status === 'success'
                                                    ? 'hover:bg-gray-50 cursor-pointer'
                                                    : ''
                                                }`}
                                        >
                                            <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${getBgColor(activity.status)}`}>
                                                {getIcon(activity.type, activity.status)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-900 line-clamp-2">
                                                    {activity.message}
                                                </p>
                                                <div className="flex items-center mt-1">
                                                    <span className="text-xs text-gray-500">
                                                        {format(new Date(activity.date), 'h:mm a')}
                                                    </span>
                                                    {activity.studentName && (
                                                        <>
                                                            <span className="mx-1 text-gray-300">•</span>
                                                            <span className="text-xs text-gray-500 truncate max-w-[120px]">
                                                                {activity.studentName}
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Drill-down indicator */}
                                            {activity.type === 'fee' && activity.status === 'success' && (
                                                <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-teal-500 transition-colors mt-2" />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <FeeDetailsModal
                    isOpen={detailsModalOpen}
                    onClose={() => setDetailsModalOpen(false)}
                    initialDate={selectedActivity?.date}
                />
            </div>
        </>
    )
}

export default RecentActivities
