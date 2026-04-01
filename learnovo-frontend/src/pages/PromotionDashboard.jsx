import { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  TrendingUp, TrendingDown, Users, Search, ChevronDown, ChevronUp,
  CheckSquare, Square, AlertTriangle, GraduationCap, Loader2, RotateCcw
} from 'lucide-react'
import { transitionsService } from '../services/transitionsService'
import { studentsService } from '../services/studentsService'

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
    return `${y}-${y + 1}`
  })
  const [remarks, setRemarks] = useState('')
  const [forceOverride, setForceOverride] = useState(false)
  const [selectedStudents, setSelectedStudents] = useState(new Set())
  const [excludedStudents, setExcludedStudents] = useState(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  const [results, setResults] = useState(null)

  // Individual action state
  const [individualStudent, setIndividualStudent] = useState(null)
  const [individualAction, setIndividualAction] = useState('promote')
  const [individualReason, setIndividualReason] = useState('')

  // Queries
  const { data: filtersData } = useQuery({
    queryKey: ['student-filters'],
    queryFn: () => studentsService.getFilters()
  })

  const { data: hierarchyData } = useQuery({
    queryKey: ['class-hierarchy'],
    queryFn: () => transitionsService.getClassHierarchy()
  })

  const { data: studentsData, isLoading: loadingStudents } = useQuery({
    queryKey: ['students-for-promotion', sourceClass, sourceSection],
    queryFn: () => studentsService.list({
      class: sourceClass,
      section: sourceSection || undefined,
      status: 'active',
      limit: 500
    }),
    enabled: !!sourceClass
  })

  const classes = filtersData?.data?.classes || filtersData?.classes || []
  const sections = filtersData?.data?.sections || filtersData?.sections || []
  const hierarchy = hierarchyData?.data || []
  const students = studentsData?.data || studentsData?.students || []

  // Auto-suggest next class from hierarchy
  useEffect(() => {
    if (sourceClass && hierarchy.length > 0 && activeTab === 'promote') {
      const normalizedSource = sourceClass.toLowerCase().replace(/^class\s+/i, '')
      const idx = hierarchy.findIndex(h => h.name.toLowerCase().replace(/^class\s+/i, '') === normalizedSource)
      if (idx !== -1 && idx < hierarchy.length - 1) {
        setTargetClass(hierarchy[idx + 1].name)
      } else if (idx === hierarchy.length - 1) {
        setTargetClass('GRADUATED')
      }
    }
  }, [sourceClass, hierarchy, activeTab])

  // Filter students by search
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

  // Select all / deselect all
  const toggleSelectAll = () => {
    if (selectedStudents.size === filteredStudents.length) {
      setSelectedStudents(new Set())
    } else {
      setSelectedStudents(new Set(filteredStudents.map(s => s._id)))
    }
  }

  const toggleStudent = (id) => {
    const next = new Set(selectedStudents)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedStudents(next)
  }

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
      toast.success(`Promotion complete: ${data.data.promoted} promoted, ${data.data.graduated} graduated`)
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || error.response?.data?.errors?.[0] || 'Promotion failed')
    }
  })

  const individualPromoteMutation = useMutation({
    mutationFn: ({ studentId, ...payload }) =>
      individualAction === 'promote'
        ? transitionsService.promoteStudent(studentId, payload)
        : transitionsService.demoteStudent(studentId, payload),
    onSuccess: (data) => {
      toast.success(data.message || 'Action completed')
      setIndividualStudent(null)
      queryClient.invalidateQueries({ queryKey: ['students-for-promotion'] })
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || error.response?.data?.errors?.[0] || 'Action failed')
    }
  })

  const handleBulkPromote = () => {
    const payload = {
      fromClass: sourceClass,
      fromSection: sourceSection || undefined,
      toClass: targetClass !== 'GRADUATED' ? targetClass : undefined,
      toSection: targetSection || undefined,
      academicYear,
      excludeStudents: Array.from(excludedStudents),
      forceOverride,
      remarks
    }
    bulkPromoteMutation.mutate(payload)
  }

  const handleIndividualAction = () => {
    if (!individualStudent) return
    const payload = {
      studentId: individualStudent._id,
      toClass: targetClass,
      toSection: targetSection || undefined,
      academicYear,
      remarks: individualAction === 'promote' ? remarks : undefined,
      reason: individualAction === 'demote' ? individualReason : undefined,
      forceOverride
    }
    individualPromoteMutation.mutate(payload)
  }

  const availableSections = sourceClass
    ? sections.filter(s => s !== '').sort()
    : []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Promotion Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Promote, demote, or detain students across classes</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700 pb-0">
        {[
          { key: 'promote', label: 'Bulk Promote', icon: TrendingUp },
          { key: 'demote', label: 'Bulk Demote', icon: TrendingDown },
          { key: 'individual', label: 'Individual Action', icon: Users }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setResults(null) }}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-teal-500 text-teal-600 dark:text-teal-400 bg-teal-50/50 dark:bg-teal-900/20'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Configuration Panel */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {activeTab === 'individual' ? 'Student Selection' : 'Promotion Configuration'}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Source Class */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Source Class</label>
            <select
              value={sourceClass}
              onChange={e => { setSourceClass(e.target.value); setSourceSection(''); setSelectedStudents(new Set()); setExcludedStudents(new Set()); setResults(null) }}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            >
              <option value="">Select class</option>
              {classes.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Source Section */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Source Section</label>
            <select
              value={sourceSection}
              onChange={e => { setSourceSection(e.target.value); setSelectedStudents(new Set()); setExcludedStudents(new Set()) }}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            >
              <option value="">All sections</option>
              {availableSections.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Target Class */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target Class</label>
            <select
              value={targetClass}
              onChange={e => setTargetClass(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            >
              <option value="">Auto (next class)</option>
              {classes.map(c => <option key={c} value={c}>{c}</option>)}
              <option value="GRADUATED">Graduated / Alumni</option>
            </select>
          </div>

          {/* Target Section */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target Section</label>
            <select
              value={targetSection}
              onChange={e => setTargetSection(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            >
              <option value="">Keep current section</option>
              {availableSections.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Academic Year */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Academic Year</label>
            <input
              type="text"
              value={academicYear}
              onChange={e => setAcademicYear(e.target.value)}
              placeholder="2026-2027"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>

          {/* Remarks */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Remarks</label>
            <input
              type="text"
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              placeholder="Optional remarks"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>

          {/* Force Override */}
          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={forceOverride}
                onChange={e => setForceOverride(e.target.checked)}
                className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
              />
              Force override (allow re-promotion)
            </label>
          </div>
        </div>
      </div>

      {/* Student List */}
      {sourceClass && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                Students in {sourceClass}{sourceSection ? `-${sourceSection}` : ''}
                <span className="ml-2 text-gray-500 font-normal">({filteredStudents.length} found)</span>
              </h3>
              {activeTab !== 'individual' && (
                <button
                  onClick={toggleSelectAll}
                  className="text-xs text-teal-600 dark:text-teal-400 hover:underline"
                >
                  {selectedStudents.size === filteredStudents.length ? 'Deselect all' : 'Select all'}
                </button>
              )}
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search students..."
                className="pl-9 pr-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
          </div>

          {loadingStudents ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-teal-500" />
              <span className="ml-2 text-sm text-gray-500">Loading students...</span>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-500">No students found</div>
          ) : (
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50 dark:bg-gray-700/50 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <tr>
                    {activeTab !== 'individual' && <th className="px-4 py-3 w-10"></th>}
                    <th className="px-4 py-3">Adm. No</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Roll No</th>
                    <th className="px-4 py-3">Section</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {filteredStudents.map(student => {
                    const isExcluded = excludedStudents.has(student._id)
                    return (
                      <tr key={student._id} className={`hover:bg-gray-50 dark:hover:bg-gray-700/30 ${isExcluded ? 'opacity-50 bg-red-50 dark:bg-red-900/10' : ''}`}>
                        {activeTab !== 'individual' && (
                          <td className="px-4 py-2.5">
                            <button onClick={() => toggleStudent(student._id)}>
                              {selectedStudents.has(student._id) ? (
                                <CheckSquare className="w-4 h-4 text-teal-500" />
                              ) : (
                                <Square className="w-4 h-4 text-gray-400" />
                              )}
                            </button>
                          </td>
                        )}
                        <td className="px-4 py-2.5 font-mono text-xs text-gray-600 dark:text-gray-400">{student.admissionNumber || '-'}</td>
                        <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-white">{student.name || `${student.firstName || ''} ${student.lastName || ''}`.trim() || '-'}</td>
                        <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">{student.rollNumber || '-'}</td>
                        <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">{student.section || '-'}</td>
                        <td className="px-4 py-2.5">
                          {activeTab === 'individual' ? (
                            <div className="flex gap-1">
                              <button
                                onClick={() => { setIndividualStudent(student); setIndividualAction('promote') }}
                                className="px-2 py-1 text-xs rounded bg-teal-50 text-teal-700 hover:bg-teal-100 dark:bg-teal-900/30 dark:text-teal-300"
                              >
                                Promote
                              </button>
                              <button
                                onClick={() => { setIndividualStudent(student); setIndividualAction('demote') }}
                                className="px-2 py-1 text-xs rounded bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300"
                              >
                                Demote
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => toggleExclude(student._id)}
                              className={`text-xs px-2 py-1 rounded ${isExcluded ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-600 dark:text-gray-300'}`}
                            >
                              {isExcluded ? 'Excluded' : 'Exclude'}
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

          {/* Bulk Action Bar */}
          {activeTab !== 'individual' && filteredStudents.length > 0 && (
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-700/30 rounded-b-xl">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium text-gray-900 dark:text-white">{filteredStudents.length - excludedStudents.size}</span> students will be {activeTab === 'promote' ? 'promoted' : 'demoted'}
                {excludedStudents.size > 0 && <span className="text-amber-600"> ({excludedStudents.size} excluded)</span>}
                {targetClass && <span> to <span className="font-medium">{targetClass}</span></span>}
              </div>
              <button
                onClick={() => setShowConfirm(true)}
                disabled={bulkPromoteMutation.isPending || !academicYear}
                className="px-6 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {bulkPromoteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
                {activeTab === 'promote' ? 'Promote All' : 'Demote All'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Confirmation Dialog */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowConfirm(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Confirm Bulk {activeTab === 'promote' ? 'Promotion' : 'Demotion'}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  This will {activeTab === 'promote' ? 'promote' : 'demote'}{' '}
                  <strong>{filteredStudents.length - excludedStudents.size}</strong> students from{' '}
                  <strong>{sourceClass}{sourceSection ? `-${sourceSection}` : ''}</strong> to{' '}
                  <strong>{targetClass || 'next class'}</strong> for academic year <strong>{academicYear}</strong>.
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">This action can be undone within 7 days.</p>
              </div>
            </div>
            <div className="flex gap-3 mt-6 justify-end">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkPromote}
                disabled={bulkPromoteMutation.isPending}
                className="px-4 py-2 text-sm rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50 flex items-center gap-2"
              >
                {bulkPromoteMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirm {activeTab === 'promote' ? 'Promotion' : 'Demotion'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Individual Action Modal */}
      {individualStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setIndividualStudent(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {individualAction === 'promote' ? 'Promote' : 'Demote'} Student
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {individualStudent.name || `${individualStudent.firstName || ''} ${individualStudent.lastName || ''}`.trim()}{' '}
              ({individualStudent.admissionNumber}) — Currently in {individualStudent.class}-{individualStudent.section}
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Target Class</label>
                <select
                  value={targetClass}
                  onChange={e => setTargetClass(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm"
                >
                  <option value="">Auto (next class)</option>
                  {classes.map(c => <option key={c} value={c}>{c}</option>)}
                  <option value="GRADUATED">Graduated</option>
                </select>
              </div>

              {individualAction === 'demote' && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Reason (required)</label>
                  <input
                    type="text"
                    value={individualReason}
                    onChange={e => setIndividualReason(e.target.value)}
                    placeholder="Reason for demotion"
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6 justify-end">
              <button onClick={() => setIndividualStudent(null)} className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
              <button
                onClick={handleIndividualAction}
                disabled={individualPromoteMutation.isPending || (individualAction === 'demote' && (!individualReason || !targetClass))}
                className={`px-4 py-2 text-sm rounded-lg text-white flex items-center gap-2 disabled:opacity-50 ${individualAction === 'promote' ? 'bg-teal-600 hover:bg-teal-700' : 'bg-amber-600 hover:bg-amber-700'}`}
              >
                {individualPromoteMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                {individualAction === 'promote' ? 'Promote' : 'Demote'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Results Summary */}
      {results && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-teal-500" />
            Promotion Results
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            {[
              { label: 'Promoted', value: results.promoted, color: 'teal' },
              { label: 'Graduated', value: results.graduated, color: 'blue' },
              { label: 'Skipped', value: results.skipped, color: 'amber' },
              { label: 'Failed', value: results.failed, color: 'red' }
            ].map(stat => (
              <div key={stat.label} className={`p-3 rounded-lg bg-${stat.color}-50 dark:bg-${stat.color}-900/20 border border-${stat.color}-200 dark:border-${stat.color}-800`}>
                <p className={`text-2xl font-bold text-${stat.color}-600 dark:text-${stat.color}-400`}>{stat.value}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Detailed results */}
          {results.details && results.details.length > 0 && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-teal-600">
                View detailed results ({results.details.length} entries)
              </summary>
              <div className="mt-2 max-h-60 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 dark:bg-gray-700/50">
                    <tr>
                      <th className="px-3 py-2 text-left">Student</th>
                      <th className="px-3 py-2 text-left">Status</th>
                      <th className="px-3 py-2 text-left">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
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
                        <td className="px-3 py-1.5 text-gray-500">{d.reason || (d.toClass ? `→ ${d.toClass}-${d.toSection || ''}` : '')}</td>
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
