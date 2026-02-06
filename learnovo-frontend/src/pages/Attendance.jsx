import React, { useState, useEffect } from 'react'
import { Calendar, Users, CheckCircle, XCircle, Clock, Download, Filter, X, Copy, AlertTriangle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { attendanceService } from '../services/attendanceService'
import toast from 'react-hot-toast'

const Attendance = () => {
  const { user } = useAuth()
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [selectedClass, setSelectedClass] = useState(null)
  const [classes, setClasses] = useState([])
  const [attendance, setAttendance] = useState({})
  const [students, setStudents] = useState([])
  const [filteredStudents, setFilteredStudents] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [showReportModal, setShowReportModal] = useState(false)

  useEffect(() => {
    fetchTeacherClasses()
  }, [])

  useEffect(() => {
    if (selectedClass) {
      fetchStudents()
      fetchExistingAttendance()
    }
  }, [selectedClass, selectedDate])

  // Filter students based on search term
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredStudents(students)
    } else {
      const filtered = students.filter(student =>
        student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (student.admissionNumber || student.admission_number || '').toLowerCase().includes(searchTerm.toLowerCase())
      )
      setFilteredStudents(filtered)
    }
  }, [students, searchTerm])

  const fetchTeacherClasses = async () => {
    try {
      setIsLoading(true)
      const response = await attendanceService.getTeacherClasses()

      if (response?.data && response.data.length > 0) {
        setClasses(response.data)
        setSelectedClass(response.data[0])
      } else {
        // No classes found - could be empty database or no assignments
        setClasses([])
      }
    } catch (error) {
      console.error('Error fetching classes:', error)
      // Don't show error toast, just set empty classes
      setClasses([])
    } finally {
      setIsLoading(false)
    }
  }

  const fetchStudents = async () => {
    if (!selectedClass?._id) return

    try {
      setIsLoading(true)
      const response = await attendanceService.getStudentsByClass(selectedClass._id)

      if (response?.data?.students && response.data.students.length > 0) {
        setStudents(response.data.students)

        // Initialize attendance with all present by default
        const initialAttendance = {}
        response.data.students.forEach(student => {
          initialAttendance[student._id] = 'present'
        })
        setAttendance(initialAttendance)
      } else {
        toast('No students enrolled in this class')
        setStudents([])
      }
    } catch (error) {
      console.error('Error fetching students:', error)
      toast.error('Failed to load students')
      setStudents([])
    } finally {
      setIsLoading(false)
    }
  }

  const fetchExistingAttendance = async () => {
    if (!selectedClass?._id || !selectedDate) return

    try {
      const response = await attendanceService.getAttendance({
        classId: selectedClass._id,
        date: selectedDate,
        subject: selectedClass.subjects?.[0]?.name || 'General'
      })

      if (response?.data?.attendanceRecords) {
        const existingAttendance = {}
        response.data.attendanceRecords.forEach(record => {
          existingAttendance[record.studentId._id || record.studentId] = record.status
        })
        setAttendance(existingAttendance)
        toast.success('Loaded existing attendance')
      }
    } catch (error) {
      // No existing attendance, that's fine
      console.log('No existing attendance for this date')
    }
  }

  const updateAttendanceStatus = (studentId, status) => {
    setAttendance(prev => ({
      ...prev,
      [studentId]: status
    }))
  }

  const markAllAs = (status) => {
    const newAttendance = {}
    students.forEach(student => {
      newAttendance[student._id] = status
    })
    setAttendance(newAttendance)
    toast.success(`Marked all students as ${status}`)
  }

  const saveAttendance = async () => {
    if (!selectedClass || students.length === 0) {
      toast.error('Please select a class with students')
      return
    }

    try {
      setIsSaving(true)

      const attendanceRecords = students.map(student => ({
        studentId: student._id,
        admissionNumber: student.admissionNumber || student.admission_number,
        status: attendance[student._id] || 'present'
      }))

      const response = await attendanceService.saveAttendance({
        classId: selectedClass._id,
        date: selectedDate,
        subject: selectedClass.subjects?.[0]?.name || 'General',
        attendanceRecords
      })

      toast.success('Attendance saved successfully!')
    } catch (error) {
      console.error('Error saving attendance:', error)
      toast.error(error.response?.data?.message || 'Failed to save attendance')
    } finally {
      setIsSaving(false)
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'present':
        return <CheckCircle className="h-5 w-5 text-green-600" />
      case 'absent':
        return <XCircle className="h-5 w-5 text-red-600" />
      case 'late':
        return <Clock className="h-5 w-5 text-yellow-600" />
      default:
        return <CheckCircle className="h-5 w-5 text-green-600" />
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'present':
        return 'bg-green-100 text-green-800'
      case 'absent':
        return 'bg-red-100 text-red-800'
      case 'late':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-green-100 text-green-800'
    }
  }

  // Show loading state
  if (isLoading && classes.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500"></div>
      </div>
    )
  }

  // Show empty state if no classes
  if (classes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <AlertTriangle className="h-16 w-16 text-gray-400 mb-4" />
        <p className="text-xl text-gray-600 mb-2">No Classes Available</p>
        <p className="text-gray-500 mb-4">
          {user?.role === 'admin'
            ? 'Please create classes first before marking attendance.'
            : 'Please contact the administrator to create classes and assign you to them.'}
        </p>
        {user?.role === 'admin' && (
          <a
            href="/app/classes"
            className="btn btn-primary"
          >
            Go to Classes & Sections
          </a>
        )}
      </div>
    )
  }

  // Show empty state if no students
  if (selectedClass && students.length === 0 && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <Users className="h-16 w-16 text-gray-400 mb-4" />
        <p className="text-xl text-gray-600 mb-2">No Students Enrolled</p>
        <p className="text-gray-500">This class has no students yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Attendance Management</h1>
        <div className="flex space-x-3">
          <button
            className="btn btn-outline"
            onClick={() => setShowReportModal(true)}
          >
            <Download className="h-4 w-4 mr-2" />
            Generate Report
          </button>
        </div>
      </div>

      {/* Date and Class Selection */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Date
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Class
            </label>
            <select
              value={selectedClass?._id || ''}
              onChange={(e) => {
                const cls = classes.find(c => c._id === e.target.value)
                setSelectedClass(cls)
              }}
              className="input"
            >
              <option value="">Choose a class</option>
              {classes.map(cls => (
                <option key={cls._id} value={cls._id}>
                  {cls.name} - {cls.subjects?.[0]?.name || 'General'}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={saveAttendance}
              disabled={!selectedClass || isLoading || isSaving || students.length === 0}
              className="btn btn-primary w-full"
            >
              {isSaving ? 'Saving...' : 'Save Attendance'}
            </button>
          </div>
        </div>
      </div>

      {/* Attendance List */}
      {selectedClass && students.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">
              Attendance for {selectedClass.name} - {selectedDate}
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Click on the status buttons to mark attendance
            </p>

            {/* Search and Bulk Actions */}
            <div className="mt-4 flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Search by name or admission number..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="input w-full"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => markAllAs('present')}
                  className="btn btn-sm bg-green-100 text-green-700 hover:bg-green-200"
                  title="Mark all as present"
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  All Present
                </button>
                <button
                  onClick={() => markAllAs('absent')}
                  className="btn btn-sm bg-red-100 text-red-700 hover:bg-red-200"
                  title="Mark all as absent"
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  All Absent
                </button>
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500"></div>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredStudents.length === 0 ? (
                <div className="px-6 py-8 text-center text-gray-500">
                  No students found matching "{searchTerm}"
                </div>
              ) : (
                filteredStudents.map((student) => (
                  <div key={student._id} className="px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="flex-shrink-0">
                        <div className="h-10 w-10 bg-gray-300 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-gray-700">
                            {student.name.charAt(0)}
                          </span>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{student.name}</p>
                        <div className="flex items-center gap-2">
                          <p className="text-sm text-gray-500">
                            <span className="font-mono font-semibold text-teal-600">
                              {student.admissionNumber || student.admission_number || 'N/A'}
                            </span>
                          </p>
                          {student.admissionNumber && (
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(student.admissionNumber || student.admission_number)
                                toast.success('Admission number copied!')
                              }}
                              className="text-gray-400 hover:text-teal-600 transition-colors"
                              title="Copy admission number"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => updateAttendanceStatus(student._id, 'present')}
                        className={`px-3 py-1 rounded-full text-sm font-medium flex items-center space-x-1 ${attendance[student._id] === 'present'
                          ? 'bg-green-100 text-green-800 border-2 border-green-300'
                          : 'bg-gray-100 text-gray-600 hover:bg-green-50'
                          }`}
                      >
                        <CheckCircle className="h-4 w-4" />
                        <span>Present</span>
                      </button>
                      <button
                        onClick={() => updateAttendanceStatus(student._id, 'late')}
                        className={`px-3 py-1 rounded-full text-sm font-medium flex items-center space-x-1 ${attendance[student._id] === 'late'
                          ? 'bg-yellow-100 text-yellow-800 border-2 border-yellow-300'
                          : 'bg-gray-100 text-gray-600 hover:bg-yellow-50'
                          }`}
                      >
                        <Clock className="h-4 w-4" />
                        <span>Late</span>
                      </button>
                      <button
                        onClick={() => updateAttendanceStatus(student._id, 'absent')}
                        className={`px-3 py-1 rounded-full text-sm font-medium flex items-center space-x-1 ${attendance[student._id] === 'absent'
                          ? 'bg-red-100 text-red-800 border-2 border-red-300'
                          : 'bg-gray-100 text-gray-600 hover:bg-red-50'
                          }`}
                      >
                        <XCircle className="h-4 w-4" />
                        <span>Absent</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Attendance Summary */}
      {selectedClass && students.length > 0 && attendance && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Attendance Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {students.filter(s => attendance[s._id] === 'present').length}
              </div>
              <div className="text-sm text-green-600">Present</div>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">
                {students.filter(s => attendance[s._id] === 'late').length}
              </div>
              <div className="text-sm text-yellow-600">Late</div>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">
                {students.filter(s => attendance[s._id] === 'absent').length}
              </div>
              <div className="text-sm text-red-600">Absent</div>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {students.length > 0
                  ? ((students.filter(s => attendance[s._id] === 'present').length / students.length) * 100).toFixed(1)
                  : 0}%
              </div>
              <div className="text-sm text-blue-600">Attendance Rate</div>
            </div>
          </div>
        </div>
      )}

      {/* Report Generation Modal */}
      {showReportModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-content p-6">
            <div className="flex items-center justify-between border-b border-gray-200 pb-4 mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Generate Attendance Report</h3>
              <button
                className="p-2 rounded-md hover:bg-gray-100"
                onClick={() => setShowReportModal(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Attendance report feature is coming soon. For now, you can view attendance history in the attendance table above.
              </p>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  className="btn btn-ghost"
                  onClick={() => setShowReportModal(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Attendance
