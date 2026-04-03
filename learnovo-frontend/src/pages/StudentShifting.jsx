import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  ArrowRightLeft, Loader2, AlertTriangle, Search, CheckSquare, Square,
  UserPlus, X, Trash2
} from 'lucide-react'
import { transitionsService } from '../services/transitionsService'
import { studentsService } from '../services/studentsService'
import AcademicTransitionNav from '../components/AcademicTransitionNav'
import { sortClasses } from '../utils/classOrder'

const ACADEMIC_YEAR_REGEX = /^\d{4}-\d{4}$/

export default function StudentShifting() {
  const queryClient = useQueryClient()

  // Input mode: 'admission' (paste admission numbers) or 'select' (browse class and pick)
  const [inputMode, setInputMode] = useState('admission')

  // Admission number input
  const [admissionInput, setAdmissionInput] = useState('')
  const [resolvedStudents, setResolvedStudents] = useState([])
  const [notFoundNumbers, setNotFoundNumbers] = useState([])
  const [hasResolved, setHasResolved] = useState(false)

  // Select mode state
  const [browseClass, setBrowseClass] = useState('')
  const [browseSection, setBrowseSection] = useState('')
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [searchQuery, setSearchQuery] = useState('')

  // Target config
  const [targetClass, setTargetClass] = useState('')
  const [targetSection, setTargetSection] = useState('')
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth()
  const defaultAcademicYear = currentMonth < 3 ? `${currentYear}-${currentYear + 1}` : `${currentYear + 1}-${currentYear + 2}`
  const [academicYear, setAcademicYear] = useState(defaultAcademicYear)
  const [remarks, setRemarks] = useState('')
  const [forceOverride, setForceOverride] = useState(false)

  // UI state
  const [showConfirm, setShowConfirm] = useState(false)
  const [results, setResults] = useState(null)

  // Queries
  const { data: filtersData } = useQuery({
    queryKey: ['student-filters'],
    queryFn: () => studentsService.getFilters()
  })

  const rawClasses = filtersData?.data?.classes || filtersData?.classes || []
  const classes = useMemo(() => sortClasses(rawClasses), [rawClasses])
  const rawSections = filtersData?.data?.sections || filtersData?.sections || []

  const { data: targetSectionsData, isLoading: loadingTargetSections } = useQuery({
    queryKey: ['class-sections', targetClass],
    queryFn: () => transitionsService.getSectionsForClass(targetClass),
    enabled: !!targetClass
  })
  const targetSections = targetSectionsData?.data || []

  // Browse mode: load students from selected class
  const { data: browseStudentsData, isLoading: loadingBrowseStudents } = useQuery({
    queryKey: ['shift-browse-students', browseClass, browseSection],
    queryFn: () => studentsService.list({
      class: browseClass,
      section: browseSection || undefined,
      status: 'active',
      limit: 500,
      lightweight: true
    }),
    enabled: !!browseClass && inputMode === 'select'
  })
  const browseStudents = browseStudentsData?.data || []

  const filteredBrowseStudents = useMemo(() => {
    if (!searchQuery.trim()) return browseStudents
    const q = searchQuery.toLowerCase().trim()
    return browseStudents.filter(s =>
      (s.name || s.fullName || '').toLowerCase().includes(q) ||
      (s.admissionNumber || '').toLowerCase().includes(q)
    )
  }, [browseStudents, searchQuery])

  // Resolve admission numbers mutation
  const resolveMutation = useMutation({
    mutationFn: (numbers) => transitionsService.resolveStudents(numbers),
    onSuccess: (data) => {
      setResolvedStudents(data.data.students || [])
      setNotFoundNumbers(data.data.notFound || [])
      setHasResolved(true)
      if (data.data.notFound?.length > 0) {
        toast.error(`${data.data.notFound.length} admission number(s) not found`)
      } else {
        toast.success(`Found ${data.data.students?.length || 0} student(s)`)
      }
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || error.response?.data?.errors?.[0] || 'Failed to resolve students')
    }
  })

  // Execute shift mutation
  const shiftMutation = useMutation({
    mutationFn: (payload) => transitionsService.shiftStudents(payload),
    onSuccess: (data) => {
      setResults(data.data)
      setShowConfirm(false)
      toast.success(`Shift complete: ${data.data.shifted} student(s) shifted`)
      queryClient.invalidateQueries({ queryKey: ['students'] })
      queryClient.invalidateQueries({ queryKey: ['shift-browse-students'] })
      queryClient.invalidateQueries({ queryKey: ['class-sections'] })
      queryClient.invalidateQueries({ queryKey: ['student-filters'] })
    },
    onError: (error) => {
      setShowConfirm(false)
      toast.error(error.response?.data?.message || error.response?.data?.errors?.[0] || 'Shift failed')
    }
  })

  const handleResolve = () => {
    const numbers = admissionInput
      .split(/[,\n]+/)
      .map(n => n.trim())
      .filter(n => n.length > 0)
    if (numbers.length === 0) return toast.error('Enter at least one admission number')
    resolveMutation.mutate(numbers)
  }

  const removeResolved = (admNum) => {
    setResolvedStudents(prev => prev.filter(s => s.admissionNumber !== admNum))
  }

  const isValidAcademicYear = (year) => {
    if (!ACADEMIC_YEAR_REGEX.test(year)) return false
    const [start, end] = year.split('-').map(Number)
    return end === start + 1
  }

  const getShiftPayload = () => {
    if (inputMode === 'admission') {
      return {
        admissionNumbers: resolvedStudents.map(s => s.admissionNumber),
        toClass: targetClass,
        toSection: targetSection || undefined,
        academicYear,
        remarks,
        forceOverride
      }
    } else {
      return {
        studentIds: Array.from(selectedIds),
        toClass: targetClass,
        toSection: targetSection || undefined,
        academicYear,
        remarks,
        forceOverride
      }
    }
  }

  const studentsToShift = inputMode === 'admission'
    ? resolvedStudents.filter(s => s.isActive)
    : browseStudents.filter(s => selectedIds.has(s._id))

  const canExecute = () => {
    if (!targetClass || !isValidAcademicYear(academicYear)) return false
    if (inputMode === 'admission') return resolvedStudents.length > 0
    return selectedIds.size > 0
  }

  const handleExecute = () => {
    if (!canExecute()) return
    if (!showConfirm) {
      setShowConfirm(true)
      return
    }
    setResults(null)
    setShowConfirm(false)
    shiftMutation.mutate(getShiftPayload())
  }

  const toggleSelectStudent = (id) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  const handleSelectAll = () => {
    const visibleIds = filteredBrowseStudents.map(s => s._id)
    const allSelected = visibleIds.every(id => selectedIds.has(id))
    if (allSelected) {
      const next = new Set(selectedIds)
      visibleIds.forEach(id => next.delete(id))
      setSelectedIds(next)
    } else {
      setSelectedIds(new Set([...selectedIds, ...visibleIds]))
    }
  }

  const allVisibleSelected = filteredBrowseStudents.length > 0 && filteredBrowseStudents.every(s => selectedIds.has(s._id))

  const handleReset = () => {
    setResolvedStudents([])
    setNotFoundNumbers([])
    setHasResolved(false)
    setAdmissionInput('')
    setSelectedIds(new Set())
    setResults(null)
  }

  return (
    <div className="space-y-6">
      <AcademicTransitionNav />

      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Student Shifting</h1>
        <p className="text-sm text-gray-500 dark:text-[#8E8E93] mt-1">
          Move students to a different class and section — enter admission numbers or select from a class
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* LEFT PANEL — Config */}
        <div className="lg:col-span-1 space-y-5">

          {/* Input Mode Toggle */}
          <div className="bg-white dark:bg-[#1C1C1E] rounded-xl shadow-sm border border-gray-200 dark:border-[#38383A] p-5">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Step 1: Select Students</h2>
            <div className="flex gap-1 p-1 bg-gray-100 dark:bg-[#2C2C2E] rounded-lg mb-4">
              <button
                onClick={() => { setInputMode('admission'); handleReset() }}
                className={`flex-1 flex justify-center items-center py-2 px-3 text-sm font-medium rounded-md transition-colors ${
                  inputMode === 'admission'
                    ? 'bg-white dark:bg-[#3A3A3C] text-teal-600 dark:text-teal-400 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                <UserPlus className="w-4 h-4 mr-1.5" /> By Admission No.
              </button>
              <button
                onClick={() => { setInputMode('select'); handleReset() }}
                className={`flex-1 flex justify-center items-center py-2 px-3 text-sm font-medium rounded-md transition-colors ${
                  inputMode === 'select'
                    ? 'bg-white dark:bg-[#3A3A3C] text-teal-600 dark:text-teal-400 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                <Search className="w-4 h-4 mr-1.5" /> Browse Class
              </button>
            </div>

            {inputMode === 'admission' ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">
                    Admission Numbers
                  </label>
                  <textarea
                    value={admissionInput}
                    onChange={(e) => setAdmissionInput(e.target.value)}
                    rows="4"
                    className="w-full rounded-lg border border-gray-300 dark:border-[#38383A] bg-white dark:bg-[#2C2C2E] text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent font-mono"
                    placeholder="Enter admission numbers separated by commas or new lines&#10;e.g. ADM001, ADM002, ADM003"
                  />
                  <p className="text-xs text-gray-400 dark:text-[#636366] mt-1">
                    Separate with commas or new lines
                  </p>
                </div>
                <button
                  onClick={handleResolve}
                  disabled={resolveMutation.isPending || !admissionInput.trim()}
                  className="w-full flex justify-center items-center py-2 px-4 rounded-lg text-sm font-medium bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {resolveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Search className="w-4 h-4 mr-2" />}
                  Find Students
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">Source Class</label>
                  <select
                    value={browseClass}
                    onChange={(e) => { setBrowseClass(e.target.value); setBrowseSection(''); setSelectedIds(new Set()) }}
                    className="w-full rounded-lg border border-gray-300 dark:border-[#38383A] bg-white dark:bg-[#2C2C2E] text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  >
                    <option value="">Select Class</option>
                    {classes.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">Source Section (Optional)</label>
                  <select
                    value={browseSection}
                    onChange={(e) => { setBrowseSection(e.target.value); setSelectedIds(new Set()) }}
                    className="w-full rounded-lg border border-gray-300 dark:border-[#38383A] bg-white dark:bg-[#2C2C2E] text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  >
                    <option value="">All Sections</option>
                    {rawSections.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Target Config */}
          <div className="bg-white dark:bg-[#1C1C1E] rounded-xl shadow-sm border border-gray-200 dark:border-[#38383A] p-5">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Step 2: Target Destination</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">Target Class *</label>
                <select
                  value={targetClass}
                  onChange={(e) => { setTargetClass(e.target.value); setTargetSection('') }}
                  className="w-full rounded-lg border border-gray-300 dark:border-[#38383A] bg-white dark:bg-[#2C2C2E] text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                >
                  <option value="">Select Target Class</option>
                  {classes.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">Target Section</label>
                <select
                  value={targetSection}
                  onChange={(e) => setTargetSection(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-[#38383A] bg-white dark:bg-[#2C2C2E] text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  disabled={!targetClass || loadingTargetSections}
                >
                  <option value="">Keep current section</option>
                  {targetSections.map(s => (
                    <option key={s.name} value={s.name}>
                      {s.name} ({s.studentCount ?? s.currentStrength ?? 0} / {s.capacity})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">Academic Year *</label>
                <input
                  type="text"
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  className={`w-full rounded-lg border ${
                    academicYear && !isValidAcademicYear(academicYear)
                      ? 'border-red-300 dark:border-red-500 focus:ring-red-500'
                      : 'border-gray-300 dark:border-[#38383A] focus:ring-teal-500'
                  } bg-white dark:bg-[#2C2C2E] text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:border-transparent`}
                  placeholder="e.g. 2025-2026"
                />
                {academicYear && !isValidAcademicYear(academicYear) && (
                  <p className="mt-1 text-xs text-red-500 dark:text-red-400">Format: YYYY-YYYY (e.g. 2025-2026)</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">Remarks (Optional)</label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows="2"
                  className="w-full rounded-lg border border-gray-300 dark:border-[#38383A] bg-white dark:bg-[#2C2C2E] text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="Reason for shifting..."
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 dark:text-[#8E8E93]">
                <input
                  type="checkbox"
                  className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                  checked={forceOverride}
                  onChange={(e) => setForceOverride(e.target.checked)}
                />
                Force override (ignore if already shifted this year)
              </label>

              <button
                onClick={handleExecute}
                disabled={!canExecute() || shiftMutation.isPending}
                className="w-full flex justify-center items-center py-2.5 px-4 rounded-lg text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {shiftMutation.isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <ArrowRightLeft className="w-4 h-4 mr-2" />
                    Shift {inputMode === 'admission' ? resolvedStudents.filter(s => s.isActive).length : selectedIds.size} Student{(inputMode === 'admission' ? resolvedStudents.filter(s => s.isActive).length : selectedIds.size) !== 1 ? 's' : ''}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL — Student List / Preview */}
        <div className="lg:col-span-2 space-y-5">

          {/* Results Summary */}
          {results && (
            <div className="bg-white dark:bg-[#1C1C1E] rounded-xl shadow-sm border border-gray-200 dark:border-[#38383A] p-5">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Shift Results</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div className="p-3 rounded-xl bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800">
                  <p className="text-2xl font-bold text-teal-600 dark:text-teal-400">{results.shifted}</p>
                  <p className="text-xs text-gray-500 dark:text-[#8E8E93]">Shifted</p>
                </div>
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                  <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{results.skipped}</p>
                  <p className="text-xs text-gray-500 dark:text-[#8E8E93]">Skipped</p>
                </div>
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">{results.failed}</p>
                  <p className="text-xs text-gray-500 dark:text-[#8E8E93]">Failed</p>
                </div>
                {results.notFound?.length > 0 && (
                  <div className="p-3 rounded-xl bg-gray-50 dark:bg-[#2C2C2E] border border-gray-200 dark:border-[#38383A]">
                    <p className="text-2xl font-bold text-gray-600 dark:text-gray-400">{results.notFound.length}</p>
                    <p className="text-xs text-gray-500 dark:text-[#8E8E93]">Not Found</p>
                  </div>
                )}
              </div>
              {results.details?.length > 0 && (
                <div className="overflow-x-auto max-h-[250px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-gray-50 dark:bg-[#2C2C2E] text-left text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">
                      <tr>
                        <th className="px-3 py-2">Adm No.</th>
                        <th className="px-3 py-2">Name</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-[#38383A]">
                      {results.details.map((d, i) => (
                        <tr key={i} className="hover:bg-gray-50 dark:hover:bg-[#2C2C2E]/50">
                          <td className="px-3 py-2 font-mono text-xs text-gray-600 dark:text-[#8E8E93]">{d.admissionNumber || '-'}</td>
                          <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">{d.name || '-'}</td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                              d.status === 'shifted' ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300' :
                              d.status === 'skipped' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' :
                              'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                            }`}>
                              {d.status}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-500 dark:text-[#8E8E93]">
                            {d.status === 'shifted' ? `${d.fromClass}-${d.fromSection} → ${d.toClass}-${d.toSection}` : d.reason || ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {results.notFound?.length > 0 && (
                <div className="mt-3 p-3 rounded-lg bg-gray-50 dark:bg-[#2C2C2E]">
                  <p className="text-xs font-medium text-gray-500 dark:text-[#8E8E93] mb-1">Not found admission numbers:</p>
                  <p className="text-xs font-mono text-gray-600 dark:text-[#8E8E93]">{results.notFound.join(', ')}</p>
                </div>
              )}
            </div>
          )}

          {/* Admission mode: resolved students preview */}
          {inputMode === 'admission' && (
            <div className="bg-white dark:bg-[#1C1C1E] rounded-xl shadow-sm border border-gray-200 dark:border-[#38383A] overflow-hidden">
              <div className="px-4 sm:px-5 py-4 border-b border-gray-200 dark:border-[#38383A] bg-gray-50 dark:bg-[#2C2C2E]">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Resolved Students {hasResolved && `(${resolvedStudents.length})`}
                </h2>
                <p className="text-xs text-gray-500 dark:text-[#8E8E93] mt-0.5">
                  Enter admission numbers and click "Find Students" to preview
                </p>
              </div>

              {!hasResolved ? (
                <div className="text-center py-16 text-gray-500 dark:text-[#8E8E93]">
                  <UserPlus className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Enter admission numbers and click "Find Students"</p>
                </div>
              ) : resolvedStudents.length === 0 ? (
                <div className="text-center py-16 text-gray-500 dark:text-[#8E8E93]">
                  <p className="text-sm">No students found for the given admission numbers.</p>
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-gray-50 dark:bg-[#2C2C2E] text-left text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-3">Adm No.</th>
                        <th className="px-4 py-3">Name</th>
                        <th className="px-4 py-3">Current Class</th>
                        <th className="px-4 py-3">Section</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-[#38383A]">
                      {resolvedStudents.map(s => (
                        <tr key={s._id} className="hover:bg-gray-50 dark:hover:bg-[#2C2C2E]/50 transition-colors">
                          <td className="px-4 py-2.5 font-mono text-xs text-gray-600 dark:text-[#8E8E93]">{s.admissionNumber}</td>
                          <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-white">{s.name}</td>
                          <td className="px-4 py-2.5 text-gray-600 dark:text-[#8E8E93]">{s.class || '-'}</td>
                          <td className="px-4 py-2.5 text-gray-600 dark:text-[#8E8E93]">{s.section || '-'}</td>
                          <td className="px-4 py-2.5">
                            {s.isActive ? (
                              <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300">Active</span>
                            ) : (
                              <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">{s.removalReason || 'Inactive'}</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            <button onClick={() => removeResolved(s.admissionNumber)} className="p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-colors">
                              <X className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {notFoundNumbers.length > 0 && (
                <div className="px-4 sm:px-5 py-3 border-t border-gray-200 dark:border-[#38383A] bg-amber-50 dark:bg-amber-900/10">
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1">Not found ({notFoundNumbers.length}):</p>
                  <p className="text-xs font-mono text-amber-600 dark:text-amber-300">{notFoundNumbers.join(', ')}</p>
                </div>
              )}
            </div>
          )}

          {/* Select mode: browse class students */}
          {inputMode === 'select' && (
            <div className="bg-white dark:bg-[#1C1C1E] rounded-xl shadow-sm border border-gray-200 dark:border-[#38383A] overflow-hidden">
              <div className="px-4 sm:px-5 py-4 border-b border-gray-200 dark:border-[#38383A] bg-gray-50 dark:bg-[#2C2C2E]">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                    Select Students ({selectedIds.size} selected{browseStudents.length > 0 ? ` of ${browseStudents.length}` : ''})
                  </h2>
                  {browseStudents.length > 0 && (
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by name or adm no..."
                        className="pl-9 pr-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-[#38383A] bg-white dark:bg-[#1C1C1E] text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent w-full sm:w-64"
                      />
                    </div>
                  )}
                </div>
              </div>

              {!browseClass ? (
                <div className="text-center py-16 text-gray-500 dark:text-[#8E8E93]">
                  <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Select a source class to browse students</p>
                </div>
              ) : loadingBrowseStudents ? (
                <div className="flex justify-center items-center py-16">
                  <Loader2 className="w-6 h-6 animate-spin text-teal-500" />
                </div>
              ) : browseStudents.length === 0 ? (
                <div className="text-center py-16 text-gray-500 dark:text-[#8E8E93]">
                  <p className="text-sm">No active students found in this class.</p>
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-gray-50 dark:bg-[#2C2C2E] text-left text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-3 w-10">
                          <button onClick={handleSelectAll} className="flex items-center text-teal-600 hover:text-teal-800 dark:text-teal-400 dark:hover:text-teal-300">
                            {allVisibleSelected ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                          </button>
                        </th>
                        <th className="px-4 py-3">Adm No.</th>
                        <th className="px-4 py-3">Name</th>
                        <th className="px-4 py-3">Section</th>
                        <th className="px-4 py-3">Academic Year</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-[#38383A]">
                      {filteredBrowseStudents.map(s => (
                        <tr
                          key={s._id}
                          className={`hover:bg-gray-50 dark:hover:bg-[#2C2C2E] cursor-pointer transition-colors ${selectedIds.has(s._id) ? 'bg-teal-50/50 dark:bg-teal-900/20' : ''}`}
                          onClick={() => toggleSelectStudent(s._id)}
                        >
                          <td className="px-4 py-2.5">
                            {selectedIds.has(s._id)
                              ? <CheckSquare className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                              : <Square className="w-5 h-5 text-gray-400 dark:text-[#636366]" />
                            }
                          </td>
                          <td className="px-4 py-2.5 font-mono text-xs text-gray-600 dark:text-[#8E8E93]">{s.admissionNumber || '-'}</td>
                          <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-white">{s.name || s.fullName || `${s.firstName || ''} ${s.lastName || ''}`.trim() || '-'}</td>
                          <td className="px-4 py-2.5 text-gray-600 dark:text-[#8E8E93]">{s.section || '-'}</td>
                          <td className="px-4 py-2.5 text-gray-600 dark:text-[#8E8E93]">{s.academicYear || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Dialog */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowConfirm(false)}>
          <div className="bg-white dark:bg-[#1C1C1E] rounded-xl shadow-2xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center">
                <ArrowRightLeft className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Confirm Student Shift</h3>
                <p className="text-sm text-gray-600 dark:text-[#8E8E93] mt-2">
                  You are about to shift{' '}
                  <strong>{inputMode === 'admission' ? resolvedStudents.filter(s => s.isActive).length : selectedIds.size}</strong>{' '}
                  student{(inputMode === 'admission' ? resolvedStudents.filter(s => s.isActive).length : selectedIds.size) !== 1 ? 's' : ''}{' '}
                  to <strong>{targetClass}{targetSection ? `-${targetSection}` : ''}</strong>{' '}
                  for academic year <strong>{academicYear}</strong>.
                </p>
                {inputMode === 'admission' && resolvedStudents.some(s => !s.isActive) && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                    {resolvedStudents.filter(s => !s.isActive).length} inactive student(s) will be skipped.
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-3 mt-6 justify-end">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-[#38383A] text-gray-700 dark:text-[#8E8E93] hover:bg-gray-50 dark:hover:bg-[#2C2C2E] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setResults(null)
                  shiftMutation.mutate(getShiftPayload())
                }}
                disabled={shiftMutation.isPending}
                className="px-4 py-2 text-sm rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
              >
                {shiftMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirm Shift
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
