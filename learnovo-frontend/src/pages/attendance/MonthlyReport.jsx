import React, { useState, useEffect } from 'react'
import { Download, Printer, BarChart3 } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { attendanceService } from '../../services/attendanceService'
import toast from 'react-hot-toast'

const statusCodes = {
  present: { code: 'P', color: 'text-green-600' },
  absent: { code: 'A', color: 'text-red-600' },
  late: { code: 'L', color: 'text-yellow-600' },
  half_day: { code: 'H', color: 'text-blue-600' },
  excused: { code: 'E', color: 'text-gray-500' },
  holiday: { code: '-', color: 'text-purple-400' },
  weekend: { code: '-', color: 'text-gray-300' }
}

const MonthlyReport = () => {
  const { user } = useAuth()
  const now = new Date()
  const [classes, setClasses] = useState([])
  const [selectedClass, setSelectedClass] = useState('')
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [reportData, setReportData] = useState(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    fetchClasses()
  }, [])

  const fetchClasses = async () => {
    try {
      let response
      if (user?.role === 'admin') {
        response = await attendanceService.getAllClasses()
      } else {
        response = await attendanceService.getTeacherClasses()
      }
      setClasses(response?.data || [])
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const generateReport = async () => {
    if (!selectedClass) {
      toast.error('Please select a class')
      return
    }
    try {
      setIsLoading(true)
      const response = await attendanceService.getMonthlyReport(selectedClass, month, year)
      setReportData(response?.data || null)
    } catch (error) {
      toast.error('Failed to generate report')
    } finally {
      setIsLoading(false)
    }
  }

  const handleExportCSV = async () => {
    try {
      const response = await attendanceService.exportAttendance(selectedClass, month, year)
      const blob = response.data || response
      const url = URL.createObjectURL(new Blob([blob]))
      const a = document.createElement('a')
      a.href = url
      a.download = `attendance_${month}_${year}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Exported!')
    } catch (error) {
      toast.error('Export failed')
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const months = [
    { value: 1, label: 'January' }, { value: 2, label: 'February' }, { value: 3, label: 'March' },
    { value: 4, label: 'April' }, { value: 5, label: 'May' }, { value: 6, label: 'June' },
    { value: 7, label: 'July' }, { value: 8, label: 'August' }, { value: 9, label: 'September' },
    { value: 10, label: 'October' }, { value: 11, label: 'November' }, { value: 12, label: 'December' }
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Monthly Attendance Report</h1>
        <p className="text-sm text-gray-500 dark:text-[#8E8E93] mt-1">Class-wise attendance register</p>
      </div>

      {/* Filters */}
      <div className="card p-4 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1.5">Class</label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="input"
            >
              <option value="">Select Class</option>
              {classes.map(cls => (
                <option key={cls._id} value={cls._id}>{cls.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1.5">Month</label>
            <select value={month} onChange={(e) => setMonth(parseInt(e.target.value))} className="input">
              {months.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1.5">Year</label>
            <select value={year} onChange={(e) => setYear(parseInt(e.target.value))} className="input">
              {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={generateReport} disabled={isLoading} className="btn btn-primary w-full">
              {isLoading ? 'Generating...' : 'Generate Report'}
            </button>
          </div>
        </div>
      </div>

      {/* Report Table */}
      {reportData && (
        <>
          {/* Export actions */}
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
              {reportData.className} — {months.find(m => m.value === reportData.month)?.label} {reportData.year}
            </h3>
            <div className="flex gap-2">
              <button onClick={handleExportCSV} className="btn btn-outline btn-sm">
                <Download className="h-4 w-4 mr-1" /> CSV
              </button>
              <button onClick={handlePrint} className="btn btn-outline btn-sm">
                <Printer className="h-4 w-4 mr-1" /> Print
              </button>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 dark:bg-[#2C2C2E]">
                    <th className="sticky left-0 z-10 bg-gray-50 dark:bg-[#2C2C2E] px-3 py-2 text-left font-semibold text-gray-700 dark:text-[#8E8E93] border-r border-gray-200 dark:border-[#38383A] min-w-[180px]">
                      Student
                    </th>
                    {Array.from({ length: reportData.daysInMonth }, (_, i) => {
                      const day = i + 1
                      const dateStr = `${reportData.year}-${String(reportData.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                      const isHoliday = reportData.holidays?.some(h => h.date?.startsWith(dateStr))
                      return (
                        <th
                          key={day}
                          className={`px-1.5 py-2 text-center font-medium min-w-[28px] ${
                            isHoliday ? 'bg-purple-50 dark:bg-purple-900/10 text-purple-600' : 'text-gray-600 dark:text-[#8E8E93]'
                          }`}
                        >
                          {day}
                        </th>
                      )
                    })}
                    <th className="px-2 py-2 text-center font-semibold text-green-600 min-w-[32px]">P</th>
                    <th className="px-2 py-2 text-center font-semibold text-red-600 min-w-[32px]">A</th>
                    <th className="px-2 py-2 text-center font-semibold text-gray-700 dark:text-[#8E8E93] min-w-[40px]">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-dark-border">
                  {reportData.students?.map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-[#2C2C2E]/50">
                      <td className="sticky left-0 z-10 bg-white dark:bg-[#1C1C1E] px-3 py-2 border-r border-gray-200 dark:border-[#38383A]">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400 w-4">{idx + 1}</span>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white truncate max-w-[120px]">{row.student?.name}</p>
                            <p className="text-[10px] text-gray-400 dark:text-[#636366]">{row.student?.admissionNumber}</p>
                          </div>
                        </div>
                      </td>
                      {row.days?.map((day, dIdx) => {
                        const sc = statusCodes[day.status] || { code: '-', color: 'text-gray-300' }
                        return (
                          <td key={dIdx} className="px-1 py-2 text-center">
                            <span className={`font-semibold ${sc.color}`}>{sc.code}</span>
                          </td>
                        )
                      })}
                      <td className="px-2 py-2 text-center font-semibold text-green-600">{row.summary?.present}</td>
                      <td className="px-2 py-2 text-center font-semibold text-red-600">{row.summary?.absent}</td>
                      <td className={`px-2 py-2 text-center font-bold ${
                        row.summary?.percentage >= 75 ? 'text-green-600' : row.summary?.percentage >= 50 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {row.summary?.percentage}%
                      </td>
                    </tr>
                  ))}
                </tbody>

                {/* Daily totals footer */}
                {reportData.dailyTotals && (
                  <tfoot>
                    <tr className="bg-gray-50 dark:bg-[#2C2C2E] border-t-2 border-gray-200 dark:border-[#38383A]">
                      <td className="sticky left-0 z-10 bg-gray-50 dark:bg-[#2C2C2E] px-3 py-2 font-semibold text-gray-700 dark:text-[#8E8E93] border-r border-gray-200 dark:border-[#38383A]">
                        Total Present
                      </td>
                      {reportData.dailyTotals.map((dt, idx) => (
                        <td key={idx} className="px-1 py-2 text-center text-[10px] font-medium text-green-600">
                          {dt.present || ''}
                        </td>
                      ))}
                      <td colSpan={3} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 text-xs text-gray-500 dark:text-[#8E8E93]">
            {Object.entries(statusCodes).filter(([k]) => !['holiday', 'weekend'].includes(k)).map(([status, config]) => (
              <span key={status} className="flex items-center gap-1">
                <span className={`font-bold ${config.color}`}>{config.code}</span> = {status.replace('_', ' ')}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default MonthlyReport
