import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Bell, CheckCircle2, X, AlertTriangle, Info,
  ChevronLeft, ChevronRight, CheckCheck, Trash2,
  Sparkles, ArrowRight, Filter, ArrowLeft
} from 'lucide-react'
import { useNotifications } from '../contexts/NotificationContext'
import notificationsService from '../services/notificationsService'
import { formatDateShort } from '../utils/formatDate'

const TYPE_CONFIG = {
  success: {
    icon: CheckCircle2,
    iconColor: 'text-emerald-500',
    bg: 'bg-emerald-50 dark:bg-emerald-500/10',
    ring: 'ring-emerald-100 dark:ring-emerald-500/20',
    accent: 'border-l-emerald-500',
  },
  warning: {
    icon: AlertTriangle,
    iconColor: 'text-amber-500',
    bg: 'bg-amber-50 dark:bg-amber-500/10',
    ring: 'ring-amber-100 dark:ring-amber-500/20',
    accent: 'border-l-amber-500',
  },
  error: {
    icon: AlertTriangle,
    iconColor: 'text-red-500',
    bg: 'bg-red-50 dark:bg-red-500/10',
    ring: 'ring-red-100 dark:ring-red-500/20',
    accent: 'border-l-red-500',
  },
  info: {
    icon: Info,
    iconColor: 'text-blue-500',
    bg: 'bg-blue-50 dark:bg-blue-500/10',
    ring: 'ring-blue-100 dark:ring-blue-500/20',
    accent: 'border-l-blue-500',
  },
}

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'read', label: 'Read' },
]

const formatDate = (dateString) => {
  if (!dateString) return 'Unknown'
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return 'Invalid Date'
  const now = new Date()
  const diff = now - date
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return 'Just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min${minutes !== 1 ? 's' : ''} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} day${days !== 1 ? 's' : ''} ago`
  return formatDateShort(date)
}

const Notifications = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { unreadCount, markAsRead: ctxMarkAsRead, markAllAsRead: ctxMarkAllAsRead, refresh } = useNotifications()
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)
  const limit = 20

  useEffect(() => {
    refresh()
  }, [refresh])

  const { data: queryData, isLoading, error } = useQuery({
    queryKey: ['notifications', filter, page, limit],
    queryFn: async () => {
      let isReadParam = 'all'
      if (filter === 'unread') isReadParam = false
      else if (filter === 'read') isReadParam = true

      const response = await notificationsService.getNotifications({
        page,
        limit,
        isRead: isReadParam
      })

      if (response && response.success) {
        return {
          notifications: response.data || [],
          pagination: response.pagination || { page: 1, limit: 20, total: 0, pages: 1 }
        }
      }
      throw new Error('Failed to load notifications')
    },
  })

  const notifications = queryData?.notifications || []
  const pagination = queryData?.pagination || { page: 1, limit: 20, total: 0, pages: 1 }
  const errorMessage = error?.response?.data?.message || error?.message || (error ? 'Failed to load notifications. Please try again.' : null)

  const deleteMutation = useMutation({
    mutationFn: (notificationId) => notificationsService.deleteNotification(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      refresh()
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    }
  })

  const handleNotificationClick = async (notification) => {
    if (!notification.isRead) {
      // Optimistically update the cache
      queryClient.setQueryData(['notifications', filter, page, limit], (old) => {
        if (!old) return old
        return {
          ...old,
          notifications: old.notifications.map(n =>
            n._id === notification._id ? { ...n, isRead: true } : n
          )
        }
      })
      ctxMarkAsRead(notification._id)
    }
    if (notification.actionUrl) {
      navigate(notification.actionUrl)
    }
  }

  const markAllAsRead = async () => {
    // Optimistically update
    queryClient.setQueryData(['notifications', filter, page, limit], (old) => {
      if (!old) return old
      return {
        ...old,
        notifications: old.notifications.map(n => ({ ...n, isRead: true }))
      }
    })
    try {
      await ctxMarkAllAsRead()
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    } catch {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    }
  }

  const deleteNotification = async (notificationId, event) => {
    event.stopPropagation()
    // Optimistically remove from cache
    const wasUnread = notifications.find(n => n._id === notificationId && !n.isRead)
    queryClient.setQueryData(['notifications', filter, page, limit], (old) => {
      if (!old) return old
      return {
        ...old,
        notifications: old.notifications.filter(n => n._id !== notificationId)
      }
    })
    deleteMutation.mutate(notificationId)
  }

  const getConfig = (type) => TYPE_CONFIG[type] || TYPE_CONFIG.info

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="loading-spinner" />
        <p className="text-sm text-gray-400 dark:text-[#636366]">Loading notifications...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">

      {/* Page Header */}
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/app/communication')}
            className="p-2 hover:bg-gray-100 dark:hover:bg-[#2C2C2E] rounded-lg flex-shrink-0"
          >
            <ArrowLeft className="h-5 w-5 text-gray-500 dark:text-[#8E8E93]" />
          </button>
          <div>
          <h1 className="page-title flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center">
              <Bell className="h-5 w-5 text-primary-600 dark:text-primary-400" />
            </div>
            Notifications
          </h1>
          <p className="page-subtitle mt-1">
            {unreadCount > 0
              ? <>{unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}</>
              : 'You\'re all caught up'
            }
          </p>
          </div>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="btn btn-outline btn-sm flex items-center gap-2"
          >
            <CheckCheck className="h-4 w-4" />
            Mark all as read
          </button>
        )}
      </div>

      {/* Error */}
      {errorMessage && (
        <div className="card p-4 border-l-4 border-l-red-500">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-700 dark:text-red-400">{errorMessage}</p>
              <button
                onClick={() => queryClient.invalidateQueries({ queryKey: ['notifications'] })}
                className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:underline"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-gray-400 dark:text-[#636366]">
          <Filter className="h-4 w-4" />
        </div>
        <div className="tab-nav">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => {
                setFilter(f.key)
                setPage(1)
              }}
              className={`tab-item ${filter === f.key ? 'tab-item-active' : ''}`}
            >
              {f.label}
              {f.key === 'unread' && unreadCount > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-md bg-red-500/10 text-[10px] font-bold text-red-600 dark:text-red-400 tabular-nums">
                  {unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Notifications List */}
      <div className="card overflow-hidden">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-[#2C2C2E] flex items-center justify-center mb-5">
              <Sparkles className="h-8 w-8 text-gray-300 dark:text-[#636366]" />
            </div>
            <p className="text-base font-medium text-gray-500 dark:text-[#8E8E93]">
              {filter === 'unread'
                ? 'No unread notifications'
                : filter === 'read'
                  ? 'No read notifications'
                  : 'No notifications yet'}
            </p>
            <p className="text-sm text-gray-400 dark:text-[#636366] mt-1.5">
              {filter === 'unread'
                ? 'Great job staying on top of things!'
                : 'Notifications will appear here when there\'s something new'}
            </p>
          </div>
        ) : (
          <div>
            {notifications.map((notification, index) => {
              const config = getConfig(notification.type)
              const Icon = config.icon
              const isUnread = !notification.isRead

              return (
                <div
                  key={notification._id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`group relative flex items-start gap-3 sm:gap-4 px-3 sm:px-5 py-3 sm:py-4 cursor-pointer transition-all duration-150
                    ${isUnread
                      ? 'bg-primary-50/30 dark:bg-primary-500/[0.03] border-l-[3px] border-l-primary-500'
                      : 'border-l-[3px] border-l-transparent hover:bg-gray-50 dark:hover:bg-[#2C2C2E]/60'
                    }
                    ${index < notifications.length - 1 ? 'border-b border-gray-100/80 dark:border-[#2C2C2E]' : ''}
                  `}
                >
                  {/* Icon */}
                  <div className={`flex-shrink-0 w-10 h-10 rounded-xl ${config.bg} ring-1 ${config.ring} flex items-center justify-center mt-0.5`}>
                    <Icon className={`h-[18px] w-[18px] ${config.iconColor}`} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className={`text-sm leading-snug ${isUnread ? 'font-semibold text-gray-900 dark:text-white' : 'font-medium text-gray-600 dark:text-[#8E8E93]'}`}>
                        {notification.title}
                      </h3>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[11px] text-gray-400 dark:text-[#636366] tabular-nums whitespace-nowrap">
                          {formatDate(notification.createdAt)}
                        </span>
                        {isUnread && (
                          <span className="h-2 w-2 rounded-full bg-primary-500 flex-shrink-0" />
                        )}
                      </div>
                    </div>
                    <p className={`mt-1 text-[13px] leading-relaxed line-clamp-2 ${isUnread ? 'text-gray-600 dark:text-[#8E8E93]' : 'text-gray-400 dark:text-[#636366]'}`}>
                      {notification.message}
                    </p>
                    {notification.actionLabel && (
                      <span className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-primary-600 dark:text-primary-400 group-hover:underline">
                        {notification.actionLabel}
                        <ArrowRight className="h-3 w-3" />
                      </span>
                    )}
                  </div>

                  {/* Delete button */}
                  <button
                    onClick={(e) => deleteNotification(notification._id, e)}
                    className="flex-shrink-0 p-2 rounded-lg text-gray-300 dark:text-[#636366] opacity-0 group-hover:opacity-100 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                    title="Delete notification"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 card px-4 sm:px-5 py-3.5">
          <p className="text-sm text-gray-500 dark:text-[#8E8E93] tabular-nums">
            Page <span className="font-medium text-gray-700 dark:text-[#8E8E93]">{pagination.page}</span> of{' '}
            <span className="font-medium text-gray-700 dark:text-[#8E8E93]">{pagination.pages}</span>
            <span className="text-gray-400 dark:text-[#636366] ml-1">({pagination.total} total)</span>
          </p>
          <div className="flex gap-1.5">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="btn btn-outline btn-sm !px-2.5"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={page >= pagination.pages}
              className="btn btn-outline btn-sm !px-2.5"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default Notifications
