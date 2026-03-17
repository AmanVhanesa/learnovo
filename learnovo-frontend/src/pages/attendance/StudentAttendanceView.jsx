import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { Calendar, CheckCircle, XCircle, Clock, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react'
import { attendanceService } from '../../services/attendanceService'
import toast from 'react-hot-toast'

const statusColors = {
  present: 'bg-green-500',
  absent: 'bg-red-500',
  late: 'bg-yellow-500',
  half_day: 'bg-blue-500',
  excused: 'bg-gray-400',
  holiday: 'bg-purple-300',
  weekend: 'bg-gray-200 dark:bg-[#38383A]'
}

const statusLabels = {
  present: 'Present',
  absent: 'Absent',
  late: 'Late',
  half_day: 'Half Day',
  excused: 'Excused'
}

const StudentAttendanceView = () => {
  const { studentId } = useParams()
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1)
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [selectedDay, setSelectedDay] = useState(null)

  const { data: attendanceData, isLoading: isLoadingAttendance } = useQuery({
    queryKey: ['student-attendance', studentId, currentMonth, currentYear],
    queryFn: async () => {
      const [attendanceRes, summaryRes] = await Promise.all([
        attendanceService.getStudentAttendance(studentId, { month: currentMonth, year: currentYear }),
        attendanceService.getStudentSummary(studentId, { month: currentMonth, year: currentYear })
      ])
      return {
        student: attendanceRes?.data?.student,
        records: attendanceRes?.data?.records || [],
        summary: summaryRes?.data || null,
      }
    },
    enabled: !!studentId,
  })

  const student = attendanceData?.student ?? null
  const records = attendanceData?.records ?? []
  const summary = attendanceData?.summary ?? null
  const isLoading = isLoadingAttendance

  const goToPrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12)
      setCurrentYear(y => y - 1)
    } else {
      setCurrentMonth(m => m - 1)
    }
  }

  const goToNextMonth = () => {
    const now = new Date()
    const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1
    const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear
    if (new Date(nextYear, nextMonth - 1) > now) return
    if (currentMonth === 12) {
      setCurrentMonth(1)
      setCurrentYear(y => y + 1)
    } else {
      setCurrentMonth(m => m + 1)
    }
  }

  // Build calendar
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate()
  const firstDay = new Date(currentYear, currentMonth - 1, 1).getDay()
  const monthName = new Date(currentYear, currentMonth - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  // Map records by date
  const recordMap = {}
  records.forEach(r => {
    const d = new Date(r.date).getDate()
    recordMap[d] = r
  })

  const calendarDays = []
  for (let i = 0; i < firstDay; i++) calendarDays.push(null) // empty slots before first day
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d)

  const attendancePercentage = summary?.percentage || 0

  return (
    <div className="space-y-6">
      {/* Student Header */}
      {student && (
        <div className="card p-4 sm:p-6">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 bg-gray-200 dark:bg-[#2C2C2E] rounded-full flex items-center justify-center flex-shrink-0">
              {student.photo ? (
                <img src={student.photo} alt="" className="h-14 w-14 rounded-full object-cover" />
              ) : (
                <span className="text-lg font-semibold text-gray-600 dark:text-[#8E8E93]">{student.name?.charAt(0)}</span>
              )}
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">{student.name}</h1>
              <p className="text-sm text-gray-500 dark:text-[#8E8E93]">
                {student.class} {student.section ? `- ${student.section}` : ''} | {student.admissionNumber}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          <div className="card p-3 text-center">
            <p className="text-xs text-gray-500 dark:text-[#8E8E93]">Working Days</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{summary.totalDays}</p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-xs text-green-600">Present</p>
            <p className="text-xl font-bold text-green-600">{summary.present}</p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-xs text-red-600">Absent</p>
            <p className="text-xl font-bold text-red-600">{summary.absent}</p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-xs text-yellow-600">Late</p>
            <p className="text-xl font-bold text-yellow-600">{summary.late}</p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-xs text-blue-600">Half Day</p>
            <p className="text-xl font-bold text-blue-600">{summary.halfDay}</p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-xs text-gray-500 dark:text-[#8E8E93]">Attendance</p>
            <p className={`text-xl font-bold ${attendancePercentage >= 75 ? 'text-green-600' : attendancePercentage >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
              {attendancePercentage}%
            </p>
          </div>
        </div>
      )}

      {/* Attendance Rate Bar */}
      {summary && summary.totalDays > 0 && (
        <div className="card p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-[#8E8E93]">Monthly Attendance</span>
            <span className={`text-sm font-bold ${attendancePercentage >= 75 ? 'text-green-600' : attendancePercentage >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
              {attendancePercentage}%
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-[#2C2C2E] rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all ${attendancePercentage >= 75 ? 'bg-green-500' : attendancePercentage >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
              style={{ width: `${attendancePercentage}%` }}
            />
          </div>
          {attendancePercentage < 75 && (
            <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Attendance is below the required 75% minimum.
            </p>
          )}
        </div>
      )}

      {/* Calendar */}
      <div className="card p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <button onClick={goToPrevMonth} className="btn btn-ghost btn-sm">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">{monthName}</h3>
          <button onClick={goToNextMonth} className="btn btn-ghost btn-sm">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="loading-spinner" />
          </div>
        ) : (
          <>
            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                <div key={d} className="text-center text-xs font-medium text-gray-500 dark:text-[#8E8E93] py-1">{d}</div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day, idx) => {
                if (!day) return <div key={idx} />

                const record = recordMap[day]
                const status = record?.status
                const dotColor = status ? statusColors[status] : null
                const isToday = day === new Date().getDate() && currentMonth === new Date().getMonth() + 1 && currentYear === new Date().getFullYear()
                const isFuture = new Date(currentYear, currentMonth - 1, day) > new Date()

                return (
                  <button
                    key={idx}
                    onClick={() => record && setSelectedDay(selectedDay === day ? null : day)}
                    className={`aspect-square rounded-lg flex flex-col items-center justify-center text-sm transition-all ${
                      isToday ? 'ring-2 ring-primary-500' : ''
                    } ${isFuture ? 'opacity-40' : 'hover:bg-gray-50 dark:hover:bg-[#2C2C2E]'} ${
                      selectedDay === day ? 'bg-gray-100 dark:bg-[#2C2C2E]' : ''
                    }`}
                  >
                    <span className={`text-xs ${isToday ? 'font-bold text-primary-600' : 'text-gray-700 dark:text-[#8E8E93]'}`}>
                      {day}
                    </span>
                    {dotColor && (
                      <div className={`h-2 w-2 rounded-full mt-0.5 ${dotColor}`} />
                    )}
                  </button>
                )
              })}
            </div>

            {/* Selected day details */}
            {selectedDay && recordMap[selectedDay] && (
              <div className="mt-4 p-3 bg-gray-50 dark:bg-[#2C2C2E] rounded-xl">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {new Date(currentYear, currentMonth - 1, selectedDay).toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'short' })}
                  </span>
                  <span className={`px-2.5 py-1 text-xs font-semibold rounded-lg capitalize ${
                    recordMap[selectedDay].status === 'present' ? 'bg-green-100 text-green-700' :
                    recordMap[selectedDay].status === 'absent' ? 'bg-red-100 text-red-700' :
                    recordMap[selectedDay].status === 'late' ? 'bg-yellow-100 text-yellow-700' :
                    recordMap[selectedDay].status === 'half_day' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {statusLabels[recordMap[selectedDay].status] || recordMap[selectedDay].status}
                  </span>
                </div>
                {recordMap[selectedDay].remarks && (
                  <p className="text-xs text-gray-500 dark:text-[#8E8E93] mt-1">Remarks: {recordMap[selectedDay].remarks}</p>
                )}
                {recordMap[selectedDay].subject && (
                  <p className="text-xs text-gray-500 dark:text-[#8E8E93] mt-0.5">Subject: {recordMap[selectedDay].subject}</p>
                )}
              </div>
            )}

            {/* Legend */}
            <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-[#38383A]">
              {Object.entries(statusColors).filter(([k]) => !['holiday', 'weekend'].includes(k)).map(([status, color]) => (
                <div key={status} className="flex items-center gap-1.5">
                  <div className={`h-2.5 w-2.5 rounded-full ${color}`} />
                  <span className="text-xs text-gray-500 dark:text-[#8E8E93] capitalize">{status.replace('_', ' ')}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default StudentAttendanceView
