import React, { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Download, BarChart3, TrendingUp, Calendar, Users,
  DollarSign, Activity, RefreshCw, AlertCircle,
  FileText, UserPlus, ChevronLeft, ChevronRight
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useSettings } from '../contexts/SettingsContext'
import api from '../services/authService'
import { studentsService } from '../services/studentsService'
import { sortClassObjects } from '../utils/classOrder'
import { exportPDF, exportReport } from '../utils/exportHelpers'
import toast from 'react-hot-toast'

const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0)
const fmtNum = (n) => new Intl.NumberFormat('en-IN').format(n || 0)
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '\u2014'
const fmtAmount = (n) => n != null ? Number(n).toFixed(2) : '0.00'

/** Helper: extract headers and row arrays from an array of objects */
function objsToAoa(objs) {
  if (!objs || objs.length === 0) return { headers: [], rows: [] }
  const headers = Object.keys(objs[0])
  const rows = objs.map(r => headers.map(h => r[h] ?? ''))
  return { headers, rows }
}

const StatCard = ({ icon: Icon, label, value, sub, color }) => (
  <div className="stat-card flex items-start gap-4">
    <div className={`p-3 rounded-xl ${color}`}><Icon className="h-5 w-5 text-white" /></div>
    <div className="min-w-0">
      <p className="text-xs text-gray-500 dark:text-[#8E8E93] font-medium uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-gray-900 dark:text-white mt-0.5 truncate">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  </div>
)

const MiniBar = ({ label, value, max, color }) => (
  <div className="flex items-center gap-3">
    <span className="text-xs text-gray-500 dark:text-[#8E8E93] w-24 shrink-0 truncate">{label}</span>
    <div className="flex-1 bg-gray-100 dark:bg-[#2C2C2E] rounded-full h-2">
      <div className={`h-2 rounded-full transition-all duration-500 ${color}`} style={{ width: `${max > 0 ? Math.min(100, (value / max) * 100) : 0}%` }} />
    </div>
    <span className="text-xs font-semibold text-gray-700 dark:text-[#8E8E93] min-w-[4rem] text-right whitespace-nowrap">{fmtNum(value)}</span>
  </div>
)

const ActivityIcon = ({ type }) => {
  const map = {
    fee: { icon: DollarSign, bg: 'bg-green-100 dark:bg-green-900/30', color: 'text-green-600 dark:text-green-400' },
    admission: { icon: UserPlus, bg: 'bg-blue-100 dark:bg-blue-900/30', color: 'text-blue-600 dark:text-blue-400' },
    employee: { icon: Users, bg: 'bg-purple-100 dark:bg-purple-900/30', color: 'text-purple-600 dark:text-purple-400' },
    certificate: { icon: FileText, bg: 'bg-yellow-100 dark:bg-yellow-900/30', color: 'text-yellow-600 dark:text-yellow-400' },
  }
  const cfg = map[type] || { icon: Activity, bg: 'bg-gray-100 dark:bg-[#2C2C2E]', color: 'text-gray-600 dark:text-[#8E8E93]' }
  return (<div className={`p-2 rounded-full ${cfg.bg} shrink-0`}><cfg.icon className={`h-4 w-4 ${cfg.color}`} /></div>)
}

const Reports = () => {
  const { user } = useAuth()
  const { settings } = useSettings()
  const queryClient = useQueryClient()
  const isAdmin = user?.role === 'admin'

  const [activeTab, setActiveTab] = useState('overview')
  const [actPage, setActPage] = useState(1)

  const today = new Date()
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10)
  const todayStr = today.toISOString().slice(0, 10)
  const [filters, setFilters] = useState({ startDate: firstOfMonth, endDate: todayStr, classId: '' })

  const { data: classes = [] } = useQuery({
    queryKey: ['reports-classes'],
    queryFn: async () => { const r = await api.get('/classes'); return sortClassObjects(r.data?.data || [], 'name') },
  })

  const { data: dashboard = null, isLoading: loadingDashboard, error: dashboardError, refetch: refetchDashboard } = useQuery({
    queryKey: ['reports-dashboard'],
    queryFn: async () => { const r = await api.get('/reports/dashboard'); return r.data?.data || null },
  })

  const { data: activitiesData, isLoading: loadingActivities, error: activitiesError } = useQuery({
    queryKey: ['reports-activities', filters.startDate, filters.endDate, actPage],
    queryFn: async () => {
      const params = new URLSearchParams({ page: actPage, limit: 15 })
      if (filters.startDate) params.set('startDate', filters.startDate)
      if (filters.endDate) params.set('endDate', filters.endDate)
      const r = await api.get(`/reports/activities?${params}`)
      return { data: r.data?.data || [], total: r.data?.total || 0 }
    },
    enabled: activeTab === 'activity',
  })
  const activities = activitiesData?.data || []
  const actTotal = activitiesData?.total || 0

  const { data: attendanceReport = [], isLoading: loadingAttendance, error: attendanceError } = useQuery({
    queryKey: ['reports-attendance', filters.startDate, filters.endDate, filters.classId],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filters.startDate) params.set('startDate', filters.startDate)
      if (filters.endDate) params.set('endDate', filters.endDate)
      if (filters.classId) params.set('classId', filters.classId)
      const r = await api.get(`/attendance/report?${params}`)
      return Array.isArray(r.data?.data) ? r.data.data : []
    },
    enabled: activeTab === 'attendance',
  })

  const { data: promotionsReport = [], isLoading: loadingPromotions, error: promotionsError } = useQuery({
    queryKey: ['reports-promotions', filters.startDate, filters.endDate],
    queryFn: async () => {
      const params = {}
      if (filters.startDate) params.startDate = filters.startDate
      if (filters.endDate) params.endDate = filters.endDate
      const r = await studentsService.getPromotionsReport(params)
      return r.data || []
    },
    enabled: activeTab === 'promotions',
  })

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'enrollment', label: 'Enrollment', icon: TrendingUp },
    { id: 'attendance', label: 'Attendance', icon: Calendar },
    { id: 'activity', label: 'Activity Feed', icon: Activity },
    { id: 'promotions', label: 'Class Actions', icon: RefreshCw },
  ]

  const exportActivities = async () => {
    toast.loading('Fetching all activities...', { id: 'act-export' })
    try {
      const params = new URLSearchParams({ page: 1, limit: 5000 })
      if (filters.startDate) params.set('startDate', filters.startDate)
      if (filters.endDate) params.set('endDate', filters.endDate)
      const r = await api.get(`/reports/activities?${params}`)
      const allActivities = r.data?.data || []
      if (allActivities.length === 0) { toast.error('No activities to export', { id: 'act-export' }); return }
      const { headers, rows } = objsToAoa(allActivities.map(a => ({
        Type: a.type || '',
        Message: a.message || '',
        Date: fmtDate(a.date),
        Amount: a.amount != null ? fmtAmount(a.amount) : '',
        'Student Name': a.studentName || '',
        Action: a.action || '',
      })))
      exportReport(`activity_report_${todayStr}.xlsx`, {
        schoolName: settings?.institution?.name,
        reportTitle: 'Activity Report',

        headers, rows, sheetName: 'Activities',
        summary: [{ label: 'Total Activities', value: allActivities.length }],
      })
      toast.success(`Exported ${allActivities.length} activities`, { id: 'act-export' })
    } catch { toast.error('Export failed', { id: 'act-export' }) }
  }

  const exportAttendance = () => {
    if (!attendanceReport || attendanceReport.length === 0) { toast.error('No attendance data to export'); return }
    const mapped = attendanceReport.map(r => {
      const pct = parseFloat(r.percentage || r.attendancePercentage || 0)
      const totalDays = (r.presentDays ?? r.present ?? 0) + (r.absentDays ?? r.absent ?? 0) + (r.lateDays ?? r.late ?? 0)
      return {
        'Student Name': r.studentName || r.name || '',
        'Admission No': r.admissionNumber || r.admNo || '',
        Class: r.class || r.className || '',
        Section: r.section || r.sectionName || '',
        'Present Days': r.presentDays ?? r.present ?? 0,
        'Absent Days': r.absentDays ?? r.absent ?? 0,
        'Late Days': r.lateDays ?? r.late ?? 0,
        'Half Days': r.halfDays ?? r.halfDay ?? 0,
        Excused: r.excusedDays ?? r.excused ?? 0,
        'Total Working Days': totalDays,
        'Attendance %': pct.toFixed(1),
        Status: pct >= 75 ? 'Regular' : pct >= 50 ? 'Irregular' : 'Critical',
      }
    })
    const { headers, rows } = objsToAoa(mapped)
    const avgPct = mapped.length > 0 ? (mapped.reduce((s, r) => s + parseFloat(r['Attendance %']), 0) / mapped.length).toFixed(1) : '0.0'
    exportReport(`attendance_report_${filters.startDate}_to_${filters.endDate}.xlsx`, {
      schoolName: settings?.institution?.name,
      reportTitle: 'Attendance Report',
      dateRange: `${fmtDate(filters.startDate)} — ${fmtDate(filters.endDate)}`,
      headers, rows, sheetName: 'Attendance',
      summary: [
        { label: 'Total Students', value: mapped.length },
        { label: 'Average Attendance %', value: `${avgPct}%` },
      ],
    })
    toast.success('Attendance report exported')
  }

  const exportPromotions = async () => {
    toast.loading('Generating Promotion PDF...', { id: 'promo-export' })
    try {
      const headers = ["Admission No", "Student Name", "Date", "Action", "From", "To", "Academic Year", "Performed By"]
      const rows = promotionsReport.map(r => [r.studentId?.admissionNumber || 'N/A', r.studentId?.name || r.studentId?.fullName || 'N/A', fmtDate(r.createdAt), r.actionType, `${r.fromClass || ''} ${r.fromSection || ''}`.trim(), `${r.toClass || ''} ${r.toSection || ''}`.trim(), r.academicYear, r.performedBy?.name || r.performedBy?.fullName || 'System'])
      await exportPDF(`promotions_report_${todayStr}.pdf`, headers, rows, settings?.institution)
      toast.success('Report exported!', { id: 'promo-export' })
    } catch { toast.error('Export failed', { id: 'promo-export' }) }
  }

  const exportEnrollment = async () => {
    toast.loading('Fetching detailed enrollment data...', { id: 'enroll-export' })
    try {
      const r = await studentsService.list({ page: 1, limit: 500 })
      const students = r.data || []
      if (students.length === 0) { toast.error('No students found', { id: 'enroll-export' }); return }
      const sorted = [...students].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      const { headers, rows } = objsToAoa(sorted.map(s => ({
        'Admission No': s.admissionNumber || '',
        'Student Name': s.name || s.fullName || `${s.firstName || ''} ${s.lastName || ''}`.trim(),
        Class: s.class || s.className || '',
        Section: s.section || s.sectionName || '',
        'Roll No': s.rollNumber || '',
        'Date of Birth': fmtDate(s.dateOfBirth || s.dob),
        Gender: s.gender || '',
        'Guardian Name': s.fatherName || s.guardianName || s.parentName || '',
        'Guardian Phone': s.phone || s.guardianPhone || s.parentPhone || '',
        Email: s.email || '',
        'Enrollment Date': fmtDate(s.createdAt),
        Status: s.isActive ? 'Active' : 'Inactive',
      })))
      const activeCount = sorted.filter(s => s.isActive).length
      exportReport(`enrollment_report_${todayStr}.xlsx`, {
        schoolName: settings?.institution?.name,
        reportTitle: 'Student Enrollment Report',
        headers, rows, sheetName: 'Enrollment',
        summary: [
          { label: 'Total Students', value: sorted.length },
          { label: 'Active', value: activeCount },
          { label: 'Inactive', value: sorted.length - activeCount },
        ],
      })
      toast.success(`Exported ${sorted.length} student records`, { id: 'enroll-export' })
    } catch { toast.error('Export failed', { id: 'enroll-export' }) }
  }

  const exportOverview = () => {
    if (!dashboard) return
    exportReport(`school_overview_report_${todayStr}.xlsx`, {
      schoolName: settings?.institution?.name,
      reportTitle: 'School Overview Report',
      headers: ['Category', 'Metric', 'Value'],
      sheetName: 'Overview',
      rows: [
        ['Students', 'Total Students', dashboard.students?.total || 0],
        ['Students', 'Active Students', dashboard.students?.active || 0],
        ['Teachers', 'Total Teachers', dashboard.teachers?.total || 0],
        ['Teachers', 'Active Teachers', dashboard.teachers?.active || 0],
        ['Admissions', 'Total Admissions', dashboard.admissions?.total || 0],
        ['Admissions', 'Pending', dashboard.admissions?.pending || 0],
        ['Admissions', 'Approved', dashboard.admissions?.approved || 0],
        ['Admissions', 'This Month', dashboard.admissions?.thisMonth || 0],
        ['Fees', 'Total Fee Base', fmt(fees.total)],
        ['Fees', 'Collected', fmt(fees.paid)],
        ['Fees', 'Pending', fmt(fees.pending)],
        ['Fees', 'Overdue', fmt(fees.overdue)],
        ['Fees', 'Collected Today', fmt(fees.collectedToday)],
        ['Fees', 'Collection Rate', fees.total > 0 ? `${Math.round((fees.paid / fees.total) * 100)}%` : '0%'],
        ['Attendance', 'Students Present Today', dashboard.attendance?.studentsPresentToday || 0],
        ['Attendance', 'Staff Present Today', dashboard.attendance?.employeesPresentToday || 0],
      ],
    })
    toast.success('Overview report exported')
  }

  const refetchAttendance = () => queryClient.invalidateQueries({ queryKey: ['reports-attendance'] })
  const refetchActivities = () => { setActPage(1); queryClient.invalidateQueries({ queryKey: ['reports-activities'] }) }
  const refetchPromotions = () => queryClient.invalidateQueries({ queryKey: ['reports-promotions'] })

  const fees = dashboard?.fees || {}
  const enroll = { labels: [], data: [], ...(dashboard?.enrollmentTrend || {}) }
  const maxEnroll = enroll.data.length ? Math.max(...enroll.data, 1) : 1

  const dashboardErrorMsg = dashboardError?.response?.data?.message || (dashboardError ? 'Failed to load overview' : null)
  const activitiesErrorMsg = activitiesError?.response?.data?.message || (activitiesError ? 'Failed to load activities' : null)
  const attendanceErrorMsg = attendanceError?.response?.data?.message || (attendanceError ? 'No attendance data found' : null)
  const promotionsErrorMsg = promotionsError?.response?.data?.message || (promotionsError ? 'No promotion data found' : null)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Reports & Analytics</h1>
          <p className="text-sm text-gray-500 dark:text-[#8E8E93] mt-0.5">Live data from your school database</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <button onClick={() => refetchDashboard()} className="btn btn-ghost gap-2" disabled={loadingDashboard}>
            <RefreshCw className={`h-4 w-4 ${loadingDashboard ? 'animate-spin' : ''}`} /> Refresh
          </button>
          {activeTab === 'overview' && dashboard && <button onClick={exportOverview} className="btn btn-primary gap-2"><Download className="h-4 w-4" />Export Overview</button>}
          {activeTab === 'activity' && <button onClick={exportActivities} className="btn btn-primary gap-2"><Download className="h-4 w-4" />Export All Activities</button>}
          {activeTab === 'attendance' && attendanceReport.length > 0 && <button onClick={exportAttendance} className="btn btn-primary gap-2"><Download className="h-4 w-4" />Export Detailed</button>}
          {activeTab === 'promotions' && promotionsReport.length > 0 && <button onClick={exportPromotions} className="btn btn-primary gap-2"><Download className="h-4 w-4" />Export PDF</button>}
          {activeTab === 'enrollment' && <button onClick={exportEnrollment} className="btn btn-primary gap-2"><Download className="h-4 w-4" />Export Students</button>}
        </div>
      </div>

      {loadingDashboard ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (<div key={i} className="skeleton p-5 h-24" />))}
        </div>
      ) : dashboardErrorMsg ? (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4 text-red-700 dark:text-red-400">
          <div className="flex gap-3 items-center">
            <AlertCircle className="h-5 w-5 shrink-0" /><span className="text-sm">{dashboardErrorMsg}</span>
          </div>
          <button onClick={() => refetchDashboard()} className="mt-2 text-sm underline hover:text-red-800 dark:hover:text-red-300">Try again</button>
        </div>
      ) : dashboard && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Users} label="Total Students" value={fmtNum(dashboard.students?.total)} sub={`${dashboard.students?.active || 0} active`} color="bg-blue-500" />
          <StatCard icon={DollarSign} label="Fees Collected" value={fmt(fees.paid)} sub={`Today: ${fmt(fees.collectedToday)}`} color="bg-green-500" />
          <StatCard icon={Calendar} label="Students Present Today" value={fmtNum(dashboard.attendance?.studentsPresentToday)} sub={`Staff: ${dashboard.attendance?.employeesPresentToday || 0}`} color="bg-teal-500" />
          <StatCard icon={TrendingUp} label="New This Month" value={fmtNum(dashboard.admissions?.thisMonth)} sub="student admissions" color="bg-purple-500" />
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="border-b border-gray-100 dark:border-[#2C2C2E] px-4">
          <nav className="flex gap-1 overflow-x-auto overflow-y-hidden">
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${activeTab === tab.id ? 'border-teal-500 text-teal-600 dark:text-teal-400' : 'border-transparent text-gray-500 dark:text-[#8E8E93] hover:text-gray-700 dark:hover:text-white'}`}>
                <tab.icon className="h-4 w-4" />{tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-4 sm:p-6">
          {activeTab === 'overview' && dashboard && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-[#8E8E93] mb-4">Fee Summary</h3>
                <div className="space-y-3">
                  <MiniBar label="Collected" value={fees.paid} max={fees.total} color="bg-green-500" />
                  <MiniBar label="Pending" value={fees.pending} max={fees.total} color="bg-yellow-400" />
                  <MiniBar label="Overdue" value={fees.overdue} max={fees.total} color="bg-red-500" />
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3 text-center">
                  {[{ label: 'Collected', val: fmt(fees.paid), color: 'text-green-600 dark:text-green-400' }, { label: 'Pending', val: fmt(fees.pending), color: 'text-yellow-600 dark:text-yellow-400' }, { label: 'Overdue', val: fmt(fees.overdue), color: 'text-red-600 dark:text-red-400' }].map(s => (
                    <div key={s.label} className="bg-gray-50 dark:bg-[#2C2C2E] rounded-lg p-2 sm:p-3 min-w-0 overflow-hidden">
                      <p className={`text-xs sm:text-sm font-bold ${s.color} truncate`}>{s.val}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-[#8E8E93] mb-4">School Overview</h3>
                <div className="space-y-3">
                  {[{ label: 'Active Students', value: dashboard.students?.active || 0, total: dashboard.students?.total || 1, color: 'bg-blue-500' }, { label: 'Active Teachers', value: dashboard.teachers?.active || 0, total: dashboard.teachers?.total || 1, color: 'bg-purple-500' }, { label: 'Approved Admissions', value: dashboard.admissions?.approved || 0, total: (dashboard.admissions?.total || 1), color: 'bg-teal-500' }].map(r => (
                    <MiniBar key={r.label} label={r.label} value={r.value} max={r.total} color={r.color} />
                  ))}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
                    <p className="text-xl font-bold text-blue-700 dark:text-blue-400">{fmtNum(dashboard.students?.total)}</p>
                    <p className="text-xs text-blue-500 mt-0.5">Total Students</p>
                  </div>
                  <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 text-center">
                    <p className="text-xl font-bold text-purple-700 dark:text-purple-400">{fmtNum(dashboard.teachers?.total)}</p>
                    <p className="text-xs text-purple-500 mt-0.5">Total Staff</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'enrollment' && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-[#8E8E93] mb-6">Student Enrollments &mdash; Last 6 Months</h3>
              {loadingDashboard ? (
                <div className="h-48 flex items-center justify-center text-gray-400"><RefreshCw className="h-6 w-6 animate-spin" /></div>
              ) : enroll.labels.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-10">No enrollment data available</p>
              ) : (
                <div className="space-y-3">
                  {enroll.labels.map((month, i) => (
                    <div key={month} className="flex items-center gap-3">
                      <span className="text-xs font-medium text-gray-500 dark:text-[#8E8E93] w-10 text-right">{month}</span>
                      <div className="flex-1 bg-gray-100 dark:bg-[#2C2C2E] rounded-full h-7 relative">
                        <div className="h-7 rounded-full bg-gradient-to-r from-teal-400 to-teal-600 transition-all duration-700 flex items-center justify-end pr-3" style={{ width: `${Math.max(8, (enroll.data[i] / maxEnroll) * 100)}%` }}>
                          <span className="text-xs font-bold text-white">{enroll.data[i]}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-gray-400 mt-6">* Shows students added to the system per month</p>
            </div>
          )}


          {activeTab === 'attendance' && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-3 pb-4 border-b border-gray-100 dark:border-[#38383A]">
                <div><label className="text-xs text-gray-500 dark:text-[#8E8E93] block mb-1">From</label><input type="date" value={filters.startDate} onChange={e => setFilters(f => ({ ...f, startDate: e.target.value }))} className="input text-sm h-9" /></div>
                <div><label className="text-xs text-gray-500 dark:text-[#8E8E93] block mb-1">To</label><input type="date" value={filters.endDate} onChange={e => setFilters(f => ({ ...f, endDate: e.target.value }))} className="input text-sm h-9" /></div>
                <div><label className="text-xs text-gray-500 dark:text-[#8E8E93] block mb-1">Class</label><select value={filters.classId} onChange={e => setFilters(f => ({ ...f, classId: e.target.value }))} className="input text-sm h-9"><option value="">All Classes</option>{classes.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}</select></div>
                <div className="flex items-end"><button onClick={refetchAttendance} className="btn btn-primary h-9 text-sm">Apply</button></div>
              </div>
              {loadingAttendance ? (
                <div className="py-16 flex justify-center"><RefreshCw className="h-6 w-6 animate-spin text-teal-500" /></div>
              ) : attendanceErrorMsg ? (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-800 rounded-2xl p-4 text-sm text-yellow-700 dark:text-yellow-400 flex gap-2 items-center"><AlertCircle className="h-4 w-4 shrink-0" />{attendanceErrorMsg}</div>
              ) : attendanceReport.length === 0 ? (
                <div className="py-16 text-center text-gray-400 text-sm"><Calendar className="h-10 w-10 mx-auto mb-3 opacity-40" />No attendance records found for the selected period.</div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-gray-100 dark:border-[#38383A] shadow-glass">
                  <table className="table">
                    <thead>
                      <tr>{['Student', 'Class', 'Present', 'Absent', 'Late', 'Attendance %'].map(h => (<th key={h}>{h}</th>))}</tr>
                    </thead>
                    <tbody>
                      {attendanceReport.map((row, i) => {
                        const pct = parseFloat(row.percentage || row.attendancePercentage || 0)
                        return (
                          <tr key={i} className="hover:bg-gray-50 dark:hover:bg-[#2C2C2E] transition-colors">
                            <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{row.studentName || row.name || '\u2014'}</td>
                            <td className="px-4 py-3 text-gray-500 dark:text-[#8E8E93]">{row.class || row.className || '\u2014'}</td>
                            <td className="px-4 py-3 text-green-600 font-medium">{row.presentDays ?? row.present ?? '\u2014'}</td>
                            <td className="px-4 py-3 text-red-500">{row.absentDays ?? row.absent ?? '\u2014'}</td>
                            <td className="px-4 py-3 text-yellow-600">{row.lateDays ?? row.late ?? '\u2014'}</td>
                            <td className="px-4 py-3"><span className={`font-semibold ${pct >= 75 ? 'text-green-600' : pct >= 50 ? 'text-yellow-600' : 'text-red-500'}`}>{pct.toFixed(1)}%</span></td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'activity' && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-3 pb-4 border-b border-gray-100 dark:border-[#38383A]">
                <div><label className="text-xs text-gray-500 dark:text-[#8E8E93] block mb-1">From</label><input type="date" value={filters.startDate} onChange={e => setFilters(f => ({ ...f, startDate: e.target.value }))} className="input text-sm h-9" /></div>
                <div><label className="text-xs text-gray-500 dark:text-[#8E8E93] block mb-1">To</label><input type="date" value={filters.endDate} onChange={e => setFilters(f => ({ ...f, endDate: e.target.value }))} className="input text-sm h-9" /></div>
                <div className="flex items-end"><button onClick={refetchActivities} className="btn btn-primary h-9 text-sm">Apply</button></div>
              </div>
              {loadingActivities ? (
                <div className="py-16 flex justify-center"><RefreshCw className="h-6 w-6 animate-spin text-teal-500" /></div>
              ) : activitiesErrorMsg ? (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-2xl p-4 text-sm text-red-700 dark:text-red-400 flex gap-2 items-center"><AlertCircle className="h-4 w-4 shrink-0" />{activitiesErrorMsg}</div>
              ) : activities.length === 0 ? (
                <div className="py-16 text-center text-gray-400 text-sm"><Activity className="h-10 w-10 mx-auto mb-3 opacity-40" />No activity records found for the selected period.</div>
              ) : (
                <>
                  <div className="space-y-2">
                    {activities.map((act, i) => (
                      <div key={act.id || i} className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-[#2C2C2E] transition-colors">
                        <ActivityIcon type={act.type} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-800 dark:text-white font-medium truncate">{act.message}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{fmtDate(act.date)}</p>
                        </div>
                        {act.amount && (<span className="text-sm font-semibold text-green-600 shrink-0">{fmt(act.amount)}</span>)}
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-[#38383A]">
                    <span className="text-xs text-gray-400">{actTotal} total records</span>
                    <div className="flex gap-2">
                      <button onClick={() => setActPage(p => Math.max(1, p - 1))} disabled={actPage <= 1 || loadingActivities} className="btn btn-ghost btn-sm h-8 w-8 p-0"><ChevronLeft className="h-4 w-4" /></button>
                      <span className="text-xs self-center text-gray-500">Page {actPage}</span>
                      <button onClick={() => setActPage(p => p + 1)} disabled={activities.length < 15 || loadingActivities} className="btn btn-ghost btn-sm h-8 w-8 p-0"><ChevronRight className="h-4 w-4" /></button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'promotions' && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-3 pb-4 border-b border-gray-100 dark:border-[#38383A]">
                <div><label className="text-xs text-gray-500 dark:text-[#8E8E93] block mb-1">From</label><input type="date" value={filters.startDate} onChange={e => setFilters(f => ({ ...f, startDate: e.target.value }))} className="input text-sm h-9" /></div>
                <div><label className="text-xs text-gray-500 dark:text-[#8E8E93] block mb-1">To</label><input type="date" value={filters.endDate} onChange={e => setFilters(f => ({ ...f, endDate: e.target.value }))} className="input text-sm h-9" /></div>
                <div className="flex items-end"><button onClick={refetchPromotions} className="btn btn-primary h-9 text-sm">Apply</button></div>
              </div>
              {loadingPromotions ? (
                <div className="py-16 flex justify-center"><RefreshCw className="h-6 w-6 animate-spin text-teal-500" /></div>
              ) : promotionsErrorMsg ? (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-800 rounded-2xl p-4 text-sm text-yellow-700 dark:text-yellow-400 flex gap-2 items-center"><AlertCircle className="h-4 w-4 shrink-0" />{promotionsErrorMsg}</div>
              ) : promotionsReport.length === 0 ? (
                <div className="py-16 text-center text-gray-400 text-sm"><RefreshCw className="h-10 w-10 mx-auto mb-3 opacity-40" />No class action records found for the selected period.</div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-gray-100 dark:border-[#38383A] shadow-glass">
                  <table className="table">
                    <thead>
                      <tr>{['Date', 'Student', 'Action', 'From Class', 'To Class', 'A.Y', 'Performed By'].map(h => (<th key={h}>{h}</th>))}</tr>
                    </thead>
                    <tbody>
                      {promotionsReport.map((row, i) => (
                        <tr key={row._id} className="hover:bg-gray-50 dark:hover:bg-[#2C2C2E] transition-colors">
                          <td className="px-4 py-3 text-gray-500 dark:text-[#8E8E93] whitespace-nowrap">{fmtDate(row.createdAt)}</td>
                          <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{row.studentId?.name || row.studentId?.fullName || '\u2014'}<span className="block text-xs text-gray-400 font-normal">{row.studentId?.admissionNumber}</span></td>
                          <td className="px-4 py-3"><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full capitalize ${row.actionType === 'promoted' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400'}`}>{row.actionType}</span></td>
                          <td className="px-4 py-3 text-gray-500 dark:text-[#8E8E93]">{row.fromClass} {row.fromSection && `(${row.fromSection})`}</td>
                          <td className="px-4 py-3 text-gray-900 dark:text-white font-medium">{row.toClass} {row.toSection && `(${row.toSection})`}</td>
                          <td className="px-4 py-3 text-gray-500 dark:text-[#8E8E93]">{row.academicYear}</td>
                          <td className="px-4 py-3 text-gray-500 dark:text-[#8E8E93] text-xs">{row.performedBy?.name || row.performedBy?.fullName || 'System'}</td>
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
    </div>
  )
}

export default Reports
