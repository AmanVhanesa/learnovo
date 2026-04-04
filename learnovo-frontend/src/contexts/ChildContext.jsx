import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useAuth } from './AuthContext'

const ChildContext = createContext()

const STORAGE_KEY = 'selectedChildId'

export function ChildProvider({ children: reactChildren }) {
  const { user } = useAuth()
  const isParent = user?.role === 'parent'
  const childrenList = isParent ? (user?.children || []) : []

  const [selectedChildId, setSelectedChildId] = useState(() => {
    if (!isParent) return null
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored || null
  })

  // Auto-select first child if none selected or stored ID is no longer valid
  useEffect(() => {
    if (!isParent || childrenList.length === 0) {
      setSelectedChildId(null)
      return
    }
    const ids = childrenList.map(c => c.id)
    if (!selectedChildId || !ids.includes(selectedChildId)) {
      const firstId = ids[0]
      setSelectedChildId(firstId)
      localStorage.setItem(STORAGE_KEY, firstId)
    }
  }, [isParent, childrenList, selectedChildId])

  const selectChild = useCallback((childId) => {
    setSelectedChildId(childId)
    localStorage.setItem(STORAGE_KEY, childId)
  }, [])

  const selectedChild = childrenList.find(c => c.id === selectedChildId) || childrenList[0] || null

  const value = {
    isParent,
    childrenList,
    selectedChild,
    selectedChildId: selectedChild?.id || null,
    selectChild
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
