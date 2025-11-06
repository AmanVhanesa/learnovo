import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Edit, Trash2, Eye, Users, GraduationCap, Calendar, X, AlertTriangle } from 'lucide-react'
import { classesService } from '../services/classesService'
import { teachersService } from '../services/teachersService'
import { useAuth } from '../contexts/AuthContext'

const Classes = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [classes, setClasses] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [gradeFilter, setGradeFilter] = useState('')
  const [academicYearFilter, setAcademicYearFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({
    name: '',
    grade: '',
    academicYear: '',
    classTeacher: ''
  })
  const [teachers, setTeachers] = useState([])

  useEffect(() => {
    fetchClasses()
    fetchTeachers()
  }, [])

  const fetchClasses = async () => {
    try {
      setIsLoading(true)
      setError(null) // Clear previous errors
      const response = await classesService.list()
      setClasses(response.data || [])
    } catch (error) {
      console.error('Error fetching classes:', error)
      setError(error.response?.data?.message || 'Failed to load classes. Please check your connection and try again.')
      setClasses([]) // Clear classes on error
    } finally {
      setIsLoading(false)
    }
  }

  const fetchTeachers = async () => {
    try {
      const { data } = await teachersService.list({ limit: 100 })
      setTeachers(data || [])
    } catch (error) {
      console.error('Error fetching teachers:', error)
      setTeachers([])
    }
  }

  const openAdd = () => {
    setEditing(null)
    setForm({
      name: '',
      grade: '',
      academicYear: new Date().getFullYear() + '-' + (new Date().getFullYear() + 1),
      classTeacher: ''
    })
    setShowModal(true)
  }

  const openEdit = (classItem) => {
    setEditing(classItem)
    setForm({
      name: classItem.name,
      grade: classItem.grade,
      academicYear: classItem.academicYear,
      classTeacher: classItem.classTeacher._id
    })
    setShowModal(true)
  }

  const saveClass = async (e) => {
    e.preventDefault()
    try {
      setIsLoading(true)
      
      if (editing) {
        await classesService.update(editing._id, form)
      } else {
        await classesService.create(form)
      }
      
      setShowModal(false)
      setEditing(null)
      fetchClasses()
    } catch (error) {
      console.error('Error saving class:', error)
      alert('Error saving class. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const deleteClass = async (classItem) => {
    if (!window.confirm('Are you sure you want to delete this class?')) return
    
    try {
      await classesService.delete(classItem._id)
      fetchClasses()
    } catch (error) {
      console.error('Error deleting class:', error)
      alert('Error deleting class. Please try again.')
    }
  }

  const filteredClasses = classes.filter(classItem => {
    const matchesSearch = classItem.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         classItem.grade.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesGrade = !gradeFilter || classItem.grade === gradeFilter
    const matchesYear = !academicYearFilter || classItem.academicYear === academicYearFilter
    return matchesSearch && matchesGrade && matchesYear
  })

  const getGradeOptions = () => {
    const grades = [...new Set(classes.map(c => c.grade))]
    return grades.sort()
  }

  const getAcademicYearOptions = () => {
    const years = [...new Set(classes.map(c => c.academicYear))]
    return years.sort()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Class Management</h1>
        <button className="btn btn-primary" onClick={openAdd}>
          <Plus className="h-4 w-4 mr-2" />
          Add Class
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
            <p className="text-sm text-red-600">{error}</p>
          </div>
          <button
            onClick={() => fetchClasses()}
            className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search classes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input pl-10"
              />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 lg:gap-4">
            <div className="sm:w-48">
              <select
                value={gradeFilter}
                onChange={(e) => setGradeFilter(e.target.value)}
                className="input"
              >
                <option value="">All Grades</option>
                {getGradeOptions().map(grade => (
                  <option key={grade} value={grade}>{grade}</option>
                ))}
              </select>
            </div>
            <div className="sm:w-48">
              <select
                value={academicYearFilter}
                onChange={(e) => setAcademicYearFilter(e.target.value)}
                className="input"
              >
                <option value="">All Years</option>
                {getAcademicYearOptions().map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Classes table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table">
          <thead>
            <tr>
              <th>Class Name</th>
              <th>Grade</th>
              <th>Academic Year</th>
              <th>Class Teacher</th>
              <th>Students</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan="6" className="text-center py-8">
                  <div className="loading-spinner mx-auto"></div>
                </td>
              </tr>
            ) : filteredClasses.length === 0 ? (
              <tr>
                <td colSpan="6" className="text-center py-8 text-gray-500">
                  No classes found
                </td>
              </tr>
            ) : (
              filteredClasses.map((classItem) => (
                <tr key={classItem._id}>
                  <td>
                    <div className="text-sm font-medium text-gray-900">{classItem.name}</div>
                  </td>
                  <td className="text-sm text-gray-900">{classItem.grade}</td>
                  <td className="text-sm text-gray-900">{classItem.academicYear}</td>
                  <td className="text-sm text-gray-900">
                    {classItem.classTeacher?.name || 'Not assigned'}
                  </td>
                  <td className="text-sm text-gray-900">
                    <div className="flex items-center">
                      <Users className="h-4 w-4 mr-1 text-gray-400" />
                      {classItem.studentCount || 0}
                    </div>
                  </td>
                  <td>
                    <div className="flex space-x-2">
                      <button 
                        className="p-1 text-gray-400 hover:text-blue-600"
                        onClick={() => navigate(`/app/classes/${classItem._id}`)}
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button 
                        className="p-1 text-gray-400 hover:text-green-600" 
                        onClick={() => openEdit(classItem)}
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button 
                        className="p-1 text-gray-400 hover:text-red-600" 
                        onClick={() => deleteClass(classItem)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* Add/Edit Class Modal */}
      {showModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-content p-6">
            <div className="flex items-center justify-between border-b border-gray-200 pb-4 mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {editing ? 'Edit Class' : 'Add Class'}
              </h3>
              <button 
                className="p-2 rounded-md hover:bg-gray-100"
                onClick={() => { setShowModal(false); setEditing(null); }}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form className="space-y-4" onSubmit={saveClass}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Class Name
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({...form, name: e.target.value})}
                  className="input"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Grade
                </label>
                <input
                  type="text"
                  value={form.grade}
                  onChange={(e) => setForm({...form, grade: e.target.value})}
                  className="input"
                  placeholder="e.g., 9th Grade, 10th Grade"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Academic Year
                </label>
                <input
                  type="text"
                  value={form.academicYear}
                  onChange={(e) => setForm({...form, academicYear: e.target.value})}
                  className="input"
                  placeholder="e.g., 2024-2025"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Class Teacher
                </label>
                <select
                  value={form.classTeacher}
                  onChange={(e) => setForm({...form, classTeacher: e.target.value})}
                  className="input"
                  required
                >
                  <option value="">Select Class Teacher</option>
                  {teachers.map(teacher => (
                    <option key={teacher._id} value={teacher._id}>
                      {teacher.name} ({teacher.email})
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="flex justify-end space-x-3 pt-4">
                <button 
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => { setShowModal(false); setEditing(null); }}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="btn btn-primary"
                  disabled={isLoading}
                >
                  {isLoading ? 'Saving...' : (editing ? 'Update' : 'Create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Classes
