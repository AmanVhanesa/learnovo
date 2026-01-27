import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useSettings } from '../contexts/SettingsContext'
import {
  Users,
  GraduationCap,
  CreditCard,
  AlertTriangle,
  TrendingUp,
  Calendar,
  BookOpen,
  Bell,
  UserPlus
} from 'lucide-react'
import { Line, Doughnut } from 'react-chartjs-2'
import KpiCard from '../components/KpiCard'
import ChartCard from '../components/ChartCard'
import SummaryCard from '../components/SummaryCard'
import Button from '../components/Button'
import { CardSkeleton, ChartSkeleton } from '../components/LoadingSkeleton'
import { exportCSV, exportPNGPlaceholder } from '../utils/exportHelpers'
import { reportsService } from '../services/reportsService'
import RecentActivities from '../components/RecentActivities'
import toast from 'react-hot-toast'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
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
  Title,
  Tooltip,
  Legend
)

const Dashboard = () => {
  const { user } = useAuth()
  const { formatCurrency } = useSettings()
  const navigate = useNavigate()
  const [stats, setStats] = useState({
    students: { total: 0, active: 0 },
    teachers: { total: 0, active: 0 },
    admissions: { total: 0, pending: 0, approved: 0, rejected: 0 },
    fees: { total: 0, paid: 0, pending: 0, overdue: 0 },
    teacher: { myStudents: 0, attendanceToday: 0, activeAssignments: 0, pendingSubmissions: 0 },
    student: { profileComplete: 'Incomplete', pendingFees: 0, assignments: 0, notifications: 0 },
    parent: { myChildren: 0, pendingFees: 0, notifications: 0, performance: 'Good' },
    enrollmentTrend: { labels: [], data: [] },
    recentActivities: []
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const res = await reportsService.getDashboardStats()
      // Fetch recent activities in parallel or separately
      const activitiesRes = await reportsService.getRecentActivities()

      if (res?.success && res?.data) {
        setStats({
          ...res.data,
          recentActivities: activitiesRes.success ? activitiesRes.data : []
        })
      } else {
        setError(null)
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
      setError(error.response?.data?.message || 'Failed to load dashboard data. Please check your connection and try again.')
    } finally {
      setIsLoading(false)
    }
  }

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
      case 'teacher':
        return [
          {
            title: 'My Students',
            value: stats.teacher?.myStudents || 0,
            icon: Users,
            color: 'text-blue-600',
            bgColor: 'bg-blue-100'
          },
          {
            title: "Today's Attendance",
            value: `${stats.teacher?.attendanceToday || 0}%`,
            icon: TrendingUp,
            color: 'text-green-600',
            bgColor: 'bg-green-100'
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
            icon: AlertTriangle,
            color: 'text-yellow-600',
            bgColor: 'bg-yellow-100'
          }
        ]
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
            title: 'Fees Status',
            value: `${stats.student?.pendingFees || 0} Pending`,
            icon: CreditCard,
            color: 'text-yellow-600',
            bgColor: 'bg-yellow-100'
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
            title: 'Fees Status',
            value: `${stats.parent?.pendingFees || 0} Pending`,
            icon: CreditCard,
            color: 'text-yellow-600',
            bgColor: 'bg-yellow-100'
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

  const enrollmentData = {
    labels: stats.enrollmentTrend?.labels && stats.enrollmentTrend.labels.length > 0
      ? stats.enrollmentTrend.labels
      : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    datasets: [
      {
        label: 'Students Enrolled',
        data: stats.enrollmentTrend?.data && stats.enrollmentTrend.data.length > 0
          ? stats.enrollmentTrend.data
          : [0, 0, 0, 0, 0, 0],
        borderColor: 'rgb(62, 196, 177)',
        backgroundColor: 'rgba(62, 196, 177, 0.1)',
        tension: 0.4
      }
    ]
  }

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

  /* Deprecated: Legacy Recent Activities logic removed */

  return (
    <div className="space-y-6">
      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
            <p className="text-sm text-red-600">{error}</p>
          </div>
          <button
            onClick={() => fetchDashboardData()}
            className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Welcome message */}
      <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
          Welcome back, {user?.name}!
        </h1>
        <div className="flex items-center gap-3 mt-2">
          {user?.admissionNumber && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-teal-100 text-teal-800">
              <span className="font-mono font-semibold mr-2">
                {user.admissionNumber}
              </span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(user.admissionNumber)
                  toast.success('Admission number copied!')
                }}
                className="text-teal-600 hover:text-teal-700 transition-colors"
                title="Copy admission number"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            </span>
          )}
          <p className="text-gray-600">
            Here's what's happening with your {user?.role === 'admin' ? 'school' : 'account'} today.
          </p>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 md:gap-5 xl:gap-6">
        {isLoading ? (
          [...Array(4)].map((_, i) => <CardSkeleton key={i} />)
        ) : (
          getRoleBasedStats().map((stat, index) => {
            // Map title to navigation route
            const getRoute = (title) => {
              const lowerTitle = title.toLowerCase()
              if (lowerTitle.includes('student')) return '/app/students'
              if (lowerTitle.includes('teacher') || lowerTitle.includes('employee')) return '/app/teachers'
              if (lowerTitle.includes('fee') || lowerTitle.includes('collection')) return '/app/fees'
              if (lowerTitle.includes('admission')) return '/app/admissions'
              if (lowerTitle.includes('assignment')) return '/app/assignments'
              if (lowerTitle.includes('notification')) return '/app/notifications'
              return '/app/dashboard'
            }

            // Handle export with more data
            const handleExport = () => {
              const exportData = [
                ['Metric', 'Value'],
                [stat.title, String(stat.value)]
              ]

              // Add additional context based on stat type
              if (stat.title.toLowerCase().includes('fee') && stats.fees) {
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
                  onExport={() => exportChartAsPNG('Student Enrollment Trend', enrollmentData)}
                  filterOptions={{ classOptions: [], teacherOptions: [], sectionOptions: [] }}
                >
                  {() => (
                    <Line data={enrollmentData} options={{ responsive: true, maintainAspectRatio: false }} />
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
                  onExport={() => exportChartAsPNG('Weekly Attendance Trend', enrollmentData)}
                >
                  {() => (
                    <Line data={enrollmentData} options={{ responsive: true, maintainAspectRatio: false }} />
                  )}
                </ChartCard>

                <ChartCard
                  title="Assignment Submission Status"
                  onExport={() => exportChartAsPNG('Assignment Submission Status', feesData)}
                >
                  {() => (
                    <Doughnut data={feesData} options={{ responsive: true, maintainAspectRatio: false }} />
                  )}
                </ChartCard>
              </>
            ) : (
              <ChartCard
                title="Student Enrollment Trend"
                onExport={() => exportChartAsPNG('Student Enrollment Trend', enrollmentData)}
                filterOptions={{ classOptions: [], teacherOptions: [], sectionOptions: [] }}
              >
                {() => (
                  <Line data={enrollmentData} options={{ responsive: true, maintainAspectRatio: false }} />
                )}
              </ChartCard>
            )}
          </>
        )}
      </div>

      {/* Admin specific widgets */}
      {user?.role === 'admin' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Upcoming Exams & Deadlines</h3>
            {stats.upcomingExams && stats.upcomingExams.length > 0 ? (
              <div className="space-y-3">
                {stats.upcomingExams.map((exam, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-indigo-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{exam.name || 'Exam'}</p>
                      <p className="text-xs text-gray-500">{exam.subject?.name} • {exam.class?.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-indigo-600">
                        {new Date(exam.date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 py-4 text-center">No upcoming exams found.</p>
            )}
          </div>
        </div>
      )}

      {/* Teacher-specific widgets */}
      {user?.role === 'teacher' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upcoming Assignment Deadlines */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Upcoming Assignment Deadlines</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900">Math Homework</p>
                  <p className="text-xs text-gray-500">Class 10A</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-yellow-600">Due Tomorrow</p>
                  <p className="text-xs text-gray-500">Dec 11, 2024</p>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900">Science Project</p>
                  <p className="text-xs text-gray-500">Class 9B</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-blue-600">Due in 3 days</p>
                  <p className="text-xs text-gray-500">Dec 14, 2024</p>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900">English Essay</p>
                  <p className="text-xs text-gray-500">Class 11A</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-green-600">Due in 5 days</p>
                  <p className="text-xs text-gray-500">Dec 16, 2024</p>
                </div>
              </div>
            </div>
          </div>

          {/* Today's Class Schedule */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Today's Class Schedule</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900">Mathematics</p>
                  <p className="text-xs text-gray-500">Class 10A - 25 students</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-blue-600">9:00 AM</p>
                  <p className="text-xs text-gray-500">45 min</p>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900">Physics</p>
                  <p className="text-xs text-gray-500">Class 11B - 22 students</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-green-600">11:00 AM</p>
                  <p className="text-xs text-gray-500">45 min</p>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900">Chemistry</p>
                  <p className="text-xs text-gray-500">Class 12A - 20 students</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-purple-600">2:00 PM</p>
                  <p className="text-xs text-gray-500">45 min</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent activities */}
      {/* Recent activities */}
      <RecentActivities activities={stats.recentActivities} isLoading={isLoading} />
    </div>
  )
}

export default Dashboard
