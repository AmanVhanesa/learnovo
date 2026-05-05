import React, { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Calendar, Clock, BookOpen, ChevronDown, ChevronRight, Plus,
  ClipboardList, BarChart3, Search, FileText, AlertCircle, Layers, X,
  CheckCircle2, MapPin, User
} from 'lucide-react'
import { examsService } from '../../services/examsService'
import { classesService } from '../../services/classesService'
import { subjectsService } from '../../services/subjectsService'
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
const STATUS_RING = {
  Scheduled: 'ring-1 ring-blue-200 dark:ring-blue-500/30',
  Ongoing: 'ring-1 ring-amber-200 dark:ring-amber-500/30',
  Completed: 'ring-1 ring-green-200 dark:ring-green-500/30',
  Cancelled: 'ring-1 ring-red-200 dark:ring-red-500/30',
}

const EXAM_SERIES = ['UT1', 'UT2', 'SA1', 'SA2', 'Custom']
const EXAM_TYPES = ['Written', 'Practical', 'Oral']
const EXAM_MODES = ['Offline', 'Online']

const SERIES_CONFIG = {
  UT1: { label: 'Unit Test 1', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10', border: 'border-blue-200 dark:border-blue-500/20' },
  SA1: { label: 'SA 1', color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-500/10', border: 'border-purple-200 dark:border-purple-500/20' },
  UT2: { label: 'Unit Test 2', color: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-50 dark:bg-teal-500/10', border: 'border-teal-200 dark:border-teal-500/20' },
  SA2: { label: 'SA 2', color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-500/10', border: 'border-orange-200 dark:border-orange-500/20' },
  Custom: { label: 'Custom', color: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-50 dark:bg-gray-500/10', border: 'border-gray-200 dark:border-gray-500/20' },
}

const SERIES_ORDER = ['UT1', 'SA1', 'UT2', 'SA2', 'Custom']
function seriesSortKey(s) { const idx = SERIES_ORDER.indexOf(s); return idx >= 0 ? idx : 999 }

function calcDuration(start, end) {
  if (!start || !end) return ''
  const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
  const diff = toMin(end) - toMin(start)
  if (diff <= 0) return ''
  const h = Math.floor(diff / 60)
  const m = diff % 60
  return h > 0 ? `${h}h ${m > 0 ? m + 'min' : ''}`.trim() : `${m} min`
}

const EMPTY_FORM = {
  name: '', examSeries: 'Midterm', class: '', classId: '', section: '',
  subject: '', date: '', startTime: '', endTime: '', totalMarks: 100,
  passingMarks: 40, examType: 'Written', examMode: 'Offline', examRoom: '',
}

const TeacherExams = () => {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState('schedule')
  const [selectedExam, setSelectedExam] = useState(null)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterClass, setFilterClass] = useState('')
  const [examSeriesFilter, setExamSeriesFilter] = useState('')
  const [searchText, setSearchText] = useState('')
  const [collapsedClasses, setCollapsedClasses] = useState(new Set())
  const [collapsedSeries, setCollapsedSeries] = useState(new Set())

  /* ── Create exam state ── */
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formErrors, setFormErrors] = useState({})

  const toggleClass = (cls) => setCollapsedClasses(prev => {
    const next = new Set(prev)
    next.has(cls) ? next.delete(cls) : next.add(cls)
    return next
  })
  const toggleSeries = (key) => setCollapsedSeries(prev => {
    const next = new Set(prev)
    next.has(key) ? next.delete(key) : next.add(key)
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

  // Fetch teacher's assignments
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

  // Fetch all classes for section resolution
  const { data: availableClasses = [] } = useQuery({
    queryKey: ['teacher-exams-all-classes'],
    queryFn: async () => {
      const res = await classesService.list()
      return res.data || []
    },
  })

  // Fetch all subjects
  const { data: allSubjects = [] } = useQuery({
    queryKey: ['teacher-exams-subjects'],
    queryFn: async () => {
      const res = await subjectsService.list()
      return res.data || []
    },
  })

  // Build Sets of subject names and class names/grades the teacher is assigned to
  // Include BOTH name and grade for classes since exams may use either
  const mySubjectNames = useMemo(() => {
    const names = new Set()
    myAssignments.forEach(a => {
      if (a.subjectId?.name) names.add(a.subjectId.name)
      if (a.subjectId?.subjectCode) names.add(a.subjectId.subjectCode)
    })
    return names
  }, [myAssignments])

  const myClassNames = useMemo(() => {
    const names = new Set()
    myClasses.forEach(c => {
      if (c.name) names.add(c.name)
      if (c.grade) names.add(c.grade)
    })
    // Also add class names/grades from teacher assignments
    myAssignments.forEach(a => {
      if (a.classId?.name) names.add(a.classId.name)
      if (a.classId?.grade) names.add(a.classId.grade)
    })
    return names
  }, [myClasses, myAssignments])

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

  // For marks entry tab: the backend already filters exams to the teacher's
  // assigned classes (via resolveTeacherClassNames which uses 4 allocation methods).
  // We only need to filter by status here and show all returned exams.
  const myExams = useMemo(() =>
    exams.filter(e =>
      e.status === 'Scheduled' || e.status === 'Ongoing' || e.status === 'Completed'
    ),
    [exams]
  )

  // Group exams by class then by exam series
  const groupedExams = useMemo(() => {
    const list = activeTab === 'marks' ? myExams : filteredExams
    const map = {}
    list.forEach(e => {
      const cls = e.class || 'Unknown'
      const series = e.examSeries || 'Custom'
      if (!map[cls]) map[cls] = {}
      if (!map[cls][series]) map[cls][series] = []
      map[cls][series].push(e)
    })
    // Sort
    const sorted = {}
    Object.keys(map).sort((a, b) => {
      const na = Number(a), nb = Number(b)
      if (!isNaN(na) && !isNaN(nb)) return na - nb
      return a.localeCompare(b)
    }).forEach(cls => {
      sorted[cls] = {}
      Object.keys(map[cls]).sort((a, b) => seriesSortKey(a) - seriesSortKey(b)).forEach(series => {
        sorted[cls][series] = map[cls][series].sort((a, b) => new Date(b.date) - new Date(a.date))
      })
    })
    return sorted
  }, [activeTab, filteredExams, myExams])

  // Stats
  const totalMyExams = myExams.length
  const scheduledCount = myExams.filter(e => e.status === 'Scheduled').length
  const completedCount = myExams.filter(e => e.status === 'Completed').length
  const upcomingExams = myExams.filter(e => e.status === 'Scheduled' && new Date(e.date) >= new Date()).sort((a, b) => new Date(a.date) - new Date(b.date))
  const classNamesInExams = [...new Set(filteredExams.map(e => e.class).filter(Boolean))]

  /* ── Create exam logic ── */
  const formSections = useMemo(() => {
    if (!form.classId) return []
    const cls = availableClasses.find(c => c._id === form.classId)
    return cls?.sections || []
  }, [form.classId, availableClasses])

  const formSubjects = useMemo(() => {
    if (form.classId) {
      const cls = availableClasses.find(c => c._id === form.classId)
      const assigned = (cls?.subjects || []).filter(s => s.subject).map(s => ({
        _id: s.subject._id || s.subject,
        name: s.subject.name || s.subject.subjectCode || s.subject
      }))
      if (assigned.length > 0) return assigned
    }
    return allSubjects.filter(s => s.isActive !== false).map(s => ({ _id: s._id, name: s.name }))
  }, [form.classId, availableClasses, allSubjects])

  // Only show teacher's assigned classes in the create form
  const teacherClasses = useMemo(() => {
    const filtered = availableClasses.filter(c =>
      myClassNames.has(c.grade) || myClassNames.has(c.name)
    )
    const seen = new Set()
    const unique = []
    for (const c of filtered) {
      const key = (c?.name || '').toString().trim().toLowerCase()
      if (!key || seen.has(key)) continue
      seen.add(key)
      unique.push(c)
    }
    return unique
  }, [availableClasses, myClassNames])

  const handleField = (key, value) => {
    setForm(prev => {
      const next = { ...prev, [key]: value }
      if (key === 'class') {
        const cls = availableClasses.find(c => c.grade === value)
        next.classId = cls ? cls._id : ''
        next.section = ''
        next.subject = ''
      }
      return next
    })
    setFormErrors(prev => { const n = { ...prev }; delete n[key]; return n })
  }

  const validate = () => {
    const errors = {}
    if (!form.name.trim()) errors.name = 'Exam name is required'
    if (!form.class) errors.class = 'Class is required'
    if (!form.subject.trim()) errors.subject = 'Subject is required'
    if (!form.date) errors.date = 'Exam date is required'
    if (!form.totalMarks) errors.totalMarks = 'Total marks is required'
    else if (Number(form.totalMarks) > 100) errors.totalMarks = 'Max 100'
    if (form.passingMarks !== '' && Number(form.passingMarks) >= Number(form.totalMarks)) {
      errors.passingMarks = 'Must be less than total'
    }
    return errors
  }

  const saveMutation = useMutation({
    mutationFn: (data) => examsService.create(data),
    onSuccess: () => {
      toast.success('Exam scheduled successfully')
      setShowCreateModal(false)
      setForm(EMPTY_FORM)
      setFormErrors({})
      queryClient.invalidateQueries({ queryKey: ['teacher-exams'] })
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || 'Failed to create exam')
    },
  })

  const handleCreate = (e) => {
    if (e) e.preventDefault()
    const errors = validate()
    if (Object.keys(errors).length) { setFormErrors(errors); return }
    saveMutation.mutate(form)
  }

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Exams & Results</h1>
          <p className="text-sm text-gray-500 dark:text-[#8E8E93] mt-1">
            View exam schedules, enter marks, and create exams for your classes
          </p>
        </div>
        <button className="btn btn-primary w-full sm:w-auto gap-2" onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4" />
          Create Exam
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'My Exams', value: totalMyExams, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-500/20', icon: BookOpen },
          { label: 'Scheduled', value: scheduledCount, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-500/20', icon: Calendar },
          { label: 'Completed', value: completedCount, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-500/20', icon: FileText },
          { label: 'Upcoming', value: upcomingExams.length, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-100 dark:bg-purple-500/20', icon: Clock },
        ].map((stat, i) => (
          <div key={i} className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass p-4 border border-gray-100 dark:border-[#38383A]">
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
                className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors whitespace-nowrap ${
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

      {/* ═══ Schedule Tab ═══ */}
      {activeTab === 'schedule' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass border border-gray-100 dark:border-[#38383A] p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-[#636366]" />
                <input type="text" placeholder="Search exams..." value={searchText} onChange={(e) => setSearchText(e.target.value)} className="w-full pl-10 pr-4 py-2 input" />
              </div>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-full sm:w-36 px-3 py-2 input">
                <option value="">All Status</option>
                <option value="Scheduled">Scheduled</option>
                <option value="Ongoing">Ongoing</option>
                <option value="Completed">Completed</option>
              </select>
              <select value={examSeriesFilter} onChange={(e) => setExamSeriesFilter(e.target.value)} className="w-full sm:w-36 px-3 py-2 input">
                <option value="">All Series</option>
                {EXAM_SERIES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={filterClass} onChange={(e) => setFilterClass(e.target.value)} className="w-full sm:w-36 px-3 py-2 input">
                <option value="">All Classes</option>
                {classNamesInExams.map(name => <option key={name} value={name}>{name}</option>)}
              </select>
            </div>
          </div>

          {/* Exam List — grouped by class then exam series */}
          {Object.keys(groupedExams).length === 0 ? (
            <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass border border-gray-100 dark:border-[#38383A] p-12 text-center">
              <Calendar className="h-12 w-12 text-gray-300 dark:text-[#636366] mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-600 dark:text-[#8E8E93]">No exams found</p>
            </div>
          ) : (
            Object.entries(groupedExams).map(([cls, seriesMap]) => (
              <div key={cls} className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass overflow-hidden border border-gray-100 dark:border-[#38383A]">
                <button
                  className="w-full flex items-center justify-between px-4 sm:px-6 py-3.5 bg-gray-50 dark:bg-[#2C2C2E] hover:bg-gray-100 dark:hover:bg-[#38383A] transition-colors border-b border-gray-200 dark:border-[#38383A]"
                  onClick={() => toggleClass(cls)}
                >
                  <div className="flex items-center gap-3">
                    {collapsedClasses.has(cls) ? <ChevronRight className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                    <h3 className="text-base font-bold text-gray-900 dark:text-white">Class {cls}</h3>
                    <span className="text-xs text-gray-500 dark:text-[#8E8E93] bg-gray-100 dark:bg-[#38383A] px-2.5 py-0.5 rounded-full">
                      {Object.values(seriesMap).reduce((a, arr) => a + arr.length, 0)} exams
                    </span>
                    {myClassNames.has(cls) && (
                      <span className="text-[10px] font-semibold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-500/10 px-2 py-0.5 rounded-full">
                        MY CLASS
                      </span>
                    )}
                  </div>
                </button>

                {!collapsedClasses.has(cls) && Object.entries(seriesMap).map(([series, examList]) => {
                  const seriesKey = `${cls}-${series}`
                  const isSeriesCollapsed = collapsedSeries.has(seriesKey)
                  const cfg = SERIES_CONFIG[series] || SERIES_CONFIG.Custom

                  return (
                    <div key={series}>
                      {/* Series sub-header */}
                      <button
                        className={`w-full flex items-center justify-between px-6 py-2 border-b ${cfg.border} ${cfg.bg} hover:opacity-90 transition-opacity`}
                        onClick={() => toggleSeries(seriesKey)}
                      >
                        <div className="flex items-center gap-2">
                          {isSeriesCollapsed ? <ChevronRight className={`h-3 w-3 ${cfg.color}`} /> : <ChevronDown className={`h-3 w-3 ${cfg.color}`} />}
                          <Layers className={`h-3.5 w-3.5 ${cfg.color}`} />
                          <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label || series}</span>
                          <span className="text-[10px] text-gray-400 dark:text-[#636366] bg-white/60 dark:bg-[#1C1C1E]/60 px-1.5 py-0.5 rounded-full">{examList.length}</span>
                        </div>
                      </button>

                      {!isSeriesCollapsed && (
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[700px]">
                            <thead>
                              <tr className="bg-gray-50/80 dark:bg-[#2C2C2E]/80">
                                <th className="text-left px-4 py-2.5 text-[11px] font-medium text-gray-500 uppercase tracking-wider">Exam</th>
                                <th className="text-left px-4 py-2.5 text-[11px] font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                                <th className="text-left px-4 py-2.5 text-[11px] font-medium text-gray-500 uppercase tracking-wider">Date & Time</th>
                                <th className="text-left px-4 py-2.5 text-[11px] font-medium text-gray-500 uppercase tracking-wider">Marks</th>
                                <th className="text-left px-4 py-2.5 text-[11px] font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="text-right px-4 py-2.5 text-[11px] font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 dark:divide-[#2C2C2E]">
                              {examList.map(exam => {
                                const isMySubject = mySubjectNames.has(exam.subject)
                                const duration = calcDuration(exam.startTime, exam.endTime)
                                return (
                                  <tr key={exam._id} className={`hover:bg-primary-50/40 dark:hover:bg-primary-500/5 ${isMySubject ? 'bg-primary-50/20 dark:bg-primary-500/5' : ''}`}>
                                    <td className="px-4 py-3">
                                      <p className="text-sm font-medium text-gray-900 dark:text-white">{exam.name}</p>
                                      <p className="text-xs text-gray-500 dark:text-[#8E8E93]">
                                        {exam.examType}{exam.section && ` · Sec ${exam.section}`}
                                      </p>
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-sm text-gray-700 dark:text-white">{exam.subject}</span>
                                        {isMySubject && <span className="text-[9px] font-bold text-primary-600 dark:text-primary-400">★</span>}
                                      </div>
                                    </td>
                                    <td className="px-4 py-3">
                                      <p className="text-sm text-gray-700 dark:text-[#8E8E93]">
                                        {exam.date ? new Date(exam.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                                      </p>
                                      {exam.startTime && (
                                        <p className="text-xs text-gray-500 dark:text-[#636366]">
                                          {exam.startTime}{exam.endTime ? ` — ${exam.endTime}` : ''}{duration && ` (${duration})`}
                                        </p>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-[#8E8E93]">
                                      {exam.totalMarks}{exam.passingMarks != null && <span className="text-xs text-gray-400 ml-1">pass: {exam.passingMarks}</span>}
                                    </td>
                                    <td className="px-4 py-3">
                                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${STATUS_COLORS[exam.status] || ''} ${STATUS_RING[exam.status] || ''}`}>
                                        {exam.status}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                      {(exam.status === 'Scheduled' || exam.status === 'Ongoing' || exam.status === 'Completed') && (
                                        <button
                                          onClick={() => setSelectedExam(exam)}
                                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-500/10 hover:bg-teal-100 dark:hover:bg-teal-500/20 transition-colors"
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
                      )}
                    </div>
                  )
                })}
              </div>
            ))
          )}
        </div>
      )}

      {/* ═══ Marks Entry Tab ═══ */}
      {activeTab === 'marks' && (
        <div className="space-y-4">
          <div className="bg-amber-50 dark:bg-[#332d1a] border border-amber-200 dark:border-[#5a4a2a] rounded-2xl p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Marks Entry</p>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                  Click "Enter Marks" on any exam below. Only your assigned subjects are shown.
                </p>
              </div>
            </div>
          </div>

          {myExams.length === 0 ? (
            <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass border border-gray-100 dark:border-[#38383A] p-12 text-center">
              <ClipboardList className="h-12 w-12 text-gray-300 dark:text-[#636366] mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-600 dark:text-[#8E8E93]">No exams for your subjects</p>
              <p className="text-sm text-gray-500 dark:text-[#636366] mt-1">Exams for your assigned subjects will appear here.</p>
            </div>
          ) : (
            Object.entries(groupedExams).map(([cls, seriesMap]) => (
              <div key={cls} className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-[#8E8E93] px-1">Class {cls}</h3>
                {Object.entries(seriesMap).map(([series, examList]) => {
                  const cfg = SERIES_CONFIG[series] || SERIES_CONFIG.Custom
                  return (
                    <div key={series} className="space-y-2">
                      <div className={`flex items-center gap-2 px-2 py-1.5 rounded-lg ${cfg.bg}`}>
                        <Layers className={`h-3.5 w-3.5 ${cfg.color}`} />
                        <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label || series}</span>
                      </div>
                      {examList.map(exam => {
                        const duration = calcDuration(exam.startTime, exam.endTime)
                        return (
                          <div key={exam._id} className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass border border-gray-200 dark:border-[#38383A] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{exam.name}</h4>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-semibold ${STATUS_COLORS[exam.status] || ''} ${STATUS_RING[exam.status] || ''}`}>
                                  {exam.status}
                                </span>
                              </div>
                              <p className="text-xs text-gray-600 dark:text-[#8E8E93]">
                                {exam.subject} · Class {exam.class}{exam.section ? ` - Sec ${exam.section}` : ''}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-[#636366] mt-0.5">
                                {exam.date ? new Date(exam.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                                {exam.startTime && ` at ${exam.startTime}`}{duration && ` (${duration})`}
                                &nbsp;·&nbsp; Max: {exam.totalMarks}
                              </p>
                            </div>
                            <button onClick={() => setSelectedExam(exam)} className="btn btn-primary flex items-center gap-2 w-full sm:w-auto justify-center">
                              <ClipboardList className="h-4 w-4" />
                              Enter Marks
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            ))
          )}
        </div>
      )}

      {/* ═══ Results Overview Tab ═══ */}
      {activeTab === 'results' && (
        <div className="space-y-4">
          {myExams.filter(e => e.status === 'Completed').length === 0 ? (
            <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass border border-gray-100 dark:border-[#38383A] p-12 text-center">
              <BarChart3 className="h-12 w-12 text-gray-300 dark:text-[#636366] mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-600 dark:text-[#8E8E93]">No completed exams</p>
              <p className="text-sm text-gray-500 dark:text-[#636366] mt-1">Results for completed exams will appear here.</p>
            </div>
          ) : (
            myExams.filter(e => e.status === 'Completed').map(exam => (
              <div key={exam._id} className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass border border-gray-200 dark:border-[#38383A] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{exam.name}</h3>
                  <p className="text-xs text-gray-600 dark:text-[#8E8E93]">
                    {exam.subject} · Class {exam.class}{exam.section ? ` - Sec ${exam.section}` : ''} · {exam.examSeries}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-[#636366] mt-0.5">
                    {exam.date ? new Date(exam.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                    &nbsp;·&nbsp; Max: {exam.totalMarks}
                  </p>
                </div>
                <button onClick={() => setSelectedExam(exam)} className="btn bg-gray-100 dark:bg-[#2C2C2E] text-gray-700 dark:text-[#8E8E93] hover:bg-gray-200 dark:hover:bg-[#38383A] border border-gray-200 dark:border-[#38383A] flex items-center gap-2 w-full sm:w-auto justify-center">
                  <BarChart3 className="h-4 w-4" />
                  View Results
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* Results Modal */}
      {selectedExam && <ExamResultsModal exam={selectedExam} onClose={() => setSelectedExam(null)} />}

      {/* ═══ Create Exam Modal ═══ */}
      {showCreateModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-2xl w-full max-w-2xl mx-2 sm:mx-4 max-h-[92vh] flex flex-col">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-[#38383A] shrink-0">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Create Exam</h3>
                <p className="text-xs text-gray-400 dark:text-[#636366] mt-0.5">Schedule an exam for your assigned classes</p>
              </div>
              <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-[#2C2C2E]" onClick={() => { setShowCreateModal(false); setForm(EMPTY_FORM); setFormErrors({}) }}>
                <X className="h-5 w-5 text-gray-500 dark:text-[#8E8E93]" />
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleCreate} className="overflow-y-auto flex-1 px-4 sm:px-6 py-5 space-y-5">

              {/* Exam Pattern */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Layers className="h-4 w-4 text-primary-600 dark:text-primary-400" />
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-[#8E8E93] uppercase tracking-wide">Exam Pattern</h4>
                </div>
                <div className="pl-6 border-l-2 border-gray-100 dark:border-[#38383A]">
                  <p className="text-xs text-gray-400 dark:text-[#636366] mb-3">Select which examination pattern this belongs to</p>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {EXAM_SERIES.map(series => {
                      const cfg = SERIES_CONFIG[series] || SERIES_CONFIG.Custom
                      const isSelected = form.examSeries === series
                      return (
                        <button key={series} type="button" onClick={() => handleField('examSeries', series)}
                          className={`px-3 py-2.5 rounded-xl text-xs font-semibold border-2 transition-all ${
                            isSelected
                              ? `${cfg.bg} ${cfg.color} ${cfg.border} ring-2 ring-offset-1 ring-primary-500/30 shadow-sm`
                              : 'border-gray-200 dark:border-[#38383A] text-gray-500 dark:text-[#8E8E93] hover:border-gray-300 bg-white dark:bg-[#2C2C2E]'
                          }`}
                        >{cfg.label || series}</button>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Exam Details */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <BookOpen className="h-4 w-4 text-primary-600 dark:text-primary-400" />
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-[#8E8E93] uppercase tracking-wide">Details</h4>
                </div>
                <div className="pl-6 border-l-2 border-gray-100 dark:border-[#38383A] space-y-4">
                  <div>
                    <label className="label mb-1 block text-gray-700 dark:text-[#8E8E93]">Exam Name <span className="text-red-500">*</span></label>
                    <input className={`input ${formErrors.name ? 'border-red-400' : ''}`} placeholder={`e.g. ${form.examSeries} Physics`} value={form.name} onChange={e => handleField('name', e.target.value)} />
                    {formErrors.name && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> {formErrors.name}</p>}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="label mb-1 block text-gray-700 dark:text-[#8E8E93]">Class <span className="text-red-500">*</span></label>
                      <select className={`input w-full ${formErrors.class ? 'border-red-400' : ''}`} value={form.class} onChange={e => handleField('class', e.target.value)}>
                        <option value="">Select Class</option>
                        {teacherClasses.map(cls => <option key={cls._id} value={cls.grade}>{cls.name}</option>)}
                      </select>
                      {formErrors.class && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> {formErrors.class}</p>}
                    </div>
                    <div>
                      <label className="label mb-1 block text-gray-700 dark:text-[#8E8E93]">Section</label>
                      <select className="input w-full" value={form.section} onChange={e => handleField('section', e.target.value)} disabled={!form.classId}>
                        <option value="">All Sections</option>
                        {formSections.map(s => <option key={s._id} value={s.name}>Section {s.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label mb-1 block text-gray-700 dark:text-[#8E8E93]">Subject <span className="text-red-500">*</span></label>
                      <select className={`input w-full ${formErrors.subject ? 'border-red-400' : ''}`} value={form.subject} onChange={e => handleField('subject', e.target.value)}>
                        <option value="">Select Subject</option>
                        {formSubjects.map(s => <option key={s._id} value={typeof s.name === 'string' ? s.name : String(s.name)}>{typeof s.name === 'string' ? s.name : String(s.name)}</option>)}
                      </select>
                      {formErrors.subject && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> {formErrors.subject}</p>}
                    </div>
                  </div>
                </div>
              </div>

              {/* Schedule & Marks */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="h-4 w-4 text-primary-600 dark:text-primary-400" />
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-[#8E8E93] uppercase tracking-wide">Schedule & Marks</h4>
                </div>
                <div className="pl-6 border-l-2 border-gray-100 dark:border-[#38383A] space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="col-span-2">
                      <label className="label mb-1 block text-gray-700 dark:text-[#8E8E93]">Exam Date <span className="text-red-500">*</span></label>
                      <input type="date" className={`input w-full ${formErrors.date ? 'border-red-400' : ''}`} value={form.date} onChange={e => handleField('date', e.target.value)} />
                      {formErrors.date && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> {formErrors.date}</p>}
                    </div>
                    <div>
                      <label className="label mb-1 block text-gray-700 dark:text-[#8E8E93]">Start Time</label>
                      <input type="time" className="input w-full" value={form.startTime} onChange={e => handleField('startTime', e.target.value)} />
                    </div>
                    <div>
                      <label className="label mb-1 block text-gray-700 dark:text-[#8E8E93]">End Time</label>
                      <input type="time" className="input w-full" value={form.endTime} onChange={e => handleField('endTime', e.target.value)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label mb-1 block text-gray-700 dark:text-[#8E8E93]">Total Marks <span className="text-red-500">*</span></label>
                      <input type="number" min="1" max="100" className={`input ${formErrors.totalMarks ? 'border-red-400' : ''}`} value={form.totalMarks} onChange={e => handleField('totalMarks', e.target.value)} />
                      {formErrors.totalMarks && <p className="mt-1 text-xs text-red-500">{formErrors.totalMarks}</p>}
                    </div>
                    <div>
                      <label className="label mb-1 block text-gray-700 dark:text-[#8E8E93]">Passing Marks</label>
                      <input type="number" min="0" className={`input ${formErrors.passingMarks ? 'border-red-400' : ''}`} value={form.passingMarks} onChange={e => handleField('passingMarks', e.target.value)} />
                      {formErrors.passingMarks && <p className="mt-1 text-xs text-red-500">{formErrors.passingMarks}</p>}
                    </div>
                  </div>
                </div>
              </div>
            </form>

            {/* Footer */}
            <div className="px-4 sm:px-6 py-4 border-t border-gray-100 dark:border-[#38383A] shrink-0 flex flex-col-reverse sm:flex-row justify-end gap-3 bg-gray-50 dark:bg-[#2C2C2E] rounded-b-2xl">
              <button type="button" className="btn btn-ghost w-full sm:w-auto" onClick={() => { setShowCreateModal(false); setForm(EMPTY_FORM); setFormErrors({}) }}>Cancel</button>
              <button onClick={handleCreate} disabled={saveMutation.isPending} className="btn btn-primary w-full sm:w-auto">
                {saveMutation.isPending ? 'Scheduling…' : 'Schedule Exam'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TeacherExams
