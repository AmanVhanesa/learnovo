import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Users, FileText, AlertCircle, CheckCircle, Calendar, ChevronDown,
  ChevronUp, Settings, Play, Ban, Percent, Eye, RefreshCw, Tag, X, Pencil
} from 'lucide-react'
import toast from 'react-hot-toast'
import { allocationsService } from '../../services/feesService'
import { classesService } from '../../services/academicsService'
import { formatCurrency } from '../../utils/formatCurrency'
import { sortClassObjects, dedupeClassesByName } from '../../utils/classOrder'

const PAYMENT_PLANS = [
  { value: 'monthly', label: 'Monthly (12 invoices)' },
  { value: 'quarterly', label: 'Quarterly (4 invoices)' },
  { value: 'half-yearly', label: 'Half-Yearly (2 invoices)' },
  { value: 'annual', label: 'Annual (1 invoice)' },
]

const AnnualAllocationsTab = ({ activeSession }) => {
  const queryClient = useQueryClient()
  const [selectedClassId, setSelectedClassId] = useState('')
  const [selectedPlan, setSelectedPlan] = useState('quarterly')
  const [showGenerateForm, setShowGenerateForm] = useState(false)
  const [showInvoiceGenForm, setShowInvoiceGenForm] = useState(false)
  const [invoiceDueDate, setInvoiceDueDate] = useState('')
  const [expandedAllocation, setExpandedAllocation] = useState(null)
  const [changingPlan, setChangingPlan] = useState(null)
  const [newPlan, setNewPlan] = useState('')
  const [applyingDiscount, setApplyingDiscount] = useState(null) // allocation _id being edited
  const [discountMode, setDiscountMode] = useState('fixed') // 'fixed' | 'percentage'
  const [discountForm, setDiscountForm] = useState({ value: '', reason: '' })

  // Fetch classes
  const { data: classes = [] } = useQuery({
    queryKey: ['alloc-classes'],
    queryFn: async () => { const res = await classesService.list(); return sortClassObjects(dedupeClassesByName(res.data || [], activeSession?.name), 'name') },
  })

  // Fetch allocations
  const { data: allocData, isLoading } = useQuery({
    queryKey: ['allocations', activeSession?._id, selectedClassId],
    queryFn: async () => {
      const res = await allocationsService.list({
        academicSessionId: activeSession?._id,
        classId: selectedClassId || undefined,
        limit: 200
      })
      return res
    },
    enabled: !!activeSession,
  })

  const allocations = allocData?.data || []
  const stats = allocData?.stats || {}

  // Dashboard summary
  const { data: dashboardSummary } = useQuery({
    queryKey: ['alloc-dashboard', activeSession?._id],
    queryFn: async () => {
      const res = await allocationsService.getDashboardSummary({ academicSessionId: activeSession?._id })
      return res.data
    },
    enabled: !!activeSession,
  })

  // Generate allocations mutation
  const generateMutation = useMutation({
    mutationFn: (data) => allocationsService.generate(data),
    onSuccess: (res) => {
      toast.success(res.message || 'Allocations generated')
      queryClient.invalidateQueries({ queryKey: ['allocations'] })
      queryClient.invalidateQueries({ queryKey: ['alloc-dashboard'] })
      setShowGenerateForm(false)
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to generate allocations'),
  })

  // Generate invoices from allocations (legacy 2-step flow)
  const generateInvoicesMutation = useMutation({
    mutationFn: (data) => allocationsService.generateInvoices(data),
    onSuccess: (res) => {
      toast.success(res.message || 'Invoices generated')
      queryClient.invalidateQueries({ queryKey: ['allocations'] })
      queryClient.invalidateQueries({ queryKey: ['alloc-dashboard'] })
      setShowInvoiceGenForm(false)
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to generate invoices'),
  })

  // NEW: Generate allocations + invoices in one step
  const generateAllMutation = useMutation({
    mutationFn: (data) => allocationsService.generateAll(data),
    onSuccess: (res) => {
      toast.success(res.message || 'Allocations and invoices generated')
      queryClient.invalidateQueries({ queryKey: ['allocations'] })
      queryClient.invalidateQueries({ queryKey: ['alloc-dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      setShowGenerateForm(false)
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to generate'),
  })

  // Change payment plan
  const changePlanMutation = useMutation({
    mutationFn: ({ id, plan }) => allocationsService.changePaymentPlan(id, plan),
    onSuccess: (res) => {
      toast.success(res.message || 'Payment plan changed')
      queryClient.invalidateQueries({ queryKey: ['allocations'] })
      setChangingPlan(null)
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to change plan'),
  })

  // Apply / update / remove allocation-level discount (scholarship)
  const applyDiscountMutation = useMutation({
    mutationFn: ({ id, data }) => allocationsService.applyDiscount(id, data),
    onSuccess: (res) => {
      toast.success(res.message || 'Discount updated')
      queryClient.invalidateQueries({ queryKey: ['allocations'] })
      queryClient.invalidateQueries({ queryKey: ['alloc-dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      setApplyingDiscount(null)
      setDiscountForm({ value: '', reason: '' })
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to update discount'),
  })

  const openDiscountForm = (alloc) => {
    if (alloc.discountPercentage > 0) {
      setDiscountMode('percentage')
      setDiscountForm({ value: String(alloc.discountPercentage), reason: alloc.discountReason || '' })
    } else if (alloc.discountFixed > 0) {
      setDiscountMode('fixed')
      setDiscountForm({ value: String(alloc.discountFixed), reason: alloc.discountReason || '' })
    } else {
      setDiscountMode('fixed')
      setDiscountForm({ value: '', reason: '' })
    }
    setApplyingDiscount(alloc._id)
  }

  const handleApplyDiscount = (alloc) => {
    const val = parseFloat(discountForm.value)
    if (!val || val <= 0) { toast.error('Enter a valid discount value'); return }
    if (discountMode === 'percentage' && val > 100) { toast.error('Percentage cannot exceed 100'); return }
    if (discountMode === 'fixed' && val > (alloc.totalAnnualAmount || 0)) {
      toast.error('Discount cannot exceed annual amount'); return
    }
    if (!discountForm.reason.trim()) { toast.error('Enter a reason'); return }
    applyDiscountMutation.mutate({
      id: alloc._id,
      data: {
        discountReason: discountForm.reason.trim(),
        discountPercentage: discountMode === 'percentage' ? val : 0,
        discountFixed: discountMode === 'fixed' ? val : 0,
      },
    })
  }

  const handleRemoveDiscount = (alloc) => {
    if (!window.confirm('Remove the applied discount from this allocation? Future invoices will be regenerated at full amount.')) return
    applyDiscountMutation.mutate({
      id: alloc._id,
      data: { discountPercentage: 0, discountFixed: 0, discountReason: 'Discount removed' },
    })
  }

  const handleDiscountKeyDown = (alloc) => (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleApplyDiscount(alloc)
    }
  }

  const handleGenerate = () => {
    // Use new one-step flow: creates allocations AND invoices together
    generateAllMutation.mutate({
      academicSessionId: activeSession._id,
      classId: selectedClassId || undefined,
      paymentPlan: selectedPlan,
    })
  }

  const handleGenerateInvoices = () => {
    if (!invoiceDueDate) { toast.error('Please select a due date'); return }
    generateInvoicesMutation.mutate({
      academicSessionId: activeSession._id,
      classId: selectedClassId || undefined,
      dueDate: invoiceDueDate,
    })
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Summary Cards */}
      {dashboardSummary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard
            label="Total Expected Revenue"
            value={formatCurrency(dashboardSummary.totalExpectedRevenue)}
            icon={<FileText className="h-5 w-5" />}
            color="blue"
          />
          <SummaryCard
            label="Total Collected"
            value={formatCurrency(dashboardSummary.totalCollected)}
            icon={<CheckCircle className="h-5 w-5" />}
            color="green"
            subtitle={`${dashboardSummary.collectionRate}% collection rate`}
          />
          <SummaryCard
            label="Total Outstanding"
            value={formatCurrency(dashboardSummary.totalOutstanding)}
            icon={<AlertCircle className="h-5 w-5" />}
            color="amber"
          />
          <SummaryCard
            label="Total Overdue"
            value={formatCurrency(dashboardSummary.totalOverdue)}
            icon={<AlertCircle className="h-5 w-5" />}
            color="red"
            subtitle={`${dashboardSummary.overdueInvoiceCount} invoices`}
          />
        </div>
      )}

      {/* Actions Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          className="input max-w-[200px]"
          value={selectedClassId}
          onChange={(e) => setSelectedClassId(e.target.value)}
        >
          <option value="">All Classes</option>
          {classes.map(c => (
            <option key={c._id} value={c._id}>{c.name}</option>
          ))}
        </select>

        <button
          onClick={() => setShowGenerateForm(!showGenerateForm)}
          className="btn btn-primary flex items-center gap-2"
        >
          <Play className="h-4 w-4" /> Generate Invoices
        </button>

        <button
          onClick={() => setShowInvoiceGenForm(!showInvoiceGenForm)}
          className="btn btn-outline flex items-center gap-2"
          disabled={allocations.length === 0}
        >
          <FileText className="h-4 w-4" /> Generate Invoices from Allocations
        </button>
      </div>

      {/* Generate Invoices Form (new one-step flow) */}
      {showGenerateForm && (
        <div className="bg-blue-50 dark:bg-blue-900/15 border border-blue-200 dark:border-blue-800/30 rounded-xl p-4 space-y-4">
          <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300">Generate Invoices</h3>
          <p className="text-xs text-blue-700 dark:text-blue-400">
            Creates annual fee allocations AND generates all invoices for the selected class in one step.
            Students who already have allocations will be skipped. The payment plan determines how the annual fee is split.
          </p>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="label mb-1 block text-xs">Payment Plan</label>
              <select className="input" value={selectedPlan} onChange={e => setSelectedPlan(e.target.value)}>
                {PAYMENT_PLANS.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
            <button
              onClick={handleGenerate}
              disabled={generateAllMutation.isPending}
              className="btn btn-primary"
            >
              {generateAllMutation.isPending ? 'Generating...' : 'Generate Allocations & Invoices'}
            </button>
            <button onClick={() => setShowGenerateForm(false)} className="btn btn-outline">Cancel</button>
          </div>
        </div>
      )}

      {/* Generate Invoices Form */}
      {showInvoiceGenForm && (
        <div className="bg-green-50 dark:bg-green-900/15 border border-green-200 dark:border-green-800/30 rounded-xl p-4 space-y-4">
          <h3 className="text-sm font-semibold text-green-900 dark:text-green-300">Generate Invoices from Allocations</h3>
          <p className="text-xs text-green-700 dark:text-green-400">
            This generates invoices for all billing periods based on each student's payment plan.
            Already-existing invoices will be skipped.
          </p>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="label mb-1 block text-xs">Due Date *</label>
              <input
                type="date"
                className="input"
                value={invoiceDueDate}
                onChange={e => setInvoiceDueDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            <button
              onClick={handleGenerateInvoices}
              disabled={generateInvoicesMutation.isPending}
              className="btn btn-primary"
            >
              {generateInvoicesMutation.isPending ? 'Generating...' : 'Generate Invoices'}
            </button>
            <button onClick={() => setShowInvoiceGenForm(false)} className="btn btn-outline">Cancel</button>
          </div>
        </div>
      )}

      {/* Allocations List */}
      {isLoading ? (
        <div className="py-16 text-center"><div className="loading-spinner"></div></div>
      ) : allocations.length === 0 ? (
        <div className="py-16 text-center text-gray-500 dark:text-[#8E8E93]">
          <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No allocations found</p>
          <p className="text-xs mt-1 opacity-60">Generate annual allocations to get started.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass border border-gray-200 dark:border-[#38383A] overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-[#38383A] flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              {allocations.length} Allocation{allocations.length !== 1 ? 's' : ''}
            </span>
            {stats.totalExpected > 0 && (
              <span className="text-xs text-gray-500 dark:text-[#8E8E93]">
                Total: {formatCurrency(stats.totalExpected)} | Collected: {formatCurrency(stats.totalPaid)} | Balance: {formatCurrency(stats.totalBalance)}
              </span>
            )}
          </div>

          <div className="divide-y divide-gray-100 dark:divide-[#38383A]">
            {allocations.map(alloc => (
              <div key={alloc._id}>
                <div
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-[#2C2C2E] transition-colors"
                  onClick={() => setExpandedAllocation(expandedAllocation === alloc._id ? null : alloc._id)}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-9 h-9 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-primary-700 dark:text-primary-400">
                        {(alloc.studentId?.name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                        {alloc.studentId?.name || 'Unknown Student'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-[#8E8E93]">
                        {alloc.studentId?.admissionNumber || ''} &middot; {alloc.classId?.name || ''} &middot; {alloc.paymentPlan}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(alloc.totalAnnualAmount)}</p>
                      <p className="text-xs text-gray-500 dark:text-[#8E8E93]">
                        Paid: {formatCurrency(alloc.totalPaid)} | Balance: {formatCurrency(alloc.balance)}
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${
                      alloc.status === 'active' ? 'bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-400' :
                      alloc.status === 'completed' ? 'bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400' :
                      'bg-gray-100 dark:bg-gray-500/15 text-gray-600 dark:text-gray-400'
                    }`}>
                      {alloc.status}
                    </span>
                    {expandedAllocation === alloc._id
                      ? <ChevronUp className="h-4 w-4 text-gray-400" />
                      : <ChevronDown className="h-4 w-4 text-gray-400" />
                    }
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedAllocation === alloc._id && (
                  <div className="px-4 pb-4 bg-gray-50 dark:bg-[#2C2C2E] space-y-3 border-t border-gray-100 dark:border-[#38383A]">
                    {/* Fee Heads Breakdown */}
                    <div>
                      <p className="text-xs font-semibold text-gray-500 dark:text-[#636366] uppercase tracking-wider mb-2">Fee Heads</p>
                      <div className="space-y-1">
                        {alloc.allocatedFeeHeads?.map((head, i) => (
                          <div key={i} className={`flex items-center justify-between text-sm ${!head.isIncluded ? 'opacity-50 line-through' : ''}`}>
                            <span className="text-gray-700 dark:text-gray-300">
                              {head.feeHeadName}
                              {head.isAdmissionFee && <span className="text-[9px] ml-1 text-amber-600">(One-time)</span>}
                              {!head.isIncluded && <span className="text-[9px] ml-1 text-red-500">— {head.exclusionReason}</span>}
                            </span>
                            <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(head.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Discount info (with edit/remove when active) */}
                    {(alloc.totalDiscount > 0 || alloc.totalWaived > 0) && (
                      <div className="flex items-start gap-2 px-3 py-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800/30">
                        <Tag className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          {alloc.totalDiscount > 0 && (
                            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                              Discount: -{formatCurrency(alloc.totalDiscount)}
                              {alloc.discountPercentage > 0 && <span className="ml-1 text-[11px] opacity-75">({alloc.discountPercentage}%)</span>}
                              {alloc.discountReason && (
                                <span className="block text-[11px] text-emerald-600/80 dark:text-emerald-400/70 truncate font-normal">
                                  {alloc.discountReason}
                                </span>
                              )}
                            </p>
                          )}
                          {alloc.totalWaived > 0 && (
                            <p className="text-sm text-blue-600 dark:text-blue-400">Waived: {formatCurrency(alloc.totalWaived)}</p>
                          )}
                        </div>
                        {alloc.status === 'active' && alloc.totalDiscount > 0 && applyingDiscount !== alloc._id && (
                          <>
                            <button
                              onClick={(e) => { e.stopPropagation(); openDiscountForm(alloc) }}
                              className="p-1.5 rounded-lg text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30"
                              title="Edit discount"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleRemoveDiscount(alloc) }}
                              disabled={applyDiscountMutation.isPending}
                              className="p-1.5 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
                              title="Remove discount"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    {alloc.status === 'active' && (
                      <div className="flex flex-wrap gap-2 pt-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); setChangingPlan(alloc._id); setNewPlan(alloc.paymentPlan) }}
                          className="text-xs px-3 py-1.5 rounded-lg bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#38383A] hover:bg-gray-100 dark:hover:bg-[#38383A] transition-colors flex items-center gap-1"
                        >
                          <Settings className="h-3 w-3" /> Change Plan
                        </button>
                        {alloc.totalDiscount === 0 && (
                          <button
                            onClick={(e) => { e.stopPropagation(); openDiscountForm(alloc) }}
                            className="text-xs px-3 py-1.5 rounded-lg bg-white dark:bg-[#1C1C1E] border border-blue-200 dark:border-blue-800/40 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors flex items-center gap-1 text-blue-700 dark:text-blue-400"
                          >
                            <Tag className="h-3 w-3" /> Apply Discount / Scholarship
                          </button>
                        )}
                      </div>
                    )}

                    {/* Apply / Edit Discount Inline Form */}
                    {applyingDiscount === alloc._id && (
                      <div className="space-y-3 pt-3 border-t border-gray-200 dark:border-[#38383A]" onClick={(e) => e.stopPropagation()}>
                        <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                          <Tag className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400" />
                          {alloc.totalDiscount > 0 ? 'Edit' : 'Apply'} Annual Discount / Scholarship
                        </p>
                        <p className="text-[11px] text-gray-500 dark:text-[#8E8E93]">
                          Applied at the allocation level — distributed proportionally across all {alloc.paymentPlan} invoices. Existing invoices for this allocation will be adjusted.
                        </p>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-gray-500 mb-1 block">Mode</label>
                            <div className="flex rounded-xl overflow-hidden border border-gray-200 dark:border-[#38383A]">
                              <button
                                type="button"
                                onClick={() => setDiscountMode('fixed')}
                                className={`flex-1 py-1.5 text-xs font-medium transition-colors ${
                                  discountMode === 'fixed'
                                    ? 'bg-primary-600 text-white dark:bg-primary-500'
                                    : 'bg-white dark:bg-[#1C1C1E] text-gray-500 dark:text-[#8E8E93]'
                                }`}
                              >
                                Fixed ₹
                              </button>
                              <button
                                type="button"
                                onClick={() => setDiscountMode('percentage')}
                                className={`flex-1 py-1.5 text-xs font-medium transition-colors ${
                                  discountMode === 'percentage'
                                    ? 'bg-primary-600 text-white dark:bg-primary-500'
                                    : 'bg-white dark:bg-[#1C1C1E] text-gray-500 dark:text-[#8E8E93]'
                                }`}
                              >
                                Percent %
                              </button>
                            </div>
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 mb-1 block">
                              {discountMode === 'percentage' ? 'Percentage *' : 'Amount *'}
                            </label>
                            <input
                              type="number"
                              min="1"
                              step="1"
                              max={discountMode === 'percentage' ? 100 : alloc.totalAnnualAmount}
                              className="input text-sm"
                              placeholder={discountMode === 'percentage' ? 'e.g. 25' : 'e.g. 5000'}
                              value={discountForm.value}
                              onWheel={(e) => e.target.blur()}
                              onKeyDown={handleDiscountKeyDown(alloc)}
                              onChange={(e) => setDiscountForm(f => ({ ...f, value: e.target.value }))}
                            />
                            {discountMode === 'percentage' && discountForm.value > 0 && (
                              <p className="text-[11px] text-primary-600 dark:text-primary-400 font-medium mt-1">
                                = {formatCurrency(Math.round((parseFloat(discountForm.value) / 100) * (alloc.totalAnnualAmount || 0)))}
                              </p>
                            )}
                          </div>
                        </div>

                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">Reason *</label>
                          <input
                            type="text"
                            className="input text-sm"
                            placeholder="e.g. Merit scholarship, sibling discount"
                            value={discountForm.reason}
                            onKeyDown={handleDiscountKeyDown(alloc)}
                            onChange={(e) => setDiscountForm(f => ({ ...f, reason: e.target.value }))}
                          />
                        </div>

                        {/* Preview */}
                        {(() => {
                          const val = parseFloat(discountForm.value) || 0
                          if (val <= 0) return null
                          const discountAmount = discountMode === 'percentage'
                            ? Math.round((val / 100) * (alloc.totalAnnualAmount || 0))
                            : Math.min(val, alloc.totalAnnualAmount || 0)
                          const newBalance = Math.max(0, (alloc.totalAnnualAmount || 0) - discountAmount - (alloc.totalPaid || 0))
                          return (
                            <div className="flex items-center justify-between px-3 py-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800/30">
                              <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">New annual balance</span>
                              <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{formatCurrency(newBalance)}</span>
                            </div>
                          )
                        })()}

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleApplyDiscount(alloc)}
                            disabled={applyDiscountMutation.isPending}
                            className="btn btn-primary text-xs flex-1"
                          >
                            {applyDiscountMutation.isPending
                              ? 'Saving...'
                              : (alloc.totalDiscount > 0 ? 'Update Discount' : 'Apply Discount')}
                          </button>
                          <button
                            onClick={() => { setApplyingDiscount(null); setDiscountForm({ value: '', reason: '' }) }}
                            disabled={applyDiscountMutation.isPending}
                            className="btn btn-outline text-xs"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Change Plan Inline */}
                    {changingPlan === alloc._id && (
                      <div className="flex items-end gap-3 pt-2 border-t border-gray-200 dark:border-[#38383A]">
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">New Payment Plan</label>
                          <select className="input text-sm" value={newPlan} onChange={e => setNewPlan(e.target.value)}>
                            {PAYMENT_PLANS.map(p => (
                              <option key={p.value} value={p.value}>{p.label}</option>
                            ))}
                          </select>
                        </div>
                        <button
                          onClick={() => changePlanMutation.mutate({ id: alloc._id, plan: newPlan })}
                          disabled={changePlanMutation.isPending || newPlan === alloc.paymentPlan}
                          className="btn btn-primary text-xs"
                        >
                          {changePlanMutation.isPending ? 'Saving...' : 'Save'}
                        </button>
                        <button onClick={() => setChangingPlan(null)} className="btn btn-outline text-xs">Cancel</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Class Breakdown */}
      {dashboardSummary?.classBreakdown?.length > 0 && (
        <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass border border-gray-200 dark:border-[#38383A] overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-[#38383A]">
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Collection by Class</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-[#2C2C2E] text-gray-600 dark:text-[#8E8E93]">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Class</th>
                  <th className="px-4 py-3 text-right font-medium">Students</th>
                  <th className="px-4 py-3 text-right font-medium">Expected</th>
                  <th className="px-4 py-3 text-right font-medium">Collected</th>
                  <th className="px-4 py-3 text-right font-medium">Outstanding</th>
                  <th className="px-4 py-3 text-right font-medium">Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-[#38383A]">
                {dashboardSummary.classBreakdown.map(row => (
                  <tr key={row._id} className="hover:bg-gray-50 dark:hover:bg-[#2C2C2E]">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{row.className || 'Unknown'}</td>
                    <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">{row.studentCount}</td>
                    <td className="px-4 py-3 text-right text-gray-900 dark:text-white">{formatCurrency(row.totalExpected)}</td>
                    <td className="px-4 py-3 text-right text-green-600">{formatCurrency(row.totalCollected)}</td>
                    <td className="px-4 py-3 text-right text-red-600">{formatCurrency(row.totalOutstanding)}</td>
                    <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">
                      {row.totalExpected > 0 ? Math.round((row.totalCollected / row.totalExpected) * 100) : 0}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// Summary Card Sub-component
const SummaryCard = ({ label, value, icon, color, subtitle }) => {
  const colorMap = {
    blue: 'bg-blue-50 dark:bg-blue-900/15 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800/30',
    green: 'bg-green-50 dark:bg-green-900/15 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800/30',
    amber: 'bg-amber-50 dark:bg-amber-900/15 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/30',
    red: 'bg-red-50 dark:bg-red-900/15 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800/30',
  }

  return (
    <div className={`rounded-xl border p-4 ${colorMap[color]}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider opacity-70">{label}</span>
        {icon}
      </div>
      <p className="text-xl font-bold">{value}</p>
      {subtitle && <p className="text-xs mt-1 opacity-60">{subtitle}</p>}
    </div>
  )
}

export default AnnualAllocationsTab
