import React, { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Calendar, Clock, BookOpen, ChevronDown, ChevronRight,
  ClipboardList, BarChart3, Search, FileText, AlertCircle
} from 'lucide-react'
import { examsService } from '../../services/examsService'
import { attendanceService } from '../../services/attendanceService'
import { teacherAssignmentsService } from '../../services/academicsService'
import ExamResultsModal from '../../components/ExamResultsModal'
import { useAuth } from '../../contexts/AuthContext'
import toast from 'react-hot-toast'

const STATUS_COLORS = {
  Scheduled: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
  Ongoing: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
  Completed: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400',
  Cancelled: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400',
}

const EXAM_SERIES = ['Unit Test', 'Midterm', 'Final', 'Custom']

function calcDuration(start, end) {
  if (!start || !end) return ''
  const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
  const diff = toMin(end) - toMin(start)
  if (diff <= 0) return ''
  const h = Math.floor(diff / 60)
  const m = diff % 60
  return h > 0 ? `${h}h ${m > 0 ? m + 'min' : ''}`.trim() : `${m} min`
}

const TeacherExams = () => {
  const { user } = useAuth()

  const [activeTab, setActiveTab] = useState('schedule')
  const [selectedExam, setSelectedExam] = useState(null)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterClass, setFilterClass] = useState('')
  const [examSeriesFilter, setExamSeriesFilter] = useState('')
  const [searchText, setSearchText] = useState('')
  const [collapsedClasses, setCollapsedClasses] = useState(new Set())

  const toggleClass = (cls) => setCollapsedClasses(prev => {
    const next = new Set(prev)
    next.has(cls) ? next.delete(cls) : next.add(cls)
    return next
  })

  // Fetch all exams
  const { data: exams = [], isLoading } = useQuery({
    queryKey: ['teacher-exams'],
    queryFn: async () => {
      const res = await examsService.list()
      return res.data || []
    },
  })

  // Fetch teacher's assignments to know which subjects/classes are mine
  const { data: myAssignments = [] } = useQuery({
    queryKey: ['teacher-exam-assignments', user?._id],
    queryFn: async () => {
      const res = await teacherAssignmentsService.list({ teacherId: user._id })
      return res.data || []
    },
    enabled: !!user?._id,
  })

  // Fetch teacher's classes
  const { data: myClasses = [] } = useQuery({
    queryKey: ['teacher-exam-classes'],
    queryFn: async () => {
      const res = await attendanceService.getTeacherClasses()
      return res?.data || []
    },
  })

  const mySubjectNames = new Set(myAssignments.map(a => a.subjectId?.name).filter(Boolean))
  const myClassNames = new Set(myClasses.map(c => c.name || c.grade).filter(Boolean))

  // Filter exams based on filters
  const filteredExams = useMemo(() => exams.filter(e => {
    if (filterStatus && e.status !== filterStatus) return false
    if (filterClass && e.class !== filterClass) return false
    if (examSeriesFilter && e.examSeries !== examSeriesFilter) return false
    if (searchText) {
      const q = searchText.toLowerCase()
      return (e.name || '').toLowerCase().includes(q) ||
        (e.subject || '').toLowerCase().includes(q)
    }
    return true
  }), [exams, filterStatus, filterClass, examSeriesFilter, searchText])

  // For marks entry tab, show only exams for my subjects/classes
  const myExams = useMemo(() =>
    exams.filter(e =>
      (mySubjectNames.has(e.subject) || myClassNames.has(e.class)) &&
      (e.status === 'Scheduled' || e.status === 'Ongoing' || e.status === 'Completed')
    ),
    [exams, mySubjectNames, myClassNames]
  )

  // Group exams by class
  const groupedExams = useMemo(() => {
    const list = activeTab === 'marks' ? myExams : filteredExams
    const map = {}
    list.forEach(e => {
      const cls = e.class || 'Unknown'
      if (!map[cls]) map[cls] = []
      map[cls].push(e)
    })
    Object.values(map).forEach(arr => arr.sort((a, b) => new Date(b.date) - new Date(a.date)))
    return map
  }, [activeTab, filteredExams, myExams])

  // Stats for my exams
  const totalMyExams = myExams.length
  const scheduledCount = myExams.filter(e => e.status === 'Scheduled').length
  const completedCount = myExams.filter(e => e.status === 'Completed').length
  const upcomingExams = myExams.filter(e => e.status === 'Scheduled' && new Date(e.date) >= new Date()).sort((a, b) => new Date(a.date) - new Date(b.date))

  const classNamesInExams = [...new Set(filteredExams.map(e => e.class).filter(Boolean))]

  const tabs = [
    { id: 'schedule', label: 'Exam Schedule', icon: Calendar },
    { id: 'marks', label: 'Enter Marks', icon: ClipboardList },
    { id: 'results', label: 'Results Overview', icon: BarChart3 },
  ]

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading-spinner" />
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Exams & Results</h1>
        <p className="text-sm text-gray-500 dark:text-[#8E8E93] mt-1">
          View exam schedules and enter marks for your subjects
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'My Exams', value: totalMyExams, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-500/20', icon: BookOpen },
          { label: 'Scheduled', value: scheduledCount, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-500/20', icon: Calendar },
          { label: 'Completed', value: completedCount, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-500/20', icon: FileText },
          { label: 'Upcoming', value: upcomingExams.length, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-100 dark:bg-purple-500/20', icon: Clock },
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
      {activeTab === 'schedule' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-[#636366]" />
                <input
                  type="text"
                  placeholder="Search exams..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 input"
                />
              </div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full sm:w-36 px-3 py-2 input"
              >
                <option value="">All Status</option>
                <option value="Scheduled">Scheduled</option>
                <option value="Ongoing">Ongoing</option>
                <option value="Completed">Completed</option>
              </select>
              <select
                value={examSeriesFilter}
                onChange={(e) => setExamSeriesFilter(e.target.value)}
                className="w-full sm:w-36 px-3 py-2 input"
              >
                <option value="">All Series</option>
                {EXAM_SERIES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select
                value={filterClass}
                onChange={(e) => setFilterClass(e.target.value)}
                className="w-full sm:w-36 px-3 py-2 input"
              >
                <option value="">All Classes</option>
                {classNamesInExams.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Exam List — grouped by class */}
          {Object.keys(groupedExams).length === 0 ? (
            <div className="card p-12 text-center">
              <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-600 dark:text-[#8E8E93]">No exams found</p>
            </div>
          ) : (
            Object.entries(groupedExams).map(([cls, examsInClass]) => (
              <div key={cls} className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass overflow-hidden dark:border dark:border-[#38383A]">
                <button
                  className="w-full flex items-center justify-between px-4 sm:px-6 py-4 hover:bg-gray-50 dark:hover:bg-[#2C2C2E] transition-colors"
                  onClick={() => toggleClass(cls)}
                >
                  <div className="flex items-center gap-3">
                    {collapsedClasses.has(cls) ? <ChevronRight className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">Class {cls}</h3>
                    <span className="text-xs text-gray-500 dark:text-[#8E8E93] bg-gray-100 dark:bg-[#2C2C2E] px-2 py-0.5 rounded-full">
                      {examsInClass.length} exams
                    </span>
                    {myClassNames.has(cls) && (
                      <span className="text-[10px] font-semibold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-500/10 px-2 py-0.5 rounded-full">
                        MY CLASS
                      </span>
                    )}
                  </div>
                </button>
                {!collapsedClasses.has(cls) && (
                  <div className="border-t border-gray-200 dark:border-[#38383A]">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[700px]">
                        <thead>
                          <tr className="bg-gray-50/80 dark:bg-[#2C2C2E]">
                            <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Exam</th>
                            <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Subject</th>
                            <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Date & Time</th>
                            <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Marks</th>
                            <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-[#2C2C2E]">
                          {examsInClass.map(exam => {
                            const isMySubject = mySubjectNames.has(exam.subject)
                            const duration = calcDuration(exam.startTime, exam.endTime)
                            return (
                              <tr key={exam._id} className={`hover:bg-primary-50 dark:hover:bg-[#2C2C2E] ${isMySubject ? 'bg-primary-50/30 dark:bg-primary-500/5' : ''}`}>
                                <td className="px-4 py-3">
                                  <div>
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">{exam.name}</p>
                                    <p className="text-xs text-gray-500 dark:text-[#8E8E93]">
                                      {exam.examSeries} &middot; {exam.examType}
                                      {exam.section && ` &middot; Sec ${exam.section}`}
                                    </p>
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-sm text-gray-700 dark:text-white">{exam.subject}</span>
                                    {isMySubject && (
                                      <span className="text-[9px] font-bold text-primary-600 dark:text-primary-400">★</span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <p className="text-sm text-gray-700 dark:text-[#8E8E93]">
                                    {exam.date ? new Date(exam.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                                  </p>
                                  {exam.startTime && (
                                    <p className="text-xs text-gray-500 dark:text-[#636366]">
                                      {exam.startTime}{exam.endTime ? ` — ${exam.endTime}` : ''}
                                      {duration && ` (${duration})`}
                                    </p>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-700 dark:text-[#8E8E93]">
                                  {exam.totalMarks} / {exam.passingMarks ?? Math.ceil(exam.totalMarks * 0.4)}
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${STATUS_COLORS[exam.status] || ''}`}>
                                    {exam.status}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  {isMySubject && (exam.status === 'Scheduled' || exam.status === 'Ongoing' || exam.status === 'Completed') && (
                                    <button
                                      onClick={() => setSelectedExam(exam)}
                                      className="btn btn-sm btn-primary flex items-center gap-1"
                                    >
                                      <ClipboardList className="h-3.5 w-3.5" />
                                      Marks
                                    </button>
                                  )}
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
            ))
          )}
        </div>
      )}

      {/* Marks Entry Tab */}
      {activeTab === 'marks' && (
        <div className="space-y-4">
          <div className="bg-amber-50 dark:bg-[#332d1a] border border-amber-200 dark:border-[#5a4a2a] rounded-2xl p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Marks Entry</p>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                  Click "Enter Marks" on any exam below to open the marks entry form. Only your assigned subjects are shown.
                </p>
              </div>
            </div>
          </div>

          {myExams.length === 0 ? (
            <div className="card p-12 text-center">
              <ClipboardList className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-600 dark:text-[#8E8E93]">No exams for your subjects</p>
              <p className="text-sm text-gray-500 dark:text-[#636366] mt-1">Exams for your assigned subjects will appear here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {myExams.map(exam => {
                const duration = calcDuration(exam.startTime, exam.endTime)
                return (
                  <div
                    key={exam._id}
                    className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass border border-gray-200 dark:border-[#38383A] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{exam.name}</h3>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-semibold ${STATUS_COLORS[exam.status] || ''}`}>
                          {exam.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-[#8E8E93]">
                        {exam.subject} &middot; Class {exam.class}{exam.section ? ` - Sec ${exam.section}` : ''} &middot; {exam.examSeries}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-[#636366] mt-0.5">
                        {exam.date ? new Date(exam.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                        {exam.startTime && ` at ${exam.startTime}`}
                        {duration && ` (${duration})`}
                        &nbsp;&middot;&nbsp; Max: {exam.totalMarks}
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedExam(exam)}
                      className="btn btn-primary flex items-center gap-2 w-full sm:w-auto justify-center"
                    >
                      <ClipboardList className="h-4 w-4" />
                      Enter Marks
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Results Overview Tab */}
      {activeTab === 'results' && (
        <div className="space-y-4">
          {myExams.filter(e => e.status === 'Completed').length === 0 ? (
            <div className="card p-12 text-center">
              <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-600 dark:text-[#8E8E93]">No completed exams</p>
              <p className="text-sm text-gray-500 dark:text-[#636366] mt-1">Results for completed exams will appear here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {myExams.filter(e => e.status === 'Completed').map(exam => (
                <div
                  key={exam._id}
                  className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass border border-gray-200 dark:border-[#38383A] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{exam.name}</h3>
                    <p className="text-xs text-gray-600 dark:text-[#8E8E93]">
                      {exam.subject} &middot; Class {exam.class}{exam.section ? ` - Sec ${exam.section}` : ''} &middot; {exam.examSeries}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-[#636366] mt-0.5">
                      {exam.date ? new Date(exam.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                      &nbsp;&middot;&nbsp; Max: {exam.totalMarks}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedExam(exam)}
                    className="btn btn-outline flex items-center gap-2 w-full sm:w-auto justify-center"
                  >
                    <BarChart3 className="h-4 w-4" />
                    View Results
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Results Modal */}
      {selectedExam && (
        <ExamResultsModal
          exam={selectedExam}
          onClose={() => setSelectedExam(null)}
        />
      )}
    </div>
  )
}

export default TeacherExams
