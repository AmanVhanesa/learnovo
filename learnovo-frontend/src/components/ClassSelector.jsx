import React, { useState, useEffect } from 'react'
import { School, ChevronDown } from 'lucide-react'
import { classesService } from '../services/classesService'
import { useAuth } from '../contexts/AuthContext'

const ClassSelector = ({ selectedClass, onClassChange, className = '' }) => {
  const { user } = useAuth()
  const [classes, setClasses] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    fetchTeacherClasses()
  }, [])

  const fetchTeacherClasses = async () => {
    try {
      setIsLoading(true)
      const response = await classesService.list()
      
      // Filter classes where the teacher is either the class teacher or assigned to subjects
      const teacherClasses = response.data.filter(classItem => {
        // Check if teacher is the class teacher
        if (classItem.classTeacher?._id === user?.id) {
          return true
        }
        
        // Check if teacher is assigned to any subject in this class
        return classItem.subjects?.some(subject => subject.teacher?._id === user?.id)
      })
      
      setClasses(teacherClasses)
      
      // Auto-select first class if none selected
      if (teacherClasses.length > 0 && !selectedClass) {
        onClassChange(teacherClasses[0])
      }
    } catch (error) {
      console.error('Error fetching teacher classes:', error)
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
        <School className="h-5 w-5 text-gray-400" />
        <span className="text-sm text-gray-500">Loading classes...</span>
      </div>
    )
  }

  if (classes.length === 0) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <School className="h-5 w-5 text-gray-400" />
        <span className="text-sm text-gray-500">No classes assigned</span>
      </div>
    )
  }

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
      >
        <School className="h-4 w-4 text-gray-400" />
        <span className="text-sm font-medium text-gray-700">
          {selectedClass ? selectedClass.name : 'Select Class'}
        </span>
        <ChevronDown className="h-4 w-4 text-gray-400" />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg z-50">
          <div className="py-1">
            {classes.map((classItem) => (
              <button
                key={classItem._id}
                onClick={() => handleClassSelect(classItem)}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                  selectedClass?._id === classItem._id
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-700'
                }`}
              >
                <div className="font-medium">{classItem.name}</div>
                <div className="text-xs text-gray-500">
                  {classItem.grade} • {classItem.academicYear}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  )
}

export default ClassSelector
