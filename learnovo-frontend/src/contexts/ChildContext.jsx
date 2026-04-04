import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useAuth } from './AuthContext'
import { authService } from '../services/authService'
import toast from 'react-hot-toast'

const ChildContext = createContext()

const STORAGE_KEY = 'selectedChildId'

export function ChildProvider({ children: reactChildren }) {
  const { user, login: authLogin } = useAuth()
  const isParent = user?.role === 'parent'
  const isStudent = user?.role === 'student'

  // Parent: children come from user object; Student: siblings fetched from API
  const parentChildren = isParent ? (user?.children || []) : []
  const [siblings, setSiblings] = useState([])
  const [siblingsLoading, setSiblingsLoading] = useState(false)
  const [switching, setSwitching] = useState(false)

  // For students, build a list that includes themselves + siblings
  // For parents, use the children list directly
  const childrenList = isParent
    ? parentChildren
    : isStudent && siblings.length > 0
      ? [
          {
            id: user.id || user._id,
            name: user.fullName || user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim(),
            admissionNumber: user.admissionNumber,
            className: user.class?.name || '',
            sectionName: user.section?.name || '',
            avatar: user.avatar || user.photo || null,
            isSelf: true
          },
          ...siblings
        ]
      : []

  const [selectedChildId, setSelectedChildId] = useState(() => {
    if (!isParent) return null
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored || null
  })

  // Fetch siblings for student accounts
  useEffect(() => {
    if (!isStudent) {
      setSiblings([])
      return
    }
    let cancelled = false
    setSiblingsLoading(true)
    authService.getSiblings().then(res => {
      if (!cancelled && res.success) {
        setSiblings(res.data || [])
      }
    }).catch(() => {}).finally(() => {
      if (!cancelled) setSiblingsLoading(false)
    })
    return () => { cancelled = true }
  }, [isStudent, user?.id, user?._id])

  // Auto-select first child if none selected (parents only)
  useEffect(() => {
    if (!isParent || parentChildren.length === 0) return
    const ids = parentChildren.map(c => c.id)
    if (!selectedChildId || !ids.includes(selectedChildId)) {
      const firstId = ids[0]
      setSelectedChildId(firstId)
      localStorage.setItem(STORAGE_KEY, firstId)
    }
  }, [isParent, parentChildren, selectedChildId])

  // For parents: just select child in context
  const selectChild = useCallback((childId) => {
    setSelectedChildId(childId)
    localStorage.setItem(STORAGE_KEY, childId)
  }, [])

  // For students: switch account via API (gets new JWT)
  const switchToSibling = useCallback(async (studentId) => {
    if (switching) return
    setSwitching(true)
    try {
      const res = await authService.switchChild(studentId)
      if (res.success) {
        // Store new auth data
        localStorage.setItem('token', res.token)
        localStorage.setItem('user', JSON.stringify(res.user))
        if (res.tenant) localStorage.setItem('tenant', JSON.stringify(res.tenant))
        toast.success(res.message || 'Switched successfully')
        // Reload page to reinitialize all contexts with new user
        window.location.href = '/app/dashboard'
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to switch account')
    } finally {
      setSwitching(false)
    }
  }, [switching])

  const selectedChild = isParent
    ? (parentChildren.find(c => c.id === selectedChildId) || parentChildren[0] || null)
    : null

  const hasSwitcher = (isParent && parentChildren.length > 0) || (isStudent && siblings.length > 0)

  const value = {
    isParent,
    isStudent,
    hasSwitcher,
    childrenList,
    selectedChild,
    selectedChildId: selectedChild?.id || null,
    selectChild: isParent ? selectChild : switchToSibling,
    switching,
    siblingsLoading
  }

  return (
    <ChildContext.Provider value={value}>
      {reactChildren}
    </ChildContext.Provider>
  )
}

export const useChild = () => {
  const context = useContext(ChildContext)
  if (!context) {
    throw new Error('useChild must be used within a ChildProvider')
  }
  return context
}
