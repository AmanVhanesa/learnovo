import React, { useState, useEffect } from 'react'
import { CheckCircle, XCircle, Clock, Search, Users, Info } from 'lucide-react'
import DatePicker from '../../components/ui/DatePicker'
import { attendanceService } from '../../services/attendanceService'
import toast from 'react-hot-toast'
import { sortByRelevance } from '../../utils/searchRelevance'

const statusConfig = {
  present: { label: 'P', activeColor: 'bg-green-500 text-white border-green-500', color: 'bg-green-100 text-green-800 border-green-300' },
  absent: { label: 'A', activeColor: 'bg-red-500 text-white border-red-500', color: 'bg-red-100 text-red-800 border-red-300' },
  late: { label: 'L', activeColor: 'bg-yellow-500 text-white border-yellow-500', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  half_day: { label: 'H', activeColor: 'bg-blue-500 text-white border-blue-500', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  on_leave: { label: 'Lv', activeColor: 'bg-purple-500 text-white border-purple-500', color: 'bg-purple-100 text-purple-800 border-purple-300' },
  excused: { label: 'E', activeColor: 'bg-gray-500 text-white border-gray-500', color: 'bg-gray-100 text-gray-800 border-gray-300' }
}

const MarkEmployeeAttendance = () => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [employees, setEmployees] = useState([])
  const [filteredEmployees, setFilteredEmployees] = useState([])
  const [attendance, setAttendance] = useState({})
  const [checkInTimes, setCheckInTimes] = useState({})
  const [remarks, setRemarks] = useState({})
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isExistingRecord, setIsExistingRecord] = useState(false)

  useEffect(() => {
    fetchEmployees()
  }, [selectedDate])

  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredEmployees(employees)
    } else {
      const q = searchTerm.toLowerCase()
      const matched = employees.filter(e =>
        e.name?.toLowerCase().includes(q) ||
        (e.department || '').toLowerCase().includes(q) ||
        (e.designation || '').toLowerCase().includes(q)
      )
      setFilteredEmployees(sortByRelevance(matched, searchTerm, [
        { key: 'name', weight: 1 },
        { key: 'department', weight: 0.7 },
        { key: 'designation', weight: 0.7 }
      ]))
    }
  }, [employees, searchTerm])

  const fetchEmployees = async () => {
    try {
      setIsLoading(true)
      const response = await attendanceService.getEmployees(selectedDate)
      const empList = response?.data || []
      setEmployees(empList)

      // Initialize attendance
      const initial = {}
      const initialCheckIn = {}
      const initialRemarks = {}
      let hasExisting = false

      empList.forEach(emp => {
        if (emp.attendance) {
          initial[emp._id] = emp.attendance.status
          if (emp.attendance.checkInTime) initialCheckIn[emp._id] = emp.attendance.checkInTime
          if (emp.attendance.remarks) initialRemarks[emp._id] = emp.attendance.remarks
          hasExisting = true
        } else {
          initial[emp._id] = 'present'
        }
      })

      setAttendance(initial)
      setCheckInTimes(initialCheckIn)
      setRemarks(initialRemarks)
      setIsExistingRecord(hasExisting)
    } catch (error) {
      console.error('Error:', error)
      setEmployees([])
    } finally {
      setIsLoading(false)
    }
  }

  const updateStatus = (empId, status) => {
    setAttendance(prev => ({ ...prev, [empId]: status }))
  }

  const markAllAs = (status) => {
    const newAttendance = {}
    employees.forEach(e => { newAttendance[e._id] = status })
    setAttendance(newAttendance)
    toast.success(`Marked all as ${status.replace('_', ' ')}`)
  }

  const saveAttendance = async () => {
    if (employees.length === 0) return
    try {
      setIsSaving(true)
      const records = employees.map(emp => ({
        employeeId: emp._id,
        status: attendance[emp._id] || 'present',
        checkInTime: checkInTimes[emp._id] || undefined,
        remarks: remarks[emp._id] || undefined
      }))

      await attendanceService.markEmployeeAttendance({
        date: selectedDate,
        records
      })
      toast.success('Employee attendance saved!')
      setIsExistingRecord(true)
    } catch (error) {
      toast.error(error?.message || 'Failed to save')
    } finally {
      setIsSaving(false)
    }
  }

  const presentCount = employees.filter(e => attendance[e._id] === 'present').length
  const absentCount = employees.filter(e => attendance[e._id] === 'absent').length

  return (
    <div className="space-y-4 sm:space-y-6 pb-24 sm:pb-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Mark Employee Attendance</h1>
        <p className="text-sm text-gray-500 dark:text-[#8E8E93] mt-1">Mark daily attendance for staff and teachers</p>
      </div>

      {/* Date & Status */}
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
          <div className="flex items-end">
            {isExistingRecord && (
              <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400 px-3 py-2 rounded-xl w-full">
                <Info className="h-4 w-4 flex-shrink-0" /> Already marked - editing
              </div>
            )}
          </div>
          <div className="flex items-end">
            <button onClick={saveAttendance} disabled={isSaving || employees.length === 0} className="btn btn-primary w-full">
              {isSaving ? 'Saving...' : 'Save Attendance'}
            </button>
          </div>
        </div>
      </div>

      {employees.length === 0 && !isLoading ? (
        <div className="card p-8 text-center">
          <Users className="h-10 w-10 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-500 dark:text-[#8E8E93]">No employees found</p>
        </div>
      ) : (
        <>
          {/* Search & Bulk */}
          <div className="card p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-[#636366]" />
                <input
                  type="text"
                  placeholder="Search by name, department..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="input pl-9"
                />
              </div>
              <div className="flex gap-2">
                <button onClick={() => markAllAs('present')} className="btn btn-sm bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400">All Present</button>
                <button onClick={() => markAllAs('absent')} className="btn btn-sm bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400">All Absent</button>
              </div>
            </div>
            <div className="flex gap-3 mt-3 text-xs sm:text-sm">
              <span className="text-gray-500 dark:text-[#8E8E93]">{employees.length} employees</span>
              <span className="text-green-600">{presentCount} P</span>
              <span className="text-red-600">{absentCount} A</span>
            </div>
          </div>

          {/* Employee List */}
          <div className="card overflow-hidden divide-y divide-gray-100 dark:divide-dark-border">
            {isLoading ? (
              <div className="flex items-center justify-center h-32"><div className="loading-spinner" /></div>
            ) : (
              filteredEmployees.map((emp, idx) => (
                <div key={emp._id} className="px-3 sm:px-5 py-3 sm:py-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className="text-xs text-gray-400 w-6 text-right flex-shrink-0">{idx + 1}</span>
                      <div className="h-8 w-8 bg-gray-200 dark:bg-[#2C2C2E] rounded-full flex items-center justify-center flex-shrink-0">
                        {emp.photo ? (
                          <img src={emp.photo} alt="" className="h-8 w-8 rounded-full object-cover" />
                        ) : (
                          <span className="text-xs font-medium text-gray-600 dark:text-[#8E8E93]">{emp.name?.charAt(0)}</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{emp.name}</p>
                        <p className="text-xs text-gray-500 dark:text-[#8E8E93]">{emp.department} {emp.designation ? `- ${emp.designation}` : ''}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 ml-11 sm:ml-0">
                      {Object.entries(statusConfig).map(([status, config]) => (
                        <button
                          key={status}
                          onClick={() => updateStatus(emp._id, status)}
                          className={`min-w-[36px] h-9 px-2 rounded-lg text-xs font-semibold border-2 transition-all ${
                            attendance[emp._id] === status ? config.activeColor : `${config.color} hover:opacity-80`
                          }`}
                        >
                          {config.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Sticky Save */}
          <div className="fixed bottom-0 left-0 right-0 sm:static bg-white dark:bg-[#1C1C1E] border-t sm:border-t-0 border-gray-200 dark:border-[#38383A] p-4 sm:p-0 z-40">
            <button onClick={saveAttendance} disabled={isSaving || employees.length === 0} className="btn btn-primary w-full sm:w-auto">
              {isSaving ? 'Saving...' : 'Save Attendance'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export default MarkEmployeeAttendance
