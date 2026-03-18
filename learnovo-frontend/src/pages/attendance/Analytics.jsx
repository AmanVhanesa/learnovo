import React, { useState, useEffect } from 'react'
import { BarChart3, TrendingUp, AlertTriangle, Phone } from 'lucide-react'
import Select from '../../components/ui/Select'
import { useAuth } from '../../contexts/AuthContext'
import { attendanceService } from '../../services/attendanceService'
import toast from 'react-hot-toast'

const Analytics = () => {
  const { user } = useAuth()
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [analyticsData, setAnalyticsData] = useState(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    fetchAnalytics()
  }, [month, year])

  const fetchAnalytics = async () => {
    try {
      setIsLoading(true)
      const response = await attendanceService.getAnalytics({ month, year })
      setAnalyticsData(response?.data || null)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const months = [
    { value: 1, label: 'January' }, { value: 2, label: 'February' }, { value: 3, label: 'March' },
    { value: 4, label: 'April' }, { value: 5, label: 'May' }, { value: 6, label: 'June' },
    { value: 7, label: 'July' }, { value: 8, label: 'August' }, { value: 9, label: 'September' },
    { value: 10, label: 'October' }, { value: 11, label: 'November' }, { value: 12, label: 'December' }
  ]

  const classWise = analyticsData?.classWise || []
  const monthlyTrend = analyticsData?.monthlyTrend || []
  const dayOfWeek = analyticsData?.dayOfWeek || []
  const chronicAbsentees = analyticsData?.chronicAbsentees || []

  const maxClassPct = Math.max(...classWise.map(c => c.percentage), 100)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Attendance Analytics</h1>
          <p className="text-sm text-gray-500 dark:text-[#8E8E93] mt-1">Trends, patterns, and insights</p>
        </div>
        <div className="flex gap-2">
          <Select
            value={month}
            onChange={(e) => setMonth(parseInt(e.target.value))}
            className="w-auto min-w-[130px]"
            options={months.map(m => ({ value: m.value, label: m.label }))}
          />
          <Select
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
            className="w-auto min-w-[90px]"
            options={[now.getFullYear() - 1, now.getFullYear()].map(y => ({
              value: y, label: String(y)
            }))}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-32"><div className="loading-spinner" /></div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Class-wise Comparison */}
            <div className="card p-4 sm:p-6">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary-500" /> Class-wise Attendance
              </h3>
              {classWise.length > 0 ? (
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {classWise.sort((a, b) => b.percentage - a.percentage).map((cls, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <span className="text-xs text-gray-500 dark:text-[#8E8E93] w-20 truncate">{cls.className}</span>
                      <div className="flex-1 bg-gray-100 dark:bg-[#2C2C2E] rounded-full h-5 relative overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            cls.percentage >= 80 ? 'bg-green-500' : cls.percentage >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${cls.percentage}%` }}
                        />
                      </div>
                      <span className={`text-xs font-bold w-10 text-right ${
                        cls.percentage >= 80 ? 'text-green-600' : cls.percentage >= 60 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {cls.percentage}%
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-[#8E8E93] text-center py-8">No data available</p>
              )}
            </div>

            {/* Monthly Trend */}
            <div className="card p-4 sm:p-6">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary-500" /> Monthly Trend
              </h3>
              {monthlyTrend.length > 0 ? (
                <div className="space-y-3">
                  {monthlyTrend.map((m, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <span className="text-xs text-gray-500 dark:text-[#8E8E93] w-20">{m.month}</span>
                      <div className="flex-1 bg-gray-100 dark:bg-[#2C2C2E] rounded-full h-5 relative overflow-hidden">
                        <div
                          className="h-full bg-primary-500 rounded-full transition-all"
                          style={{ width: `${m.percentage}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-gray-700 dark:text-[#8E8E93] w-10 text-right">{m.percentage}%</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-[#8E8E93] text-center py-8">No data available</p>
              )}
            </div>
          </div>

          {/* Day of Week Analysis */}
          <div className="card p-4 sm:p-6">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Day-of-Week Analysis</h3>
            {dayOfWeek.length > 0 ? (
              <div className="flex items-end gap-3 h-40">
                {dayOfWeek.map((d, idx) => (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[10px] font-bold text-gray-700 dark:text-[#8E8E93]">{d.percentage}%</span>
                    <div className="w-full bg-gray-100 dark:bg-[#2C2C2E] rounded-t-lg relative" style={{ height: '120px' }}>
                      <div
                        className={`absolute bottom-0 w-full rounded-t-lg transition-all ${
                          d.percentage >= 80 ? 'bg-green-500' : d.percentage >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ height: `${d.percentage}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 dark:text-[#8E8E93]">{d.day}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-[#8E8E93] text-center py-8">No data available</p>
            )}
          </div>

          {/* Chronic Absentees */}
          <div className="card p-4 sm:p-6">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" /> Chronic Absentees (Below 90%)
            </h3>
            {chronicAbsentees.length === 0 ? (
              <p className="text-sm text-green-600 dark:text-green-400 text-center py-8">All students have attendance above 90%!</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-[#38383A]">
                      <th className="text-left py-2 text-xs font-semibold text-gray-500 dark:text-[#8E8E93]">#</th>
                      <th className="text-left py-2 text-xs font-semibold text-gray-500 dark:text-[#8E8E93]">Student</th>
                      <th className="text-left py-2 text-xs font-semibold text-gray-500 dark:text-[#8E8E93]">Class</th>
                      <th className="text-center py-2 text-xs font-semibold text-gray-500 dark:text-[#8E8E93]">Absent Days</th>
                      <th className="text-center py-2 text-xs font-semibold text-gray-500 dark:text-[#8E8E93]">Attendance %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-dark-border">
                    {chronicAbsentees.map((row, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-[#2C2C2E]/50">
                        <td className="py-2.5 text-gray-400 dark:text-[#636366]">{row.rank}</td>
                        <td className="py-2.5">
                          <p className="font-medium text-gray-900 dark:text-white">{row.student?.name}</p>
                          <p className="text-xs text-gray-500 dark:text-[#8E8E93]">{row.student?.admissionNumber}</p>
                        </td>
                        <td className="py-2.5 text-gray-600 dark:text-[#8E8E93]">
                          {row.student?.class} {row.student?.section ? `- ${row.student.section}` : ''}
                        </td>
                        <td className="py-2.5 text-center font-semibold text-red-600">{row.absentDays}</td>
                        <td className="py-2.5 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                            row.percentage < 75 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {row.percentage}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default Analytics
