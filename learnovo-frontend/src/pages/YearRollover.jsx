import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  CalendarClock, Play, Eye, Loader2, AlertTriangle, CheckCircle2,
  ChevronDown, ChevronUp, GraduationCap, TrendingUp, Pause, Users
} from 'lucide-react'
import { transitionsService } from '../services/transitionsService'

export default function YearRollover() {
  const queryClient = useQueryClient()

  const [step, setStep] = useState(1) // 1: Configure, 2: Preview, 3: Execute, 4: Results
  const [currentYear, setCurrentYear] = useState(() => {
    const y = new Date().getFullYear()
    const m = new Date().getMonth()
    // If before April (Indian academic year), current year started last year
    return m < 3 ? `${y - 1}-${y}` : `${y}-${y + 1}`
  })
  const [newYear, setNewYear] = useState(() => {
    const y = new Date().getFullYear()
    const m = new Date().getMonth()
    return m < 3 ? `${y}-${y + 1}` : `${y + 1}-${y + 2}`
  })
  const [highestClass, setHighestClass] = useState('')
  const [promotionRules, setPromotionRules] = useState({
    autoPromotePassingStudents: true,
    passThreshold: 40,
    requireFeesClear: false,
    excludeTCIssued: true
  })
  const [previewData, setPreviewData] = useState(null)
  const [finalResults, setFinalResults] = useState(null)
  const [expandedClasses, setExpandedClasses] = useState(new Set())

  const { data: hierarchyData } = useQuery({
    queryKey: ['class-hierarchy'],
    queryFn: () => transitionsService.getClassHierarchy()
  })

  const hierarchy = hierarchyData?.data || []

  // Auto-detect highest class
  const terminalClass = hierarchy.find(h => h.isTerminal)?.name || hierarchy[hierarchy.length - 1]?.name || ''

  const previewMutation = useMutation({
    mutationFn: (payload) => transitionsService.yearRollover(payload),
    onSuccess: (data) => {
      setPreviewData(data.data)
      setStep(2)
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Preview failed')
  })

  const executeMutation = useMutation({
    mutationFn: (payload) => transitionsService.yearRollover(payload),
    onSuccess: (data) => {
      setFinalResults(data.data)
      setStep(4)
      queryClient.invalidateQueries()
      toast.success('Year-end rollover completed successfully!')
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Rollover failed')
  })

  const handlePreview = () => {
    previewMutation.mutate({
      currentYear,
      newYear,
      promotionRules,
      highestClass: highestClass || terminalClass,
      dryRun: true
    })
  }

  const handleExecute = () => {
    executeMutation.mutate({
      currentYear,
      newYear,
      promotionRules,
      highestClass: highestClass || terminalClass,
      dryRun: false
    })
  }

  const toggleClassExpand = (cls) => {
    const next = new Set(expandedClasses)
    if (next.has(cls)) next.delete(cls)
    else next.add(cls)
    setExpandedClasses(next)
  }

  const renderSummaryCards = (summary) => (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {[
        { label: 'Total Students', value: summary.totalStudents, icon: Users, color: 'gray' },
        { label: 'Promoted', value: summary.promoted, icon: TrendingUp, color: 'teal' },
        { label: 'Detained', value: summary.detained, icon: Pause, color: 'amber' },
        { label: 'Graduated', value: summary.graduated, icon: GraduationCap, color: 'blue' },
        { label: 'Skipped', value: summary.skipped, icon: AlertTriangle, color: 'red' }
      ].map(stat => (
        <div key={stat.label} className={`p-4 rounded-xl bg-${stat.color}-50 dark:bg-${stat.color}-900/20 border border-${stat.color}-200 dark:border-${stat.color}-800`}>
          <div className="flex items-center gap-2 mb-1">
            <stat.icon className={`w-4 h-4 text-${stat.color}-500`} />
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{stat.label}</span>
          </div>
          <p className={`text-2xl font-bold text-${stat.color}-600 dark:text-${stat.color}-400`}>{stat.value}</p>
        </div>
      ))}
    </div>
  )

  const renderByClass = (byClass) => (
    <div className="space-y-2 mt-4">
      {Object.entries(byClass).map(([className, data]) => (
        <div key={className} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <button
            onClick={() => toggleClassExpand(className)}
            className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 text-left"
          >
            <div className="flex items-center gap-3">
              <span className="font-medium text-gray-900 dark:text-white">{className}</span>
              <div className="flex gap-2 text-xs">
                {data.promoted > 0 && <span className="px-2 py-0.5 rounded bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300">{data.promoted} promoted</span>}
                {data.detained > 0 && <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">{data.detained} detained</span>}
                {data.graduated > 0 && <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">{data.graduated} graduated</span>}
              </div>
            </div>
            {expandedClasses.has(className) ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>

          {expandedClasses.has(className) && data.details && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 dark:bg-gray-700/30">
                  <tr>
                    <th className="px-4 py-2 text-left text-gray-500">Student</th>
                    <th className="px-4 py-2 text-left text-gray-500">Status</th>
                    <th className="px-4 py-2 text-left text-gray-500">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {data.details.map((d, i) => (
                    <tr key={i}>
                      <td className="px-4 py-2 text-gray-900 dark:text-white">{d.name}</td>
                      <td className="px-4 py-2">
                        <span className={`px-1.5 py-0.5 rounded font-medium ${
                          d.status === 'promoted' ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300' :
                          d.status === 'graduated' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                          d.status === 'detained' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' :
                          'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                        }`}>{d.status}</span>
                      </td>
                      <td className="px-4 py-2 text-gray-500">{d.toClass ? `→ ${d.toClass}` : d.reason || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <CalendarClock className="w-7 h-7 text-teal-500" />
          Year-End Rollover
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Transition the entire school to a new academic year</p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-2">
        {['Configure', 'Preview', 'Execute', 'Results'].map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              step > i + 1 ? 'bg-teal-500 text-white' :
              step === i + 1 ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300 ring-2 ring-teal-500' :
              'bg-gray-100 text-gray-400 dark:bg-gray-700'
            }`}>
              {step > i + 1 ? <CheckCircle2 className="w-5 h-5" /> : i + 1}
            </div>
            <span className={`text-sm ${step === i + 1 ? 'font-medium text-gray-900 dark:text-white' : 'text-gray-400'}`}>{label}</span>
            {i < 3 && <div className={`w-8 h-0.5 ${step > i + 1 ? 'bg-teal-500' : 'bg-gray-200 dark:bg-gray-700'}`} />}
          </div>
        ))}
      </div>

      {/* Step 1: Configure */}
      {step === 1 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Rollover Configuration</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Current Academic Year</label>
              <input
                type="text"
                value={currentYear}
                onChange={e => setCurrentYear(e.target.value)}
                placeholder="2025-2026"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New Academic Year</label>
              <input
                type="text"
                value={newYear}
                onChange={e => setNewYear(e.target.value)}
                placeholder="2026-2027"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Highest Class (graduates from here)</label>
              <select
                value={highestClass}
                onChange={e => setHighestClass(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500"
              >
                <option value="">{terminalClass ? `Auto (${terminalClass})` : 'Select class'}</option>
                {hierarchy.map(h => <option key={h.name} value={h.name}>{h.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Pass Threshold (%)</label>
              <input
                type="number"
                value={promotionRules.passThreshold}
                onChange={e => setPromotionRules({ ...promotionRules, passThreshold: parseInt(e.target.value) || 0 })}
                min={0}
                max={100}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={promotionRules.autoPromotePassingStudents}
                onChange={e => setPromotionRules({ ...promotionRules, autoPromotePassingStudents: e.target.checked })}
                className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
              />
              Auto-promote all passing students
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={promotionRules.requireFeesClear}
                onChange={e => setPromotionRules({ ...promotionRules, requireFeesClear: e.target.checked })}
                className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
              />
              Require all fees cleared before promotion
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={promotionRules.excludeTCIssued}
                onChange={e => setPromotionRules({ ...promotionRules, excludeTCIssued: e.target.checked })}
                className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
              />
              Exclude TC-issued / transferred students
            </label>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handlePreview}
              disabled={!currentYear || !newYear || previewMutation.isPending}
              className="px-6 py-2.5 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:opacity-50 flex items-center gap-2"
            >
              {previewMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
              Preview Rollover
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Preview */}
      {step === 2 && previewData && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Rollover Preview</h2>
              <span className="text-xs px-2 py-1 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">DRY RUN — No changes made</span>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Transitioning from <strong>{currentYear}</strong> to <strong>{newYear}</strong>
            </p>

            {renderSummaryCards(previewData.summary)}
            {previewData.byClass && renderByClass(previewData.byClass)}
          </div>

          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Back to Configure
            </button>
            <button
              onClick={() => setStep(3)}
              className="px-6 py-2.5 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              Proceed to Execute
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Execute */}
      {step === 3 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-start gap-4">
            <AlertTriangle className="w-8 h-8 text-amber-500 flex-shrink-0" />
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Execute Year-End Rollover</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                This will permanently transition <strong>{previewData?.summary?.totalStudents || 0}</strong> students from{' '}
                <strong>{currentYear}</strong> to <strong>{newYear}</strong>.
              </p>
              <ul className="text-sm text-gray-600 dark:text-gray-400 mt-3 space-y-1 list-disc list-inside">
                <li><strong>{previewData?.summary?.promoted || 0}</strong> students will be promoted to the next class</li>
                <li><strong>{previewData?.summary?.detained || 0}</strong> students will be detained in the same class</li>
                <li><strong>{previewData?.summary?.graduated || 0}</strong> students will be graduated (marked as alumni)</li>
                <li>The school&apos;s current academic year will be updated to <strong>{newYear}</strong></li>
              </ul>
              <p className="text-xs text-red-600 dark:text-red-400 mt-3 font-medium">This action affects all students and cannot be easily undone in bulk.</p>
            </div>
          </div>

          <div className="flex gap-3 mt-6 justify-end">
            <button onClick={() => setStep(2)} className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
              Back to Preview
            </button>
            <button
              onClick={handleExecute}
              disabled={executeMutation.isPending}
              className="px-6 py-2.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
            >
              {executeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {executeMutation.isPending ? 'Processing...' : 'Execute Rollover'}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Results */}
      {step === 4 && finalResults && (
        <div className="space-y-4">
          <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-xl p-4 flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-teal-500" />
            <div>
              <p className="font-medium text-teal-800 dark:text-teal-300">Year-end rollover completed successfully</p>
              <p className="text-sm text-teal-600 dark:text-teal-400">{currentYear} → {newYear}</p>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Final Results</h2>
            {renderSummaryCards(finalResults.summary)}
            {finalResults.byClass && renderByClass(finalResults.byClass)}
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => { setStep(1); setPreviewData(null); setFinalResults(null) }}
              className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
