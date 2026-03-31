import React, { useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import { useSettings } from '../contexts/SettingsContext'
import { formatDate } from '../utils/formatDate'
import {
  Users,
  GraduationCap,
  CreditCard,
  AlertTriangle,
  TrendingUp,
  Calendar,
  BookOpen,
  Bell,
  UserPlus,
  ClipboardList,
  School
} from 'lucide-react'
import { Line, Doughnut } from 'react-chartjs-2'
import KpiCard from '../components/KpiCard'
import ChartCard from '../components/ChartCard'
import SummaryCard from '../components/SummaryCard'
import Button from '../components/Button'
import { CardSkeleton, ChartSkeleton } from '../components/LoadingSkeleton'
import { exportCSV, exportPNGPlaceholder } from '../utils/exportHelpers'
import { reportsService } from '../services/reportsService'
import { backupService } from '../services/backupService'
import RecentActivities from '../components/RecentActivities'
import StudentActivityFeed from '../components/StudentActivityFeed'
import toast from 'react-hot-toast'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Filler,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Filler,
  Title,
  Tooltip,
  Legend
)

const EnrollmentTrendChart = ({ range }) => {
  const { data: trendData, isLoading: trendLoading } = useQuery({
    queryKey: ['enrollment-trend', range],
    queryFn: async () => {
      const res = await reportsService.getEnrollmentTrend(range)
      return res.success ? res.data : { labels: [], data: [] }
    },
    staleTime: 60 * 1000,
  })

  const chartData = {
    labels: trendData?.labels?.length > 0 ? trendData.labels : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    datasets: [
      {
        label: 'Students Enrolled',
        data: trendData?.data?.length > 0 ? trendData.data : [0, 0, 0, 0, 0, 0],
        borderColor: 'rgb(62, 196, 177)',
        backgroundColor: 'rgba(62, 196, 177, 0.1)',
        tension: 0.4
      }
    ]
  }

  if (trendLoading) {
    return <div className="flex items-center justify-center h-full text-gray-400 text-sm">Loading...</div>
  }

  return <Line data={chartData} options={{ responsive: true, maintainAspectRatio: false }} />
}

const Dashboard = () => {
  const { user, tenant } = useAuth()
  const { formatCurrency } = useSettings()
  const navigate = useNavigate()

  const defaultStats = {
    students: { total: 0, active: 0 },
    teachers: { total: 0, active: 0 },
    admissions: { total: 0, pending: 0, approved: 0, rejected: 0 },
    fees: { total: 0, paid: 0, pending: 0, overdue: 0 },
    teacher: { myStudents: 0, attendanceToday: 0, activeAssignments: 0, pendingSubmissions: 0 },
    student: { profileComplete: 'Incomplete', pendingFees: 0, assignments: 0, notifications: 0 },
    parent: { myChildren: 0, pendingFees: 0, notifications: 0, performance: 'Good' },
    enrollmentTrend: { labels: [], data: [] },
    recentActivities: []
  }

  const { data: stats = defaultStats, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const [res, activitiesRes] = await Promise.allSettled([
        reportsService.getDashboardStats(),
        reportsService.getRecentActivities()
      ])
      const dashData = res.status === 'fulfilled' ? res.value : null
      const actData = activitiesRes.status === 'fulfilled' ? activitiesRes.value : null
      if (dashData?.success && dashData?.data) {
        const d = dashData.data
        return {
          ...defaultStats,
          ...d,
          students: { ...defaultStats.students, ...d.students },
          teachers: { ...defaultStats.teachers, ...d.teachers },
          admissions: { ...defaultStats.admissions, ...d.admissions },
          fees: { ...defaultStats.fees, ...d.fees },
          teacher: { ...defaultStats.teacher, ...d.teacher },
          student: { ...defaultStats.student, ...d.student },
          parent: { ...defaultStats.parent, ...d.parent },
          enrollmentTrend: { ...defaultStats.enrollmentTrend, ...d.enrollmentTrend },
          recentActivities: actData?.success ? (actData.data || []) : []
        }
      }
      // If the dashboard stats request itself failed, re-throw so React Query shows the error
      if (res.status === 'rejected') throw res.reason
      return defaultStats
    },
    refetchInterval: 60 * 1000,
    refetchOnWindowFocus: true,
  })

  // Refetch on tab visibility change (Page Visibility API)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refetch()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [refetch])

  // Backup reminder — only for admins
  const { data: lastBackup } = useQuery({
    queryKey: ['last-backup'],
    queryFn: async () => {
      const res = await backupService.getLastBackup()
      return res.success ? res.data : null
    },
    enabled: user?.role === 'admin',
    staleTime: 5 * 60 * 1000,
  })

  const daysSinceBackup = lastBackup?.createdAt
    ? Math.floor((Date.now() - new Date(lastBackup.createdAt).getTime()) / (1000 * 60 * 60 * 24))
    : null
  const showBackupReminder = user?.role === 'admin' && (daysSinceBackup === null || daysSinceBackup >= 7)

  // Export chart as PNG
  const exportChartAsPNG = (title, chartData) => {
    exportPNGPlaceholder(`${title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.png`)
  }

  const getRoleBasedStats = () => {
    switch (user?.role) {
      case 'admin':
        return [
          {
            title: "Today's Collection",
            value: formatCurrency(stats.fees.collectedToday || 0),
            icon: CreditCard,
            color: 'text-green-600',
            bgColor: 'bg-green-100'
          },
          {
            title: 'Students Present',
            value: stats.attendance?.studentsPresentToday || 0,
            icon: Users,
            color: 'text-blue-600',
            bgColor: 'bg-blue-100'
          },
          {
            title: 'Employees Present',
            value: stats.attendance?.employeesPresentToday || 0,
            icon: GraduationCap, // Or UserCheck
            color: 'text-purple-600',
            bgColor: 'bg-purple-100'
          },
          {
            title: 'New Admissions',
            value: stats.admissions.thisMonth || 0,
            icon: UserPlus,
            color: 'text-orange-600',
            bgColor: 'bg-orange-100'
          },
          {
            title: 'Pending Fees',
            value: formatCurrency(stats.fees.pending || 0),
            icon: AlertTriangle,
            color: 'text-yellow-600',
            bgColor: 'bg-yellow-100'
          }
        ]
      case 'teacher': {
        const attPct = stats.teacher?.attendanceToday || 0
        const attColor = attPct >= 80 ? 'text-green-600' : attPct >= 60 ? 'text-yellow-600' : 'text-red-600'
        const attBg = attPct >= 80 ? 'bg-green-100' : attPct >= 60 ? 'bg-yellow-100' : 'bg-red-100'
        return [
          {
            title: 'My Students',
            value: stats.teacher?.myStudents || 0,
            icon: Users,
            color: 'text-blue-600',
            bgColor: 'bg-blue-100'
          },
          {
            title: 'My Classes',
            value: stats.teacher?.myClasses || 0,
            icon: School,
            color: 'text-indigo-600',
            bgColor: 'bg-indigo-100'
          },
          {
            title: "Today's Attendance",
            value: `${attPct}%`,
            icon: TrendingUp,
            color: attColor,
            bgColor: attBg
          },
          {
            title: 'Active Assignments',
            value: stats.teacher?.activeAssignments || 0,
            icon: BookOpen,
            color: 'text-purple-600',
            bgColor: 'bg-purple-100'
          },
          {
            title: 'Pending Submissions',
            value: stats.teacher?.pendingSubmissions || 0,
            icon: ClipboardList,
            color: 'text-yellow-600',
            bgColor: 'bg-yellow-100'
          }
        ]
      }
      case 'student':
        return [
          {
            title: 'My Profile',
            value: stats.student?.profileComplete || 'Incomplete',
            icon: Users,
            color: 'text-green-600',
            bgColor: 'bg-green-100'
          },
          {
            title: 'Fees Due',
            value: stats.student?.pendingFeesAmount
              ? formatCurrency(stats.student.pendingFeesAmount)
              : stats.student?.pendingFees
                ? `${stats.student.pendingFees} Pending`
                : 'All Clear',
            icon: CreditCard,
            color: stats.student?.pendingFeesAmount ? 'text-red-600' : 'text-green-600',
            bgColor: stats.student?.pendingFeesAmount ? 'bg-red-100' : 'bg-green-100'
          },
          {
            title: 'Assignments',
            value: stats.student?.assignments || 0,
            icon: BookOpen,
            color: 'text-blue-600',
            bgColor: 'bg-blue-100'
          },
          {
            title: 'Notifications',
            value: stats.student?.notifications || 0,
            icon: Bell,
            color: 'text-purple-600',
            bgColor: 'bg-purple-100'
          }
        ]
      case 'parent':
        return [
          {
            title: 'My Children',
            value: stats.parent?.myChildren || 0,
            icon: Users,
            color: 'text-blue-600',
            bgColor: 'bg-blue-100'
          },
          {
            title: 'Fees Due',
            value: stats.parent?.pendingFeesAmount
              ? formatCurrency(stats.parent.pendingFeesAmount)
              : stats.parent?.pendingFees
                ? `${stats.parent.pendingFees} Pending`
                : 'All Clear',
            icon: CreditCard,
            color: stats.parent?.pendingFeesAmount ? 'text-red-600' : 'text-green-600',
            bgColor: stats.parent?.pendingFeesAmount ? 'bg-red-100' : 'bg-green-100'
          },
          {
            title: 'Notifications',
            value: stats.parent?.notifications || 0,
            icon: Bell,
            color: 'text-purple-600',
            bgColor: 'bg-purple-100'
          },
          {
            title: 'Performance',
            value: stats.parent?.performance || 'Good',
            icon: TrendingUp,
            color: 'text-green-600',
            bgColor: 'bg-green-100'
          }
        ]
      default:
        return []
    }
  }

  // enrollmentData is now fetched dynamically by EnrollmentTrendChart below

  // Fee collection chart — admin only
  const feesData = {
    labels: ['Collected', 'Pending', 'Overdue'],
    datasets: [
      {
        data: [
          stats.fees.paid || 0,
          stats.fees.pending || 0,
          stats.fees.overdue || 0
        ],
        backgroundColor: ['#10b981', '#f59e0b', '#ef4444']
      }
    ]
  }

  // Weekly attendance trend — for teachers (real data from backend)
  const weeklyAttendanceData = {
    labels: stats.teacher?.weeklyAttendance?.labels?.length > 0
      ? stats.teacher.weeklyAttendance.labels
      : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [
      {
        label: 'Attendance %',
        data: stats.teacher?.weeklyAttendance?.data?.length > 0
          ? stats.teacher.weeklyAttendance.data
          : [0, 0, 0, 0, 0, 0, 0],
        borderColor: 'rgb(62, 196, 177)',
        backgroundColor: 'rgba(62, 196, 177, 0.1)',
        tension: 0.4,
        fill: true,
      }
    ]
  }

  // Assignment submission chart — for teachers
  const assignmentData = {
    labels: ['Submitted', 'Pending', 'Late'],
    datasets: [
      {
        data: [
          stats.teacher?.submittedAssignments || 0,
          stats.teacher?.pendingSubmissions || 0,
          stats.teacher?.lateSubmissions || 0
        ],
        backgroundColor: ['#10b981', '#f59e0b', '#ef4444']
      }
    ]
  }

  /* Deprecated: Legacy Recent Activities logic removed */

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-500/10 border border-red-200/60 dark:border-red-500/20 rounded-2xl p-4 animate-fade-in">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mr-2 flex-shrink-0" />
            <p className="text-sm text-red-700 dark:text-red-400">{error.response?.data?.message || 'Failed to load dashboard data. Please check your connection and try again.'}</p>
          </div>
        </div>
      )}

      {/* Backup Reminder Banner */}
      {showBackupReminder && (
        <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200/60 dark:border-amber-500/20 rounded-2xl p-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <p className="text-sm text-amber-700 dark:text-amber-400">
                {daysSinceBackup === null
                  ? "You haven't taken a backup yet. Download a backup to keep your data safe."
                  : `Your last backup was ${daysSinceBackup} days ago. We recommend backing up at least every 7 days.`
                }
              </p>
            </div>
            <button
              onClick={() => navigate('/app/settings')}
              className="text-sm font-medium text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-300 underline whitespace-nowrap ml-3"
            >
              Download backup
            </button>
          </div>
        </div>
      )}

      {/* Welcome message */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
            Welcome back, {user?.name || user?.fullName || user?.firstName || ''}
          </h1>
          <p className="text-sm text-gray-500 dark:text-[#8E8E93] mt-1">
            {tenant?.schoolName || tenant?.name
              ? <>{tenant.schoolName || tenant.name} &mdash; </>
              : null}
            Here's what's happening with your {user?.role === 'admin' ? 'school' : user?.role === 'teacher' ? 'classes' : 'account'} today.
          </p>
        </div>
        {user?.admissionNumber && (
          <button
            onClick={() => {
              navigator.clipboard.writeText(user.admissionNumber)
              toast.success('Admission number copied!')
            }}
            className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 text-sm font-medium hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors"
            title="Copy admission number"
          >
            <span className="font-mono">{user.admissionNumber}</span>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4">
        {isLoading ? (
          [...Array(4)].map((_, i) => <CardSkeleton key={i} />)
        ) : (
          getRoleBasedStats().map((stat, index) => {
            // Map title to navigation route
            const getRoute = (title) => {
              const lowerTitle = title.toLowerCase()
              // Student/Parent: "My Profile" goes to profile page, not student list
              if (lowerTitle === 'my profile') return '/app/profile'
              if (lowerTitle.includes('student')) return '/app/students'
              if (lowerTitle.includes('teacher') || lowerTitle.includes('employee')) return '/app/teachers'
              // Redirect Admin to Advanced Fees & Finance dashboard
              if (user?.role === 'admin' && (lowerTitle.includes('fee') || lowerTitle.includes('collection'))) {
                return '/app/fees-finance'
              }
              // Students and parents go to the Student Fees Dashboard (invoice-based)
              if ((user?.role === 'student' || user?.role === 'parent') && (lowerTitle.includes('fee') || lowerTitle.includes('collection'))) {
                return '/app/student/fees'
              }
              if (lowerTitle.includes('fee') || lowerTitle.includes('collection')) return '/app/fees'

              // Specific redirect for Dashboard "New Admissions" stat (which counts Users) to Students page
              if (lowerTitle === 'new admissions') return '/app/students'
              if (lowerTitle.includes('admission')) return '/app/admissions'

              if (lowerTitle.includes('assignment') || lowerTitle.includes('submission')) return '/app/assignments'
              if (lowerTitle.includes('class')) return '/app/students'
              // Students/Parents see announcements, not the admin notification page
              if (lowerTitle.includes('notification')) {
                return (user?.role === 'student' || user?.role === 'parent') ? '/app/announcements' : '/app/notifications'
              }
              if (lowerTitle.includes('attendance')) return '/app/attendance'
              return '/app/dashboard'
            }

            // Handle export with more data
            const handleExport = () => {
              const exportData = [
                ['Metric', 'Value'],
                [stat.title, String(stat.value)]
              ]

              // Add additional context based on stat type (fee details admin-only)
              if (stat.title.toLowerCase().includes('fee') && stats.fees && user?.role === 'admin') {
                exportData.push(['Total Fees', stats.fees.total])
                exportData.push(['Paid Fees', stats.fees.paid])
                exportData.push(['Pending Fees', stats.fees.pending])
                exportData.push(['Overdue Fees', stats.fees.overdue])
              } else if (stat.title.toLowerCase().includes('student') && stats.students) {
                exportData.push(['Total Students', stats.students.total])
                exportData.push(['Active Students', stats.students.active])
              } else if (stat.title.toLowerCase().includes('teacher') && stats.teachers) {
                exportData.push(['Total Teachers', stats.teachers.total])
                exportData.push(['Active Teachers', stats.teachers.active])
              }

              exportCSV(`${stat.title}_${new Date().toISOString().split('T')[0]}.csv`, exportData)
            }

            return (
              <KpiCard
                key={index}
                title={stat.title}
                value={stat.value}
                Icon={stat.icon}
                primaryLabel="View details"
                onPrimary={() => navigate(getRoute(stat.title))}
                secondaryLabel="Export"
                onSecondary={handleExport}
                isRefetching={isFetching && !isLoading}
                glass
              />
            )
          })
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5 lg:gap-6">
        {isLoading ? (
          <ChartSkeleton />
        ) : (
          <>
            {user?.role === 'admin' ? (
              <>
                <ChartCard
                  title="Student Enrollment Trend"
                  onExport={() => exportChartAsPNG('Student Enrollment Trend', {})}
                  filterOptions={{ classOptions: [], teacherOptions: [], sectionOptions: [] }}
                >
                  {({ range }) => (
                    <EnrollmentTrendChart range={range} />
                  )}
                </ChartCard>

                <ChartCard
                  title="Fee Collection Status"
                  onExport={() => exportChartAsPNG('Fee Collection Status', feesData)}
                >
                  {() => (
                    <Doughnut data={feesData} options={{ responsive: true, maintainAspectRatio: false }} />
                  )}
                </ChartCard>
              </>
            ) : user?.role === 'teacher' ? (
              <>
                <ChartCard
                  title="Weekly Attendance Trend"
                  onExport={() => exportChartAsPNG('Weekly Attendance Trend', weeklyAttendanceData)}
                >
                  {() => (
                    <Line
                      data={weeklyAttendanceData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                          y: {
                            beginAtZero: true,
                            max: 100,
                            ticks: { callback: (v) => `${v}%` },
                          },
                        },
                        plugins: {
                          tooltip: {
                            callbacks: { label: (ctx) => `Attendance: ${ctx.parsed.y}%` },
                          },
                        },
                      }}
                    />
                  )}
                </ChartCard>

                <ChartCard
                  title="Homework Submission Status"
                  onExport={() => exportChartAsPNG('Homework Submission Status', assignmentData)}
                >
                  {() => (
                    <Doughnut data={assignmentData} options={{ responsive: true, maintainAspectRatio: false }} />
                  )}
                </ChartCard>
              </>
            ) : null}
          </>
        )}
      </div>

      {/* Attendance Quick Widget — Admin */}
      {user?.role === 'admin' && !isLoading && (
        <div className="card p-4 sm:p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Today's Attendance</h3>
            <button
              onClick={() => navigate('/app/attendance')}
              className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
            >
              View Dashboard
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-green-50 dark:bg-green-900/10 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-green-600">{stats.attendance?.studentsPresentToday || 0}</p>
              <p className="text-xs text-green-600/70">Students Present</p>
            </div>
            <div className="bg-red-50 dark:bg-red-900/10 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-red-600">{stats.attendance?.studentsAbsentToday || 0}</p>
              <p className="text-xs text-red-600/70">Students Absent</p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/10 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-blue-600">{stats.attendance?.employeesPresentToday || 0}</p>
              <p className="text-xs text-blue-600/70">Staff Present</p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/10 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-amber-600">{stats.attendance?.unmarkedClasses || 0}</p>
              <p className="text-xs text-amber-600/70">Unmarked Classes</p>
            </div>
          </div>
          {(stats.attendance?.unmarkedClasses || 0) > 0 && (
            <div className="mt-3 flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" />
              <span>{stats.attendance.unmarkedClasses} class{stats.attendance.unmarkedClasses !== 1 ? 'es' : ''} haven't been marked yet.</span>
              <button onClick={() => navigate('/app/attendance/mark')} className="font-medium underline">Mark Now</button>
            </div>
          )}
        </div>
      )}

      {/* Admin specific widgets */}
      {user?.role === 'admin' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card p-4 sm:p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Upcoming Exams & Deadlines</h3>
            {stats.upcomingExams && stats.upcomingExams.length > 0 ? (
              <div className="space-y-3">
                {stats.upcomingExams.map((exam, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{exam.name || 'Exam'}</p>
                      <p className="text-xs text-gray-500 dark:text-[#8E8E93]">{exam.subject?.name} • {exam.class?.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-indigo-600">
                        {formatDate(exam.date)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-[#8E8E93] py-4 text-center">No upcoming exams found.</p>
            )}
          </div>
        </div>
      )}

      {/* Teacher-specific widgets */}
      {user?.role === 'teacher' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upcoming Assignment Deadlines */}
          <div className="card p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Upcoming Assignment Deadlines</h3>
              <button
                onClick={() => navigate('/app/assignments')}
                className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
              >
                View all
              </button>
            </div>
            {stats.teacher?.upcomingAssignments && stats.teacher.upcomingAssignments.length > 0 ? (
              <div className="space-y-3">
                {stats.teacher.upcomingAssignments.map((assignment, index) => {
                  const dueDate = new Date(assignment.dueDate)
                  const daysLeft = Math.ceil((dueDate - new Date()) / (1000 * 60 * 60 * 24))
                  const isUrgent = daysLeft <= 2
                  return (
                    <div key={index} className={`flex items-center justify-between p-3 rounded-xl ${isUrgent ? 'bg-red-50 dark:bg-red-500/10' : 'bg-blue-50 dark:bg-blue-500/10'}`}>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{assignment.title}</p>
                        <p className="text-xs text-gray-500 dark:text-[#8E8E93]">{assignment.subject} - {assignment.class}</p>
                      </div>
                      <div className="text-right ml-3 flex-shrink-0">
                        <p className={`text-sm font-medium ${isUrgent ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
                          {dueDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </p>
                        <p className={`text-xs ${isUrgent ? 'text-red-500 dark:text-red-400' : 'text-gray-500 dark:text-[#8E8E93]'}`}>
                          {daysLeft <= 0 ? 'Due today' : `${daysLeft}d left`}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="py-8 text-center">
                <BookOpen className="h-8 w-8 text-gray-300 dark:text-[#636366] mx-auto mb-2" />
                <p className="text-sm text-gray-500 dark:text-[#8E8E93]">No upcoming assignments</p>
              </div>
            )}
          </div>

          {/* My Assigned Classes */}
          <div className="card p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">My Assigned Classes</h3>
              <button
                onClick={() => navigate('/app/students')}
                className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
              >
                View students
              </button>
            </div>
            {stats.teacher?.assignedClasses && stats.teacher.assignedClasses.length > 0 ? (
              <div className="space-y-3">
                {stats.teacher.assignedClasses.map((cls, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center">
                        <School className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{cls.name}</p>
                        <p className="text-xs text-gray-500 dark:text-[#8E8E93]">
                          {cls.grade ? `Grade ${cls.grade} · ` : ''}{cls.studentCount ?? 0} student{cls.studentCount !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => navigate(`/app/students?class=${encodeURIComponent(cls.name)}`)}
                      className="text-xs text-primary-600 dark:text-primary-400 hover:underline flex-shrink-0"
                    >
                      View students
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center">
                <School className="h-8 w-8 text-gray-300 dark:text-[#636366] mx-auto mb-2" />
                <p className="text-sm text-gray-500 dark:text-[#8E8E93]">No classes assigned yet</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Student / Parent activity feed */}
      {(user?.role === 'student' || user?.role === 'parent') && (
        <StudentActivityFeed />
      )}

      {/* Recent activities - Admin only (contains fee payments & employee data) */}
      {user?.role === 'admin' && (
        <RecentActivities activities={stats.recentActivities} isLoading={isLoading} />
      )}
    </div>
  )
}

export default Dashboard
