import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, CheckCircle, X, AlertTriangle, Info, ChevronLeft, ChevronRight } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import notificationsService from '../services/notificationsService'

const Notifications = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('all') // 'all', 'unread', 'read'
  const [categoryFilter, setCategoryFilter] = useState(null)
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 })

  useEffect(() => {
    fetchNotifications()
  }, [filter, categoryFilter, pagination.page])

  const fetchNotifications = async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Convert filter to isRead parameter
      let isReadParam = 'all'
      if (filter === 'unread') {
        isReadParam = false
      } else if (filter === 'read') {
        isReadParam = true
      }

      const response = await notificationsService.getNotifications({
        page: pagination.page,
        limit: pagination.limit,
        isRead: isReadParam,
        category: categoryFilter
      })

      console.log('Notifications API response:', response)

      if (response && response.success) {
        setNotifications(response.data || [])
        if (response.pagination) {
          setPagination(response.pagination)
        }
      } else {
        setNotifications([])
        setError('Failed to load notifications')
      }
    } catch (error) {
      console.error('Error fetching notifications:', error)
      setError(error?.response?.data?.message || error?.message || 'Failed to load notifications. Please try again.')
      setNotifications([])
      // Reset pagination on error
      setPagination({ page: 1, limit: 20, total: 0, pages: 1 })
    } finally {
      setIsLoading(false)
    }
  }

  const handleNotificationClick = async (notification) => {
    try {
      // Mark as read if unread
      if (!notification.isRead) {
        await notificationsService.markAsRead(notification._id)
        // Update local state
        setNotifications(prev =>
          prev.map(n => n._id === notification._id ? { ...n, isRead: true } : n)
        )
      }

      // Navigate to action URL if exists
      if (notification.actionUrl) {
        navigate(notification.actionUrl)
      }
    } catch (error) {
      console.error('Error handling notification click:', error)
    }
  }

  const markAllAsRead = async () => {
    try {
      await notificationsService.markAllAsRead()
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
    } catch (error) {
      console.error('Error marking all as read:', error)
    }
  }

  const deleteNotification = async (notificationId, event) => {
    event.stopPropagation() // Prevent notification click
    try {
      await notificationsService.deleteNotification(notificationId)
      setNotifications(prev => prev.filter(n => n._id !== notificationId))
    } catch (error) {
      console.error('Error deleting notification:', error)
    }
  }

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />
      case 'error':
        return <AlertTriangle className="h-5 w-5 text-red-500" />
      default:
        return <Bell className="h-5 w-5 text-blue-500" />
    }
  }

  const getNotificationBgColor = (type) => {
    switch (type) {
      case 'success':
        return 'bg-green-50 border-green-200'
      case 'warning':
        return 'bg-yellow-50 border-yellow-200'
      case 'error':
        return 'bg-red-50 border-red-200'
      default:
        return 'bg-blue-50 border-blue-200'
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';

    const date = new Date(dateString);

    // Check if date is valid
    if (isNaN(date.getTime())) {
      console.error('Invalid date:', dateString);
      return 'Invalid Date';
    }

    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} minutes ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)} days ago`;
    return date.toLocaleDateString();
  }

  const unreadCount = notifications.filter(n => !n.isRead).length

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading-spinner"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-gray-500 mt-1">
              {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="btn btn-secondary text-sm"
          >
            Mark all as read
          </button>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
            <p className="text-sm text-red-600">{error}</p>
          </div>
          <button
            onClick={() => fetchNotifications()}
            className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${filter === 'all'
              ? 'bg-primary-100 text-primary-700'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${filter === 'unread'
              ? 'bg-primary-100 text-primary-700'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            Unread
          </button>
          <button
            onClick={() => setFilter('read')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${filter === 'read'
              ? 'bg-primary-100 text-primary-700'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            Read
          </button>
        </div>
      </div>

      {/* Notifications List */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {notifications.length === 0 ? (
          <div className="text-center py-12">
            <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">
              {filter === 'unread'
                ? 'No unread notifications'
                : filter === 'read'
                  ? 'No read notifications'
                  : 'No notifications yet'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {notifications.map((notification) => (
              <div
                key={notification._id}
                onClick={() => handleNotificationClick(notification)}
                className={`p-4 hover:bg-gray-50 transition-colors cursor-pointer ${!notification.isRead ? 'bg-gray-50' : ''
                  }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1">
                    <div className={`p-2 rounded-lg ${getNotificationBgColor(notification.type)}`}>
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className={`text-sm font-medium ${!notification.isRead ? 'text-gray-900' : 'text-gray-600'}`}>
                          {notification.title}
                        </h3>
                        {!notification.isRead && (
                          <span className="ml-2 h-2 w-2 bg-primary-500 rounded-full"></span>
                        )}
                      </div>
                      <p className={`mt-1 text-sm ${!notification.isRead ? 'text-gray-700' : 'text-gray-500'}`}>
                        {notification.message}
                      </p>
                      <p className="mt-1 text-xs text-gray-400">
                        {formatDate(notification.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={(e) => deleteNotification(notification._id, e)}
                      className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                      title="Delete"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Notifications

