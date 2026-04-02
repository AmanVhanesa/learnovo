import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  TrendingUp, TrendingDown, Users, Search, Hash,
  CheckSquare, Square, AlertTriangle, GraduationCap, Loader2, ArrowRightLeft,
  UserSearch, X, ChevronRight, ArrowUpRight, ArrowDownRight
} from 'lucide-react'
import { transitionsService } from '../services/transitionsService'
import AcademicTransitionNav from '../components/AcademicTransitionNav'
import { studentsService } from '../services/studentsService'
import { sortClasses, getNextClass, getPreviousClass } from '../utils/classOrder'

export default function PromotionDashboard() {
  const queryClient = useQueryClient()

  // State
  const [activeTab, setActiveTab] = useState('promote') // promote | demote | individual
  const [sourceClass, setSourceClass] = useState('')
  const [sourceSection, setSourceSection] = useState('')
  const [targetClass, setTargetClass] = useState('')
  const [targetSection, setTargetSection] = useState('')
  const [academicYear, setAcademicYear] = useState(() => {
    const y = new Date().getFullYear()
    const m = new Date().getMonth()
    return m < 3 ? `${y}-${y + 1}` : `${y + 1}-${y + 2}`
  })
  const [remarks, setRemarks] = useState('')
  const [forceOverride, setForceOverride] = useState(false)
  const [excludedStudents, setExcludedStudents] = useState(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  const [results, setResults] = useState(null)

  // Individual action state
  const [individualStudent, setIndividualStudent] = useState(null)
  const [individualAction, setIndividualAction] = useState('promote')
  const [individualTargetClass, setIndividualTargetClass] = useState('')
  const [individualTargetSection, setIndividualTargetSection] = useState('')
  const [individualReason, setIndividualReason] = useState('')

  // Individual search state (admission number / name search)
  const [individualSearchMode, setIndividualSearchMode] = useState('search') // search | class
  const [admissionSearch, setAdmissionSearch] = useState('')
  const [debouncedAdmissionSearch, setDebouncedAdmissionSearch] = useState('')
  const searchTimerRef = useRef(null)

  // Debounce admission search
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      setDebouncedAdmissionSearch(admissionSearch)
    }, 400)
    return () => clearTimeout(searchTimerRef.current)
  }, [admissionSearch])

  // Queries
  const { data: filtersData } = useQuery({
    queryKey: ['student-filters'],
    queryFn: () => studentsService.getFilters()
  })

  // Per-class sections for source
  const { data: sourceSectionsData } = useQuery({
    queryKey: ['class-sections', sourceClass],
    queryFn: () => transitionsService.getSectionsForClass(sourceClass),
    enabled: !!sourceClass
  })

  // Per-class sections for target
  const { data: targetSectionsData } = useQuery({
    queryKey: ['class-sections', targetClass],
    queryFn: () => transitionsService.getSectionsForClass(targetClass),
    enabled: !!targetClass && targetClass !== 'GRADUATED'
  })

  // Students for bulk tabs (class-based)
  const { data: studentsData, isLoading: loadingStudents } = useQuery({
    queryKey: ['students-for-promotion', sourceClass, sourceSection],
    queryFn: () => studentsService.list({
      class: sourceClass,
      section: sourceSection || undefined,
      status: 'active',
      limit: 500,
      lightweight: true
    }),
    enabled: !!sourceClass && activeTab !== 'individual'
  })

  // Students for individual tab — class browse mode
  const { data: individualClassStudents, isLoading: loadingIndividualClassStudents } = useQuery({
    queryKey: ['students-for-individual', sourceClass, sourceSection],
    queryFn: () => studentsService.list({
      class: sourceClass,
      section: sourceSection || undefined,
      status: 'active',
      limit: 500,
      lightweight: true
    }),
    enabled: !!sourceClass && activeTab === 'individual' && individualSearchMode === 'class'
  })

  // Students for individual tab — admission search mode
  const { data: admissionSearchResults, isLoading: loadingAdmissionSearch } = useQuery({
    queryKey: ['admission-search', debouncedAdmissionSearch],
    queryFn: () => studentsService.list({
      search: debouncedAdmissionSearch,
      status: 'active',
      limit: 20
    }),
    enabled: activeTab === 'individual' && individualSearchMode === 'search' && debouncedAdmissionSearch.length >= 2
  })

  const rawClasses = filtersData?.data?.classes || filtersData?.classes || []
  const classes = useMemo(() => sortClasses(rawClasses), [rawClasses])
  const sourceSections = (sourceSectionsData?.data || []).map(s => s.name)
  const targetSections = (targetSectionsData?.data || []).map(s => s.name)
  const students = studentsData?.data || studentsData?.students || []

  // Get the correct student list for the individual tab
  const individualStudentsList = useMemo(() => {
    if (individualSearchMode === 'search') {
      return admissionSearchResults?.data || admissionSearchResults?.students || []
    }
    return individualClassStudents?.data || individualClassStudents?.students || []
  }, [individualSearchMode, admissionSearchResults, individualClassStudents])

  // Auto-suggest next/previous class
  useEffect(() => {
    if (sourceClass && classes.length > 0) {
      if (activeTab === 'promote') {
        const next = getNextClass(sourceClass, classes)
        setTargetClass(next || 'GRADUATED')
      } else if (activeTab === 'demote') {
        const prev = getPreviousClass(sourceClass, classes)
        setTargetClass(prev || '')
      }
    }
  }, [sourceClass, classes, activeTab])

  // Filter students by search (for bulk tabs)
  const filteredStudents = useMemo(() => {
    if (!searchQuery) return students
    const q = searchQuery.toLowerCase()
    return students.filter(s =>
      (s.name || '').toLowerCase().includes(q) ||
      (s.firstName || '').toLowerCase().includes(q) ||
      (s.lastName || '').toLowerCase().includes(q) ||
      (s.admissionNumber || '').toLowerCase().includes(q) ||
      (s.rollNumber || '').toLowerCase().includes(q)
    )
  }, [students, searchQuery])

  // Count of students to be promoted (excluding excluded)
  const promotionCount = filteredStudents.length - excludedStudents.size

  const toggleExclude = (id) => {
    const next = new Set(excludedStudents)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setExcludedStudents(next)
  }

  // Mutations
  const bulkPromoteMutation = useMutation({
    mutationFn: (payload) => transitionsService.bulkPromote(payload),
    onSuccess: (data) => {
      setResults(data.data)
      setShowConfirm(false)
      queryClient.invalidateQueries({ queryKey: ['students-for-promotion'] })
      queryClient.invalidateQueries({ queryKey: ['student-filters'] })
      queryClient.invalidateQueries({ queryKey: ['class-sections'] })
      const d = data.data
      toast.success(`Complete: ${d.promoted} promoted, ${d.graduated} graduated, ${d.skipped} skipped`)
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || error.response?.data?.errors?.[0] || 'Operation failed')
    }
  })

  const individualMutation = useMutation({
    mutationFn: ({ studentId, action, ...payload }) => {
      if (action === 'promote') return transitionsService.promoteStudent(studentId, payload)
      if (action === 'demote') return transitionsService.demoteStudent(studentId, payload)
      if (action === 'shift') return transitionsService.shiftSection(studentId, payload)
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Action completed')
      setIndividualStudent(null)
      setIndividualReason('')
      setIndividualTargetClass('')
      setIndividualTargetSection('')
      queryClient.invalidateQueries({ queryKey: ['students-for-promotion'] })
      queryClient.invalidateQueries({ queryKey: ['students-for-individual'] })
      queryClient.invalidateQueries({ queryKey: ['admission-search'] })
      queryClient.invalidateQueries({ queryKey: ['class-sections'] })
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || error.response?.data?.errors?.[0] || 'Action failed')
    }
  })

  const handleBulkAction = () => {
    bulkPromoteMutation.mutate({
      fromClass: sourceClass,
      fromSection: sourceSection || undefined,
      toClass: targetClass !== 'GRADUATED' ? targetClass : undefined,
      toSection: targetSection || undefined,
      academicYear,
      excludeStudents: Array.from(excludedStudents),
      forceOverride,
      remarks
    })
  }

  const handleIndividualAction = () => {
    if (!individualStudent) return
    const payload = { studentId: individualStudent._id, action: individualAction }
    if (individualAction === 'promote') {
      payload.toClass = individualTargetClass || undefined
      payload.toSection = individualTargetSection || undefined
      payload.academicYear = academicYear
      payload.remarks = individualReason || remarks
      payload.forceOverride = forceOverride
    } else if (individualAction === 'demote') {
      payload.toClass = individualTargetClass
      payload.toSection = individualTargetSection || undefined
      payload.academicYear = academicYear
      payload.reason = individualReason
      payload.forceOverride = forceOverride
    } else if (individualAction === 'shift') {
      payload.toSection = individualTargetSection
      payload.reason = individualReason
    }
    individualMutation.mutate(payload)
  }

  const openIndividualModal = useCallback((student, action) => {
    setIndividualStudent(student)
    setIndividualAction(action)
    setIndividualReason('')
    if (action === 'promote') {
      setIndividualTargetClass(getNextClass(student.class, classes) || '')
      setIndividualTargetSection('')
    } else if (action === 'demote') {
      setIndividualTargetClass('')
      setIndividualTargetSection('')
    } else {
      setIndividualTargetSection('')
    }
  }, [classes])

  // Classes available as demotion targets (below source)
  const demotionClasses = useMemo(() => {
    if (!sourceClass) return classes
    const sorted = sortClasses(classes)
    const idx = sorted.findIndex(c => c === sourceClass)
    return idx > 0 ? sorted.slice(0, idx) : []
  }, [sourceClass, classes])

  // Individual target sections — fetch for selected student's target class
  const { data: individualTargetSectionsData } = useQuery({
    queryKey: ['class-sections', individualTargetClass],
    queryFn: () => transitionsService.getSectionsForClass(individualTargetClass),
    enabled: !!individualTargetClass && individualTargetClass !== 'GRADUATED' && !!individualStudent
  })
  const individualTargetSections = (individualTargetSectionsData?.data || []).map(s => s.name)

  // Individual student's same-class sections (for shift)
  const { data: individualShiftSectionsData } = useQuery({
    queryKey: ['class-sections', individualStudent?.class],
    queryFn: () => transitionsService.getSectionsForClass(individualStudent?.class),
    enabled: !!individualStudent?.class && individualAction === 'shift'
  })
  const individualShiftSections = (individualShiftSectionsData?.data || []).map(s => s.name)

  // Helper to get display name
  const getDisplayName = (student) => student.name || `${student.firstName || ''} ${student.lastName || ''}`.trim() || '-'

  return (
    <div className="space-y-6">
      {/* Sub-nav */}
      <AcademicTransitionNav />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Promotion Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-[#8E8E93] mt-1">Promote, demote, or manage individual student transitions</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-[#2C2C2E] rounded-xl w-fit">
        {[
          { key: 'promote', label: 'Bulk Promote', icon: TrendingUp },
          { key: 'demote', label: 'Bulk Demote', icon: TrendingDown },
          { key: 'individual', label: 'Individual Action', icon: UserSearch }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setResults(null); setExcludedStudents(new Set()) }}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === tab.key
                ? 'bg-white dark:bg-[#3A3A3C] text-teal-600 dark:text-teal-400 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ======================= BULK PROMOTE / DEMOTE TABS ======================= */}
      {activeTab !== 'individual' && (
        <>
          {/* Configuration Panel */}
          <div className="bg-white dark:bg-[#1C1C1E] rounded-xl shadow-sm border border-gray-200 dark:border-[#38383A] p-5 sm:p-6">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
              {activeTab === 'promote' ? 'Promotion Configuration' : 'Demotion Configuration'}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Source Class */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">Source Class</label>
                <select
                  value={sourceClass}
                  onChange={e => { setSourceClass(e.target.value); setSourceSection(''); setExcludedStudents(new Set()); setResults(null) }}
                  className="w-full rounded-lg border border-gray-300 dark:border-[#38383A] bg-white dark:bg-[#2C2C2E] text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                >
                  <option value="">Select class</option>
                  {classes.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* Source Section */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">Source Section</label>
                <select
                  value={sourceSection}
                  onChange={e => { setSourceSection(e.target.value); setExcludedStudents(new Set()) }}
                  className="w-full rounded-lg border border-gray-300 dark:border-[#38383A] bg-white dark:bg-[#2C2C2E] text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  disabled={!sourceClass}
                >
                  <option value="">All sections</option>
                  {sourceSections.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {/* Target Class */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">Target Class</label>
                <select
                  value={targetClass}
                  onChange={e => setTargetClass(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-[#38383A] bg-white dark:bg-[#2C2C2E] text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                >
                  {activeTab === 'promote' ? (
                    <>
                      <option value="">Auto (next class)</option>
                      {classes.map(c => <option key={c} value={c}>{c}</option>)}
                      <option value="GRADUATED">Graduated / Alumni</option>
                    </>
                  ) : (
                    <>
                      <option value="">Select target class</option>
                      {demotionClasses.map(c => <option key={c} value={c}>{c}</option>)}
                    </>
                  )}
                </select>
              </div>

              {/* Target Section */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">Target Section</label>
                <select
                  value={targetSection}
                  onChange={e => setTargetSection(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-[#38383A] bg-white dark:bg-[#2C2C2E] text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                >
                  <option value="">Keep current section</option>
                  {targetSections.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {/* Academic Year */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">Academic Year</label>
                <input
                  type="text"
                  value={academicYear}
                  onChange={e => setAcademicYear(e.target.value)}
                  placeholder="2026-2027"
                  className="w-full rounded-lg border border-gray-300 dark:border-[#38383A] bg-white dark:bg-[#2C2C2E] text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              {/* Remarks / Reason */}
              <div className={activeTab === 'demote' ? '' : 'md:col-span-2'}>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">
                  {activeTab === 'demote' ? 'Reason (required)' : 'Remarks'}
                </label>
                <input
                  type="text"
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                  placeholder={activeTab === 'demote' ? 'Reason for demotion (required)' : 'Optional remarks'}
                  className="w-full rounded-lg border border-gray-300 dark:border-[#38383A] bg-white dark:bg-[#2C2C2E] text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              {/* Force Override */}
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 dark:text-[#8E8E93]">
                  <input
                    type="checkbox"
                    checked={forceOverride}
                    onChange={e => setForceOverride(e.target.checked)}
                    className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                  />
                  Force override (re-promote)
                </label>
              </div>
            </div>
          </div>

          {/* Student List for bulk */}
          {sourceClass && (
            <div className="bg-white dark:bg-[#1C1C1E] rounded-xl shadow-sm border border-gray-200 dark:border-[#38383A]">
              <div className="p-4 border-b border-gray-200 dark:border-[#38383A] flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Students in {sourceClass}{sourceSection ? `-${sourceSection}` : ''}
                  <span className="ml-2 text-gray-500 font-normal">({filteredStudents.length} found)</span>
                </h3>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search students..."
                    className="pl-9 pr-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-[#38383A] bg-white dark:bg-[#2C2C2E] text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent w-full sm:w-64"
                  />
                </div>
              </div>

              {loadingStudents ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-teal-500" />
                  <span className="ml-2 text-sm text-gray-500">Loading students...</span>
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="py-12 text-center text-sm text-gray-500 dark:text-[#8E8E93]">No students found</div>
              ) : (
                <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-gray-50 dark:bg-[#2C2C2E] text-left text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-3">Adm. No</th>
                        <th className="px-4 py-3">Name</th>
                        <th className="px-4 py-3">Roll No</th>
                        <th className="px-4 py-3">Section</th>
                        <th className="px-4 py-3 w-28">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-[#38383A]">
                      {filteredStudents.map(student => {
                        const isExcluded = excludedStudents.has(student._id)
                        return (
                          <tr key={student._id} className={`hover:bg-gray-50 dark:hover:bg-[#2C2C2E]/50 ${isExcluded ? 'opacity-50 bg-red-50/50 dark:bg-red-900/10' : ''}`}>
                            <td className="px-4 py-2.5 font-mono text-xs text-gray-600 dark:text-[#8E8E93]">{student.admissionNumber || '-'}</td>
                            <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-white">{getDisplayName(student)}</td>
                            <td className="px-4 py-2.5 text-gray-600 dark:text-[#8E8E93]">{student.rollNumber || '-'}</td>
                            <td className="px-4 py-2.5 text-gray-600 dark:text-[#8E8E93]">{student.section || '-'}</td>
                            <td className="px-4 py-2.5">
                              <button
                                onClick={() => toggleExclude(student._id)}
                                className={`text-xs px-2.5 py-1 rounded-lg transition-colors ${isExcluded ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-[#3A3A3C] dark:text-[#8E8E93]'}`}
                              >
                                {isExcluded ? 'Excluded' : 'Exclude'}
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Bulk Action Bar */}
              {filteredStudents.length > 0 && (
                <div className="p-4 border-t border-gray-200 dark:border-[#38383A] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-gray-50 dark:bg-[#2C2C2E]/50 rounded-b-xl">
                  <div className="text-sm text-gray-600 dark:text-[#8E8E93]">
                    <span className="font-semibold text-gray-900 dark:text-white">{promotionCount}</span> of {filteredStudents.length} students will be {activeTab === 'promote' ? 'promoted' : 'demoted'}
                    {excludedStudents.size > 0 && <span className="text-amber-600 ml-1">({excludedStudents.size} excluded)</span>}
                    {targetClass && <span> to <span className="font-medium">{targetClass === 'GRADUATED' ? 'Graduated' : targetClass}</span></span>}
                  </div>
                  <button
                    onClick={() => setShowConfirm(true)}
                    disabled={bulkPromoteMutation.isPending || !academicYear || promotionCount === 0 || (activeTab === 'demote' && (!remarks || !targetClass))}
                    className={`px-5 py-2 text-sm font-medium rounded-lg text-white flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                      activeTab === 'promote' ? 'bg-teal-600 hover:bg-teal-700' : 'bg-amber-600 hover:bg-amber-700'
                    }`}
                  >
                    {bulkPromoteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : activeTab === 'promote' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    Execute {activeTab === 'promote' ? 'Promotion' : 'Demotion'} ({promotionCount})
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ======================= INDIVIDUAL ACTION TAB ======================= */}
      {activeTab === 'individual' && (
        <>
          {/* Search Mode Toggle + Search Area */}
          <div className="bg-white dark:bg-[#1C1C1E] rounded-xl shadow-sm border border-gray-200 dark:border-[#38383A] p-5 sm:p-6">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Find Student</h2>

            {/* Search mode toggle */}
            <div className="flex gap-1 p-1 bg-gray-100 dark:bg-[#2C2C2E] rounded-lg w-fit mb-4">
              <button
                onClick={() => { setIndividualSearchMode('search'); setSourceClass(''); setSourceSection('') }}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  individualSearchMode === 'search'
                    ? 'bg-white dark:bg-[#3A3A3C] text-teal-600 dark:text-teal-400 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                }`}
              >
                <Search className="w-3.5 h-3.5" />
                Search by Admission No / Name
              </button>
              <button
                onClick={() => { setIndividualSearchMode('class'); setAdmissionSearch('') }}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  individualSearchMode === 'class'
                    ? 'bg-white dark:bg-[#3A3A3C] text-teal-600 dark:text-teal-400 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                Browse by Class
              </button>
            </div>

            {/* Search by admission number / name */}
            {individualSearchMode === 'search' && (
              <div className="space-y-4">
                <div className="relative max-w-lg">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={admissionSearch}
                    onChange={e => setAdmissionSearch(e.target.value)}
                    placeholder="Type admission number, student name, or roll number..."
                    className="w-full pl-10 pr-10 py-2.5 text-sm rounded-lg border border-gray-300 dark:border-[#38383A] bg-white dark:bg-[#2C2C2E] text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    autoFocus
                  />
                  {admissionSearch && (
                    <button onClick={() => setAdmissionSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {admissionSearch.length > 0 && admissionSearch.length < 2 && (
                  <p className="text-xs text-gray-400 dark:text-[#636366]">Type at least 2 characters to search...</p>
                )}
              </div>
            )}

            {/* Browse by class */}
            {individualSearchMode === 'class' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">Class</label>
                  <select
                    value={sourceClass}
                    onChange={e => { setSourceClass(e.target.value); setSourceSection('') }}
                    className="w-full rounded-lg border border-gray-300 dark:border-[#38383A] bg-white dark:bg-[#2C2C2E] text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  >
                    <option value="">Select class</option>
                    {classes.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">Section</label>
                  <select
                    value={sourceSection}
                    onChange={e => setSourceSection(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 dark:border-[#38383A] bg-white dark:bg-[#2C2C2E] text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    disabled={!sourceClass}
                  >
                    <option value="">All sections</option>
                    {sourceSections.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Individual Student Results */}
          {((individualSearchMode === 'search' && debouncedAdmissionSearch.length >= 2) ||
            (individualSearchMode === 'class' && sourceClass)) && (
            <div className="bg-white dark:bg-[#1C1C1E] rounded-xl shadow-sm border border-gray-200 dark:border-[#38383A]">
              <div className="p-4 border-b border-gray-200 dark:border-[#38383A]">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  {individualSearchMode === 'search'
                    ? `Search Results for "${debouncedAdmissionSearch}"`
                    : `Students in ${sourceClass}${sourceSection ? `-${sourceSection}` : ''}`
                  }
                  <span className="ml-2 text-gray-500 font-normal">({individualStudentsList.length} found)</span>
                </h3>
              </div>

              {(loadingAdmissionSearch || loadingIndividualClassStudents) ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-teal-500" />
                  <span className="ml-2 text-sm text-gray-500">Searching...</span>
                </div>
              ) : individualStudentsList.length === 0 ? (
                <div className="py-12 text-center">
                  <UserSearch className="w-10 h-10 text-gray-300 dark:text-[#636366] mx-auto mb-3" />
                  <p className="text-sm text-gray-500 dark:text-[#8E8E93]">No students found</p>
                  {individualSearchMode === 'search' && (
                    <p className="text-xs text-gray-400 dark:text-[#636366] mt-1">Try a different admission number or name</p>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[450px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-gray-50 dark:bg-[#2C2C2E] text-left text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-3">Adm. No</th>
                        <th className="px-4 py-3">Name</th>
                        <th className="px-4 py-3">Class</th>
                        <th className="px-4 py-3">Section</th>
                        <th className="px-4 py-3">Roll No</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-[#38383A]">
                      {individualStudentsList.map(student => (
                        <tr key={student._id} className="hover:bg-gray-50 dark:hover:bg-[#2C2C2E]/50">
                          <td className="px-4 py-2.5">
                            <span className="inline-flex items-center gap-1 font-mono text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-[#2C2C2E] text-gray-700 dark:text-[#8E8E93]">
                              <Hash className="w-3 h-3" />
                              {student.admissionNumber || '-'}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-white">{getDisplayName(student)}</td>
                          <td className="px-4 py-2.5 text-gray-600 dark:text-[#8E8E93]">{student.class || '-'}</td>
                          <td className="px-4 py-2.5 text-gray-600 dark:text-[#8E8E93]">{student.section || '-'}</td>
                          <td className="px-4 py-2.5 text-gray-600 dark:text-[#8E8E93]">{student.rollNumber || '-'}</td>
                          <td className="px-4 py-2.5">
                            <div className="flex gap-1.5 justify-end">
                              <button
                                onClick={() => openIndividualModal(student, 'promote')}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-teal-50 text-teal-700 hover:bg-teal-100 dark:bg-teal-900/30 dark:text-teal-300 dark:hover:bg-teal-900/50 transition-colors"
                              >
                                <ArrowUpRight className="w-3 h-3" />
                                Promote
                              </button>
                              <button
                                onClick={() => openIndividualModal(student, 'demote')}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50 transition-colors"
                              >
                                <ArrowDownRight className="w-3 h-3" />
                                Demote
                              </button>
                              <button
                                onClick={() => openIndividualModal(student, 'shift')}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50 transition-colors"
                              >
                                <ArrowRightLeft className="w-3 h-3" />
                                Shift
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ======================= CONFIRMATION DIALOG ======================= */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowConfirm(false)}>
          <div className="bg-white dark:bg-[#1C1C1E] rounded-xl shadow-2xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                activeTab === 'promote' ? 'bg-teal-100 dark:bg-teal-900/30' : 'bg-amber-100 dark:bg-amber-900/30'
              }`}>
                <AlertTriangle className={`w-5 h-5 ${activeTab === 'promote' ? 'text-teal-600 dark:text-teal-400' : 'text-amber-600 dark:text-amber-400'}`} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Confirm Bulk {activeTab === 'promote' ? 'Promotion' : 'Demotion'}</h3>
                <p className="text-sm text-gray-600 dark:text-[#8E8E93] mt-2">
                  This will {activeTab} <strong>{promotionCount}</strong> students from{' '}
                  <strong>{sourceClass}{sourceSection ? `-${sourceSection}` : ''}</strong> to{' '}
                  <strong>{targetClass || 'next class'}</strong> for academic year <strong>{academicYear}</strong>.
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">This action can be undone within 7 days from Transition History.</p>
              </div>
            </div>
            <div className="flex gap-3 mt-6 justify-end">
              <button onClick={() => setShowConfirm(false)} className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-[#38383A] text-gray-700 dark:text-[#8E8E93] hover:bg-gray-50 dark:hover:bg-[#2C2C2E] transition-colors">Cancel</button>
              <button
                onClick={handleBulkAction}
                disabled={bulkPromoteMutation.isPending}
                className={`px-4 py-2 text-sm rounded-lg text-white flex items-center gap-2 disabled:opacity-50 transition-colors ${
                  activeTab === 'promote' ? 'bg-teal-600 hover:bg-teal-700' : 'bg-amber-600 hover:bg-amber-700'
                }`}
              >
                {bulkPromoteMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================= INDIVIDUAL ACTION MODAL ======================= */}
      {individualStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setIndividualStudent(null)}>
          <div className="bg-white dark:bg-[#1C1C1E] rounded-xl shadow-2xl max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="p-5 border-b border-gray-200 dark:border-[#38383A]">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {individualAction === 'promote' ? 'Promote' : individualAction === 'demote' ? 'Demote' : 'Shift Section'} Student
              </h3>
              <div className="mt-2 flex items-center gap-3">
                <div className="w-9 h-9 bg-gradient-to-br from-teal-400 to-teal-700 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-semibold text-white">{getDisplayName(individualStudent).charAt(0).toUpperCase()}</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{getDisplayName(individualStudent)}</p>
                  <p className="text-xs text-gray-500 dark:text-[#8E8E93]">
                    {individualStudent.admissionNumber} &middot; {individualStudent.class}-{individualStudent.section}
                    {individualStudent.rollNumber ? ` &middot; Roll ${individualStudent.rollNumber}` : ''}
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              {/* Action Picker */}
              <div className="flex gap-1 p-1 bg-gray-100 dark:bg-[#2C2C2E] rounded-lg">
                {[
                  { key: 'promote', label: 'Promote', icon: ArrowUpRight, color: 'teal' },
                  { key: 'demote', label: 'Demote', icon: ArrowDownRight, color: 'amber' },
                  { key: 'shift', label: 'Shift Section', icon: ArrowRightLeft, color: 'blue' }
                ].map(a => (
                  <button
                    key={a.key}
                    onClick={() => { setIndividualAction(a.key); setIndividualTargetClass(''); setIndividualTargetSection('') }}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      individualAction === a.key
                        ? `bg-white dark:bg-[#3A3A3C] text-${a.color}-600 dark:text-${a.color}-400 shadow-sm`
                        : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    <a.icon className="w-3.5 h-3.5" />
                    {a.label}
                  </button>
                ))}
              </div>

              {/* Target Class (for promote/demote) */}
              {individualAction !== 'shift' && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-[#8E8E93] mb-1">Target Class</label>
                  <select
                    value={individualTargetClass}
                    onChange={e => setIndividualTargetClass(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 dark:border-[#38383A] bg-white dark:bg-[#2C2C2E] text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  >
                    {individualAction === 'promote' ? (
                      <>
                        <option value="">Auto (next class)</option>
                        {classes.map(c => <option key={c} value={c}>{c}</option>)}
                        <option value="GRADUATED">Graduated</option>
                      </>
                    ) : (
                      <>
                        <option value="">Select target class</option>
                        {classes.filter(c => {
                          const sorted = sortClasses(classes)
                          const studentIdx = sorted.findIndex(sc => sc === individualStudent?.class)
                          const cIdx = sorted.findIndex(sc => sc === c)
                          return cIdx < studentIdx
                        }).map(c => <option key={c} value={c}>{c}</option>)}
                      </>
                    )}
                  </select>
                </div>
              )}

              {/* Target Section */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-[#8E8E93] mb-1">
                  {individualAction === 'shift' ? 'Target Section' : 'Target Section (optional)'}
                </label>
                <select
                  value={individualTargetSection}
                  onChange={e => setIndividualTargetSection(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-[#38383A] bg-white dark:bg-[#2C2C2E] text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                >
                  <option value="">{individualAction === 'shift' ? 'Select section' : 'Keep current'}</option>
                  {(individualAction === 'shift' ? individualShiftSections : individualTargetSections)
                    .filter(s => s !== individualStudent?.section)
                    .map(s => <option key={s} value={s}>{s}</option>)
                  }
                </select>
              </div>

              {/* Academic Year (for promote/demote) */}
              {individualAction !== 'shift' && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-[#8E8E93] mb-1">Academic Year</label>
                  <input
                    type="text"
                    value={academicYear}
                    onChange={e => setAcademicYear(e.target.value)}
                    placeholder="2026-2027"
                    className="w-full rounded-lg border border-gray-300 dark:border-[#38383A] bg-white dark:bg-[#2C2C2E] text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>
              )}

              {/* Reason */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-[#8E8E93] mb-1">
                  {(individualAction === 'demote' || individualAction === 'shift') ? 'Reason (required)' : 'Remarks (optional)'}
                </label>
                <input
                  type="text"
                  value={individualReason}
                  onChange={e => setIndividualReason(e.target.value)}
                  placeholder={individualAction === 'promote' ? 'Optional remarks' : 'Reason for this action'}
                  className="w-full rounded-lg border border-gray-300 dark:border-[#38383A] bg-white dark:bg-[#2C2C2E] text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              {/* Force Override (for promote/demote) */}
              {individualAction !== 'shift' && (
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 dark:text-[#8E8E93]">
                  <input
                    type="checkbox"
                    checked={forceOverride}
                    onChange={e => setForceOverride(e.target.checked)}
                    className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                  />
                  Force override (re-promote)
                </label>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-5 border-t border-gray-200 dark:border-[#38383A] flex gap-3 justify-end">
              <button onClick={() => setIndividualStudent(null)} className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-[#38383A] text-gray-700 dark:text-[#8E8E93] hover:bg-gray-50 dark:hover:bg-[#2C2C2E] transition-colors">Cancel</button>
              <button
                onClick={handleIndividualAction}
                disabled={
                  individualMutation.isPending ||
                  (individualAction === 'demote' && (!individualReason || !individualTargetClass)) ||
                  (individualAction === 'shift' && !individualTargetSection)
                }
                className={`px-4 py-2 text-sm rounded-lg text-white flex items-center gap-2 disabled:opacity-50 transition-colors ${
                  individualAction === 'promote' ? 'bg-teal-600 hover:bg-teal-700' : individualAction === 'demote' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {individualMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                {individualAction === 'promote' ? 'Promote' : individualAction === 'demote' ? 'Demote' : 'Shift'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================= RESULTS SUMMARY ======================= */}
      {results && (
        <div className="bg-white dark:bg-[#1C1C1E] rounded-xl shadow-sm border border-gray-200 dark:border-[#38383A] p-5 sm:p-6">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-teal-500" />
            Results
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Promoted', value: results.promoted || 0, color: 'teal' },
              { label: 'Graduated', value: results.graduated || 0, color: 'blue' },
              { label: 'Skipped', value: results.skipped || 0, color: 'amber' },
              { label: 'Failed', value: results.failed || 0, color: 'red' }
            ].map(stat => (
              <div key={stat.label} className={`p-3 rounded-xl bg-${stat.color}-50 dark:bg-${stat.color}-900/20 border border-${stat.color}-200 dark:border-${stat.color}-800`}>
                <p className={`text-2xl font-bold text-${stat.color}-600 dark:text-${stat.color}-400`}>{stat.value}</p>
                <p className="text-xs text-gray-600 dark:text-[#8E8E93]">{stat.label}</p>
              </div>
            ))}
          </div>

          {results.details?.length > 0 && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-[#8E8E93] hover:text-teal-600">
                View detailed results ({results.details.length} entries)
              </summary>
              <div className="mt-2 max-h-60 overflow-y-auto rounded-lg border border-gray-200 dark:border-[#38383A]">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 dark:bg-[#2C2C2E] sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-gray-500">Student</th>
                      <th className="px-3 py-2 text-left text-gray-500">Status</th>
                      <th className="px-3 py-2 text-left text-gray-500">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-[#38383A]">
                    {results.details.map((d, i) => (
                      <tr key={i}>
                        <td className="px-3 py-1.5 text-gray-900 dark:text-white">{d.name || d.studentId}</td>
                        <td className="px-3 py-1.5">
                          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                            d.status === 'promoted' ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300' :
                            d.status === 'graduated' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                            d.status === 'skipped' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' :
                            'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                          }`}>{d.status}</span>
                        </td>
                        <td className="px-3 py-1.5 text-gray-500">{d.reason || (d.toClass ? `→ ${d.toClass}${d.toSection ? `-${d.toSection}` : ''}` : '')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  )
}
