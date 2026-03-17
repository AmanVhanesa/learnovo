import React, { useState, useEffect } from 'react'
import { XCircle, Phone, Download, Users, ChevronDown } from 'lucide-react'
import { attendanceService } from '../../services/attendanceService'
import toast from 'react-hot-toast'

const Absentees = () => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [activeTab, setActiveTab] = useState('students')
  const [absenteeData, setAbsenteeData] = useState({ absentees: [], grouped: [], totalAbsent: 0 })
  const [employeeAbsentees, setEmployeeAbsentees] = useState([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (activeTab === 'students') fetchAbsentees()
    else fetchEmployeeAbsentees()
  }, [selectedDate, activeTab])

  const fetchAbsentees = async () => {
    try {
      setIsLoading(true)
      const response = await attendanceService.getAbsentees(selectedDate)
      setAbsenteeData(response?.data || { absentees: [], grouped: [], totalAbsent: 0 })
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchEmployeeAbsentees = async () => {
    try {
      setIsLoading(true)
      const response = await attendanceService.getEmployees(selectedDate)
      const employees = response?.data || []
      setEmployeeAbsentees(employees.filter(e => e.attendance?.status === 'absent'))
    } catch (error) {
      console.error('Error:', error)
      setEmployeeAbsentees([])
    } finally {
      setIsLoading(false)
    }
  }

  const exportCSV = () => {
    const rows = absenteeData.absentees.map((a, i) =>
      `${i + 1},"${a.studentName || ''}","${a.admissionNumber || ''}","${a.class || ''} - ${a.section || ''}","${a.phone || ''}"`
    )
    const csv = 'S.No,Student Name,Admission No,Class-Section,Parent Phone\n' + rows.join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `absentees_${selectedDate}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Exported successfully')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Today's Absentees</h1>
          <p className="text-sm text-gray-500 dark:text-[#8E8E93] mt-1">View absent students and employees</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            max={new Date().toISOString().split('T')[0]}
            className="input w-auto"
          />
          {activeTab === 'students' && absenteeData.absentees.length > 0 && (
            <button onClick={exportCSV} className="btn btn-outline">
              <Download className="h-4 w-4 mr-2" /> Export
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-[#2C2C2E] p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('students')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
            activeTab === 'students'
              ? 'bg-white dark:bg-[#1C1C1E] text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-[#8E8E93] hover:text-gray-700 dark:hover:text-white'
          }`}
        >
          Students
        </button>
        <button
          onClick={() => setActiveTab('employees')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
            activeTab === 'employees'
              ? 'bg-white dark:bg-[#1C1C1E] text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-[#8E8E93] hover:text-gray-700 dark:hover:text-white'
          }`}
        >
          Employees
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <div className="loading-spinner" />
        </div>
      ) : activeTab === 'students' ? (
        <>
          {/* Total count */}
          <div className="card p-4 flex items-center gap-3">
            <XCircle className="h-5 w-5 text-red-500" />
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {absenteeData.totalAbsent} student{absenteeData.totalAbsent !== 1 ? 's' : ''} absent
            </span>
          </div>

          {absenteeData.grouped.length === 0 ? (
            <div className="card p-8 text-center">
              <Users className="h-10 w-10 text-green-500 mx-auto mb-2" />
              <p className="text-sm font-medium text-green-600 dark:text-green-400">No absentees for this date!</p>
              <p className="text-xs text-gray-500 dark:text-[#8E8E93] mt-1">All students were present or attendance hasn't been marked yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {absenteeData.grouped.map((group, gIdx) => (
                <div key={gIdx} className="card overflow-hidden">
                  <div className="px-4 py-3 bg-red-50/50 dark:bg-red-900/10 border-b border-gray-100 dark:border-[#38383A]">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      {group.className} ({group.students.length} absent)
                    </span>
                  </div>
                  <div className="divide-y divide-gray-100 dark:divide-dark-border">
                    {group.students.map((student, sIdx) => (
                      <div key={sIdx} className="px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
                            <span className="text-xs font-medium text-red-600">{student.studentName?.charAt(0)}</span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{student.studentName}</p>
                            <p className="text-xs text-gray-500 dark:text-[#8E8E93]">{student.admissionNumber}</p>
                          </div>
                        </div>
                        {student.phone && (
                          <a href={`tel:${student.phone}`} className="btn btn-sm btn-ghost">
                            <Phone className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {employeeAbsentees.length === 0 ? (
            <div className="card p-8 text-center">
              <Users className="h-10 w-10 text-green-500 mx-auto mb-2" />
              <p className="text-sm font-medium text-green-600 dark:text-green-400">No absent employees</p>
            </div>
          ) : (
            <div className="card overflow-hidden divide-y divide-gray-100 dark:divide-dark-border">
              {employeeAbsentees.map((emp, idx) => (
                <div key={idx} className="px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
                      <span className="text-xs font-medium text-red-600">{emp.name?.charAt(0)}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{emp.name}</p>
                      <p className="text-xs text-gray-500 dark:text-[#8E8E93]">{emp.department} - {emp.designation}</p>
                    </div>
                  </div>
                  {emp.phone && (
                    <a href={`tel:${emp.phone}`} className="btn btn-sm btn-ghost">
                      <Phone className="h-4 w-4" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default Absentees
