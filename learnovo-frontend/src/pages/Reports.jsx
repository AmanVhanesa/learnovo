import React, { useState, useEffect, useCallback } from 'react'
import {
  Download, BarChart3, TrendingUp, Calendar, Users,
  DollarSign, Activity, RefreshCw, AlertCircle, CheckCircle,
  Clock, FileText, UserPlus, ChevronLeft, ChevronRight
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import api from '../services/authService'

// ─── helpers ──────────────────────────────────────────────────────────────────
const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0)
const fmtNum = (n) => new Intl.NumberFormat('en-IN').format(n || 0)
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

// ─── CSV export ───────────────────────────────────────────────────────────────
function exportCSV(rows, filename) {
  if (!rows || rows.length === 0) return
  const headers = Object.keys(rows[0])
  const csv = [headers.join(','), ...rows.map(r => headers.map(h => `"${r[h] ?? ''}"`).join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ─── Sub-components ───────────────────────────────────────────────────────────
const StatCard = ({ icon: Icon, label, value, sub, color }) => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-start gap-4">
    <div className={`p-3 rounded-xl ${color}`}>
      <Icon className="h-5 w-5 text-white" />
    </div>
    <div className="min-w-0">
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-0.5 truncate">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  </div>
)

const MiniBar = ({ label, value, max, color }) => (
  <div className="flex items-center gap-3">
    <span className="text-xs text-gray-500 w-24 shrink-0 truncate">{label}</span>
    <div className="flex-1 bg-gray-100 rounded-full h-2">
      <div
        className={`h-2 rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${max > 0 ? Math.min(100, (value / max) * 100) : 0}%` }}
      />
    </div>
    <span className="text-xs font-semibold text-gray-700 w-10 text-right">{fmtNum(value)}</span>
  </div>
)

const ActivityIcon = ({ type }) => {
  const map = {
    fee: { icon: DollarSign, bg: 'bg-green-100', color: 'text-green-600' },
    admission: { icon: UserPlus, bg: 'bg-blue-100', color: 'text-blue-600' },
    employee: { icon: Users, bg: 'bg-purple-100', color: 'text-purple-600' },
    certificate: { icon: FileText, bg: 'bg-yellow-100', color: 'text-yellow-600' },
  }
  const cfg = map[type] || { icon: Activity, bg: 'bg-gray-100', color: 'text-gray-600' }
  return (
    <div className={`p-2 rounded-full ${cfg.bg} shrink-0`}>
      <cfg.icon className={`h-4 w-4 ${cfg.color}`} />
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────
const Reports = () => {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  const [activeTab, setActiveTab] = useState('overview')
  const [dashboard, setDashboard] = useState(null)
  const [activities, setActivities] = useState([])
  const [attendanceReport, setAttendanceReport] = useState([])
  const [classes, setClasses] = useState([])

  const [loading, setLoading] = useState({ dashboard: true, activities: false, attendance: false })
  const [error, setError] = useState({})
  const [actPage, setActPage] = useState(1)
  const [actTotal, setActTotal] = useState(0)

  const today = new Date()
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10)
  const todayStr = today.toISOString().slice(0, 10)

  const [filters, setFilters] = useState({ startDate: firstOfMonth, endDate: todayStr, classId: '' })

  // ── fetch classes (for filter dropdown) ─────────────────────────────────────
  useEffect(() => {
    api.get('/classes').then(r => setClasses(r.data?.data || [])).catch(() => { })
  }, [])

  // ── fetch dashboard ──────────────────────────────────────────────────────────
  const fetchDashboard = useCallback(async () => {
    setLoading(l => ({ ...l, dashboard: true }))
    setError(e => ({ ...e, dashboard: null }))
    try {
      const r = await api.get('/reports/dashboard')
      setDashboard(r.data?.data || null)
    } catch (err) {
      setError(e => ({ ...e, dashboard: err.response?.data?.message || 'Failed to load overview' }))
    } finally {
      setLoading(l => ({ ...l, dashboard: false }))
    }
  }, [])

  // ── fetch activities ─────────────────────────────────────────────────────────
  const fetchActivities = useCallback(async (page = 1) => {
    setLoading(l => ({ ...l, activities: true }))
    setError(e => ({ ...e, activities: null }))
    try {
      const params = new URLSearchParams({ page, limit: 15 })
      if (filters.startDate) params.set('startDate', filters.startDate)
      if (filters.endDate) params.set('endDate', filters.endDate)
      const r = await api.get(`/reports/activities?${params}`)
      setActivities(r.data?.data || [])
      setActTotal(r.data?.total || 0)
      setActPage(page)
    } catch (err) {
      setError(e => ({ ...e, activities: err.response?.data?.message || 'Failed to load activities' }))
    } finally {
      setLoading(l => ({ ...l, activities: false }))
    }
  }, [filters])

  // ── fetch attendance report ──────────────────────────────────────────────────
  const fetchAttendance = useCallback(async () => {
    setLoading(l => ({ ...l, attendance: true }))
    setError(e => ({ ...e, attendance: null }))
    try {
      const params = new URLSearchParams()
      if (filters.startDate) params.set('startDate', filters.startDate)
      if (filters.endDate) params.set('endDate', filters.endDate)
      if (filters.classId) params.set('classId', filters.classId)
      const r = await api.get(`/attendance/report?${params}`)
      setAttendanceReport(Array.isArray(r.data?.data) ? r.data.data : [])
    } catch (err) {
      setError(e => ({ ...e, attendance: err.response?.data?.message || 'No attendance data found' }))
      setAttendanceReport([])
    } finally {
      setLoading(l => ({ ...l, attendance: false }))
    }
  }, [filters])

  // ── initial load ─────────────────────────────────────────────────────────────
  useEffect(() => { fetchDashboard() }, [fetchDashboard])
  useEffect(() => {
    if (activeTab === 'activity') fetchActivities(1)
    if (activeTab === 'attendance') fetchAttendance()
  }, [activeTab, fetchActivities, fetchAttendance])

  // ── tabs ─────────────────────────────────────────────────────────────────────
  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'enrollment', label: 'Enrollment', icon: TrendingUp },
    { id: 'fees', label: 'Fee Collection', icon: DollarSign },
    { id: 'attendance', label: 'Attendance', icon: Calendar },
    { id: 'activity', label: 'Activity Feed', icon: Activity },
  ]

  // ── export helpers ────────────────────────────────────────────────────────────
  const exportActivities = () => exportCSV(
    activities.map(a => ({ Type: a.type, Message: a.message, Date: fmtDate(a.date), Amount: a.amount || '' })),
    'activity-report.csv'
  )
  const exportAttendance = () => exportCSV(
    attendanceReport.map(r => ({ Student: r.studentName || r.name, Class: r.class, Present: r.presentDays, Absent: r.absentDays, Percentage: r.percentage })),
    'attendance-report.csv'
  )
  const exportEnrollment = () => {
    if (!dashboard?.enrollmentTrend) return
    const rows = dashboard.enrollmentTrend.labels.map((m, i) => ({ Month: m, Enrollments: dashboard.enrollmentTrend.data[i] }))
    exportCSV(rows, 'enrollment-trend.csv')
  }
  const exportFees = () => {
    if (!dashboard?.fees) return
    exportCSV([{
      Collected: dashboard.fees.paid,
      Pending: dashboard.fees.pending,
      Overdue: dashboard.fees.overdue,
      Total: dashboard.fees.total,
      CollectedToday: dashboard.fees.collectedToday
    }], 'fee-report.csv')
  }

  // ── render ────────────────────────────────────────────────────────────────────
  const fees = dashboard?.fees || {}
  const enroll = dashboard?.enrollmentTrend || { labels: [], data: [] }
  const maxEnroll = enroll.data.length ? Math.max(...enroll.data, 1) : 1

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="text-sm text-gray-500 mt-0.5">Live data from your school database</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchDashboard}
            className="btn btn-ghost gap-2"
            disabled={loading.dashboard}
          >
            <RefreshCw className={`h-4 w-4 ${loading.dashboard ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          {activeTab === 'activity' && <button onClick={exportActivities} className="btn btn-primary gap-2"><Download className="h-4 w-4" />Export</button>}
          {activeTab === 'attendance' && <button onClick={exportAttendance} className="btn btn-primary gap-2"><Download className="h-4 w-4" />Export</button>}
          {activeTab === 'enrollment' && <button onClick={exportEnrollment} className="btn btn-primary gap-2"><Download className="h-4 w-4" />Export</button>}
          {activeTab === 'fees' && <button onClick={exportFees} className="btn btn-primary gap-2"><Download className="h-4 w-4" />Export</button>}
        </div>
      </div>

      {/* Summary Cards */}
      {loading.dashboard ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 h-24 animate-pulse bg-gray-50" />
          ))}
        </div>
      ) : error.dashboard ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3 items-center text-red-700">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span className="text-sm">{error.dashboard}</span>
        </div>
      ) : dashboard && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Users} label="Total Students" value={fmtNum(dashboard.students?.total)} sub={`${dashboard.students?.active || 0} active`} color="bg-blue-500" />
          <StatCard icon={DollarSign} label="Fees Collected" value={fmt(fees.paid)} sub={`Today: ${fmt(fees.collectedToday)}`} color="bg-green-500" />
          <StatCard icon={Calendar} label="Students Present Today" value={fmtNum(dashboard.attendance?.studentsPresentToday)} sub={`Staff: ${dashboard.attendance?.employeesPresentToday || 0}`} color="bg-teal-500" />
          <StatCard icon={TrendingUp} label="New This Month" value={fmtNum(dashboard.admissions?.thisMonth)} sub="student admissions" color="bg-purple-500" />
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="border-b border-gray-100 px-4">
          <nav className="flex gap-1 overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${activeTab === tab.id
                  ? 'border-teal-500 text-teal-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* ── OVERVIEW ── */}
          {activeTab === 'overview' && dashboard && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Fee breakdown */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Fee Summary</h3>
                <div className="space-y-3">
                  <MiniBar label="Collected" value={fees.paid} max={fees.total} color="bg-green-500" />
                  <MiniBar label="Pending" value={fees.pending} max={fees.total} color="bg-yellow-400" />
                  <MiniBar label="Overdue" value={fees.overdue} max={fees.total} color="bg-red-500" />
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                  {[
                    { label: 'Collected', val: fmt(fees.paid), color: 'text-green-600' },
                    { label: 'Pending', val: fmt(fees.pending), color: 'text-yellow-600' },
                    { label: 'Overdue', val: fmt(fees.overdue), color: 'text-red-600' },
                  ].map(s => (
                    <div key={s.label} className="bg-gray-50 rounded-lg p-3">
                      <p className={`text-sm font-bold ${s.color}`}>{s.val}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Staff & student counts */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-4">School Overview</h3>
                <div className="space-y-3">
                  {[
                    { label: 'Active Students', value: dashboard.students?.active || 0, total: dashboard.students?.total || 1, color: 'bg-blue-500' },
                    { label: 'Active Teachers', value: dashboard.teachers?.active || 0, total: dashboard.teachers?.total || 1, color: 'bg-purple-500' },
                    { label: 'Approved Admissions', value: dashboard.admissions?.approved || 0, total: (dashboard.admissions?.total || 1), color: 'bg-teal-500' },
                  ].map(r => (
                    <MiniBar key={r.label} label={r.label} value={r.value} max={r.total} color={r.color} />
                  ))}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="bg-blue-50 rounded-lg p-3 text-center">
                    <p className="text-xl font-bold text-blue-700">{fmtNum(dashboard.students?.total)}</p>
                    <p className="text-xs text-blue-500 mt-0.5">Total Students</p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-3 text-center">
                    <p className="text-xl font-bold text-purple-700">{fmtNum(dashboard.teachers?.total)}</p>
                    <p className="text-xs text-purple-500 mt-0.5">Total Staff</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── ENROLLMENT ── */}
          {activeTab === 'enrollment' && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-6">Student Enrollments — Last 6 Months</h3>
              {loading.dashboard ? (
                <div className="h-48 flex items-center justify-center text-gray-400">
                  <RefreshCw className="h-6 w-6 animate-spin" />
                </div>
              ) : enroll.labels.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-10">No enrollment data available</p>
              ) : (
                <div className="space-y-3">
                  {enroll.labels.map((month, i) => (
                    <div key={month} className="flex items-center gap-3">
                      <span className="text-xs font-medium text-gray-500 w-10 text-right">{month}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-7 relative">
                        <div
                          className="h-7 rounded-full bg-gradient-to-r from-teal-400 to-teal-600 transition-all duration-700 flex items-center justify-end pr-3"
                          style={{ width: `${Math.max(8, (enroll.data[i] / maxEnroll) * 100)}%` }}
                        >
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

          {/* ── FEE COLLECTION ── */}
          {activeTab === 'fees' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Total Fee Base', val: fmt(fees.total), icon: DollarSign, color: 'bg-gray-100 text-gray-700' },
                  { label: 'Collected', val: fmt(fees.paid), icon: CheckCircle, color: 'bg-green-50 text-green-700' },
                  { label: 'Pending', val: fmt(fees.pending), icon: Clock, color: 'bg-yellow-50 text-yellow-700' },
                  { label: 'Overdue', val: fmt(fees.overdue), icon: AlertCircle, color: 'bg-red-50 text-red-700' },
                ].map(s => (
                  <div key={s.label} className={`rounded-xl p-4 ${s.color.split(' ')[0]}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <s.icon className={`h-4 w-4 ${s.color.split(' ')[1]}`} />
                      <span className="text-xs font-medium text-gray-500">{s.label}</span>
                    </div>
                    <p className={`text-xl font-bold ${s.color.split(' ')[1]}`}>{s.val}</p>
                  </div>
                ))}
              </div>
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Collection Rate</h4>
                <div className="bg-gray-100 rounded-full h-4 relative overflow-hidden">
                  <div
                    className="h-4 rounded-full bg-gradient-to-r from-teal-400 to-teal-600 flex items-center justify-center transition-all duration-700"
                    style={{ width: `${fees.total > 0 ? Math.round((fees.paid / fees.total) * 100) : 0}%` }}
                  >
                    <span className="text-[10px] font-bold text-white">
                      {fees.total > 0 ? `${Math.round((fees.paid / fees.total) * 100)}%` : ''}
                    </span>
                  </div>
                </div>
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>0%</span>
                  <span className="font-medium text-teal-600">
                    {fees.total > 0 ? `${Math.round((fees.paid / fees.total) * 100)}% collected` : 'No data'}
                  </span>
                  <span>100%</span>
                </div>
              </div>
              {fees.collectedToday > 0 && (
                <div className="flex items-center gap-2 bg-green-50 border border-green-100 rounded-xl p-3 text-sm text-green-700">
                  <CheckCircle className="h-4 w-4 shrink-0" />
                  <span><strong>{fmt(fees.collectedToday)}</strong> collected today</span>
                </div>
              )}
            </div>
          )}

          {/* ── ATTENDANCE ── */}
          {activeTab === 'attendance' && (
            <div className="space-y-4">
              {/* Filters */}
              <div className="flex flex-wrap gap-3 pb-4 border-b border-gray-100">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">From</label>
                  <input type="date" value={filters.startDate} onChange={e => setFilters(f => ({ ...f, startDate: e.target.value }))} className="input text-sm h-9" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">To</label>
                  <input type="date" value={filters.endDate} onChange={e => setFilters(f => ({ ...f, endDate: e.target.value }))} className="input text-sm h-9" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Class</label>
                  <select value={filters.classId} onChange={e => setFilters(f => ({ ...f, classId: e.target.value }))} className="input text-sm h-9">
                    <option value="">All Classes</option>
                    {classes.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="flex items-end">
                  <button onClick={fetchAttendance} className="btn btn-primary h-9 text-sm">Apply</button>
                </div>
              </div>

              {loading.attendance ? (
                <div className="py-16 flex justify-center"><RefreshCw className="h-6 w-6 animate-spin text-teal-500" /></div>
              ) : error.attendance ? (
                <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4 text-sm text-yellow-700 flex gap-2 items-center">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error.attendance}
                </div>
              ) : attendanceReport.length === 0 ? (
                <div className="py-16 text-center text-gray-400 text-sm">
                  <Calendar className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  No attendance records found for the selected period.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-100">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                      <tr>
                        {['Student', 'Class', 'Present', 'Absent', 'Late', 'Attendance %'].map(h => (
                          <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {attendanceReport.map((row, i) => {
                        const pct = parseFloat(row.percentage || row.attendancePercentage || 0)
                        return (
                          <tr key={i} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 font-medium text-gray-900">{row.studentName || row.name || '—'}</td>
                            <td className="px-4 py-3 text-gray-500">{row.class || row.className || '—'}</td>
                            <td className="px-4 py-3 text-green-600 font-medium">{row.presentDays ?? row.present ?? '—'}</td>
                            <td className="px-4 py-3 text-red-500">{row.absentDays ?? row.absent ?? '—'}</td>
                            <td className="px-4 py-3 text-yellow-600">{row.lateDays ?? row.late ?? '—'}</td>
                            <td className="px-4 py-3">
                              <span className={`font-semibold ${pct >= 75 ? 'text-green-600' : pct >= 50 ? 'text-yellow-600' : 'text-red-500'}`}>
                                {pct.toFixed(1)}%
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── ACTIVITY FEED ── */}
          {activeTab === 'activity' && (
            <div className="space-y-4">
              {/* Filters */}
              <div className="flex flex-wrap gap-3 pb-4 border-b border-gray-100">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">From</label>
                  <input type="date" value={filters.startDate} onChange={e => setFilters(f => ({ ...f, startDate: e.target.value }))} className="input text-sm h-9" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">To</label>
                  <input type="date" value={filters.endDate} onChange={e => setFilters(f => ({ ...f, endDate: e.target.value }))} className="input text-sm h-9" />
                </div>
                <div className="flex items-end">
                  <button onClick={() => fetchActivities(1)} className="btn btn-primary h-9 text-sm">Apply</button>
                </div>
              </div>

              {loading.activities ? (
                <div className="py-16 flex justify-center"><RefreshCw className="h-6 w-6 animate-spin text-teal-500" /></div>
              ) : error.activities ? (
                <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-sm text-red-700 flex gap-2 items-center">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error.activities}
                </div>
              ) : activities.length === 0 ? (
                <div className="py-16 text-center text-gray-400 text-sm">
                  <Activity className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  No activity records found for the selected period.
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    {activities.map((act, i) => (
                      <div key={act.id || i} className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                        <ActivityIcon type={act.type} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-800 font-medium truncate">{act.message}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{fmtDate(act.date)}</p>
                        </div>
                        {act.amount && (
                          <span className="text-sm font-semibold text-green-600 shrink-0">{fmt(act.amount)}</span>
                        )}
                      </div>
                    ))}
                  </div>
                  {/* Pagination */}
                  <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                    <span className="text-xs text-gray-400">{actTotal} total records</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => fetchActivities(actPage - 1)}
                        disabled={actPage <= 1 || loading.activities}
                        className="btn btn-ghost btn-sm h-8 w-8 p-0"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <span className="text-xs self-center text-gray-500">Page {actPage}</span>
                      <button
                        onClick={() => fetchActivities(actPage + 1)}
                        disabled={activities.length < 15 || loading.activities}
                        className="btn btn-ghost btn-sm h-8 w-8 p-0"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Reports
