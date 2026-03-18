import React, { useState, lazy, Suspense } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Calendar, Users, CheckCircle, XCircle, Clock, AlertTriangle,
  ClipboardList, BarChart3, TrendingUp, Settings, UserCheck
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { attendanceService } from '../services/attendanceService'
import toast from 'react-hot-toast'

// ── Lazy-loaded tab content (each is the existing standalone page) ───────────
const AttendanceDashboard = lazy(() => import('./attendance/AttendanceDashboard'))
const MarkStudentAttendance = lazy(() => import('./attendance/MarkStudentAttendance'))
const MarkEmployeeAttendance = lazy(() => import('./attendance/MarkEmployeeAttendance'))
const Absentees = lazy(() => import('./attendance/Absentees'))
const MonthlyReport = lazy(() => import('./attendance/MonthlyReport'))
const Analytics = lazy(() => import('./attendance/Analytics'))
const Holidays = lazy(() => import('./attendance/Holidays'))
const AttendanceSettings = lazy(() => import('./attendance/AttendanceSettings'))

const TabLoader = () => (
  <div className="flex items-center justify-center h-48">
    <div className="loading-spinner" />
  </div>
)

// ── Student / Parent read-only view ─────────────────────────────────────────
const StudentAttendanceView = () => {
  const { data: attendanceData, isLoading } = useQuery({
    queryKey: ['my-attendance'],
    queryFn: async () => {
      const res = await attendanceService.getAttendanceReport({})
      return res.data || res || { summary: null, records: [] }
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading-spinner" />
      </div>
    )
  }

  const summary = attendanceData?.summary
  const records = attendanceData?.records || []
  const totalDays = summary?.totalDays || 0
  const presentDays = summary?.present || 0
  const absentDays = summary?.absent || 0
  const lateDays = summary?.late || 0
  const attendanceRate = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0

  return (
    <div className="space-y-6">
      <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">My Attendance</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4 sm:p-5 text-center">
          <CheckCircle className="h-6 w-6 sm:h-8 sm:w-8 text-green-500 mx-auto mb-2" />
          <p className="text-2xl sm:text-3xl font-bold text-green-700 dark:text-green-400">{presentDays}</p>
          <p className="text-sm text-gray-500 dark:text-[#8E8E93]">Days Present</p>
        </div>
        <div className="card p-4 sm:p-5 text-center">
          <XCircle className="h-6 w-6 sm:h-8 sm:w-8 text-red-500 mx-auto mb-2" />
          <p className="text-2xl sm:text-3xl font-bold text-red-700 dark:text-red-400">{absentDays}</p>
          <p className="text-sm text-gray-500 dark:text-[#8E8E93]">Days Absent</p>
        </div>
        <div className="card p-4 sm:p-5 text-center">
          <Clock className="h-6 w-6 sm:h-8 sm:w-8 text-yellow-500 mx-auto mb-2" />
          <p className="text-2xl sm:text-3xl font-bold text-yellow-700 dark:text-yellow-400">{lateDays}</p>
          <p className="text-sm text-gray-500 dark:text-[#8E8E93]">Days Late</p>
        </div>
        <div className="card p-4 sm:p-5 text-center">
          <Calendar className="h-6 w-6 sm:h-8 sm:w-8 text-blue-500 mx-auto mb-2" />
          <p className="text-2xl sm:text-3xl font-bold text-blue-700 dark:text-blue-400">{attendanceRate}%</p>
          <p className="text-sm text-gray-500 dark:text-[#8E8E93]">Attendance Rate</p>
        </div>
      </div>

      {/* Attendance Rate Bar */}
      {totalDays > 0 && (
        <div className="card p-4 sm:p-5">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-[#8E8E93]">Overall Attendance</span>
            <span className={`text-sm font-bold ${attendanceRate >= 75 ? 'text-green-600' : attendanceRate >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
              {attendanceRate}%
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-[#2C2C2E] rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all ${attendanceRate >= 75 ? 'bg-green-500' : attendanceRate >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
              style={{ width: `${attendanceRate}%` }}
            />
          </div>
          {attendanceRate < 75 && (
            <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Your attendance is below the required 75% minimum.
            </p>
          )}
        </div>
      )}

      {/* Recent Attendance Records */}
      <div className="card overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-[#38383A]">
          <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white">Attendance History</h3>
        </div>
        {records.length > 0 ? (
          <div className="divide-y divide-gray-100 dark:divide-dark-border">
            {records.map((record, idx) => (
              <div key={idx} className="px-4 sm:px-6 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {new Date(record.date).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                  {record.subject && <p className="text-xs text-gray-500 dark:text-[#8E8E93]">{record.subject}</p>}
                </div>
                <span className={`px-3 py-1 text-xs font-semibold rounded-full capitalize ${
                  record.status === 'present' ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' :
                  record.status === 'absent' ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400' :
                  'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400'
                }`}>
                  {record.status}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-6 py-10 text-center text-gray-500 dark:text-[#8E8E93]">No attendance records found.</div>
        )}
      </div>
    </div>
  )
}

// ── Admin / Teacher tabbed view ─────────────────────────────────────────────
const ADMIN_TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: TrendingUp },
  { id: 'markStudents', label: 'Mark Students', icon: ClipboardList },
  { id: 'markStaff', label: 'Mark Staff', icon: UserCheck },
  { id: 'absentees', label: 'Absentees', icon: XCircle },
  { id: 'report', label: 'Monthly Report', icon: Calendar },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'holidays', label: 'Holidays', icon: Calendar },
  { id: 'settings', label: 'Settings', icon: Settings },
]

const TEACHER_TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: TrendingUp },
  { id: 'markStudents', label: 'Mark Students', icon: ClipboardList },
  { id: 'absentees', label: 'Absentees', icon: XCircle },
  { id: 'report', label: 'Monthly Report', icon: Calendar },
]

const AdminTeacherAttendance = () => {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('dashboard')

  const tabs = user?.role === 'admin' ? ADMIN_TABS : TEACHER_TABS

  const renderTab = () => {
    switch (activeTab) {
      case 'dashboard':
        return <AttendanceDashboard onTabChange={setActiveTab} />
      case 'markStudents':
        return <MarkStudentAttendance />
      case 'markStaff':
        return <MarkEmployeeAttendance />
      case 'absentees':
        return <Absentees />
      case 'report':
        return <MonthlyReport />
      case 'analytics':
        return <Analytics />
      case 'holidays':
        return <Holidays />
      case 'settings':
        return <AttendanceSettings />
      default:
        return <AttendanceDashboard />
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Attendance</h1>
        <p className="text-sm text-gray-500 dark:text-[#8E8E93] mt-1">
          Manage student and staff attendance
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-[#38383A] overflow-x-auto">
        <nav className="-mb-px flex space-x-4 sm:space-x-8 whitespace-nowrap">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-gray-500 dark:text-[#8E8E93] hover:text-gray-700 dark:hover:text-white hover:border-gray-300 dark:hover:border-[#38383A]'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <Suspense fallback={<TabLoader />}>
        {renderTab()}
      </Suspense>
    </div>
  )
}

// ── Main component: role-based rendering ────────────────────────────────────
const Attendance = () => {
  const { user } = useAuth()

  if (user?.role === 'student' || user?.role === 'parent') {
    return <StudentAttendanceView />
  }

  return <AdminTeacherAttendance />
}

export default Attendance
