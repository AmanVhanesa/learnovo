import React, { useState } from 'react'
import { Download, BarChart3, PieChart, TrendingUp, Calendar, BookOpen, Users, FileText } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const Reports = () => {
  const { user } = useAuth()
  const [selectedReport, setSelectedReport] = useState('')
  const [reportFilters, setReportFilters] = useState({
    startDate: '',
    endDate: '',
    class: '',
    student: ''
  })

  const getReportOptions = () => {
    if (user?.role === 'admin') {
      return [
        { id: 'fee-collection', name: 'Fee Collection Trends', icon: BarChart3, description: 'Monthly fee collection analysis' },
        { id: 'enrollment', name: 'Student Enrollment', icon: PieChart, description: 'Class-wise student distribution' },
        { id: 'attendance', name: 'Attendance Report', icon: Calendar, description: 'Overall attendance statistics' },
        { id: 'performance', name: 'Academic Performance', icon: TrendingUp, description: 'Student performance metrics' }
      ]
    } else if (user?.role === 'teacher') {
      return [
        { id: 'attendance', name: 'Class Attendance', icon: Calendar, description: 'Daily, weekly, monthly attendance reports' },
        { id: 'assignments', name: 'Assignment Submission Status', icon: BookOpen, description: 'Assignment completion and submission rates' },
        { id: 'student-performance', name: 'Student Performance', icon: TrendingUp, description: 'Individual student progress tracking' },
        { id: 'class-summary', name: 'Class Summary Report', icon: Users, description: 'Comprehensive class overview' }
      ]
    }
    return []
  }

  const generateReport = () => {
    if (!selectedReport) {
      alert('Please select a report type')
      return
    }
    
    // Mock report generation
    const reportData = {
      type: selectedReport,
      filters: reportFilters,
      generatedAt: new Date().toISOString()
    }
    
    console.log('Generating report:', reportData)
    alert(`Report generated successfully!\nType: ${selectedReport}\nDate Range: ${reportFilters.startDate} to ${reportFilters.endDate}`)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">
          {user?.role === 'teacher' ? 'Academic Reports' : 'Reports & Analytics'}
        </h1>
        <button 
          className="btn btn-primary"
          onClick={generateReport}
          disabled={!selectedReport}
        >
          <Download className="h-4 w-4 mr-2" />
          Generate Report
        </button>
      </div>

      {/* Report Selection */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Select Report Type</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {getReportOptions().map((report) => (
            <div
              key={report.id}
              className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                selectedReport === report.id
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => setSelectedReport(report.id)}
            >
              <div className="flex items-center space-x-3">
                <report.icon className={`h-6 w-6 ${
                  selectedReport === report.id ? 'text-primary-600' : 'text-gray-400'
                }`} />
                <div>
                  <h4 className="font-medium text-gray-900">{report.name}</h4>
                  <p className="text-sm text-gray-500">{report.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Report Filters */}
      {selectedReport && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Report Filters</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date
              </label>
              <input
                type="date"
                value={reportFilters.startDate}
                onChange={(e) => setReportFilters({...reportFilters, startDate: e.target.value})}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Date
              </label>
              <input
                type="date"
                value={reportFilters.endDate}
                onChange={(e) => setReportFilters({...reportFilters, endDate: e.target.value})}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Class
              </label>
              <select
                value={reportFilters.class}
                onChange={(e) => setReportFilters({...reportFilters, class: e.target.value})}
                className="input"
              >
                <option value="">All Classes</option>
                <option value="10A">Class 10A</option>
                <option value="11B">Class 11B</option>
                <option value="12A">Class 12A</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Student
              </label>
              <select
                value={reportFilters.student}
                onChange={(e) => setReportFilters({...reportFilters, student: e.target.value})}
                className="input"
              >
                <option value="">All Students</option>
                <option value="john-doe">John Doe</option>
                <option value="jane-smith">Jane Smith</option>
                <option value="mike-johnson">Mike Johnson</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Report Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {user?.role === 'admin' ? (
          <>
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Fee Collection Trends</h3>
              <div className="h-64 flex items-center justify-center text-gray-500">
                <BarChart3 className="h-12 w-12" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Student Enrollment</h3>
              <div className="h-64 flex items-center justify-center text-gray-500">
                <PieChart className="h-12 w-12" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Class-wise Distribution</h3>
              <div className="h-64 flex items-center justify-center text-gray-500">
                <TrendingUp className="h-12 w-12" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Attendance Report</h3>
              <div className="h-64 flex items-center justify-center text-gray-500">
                <BarChart3 className="h-12 w-12" />
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Class Attendance Trends</h3>
              <div className="h-64 flex items-center justify-center text-gray-500">
                <Calendar className="h-12 w-12" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Assignment Submission Rates</h3>
              <div className="h-64 flex items-center justify-center text-gray-500">
                <BookOpen className="h-12 w-12" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Student Performance Overview</h3>
              <div className="h-64 flex items-center justify-center text-gray-500">
                <TrendingUp className="h-12 w-12" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Class Summary Report</h3>
              <div className="h-64 flex items-center justify-center text-gray-500">
                <Users className="h-12 w-12" />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default Reports
