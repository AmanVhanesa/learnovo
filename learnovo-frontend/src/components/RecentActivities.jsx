import React, { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import {
    CreditCard,
    AlertTriangle,
    Users,
    FileText,
    Clock,
    ChevronRight,
    UserPlus,
    DollarSign,
    CheckCircle,
    BarChart,
    Bus,
    Mail,
    ArrowRight
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import FeeDetailsModal from './FeeDetailsModal'

const RecentActivities = ({ activities = [], isLoading = false, limit = 5, showViewAll = true }) => {
    const [selectedActivity, setSelectedActivity] = useState(null)
    const [detailsModalOpen, setDetailsModalOpen] = useState(false)
    const navigate = useNavigate()

    // Limit activities for dashboard widget
    const displayActivities = limit ? activities.slice(0, limit) : activities

    const handleActivityClick = (activity) => {
        // Only drill down for 'fee' type activities that are successful payments
        if (activity.type === 'fee' && activity.status === 'success') {
            setSelectedActivity(activity)
            setDetailsModalOpen(true)
        }
    }

    const getIcon = (type, status) => {
        if (status === 'danger') return <AlertTriangle className="h-4 w-4" />

        // Enhanced icon mapping
        switch (type) {
            case 'student':
            case 'admission':
                return <UserPlus className="h-4 w-4" />
            case 'fee':
            case 'payment':
                return <DollarSign className="h-4 w-4" />
            case 'attendance':
                return <CheckCircle className="h-4 w-4" />
            case 'exam':
            case 'result':
                return <BarChart className="h-4 w-4" />
            case 'transport':
                return <Bus className="h-4 w-4" />
            case 'communication':
            case 'message':
                return <Mail className="h-4 w-4" />
            case 'document':
                return <FileText className="h-4 w-4" />
            default:
                return <Users className="h-4 w-4" />
        }
    }

    const getColorClasses = (type, status) => {
        if (status === 'danger') return {
            bg: 'bg-red-100',
            text: 'text-red-600',
            hover: 'hover:bg-red-50'
        }

        // Color coding by activity type
        const colorMap = {
            student: { bg: 'bg-blue-100', text: 'text-blue-600', hover: 'hover:bg-blue-50' },
            admission: { bg: 'bg-blue-100', text: 'text-blue-600', hover: 'hover:bg-blue-50' },
            fee: { bg: 'bg-green-100', text: 'text-green-600', hover: 'hover:bg-green-50' },
            payment: { bg: 'bg-green-100', text: 'text-green-600', hover: 'hover:bg-green-50' },
            attendance: { bg: 'bg-teal-100', text: 'text-teal-600', hover: 'hover:bg-teal-50' },
            exam: { bg: 'bg-orange-100', text: 'text-orange-600', hover: 'hover:bg-orange-50' },
            result: { bg: 'bg-orange-100', text: 'text-orange-600', hover: 'hover:bg-orange-50' },
            transport: { bg: 'bg-yellow-100', text: 'text-yellow-600', hover: 'hover:bg-yellow-50' },
            communication: { bg: 'bg-indigo-100', text: 'text-indigo-600', hover: 'hover:bg-indigo-50' },
            message: { bg: 'bg-indigo-100', text: 'text-indigo-600', hover: 'hover:bg-indigo-50' },
            document: { bg: 'bg-purple-100', text: 'text-purple-600', hover: 'hover:bg-purple-50' },
        }

        return colorMap[type] || { bg: 'bg-gray-100', text: 'text-gray-600', hover: 'hover:bg-gray-50' }
    }

    if (isLoading) {
        return (
            <div className="bg-white rounded-lg shadow-sm p-6 h-full">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Activities</h3>
                <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="flex gap-3 animate-pulse">
                            <div className="h-10 w-10 bg-gray-200 rounded-full"></div>
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
                    {showViewAll && activities.length > 0 && (
                        <button
                            onClick={() => navigate('/app/activities')}
                            className="text-sm text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1 transition-colors"
                        >
                            View All
                            <ArrowRight className="h-4 w-4" />
                        </button>
                    )}
                </div>

                <div className="flex-1 space-y-3">
                    {displayActivities.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                            <Clock className="h-8 w-8 mb-2 opacity-30" />
                            <p className="text-sm">No recent activities</p>
                        </div>
                    ) : (
                        displayActivities.map((activity) => {
                            const colors = getColorClasses(activity.type, activity.status)
                            const isClickable = activity.type === 'fee' && activity.status === 'success'

                            return (
                                <div
                                    key={activity.id}
                                    onClick={() => handleActivityClick(activity)}
                                    className={`group flex items-start space-x-3 p-3 rounded-lg transition-all ${isClickable ? `${colors.hover} cursor-pointer border border-transparent hover:border-gray-200` : ''
                                        }`}
                                >
                                    <div className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center ${colors.bg} ${colors.text}`}>
                                        {getIcon(activity.type, activity.status)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900 line-clamp-2">
                                            {activity.message}
                                        </p>
                                        <div className="flex items-center mt-1 text-xs text-gray-500">
                                            <span>
                                                {formatDistanceToNow(new Date(activity.date), { addSuffix: true })}
                                            </span>
                                            {activity.studentName && (
                                                <>
                                                    <span className="mx-1.5">•</span>
                                                    <span className="truncate max-w-[150px]">
                                                        {activity.studentName}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Drill-down indicator */}
                                    {isClickable && (
                                        <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-teal-500 transition-colors mt-2 flex-shrink-0" />
                                    )}
                                </div>
                            )
                        })
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
