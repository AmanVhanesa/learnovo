import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from './AuthContext'
import notificationsService from '../services/notificationsService'

const NotificationContext = createContext()

// Poll every 10s when tab is visible
const POLL_INTERVAL_MS = 10_000

export function NotificationProvider({ children }) {
  const { isAuthenticated } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)
  const [recentNotifications, setRecentNotifications] = useState([])
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const inflightRef = useRef(false)
  const intervalRef = useRef(null)
  // Track IDs we've optimistically marked as read (to avoid double-decrement)
  const optimisticReadIds = useRef(new Set())

  const fetchUnreadCount = useCallback(async () => {
    if (!isAuthenticated || inflightRef.current) return
    inflightRef.current = true
    try {
      const response = await notificationsService.getUnreadCount()
      if (response.success) {
        const serverCount = response.data?.count ?? response.count ?? 0
        setUnreadCount(serverCount)
        // Clear optimistic tracking — server is now the source of truth
        optimisticReadIds.current.clear()
      }
    } catch (error) {
      if (error?.response?.status !== 404) {
      }
    } finally {
      inflightRef.current = false
      setIsInitialLoad(false)
    }
  }, [isAuthenticated])

  const fetchRecentNotifications = useCallback(async () => {
    if (!isAuthenticated) return
    try {
      const response = await notificationsService.getNotifications({ limit: 5 })
      if (response.success) {
        setRecentNotifications(response.data || [])
      }
    } catch (error) {
    }
  }, [isAuthenticated])

  // Mark single notification as read — optimistic with rollback
  const markAsRead = useCallback(async (notificationId) => {
    // Guard: don't decrement if already marked (optimistically or actually)
    if (optimisticReadIds.current.has(notificationId)) return

    // Check if the notification is already read in our local state
    const notification = recentNotifications.find(n => n._id === notificationId)
    if (notification?.isRead) return

    // Optimistic update BEFORE API call
    optimisticReadIds.current.add(notificationId)
    setUnreadCount(prev => Math.max(0, prev - 1))
    setRecentNotifications(prev =>
      prev.map(n => n._id === notificationId ? { ...n, isRead: true } : n)
    )

    try {
      await notificationsService.markAsRead(notificationId)
    } catch (error) {
      // Rollback on failure
      optimisticReadIds.current.delete(notificationId)
      setUnreadCount(prev => prev + 1)
      setRecentNotifications(prev =>
        prev.map(n => n._id === notificationId ? { ...n, isRead: false } : n)
      )
    }
  }, [recentNotifications])

  // Mark all as read — optimistic with rollback
  const markAllAsRead = useCallback(async () => {
    const previousCount = unreadCount
    const previousNotifications = recentNotifications

    // Optimistic update
    setUnreadCount(0)
    setRecentNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
    optimisticReadIds.current.clear()

    try {
      await notificationsService.markAllAsRead()
    } catch (error) {
      // Rollback on failure
      setUnreadCount(previousCount)
      setRecentNotifications(previousNotifications)
    }
  }, [unreadCount, recentNotifications])

  // Refresh both count and recent list
  const refresh = useCallback(() => {
    fetchUnreadCount()
    fetchRecentNotifications()
  }, [fetchUnreadCount, fetchRecentNotifications])

  // Setup smart polling with visibility API
  useEffect(() => {
    if (!isAuthenticated) {
      setUnreadCount(0)
      setRecentNotifications([])
      optimisticReadIds.current.clear()
      return
    }

    // Initial fetch — both count and recent
    fetchUnreadCount()
    fetchRecentNotifications()

    const startPolling = () => {
      stopPolling()
      // Poll both count and recent together for fastest delivery
      intervalRef.current = setInterval(() => {
        fetchUnreadCount()
        fetchRecentNotifications()
      }, POLL_INTERVAL_MS)
    }

    const stopPolling = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopPolling()
      } else {
        // Immediate fetch when tab becomes visible again
        fetchUnreadCount()
        fetchRecentNotifications()
        startPolling()
      }
    }

    startPolling()
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      stopPolling()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [isAuthenticated, fetchUnreadCount, fetchRecentNotifications])

  const value = {
    unreadCount,
    recentNotifications,
    isInitialLoad,
    markAsRead,
    markAllAsRead,
    fetchRecentNotifications,
    refresh
  }

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider')
  }
  return context
}

export default NotificationContext
