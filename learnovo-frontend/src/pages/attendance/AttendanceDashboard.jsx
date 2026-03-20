import React, { useState, useEffect } from 'react'
import { Calendar, Users, CheckCircle, XCircle, Clock, AlertTriangle, ChevronRight, ClipboardList, BarChart3, Settings } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { attendanceService } from '../../services/attendanceService'
import toast from 'react-hot-toast'

const AttendanceDashboard = ({ onTabChange }) => {
  const { user } = useAuth()
  const [dashboardData, setDashboardData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchDashboard()
  }, [])

  const fetchDashboard = async () => {
    try {
      setIsLoading(true)
      const response = await attendanceService.getDashboard()
      setDashboardData(response?.data || null)
    } catch (error) {
      toast.error('Failed to load dashboard')
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading-spinner" />
      </div>
    )
  }

  const data = dashboardData
  const students = data?.students || {}
  const employees = data?.employees || {}
  const weeklyTrend = data?.weeklyTrend || []
  const unmarkedClasses = data?.unmarkedClasses || []
  const todayAbsentees = data?.todayAbsentees || []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Attendance Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-[#8E8E93] mt-1">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4 sm:p-5">
          <div className="flex items-center justify-between mb-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <span className="text-xs font-medium text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-full">{students.percentage || 0}%</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{students.present || 0}</p>
          <p className="text-xs text-gray-500 dark:text-[#8E8E93] mt-0.5">Students Present / {students.total || 0}</p>
        </div>

        <div className="card p-4 sm:p-5">
          <div className="flex items-center justify-between mb-2">
            <XCircle className="h-5 w-5 text-red-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{students.absent || 0}</p>
          <p className="text-xs text-gray-500 dark:text-[#8E8E93] mt-0.5">Students Absent</p>
        </div>

        <div className="card p-4 sm:p-5">
          <div className="flex items-center justify-between mb-2">
            <Users className="h-5 w-5 text-blue-500" />
            <span className="text-xs font-medium text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-full">{employees.percentage || 0}%</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{employees.present || 0}</p>
          <p className="text-xs text-gray-500 dark:text-[#8E8E93] mt-0.5">Employees Present / {employees.total || 0}</p>
        </div>

        <div className="card p-4 sm:p-5">
          <div className="flex items-center justify-between mb-2">
            <AlertTriangle className={`h-5 w-5 ${(data?.unmarkedCount || 0) > 0 ? 'text-amber-500' : 'text-green-500'}`} />
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{data?.unmarkedCount || 0}</p>
          <p className="text-xs text-gray-500 dark:text-[#8E8E93] mt-0.5">Classes Not Marked</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          onClick={() => onTabChange?.('markStudents')}
          className="card p-4 text-left hover:shadow-glass-md transition-all group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-primary-50 dark:bg-primary-900/20 rounded-xl flex items-center justify-center">
                <ClipboardList className="h-5 w-5 text-primary-600 dark:text-primary-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Mark Attendance</p>
                <p className="text-xs text-gray-500 dark:text-[#8E8E93]">Students</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-primary-500 transition-colors" />
          </div>
        </button>

        <button
          onClick={() => onTabChange?.('absentees')}
          className="card p-4 text-left hover:shadow-glass-md transition-all group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-red-50 dark:bg-red-900/20 rounded-xl flex items-center justify-center">
                <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">View Absentees</p>
                <p className="text-xs text-gray-500 dark:text-[#8E8E93]">Today's absent list</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-red-500 transition-colors" />
          </div>
        </button>

        <button
          onClick={() => onTabChange?.('report')}
          className="card p-4 text-left hover:shadow-glass-md transition-all group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Monthly Report</p>
                <p className="text-xs text-gray-500 dark:text-[#8E8E93]">Class-wise reports</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
          </div>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Trend */}
        <div className="card p-4 sm:p-6">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Weekly Attendance Trend</h3>
          {weeklyTrend.length > 0 ? (
            <div className="space-y-3">
              {weeklyTrend.map((day, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 dark:text-[#8E8E93] w-16">{day.day} {new Date(day.date).getDate()}</span>
                  <div className="flex-1 bg-gray-100 dark:bg-[#2C2C2E] rounded-full h-6 relative overflow-hidden">
                    <div
                      className="h-full bg-primary-500 rounded-full transition-all flex items-center justify-end pr-2"
                      style={{ width: `${Math.max(day.percentage, 5)}%` }}
                    >
                      <span className="text-[10px] font-semibold text-white">{day.percentage}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-[#8E8E93] text-center py-8">No attendance data for this week</p>
          )}
        </div>

        {/* Unmarked Classes */}
        <div className="card p-4 sm:p-6">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Unmarked Classes</h3>
          {unmarkedClasses.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="h-10 w-10 text-green-500 mx-auto mb-2" />
              <p className="text-sm font-medium text-green-600 dark:text-green-400">All classes marked for today!</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {unmarkedClasses.map((cls, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-amber-50/50 dark:bg-amber-900/10 rounded-xl">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {cls.className}{cls.sectionName ? ` - ${cls.sectionName}` : ''}
                    </p>
                    {cls.teacherName && (
                      <p className="text-xs text-gray-500 dark:text-[#8E8E93]">{cls.teacherName}</p>
                    )}
                  </div>
                  <button
                    onClick={() => onTabChange?.('markStudents')}
                    className="btn btn-sm btn-primary"
                  >
                    Mark
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Today's Absentees */}
      {todayAbsentees.length > 0 && (
        <div className="card p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Today's Absent Students</h3>
            <button
              onClick={() => onTabChange?.('absentees')}
              className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
            >
              View All
            </button>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-dark-border">
            {todayAbsentees.map((student, idx) => (
              <div key={idx} className="flex items-center gap-3 py-2.5">
                <div className="h-8 w-8 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
                  <span className="text-xs font-medium text-red-600 dark:text-red-400">{student.name?.charAt(0)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{student.name}</p>
                  <p className="text-xs text-gray-500 dark:text-[#8E8E93]">{student.class} {student.section ? `- ${student.section}` : ''}</p>
                </div>
                <span className="status-badge status-overdue text-xs">Absent</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default AttendanceDashboard
