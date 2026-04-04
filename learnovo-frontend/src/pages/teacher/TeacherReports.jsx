import React, { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart3, Users, Calendar, Download, BookOpen, ClipboardList,
  TrendingUp, AlertTriangle, CheckCircle, XCircle, Clock
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { attendanceService } from '../../services/attendanceService'
import { teacherAssignmentsService } from '../../services/academicsService'
import { reportsService } from '../../services/reportsService'
import { examsService } from '../../services/examsService'
import homeworkService from '../../services/homeworkService'
import toast from 'react-hot-toast'

const TeacherReports = () => {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('attendance')
  const [selectedClassId, setSelectedClassId] = useState('')
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())

  // Teacher's classes
  const { data: myClasses = [] } = useQuery({
    queryKey: ['teacher-report-classes'],
    queryFn: async () => {
      const res = await attendanceService.getTeacherClasses()
      return res?.data || []
    },
  })

  // Dashboard stats (teacher-specific from backend)
  const { data: dashboardData } = useQuery({
    queryKey: ['teacher-report-dashboard'],
    queryFn: async () => {
      const res = await reportsService.getDashboardStats()
      return res?.data || res || {}
    },
  })

  // Attendance monthly report
  const { data: attendanceReport, isLoading: attendanceLoading } = useQuery({
    queryKey: ['teacher-attendance-report', selectedClassId, month, year],
    queryFn: async () => {
      if (!selectedClassId) return null
      const res = await attendanceService.getMonthlyReport(selectedClassId, month, year)
      return res?.data || null
    },
    enabled: !!selectedClassId && activeTab === 'attendance',
  })

  // Teacher's assignments for subjects
  const { data: myAssignments = [] } = useQuery({
    queryKey: ['teacher-report-assignments', user?._id],
    queryFn: async () => {
      const res = await teacherAssignmentsService.list({ teacherId: user._id })
      return res.data || []
    },
    enabled: !!user?._id,
  })

  // Exams for teacher's subjects
  const { data: myExams = [] } = useQuery({
    queryKey: ['teacher-report-exams'],
    queryFn: async () => {
      const res = await examsService.list()
      return res.data || []
    },
    enabled: activeTab === 'academic',
  })

  // Homework stats
  const { data: homeworkData = [] } = useQuery({
    queryKey: ['teacher-report-homework'],
    queryFn: async () => {
      const res = await homeworkService.getHomeworkList()
      return res.success ? (res.data || []) : []
    },
    enabled: activeTab === 'homework',
  })

  const mySubjectNames = new Set(myAssignments.map(a => a.subjectId?.name).filter(Boolean))
  const myClassNames = new Set(myClasses.map(c => c.name || c.grade).filter(Boolean))

  const teacherExams = useMemo(() =>
    myExams.filter(e => mySubjectNames.has(e.subject) || myClassNames.has(e.class)),
    [myExams, mySubjectNames, myClassNames]
  )

  // Calculate homework stats
  const hwStats = useMemo(() => {
    const total = homeworkData.length
    const withSubmissions = homeworkData.filter(hw => hw.submissionStats)
    const totalStudents = withSubmissions.reduce((sum, hw) => sum + (hw.submissionStats?.total || 0), 0)
    const totalSubmitted = withSubmissions.reduce((sum, hw) => sum + (hw.submissionStats?.submitted || 0), 0)
    const overdue = homeworkData.filter(hw => new Date(hw.dueDate) < new Date()).length
    return { total, totalStudents, totalSubmitted, overdue, submissionRate: totalStudents > 0 ? Math.round((totalSubmitted / totalStudents) * 100) : 0 }
  }, [homeworkData])

  const stats = dashboardData || {}

  const exportAttendanceCSV = () => {
    if (!attendanceReport?.students) { toast.error('No data to export'); return }
    const rows = [['Student Name', 'Adm No', 'Present', 'Absent', 'Late', 'Total Days', 'Attendance %']]
    attendanceReport.students.forEach(s => {
      const total = (s.present || 0) + (s.absent || 0) + (s.late || 0)
      const pct = total > 0 ? Math.round(((s.present || 0) / total) * 100) : 0
      rows.push([s.name || s.studentName, s.admissionNumber || '', s.present || 0, s.absent || 0, s.late || 0, total, `${pct}%`])
    })
    const csv = rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `attendance_report_${month}_${year}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Report exported')
  }

  const tabs = [
    { id: 'attendance', label: 'Attendance', icon: Calendar },
    { id: 'academic', label: 'Academic Performance', icon: BarChart3 },
    { id: 'homework', label: 'Homework & Assignments', icon: ClipboardList },
  ]

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Reports</h1>
        <p className="text-sm text-gray-500 dark:text-[#8E8E93] mt-1">
          View attendance, academic performance, and submission reports for your classes
        </p>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'My Students', value: stats.myStudents || 0, icon: Users, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-500/20' },
          { label: 'My Classes', value: stats.myClasses || myClasses.length, icon: BookOpen, color: 'text-primary-600 dark:text-primary-400', bg: 'bg-primary-100 dark:bg-primary-500/20' },
          { label: 'Active Assignments', value: stats.activeAssignments || 0, icon: ClipboardList, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-500/20' },
          { label: 'Today Attendance', value: stats.attendanceToday ? `${stats.attendanceToday}%` : '-', icon: CheckCircle, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-500/20' },
        ].map((stat, i) => (
          <div key={i} className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass p-4 dark:border dark:border-[#38383A]">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${stat.bg}`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-[#8E8E93]">{stat.label}</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-[#38383A] overflow-x-auto overflow-y-hidden">
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

      {/* Attendance Tab */}
      {activeTab === 'attendance' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="card p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-[#8E8E93] mb-1">Class</label>
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="w-full sm:w-48 px-3 py-2 input"
                >
                  <option value="">Select Class</option>
                  {myClasses.map(cls => (
                    <option key={cls._id} value={cls._id}>{cls.name || cls.grade}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-[#8E8E93] mb-1">Month</label>
                <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="w-full sm:w-32 px-3 py-2 input">
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>{new Date(2024, i).toLocaleString('en', { month: 'long' })}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-[#8E8E93] mb-1">Year</label>
                <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-full sm:w-28 px-3 py-2 input">
                  {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              {attendanceReport && (
                <div className="flex items-end">
                  <button onClick={exportAttendanceCSV} className="btn btn-outline flex items-center gap-2">
                    <Download className="h-4 w-4" />
                    Export CSV
                  </button>
                </div>
              )}
            </div>
          </div>

          {!selectedClassId ? (
            <div className="card p-12 text-center">
              <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-600 dark:text-[#8E8E93]">Select a class to view report</p>
            </div>
          ) : attendanceLoading ? (
            <div className="flex items-center justify-center h-48"><div className="loading-spinner" /></div>
          ) : !attendanceReport ? (
            <div className="card p-12 text-center">
              <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-600 dark:text-[#8E8E93]">No attendance data for this period</p>
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              {attendanceReport.summary && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="card p-4 text-center">
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{attendanceReport.summary.totalStudents || 0}</p>
                    <p className="text-xs text-gray-500 dark:text-[#8E8E93]">Total Students</p>
                  </div>
                  <div className="card p-4 text-center">
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">{attendanceReport.summary.averageAttendance || 0}%</p>
                    <p className="text-xs text-gray-500 dark:text-[#8E8E93]">Avg Attendance</p>
                  </div>
                  <div className="card p-4 text-center">
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{attendanceReport.summary.workingDays || 0}</p>
                    <p className="text-xs text-gray-500 dark:text-[#8E8E93]">Working Days</p>
                  </div>
                  <div className="card p-4 text-center">
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                      {attendanceReport.students?.filter(s => {
                        const total = (s.present || 0) + (s.absent || 0) + (s.late || 0)
                        return total > 0 && ((s.present || 0) / total) * 100 < 75
                      }).length || 0}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-[#8E8E93]">Below 75%</p>
                  </div>
                </div>
              )}

              {/* Student-wise Table */}
              {attendanceReport.students && attendanceReport.students.length > 0 && (
                <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass overflow-hidden dark:border dark:border-[#38383A]">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[600px]">
                      <thead>
                        <tr className="bg-gray-50/80 dark:bg-[#2C2C2E]">
                          <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Student</th>
                          <th className="text-center px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Present</th>
                          <th className="text-center px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Absent</th>
                          <th className="text-center px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Late</th>
                          <th className="text-center px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Attendance %</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 dark:divide-[#2C2C2E]">
                        {attendanceReport.students.map((s, idx) => {
                          const total = (s.present || 0) + (s.absent || 0) + (s.late || 0)
                          const pct = total > 0 ? Math.round(((s.present || 0) / total) * 100) : 0
                          return (
                            <tr key={s.studentId || idx} className="hover:bg-primary-50 dark:hover:bg-[#2C2C2E]">
                              <td className="px-4 py-3">
                                <p className="text-sm font-medium text-gray-900 dark:text-white">{s.name || s.studentName}</p>
                                {s.admissionNumber && <p className="text-xs text-gray-500 dark:text-[#8E8E93]">#{s.admissionNumber}</p>}
                              </td>
                              <td className="px-4 py-3 text-center text-sm text-green-600 dark:text-green-400 font-medium">{s.present || 0}</td>
                              <td className="px-4 py-3 text-center text-sm text-red-600 dark:text-red-400 font-medium">{s.absent || 0}</td>
                              <td className="px-4 py-3 text-center text-sm text-amber-600 dark:text-amber-400 font-medium">{s.late || 0}</td>
                              <td className="px-4 py-3 text-center">
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${
                                  pct >= 75
                                    ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-[rgba(48,209,88,0.12)] dark:text-[#30D158] dark:ring-0'
                                    : 'bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-[rgba(255,69,58,0.12)] dark:text-[#FF453A] dark:ring-0'
                                }`}>
                                  {pct}%
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Academic Performance Tab */}
      {activeTab === 'academic' && (
        <div className="space-y-4">
          {teacherExams.length === 0 ? (
            <div className="card p-12 text-center">
              <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-600 dark:text-[#8E8E93]">No exam data available</p>
              <p className="text-sm text-gray-500 dark:text-[#636366] mt-1">Exam results for your subjects will appear here.</p>
            </div>
          ) : (
            <>
              {/* Exam Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="card p-4 text-center">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{teacherExams.length}</p>
                  <p className="text-xs text-gray-500 dark:text-[#8E8E93]">Total Exams</p>
                </div>
                <div className="card p-4 text-center">
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {teacherExams.filter(e => e.status === 'Completed').length}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-[#8E8E93]">Completed</p>
                </div>
                <div className="card p-4 text-center">
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {teacherExams.filter(e => e.status === 'Scheduled').length}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-[#8E8E93]">Scheduled</p>
                </div>
                <div className="card p-4 text-center">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {new Set(teacherExams.map(e => e.subject)).size}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-[#8E8E93]">My Subjects</p>
                </div>
              </div>

              {/* Exam List */}
              <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass overflow-hidden dark:border dark:border-[#38383A]">
                <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-[#38383A]">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">My Exams Overview</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px]">
                    <thead>
                      <tr className="bg-gray-50/80 dark:bg-[#2C2C2E]">
                        <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Exam</th>
                        <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Subject</th>
                        <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Class</th>
                        <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                        <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-[#2C2C2E]">
                      {teacherExams.slice(0, 20).map(exam => (
                        <tr key={exam._id} className="hover:bg-primary-50 dark:hover:bg-[#2C2C2E]">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{exam.name}</td>
                          <td className="px-4 py-3 text-sm text-gray-700 dark:text-[#8E8E93]">{exam.subject}</td>
                          <td className="px-4 py-3 text-sm text-gray-700 dark:text-[#8E8E93]">{exam.class}</td>
                          <td className="px-4 py-3 text-sm text-gray-700 dark:text-[#8E8E93]">
                            {exam.date ? new Date(exam.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '-'}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${
                              exam.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 dark:bg-[rgba(48,209,88,0.12)] dark:text-[#30D158]'
                              : exam.status === 'Scheduled' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400'
                              : 'bg-gray-100 text-gray-600 dark:bg-[rgba(142,142,147,0.12)] dark:text-[#8E8E93]'
                            }`}>
                              {exam.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Homework & Assignments Tab */}
      {activeTab === 'homework' && (
        <div className="space-y-4">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="card p-4 text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{hwStats.total}</p>
              <p className="text-xs text-gray-500 dark:text-[#8E8E93]">Total Homework</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{hwStats.submissionRate}%</p>
              <p className="text-xs text-gray-500 dark:text-[#8E8E93]">Submission Rate</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{hwStats.totalSubmitted}</p>
              <p className="text-xs text-gray-500 dark:text-[#8E8E93]">Total Submissions</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{hwStats.overdue}</p>
              <p className="text-xs text-gray-500 dark:text-[#8E8E93]">Past Due</p>
            </div>
          </div>

          {/* Homework List */}
          {homeworkData.length === 0 ? (
            <div className="card p-12 text-center">
              <ClipboardList className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-600 dark:text-[#8E8E93]">No homework data</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass overflow-hidden dark:border dark:border-[#38383A]">
              <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-[#38383A]">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">Homework Submission Report</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px]">
                  <thead>
                    <tr className="bg-gray-50/80 dark:bg-[#2C2C2E]">
                      <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Title</th>
                      <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Class</th>
                      <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Due Date</th>
                      <th className="text-center px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Submitted</th>
                      <th className="text-center px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-[#2C2C2E]">
                    {homeworkData.slice(0, 20).map(hw => {
                      const isOverdue = new Date(hw.dueDate) < new Date()
                      return (
                        <tr key={hw._id} className="hover:bg-primary-50 dark:hover:bg-[#2C2C2E]">
                          <td className="px-4 py-3">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-xs">{hw.title}</p>
                            <p className="text-xs text-gray-500 dark:text-[#8E8E93]">{hw.subject?.name || ''}</p>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700 dark:text-[#8E8E93]">{hw.class?.name || ''}</td>
                          <td className="px-4 py-3 text-sm text-gray-700 dark:text-[#8E8E93]">
                            {hw.dueDate ? new Date(hw.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '-'}
                          </td>
                          <td className="px-4 py-3 text-center text-sm font-medium text-gray-900 dark:text-white">
                            {hw.submissionStats ? `${hw.submissionStats.submitted}/${hw.submissionStats.total}` : '-'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${
                              isOverdue
                                ? 'bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-[rgba(255,69,58,0.12)] dark:text-[#FF453A] dark:ring-0'
                                : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-[rgba(48,209,88,0.12)] dark:text-[#30D158] dark:ring-0'
                            }`}>
                              {isOverdue ? 'Past Due' : 'Active'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default TeacherReports
