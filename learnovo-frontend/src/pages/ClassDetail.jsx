import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Edit, Trash2, Users, BookOpen, UserPlus, GraduationCap, X } from 'lucide-react'
import { classesService } from '../services/classesService'
import { studentsService } from '../services/studentsService'
import { teachersService } from '../services/teachersService'
import { subjectsService } from '../services/subjectsService'
import { useAuth } from '../contexts/AuthContext'

const ClassDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [classItem, setClassItem] = useState(null)
  const [students, setStudents] = useState([])
  const [subjects, setSubjects] = useState([])
  const [allStudents, setAllStudents] = useState([])
  const [allSubjects, setAllSubjects] = useState([])
  const [teachers, setTeachers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('students')
  const [showEnrollModal, setShowEnrollModal] = useState(false)
  const [showSubjectModal, setShowSubjectModal] = useState(false)
  const [selectedStudents, setSelectedStudents] = useState([])
  const [subjectForm, setSubjectForm] = useState({
    subjectId: '',
    teacherId: ''
  })

  useEffect(() => {
    fetchClassDetails()
    fetchAllStudents()
    fetchAllSubjects()
    fetchTeachers()
  }, [id])

  const fetchClassDetails = async () => {
    try {
      setIsLoading(true)
      const [classResponse, studentsResponse, subjectsResponse] = await Promise.all([
        classesService.get(id),
        classesService.getStudents(id),
        classesService.getSubjects(id)
      ])
      
      setClassItem(classResponse.data)
      setStudents(studentsResponse.data)
      setSubjects(subjectsResponse.data)
    } catch (error) {
      console.error('Error fetching class details:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchAllStudents = async () => {
    try {
      const response = await studentsService.list()
      // Filter out students already enrolled in any class
      const unenrolledStudents = response.data.filter(student => !student.classId)
      setAllStudents(unenrolledStudents)
    } catch (error) {
      console.error('Error fetching students:', error)
    }
  }

  const fetchAllSubjects = async () => {
    try {
      const response = await subjectsService.list()
      setAllSubjects(response.data)
    } catch (error) {
      console.error('Error fetching subjects:', error)
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

  const handleEnrollStudents = async () => {
    try {
      await classesService.enrollStudents(id, selectedStudents)
      setShowEnrollModal(false)
      setSelectedStudents([])
      fetchClassDetails()
      fetchAllStudents()
    } catch (error) {
      console.error('Error enrolling students:', error)
      alert('Error enrolling students. Please try again.')
    }
  }

  const handleAssignSubject = async (e) => {
    e.preventDefault()
    try {
      await classesService.assignSubject(id, subjectForm)
      setShowSubjectModal(false)
      setSubjectForm({ subjectId: '', teacherId: '' })
      fetchClassDetails()
    } catch (error) {
      console.error('Error assigning subject:', error)
      alert('Error assigning subject. Please try again.')
    }
  }

  const handleRemoveSubject = async (subjectId) => {
    if (!window.confirm('Are you sure you want to remove this subject?')) return
    
    try {
      await classesService.removeSubject(id, subjectId)
      fetchClassDetails()
    } catch (error) {
      console.error('Error removing subject:', error)
      alert('Error removing subject. Please try again.')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading-spinner"></div>
      </div>
    )
  }

  if (!classItem) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Class not found</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => navigate('/classes')}
            className="p-2 rounded-md hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{classItem.name}</h1>
            <p className="text-gray-600">{classItem.grade} • {classItem.academicYear}</p>
          </div>
        </div>
      </div>

      {/* Class Info */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <h3 className="text-sm font-medium text-gray-500">Class Teacher</h3>
            <p className="text-lg font-semibold text-gray-900">
              {classItem.classTeacher?.name || 'Not assigned'}
            </p>
            <p className="text-sm text-gray-600">{classItem.classTeacher?.email}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">Total Students</h3>
            <p className="text-lg font-semibold text-gray-900">{students.length}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">Subjects</h3>
            <p className="text-lg font-semibold text-gray-900">{subjects.length}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('students')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'students'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Users className="h-4 w-4 inline mr-2" />
              Students ({students.length})
            </button>
            <button
              onClick={() => setActiveTab('subjects')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'subjects'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <BookOpen className="h-4 w-4 inline mr-2" />
              Subjects & Teachers ({subjects.length})
            </button>
          </nav>
        </div>

        <div className="p-6">
          {/* Students Tab */}
          {activeTab === 'students' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">Enrolled Students</h3>
                <button 
                  className="btn btn-primary"
                  onClick={() => setShowEnrollModal(true)}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Enroll Student
                </button>
              </div>

              {students.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No students enrolled in this class
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Student ID</th>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Roll Number</th>
                        <th>Admission Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((student) => (
                        <tr key={student._id}>
                          <td className="text-sm text-gray-900">{student.studentId}</td>
                          <td className="text-sm font-medium text-gray-900">{student.name}</td>
                          <td className="text-sm text-gray-900">{student.email}</td>
                          <td className="text-sm text-gray-900">{student.rollNumber}</td>
                          <td className="text-sm text-gray-900">
                            {student.admissionDate ? new Date(student.admissionDate).toLocaleDateString() : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Subjects Tab */}
          {activeTab === 'subjects' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">Subjects & Teachers</h3>
                <button 
                  className="btn btn-primary"
                  onClick={() => setShowSubjectModal(true)}
                >
                  <GraduationCap className="h-4 w-4 mr-2" />
                  Assign Subject
                </button>
              </div>

              {subjects.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No subjects assigned to this class
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Subject</th>
                        <th>Subject Code</th>
                        <th>Assigned Teacher</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subjects.map((subject) => (
                        <tr key={subject.subject._id}>
                          <td className="text-sm font-medium text-gray-900">{subject.subject.name}</td>
                          <td className="text-sm text-gray-900">{subject.subject.subjectCode}</td>
                          <td className="text-sm text-gray-900">{subject.teacher?.name || 'Not assigned'}</td>
                          <td>
                            <button 
                              className="p-1 text-gray-400 hover:text-red-600"
                              onClick={() => handleRemoveSubject(subject.subject._id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Enroll Students Modal */}
      {showEnrollModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-content p-6">
            <div className="flex items-center justify-between border-b border-gray-200 pb-4 mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Enroll Students</h3>
              <button 
                className="p-2 rounded-md hover:bg-gray-100"
                onClick={() => setShowEnrollModal(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Select students to enroll in this class:
              </p>
              
              {allStudents.length === 0 ? (
                <p className="text-gray-500 text-center py-4">
                  All students are already enrolled in classes
                </p>
              ) : (
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {allStudents.map((student) => (
                    <label key={student._id} className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded">
                      <input
                        type="checkbox"
                        checked={selectedStudents.includes(student._id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedStudents([...selectedStudents, student._id])
                          } else {
                            setSelectedStudents(selectedStudents.filter(id => id !== student._id))
                          }
                        }}
                        className="rounded border-gray-300"
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{student.name}</p>
                        <p className="text-xs text-gray-500">{student.email}</p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
              
              <div className="flex justify-end space-x-3 pt-4">
                <button 
                  className="btn btn-ghost"
                  onClick={() => setShowEnrollModal(false)}
                >
                  Cancel
                </button>
                <button 
                  className="btn btn-primary"
                  onClick={handleEnrollStudents}
                  disabled={selectedStudents.length === 0}
                >
                  Enroll {selectedStudents.length} Student{selectedStudents.length !== 1 ? 's' : ''}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign Subject Modal */}
      {showSubjectModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-content p-6">
            <div className="flex items-center justify-between border-b border-gray-200 pb-4 mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Assign Subject</h3>
              <button 
                className="p-2 rounded-md hover:bg-gray-100"
                onClick={() => setShowSubjectModal(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form className="space-y-4" onSubmit={handleAssignSubject}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Subject
                </label>
                <select
                  value={subjectForm.subjectId}
                  onChange={(e) => setSubjectForm({...subjectForm, subjectId: e.target.value})}
                  className="input"
                  required
                >
                  <option value="">Select Subject</option>
                  {allSubjects.map(subject => (
                    <option key={subject._id} value={subject._id}>
                      {subject.name} ({subject.subjectCode})
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Teacher
                </label>
                <select
                  value={subjectForm.teacherId}
                  onChange={(e) => setSubjectForm({...subjectForm, teacherId: e.target.value})}
                  className="input"
                  required
                >
                  <option value="">Select Teacher</option>
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
                  onClick={() => setShowSubjectModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="btn btn-primary"
                >
                  Assign Subject
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default ClassDetail
