import React, { useState, useEffect, useRef } from 'react'
import { School, ChevronDown, Check } from 'lucide-react'
import { classesService } from '../services/classesService'
import { useAuth } from '../contexts/AuthContext'
import { sortClassObjects } from '../utils/classOrder'

const ClassSelector = ({ selectedClass, onClassChange, className = '' }) => {
  const { user } = useAuth()
  const [classes, setClasses] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)
  const dropdownRef = useRef(null)

  useEffect(() => {
    fetchTeacherClasses()
  }, [])

  // Close on outside click/touch
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handler)
      document.addEventListener('touchstart', handler)
    }
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [isOpen])

  // Viewport-aware positioning
  useEffect(() => {
    if (isOpen && dropdownRef.current && containerRef.current) {
      const trigger = containerRef.current.getBoundingClientRect()
      const dropdown = dropdownRef.current
      const dropdownHeight = dropdown.scrollHeight
      const spaceBelow = window.innerHeight - trigger.bottom - 8
      const spaceAbove = trigger.top - 8

      if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
        dropdown.style.bottom = '100%'
        dropdown.style.top = 'auto'
        dropdown.style.marginBottom = '4px'
        dropdown.style.marginTop = '0'
      } else {
        dropdown.style.top = '100%'
        dropdown.style.bottom = 'auto'
        dropdown.style.marginTop = '4px'
        dropdown.style.marginBottom = '0'
      }
    }
  }, [isOpen])

  const fetchTeacherClasses = async () => {
    try {
      setIsLoading(true)
      const response = await classesService.list()

      const teacherClasses = response.data.filter(classItem => {
        if (classItem.classTeacher?._id === user?.id) return true
        return classItem.subjects?.some(subject => subject.teacher?._id === user?.id)
      })

      setClasses(sortClassObjects(teacherClasses, 'name'))

      if (teacherClasses.length > 0 && !selectedClass) {
        onClassChange(teacherClasses[0])
      }
    } catch (error) {
    } finally {
      setIsLoading(false)
    }
  }

  const handleClassSelect = (classItem) => {
    onClassChange(classItem)
    setIsOpen(false)
  }

  if (isLoading) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <School className="h-5 w-5 text-gray-400 dark:text-[#636366]" />
        <span className="text-sm text-gray-500 dark:text-[#8E8E93]">Loading classes...</span>
      </div>
    )
  }

  if (classes.length === 0) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <School className="h-5 w-5 text-gray-400 dark:text-[#636366]" />
        <span className="text-sm text-gray-500 dark:text-[#8E8E93]">No classes assigned</span>
      </div>
    )
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#38383A] rounded-2xl shadow-glass hover:bg-gray-50 dark:hover:bg-[#2C2C2E] focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
      >
        <School className="h-4 w-4 text-gray-400 dark:text-[#636366]" />
        <span className="text-sm font-medium text-gray-700 dark:text-white">
          {selectedClass ? selectedClass.name : 'Select Class'}
        </span>
        <ChevronDown className={`h-4 w-4 text-gray-400 dark:text-[#636366] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute left-0 min-w-[200px] bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#38383A] rounded-xl shadow-lg z-[10000] overflow-hidden"
          style={{ maxHeight: '280px' }}
        >
          <div className="overflow-y-auto py-1" style={{ maxHeight: '280px' }}>
            {classes.map((classItem) => {
              const isSelected = selectedClass?._id === classItem._id
              return (
                <button
                  key={classItem._id}
                  type="button"
                  onClick={() => handleClassSelect(classItem)}
                  className={`w-full text-left px-3.5 py-2.5 text-sm flex items-center justify-between gap-2 transition-colors ${
                    isSelected
                      ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
                      : 'text-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-[#2C2C2E]'
                  }`}
                >
                  <div>
                    <div className="font-medium">{classItem.name}</div>
                    <div className="text-xs text-gray-500 dark:text-[#8E8E93]">
                      {classItem.grade} • {classItem.academicYear}
                    </div>
                  </div>
                  {isSelected && <Check className="h-4 w-4 flex-shrink-0 text-primary-500" />}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default ClassSelector
