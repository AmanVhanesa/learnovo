import React, { useState, useEffect, useCallback } from 'react'
import { CheckCircle, XCircle, Clock, AlertTriangle, Search, Users, ChevronRight, Info } from 'lucide-react'
import DatePicker from '../../components/ui/DatePicker'
import Select from '../../components/ui/Select'
import { useAuth } from '../../contexts/AuthContext'
import { attendanceService } from '../../services/attendanceService'
import toast from 'react-hot-toast'

const statusConfig = {
  present: { label: 'P', color: 'bg-green-100 text-green-800 border-green-300', activeColor: 'bg-green-500 text-white border-green-500' },
  absent: { label: 'A', color: 'bg-red-100 text-red-800 border-red-300', activeColor: 'bg-red-500 text-white border-red-500' },
  late: { label: 'L', color: 'bg-yellow-100 text-yellow-800 border-yellow-300', activeColor: 'bg-yellow-500 text-white border-yellow-500' },
  half_day: { label: 'H', color: 'bg-blue-100 text-blue-800 border-blue-300', activeColor: 'bg-blue-500 text-white border-blue-500' },
  excused: { label: 'E', color: 'bg-gray-100 text-gray-800 border-gray-300', activeColor: 'bg-gray-500 text-white border-gray-500' }
}

const MarkStudentAttendance = () => {
  const { user } = useAuth()
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [classes, setClasses] = useState([])
  const [selectedClass, setSelectedClass] = useState(null)
  const [students, setStudents] = useState([])
  const [filteredStudents, setFilteredStudents] = useState([])
  const [attendance, setAttendance] = useState({})
  const [remarks, setRemarks] = useState({})
  const [expandedRemarks, setExpandedRemarks] = useState({})
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isExistingRecord, setIsExistingRecord] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  useEffect(() => {
    fetchClasses()
  }, [])

  useEffect(() => {
    if (selectedClass) {
      fetchStudents()
      fetchExistingAttendance()
    }
  }, [selectedClass, selectedDate])

  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredStudents(students)
    } else {
      const q = searchTerm.toLowerCase()
      setFilteredStudents(students.filter(s =>
        s.name?.toLowerCase().includes(q) ||
        (s.admissionNumber || '').toLowerCase().includes(q)
      ))
    }
  }, [students, searchTerm])

  // Unsaved changes warning
  useEffect(() => {
    const handler = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [hasUnsavedChanges])

  const fetchClasses = async () => {
    try {
      setIsLoading(true)
      let response
      if (user?.role === 'admin') {
        response = await attendanceService.getAllClasses()
        setClasses(response?.data || [])
      } else {
        response = await attendanceService.getTeacherClasses()
        setClasses(response?.data || [])
      }
    } catch (error) {
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
      const studentList = response?.data?.students || []
      setStudents(studentList)

      // Default all to present
      const initial = {}
      studentList.forEach(s => { initial[s._id] = 'present' })
      setAttendance(initial)
      setRemarks({})
      setIsExistingRecord(false)
      setHasUnsavedChanges(false)
    } catch (error) {
      setStudents([])
    } finally {
      setIsLoading(false)
    }
  }

  const fetchExistingAttendance = async () => {
    if (!selectedClass?._id) return
    try {
      const response = await attendanceService.getAttendance({
        classId: selectedClass._id,
        date: selectedDate
      })

      if (response?.data?.attendanceRecords) {
        const existing = {}
        const existingRemarks = {}
        response.data.attendanceRecords.forEach(r => {
          const sid = r.studentId?._id || r.studentId
          existing[sid] = r.status
          if (r.remarks) existingRemarks[sid] = r.remarks
        })
        setAttendance(prev => ({ ...prev, ...existing }))
        setRemarks(existingRemarks)
        setIsExistingRecord(true)
      }
    } catch {
      // No existing record
    }
  }

  const updateStatus = (studentId, status) => {
    setAttendance(prev => ({ ...prev, [studentId]: status }))
    setHasUnsavedChanges(true)
  }

  const markAllAs = (status) => {
    const newAttendance = {}
    students.forEach(s => { newAttendance[s._id] = status })
    setAttendance(newAttendance)
    setHasUnsavedChanges(true)
    toast.success(`Marked all as ${status.replace('_', ' ')}`)
  }

  const saveAttendance = async () => {
    if (!selectedClass || students.length === 0) return

    const unmarked = students.filter(s => !attendance[s._id])
    if (unmarked.length > 0) {
      toast.error(`${unmarked.length} students have no status marked`)
      return
    }

    try {
      setIsSaving(true)
      const records = students.map(s => ({
        studentId: s._id,
        admissionNumber: s.admissionNumber,
        status: attendance[s._id] || 'present',
        remarks: remarks[s._id] || undefined
      }))

      await attendanceService.saveAttendance({
        classId: selectedClass._id,
        date: selectedDate,
        subject: 'General',
        attendanceRecords: records
      })

      toast.success('Attendance saved successfully!')
      setHasUnsavedChanges(false)
      setIsExistingRecord(true)
    } catch (error) {
      toast.error(error?.message || 'Failed to save attendance')
    } finally {
      setIsSaving(false)
    }
  }

  const presentCount = students.filter(s => attendance[s._id] === 'present').length
  const absentCount = students.filter(s => attendance[s._id] === 'absent').length
  const lateCount = students.filter(s => attendance[s._id] === 'late').length
  const halfDayCount = students.filter(s => attendance[s._id] === 'half_day').length
  const excusedCount = students.filter(s => attendance[s._id] === 'excused').length

  if (isLoading && classes.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading-spinner" />
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6 pb-24 sm:pb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Mark Student Attendance</h1>
          <p className="text-sm text-gray-500 dark:text-[#8E8E93] mt-1">Select a class and mark daily attendance</p>
        </div>
      </div>

      {/* Class & Date Selection */}
      <div className="card p-4 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1.5">Date</label>
            <DatePicker
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1.5">Class</label>
            <Select
              value={selectedClass?._id || ''}
              onChange={(e) => {
                const cls = classes.find(c => c._id === e.target.value)
                setSelectedClass(cls || null)
              }}
              placeholder="Select a class"
              options={[
                { value: '', label: 'Select a class' },
                ...classes.map(cls => ({
                  value: cls._id,
                  label: `${cls.name}${cls.grade ? ` (${cls.grade})` : ''}`
                }))
              ]}
            />
          </div>
          <div className="flex items-end">
            {isExistingRecord ? (
              <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-xl w-full">
                <Info className="h-4 w-4 flex-shrink-0" />
                <span>Already marked - editing</span>
              </div>
            ) : selectedClass && students.length > 0 ? (
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-3 py-2 rounded-xl w-full">
                <CheckCircle className="h-4 w-4 flex-shrink-0" />
                <span>New - marking for first time</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Empty states */}
      {classes.length === 0 && !isLoading && (
        <div className="card p-8 text-center">
          <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <p className="text-lg font-medium text-gray-600 dark:text-[#8E8E93]">No Classes Available</p>
          <p className="text-sm text-gray-500 dark:text-[#8E8E93] mt-1">
            {user?.role === 'admin' ? 'Create classes first.' : 'Contact admin to assign classes.'}
          </p>
        </div>
      )}

      {selectedClass && students.length === 0 && !isLoading && (
        <div className="card p-8 text-center">
          <Users className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <p className="text-lg font-medium text-gray-600 dark:text-[#8E8E93]">No Students</p>
          <p className="text-sm text-gray-500 dark:text-[#8E8E93] mt-1">No students enrolled in this class.</p>
        </div>
      )}

      {/* Student List */}
      {selectedClass && students.length > 0 && (
        <>
          {/* Search & Bulk Actions */}
          <div className="card p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-[#636366]" />
                <input
                  type="text"
                  placeholder="Search by name or admission number..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="input pl-9"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => markAllAs('present')} className="btn btn-sm bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400">
                  All Present
                </button>
                <button onClick={() => markAllAs('absent')} className="btn btn-sm bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400">
                  All Absent
                </button>
              </div>
            </div>

            {/* Summary bar */}
            <div className="flex flex-wrap gap-3 mt-3 text-xs sm:text-sm">
              <span className="text-gray-500 dark:text-[#8E8E93]">{students.length} students</span>
              <span className="text-green-600">{presentCount} P</span>
              <span className="text-red-600">{absentCount} A</span>
              <span className="text-yellow-600">{lateCount} L</span>
              <span className="text-blue-600">{halfDayCount} H</span>
              <span className="text-gray-500 dark:text-[#8E8E93]">{excusedCount} E</span>
            </div>
          </div>

          {/* Student Rows */}
          <div className="card overflow-hidden divide-y divide-gray-100 dark:divide-dark-border">
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="loading-spinner" />
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="p-6 text-center text-gray-500 dark:text-[#8E8E93]">No students found matching "{searchTerm}"</div>
            ) : (
              filteredStudents.map((student, idx) => (
                <div key={student._id} className="px-3 sm:px-5 py-3 sm:py-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    {/* Student Info */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className="text-xs text-gray-400 w-6 text-right flex-shrink-0">{idx + 1}</span>
                      <div className="h-8 w-8 bg-gray-200 dark:bg-[#2C2C2E] rounded-full flex items-center justify-center flex-shrink-0">
                        {student.photo ? (
                          <img src={student.photo} alt="" className="h-8 w-8 rounded-full object-cover" />
                        ) : (
                          <span className="text-xs font-medium text-gray-600 dark:text-[#8E8E93]">{student.name?.charAt(0)}</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{student.name}</p>
                        <p className="text-xs text-gray-500 dark:text-[#8E8E93] font-mono">{student.admissionNumber || 'N/A'}</p>
                      </div>
                    </div>

                    {/* Status Buttons */}
                    <div className="flex items-center gap-1.5 ml-11 sm:ml-0">
                      {Object.entries(statusConfig).map(([status, config]) => (
                        <button
                          key={status}
                          onClick={() => updateStatus(student._id, status)}
                          className={`min-w-[40px] h-10 sm:h-9 px-2.5 rounded-lg text-xs sm:text-sm font-semibold border-2 transition-all ${
                            attendance[student._id] === status
                              ? config.activeColor
                              : `${config.color} hover:opacity-80`
                          }`}
                        >
                          {config.label}
                        </button>
                      ))}

                      {/* Remark toggle */}
                      <button
                        onClick={() => setExpandedRemarks(prev => ({ ...prev, [student._id]: !prev[student._id] }))}
                        className="text-xs text-gray-400 hover:text-primary-500 ml-1 whitespace-nowrap"
                      >
                        {expandedRemarks[student._id] ? 'hide' : '+ remark'}
                      </button>
                    </div>
                  </div>

                  {/* Remark input */}
                  {expandedRemarks[student._id] && (
                    <div className="mt-2 ml-11 sm:ml-14">
                      <input
                        type="text"
                        placeholder="Add remark (reason for absence, etc.)"
                        value={remarks[student._id] || ''}
                        onChange={(e) => {
                          setRemarks(prev => ({ ...prev, [student._id]: e.target.value }))
                          setHasUnsavedChanges(true)
                        }}
                        className="input text-sm"
                      />
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Sticky Save Bar */}
          <div className="fixed bottom-0 left-0 right-0 sm:static bg-white dark:bg-[#1C1C1E] border-t sm:border-t-0 border-gray-200 dark:border-[#38383A] p-4 sm:p-0 z-40">
            <div className="flex items-center justify-between gap-3 max-w-screen-xl mx-auto">
              <div className="text-sm text-gray-500 dark:text-[#8E8E93] hidden sm:block">
                {presentCount} Present, {absentCount} Absent, {lateCount} Late
              </div>
              <button
                onClick={saveAttendance}
                disabled={isSaving || students.length === 0}
                className="btn btn-primary w-full sm:w-auto"
              >
                {isSaving ? 'Saving...' : 'Save Attendance'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default MarkStudentAttendance
