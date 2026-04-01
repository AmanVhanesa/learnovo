import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  ArrowRightLeft, Merge, Split, Users, Loader2, AlertTriangle,
  ChevronRight, RefreshCw
} from 'lucide-react'
import { transitionsService } from '../services/transitionsService'
import AcademicTransitionNav from '../components/AcademicTransitionNav'
import { studentsService } from '../services/studentsService'
import { sortClasses } from '../utils/classOrder'

export default function SectionManagement() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('shift') // shift | merge | split
  const [selectedClass, setSelectedClass] = useState('')

  // Shift state
  const [shiftFromSection, setShiftFromSection] = useState('')
  const [shiftToSection, setShiftToSection] = useState('')
  const [shiftStudentIds, setShiftStudentIds] = useState(new Set())

  // Merge state
  const [mergeSources, setMergeSources] = useState([])
  const [mergeTargets, setMergeTargets] = useState([])
  const [mergeDistribution, setMergeDistribution] = useState('even')

  // Split state
  const [splitSource, setSplitSource] = useState('')
  const [splitTargets, setSplitTargets] = useState([])
  const [splitDistribution, setSplitDistribution] = useState('even')

  const [showConfirm, setShowConfirm] = useState(null)
  const [results, setResults] = useState(null)

  // Get class list from student filters
  const { data: filtersData } = useQuery({
    queryKey: ['student-filters'],
    queryFn: () => studentsService.getFilters()
  })

  // Get sections for the selected class (per-class, per-tenant, with student counts)
  const { data: sectionsData, isLoading: loadingSections } = useQuery({
    queryKey: ['class-sections', selectedClass],
    queryFn: () => transitionsService.getSectionsForClass(selectedClass),
    enabled: !!selectedClass
  })

  // Get students for shift tab
  const { data: studentsData, isLoading: loadingStudents } = useQuery({
    queryKey: ['section-students', selectedClass, shiftFromSection],
    queryFn: () => studentsService.list({
      class: selectedClass,
      section: shiftFromSection || undefined,
      status: 'active',
      limit: 500,
      lightweight: true
    }),
    enabled: !!selectedClass && activeTab === 'shift' && !!shiftFromSection
  })

  const rawClasses = filtersData?.data?.classes || filtersData?.classes || []
  const classes = useMemo(() => sortClasses(rawClasses), [rawClasses])
  const classSections = sectionsData?.data || [] // [{name, studentCount, capacity, currentStrength}]
  const students = studentsData?.data || studentsData?.students || []

  // Helper: get student count for a section name
  const getStudentCount = (sectionName) => {
    const sec = classSections.find(s => s.name === sectionName)
    return sec?.studentCount ?? sec?.currentStrength ?? 0
  }

  // Reset section selections when class changes
  const handleClassChange = (cls) => {
    setSelectedClass(cls)
    setShiftFromSection('')
    setShiftToSection('')
    setShiftStudentIds(new Set())
    setMergeSources([])
    setMergeTargets([])
    setSplitSource('')
    setSplitTargets([])
    setResults(null)
  }

  // Mutations
  const bulkShiftMutation = useMutation({
    mutationFn: (payload) => transitionsService.bulkShiftSection(payload),
    onSuccess: (data) => {
      setResults(data.data)
      setShowConfirm(null)
      setShiftStudentIds(new Set())
      queryClient.invalidateQueries({ queryKey: ['section-students'] })
      queryClient.invalidateQueries({ queryKey: ['class-sections'] })
      toast.success(`Shift complete: ${data.data.shifted} students shifted`)
    },
    onError: (error) => toast.error(error.response?.data?.message || error.response?.data?.errors?.[0] || 'Shift failed')
  })

  const mergeMutation = useMutation({
    mutationFn: (payload) => transitionsService.mergeSections(payload),
    onSuccess: (data) => {
      setResults(data.data)
      setShowConfirm(null)
      queryClient.invalidateQueries({ queryKey: ['section-students'] })
      queryClient.invalidateQueries({ queryKey: ['class-sections'] })
      queryClient.invalidateQueries({ queryKey: ['student-filters'] })
      toast.success(`Merge complete: ${data.data.merged} students redistributed`)
    },
    onError: (error) => toast.error(error.response?.data?.message || error.response?.data?.errors?.[0] || 'Merge failed')
  })

  const splitMutation = useMutation({
    mutationFn: (payload) => transitionsService.splitSection(payload),
    onSuccess: (data) => {
      setResults(data.data)
      setShowConfirm(null)
      queryClient.invalidateQueries({ queryKey: ['section-students'] })
      queryClient.invalidateQueries({ queryKey: ['class-sections'] })
      toast.success(`Split complete: ${data.data.merged} students redistributed`)
    },
    onError: (error) => toast.error(error.response?.data?.message || error.response?.data?.errors?.[0] || 'Split failed')
  })

  const recalcMutation = useMutation({
    mutationFn: () => transitionsService.recalculateStrengths(),
    onSuccess: (data) => {
      toast.success(data.message)
      queryClient.invalidateQueries({ queryKey: ['class-sections'] })
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Recalculation failed')
  })

  const toggleShiftStudent = (id) => {
    const next = new Set(shiftStudentIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setShiftStudentIds(next)
  }

  const handleShift = () => {
    bulkShiftMutation.mutate({
      className: selectedClass,
      fromSection: shiftFromSection,
      toSection: shiftToSection,
      studentIds: shiftStudentIds.size > 0 ? Array.from(shiftStudentIds) : undefined
    })
  }

  const handleMerge = () => {
    mergeMutation.mutate({
      className: selectedClass,
      sourceSections: mergeSources,
      targetSections: mergeTargets,
      distribution: mergeDistribution
    })
  }

  const handleSplit = () => {
    splitMutation.mutate({
      className: selectedClass,
      sourceSection: splitSource,
      targetSections: splitTargets,
      distribution: splitDistribution
    })
  }

  const toggleArrayItem = (arr, setArr, item) => {
    if (arr.includes(item)) setArr(arr.filter(i => i !== item))
    else setArr([...arr, item])
  }

  // Section names for dropdowns/buttons
  const sectionNames = classSections.map(s => s.name)

  return (
    <div className="space-y-6">
      {/* Sub-nav */}
      <AcademicTransitionNav />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Section Management</h1>
          <p className="text-sm text-gray-500 dark:text-[#8E8E93] mt-1">Shift students between sections, merge or split sections</p>
        </div>
        <button
          onClick={() => recalcMutation.mutate()}
          disabled={recalcMutation.isPending}
          className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-[#38383A] text-gray-700 dark:text-[#8E8E93] hover:bg-gray-50 dark:hover:bg-[#2C2C2E]"
        >
          <RefreshCw className={`w-4 h-4 ${recalcMutation.isPending ? 'animate-spin' : ''}`} />
          Recalculate Strengths
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-[#38383A]">
        {[
          { key: 'shift', label: 'Section Shift', icon: ArrowRightLeft },
          { key: 'merge', label: 'Merge Sections', icon: Merge },
          { key: 'split', label: 'Split Section', icon: Split }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setResults(null) }}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-teal-500 text-teal-600 dark:text-teal-400 bg-teal-50/50 dark:bg-teal-900/20'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-[#8E8E93]'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Class Selector + Section Overview */}
      <div className="bg-white dark:bg-[#1C1C1E] rounded-xl shadow-sm border border-gray-200 dark:border-[#38383A] p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">Class</label>
            <select
              value={selectedClass}
              onChange={e => handleClassChange(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-[#38383A] bg-white dark:bg-[#2C2C2E] text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500"
            >
              <option value="">Select class</option>
              {classes.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Tab-specific config */}
          {activeTab === 'shift' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">From Section</label>
                <select
                  value={shiftFromSection}
                  onChange={e => { setShiftFromSection(e.target.value); setShiftStudentIds(new Set()) }}
                  className="w-full rounded-lg border border-gray-300 dark:border-[#38383A] bg-white dark:bg-[#2C2C2E] text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500"
                  disabled={!selectedClass || loadingSections}
                >
                  <option value="">Select section</option>
                  {sectionNames.map(s => (
                    <option key={s} value={s}>{s} ({getStudentCount(s)} students)</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">To Section</label>
                <select
                  value={shiftToSection}
                  onChange={e => setShiftToSection(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-[#38383A] bg-white dark:bg-[#2C2C2E] text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500"
                  disabled={!selectedClass || loadingSections}
                >
                  <option value="">Select target section</option>
                  {sectionNames.filter(s => s !== shiftFromSection).map(s => (
                    <option key={s} value={s}>{s} ({getStudentCount(s)} students)</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {activeTab === 'merge' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">Source Sections (to dissolve)</label>
                {loadingSections ? (
                  <div className="flex items-center gap-2 mt-2 text-sm text-gray-400"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</div>
                ) : sectionNames.length === 0 ? (
                  <p className="text-xs text-gray-400 mt-2">{selectedClass ? 'No sections found for this class' : 'Select a class first'}</p>
                ) : (
                  <div className="flex flex-wrap gap-2 mt-1">
                    {sectionNames.map(s => {
                      const count = getStudentCount(s)
                      const isTarget = mergeTargets.includes(s)
                      const isEmpty = count === 0
                      return (
                        <button
                          key={s}
                          onClick={() => !isTarget && toggleArrayItem(mergeSources, setMergeSources, s)}
                          disabled={isTarget}
                          className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                            mergeSources.includes(s)
                              ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-900/30 dark:text-red-300'
                              : isTarget
                                ? 'border-gray-200 bg-gray-100 text-gray-400 dark:border-[#38383A] dark:bg-[#1C1C1E] dark:text-[#636366] cursor-not-allowed'
                                : isEmpty
                                  ? 'border-gray-200 bg-gray-50 text-gray-400 dark:border-[#38383A] dark:bg-[#1C1C1E] dark:text-[#8E8E93]'
                                  : 'border-gray-300 dark:border-[#38383A] text-gray-700 dark:text-[#8E8E93] hover:bg-gray-50 dark:hover:bg-[#2C2C2E]'
                          }`}
                        >
                          {s} <span className="text-xs opacity-70">({count})</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">Target Sections (absorb into)</label>
                {!loadingSections && sectionNames.length > 0 && (
                  <>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {sectionNames.filter(s => !mergeSources.includes(s)).map(s => {
                        const count = getStudentCount(s)
                        return (
                          <button
                            key={s}
                            onClick={() => toggleArrayItem(mergeTargets, setMergeTargets, s)}
                            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                              mergeTargets.includes(s)
                                ? 'border-teal-300 bg-teal-50 text-teal-700 dark:border-teal-700 dark:bg-teal-900/30 dark:text-teal-300'
                                : 'border-gray-300 dark:border-[#38383A] text-gray-700 dark:text-[#8E8E93] hover:bg-gray-50 dark:hover:bg-[#2C2C2E]'
                            }`}
                          >
                            {s} <span className="text-xs opacity-70">({count})</span>
                          </button>
                        )
                      })}
                    </div>
                    <div className="mt-2">
                      <label className="text-xs text-gray-500 dark:text-[#8E8E93]">Distribution:</label>
                      <select
                        value={mergeDistribution}
                        onChange={e => setMergeDistribution(e.target.value)}
                        className="ml-2 rounded border border-gray-300 dark:border-[#38383A] bg-white dark:bg-[#2C2C2E] text-gray-900 dark:text-white px-2 py-1 text-xs"
                      >
                        <option value="even">Even</option>
                        <option value="manual">Manual</option>
                      </select>
                    </div>
                  </>
                )}
              </div>
            </>
          )}

          {activeTab === 'split' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">Source Section (to split)</label>
                <select
                  value={splitSource}
                  onChange={e => setSplitSource(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-[#38383A] bg-white dark:bg-[#2C2C2E] text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500"
                  disabled={!selectedClass || loadingSections}
                >
                  <option value="">Select section</option>
                  {sectionNames.map(s => (
                    <option key={s} value={s}>{s} ({getStudentCount(s)} students)</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">Target Sections</label>
                {!loadingSections && sectionNames.length > 0 ? (
                  <>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {sectionNames.map(s => (
                        <button
                          key={s}
                          onClick={() => toggleArrayItem(splitTargets, setSplitTargets, s)}
                          className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                            splitTargets.includes(s)
                              ? 'border-teal-300 bg-teal-50 text-teal-700 dark:border-teal-700 dark:bg-teal-900/30 dark:text-teal-300'
                              : 'border-gray-300 dark:border-[#38383A] text-gray-700 dark:text-[#8E8E93] hover:bg-gray-50 dark:hover:bg-[#2C2C2E]'
                          }`}
                        >
                          {s} <span className="text-xs opacity-70">({getStudentCount(s)})</span>
                        </button>
                      ))}
                    </div>
                    <div className="mt-2">
                      <label className="text-xs text-gray-500 dark:text-[#8E8E93]">Distribution:</label>
                      <select
                        value={splitDistribution}
                        onChange={e => setSplitDistribution(e.target.value)}
                        className="ml-2 rounded border border-gray-300 dark:border-[#38383A] bg-white dark:bg-[#2C2C2E] text-gray-900 dark:text-white px-2 py-1 text-xs"
                      >
                        <option value="even">Even</option>
                        <option value="manual">Manual</option>
                      </select>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-gray-400 mt-2">{selectedClass ? 'No sections found' : 'Select a class first'}</p>
                )}
              </div>
            </>
          )}
        </div>

        {/* Section Overview (when class selected) */}
        {selectedClass && classSections.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-[#38383A]">
            <p className="text-xs font-medium text-gray-500 dark:text-[#8E8E93] mb-2">Section Overview for {selectedClass}</p>
            <div className="flex flex-wrap gap-2">
              {classSections.map(s => (
                <div key={s.name} className="px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-[#2C2C2E] border border-gray-200 dark:border-[#38383A] text-sm">
                  <span className="font-medium text-gray-900 dark:text-white">{s.name}</span>
                  <span className="text-gray-500 dark:text-[#8E8E93] ml-1.5">{s.studentCount} / {s.capacity}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-6 flex justify-end">
          {activeTab === 'shift' && (
            <button
              onClick={() => setShowConfirm('shift')}
              disabled={!selectedClass || !shiftFromSection || !shiftToSection || bulkShiftMutation.isPending}
              className="px-6 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {bulkShiftMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />}
              Shift {shiftStudentIds.size > 0 ? `${shiftStudentIds.size} Students` : 'All Students'}
            </button>
          )}
          {activeTab === 'merge' && (
            <button
              onClick={() => setShowConfirm('merge')}
              disabled={!selectedClass || mergeSources.length === 0 || mergeTargets.length === 0 || mergeMutation.isPending}
              className="px-6 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {mergeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Merge className="w-4 h-4" />}
              Merge Sections
            </button>
          )}
          {activeTab === 'split' && (
            <button
              onClick={() => setShowConfirm('split')}
              disabled={!selectedClass || !splitSource || splitTargets.length < 2 || splitMutation.isPending}
              className="px-6 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {splitMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Split className="w-4 h-4" />}
              Split Section
            </button>
          )}
        </div>
      </div>

      {/* Student List (for shift tab) */}
      {activeTab === 'shift' && selectedClass && shiftFromSection && (
        <div className="bg-white dark:bg-[#1C1C1E] rounded-xl shadow-sm border border-gray-200 dark:border-[#38383A]">
          <div className="p-4 border-b border-gray-200 dark:border-[#38383A]">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Students in {selectedClass}-{shiftFromSection}
              <span className="ml-2 text-gray-500 font-normal">({students.length})</span>
            </h3>
            <p className="text-xs text-gray-500 mt-1">Select specific students to shift, or leave unselected to shift all.</p>
          </div>

          {loadingStudents ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-teal-500" />
            </div>
          ) : students.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500">No students found in this section</div>
          ) : (
            <div className="overflow-x-auto max-h-[350px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50 dark:bg-[#2C2C2E] text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={shiftStudentIds.size === students.length && students.length > 0}
                        onChange={() => {
                          if (shiftStudentIds.size === students.length) setShiftStudentIds(new Set())
                          else setShiftStudentIds(new Set(students.map(s => s._id)))
                        }}
                        className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                      />
                    </th>
                    <th className="px-4 py-3">Adm. No</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Roll No</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-[#38383A]">
                  {students.map(s => (
                    <tr key={s._id} className="hover:bg-gray-50 dark:hover:bg-[#2C2C2E]/50">
                      <td className="px-4 py-2.5">
                        <input
                          type="checkbox"
                          checked={shiftStudentIds.has(s._id)}
                          onChange={() => toggleShiftStudent(s._id)}
                          className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                        />
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-gray-600 dark:text-[#8E8E93]">{s.admissionNumber || '-'}</td>
                      <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-white">{s.name || `${s.firstName || ''} ${s.lastName || ''}`.trim() || '-'}</td>
                      <td className="px-4 py-2.5 text-gray-600 dark:text-[#8E8E93]">{s.rollNumber || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Confirmation Dialog */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowConfirm(null)}>
          <div className="bg-white dark:bg-[#1C1C1E] rounded-xl shadow-2xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Confirm {showConfirm === 'shift' ? 'Section Shift' : showConfirm === 'merge' ? 'Section Merge' : 'Section Split'}
                </h3>
                <p className="text-sm text-gray-600 dark:text-[#8E8E93] mt-2">
                  {showConfirm === 'shift' && `Move ${shiftStudentIds.size > 0 ? shiftStudentIds.size : 'all'} students from ${selectedClass}-${shiftFromSection} to ${selectedClass}-${shiftToSection}`}
                  {showConfirm === 'merge' && `Merge sections ${mergeSources.join(', ')} into ${mergeTargets.join(', ')} for class ${selectedClass}`}
                  {showConfirm === 'split' && `Split section ${splitSource} into ${splitTargets.join(', ')} for class ${selectedClass}`}
                </p>
              </div>
            </div>
            <div className="flex gap-3 mt-6 justify-end">
              <button onClick={() => setShowConfirm(null)} className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-[#38383A] text-gray-700 dark:text-[#8E8E93] hover:bg-gray-50 dark:hover:bg-[#2C2C2E]">Cancel</button>
              <button
                onClick={() => {
                  if (showConfirm === 'shift') handleShift()
                  else if (showConfirm === 'merge') handleMerge()
                  else handleSplit()
                }}
                disabled={bulkShiftMutation.isPending || mergeMutation.isPending || splitMutation.isPending}
                className="px-4 py-2 text-sm rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50 flex items-center gap-2"
              >
                {(bulkShiftMutation.isPending || mergeMutation.isPending || splitMutation.isPending) && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {results && (
        <div className="bg-white dark:bg-[#1C1C1E] rounded-xl shadow-sm border border-gray-200 dark:border-[#38383A] p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Results</h3>
          {results.shifted !== undefined && (
            <p className="text-sm text-gray-600 dark:text-[#8E8E93]">{results.shifted} students shifted, {results.skipped} skipped, {results.failed} failed</p>
          )}
          {results.merged !== undefined && (
            <div>
              <p className="text-sm text-gray-600 dark:text-[#8E8E93]">{results.merged} students redistributed</p>
              {results.distribution && (
                <div className="mt-2 flex gap-3">
                  {Object.entries(results.distribution).map(([sec, count]) => (
                    <div key={sec} className="px-3 py-2 rounded-lg bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800">
                      <span className="text-lg font-bold text-teal-600 dark:text-teal-400">{count}</span>
                      <span className="text-xs text-gray-500 dark:text-[#8E8E93] ml-1">→ Section {sec}</span>
                    </div>
                  ))}
                </div>
              )}
              {results.sourceSectionsRemoved?.length > 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">Sections deactivated: {results.sourceSectionsRemoved.join(', ')}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
