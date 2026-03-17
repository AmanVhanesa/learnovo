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
            case 'employee':
                return <Users className="h-4 w-4" />
            case 'fee':
            case 'payment':
                return <DollarSign className="h-4 w-4" />
            case 'certificate':
                return <FileText className="h-4 w-4" />
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
            bg: 'bg-red-100 dark:bg-red-500/10',
            text: 'text-red-600 dark:text-red-400',
            hover: 'hover:bg-red-50 dark:hover:bg-red-500/5'
        }

        // Color coding by activity type
        const colorMap = {
            student: { bg: 'bg-blue-100 dark:bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400', hover: 'hover:bg-blue-50 dark:hover:bg-blue-500/5' },
            admission: { bg: 'bg-blue-100 dark:bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400', hover: 'hover:bg-blue-50 dark:hover:bg-blue-500/5' },
            employee: { bg: 'bg-purple-100 dark:bg-purple-500/10', text: 'text-purple-600 dark:text-purple-400', hover: 'hover:bg-purple-50 dark:hover:bg-purple-500/5' },
            fee: { bg: 'bg-green-100 dark:bg-green-500/10', text: 'text-green-600 dark:text-green-400', hover: 'hover:bg-green-50 dark:hover:bg-green-500/5' },
            payment: { bg: 'bg-green-100 dark:bg-green-500/10', text: 'text-green-600 dark:text-green-400', hover: 'hover:bg-green-50 dark:hover:bg-green-500/5' },
            certificate: { bg: 'bg-amber-100 dark:bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', hover: 'hover:bg-amber-50 dark:hover:bg-amber-500/5' },
            attendance: { bg: 'bg-teal-100 dark:bg-teal-500/10', text: 'text-teal-600 dark:text-teal-400', hover: 'hover:bg-teal-50 dark:hover:bg-teal-500/5' },
            exam: { bg: 'bg-orange-100 dark:bg-orange-500/10', text: 'text-orange-600 dark:text-orange-400', hover: 'hover:bg-orange-50 dark:hover:bg-orange-500/5' },
            result: { bg: 'bg-orange-100 dark:bg-orange-500/10', text: 'text-orange-600 dark:text-orange-400', hover: 'hover:bg-orange-50 dark:hover:bg-orange-500/5' },
            transport: { bg: 'bg-yellow-100 dark:bg-yellow-500/10', text: 'text-yellow-600 dark:text-yellow-400', hover: 'hover:bg-yellow-50 dark:hover:bg-yellow-500/5' },
            communication: { bg: 'bg-indigo-100 dark:bg-indigo-500/10', text: 'text-indigo-600 dark:text-indigo-400', hover: 'hover:bg-indigo-50 dark:hover:bg-indigo-500/5' },
            message: { bg: 'bg-indigo-100 dark:bg-indigo-500/10', text: 'text-indigo-600 dark:text-indigo-400', hover: 'hover:bg-indigo-50 dark:hover:bg-indigo-500/5' },
            document: { bg: 'bg-pink-100 dark:bg-pink-500/10', text: 'text-pink-600 dark:text-pink-400', hover: 'hover:bg-pink-50 dark:hover:bg-pink-500/5' },
        }

        return colorMap[type] || { bg: 'bg-gray-100 dark:bg-[#2C2C2E]', text: 'text-gray-600 dark:text-[#8E8E93]', hover: 'hover:bg-gray-50 dark:hover:bg-[#2C2C2E]' }
    }

    if (isLoading) {
        return (
            <div className="card p-4 sm:p-6 h-full">
                <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white mb-4">Recent Activities</h3>
                <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="flex gap-3 animate-pulse">
                            <div className="h-10 w-10 bg-gray-200 dark:bg-[#2C2C2E] rounded-full"></div>
                            <div className="flex-1 space-y-2">
                                <div className="h-4 bg-gray-200 dark:bg-[#2C2C2E] rounded w-3/4"></div>
                                <div className="h-3 bg-gray-200 dark:bg-[#2C2C2E] rounded w-1/4"></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    return (
        <>
            <div className="card p-4 sm:p-6 h-full flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white">Recent Activities</h3>
                    {showViewAll && activities.length > 0 && (
                        <button
                            onClick={() => navigate('/app/activities')}
                            className="text-sm text-teal-600 dark:text-[#3EC4B1] hover:text-teal-700 dark:hover:text-[#35a89a] font-medium flex items-center gap-1 transition-colors"
                        >
                            View All
                            <ArrowRight className="h-4 w-4" />
                        </button>
                    )}
                </div>

                <div className="flex-1 space-y-3">
                    {displayActivities.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40 text-gray-400 dark:text-[#636366]">
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
                                    className={`group flex items-start space-x-3 p-3 rounded-lg transition-all ${isClickable ? `${colors.hover} cursor-pointer border border-transparent hover:border-gray-200 dark:hover:border-[#38383A]` : ''
                                        }`}
                                >
                                    <div className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center ${colors.bg} ${colors.text}`}>
                                        {getIcon(activity.type, activity.status)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2">
                                            {activity.message}
                                        </p>
                                        <div className="flex items-center mt-1 text-xs text-gray-500 dark:text-[#8E8E93]">
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
                                        <ChevronRight className="h-4 w-4 text-gray-300 dark:text-[#636366] group-hover:text-teal-500 dark:group-hover:text-[#3EC4B1] transition-colors mt-2 flex-shrink-0" />
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
