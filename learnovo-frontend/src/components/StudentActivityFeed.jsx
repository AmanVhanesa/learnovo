import React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import {
  Megaphone,
  FileText,
  ClipboardList,
  Calendar,
  CheckCircle2,
  Bell,
  Clock,
  CheckCheck,
  Loader2
} from 'lucide-react'
import notificationsService from '../services/notificationsService'
import toast from 'react-hot-toast'

// Map notification categories to activity types with distinct icons and colors
const ACTIVITY_TYPE_MAP = {
  // Announcements
  announcement: { label: 'Announcement', Icon: Megaphone, bg: 'bg-amber-100 dark:bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', tag: 'bg-amber-50 dark:bg-amber-500/5 text-amber-700 dark:text-amber-300' },
  // Homework
  homework: { label: 'Homework', Icon: FileText, bg: 'bg-blue-100 dark:bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400', tag: 'bg-blue-50 dark:bg-blue-500/5 text-blue-700 dark:text-blue-300' },
  // Assignments
  assignment_graded: { label: 'Assignment', Icon: ClipboardList, bg: 'bg-indigo-100 dark:bg-indigo-500/10', text: 'text-indigo-600 dark:text-indigo-400', tag: 'bg-indigo-50 dark:bg-indigo-500/5 text-indigo-700 dark:text-indigo-300' },
  academic: { label: 'Assignment', Icon: ClipboardList, bg: 'bg-indigo-100 dark:bg-indigo-500/10', text: 'text-indigo-600 dark:text-indigo-400', tag: 'bg-indigo-50 dark:bg-indigo-500/5 text-indigo-700 dark:text-indigo-300' },
  // Exams
  exam: { label: 'Exam', Icon: Calendar, bg: 'bg-purple-100 dark:bg-purple-500/10', text: 'text-purple-600 dark:text-purple-400', tag: 'bg-purple-50 dark:bg-purple-500/5 text-purple-700 dark:text-purple-300' },
  exam_scheduled: { label: 'Exam', Icon: Calendar, bg: 'bg-purple-100 dark:bg-purple-500/10', text: 'text-purple-600 dark:text-purple-400', tag: 'bg-purple-50 dark:bg-purple-500/5 text-purple-700 dark:text-purple-300' },
  // Results / Grades
  exam_result: { label: 'Result', Icon: CheckCircle2, bg: 'bg-green-100 dark:bg-green-500/10', text: 'text-green-600 dark:text-green-400', tag: 'bg-green-50 dark:bg-green-500/5 text-green-700 dark:text-green-300' },
  // Fees
  fee_due: { label: 'Fee', Icon: Bell, bg: 'bg-red-100 dark:bg-red-500/10', text: 'text-red-600 dark:text-red-400', tag: 'bg-red-50 dark:bg-red-500/5 text-red-700 dark:text-red-300' },
  fee_reminder: { label: 'Fee', Icon: Bell, bg: 'bg-red-100 dark:bg-red-500/10', text: 'text-red-600 dark:text-red-400', tag: 'bg-red-50 dark:bg-red-500/5 text-red-700 dark:text-red-300' },
  // Attendance
  attendance_alert: { label: 'Attendance', Icon: Bell, bg: 'bg-orange-100 dark:bg-orange-500/10', text: 'text-orange-600 dark:text-orange-400', tag: 'bg-orange-50 dark:bg-orange-500/5 text-orange-700 dark:text-orange-300' },
}

const DEFAULT_TYPE = { label: 'Notification', Icon: Bell, bg: 'bg-gray-100 dark:bg-[#2C2C2E]', text: 'text-gray-600 dark:text-[#8E8E93]', tag: 'bg-gray-50 dark:bg-[#2C2C2E] text-gray-600 dark:text-[#8E8E93]' }

const getActivityType = (category) => ACTIVITY_TYPE_MAP[category] || DEFAULT_TYPE

const StudentActivityFeed = () => {
  const queryClient = useQueryClient()

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['student-activity-feed'],
    queryFn: async () => {
      const res = await notificationsService.getNotifications({ limit: 20 })
      return res.success ? res.data : { notifications: [], pagination: {} }
    },
    refetchInterval: 60 * 1000,
    refetchOnWindowFocus: true,
  })

  const notifications = data?.notifications || []
  const unreadCount = notifications.filter(n => !n.isRead).length

  const markAllMutation = useMutation({
    mutationFn: () => notificationsService.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-activity-feed'] })
      queryClient.invalidateQueries({ queryKey: ['unread-count'] })
      toast.success('All marked as read')
    },
  })

  const markOneMutation = useMutation({
    mutationFn: (id) => notificationsService.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-activity-feed'] })
      queryClient.invalidateQueries({ queryKey: ['unread-count'] })
    },
  })

  if (isLoading) {
    return (
      <div className="card p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Recent Activity</h3>
        </div>
        <div className="space-y-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex gap-3 animate-pulse">
              <div className="h-10 w-10 bg-gray-200 dark:bg-[#2C2C2E] rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 dark:bg-[#2C2C2E] rounded w-3/4" />
                <div className="h-3 bg-gray-200 dark:bg-[#2C2C2E] rounded w-1/2" />
                <div className="h-3 bg-gray-200 dark:bg-[#2C2C2E] rounded w-1/4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="card p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Recent Activity</h3>
          {isFetching && !isLoading && (
            <Loader2 className="h-3.5 w-3.5 text-primary-500 dark:text-[#3EC4B1] animate-spin" />
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => markAllMutation.mutate()}
            disabled={markAllMutation.isPending}
            className="flex items-center gap-1.5 text-xs font-medium text-primary-600 dark:text-[#3EC4B1] hover:text-primary-700 dark:hover:text-[#35a89a] transition-colors disabled:opacity-50"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Mark all as read
            {unreadCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 text-[10px] font-bold">
                {unreadCount}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Feed list */}
      {notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-gray-400 dark:text-[#636366]">
          <Clock className="h-8 w-8 mb-2 opacity-30" />
          <p className="text-sm">No recent activity</p>
          <p className="text-xs mt-1 opacity-60">Updates will appear here as they happen</p>
        </div>
      ) : (
        <div className="max-h-[480px] overflow-y-auto -mx-1 px-1 space-y-1">
          {notifications.map((item) => {
            const actType = getActivityType(item.category)
            const IconComp = actType.Icon
            const isUnread = !item.isRead

            return (
              <div
                key={item._id}
                onClick={() => { if (isUnread) markOneMutation.mutate(item._id) }}
                className={`flex items-start gap-3 p-3 rounded-xl transition-all ${
                  isUnread
                    ? 'bg-primary-50/50 dark:bg-primary-900/5 cursor-pointer hover:bg-primary-50 dark:hover:bg-primary-900/10'
                    : 'hover:bg-gray-50 dark:hover:bg-[#1C1C1E]'
                }`}
              >
                {/* Icon */}
                <div className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center ${actType.bg} ${actType.text}`}>
                  <IconComp className="h-4.5 w-4.5" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm leading-snug line-clamp-2 ${isUnread ? 'font-semibold text-gray-900 dark:text-white' : 'font-medium text-gray-700 dark:text-gray-300'}`}>
                        {item.title}
                      </p>
                      {item.message && item.message !== item.title && (
                        <p className="text-xs text-gray-500 dark:text-[#8E8E93] mt-0.5 line-clamp-1">
                          {item.message}
                        </p>
                      )}
                    </div>
                    {/* Unread dot */}
                    {isUnread && (
                      <span className="flex-shrink-0 mt-1.5 h-2 w-2 rounded-full bg-primary-500 dark:bg-[#3EC4B1]" />
                    )}
                  </div>

                  {/* Meta: tag + timestamp */}
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${actType.tag}`}>
                      {actType.label}
                    </span>
                    <span className="text-[11px] text-gray-400 dark:text-[#636366]">
                      {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default StudentActivityFeed
