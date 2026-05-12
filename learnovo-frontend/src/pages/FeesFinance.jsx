import React, { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  DollarSign, TrendingUp, AlertCircle, AlertTriangle, Calendar,
  Users, FileText, Search, X, Plus, Receipt, Settings, History,
  Edit, Trash2, Eye, Printer, RotateCcw, Check, Ban, List,
  ArrowUpRight, ArrowDownRight, Download, ChevronDown, ChevronUp,
  Copy, Upload, Loader2
} from 'lucide-react'
import {
  feesReportsService, invoicesService, paymentsService, feeStructuresService, refundsService, discountsService, allocationsService
} from '../services/feesService'
import { academicSessionsService, classesService } from '../services/academicsService'
import { studentsService } from '../services/studentsService'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useSettings } from '../contexts/SettingsContext'
import { formatCurrency } from '../utils/formatCurrency'
import { formatDate } from '../utils/formatDate'
import { sortByRelevance } from '../utils/searchRelevance'
import { sortClassObjects } from '../utils/classOrder'

import toast from 'react-hot-toast'

// Shared UI
import LoadingSpinner from '../components/LoadingSpinner'
import EmptyState from '../components/EmptyState'
import StatusBadge from '../components/StatusBadge'
import EditInvoiceModal from '../components/EditInvoiceModal'
import ImportModal from '../components/ImportModal'

// Fees sub-components
import StudentSearch from '../components/fees/StudentSearch'
import FeeStructureModal from '../components/fees/FeeStructureModal'
import IndividualInvoiceModal from '../components/fees/IndividualInvoiceModal'
import BulkInvoiceForm from '../components/fees/BulkInvoiceForm'
import BulkDeleteInvoiceForm from '../components/fees/BulkDeleteInvoiceForm'
import PaymentModal from '../components/fees/PaymentModal'
import AllInvoicesTab from '../components/fees/AllInvoicesTab'
import AnnualAllocationsTab from '../components/fees/AnnualAllocationsTab'
import PaymentEditModal from '../components/fees/PaymentEditModal'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001'

const TAB_GROUPS = [
  {
    label: 'Daily',
    tabs: [
      { id: 'dashboard', label: 'Dashboard', icon: TrendingUp },
      { id: 'collect', label: 'Collect Payment', icon: DollarSign },
      { id: 'receipts', label: 'Receipts', icon: FileText },
      { id: 'defaulters', label: 'Defaulters', icon: AlertCircle },
    ],
  },
  {
    label: 'Invoices',
    tabs: [
      { id: 'allInvoices', label: 'All Invoices', icon: List },
      { id: 'invoices', label: 'Generate Invoices', icon: Receipt },
    ],
  },
  {
    label: 'Setup',
    tabs: [
      { id: 'feeStructure', label: 'Fee Structure', icon: Settings },
      { id: 'allocations', label: 'Annual Allocations', icon: Calendar },
      { id: 'importFees', label: 'Import Fees', icon: Upload },
    ],
  },
  {
    label: 'Reports & Issues',
    tabs: [
      { id: 'reports', label: 'Reports', icon: History },
      { id: 'disputes', label: 'Disputes', icon: AlertTriangle },
      { id: 'refunds', label: 'Refunds', icon: RotateCcw },
    ],
  },
]

const TABS = TAB_GROUPS.flatMap(g => g.tabs)

const FeesFinance = () => {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const studentIdFromUrl = searchParams.get('student')
  const generateForStudentId = searchParams.get('generateForStudent')
  const [activeTab, setActiveTab] = useState(
    generateForStudentId ? 'invoices' : (studentIdFromUrl ? 'allInvoices' : 'dashboard')
  )

  const [showFeeStructureModal, setShowFeeStructureModal] = useState(false)
  const [editingFeeStructure, setEditingFeeStructure] = useState(null)
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [invoiceModalInitialStudent, setInvoiceModalInitialStudent] = useState(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [studentInvoices, setStudentInvoices] = useState([])
  const [studentPayments, setStudentPayments] = useState([])
  const [studentAllocation, setStudentAllocation] = useState(null)
  const [editingInvoice, setEditingInvoice] = useState(null)
  const [paymentAction, setPaymentAction] = useState(null) // { payment, mode: 'edit' | 'reverse' }
  const [receiptFilters, setReceiptFilters] = useState({ search: '', paymentMethod: '', quarter: '', startDate: '', endDate: '' })
  const [receiptLimit, setReceiptLimit] = useState(100)
  const [showFeeImportModal, setShowFeeImportModal] = useState(false)
  const [resolvingDispute, setResolvingDispute] = useState(null)
  const [resolveForm, setResolveForm] = useState({ action: 'APPROVE', note: '' })

  // ── Queries ──

  const { data: activeSession, isLoading } = useQuery({
    queryKey: ['fees-active-session'],
    queryFn: async () => { const res = await academicSessionsService.getActive(); return res.data },
  })

  const { data: dashboardData } = useQuery({
    queryKey: ['fees-dashboard', activeSession?._id],
    queryFn: async () => { const res = await feesReportsService.getDashboard({ academicSessionId: activeSession?._id }); return res.data },
    enabled: !!activeSession && (activeTab === 'dashboard' || activeTab === 'collect'),
  })

  const { data: feeStructures = [] } = useQuery({
    queryKey: ['fee-structures', activeSession?._id],
    queryFn: async () => { const res = await feeStructuresService.list({ academicSessionId: activeSession?._id }); return res.data || [] },
    enabled: !!activeSession && (activeTab === 'feeStructure' || activeTab === 'invoices' || showInvoiceModal),
  })

  const { data: classes = [] } = useQuery({
    queryKey: ['fees-classes', activeSession?.name],
    queryFn: async () => {
      const res = await classesService.list(activeSession?.name ? { academicYear: activeSession.name } : {})
      return sortClassObjects(res.data || [], 'name')
    },
    enabled: !!activeSession && (activeTab === 'feeStructure' || activeTab === 'invoices' || activeTab === 'defaulters'),
  })

  // Deep-link: ?generateForStudent={id} → fetch student and open IndividualInvoiceModal pre-filled
  useEffect(() => {
    if (!generateForStudentId || !activeSession) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await studentsService.get(generateForStudentId)
        if (cancelled) return
        const student = res?.data || res
        if (student && student._id) {
          setInvoiceModalInitialStudent(student)
          setShowInvoiceModal(true)
        }
      } catch {
        toast.error('Failed to load student for fee generation')
      } finally {
        if (!cancelled) {
          const next = new URLSearchParams(searchParams)
          next.delete('generateForStudent')
          setSearchParams(next, { replace: true })
        }
      }
    })()
    return () => { cancelled = true }
  }, [generateForStudentId, activeSession])

  const [defaultersDateFilter, setDefaultersDateFilter] = useState({ startDate: '', endDate: '' })

  const { data: defaulters = [], isLoading: defaultersLoading } = useQuery({
    queryKey: ['fees-defaulters', activeSession?._id, defaultersDateFilter.startDate, defaultersDateFilter.endDate],
    queryFn: async () => {
      const res = await feesReportsService.getDefaulters({
        academicSessionId: activeSession?._id,
        startDate: defaultersDateFilter.startDate || undefined,
        endDate: defaultersDateFilter.endDate || undefined,
      })
      return res.data || []
    },
    enabled: !!activeSession && activeTab === 'defaulters',
  })

  const handleExportDefaulters = async (fmt, filters = {}) => {
    const toastId = toast.loading(`Exporting ${fmt.toUpperCase()}...`)
    try {
      const blob = await feesReportsService.exportDefaulters({
        academicSessionId: activeSession?._id,
        classId: filters.classId,
        sectionId: filters.sectionId,
        minBalance: filters.minBalance,
        startDate: filters.startDate,
        endDate: filters.endDate,
        format: fmt
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `fee_defaulters_${new Date().toISOString().split('T')[0]}.${fmt === 'excel' ? 'xlsx' : 'csv'}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.dismiss(toastId)
      toast.success('Exported successfully')
    } catch {
      toast.dismiss(toastId)
      toast.error('Failed to export defaulters')
    }
  }

  // Collection report query removed — ReportsTab now fetches its own data via getCollectionSummary

  // When search/quarter filters are applied client-side, fetch the full result
  // set (capped at server max) so filtered matches aren't hidden behind the
  // server-side limit. Otherwise paginate normally via "Load more".
  const hasClientSideFilters = !!(receiptFilters.search || receiptFilters.quarter)
  const effectiveReceiptLimit = hasClientSideFilters ? 5000 : receiptLimit

  const { data: receiptsResp = { receipts: [], hasMore: false }, isLoading: receiptsLoading, isFetching: receiptsFetching } = useQuery({
    queryKey: ['fees-receipts', receiptFilters.paymentMethod, receiptFilters.quarter, receiptFilters.startDate, receiptFilters.endDate, receiptFilters.search, effectiveReceiptLimit],
    queryFn: async () => {
      const params = { limit: effectiveReceiptLimit }
      if (receiptFilters.paymentMethod) params.paymentMethod = receiptFilters.paymentMethod
      if (receiptFilters.startDate) params.startDate = receiptFilters.startDate
      if (receiptFilters.endDate) params.endDate = receiptFilters.endDate
      const res = await paymentsService.list(params)
      let data = res.data || []
      let hasMore = !!res.hasMore
      if (receiptFilters.quarter) {
        const q = parseInt(receiptFilters.quarter, 10)
        data = data.filter(p => p.invoiceId?.billingPeriod?.quarter === q)
      }
      if (receiptFilters.search) {
        const q = receiptFilters.search.toLowerCase()
        data = data.filter(p =>
          (p.studentId?.name || '').toLowerCase().includes(q) ||
          (p.studentId?.fullName || '').toLowerCase().includes(q) ||
          (p.receiptNumber || '').toLowerCase().includes(q) ||
          (p.studentId?.admissionNumber || '').toLowerCase().includes(q) ||
          (p.studentId?.studentId || '').toLowerCase().includes(q)
        )
        data = sortByRelevance(data, receiptFilters.search, [
          { key: 'studentId.admissionNumber', weight: 1.5 },
          { key: 'studentId.studentId', weight: 1.5 },
          { key: 'receiptNumber', weight: 1.2 },
          { key: 'studentId.fullName', weight: 1 },
          { key: 'studentId.name', weight: 1 },
        ])
      }
      // With client-side filters active we've already pulled the full set,
      // so suppress the "Load more" affordance — there's nothing more to fetch.
      if (hasClientSideFilters) hasMore = false
      return { receipts: data, hasMore }
    },
    enabled: !!activeSession && activeTab === 'receipts',
    keepPreviousData: true,
  })
  const allReceipts = receiptsResp.receipts || []
  const receiptsHasMore = !!receiptsResp.hasMore

  const { data: disputesData = { disputes: [], stuckPayments: [] }, isLoading: disputesLoading } = useQuery({
    queryKey: ['fees-disputes'],
    queryFn: async () => {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_BASE}/admin-disputes`, { headers: { Authorization: `Bearer ${token}` } })
      const json = await res.json()
      return json.success ? json.data : { disputes: [], stuckPayments: [] }
    },
    enabled: !!activeSession && activeTab === 'disputes',
  })

  // ── Actions ──

  const resolveDisputeMutation = useMutation({
    mutationFn: async (disputeId) => {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_BASE}/admin-disputes/${disputeId}/resolve`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ resolutionAction: resolveForm.action, adminNote: resolveForm.note }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.message || 'Failed')
      return json
    },
    onSuccess: () => {
      toast.success(`Dispute ${resolveForm.action === 'APPROVE' ? 'approved' : 'rejected'}`)
      setResolvingDispute(null); setResolveForm({ action: 'APPROVE', note: '' })
      queryClient.invalidateQueries({ queryKey: ['fees-disputes'] })
    },
    onError: (error) => toast.error(error.message),
  })

  const handleResolveDispute = (disputeId) => {
    if (!resolveForm.note.trim()) { toast.error('Please add a note'); return }
    resolveDisputeMutation.mutate(disputeId)
  }

  const deleteInvoiceMutation = useMutation({
    mutationFn: (id) => invoicesService.delete(id),
    onSuccess: () => { toast.success('Invoice deleted'); queryClient.invalidateQueries({ queryKey: ['fees-dashboard'] }); queryClient.invalidateQueries({ queryKey: ['all-invoices'] }) },
    onError: (error) => toast.error(error.response?.data?.message || 'Failed to delete invoice'),
  })

  const handleDeleteInvoice = (id) => {
    if (!window.confirm('Delete this invoice? This cannot be undone.')) return
    deleteInvoiceMutation.mutate(id)
  }

  const handleSelectStudent = async (student) => {
    setSelectedStudent(student)
    try {
      const res = await invoicesService.getStudentInvoices(student._id)
      setStudentInvoices((res.data || []).filter(inv => ['Pending', 'Partial', 'Overdue'].includes(inv.status)))
      const paymentsRes = await paymentsService.list({ studentId: student._id })
      setStudentPayments(paymentsRes.data || [])
      try {
        const allocRes = await allocationsService.list({ studentId: student._id, academicSessionId: activeSession?._id })
        const allocs = allocRes.data || []
        setStudentAllocation(allocs[0] || null)
      } catch { setStudentAllocation(null) }
      setShowPaymentModal(true)
    } catch { toast.error('Failed to load student data') }
  }

  const refreshSelectedStudentData = async () => {
    if (!selectedStudent?._id) return
    try {
      const res = await invoicesService.getStudentInvoices(selectedStudent._id)
      setStudentInvoices((res.data || []).filter(inv => ['Pending', 'Partial', 'Overdue'].includes(inv.status)))
      const paymentsRes = await paymentsService.list({ studentId: selectedStudent._id })
      setStudentPayments(paymentsRes.data || [])
      try {
        const allocRes = await allocationsService.list({ studentId: selectedStudent._id, academicSessionId: activeSession?._id })
        const allocs = allocRes.data || []
        setStudentAllocation(allocs[0] || null)
      } catch { /* keep prior allocation on error */ }
      queryClient.invalidateQueries({ queryKey: ['fees-dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['all-invoices'] })
    } catch { /* silent — modal stays open with prior data */ }
  }

  // ── Receipt handlers ──

  const handleViewReceiptPdf = async (paymentId) => {
    try {
      const toastId = toast.loading('Opening PDF...')
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE}/invoices/payments/${paymentId}/receipt/pdf`, { headers: { Authorization: `Bearer ${token}` } })
      if (!response.ok) throw new Error('Failed')
      const blob = await response.blob(); toast.dismiss(toastId)
      const url = URL.createObjectURL(blob); window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 10000)
    } catch { toast.error('Failed to open receipt') }
  }

  const handleDownloadReceiptPdf = async (paymentId) => {
    const toastId = toast.loading('Generating PDF...')
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE}/invoices/payments/${paymentId}/receipt/pdf`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!response.ok) throw new Error('Failed')
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `Receipt-${paymentId}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 10000)
      toast.dismiss(toastId)
      toast.success('Receipt downloaded!')
    } catch {
      toast.dismiss(toastId)
      toast.error('Failed to download receipt')
    }
  }

  const handleDownloadConsolidatedReceipt = async (groupId, groupReceiptNumber) => {
    const toastId = toast.loading('Generating consolidated PDF...')
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE}/invoices/payments/group/${groupId}/receipt/pdf`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!response.ok) throw new Error('Failed')
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `Receipt-${groupReceiptNumber || groupId}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 10000)
      toast.dismiss(toastId)
      toast.success('Consolidated receipt downloaded!')
    } catch {
      toast.dismiss(toastId)
      toast.error('Failed to download consolidated receipt')
    }
  }

  const handlePrintReceipt = async (paymentId) => {
    try {
      const toastId = toast.loading('Opening receipt...')
      const token = localStorage.getItem('token')
      // Fetch receipt HTML from backend (same template as PDF, but as printable HTML page)
      const response = await fetch(`${API_BASE}/invoices/payments/${paymentId}/receipt/html`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!response.ok) throw new Error('Failed')
      const html = await response.text()
      toast.dismiss(toastId)
      const win = window.open('', '_blank', 'width=850,height=650')
      if (win) { win.document.write(html); win.document.close() }
      else toast.error('Pop-up blocked — please allow pop-ups')
    } catch {
      toast.dismiss()
      toast.error('Failed to load receipt')
    }
  }

  const handleExportReceipts = async (fmt) => {
    const toastId = toast.loading(`Exporting ${fmt.toUpperCase()}...`)
    try {
      const blob = await feesReportsService.exportReceipts({
        startDate: receiptFilters.startDate,
        endDate: receiptFilters.endDate,
        paymentMethod: receiptFilters.paymentMethod,
        format: fmt
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `fee_receipts_${new Date().toISOString().split('T')[0]}.${fmt === 'excel' ? 'xlsx' : 'csv'}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.dismiss(toastId)
      toast.success('Exported successfully')
    } catch {
      toast.dismiss(toastId)
      toast.error('Failed to export receipts')
    }
  }

  // Collection report export moved into ReportsTab component

  // ── Early returns ──

  if (isLoading) return <LoadingSpinner size="lg" />
  if (!activeSession) return <EmptyState icon={Calendar} title="No active academic session" description="Please activate an academic session first" />

  // ── Render ──

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Fee Collection</h1>
          <p className="text-sm text-gray-500 dark:text-[#8E8E93] mt-1">Academic Session: {activeSession.name}</p>
        </div>
      </div>

      {/* Tabs — grouped by workflow */}
      <div className="border-b border-gray-200 dark:border-[#38383A] overflow-x-auto overflow-y-hidden scrollbar-none">
        <nav className="-mb-px flex whitespace-nowrap px-1">
          {TAB_GROUPS.map((group, gIdx) => (
            <div key={group.label} className="flex items-end">
              {gIdx > 0 && <div className="w-px h-6 bg-gray-200 dark:bg-[#38383A] mx-1 sm:mx-2 mb-2 flex-shrink-0" />}
              <div className="flex flex-col items-start">
                <span className="text-[9px] font-semibold text-gray-400 dark:text-[#636366] uppercase tracking-wider px-2 mb-0.5 hidden sm:block">{group.label}</span>
                <div className="flex space-x-0.5 sm:space-x-1">
                  {group.tabs.map((tab) => {
                    const Icon = tab.icon
                    const isActive = activeTab === tab.id
                    return (
                      <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                        className={`py-3 px-2.5 sm:px-3 border-b-2 font-medium text-sm flex items-center gap-1.5 transition-all whitespace-nowrap rounded-t-lg ${isActive ? 'border-primary-500 text-primary-600 dark:text-primary-400 bg-primary-50/50 dark:bg-primary-900/10' : 'border-transparent text-gray-500 dark:text-[#8E8E93] hover:text-gray-700 dark:hover:text-white hover:border-gray-300 dark:hover:border-[#38383A]'}`}>
                        <Icon className="h-4 w-4" />
                        <span className="hidden sm:inline">{tab.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'dashboard' && dashboardData && <DashboardTab data={dashboardData} onPrintReceipt={handlePrintReceipt} onDownloadReceipt={handleDownloadReceiptPdf} onEditInvoice={setEditingInvoice} onDeleteInvoice={handleDeleteInvoice} onNavigate={setActiveTab} />}
        {activeTab === 'allocations' && <AnnualAllocationsTab activeSession={activeSession} />}
        {activeTab === 'allInvoices' && <AllInvoicesTab activeSession={activeSession} initialStudentId={studentIdFromUrl} onEditInvoice={setEditingInvoice} onCollectPayment={async (inv) => { if (inv.studentId) { const s = typeof inv.studentId === 'object' ? inv.studentId : { _id: inv.studentId }; await handleSelectStudent(s) } }} onPrintReceipt={handlePrintReceipt} onDownloadReceipt={handleDownloadReceiptPdf} onDeleteInvoice={handleDeleteInvoice} />}
        {activeTab === 'feeStructure' && <FeeStructureTab feeStructures={feeStructures} classes={classes} onCreateNew={() => { setEditingFeeStructure(null); setShowFeeStructureModal(true) }} onEdit={(s) => { setEditingFeeStructure(s); setShowFeeStructureModal(true) }} onDelete={async (id) => { if (window.confirm('Delete this fee structure?')) { try { await feeStructuresService.delete(id); toast.success('Deleted'); queryClient.invalidateQueries({ queryKey: ['fee-structures'] }) } catch { toast.error('Failed') } } }} onDuplicate={async (s) => { try { await feeStructuresService.create({ classId: typeof s.classId === 'object' ? s.classId._id : s.classId, sectionId: s.sectionId ? (typeof s.sectionId === 'object' ? s.sectionId._id : s.sectionId) : null, academicSessionId: activeSession._id, feeHeads: s.feeHeads.map(h => ({ name: h.name, amount: h.amount, frequency: h.frequency, isCompulsory: h.isCompulsory, dueDay: h.dueDay })), isActive: true }); toast.success('Duplicated'); queryClient.invalidateQueries({ queryKey: ['fee-structures'] }) } catch { toast.error('Failed') } }} />}
        {activeTab === 'invoices' && <InvoicesTab classes={classes} feeStructures={feeStructures} activeSession={activeSession} onShowIndividual={() => setShowInvoiceModal(true)} />}
        {activeTab === 'collect' && <CollectPaymentTab dashboardData={dashboardData} selectedStudent={selectedStudent} onSelectStudent={handleSelectStudent} />}
        {activeTab === 'defaulters' && <DefaultersTab defaulters={defaulters} loading={defaultersLoading} classes={classes} activeSession={activeSession} onExport={handleExportDefaulters} dateFilter={defaultersDateFilter} onDateFilterChange={setDefaultersDateFilter} />}
        {activeTab === 'receipts' && <ReceiptsTab receipts={allReceipts} loading={receiptsLoading} fetching={receiptsFetching} hasMore={receiptsHasMore} onLoadMore={(n = 100) => setReceiptLimit(l => l + n)} filters={receiptFilters} onFilterChange={(f) => { setReceiptFilters(f); setReceiptLimit(100) }} onClearFilters={() => { setReceiptFilters({ search: '', paymentMethod: '', quarter: '', startDate: '', endDate: '' }); setReceiptLimit(100) }} onPrintReceipt={handlePrintReceipt} onDownloadReceipt={handleDownloadReceiptPdf} onExport={handleExportReceipts} onEditPayment={(p) => setPaymentAction({ payment: p, mode: 'edit' })} onReversePayment={(p) => setPaymentAction({ payment: p, mode: 'reverse' })} />}
        {activeTab === 'refunds' && <RefundsTab />}
        {activeTab === 'disputes' && <DisputesTab data={disputesData} loading={disputesLoading} resolvingDispute={resolvingDispute} resolveForm={resolveForm} onSetResolvingDispute={setResolvingDispute} onSetResolveForm={setResolveForm} onResolve={handleResolveDispute} onRefresh={() => queryClient.invalidateQueries({ queryKey: ['fees-disputes'] })} />}
        {activeTab === 'reports' && <ReportsTab activeSession={activeSession} />}
        {activeTab === 'importFees' && <ImportFeesTab onImport={() => setShowFeeImportModal(true)} />}
      </div>

      {/* Modals */}
      {showFeeStructureModal && <FeeStructureModal feeStructure={editingFeeStructure} classes={classes} activeSession={activeSession} onClose={() => { setShowFeeStructureModal(false); setEditingFeeStructure(null) }} onSuccess={() => { setShowFeeStructureModal(false); setEditingFeeStructure(null); queryClient.invalidateQueries({ queryKey: ['fee-structures'] }); toast.success(editingFeeStructure ? 'Updated' : 'Created') }} />}
      {showInvoiceModal && <IndividualInvoiceModal feeStructures={feeStructures} activeSession={activeSession} initialStudent={invoiceModalInitialStudent} onClose={() => { setShowInvoiceModal(false); setInvoiceModalInitialStudent(null) }} onSuccess={() => { setShowInvoiceModal(false); setInvoiceModalInitialStudent(null); toast.success('Invoice generated'); queryClient.invalidateQueries({ queryKey: ['fees-dashboard'] }) }} />}
      {showPaymentModal && <PaymentModal student={selectedStudent} invoices={studentInvoices} payments={studentPayments} allocation={studentAllocation} onPrintReceipt={handlePrintReceipt} onDownloadReceipt={handleDownloadReceiptPdf} onDownloadConsolidatedReceipt={handleDownloadConsolidatedReceipt} onClose={() => { setShowPaymentModal(false); setSelectedStudent(null); setStudentInvoices([]); setStudentPayments([]); setStudentAllocation(null) }} onSuccess={() => { setShowPaymentModal(false); setSelectedStudent(null); setStudentInvoices([]); setStudentAllocation(null); queryClient.invalidateQueries({ queryKey: ['fees-dashboard'] }); queryClient.invalidateQueries({ queryKey: ['fees-receipts'] }); toast.success('Payment collected') }} />}
      {editingInvoice && <EditInvoiceModal invoice={editingInvoice} onClose={() => setEditingInvoice(null)} onSuccess={() => { setEditingInvoice(null); queryClient.invalidateQueries({ queryKey: ['fees-dashboard'] }); queryClient.invalidateQueries({ queryKey: ['all-invoices'] }); queryClient.invalidateQueries({ queryKey: ['fees-defaulters'] }); queryClient.invalidateQueries({ queryKey: ['fees-receipts'] }) }} />}
      {paymentAction && <PaymentEditModal payment={paymentAction.payment} mode={paymentAction.mode} onClose={() => setPaymentAction(null)} onSuccess={() => { setPaymentAction(null); queryClient.invalidateQueries({ queryKey: ['fees-receipts'] }); queryClient.invalidateQueries({ queryKey: ['fees-dashboard'] }); queryClient.invalidateQueries({ queryKey: ['all-invoices'] }) }} />}
      {showFeeImportModal && <ImportModal isOpen={showFeeImportModal} onClose={() => setShowFeeImportModal(false)} module="fees" title="Import Fee Records" templateUrl="/fees/import/template" previewUrl="/fees/import/preview" executeUrl="/fees/import/execute" onSuccess={(result) => { setShowFeeImportModal(false); queryClient.invalidateQueries({ queryKey: ['fees-dashboard'] }); queryClient.invalidateQueries({ queryKey: ['fee-allocations'] }); toast.success(`Import complete: ${result?.allocationsCreated || result?.created || 0} records created`) }} />}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// TAB COMPONENTS
// ════════════════════════════════════════════════════════════════════════════

const ImportFeesTab = ({ onImport }) => (
  <div className="space-y-6">
    <div className="card p-6 sm:p-8">
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-xl bg-primary-100 dark:bg-primary-900/30">
          <Upload className="h-6 w-6 text-primary-600 dark:text-primary-400" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Import Fee Records</h2>
          <p className="text-sm text-gray-500 dark:text-[#8E8E93] mt-1 leading-relaxed">
            Bulk import student fee allocations, invoices, and payment history from a CSV or Excel file.
            Useful when migrating from another system or recording offline payment data.
          </p>
        </div>
      </div>

      <div className="mt-6 p-4 rounded-lg bg-gray-50 dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#38383A]">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">How it works</h3>
        <ol className="text-sm text-gray-600 dark:text-[#8E8E93] space-y-2">
          <li className="flex gap-2"><span className="font-semibold text-primary-600 dark:text-primary-400">1.</span> Download the CSV template and fill in your fee data</li>
          <li className="flex gap-2"><span className="font-semibold text-primary-600 dark:text-primary-400">2.</span> Each row = one fee head per student (e.g., Tuition Fee, Transport Fee)</li>
          <li className="flex gap-2"><span className="font-semibold text-primary-600 dark:text-primary-400">3.</span> Include paid amounts and payment details for historical records</li>
          <li className="flex gap-2"><span className="font-semibold text-primary-600 dark:text-primary-400">4.</span> Upload the file — we'll validate and show a preview before importing</li>
        </ol>
      </div>

      <div className="mt-6 p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40">
        <div className="flex gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-amber-700 dark:text-amber-300">
            <p className="font-medium">Before you import</p>
            <ul className="mt-1 space-y-1 text-amber-600 dark:text-amber-400">
              <li>• Students must already exist in the system (use their admission numbers)</li>
              <li>• An active academic session must be set up</li>
              <li>• Existing allocations for the same student + session will not be overwritten</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <button
          onClick={onImport}
          className="btn btn-primary px-6 py-2.5"
        >
          <Upload className="h-4 w-4 mr-2" />
          Start Import
        </button>
      </div>
    </div>

    <div className="card p-6">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">CSV Column Reference</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-[#38383A]">
              <th className="text-left py-2 pr-4 font-medium text-gray-500 dark:text-[#8E8E93]">Column</th>
              <th className="text-left py-2 pr-4 font-medium text-gray-500 dark:text-[#8E8E93]">Required</th>
              <th className="text-left py-2 font-medium text-gray-500 dark:text-[#8E8E93]">Description</th>
            </tr>
          </thead>
          <tbody className="text-gray-600 dark:text-[#AEAEB2]">
            <tr className="border-b border-gray-100 dark:border-[#2C2C2E]"><td className="py-2 pr-4 font-mono text-xs">admissionNumber</td><td className="py-2 pr-4 text-red-500">Yes</td><td className="py-2">Student admission number</td></tr>
            <tr className="border-b border-gray-100 dark:border-[#2C2C2E]"><td className="py-2 pr-4 font-mono text-xs">feeHead</td><td className="py-2 pr-4 text-red-500">Yes</td><td className="py-2">Fee head name (e.g., Tuition Fee, Transport Fee)</td></tr>
            <tr className="border-b border-gray-100 dark:border-[#2C2C2E]"><td className="py-2 pr-4 font-mono text-xs">annualAmount</td><td className="py-2 pr-4 text-red-500">Yes</td><td className="py-2">Total annual fee amount</td></tr>
            <tr className="border-b border-gray-100 dark:border-[#2C2C2E]"><td className="py-2 pr-4 font-mono text-xs">feeType</td><td className="py-2 pr-4">No</td><td className="py-2">recurring (default) or one_time</td></tr>
            <tr className="border-b border-gray-100 dark:border-[#2C2C2E]"><td className="py-2 pr-4 font-mono text-xs">paidAmount</td><td className="py-2 pr-4">No</td><td className="py-2">Amount already paid (0 if unpaid)</td></tr>
            <tr className="border-b border-gray-100 dark:border-[#2C2C2E]"><td className="py-2 pr-4 font-mono text-xs">paymentDate</td><td className="py-2 pr-4">No</td><td className="py-2">Date of payment (YYYY-MM-DD)</td></tr>
            <tr className="border-b border-gray-100 dark:border-[#2C2C2E]"><td className="py-2 pr-4 font-mono text-xs">paymentMethod</td><td className="py-2 pr-4">No</td><td className="py-2">Cash, Bank Transfer, UPI, Cheque, Card, or Online</td></tr>
            <tr className="border-b border-gray-100 dark:border-[#2C2C2E]"><td className="py-2 pr-4 font-mono text-xs">receiptNumber</td><td className="py-2 pr-4">No</td><td className="py-2">Existing receipt number (auto-generated if blank)</td></tr>
            <tr className="border-b border-gray-100 dark:border-[#2C2C2E]"><td className="py-2 pr-4 font-mono text-xs">dueDate</td><td className="py-2 pr-4">No</td><td className="py-2">Due date (YYYY-MM-DD)</td></tr>
            <tr className="border-b border-gray-100 dark:border-[#2C2C2E]"><td className="py-2 pr-4 font-mono text-xs">discountAmount</td><td className="py-2 pr-4">No</td><td className="py-2">Discount amount</td></tr>
            <tr className="border-b border-gray-100 dark:border-[#2C2C2E]"><td className="py-2 pr-4 font-mono text-xs">discountReason</td><td className="py-2 pr-4">No</td><td className="py-2">Reason for discount</td></tr>
            <tr className="border-b border-gray-100 dark:border-[#2C2C2E]"><td className="py-2 pr-4 font-mono text-xs">academicSession</td><td className="py-2 pr-4">No</td><td className="py-2">Session name (e.g., 2025-2026). Uses active session if blank</td></tr>
            <tr><td className="py-2 pr-4 font-mono text-xs">remarks</td><td className="py-2 pr-4">No</td><td className="py-2">Any notes</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
)

const DashboardTab = ({ data, onPrintReceipt, onDownloadReceipt, onEditInvoice, onDeleteInvoice, onNavigate }) => {
  const summary = data.summary || {}
  // totalPending from backend already includes Overdue balances (status IN [Pending, Partial, Overdue]);
  // do not add totalOverdue again or it will double-count.
  const totalExpected = (summary.totalCollected || 0) + (summary.totalPending || 0)
  const collectionRate = totalExpected > 0 ? Math.round(((summary.totalCollected || 0) / totalExpected) * 100) : 0
  const chartData = data.collectionByDate || data.byDate || []
  const maxChartVal = chartData.length > 0 ? Math.max(...chartData.map(d => d.amount || 0), 1) : 1
  const statusDist = data.invoiceStatusDistribution || data.statusDistribution || null
  const statusItems = statusDist ? [
    { label: 'Paid', value: statusDist.paid || 0, color: 'bg-green-500' },
    { label: 'Pending', value: statusDist.pending || 0, color: 'bg-amber-500' },
    { label: 'Partial', value: statusDist.partial || 0, color: 'bg-orange-500' },
    { label: 'Overdue', value: statusDist.overdue || 0, color: 'bg-red-500' },
  ] : null
  const statusTotal = statusItems ? statusItems.reduce((s, i) => s + i.value, 0) : 0

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: 'Total Collected', value: summary.totalCollected, icon: TrendingUp, bg: 'bg-green-100 dark:bg-green-900/30', ic: 'text-green-600 dark:text-green-400', vc: 'text-green-600 dark:text-green-400', trend: collectionRate > 0 ? `${collectionRate}% rate` : null, up: true },
          { label: 'Pending Dues', value: summary.totalPending, icon: AlertCircle, bg: 'bg-amber-100 dark:bg-amber-900/30', ic: 'text-amber-600 dark:text-amber-400', vc: 'text-amber-600 dark:text-amber-400' },
          { label: 'Overdue Amount', value: summary.totalOverdue, icon: AlertTriangle, bg: 'bg-red-100 dark:bg-red-900/30', ic: 'text-red-600 dark:text-red-400', vc: 'text-red-600 dark:text-red-400', trend: summary.totalOverdue > 0 ? 'Needs attention' : null, up: false },
          { label: 'This Month', value: summary.thisMonthCollection, icon: Calendar, bg: 'bg-blue-100 dark:bg-blue-900/30', ic: 'text-blue-600 dark:text-blue-400', vc: 'text-blue-600 dark:text-blue-400' },
        ].map((c) => (
          <div key={c.label} className="card p-4 sm:p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] sm:text-xs font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wide">{c.label}</p>
                <p className={`text-lg sm:text-2xl font-bold mt-1.5 ${c.vc}`}>{formatCurrency(c.value)}</p>
                {c.trend && <div className={`flex items-center gap-1 mt-1.5 text-xs font-medium ${c.up ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{c.up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}{c.trend}</div>}
              </div>
              <div className={`p-2.5 ${c.bg} rounded-xl flex-shrink-0`}><c.icon className={`h-5 w-5 ${c.ic}`} /></div>
            </div>
          </div>
        ))}
      </div>

      {totalExpected > 0 && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Collection Progress</h3>
            <span className="text-sm font-bold text-primary-600 dark:text-primary-400">{collectionRate}%</span>
          </div>
          <div className="w-full h-3 bg-gray-200 dark:bg-[#38383A] rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full transition-all duration-700" style={{ width: `${Math.min(collectionRate, 100)}%` }} />
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-500 dark:text-[#8E8E93]">
            <span>Collected: {formatCurrency(summary.totalCollected)}</span>
            <span>Expected: {formatCurrency(totalExpected)}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'View All Invoices', icon: List, tab: 'allInvoices', color: 'primary' },
              { label: 'Collect Payment', icon: DollarSign, tab: 'collect', color: 'green' },
              { label: 'Generate Invoices', icon: Receipt, tab: 'invoices', color: 'blue' },
              { label: 'View Defaulters', icon: AlertCircle, tab: 'defaulters', color: 'red' },
            ].map(a => (
              <button key={a.label} onClick={() => onNavigate(a.tab)} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 dark:border-[#38383A] hover:bg-gray-50 dark:hover:bg-[#2C2C2E] transition-all text-left group">
                <div className={`p-2 bg-${a.color}-100 dark:bg-${a.color}-900/30 rounded-lg group-hover:scale-105 transition-transform`}><a.icon className={`h-4 w-4 text-${a.color}-600 dark:text-${a.color}-400`} /></div>
                <span className="text-sm font-medium text-gray-700 dark:text-[#8E8E93] group-hover:text-gray-900 dark:group-hover:text-white transition-colors">{a.label}</span>
              </button>
            ))}
          </div>
        </div>

        {statusItems && statusTotal > 0 ? (
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Invoice Status Distribution</h3>
            <div className="flex h-3 rounded-full overflow-hidden bg-gray-200 dark:bg-[#38383A] mb-4">
              {statusItems.map(item => item.value > 0 && <div key={item.label} className={`${item.color}`} style={{ width: `${(item.value / statusTotal) * 100}%` }} />)}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {statusItems.map(item => (
                <div key={item.label} className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${item.color}`} />
                  <span className="text-sm text-gray-600 dark:text-[#8E8E93]">{item.label}</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white ml-auto">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Summary</h3>
            <div className="space-y-3">
              {[{ l: 'Total Invoices', v: data.recentInvoices?.length || 0 }, { l: 'Recent Payments', v: data.recentPayments?.length || 0 }, { l: 'Collection Rate', v: `${collectionRate}%`, g: true }].map(r => (
                <div key={r.l} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-[#38383A] last:border-0">
                  <span className="text-sm text-gray-600 dark:text-[#8E8E93]">{r.l}</span>
                  <span className={`text-sm font-semibold ${r.g ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'}`}>{r.v}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {chartData.length > 0 && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Daily Collection (This Month)</h3>
          <div className="flex items-end gap-1 h-32">
            {chartData.slice(-14).map((day, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center gap-1 group">
                <div className="relative w-full flex justify-center">
                  <div className="absolute -top-6 hidden group-hover:block text-xs font-semibold text-gray-700 dark:text-white bg-white dark:bg-[#2C2C2E] px-2 py-1 rounded shadow-lg border border-gray-200 dark:border-[#38383A] whitespace-nowrap z-10">{formatCurrency(day.amount)}</div>
                </div>
                <div className="w-full bg-primary-500 dark:bg-primary-400 rounded-t-sm hover:bg-primary-600 dark:hover:bg-primary-300 transition-colors min-h-[2px]" style={{ height: `${Math.max((day.amount / maxChartVal) * 100, 2)}%` }} />
                <span className="text-[10px] text-gray-400 dark:text-[#636366] truncate w-full text-center">{new Date(day.date).getDate()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.recentPayments?.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-[#38383A] flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2"><DollarSign className="h-4 w-4 text-green-500" /> Recent Payments <span className="text-xs font-normal text-gray-400 dark:text-[#636366]">({data.recentPayments.length})</span></h3>
            <button onClick={() => onNavigate('receipts')} className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700">View All &rarr;</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] divide-y divide-gray-200 dark:divide-[#38383A]">
              <thead className="bg-gray-50 dark:bg-[#2C2C2E]"><tr>{['Receipt', 'Student', 'Amount', 'Method', 'Date', 'Actions'].map(h => <th key={h} className={`px-5 py-3 text-xs font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wide ${h === 'Amount' || h === 'Actions' ? 'text-right' : h === 'Method' ? 'text-center' : 'text-left'}`}>{h}</th>)}</tr></thead>
              <tbody className="bg-white dark:bg-[#1C1C1E] divide-y divide-gray-100 dark:divide-[#38383A]">
                {data.recentPayments.slice(0, 10).map((p) => (
                  <tr key={p._id} className="hover:bg-gray-50 dark:hover:bg-[#2C2C2E] transition-colors">
                    <td className="px-5 py-3 whitespace-nowrap text-sm font-mono font-semibold text-primary-600 dark:text-primary-400">{p.receiptNumber}</td>
                    <td className="px-5 py-3 whitespace-nowrap"><div className="text-sm font-medium text-gray-900 dark:text-white">{p.studentId?.name || p.studentId?.fullName || 'N/A'}</div><div className="text-xs text-gray-400 dark:text-[#636366]">{p.studentId?.admissionNumber || ''}</div></td>
                    <td className="px-5 py-3 whitespace-nowrap text-right text-sm font-bold text-green-600 dark:text-green-400">{formatCurrency(p.amount)}</td>
                    <td className="px-5 py-3 whitespace-nowrap text-center"><span className="px-2 py-0.5 bg-gray-100 dark:bg-[#2C2C2E] text-gray-600 dark:text-[#8E8E93] text-xs rounded-md font-medium">{p.paymentMethod}</span></td>
                    <td className="px-5 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-[#8E8E93]">{new Date(p.paymentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</td>
                    <td className="px-5 py-3 whitespace-nowrap text-right"><div className="flex justify-end gap-1"><button onClick={() => onPrintReceipt(p._id)} className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors" title="View"><Eye className="h-3.5 w-3.5" /></button><button onClick={() => onDownloadReceipt(p._id)} className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors" title="Download"><Download className="h-3.5 w-3.5" /></button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data.recentInvoices?.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-[#38383A] flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2"><FileText className="h-4 w-4 text-primary-500" /> Recent Invoices <span className="text-xs font-normal text-gray-400 dark:text-[#636366]">({data.recentInvoices.length})</span></h3>
            <button onClick={() => onNavigate('allInvoices')} className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700">View All &rarr;</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] divide-y divide-gray-200 dark:divide-[#38383A]">
              <thead className="bg-gray-50 dark:bg-[#2C2C2E]"><tr>{['Invoice', 'Student', 'Class', 'Amount', 'Status', 'Due', 'Actions'].map(h => <th key={h} className={`px-5 py-3 text-xs font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wide ${h === 'Amount' || h === 'Actions' ? 'text-right' : h === 'Status' ? 'text-center' : 'text-left'}`}>{h}</th>)}</tr></thead>
              <tbody className="bg-white dark:bg-[#1C1C1E] divide-y divide-gray-100 dark:divide-[#38383A]">
                {data.recentInvoices.slice(0, 10).map((inv) => (
                  <tr key={inv._id} className="hover:bg-gray-50 dark:hover:bg-[#2C2C2E] transition-colors">
                    <td className="px-5 py-3 whitespace-nowrap text-sm font-mono font-semibold text-primary-600 dark:text-primary-400">{inv.invoiceNumber}</td>
                    <td className="px-5 py-3 whitespace-nowrap"><div className="text-sm font-medium text-gray-900 dark:text-white">{inv.studentId?.fullName || inv.studentId?.name || 'N/A'}</div><div className="text-xs text-gray-400 dark:text-[#636366]">{inv.studentId?.admissionNumber || ''}</div></td>
                    <td className="px-5 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-[#8E8E93]">{inv.classId?.name || '-'}</td>
                    <td className="px-5 py-3 whitespace-nowrap text-right text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(inv.totalAmount)}</td>
                    <td className="px-5 py-3 whitespace-nowrap text-center"><StatusBadge status={inv.status} /></td>
                    <td className="px-5 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-[#8E8E93]">{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '-'}</td>
                    <td className="px-5 py-3 whitespace-nowrap text-right"><div className="flex justify-end gap-1"><button onClick={() => onEditInvoice(inv)} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors" title="Edit"><Edit className="h-3.5 w-3.5" /></button><button onClick={() => onDeleteInvoice(inv._id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button></div></td>
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

// ── Fee Structure Tab ──

const FeeStructureTab = ({ feeStructures, classes, onCreateNew, onEdit, onDelete, onDuplicate }) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [filterClass, setFilterClass] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [exporting, setExporting] = useState(false)

  const handleExportStructures = async () => {
    try {
      setExporting(true)
      const response = await feeStructuresService.export()
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `fee_structures_export_${new Date().toISOString().split('T')[0]}.csv`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      toast.success('Fee structures exported successfully')
    } catch (err) {
      toast.error('Failed to export fee structures')
    } finally {
      setExporting(false)
    }
  }

  const getClassSortOrder = (name) => {
    const specialOrder = { 'nursery': 0, 'lkg': 1, 'ukg': 2 }
    const lower = (name || '').toLowerCase().trim()
    if (lower in specialOrder) return specialOrder[lower]
    const num = parseInt(lower.replace(/\D/g, ''), 10)
    return isNaN(num) ? 999 : num + 2
  }

  const filtered = feeStructures.filter(s => {
    if (filterClass && (typeof s.classId === 'object' ? s.classId?._id : s.classId) !== filterClass) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      const cn = (typeof s.classId === 'object' ? s.classId?.name : '').toLowerCase()
      const heads = (s.feeHeads || []).map(h => (h.name || '').toLowerCase()).join(' ')
      return cn.includes(q) || heads.includes(q)
    }
    return true
  }).sort((a, b) => {
    const nameA = typeof a.classId === 'object' ? a.classId?.name : ''
    const nameB = typeof b.classId === 'object' ? b.classId?.name : ''
    return getClassSortOrder(nameA) - getClassSortOrder(nameB)
  })

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="card p-4"><p className="text-[10px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wide">Total Structures</p><p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{feeStructures.length}</p></div>
        <div className="card p-4"><p className="text-[10px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wide">Active</p><p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">{feeStructures.filter(s => s.isActive).length}</p></div>
        <div className="card p-4 col-span-2 sm:col-span-1"><p className="text-[10px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wide">Combined Value</p><p className="text-2xl font-bold text-primary-600 dark:text-primary-400 mt-1">{formatCurrency(filtered.reduce((sum, s) => sum + (s.totalAmount || s.feeHeads?.reduce((a, h) => a + (h.amount || 0), 0) || 0), 0))}</p></div>
      </div>

      <div className="card p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Fee Structures</h3>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
            <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-[#636366]" /><input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 pr-3 py-2 border border-gray-200 dark:border-[#38383A] dark:bg-[#1C1C1E] dark:text-white dark:placeholder-[#636366] rounded-xl text-sm w-full sm:w-48 focus:outline-none focus:ring-2 focus:ring-primary-300" /></div>
            {classes.length > 0 && <select value={filterClass} onChange={(e) => setFilterClass(e.target.value)} className="input text-sm w-auto"><option value="">All Classes</option>{classes.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}</select>}
            <button onClick={handleExportStructures} disabled={exporting || feeStructures.length === 0} className="btn btn-outline btn-sm flex items-center justify-center gap-1.5"><Download className="h-4 w-4" /> {exporting ? 'Exporting...' : 'Export'}</button>
            <button onClick={onCreateNew} className="btn btn-primary btn-sm flex items-center justify-center gap-1.5"><Plus className="h-4 w-4" /> Create New</button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={Settings} title={searchQuery || filterClass ? 'No matching structures' : 'No fee structures'} description={searchQuery || filterClass ? 'Try adjusting filters' : 'Create a fee structure to start generating invoices'} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((s) => {
              const total = s.totalAmount || s.feeHeads?.reduce((sum, h) => sum + (h.amount || 0), 0) || 0
              const isExpanded = expandedId === s._id
              return (
                <div key={s._id} className="border border-gray-200 dark:border-[#38383A] bg-white dark:bg-[#1C1C1E] rounded-xl overflow-hidden hover:shadow-md transition-shadow">
                  <div className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div><h4 className="font-semibold text-gray-900 dark:text-white">{typeof s.classId === 'object' ? s.classId?.name : 'Class'}</h4><p className="text-xs text-gray-500 dark:text-[#636366]">{s.sectionId?.name || 'All Sections'}</p></div>
                      <StatusBadge status={s.isActive ? 'Active' : 'Inactive'} />
                    </div>
                    <div className="flex items-baseline justify-between mb-3">
                      <span className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(total)}</span>
                      <span className="text-xs text-gray-500 dark:text-[#636366]">{s.feeHeads?.length || 0} heads</span>
                    </div>
                    <button onClick={() => setExpandedId(isExpanded ? null : s._id)} className="w-full flex items-center justify-between py-2 text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700">
                      <span>{isExpanded ? 'Hide' : 'View'} Fee Heads</span>
                      {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </button>
                    {isExpanded && (
                      <div className="space-y-1.5 pt-2 border-t border-gray-100 dark:border-[#38383A]">
                        {s.feeHeads?.map((h, i) => (
                          <div key={i} className="flex items-center justify-between text-xs py-1">
                            <div className="flex items-center gap-1.5"><span className="text-gray-700 dark:text-gray-300">{h.name}</span>{h.isCompulsory && <span className="px-1 py-0.5 text-[9px] bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded font-semibold">Req</span>}</div>
                            <div><span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(h.amount)}</span><span className="text-gray-400 dark:text-[#636366] ml-1 capitalize">/{h.frequency}</span></div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="px-4 py-3 border-t border-gray-100 dark:border-[#38383A] bg-gray-50 dark:bg-[#2C2C2E] flex gap-2">
                    <button onClick={() => onEdit(s)} className="flex-1 btn btn-sm btn-outline text-xs">Edit</button>
                    <button onClick={() => onDuplicate(s)} className="btn btn-sm btn-outline text-xs p-2" title="Duplicate"><Copy className="h-3.5 w-3.5" /></button>
                    <button onClick={() => onDelete(s._id)} className="btn btn-sm text-xs p-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 border border-red-200 dark:border-red-800/30" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Generate Invoices Tab ──

const InvoicesTab = ({ classes, feeStructures, activeSession, onShowIndividual }) => {
  const queryClient = useQueryClient()
  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-50 to-primary-50 dark:from-blue-900/15 dark:to-primary-900/15 rounded-xl p-5 border border-blue-100 dark:border-blue-800/30">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex-shrink-0">
            <Receipt className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Generate Invoices</h3>
            <p className="text-sm text-gray-600 dark:text-[#8E8E93] mt-0.5">
              Create invoices for individual students or generate in bulk for an entire class or section.
            </p>
          </div>
        </div>
      </div>

      {/* Individual + Bulk side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Individual Invoice Card */}
        <div className="card p-5 flex flex-col">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex-shrink-0">
              <Receipt className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white">Individual Invoice</h4>
              <p className="text-xs text-gray-500 dark:text-[#636366]">Generate for a single student</p>
            </div>
          </div>
          <ul className="text-xs text-gray-600 dark:text-[#8E8E93] space-y-2 mb-5 flex-1">
            {[
              'Search and select any student',
              'Choose fee structure & billing period',
              'Preview fee breakdown before generating',
            ].map(t => (
              <li key={t} className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                {t}
              </li>
            ))}
          </ul>
          <button onClick={onShowIndividual} className="w-full btn btn-primary flex items-center justify-center gap-2">
            <Receipt className="h-4 w-4" />
            Generate Individual Invoice
          </button>
        </div>

        {/* Bulk Invoice Card */}
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-primary-100 dark:bg-primary-900/30 rounded-xl flex-shrink-0">
              <Users className="h-5 w-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white">Bulk Invoice</h4>
              <p className="text-xs text-gray-500 dark:text-[#636366]">Generate for entire class or section at once</p>
            </div>
          </div>
          <BulkInvoiceForm
            classes={classes}
            feeStructures={feeStructures}
            activeSession={activeSession}
            onSuccess={() => {
              toast.success('Bulk invoices generated')
              queryClient.invalidateQueries({ queryKey: ['fees-dashboard'] })
            }}
          />
        </div>
      </div>

      {/* Bulk Delete - separate row, full width */}
      <div className="card p-5 border-red-200/60 dark:border-red-900/40">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 bg-red-100 dark:bg-red-900/30 rounded-xl flex-shrink-0">
            <Trash2 className="h-5 w-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white">Bulk Delete Pending Invoices</h4>
            <p className="text-xs text-gray-500 dark:text-[#636366]">Remove all pending invoices for a class. Only invoices with no payments will be deleted.</p>
          </div>
        </div>
        <div className="max-w-md">
          <BulkDeleteInvoiceForm
            classes={classes}
            activeSession={activeSession}
            onSuccess={() => queryClient.invalidateQueries({ queryKey: ['fees-dashboard'] })}
          />
        </div>
      </div>
    </div>
  )
}

// ── Collect Payment Tab ──

const CollectPaymentTab = ({ dashboardData, selectedStudent, onSelectStudent }) => (
  <div className="space-y-6">
    <div className="bg-gradient-to-r from-primary-50 to-primary-100 dark:from-[#1a3a35] dark:to-[#162e2a] border border-primary-200 dark:border-[#2a5a52] rounded-xl p-5 sm:p-6">
      <div className="flex flex-col sm:flex-row items-start gap-4">
        <div className="p-3 bg-primary-600 rounded-xl flex-shrink-0"><DollarSign className="h-6 w-6 text-white" /></div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-primary-900 dark:text-white mb-1">Collect Fee Payment</h3>
          <p className="text-sm text-primary-700 dark:text-primary-300 mb-3">Search for a student to view their pending invoices and collect payment.</p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-primary-600 dark:text-primary-400">
            {['Search student', 'Select invoice', 'Collect payment'].map((step, i) => (
              <React.Fragment key={step}>{i > 0 && <span className="hidden sm:inline text-primary-300 dark:text-primary-600">&rarr;</span>}<span className="flex items-center gap-1.5"><span className="w-5 h-5 rounded-full bg-primary-600 text-white text-[10px] font-bold flex items-center justify-center">{i + 1}</span>{step}</span></React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>

    {dashboardData && (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: 'Pending Dues', value: dashboardData.summary?.totalPending, color: 'amber', icon: AlertCircle },
          { label: 'Overdue Amount', value: dashboardData.summary?.totalOverdue, color: 'red', icon: AlertTriangle },
          { label: 'This Month', value: dashboardData.summary?.thisMonthCollection, color: 'green', icon: TrendingUp },
        ].map((c) => (
          <div key={c.label} className="card p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div><p className="text-[10px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wide">{c.label}</p><p className={`text-xl font-bold text-${c.color}-600 dark:text-${c.color}-400 mt-1`}>{formatCurrency(c.value)}</p></div>
              <div className={`p-2.5 bg-${c.color}-100 dark:bg-${c.color}-500/15 rounded-xl`}><c.icon className={`h-5 w-5 text-${c.color}-600 dark:text-${c.color}-400`} /></div>
            </div>
          </div>
        ))}
      </div>
    )}

    <div className="card p-4 sm:p-6">
      <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2"><Search className="h-4 w-4 text-gray-400 dark:text-[#636366]" /> Search Student</h4>
      <StudentSearch onSelectStudent={onSelectStudent} />
      {selectedStudent ? (
        <div className="mt-5 p-4 bg-primary-50 dark:bg-primary-500/10 border border-primary-200 dark:border-primary-500/20 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary-100 dark:bg-primary-500/15 flex items-center justify-center flex-shrink-0">
              <span className="text-base font-bold text-primary-700 dark:text-primary-400">{(selectedStudent.fullName || selectedStudent.name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}</span>
            </div>
            <div><p className="text-sm font-medium text-primary-900 dark:text-primary-300">Selected Student</p><p className="text-base font-bold text-primary-700 dark:text-primary-400">{selectedStudent.fullName || selectedStudent.name}</p><p className="text-xs text-primary-600 dark:text-primary-400/80">ID: {selectedStudent.studentId || selectedStudent.admissionNumber}</p></div>
          </div>
        </div>
      ) : (
        <div className="mt-5 text-center py-10 border border-dashed border-gray-200 dark:border-[#2C2C2E] rounded-xl bg-gray-50/50 dark:bg-[#1C1C1E]/50">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-[#2C2C2E] flex items-center justify-center mx-auto mb-3">
            <Users className="h-7 w-7 text-gray-300 dark:text-[#48484A]" />
          </div>
          <p className="text-gray-600 dark:text-[#8E8E93] font-medium text-sm">No student selected</p>
          <p className="text-xs text-gray-400 dark:text-[#636366] mt-1">Search and select a student to view their pending invoices</p>
        </div>
      )}
    </div>
  </div>
)

// ── Defaulters Tab ──

const DefaultersTab = ({ defaulters, loading, classes = [], activeSession, onExport, dateFilter = { startDate: '', endDate: '' }, onDateFilterChange = () => {} }) => {
  const queryClient = useQueryClient()
  const { settings } = useSettings()
  const [applyingLateFee, setApplyingLateFee] = useState(false)
  const [lateFeeModal, setLateFeeModal] = useState({ isOpen: false, invoiceId: null, studentName: '' })
  const [lateFeeAmount, setLateFeeAmount] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [classFilter, setClassFilter] = useState('')
  const [sectionFilter, setSectionFilter] = useState('')
  const [minBalanceFilter, setMinBalanceFilter] = useState('')
  const [overdueOnly, setOverdueOnly] = useState(false)
  const [periodPreset, setPeriodPreset] = useState('all')
  const [sortField, setSortField] = useState('totalBalance')
  const [sortAsc, setSortAsc] = useState(false)
  const [showClassSummary, setShowClassSummary] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)

  // Indian-academic-year base year: from active session start, or heuristic (Apr-Mar)
  const sessionStartYear = useMemo(() => {
    if (activeSession?.startDate) return new Date(activeSession.startDate).getFullYear()
    const now = new Date()
    return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
  }, [activeSession?.startDate])

  const fmtYMD = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const monthFromYMD = (s) => (s ? s.slice(0, 7) : '')
  const lastDay = (yy, mm /* 1-12 */) => new Date(yy, mm, 0).getDate()

  const applyPreset = (preset) => {
    setPeriodPreset(preset)
    const now = new Date()
    let s, e
    if (preset === 'all') { onDateFilterChange({ startDate: '', endDate: '' }); return }
    if (preset === 'thisMonth') { s = new Date(now.getFullYear(), now.getMonth(), 1); e = new Date(now.getFullYear(), now.getMonth() + 1, 0) }
    else if (preset === 'lastMonth') { s = new Date(now.getFullYear(), now.getMonth() - 1, 1); e = new Date(now.getFullYear(), now.getMonth(), 0) }
    else if (preset === 'q1') { s = new Date(sessionStartYear, 3, 1); e = new Date(sessionStartYear, 6, 0) }
    else if (preset === 'q2') { s = new Date(sessionStartYear, 6, 1); e = new Date(sessionStartYear, 9, 0) }
    else if (preset === 'q3') { s = new Date(sessionStartYear, 9, 1); e = new Date(sessionStartYear, 12, 0) }
    else if (preset === 'q4') { s = new Date(sessionStartYear + 1, 0, 1); e = new Date(sessionStartYear + 1, 3, 0) }
    else if (preset === 'fullYear') { s = new Date(sessionStartYear, 3, 1); e = new Date(sessionStartYear + 1, 2, 31) }
    else return
    onDateFilterChange({ startDate: fmtYMD(s), endDate: fmtYMD(e) })
  }

  const onMonthChange = (m, which) => {
    setPeriodPreset('custom')
    if (!m) {
      onDateFilterChange({ ...dateFilter, [which === 'from' ? 'startDate' : 'endDate']: '' })
      return
    }
    const [yy, mm] = m.split('-').map(Number)
    if (which === 'from') {
      onDateFilterChange({ ...dateFilter, startDate: `${yy}-${String(mm).padStart(2, '0')}-01` })
    } else {
      const ld = lastDay(yy, mm)
      onDateFilterChange({ ...dateFilter, endDate: `${yy}-${String(mm).padStart(2, '0')}-${String(ld).padStart(2, '0')}` })
    }
  }

  // Dedupe classes by name (multiple academic-year duplicates can exist)
  const uniqueClasses = []
  const seenClassNames = new Set()
  for (const c of classes) {
    const key = (c.name || '').toLowerCase().trim()
    if (key && !seenClassNames.has(key)) { seenClassNames.add(key); uniqueClasses.push(c) }
  }
  const selectedClass = uniqueClasses.find(c => c._id === classFilter)
  const selectedClassName = (selectedClass?.name || '').toLowerCase().trim()
  // Pool sections from ALL classes sharing the selected class name (across years), deduped by section name.
  // Prevents the section filter from dropping students whose sectionId belongs to a different year
  // than the deduped dropdown entry.
  const sectionsForClass = (() => {
    if (!selectedClass) return []
    const seen = new Set()
    const out = []
    for (const c of classes) {
      if ((c.name || '').toLowerCase().trim() !== selectedClassName) continue
      for (const s of (c.sections || [])) {
        const k = (s?.name || '').toLowerCase().trim()
        if (k && !seen.has(k)) { seen.add(k); out.push(s) }
      }
    }
    return out
  })()
  const selectedSection = sectionsForClass.find(s => s._id === sectionFilter)
  const selectedSectionName = (selectedSection?.name || '').toLowerCase().trim()

  const handleApplyLateFee = async () => {
    if (!lateFeeModal.invoiceId || !lateFeeAmount || parseFloat(lateFeeAmount) <= 0) { toast.error('Enter a valid amount'); return }
    try { setApplyingLateFee(true); await invoicesService.applyLateFee(lateFeeModal.invoiceId, parseFloat(lateFeeAmount)); toast.success('Late fee applied'); setLateFeeModal({ isOpen: false, invoiceId: null, studentName: '' }); setLateFeeAmount(''); queryClient.invalidateQueries({ queryKey: ['fees-defaulters'] }) }
    catch (error) { toast.error(error.response?.data?.message || 'Failed') } finally { setApplyingLateFee(false) }
  }

  const safeDefaulters = defaulters.filter(d => (d.liveBalance ?? d.totalBalance) > 0 && d.studentId)
  const filteredDefaulters = safeDefaulters.filter(d => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      const match = (d.studentId?.fullName || d.studentId?.name || '').toLowerCase().includes(q) || (d.studentId?.admissionNumber || d.studentId?.studentId || '').toLowerCase().includes(q) || (d.studentId?.phone || '').toLowerCase().includes(q)
      if (!match) return false
    }
    if (classFilter) {
      const studentClassName = (d.studentId?.classId?.name || '').toLowerCase().trim()
      if (!studentClassName || studentClassName !== selectedClassName) return false
    }
    if (sectionFilter) {
      // Compare by name — section _ids differ across academic years even when names match.
      const studentSectionName = (d.studentId?.sectionId?.name || '').toLowerCase().trim()
      if (!studentSectionName || studentSectionName !== selectedSectionName) return false
    }
    if (minBalanceFilter && !isNaN(parseFloat(minBalanceFilter))) {
      if ((d.liveBalance ?? d.totalBalance ?? 0) < parseFloat(minBalanceFilter)) return false
    }
    if (overdueOnly && !(d.overdueDays > 0)) return false
    return true
  })

  const clearFilters = () => { setSearchQuery(''); setClassFilter(''); setSectionFilter(''); setMinBalanceFilter(''); setOverdueOnly(false); setPeriodPreset('all'); onDateFilterChange({ startDate: '', endDate: '' }) }

  const periodLabel = (() => {
    if (!dateFilter.startDate && !dateFilter.endDate) return 'All Pending'
    const labels = { thisMonth: 'This Month', lastMonth: 'Last Month', q1: 'Q1 (Apr–Jun)', q2: 'Q2 (Jul–Sep)', q3: 'Q3 (Oct–Dec)', q4: 'Q4 (Jan–Mar)', fullYear: 'Full Academic Year' }
    if (labels[periodPreset]) return labels[periodPreset]
    const fmt = (d) => d ? new Date(d).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : '—'
    return `${fmt(dateFilter.startDate)} to ${fmt(dateFilter.endDate)}`
  })()

  const handlePrint = () => {
    const total = sortedDefaulters.reduce((s, d) => s + (d.liveBalance ?? d.totalBalance ?? 0), 0)

    // Group by class for printed list
    const grouped = {}
    sortedDefaulters.forEach(d => {
      const c = d.studentId?.classId?.name || 'Unknown'
      if (!grouped[c]) grouped[c] = []
      grouped[c].push(d)
    })
    const classOrder = Object.keys(grouped).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))

    const groupedRows = classOrder.map(cn => {
      const list = grouped[cn]
      const subtotal = list.reduce((s, d) => s + (d.liveBalance ?? d.totalBalance ?? 0), 0)
      const inner = list.map((d, i) => {
        const bal = d.liveBalance ?? d.totalBalance ?? 0
        const ov = d.overdueDays ?? 0
        const due = d.oldestDueDate ? new Date(d.oldestDueDate).toLocaleDateString('en-IN') : '-'
        const sec = d.studentId?.sectionId?.name ? ` - ${d.studentId.sectionId.name}` : ''
        return `<tr>
          <td>${i + 1}</td>
          <td>${d.studentId?.admissionNumber || d.studentId?.studentId || '-'}</td>
          <td>${d.studentId?.fullName || d.studentId?.name || 'N/A'}</td>
          <td>${cn}${sec}</td>
          <td>${d.studentId?.phone || '-'}</td>
          <td style="text-align:right">${formatCurrency(bal)}</td>
          <td style="text-align:center">${d.unpaidInvoiceCount ?? d.invoiceIds?.length ?? '-'}</td>
          <td>${due}</td>
          <td>${ov > 0 ? `${ov} days` : 'Not yet due'}</td>
        </tr>`
      }).join('')
      return `
        <tr class="cls-head"><td colspan="9">Class: ${cn} &middot; ${list.length} student${list.length === 1 ? '' : 's'} &middot; Outstanding: ${formatCurrency(subtotal)}</td></tr>
        ${inner}
        <tr class="cls-sub"><td colspan="5" style="text-align:right">Class subtotal</td><td style="text-align:right">${formatCurrency(subtotal)}</td><td colspan="3"></td></tr>
      `
    }).join('')

    const summaryRows = classWiseSummary.map(c => `
      <tr><td>${c.className}</td><td style="text-align:center">${c.students}</td><td style="text-align:right">${formatCurrency(c.total)}</td></tr>
    `).join('')

    const schoolName = settings?.institution?.name || ''
    const logo = settings?.institution?.logo || ''
    const filterBits = []
    if (classFilter) filterBits.push(`Class: ${selectedClass?.name || ''}`)
    if (sectionFilter) filterBits.push(`Section: ${selectedSection?.name || ''}`)
    if (overdueOnly) filterBits.push('Overdue only')
    if (minBalanceFilter) filterBits.push(`Min balance: ${formatCurrency(minBalanceFilter)}`)
    if (searchQuery) filterBits.push(`Search: "${searchQuery}"`)

    const html = `<!DOCTYPE html><html><head><title>Pending Fees Report</title><style>
      @page { size: A4; margin: 12mm }
      body{font-family:Arial,sans-serif;color:#000;margin:0}
      .head{display:flex;align-items:center;gap:12px;border-bottom:2px solid #1F7A3A;padding-bottom:8px;margin-bottom:10px}
      .head img{height:56px;width:56px;object-fit:contain}
      .head .school{font-size:18px;font-weight:700}
      .head .title{font-size:13px;font-weight:600;color:#1F7A3A}
      .meta{font-size:10px;color:#444;margin:0 0 12px;display:flex;flex-wrap:wrap;gap:6px 14px}
      .meta b{color:#000}
      h2{font-size:12px;margin:14px 0 6px;color:#1F7A3A;border-bottom:1px solid #ddd;padding-bottom:3px}
      table{width:100%;border-collapse:collapse;font-size:10.5px}
      th,td{border:1px solid #bbb;padding:5px 7px;text-align:left;vertical-align:top}
      th{background:#1F7A3A;color:#fff;font-weight:600}
      .summary th{background:#eef5ee;color:#1F7A3A}
      .cls-head td{background:#1F7A3A;color:#fff;font-weight:700;font-size:10.5px}
      .cls-sub td{background:#eef5ee;font-weight:700}
      tfoot td{font-weight:700;background:#fafafa}
      tfoot .grand td{background:#1F7A3A;color:#fff;font-size:12px;padding:8px 7px}
      .totals{margin-top:14px;font-size:12px;display:flex;justify-content:space-between;border-top:2px solid #1F7A3A;padding-top:8px;font-weight:700}
      @media print{.noprint{display:none}}
    </style></head><body>
      <div class="head">
        ${logo ? `<img src="${logo}" alt="logo"/>` : ''}
        <div>
          ${schoolName ? `<div class="school">${schoolName}</div>` : ''}
          <div class="title">Pending Fees Report</div>
        </div>
      </div>
      <div class="meta">
        <span><b>Period:</b> ${periodLabel}</span>
        <span><b>Session:</b> ${activeSession?.name || '-'}</span>
        ${filterBits.length ? `<span><b>Filters:</b> ${filterBits.join(' · ')}</span>` : ''}
        <span><b>Generated:</b> ${new Date().toLocaleString('en-IN')}</span>
      </div>

      <h2>Class-wise Summary</h2>
      <table class="summary">
        <thead><tr><th>Class</th><th style="text-align:center">Students</th><th style="text-align:right">Outstanding</th></tr></thead>
        <tbody>${summaryRows || '<tr><td colspan="3" style="text-align:center;padding:14px">No data</td></tr>'}</tbody>
        <tfoot><tr><td>Total</td><td style="text-align:center">${sortedDefaulters.length}</td><td style="text-align:right">${formatCurrency(total)}</td></tr></tfoot>
      </table>

      <h2>Defaulters Detail</h2>
      <table>
        <thead><tr><th>#</th><th>Adm. No.</th><th>Student</th><th>Class &amp; Section</th><th>Phone</th><th style="text-align:right">Pending</th><th style="text-align:center">Inv.</th><th>Oldest Due</th><th>Overdue</th></tr></thead>
        <tbody>${groupedRows || '<tr><td colspan="9" style="text-align:center;padding:20px">No defaulters</td></tr>'}</tbody>
        <tfoot>
          <tr class="grand">
            <td colspan="2" style="text-align:left">GRAND TOTAL</td>
            <td colspan="3" style="text-align:right">Total Students: ${sortedDefaulters.length}</td>
            <td style="text-align:right">${formatCurrency(total)}</td>
            <td colspan="3"></td>
          </tr>
        </tfoot>
      </table>

      <div class="totals">
        <span>Total Students: ${sortedDefaulters.length}</span>
        <span>Total Outstanding: ${formatCurrency(total)}</span>
      </div>

      <script>window.onload=function(){setTimeout(function(){window.print()},150)}</script>
    </body></html>`
    const win = window.open('', '_blank', 'width=1100,height=800')
    if (win) { win.document.write(html); win.document.close() }
    else toast.error('Pop-up blocked — please allow pop-ups')
  }

  const sortedDefaulters = [...filteredDefaulters].sort((a, b) => {
    const dir = sortAsc ? 1 : -1
    if (sortField === 'name') return dir * ((a.studentId?.fullName || a.studentId?.name || '').localeCompare(b.studentId?.fullName || b.studentId?.name || ''))
    if (sortField === 'admissionNumber') {
      const an = a.studentId?.admissionNumber || a.studentId?.studentId || ''
      const bn = b.studentId?.admissionNumber || b.studentId?.studentId || ''
      return dir * an.localeCompare(bn, undefined, { numeric: true, sensitivity: 'base' })
    }
    if (sortField === 'totalBalance') return dir * ((a.liveBalance ?? a.totalBalance ?? 0) - (b.liveBalance ?? b.totalBalance ?? 0))
    if (sortField === 'overdueDays') return dir * ((a.overdueDays ?? 0) - (b.overdueDays ?? 0))
    if (sortField === 'dueDate') return dir * ((a.oldestDueDate ? new Date(a.oldestDueDate).getTime() : 0) - (b.oldestDueDate ? new Date(b.oldestDueDate).getTime() : 0))
    return 0
  })

  const totalOutstanding = filteredDefaulters.reduce((sum, d) => sum + (d.liveBalance ?? d.totalBalance ?? 0), 0)
  const avgOverdueDays = filteredDefaulters.length
    ? Math.round(filteredDefaulters.reduce((s, d) => s + (d.overdueDays || 0), 0) / filteredDefaulters.length)
    : 0
  const SortIcon = ({ field }) => <span className="inline-block ml-1 text-[10px] opacity-50">{sortField === field ? (sortAsc ? '▲' : '▼') : '⇅'}</span>
  const handleSort = (f) => { if (sortField === f) setSortAsc(!sortAsc); else { setSortField(f); setSortAsc(false) } }
  const formatDueDate = (d) => { if (!d) return '-'; const dt = new Date(d); return isNaN(dt.getTime()) ? '-' : dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) }

  // Class-wise summary computed from sorted (already filtered) list
  const classWiseSummary = useMemo(() => {
    const m = {}
    sortedDefaulters.forEach(d => {
      const c = d.studentId?.classId?.name || 'Unknown'
      if (!m[c]) m[c] = { className: c, students: 0, total: 0 }
      m[c].students += 1
      m[c].total += (d.liveBalance ?? d.totalBalance ?? 0)
    })
    return Object.values(m).sort((a, b) => a.className.localeCompare(b.className, undefined, { numeric: true }))
  }, [sortedDefaulters])

  // Group sorted rows by class for the on-screen list (when no specific class filter)
  const groupedSortedDefaulters = useMemo(() => {
    if (classFilter) return null
    const m = {}
    sortedDefaulters.forEach(d => {
      const c = d.studentId?.classId?.name || 'Unknown'
      if (!m[c]) m[c] = []
      m[c].push(d)
    })
    return Object.entries(m)
      .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
      .map(([className, list]) => ({
        className,
        list,
        subtotal: list.reduce((s, d) => s + (d.liveBalance ?? d.totalBalance ?? 0), 0)
      }))
  }, [sortedDefaulters, classFilter])

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-4">
      {safeDefaulters.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="card p-4"><p className="text-[10px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wide">Total Defaulters</p><p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">{filteredDefaulters.length}</p></div>
          <div className="card p-4"><p className="text-[10px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wide">Total Outstanding</p><p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">{formatCurrency(totalOutstanding)}</p></div>
          <div className="card p-4"><p className="text-[10px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wide">Avg. Overdue</p><p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{avgOverdueDays} days</p></div>
        </div>
      )}

      <div className="card p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:items-end">
          <div className="w-full sm:flex-1 sm:min-w-[200px]"><label className="label mb-1 block text-xs">Search</label><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-[#636366]" /><input type="text" placeholder="Name, admission no, phone..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="input pl-9 text-sm" /></div></div>
          <div className="w-full sm:w-auto sm:min-w-[160px]"><label className="label mb-1 block text-xs">Class</label><select value={classFilter} onChange={e => { setClassFilter(e.target.value); setSectionFilter('') }} className="input text-sm"><option value="">All Classes</option>{uniqueClasses.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}</select></div>
          <div className="w-full sm:w-auto sm:min-w-[140px]"><label className="label mb-1 block text-xs">Section</label><select value={sectionFilter} onChange={e => setSectionFilter(e.target.value)} className="input text-sm" disabled={!classFilter || sectionsForClass.length === 0}><option value="">All Sections</option>{sectionsForClass.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}</select></div>
          <div className="w-full sm:w-auto sm:min-w-[150px]"><label className="label mb-1 block text-xs">Period</label>
            <select value={periodPreset} onChange={e => applyPreset(e.target.value)} className="input text-sm">
              <option value="all">All Pending</option>
              <option value="thisMonth">This Month</option>
              <option value="lastMonth">Last Month</option>
              <option value="q1">Q1 (Apr–Jun)</option>
              <option value="q2">Q2 (Jul–Sep)</option>
              <option value="q3">Q3 (Oct–Dec)</option>
              <option value="q4">Q4 (Jan–Mar)</option>
              <option value="fullYear">Full Academic Year</option>
              <option value="custom">Custom</option>
            </select>
          </div>
          <div className="w-full sm:w-auto sm:min-w-[140px]"><label className="label mb-1 block text-xs">From Month</label><input type="month" value={monthFromYMD(dateFilter.startDate)} onChange={e => onMonthChange(e.target.value, 'from')} className="input text-sm" /></div>
          <div className="w-full sm:w-auto sm:min-w-[140px]"><label className="label mb-1 block text-xs">To Month</label><input type="month" value={monthFromYMD(dateFilter.endDate)} onChange={e => onMonthChange(e.target.value, 'to')} className="input text-sm" /></div>
          <div className="w-full sm:w-auto sm:min-w-[140px]"><label className="label mb-1 block text-xs">Min Balance</label><input type="number" min="0" placeholder="e.g. 1000" value={minBalanceFilter} onChange={e => setMinBalanceFilter(e.target.value)} className="input text-sm" /></div>
          <div className="w-full sm:w-auto"><label className="label mb-1 block text-xs">&nbsp;</label><label className="flex items-center gap-2 px-3 py-2 border border-gray-200 dark:border-[#38383A] rounded-xl text-sm cursor-pointer"><input type="checkbox" checked={overdueOnly} onChange={e => setOverdueOnly(e.target.checked)} className="h-4 w-4" /><span className="dark:text-white">Overdue only</span></label></div>
          <button onClick={clearFilters} className="btn btn-outline btn-sm flex items-center justify-center gap-1"><X className="h-3.5 w-3.5" /> Clear</button>
          <button onClick={handlePrint} className="btn btn-outline btn-sm flex items-center justify-center gap-1"><FileText className="h-3.5 w-3.5" /> Print</button>
          <div className="relative">
            <button onClick={() => setShowExportMenu(v => !v)} className="btn btn-outline btn-sm flex items-center justify-center gap-1"><Download className="h-3.5 w-3.5" /> Export <ChevronDown className="h-3 w-3" /></button>
            {showExportMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} />
                <div className="absolute right-0 mt-1 w-36 bg-white dark:bg-[#2C2C2E] border border-gray-200 dark:border-[#38383A] rounded-xl shadow-lg z-20">
                  <button onClick={() => { setShowExportMenu(false); onExport && onExport('csv', { classId: classFilter, sectionId: sectionFilter, minBalance: minBalanceFilter, startDate: dateFilter.startDate, endDate: dateFilter.endDate }) }} className="w-full px-4 py-2 text-sm text-left text-gray-700 dark:text-[#8E8E93] hover:bg-gray-50 dark:hover:bg-[#3A3A3C] rounded-t-xl">Export CSV</button>
                  <button onClick={() => { setShowExportMenu(false); onExport && onExport('excel', { classId: classFilter, sectionId: sectionFilter, minBalance: minBalanceFilter, startDate: dateFilter.startDate, endDate: dateFilter.endDate }) }} className="w-full px-4 py-2 text-sm text-left text-gray-700 dark:text-[#8E8E93] hover:bg-gray-50 dark:hover:bg-[#3A3A3C] rounded-b-xl">Export Excel</button>
                </div>
              </>
            )}
          </div>
        </div>
        {(dateFilter.startDate || dateFilter.endDate) && (
          <div className="mt-2 text-xs text-gray-500 dark:text-[#8E8E93]">Showing pending invoices with due dates in: <strong className="text-gray-700 dark:text-gray-200">{periodLabel}</strong></div>
        )}
      </div>

      {classWiseSummary.length > 0 && (
        <div className="card overflow-hidden">
          <button
            onClick={() => setShowClassSummary(v => !v)}
            className="w-full flex items-center justify-between px-4 sm:px-5 py-3 hover:bg-gray-50 dark:hover:bg-[#2C2C2E] transition-colors"
          >
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Class-wise Pending Summary</h3>
              <span className="text-xs text-gray-500 dark:text-[#8E8E93]">({classWiseSummary.length} {classWiseSummary.length === 1 ? 'class' : 'classes'} · {formatCurrency(sortedDefaulters.reduce((s, d) => s + (d.liveBalance ?? d.totalBalance ?? 0), 0))})</span>
            </div>
            {showClassSummary ? <ChevronUp className="h-4 w-4 text-gray-500 dark:text-[#8E8E93]" /> : <ChevronDown className="h-4 w-4 text-gray-500 dark:text-[#8E8E93]" />}
          </button>
          {showClassSummary && (
            <div className="px-4 sm:px-5 pb-4 border-t border-gray-100 dark:border-[#38383A]">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs uppercase tracking-wide text-gray-500 dark:text-[#8E8E93] border-b border-gray-100 dark:border-[#38383A]">
                    <th className="px-3 py-2">Class</th>
                    <th className="px-3 py-2 text-center">Students</th>
                    <th className="px-3 py-2 text-right">Outstanding</th>
                  </tr></thead>
                  <tbody>
                    {classWiseSummary.map(c => (
                      <tr key={c.className} className="border-b border-gray-50 dark:border-[#2C2C2E]">
                        <td className="px-3 py-2 text-gray-800 dark:text-gray-200">{c.className}</td>
                        <td className="px-3 py-2 text-center text-gray-700 dark:text-gray-300">{c.students}</td>
                        <td className="px-3 py-2 text-right font-semibold text-red-600 dark:text-red-400">{formatCurrency(c.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr className="border-t-2 border-gray-200 dark:border-[#38383A] font-semibold">
                    <td className="px-3 py-2 text-gray-900 dark:text-white">Total</td>
                    <td className="px-3 py-2 text-center text-gray-900 dark:text-white">{sortedDefaulters.length}</td>
                    <td className="px-3 py-2 text-right text-red-700 dark:text-red-400">{formatCurrency(sortedDefaulters.reduce((s, d) => s + (d.liveBalance ?? d.totalBalance ?? 0), 0))}</td>
                  </tr></tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="card p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Fee Defaulters</h3>
          <span className="text-sm text-gray-600 dark:text-[#8E8E93] whitespace-nowrap">{filteredDefaulters.length} students</span>
        </div>

        {sortedDefaulters.length === 0 ? <EmptyState icon={Users} title={searchQuery ? 'No matching defaulters' : 'No defaulters'} description={searchQuery ? 'Try adjusting search' : 'All students are up to date'} /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] divide-y divide-gray-200 dark:divide-[#38383A]">
              <thead className="bg-gray-50 dark:bg-[#2C2C2E]"><tr>
                {[{ l: 'Adm. No.', f: 'admissionNumber' }, { l: 'Student', f: 'name' }, { l: 'Total Due', f: 'totalBalance' }, { l: 'Due Date', f: 'dueDate' }, { l: 'Overdue', f: 'overdueDays' }, { l: 'Invoices' }, { l: 'Contact' }, { l: 'Actions', r: true }].map(c => (
                  <th key={c.l} onClick={c.f ? () => handleSort(c.f) : undefined} className={`px-5 py-3 text-xs font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wide ${c.r ? 'text-right' : 'text-left'} ${c.f ? 'cursor-pointer select-none hover:text-gray-700 dark:hover:text-white' : ''}`}>{c.l}{c.f && <SortIcon field={c.f} />}</th>
                ))}
              </tr></thead>
              <tbody className="bg-white dark:bg-[#1C1C1E] divide-y divide-gray-100 dark:divide-[#38383A]">
                {(() => {
                  const renderRow = (d) => {
                    const bal = d.liveBalance ?? d.totalBalance ?? 0, ov = d.overdueDays ?? 0
                    return (
                      <tr key={d._id} className="hover:bg-gray-50 dark:hover:bg-[#2C2C2E] transition-colors">
                        <td className="px-5 py-4 whitespace-nowrap text-sm font-mono text-gray-700 dark:text-gray-300">{d.studentId?.admissionNumber || d.studentId?.studentId || '-'}</td>
                        <td className="px-5 py-4 whitespace-nowrap"><div className="text-sm font-medium text-gray-900 dark:text-white">{d.studentId?.fullName || d.studentId?.name || 'Unknown'}</div><div className="text-xs text-gray-500 dark:text-[#8E8E93]">{d.studentId?.sectionId?.name || ''}</div></td>
                        <td className="px-5 py-4 whitespace-nowrap text-sm font-semibold text-red-600 dark:text-red-400">{formatCurrency(bal)}</td>
                        <td className="px-5 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">{formatDueDate(d.oldestDueDate)}</td>
                        <td className="px-5 py-4 whitespace-nowrap"><span className={`inline-flex px-2.5 py-0.5 text-xs font-semibold rounded-full ${ov > 60 ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400' : ov > 30 ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-400' : ov > 0 ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400' : 'bg-gray-100 dark:bg-gray-800/30 text-gray-600 dark:text-gray-400'}`}>{ov > 0 ? `${ov} days` : 'Not yet due'}</span></td>
                        <td className="px-5 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-[#8E8E93]">{d.unpaidInvoiceCount ?? d.invoiceIds?.length ?? '-'} unpaid</td>
                        <td className="px-5 py-4 whitespace-nowrap"><div className="text-sm text-gray-600 dark:text-[#8E8E93]">{d.studentId?.phone || '-'}</div></td>
                        <td className="px-5 py-4 whitespace-nowrap text-right">{d.invoiceIds?.[0] && <button onClick={() => setLateFeeModal({ isOpen: true, invoiceId: d.invoiceIds[0], studentName: d.studentId?.fullName || d.studentId?.name || 'Student' })} className="text-xs px-3 py-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800/30 transition-colors">+ Late Fee</button>}</td>
                      </tr>
                    )
                  }
                  if (groupedSortedDefaulters) {
                    return groupedSortedDefaulters.map(({ className, list, subtotal }) => (
                      <React.Fragment key={className}>
                        <tr className="bg-gray-50 dark:bg-[#2C2C2E]">
                          <td colSpan={8} className="px-5 py-2 text-xs font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-200">
                            <span className="mr-3">{className}</span>
                            <span className="text-gray-500 dark:text-[#8E8E93] font-normal">{list.length} student{list.length === 1 ? '' : 's'} · Outstanding {formatCurrency(subtotal)}</span>
                          </td>
                        </tr>
                        {list.map(renderRow)}
                      </React.Fragment>
                    ))
                  }
                  return sortedDefaulters.map(renderRow)
                })()}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {lateFeeModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) { setLateFeeModal({ isOpen: false, invoiceId: null, studentName: '' }); setLateFeeAmount('') } }}>
          <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-scale-in">
            <div className="p-5 border-b border-gray-100 dark:border-[#38383A] flex justify-between items-center"><h3 className="text-base font-bold text-gray-900 dark:text-white">Apply Late Fee</h3><button onClick={() => { setLateFeeModal({ isOpen: false, invoiceId: null, studentName: '' }); setLateFeeAmount('') }} className="btn-close"><X className="h-4 w-4" /></button></div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-gray-600 dark:text-[#8E8E93]">Apply late fee for <strong className="dark:text-white">{lateFeeModal.studentName}</strong></p>
              <div><label className="label mb-1 block">Amount</label><input type="number" min="1" autoFocus className="input" placeholder="e.g. 500" value={lateFeeAmount} onChange={(e) => setLateFeeAmount(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleApplyLateFee() }} /></div>
              <div className="flex justify-end gap-3"><button onClick={() => { setLateFeeModal({ isOpen: false, invoiceId: null, studentName: '' }); setLateFeeAmount('') }} className="btn btn-outline btn-sm">Cancel</button><button onClick={handleApplyLateFee} disabled={applyingLateFee || !lateFeeAmount} className="btn btn-sm bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">{applyingLateFee ? 'Applying...' : 'Apply'}</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Receipts Tab ──

const ReceiptsTab = ({ receipts, loading, fetching, hasMore, onLoadMore, filters, onFilterChange, onClearFilters, onPrintReceipt, onDownloadReceipt, onExport, onEditPayment, onReversePayment }) => {
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [sortField, setSortField] = useState('paymentDate')
  const [sortAsc, setSortAsc] = useState(false)
  const handleExport = (fmt) => {
    setShowExportMenu(false)
    onExport(fmt)
  }
  const sortedReceipts = useMemo(() => {
    const dir = sortAsc ? 1 : -1
    const arr = [...receipts]
    arr.sort((a, b) => {
      if (sortField === 'admissionNumber') {
        const an = a.studentId?.admissionNumber || a.studentId?.studentId || ''
        const bn = b.studentId?.admissionNumber || b.studentId?.studentId || ''
        return dir * an.localeCompare(bn, undefined, { numeric: true, sensitivity: 'base' })
      }
      if (sortField === 'receiptNumber') {
        return dir * String(a.receiptNumber || '').localeCompare(String(b.receiptNumber || ''), undefined, { numeric: true, sensitivity: 'base' })
      }
      if (sortField === 'amount') return dir * ((a.amount || 0) - (b.amount || 0))
      // paymentDate (default)
      const ad = a.paymentDate ? new Date(a.paymentDate).getTime() : 0
      const bd = b.paymentDate ? new Date(b.paymentDate).getTime() : 0
      return dir * (ad - bd)
    })
    return arr
  }, [receipts, sortField, sortAsc])
  const SortIcon = ({ field }) => <span className="inline-block ml-1 text-[10px] opacity-50">{sortField === field ? (sortAsc ? '▲' : '▼') : '⇅'}</span>
  const handleSort = (f) => { if (sortField === f) setSortAsc(!sortAsc); else { setSortField(f); setSortAsc(f === 'admissionNumber' || f === 'receiptNumber') } }
  return (
  <div className="space-y-4">
    <div className="card p-3 sm:p-4">
      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:items-end">
        <div className="w-full sm:flex-1 sm:min-w-[200px]"><label className="label mb-1 block text-xs">Search</label><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-[#636366]" /><input type="text" placeholder="Name, receipt no..." value={filters.search} onChange={e => onFilterChange({ ...filters, search: e.target.value })} className="input pl-9 text-sm" /></div></div>
        <div className="w-full sm:w-auto sm:min-w-[150px]"><label className="label mb-1 block text-xs">Method</label><select value={filters.paymentMethod} onChange={e => onFilterChange({ ...filters, paymentMethod: e.target.value })} className="input text-sm"><option value="">All</option>{['Cash', 'Online', 'Cheque', 'Bank Transfer', 'UPI', 'Card'].map(m => <option key={m} value={m}>{m}</option>)}</select></div>
        <div className="w-full sm:w-auto sm:min-w-[120px]"><label className="label mb-1 block text-xs">Quarter</label><select value={filters.quarter} onChange={e => onFilterChange({ ...filters, quarter: e.target.value })} className="input text-sm"><option value="">All</option>{[1, 2, 3, 4].map(q => <option key={q} value={q}>{`Q${q}`}</option>)}</select></div>
        <div className="w-full sm:w-auto sm:min-w-[140px]"><label className="label mb-1 block text-xs">From</label><input type="date" value={filters.startDate} onChange={e => onFilterChange({ ...filters, startDate: e.target.value })} className="input text-sm" /></div>
        <div className="w-full sm:w-auto sm:min-w-[140px]"><label className="label mb-1 block text-xs">To</label><input type="date" value={filters.endDate} onChange={e => onFilterChange({ ...filters, endDate: e.target.value })} className="input text-sm" /></div>
        <button onClick={onClearFilters} className="btn btn-outline btn-sm flex items-center justify-center gap-1"><X className="h-3.5 w-3.5" /> Clear</button>
        <div className="relative">
          <button onClick={() => setShowExportMenu(!showExportMenu)} className="btn btn-outline btn-sm flex items-center justify-center gap-1"><Download className="h-3.5 w-3.5" /> Export <ChevronDown className="h-3 w-3" /></button>
          {showExportMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} />
              <div className="absolute right-0 mt-1 w-36 bg-white dark:bg-[#2C2C2E] border border-gray-200 dark:border-[#38383A] rounded-xl shadow-lg z-20">
                <button onClick={() => handleExport('csv')} className="w-full px-4 py-2 text-sm text-left text-gray-700 dark:text-[#8E8E93] hover:bg-gray-50 dark:hover:bg-[#3A3A3C] rounded-t-xl">Export CSV</button>
                <button onClick={() => handleExport('excel')} className="w-full px-4 py-2 text-sm text-left text-gray-700 dark:text-[#8E8E93] hover:bg-gray-50 dark:hover:bg-[#3A3A3C] rounded-b-xl">Export Excel</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 dark:border-[#38383A] flex items-center justify-between"><h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2"><FileText className="h-4 w-4 text-primary-500" /> All Receipts {!loading && <span className="text-xs font-normal text-gray-400 dark:text-[#636366]">({receipts.length})</span>}</h3></div>
      {loading ? <LoadingSpinner /> : receipts.length === 0 ? <EmptyState icon={FileText} title="No receipts" description="Try adjusting filters" /> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] divide-y divide-gray-200 dark:divide-[#38383A]">
            <thead className="bg-gray-50 dark:bg-[#2C2C2E]"><tr>{[
                { l: 'Receipt No.', f: 'receiptNumber' },
                { l: 'Adm. No.', f: 'admissionNumber' },
                { l: 'Student' },
                { l: 'Class' },
                { l: 'Period' },
                { l: 'Amount', f: 'amount' },
                { l: 'Method' },
                { l: 'Date', f: 'paymentDate' },
                { l: 'Actions', r: true }
              ].map(c => (
                <th key={c.l} onClick={c.f ? () => handleSort(c.f) : undefined} className={`px-5 py-3 text-xs font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wide ${c.r ? 'text-right' : 'text-left'} ${c.f ? 'cursor-pointer select-none hover:text-gray-700 dark:hover:text-white' : ''}`}>{c.l}{c.f && <SortIcon field={c.f} />}</th>
              ))}</tr></thead>
            <tbody className="bg-white dark:bg-[#1C1C1E] divide-y divide-gray-100 dark:divide-[#38383A]">
              {sortedReceipts.map((p) => (
                <tr key={p._id} className="hover:bg-gray-50 dark:hover:bg-[#2C2C2E] transition-colors">
                  <td className="px-5 py-3 whitespace-nowrap text-sm font-mono font-semibold text-primary-600 dark:text-primary-400">{p.receiptNumber}</td>
                  <td className="px-5 py-3 whitespace-nowrap text-sm font-mono text-gray-700 dark:text-gray-300">{p.studentId?.admissionNumber || p.studentId?.studentId || '-'}</td>
                  <td className="px-5 py-3 whitespace-nowrap"><div className="text-sm font-medium text-gray-900 dark:text-white">{p.studentId?.name || p.studentId?.fullName || 'N/A'}</div></td>
                  <td className="px-5 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-[#8E8E93]">{p.studentId?.classId?.name || '-'}</td>
                  <td className="px-5 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-[#8E8E93]">{p.invoiceId?.billingPeriod?.quarter ? `Q${p.invoiceId.billingPeriod.quarter}${p.invoiceId.billingPeriod.year ? ` ${p.invoiceId.billingPeriod.year}` : ''}` : (p.invoiceId?.periodLabel || '-')}</td>
                  <td className="px-5 py-3 whitespace-nowrap text-sm font-semibold text-green-600 dark:text-green-400">{formatCurrency(p.amount)}</td>
                  <td className="px-5 py-3 whitespace-nowrap"><span className="px-2 py-0.5 bg-gray-100 dark:bg-[#2C2C2E] text-gray-700 dark:text-[#8E8E93] text-xs rounded-md font-medium">{p.paymentMethod}</span></td>
                  <td className="px-5 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-[#8E8E93]">{new Date(p.paymentDate).toLocaleDateString('en-IN')}</td>
                  <td className="px-5 py-3 whitespace-nowrap text-right"><div className="flex justify-end gap-1">{p.isReversed && <span className="px-1.5 py-0.5 mr-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-[10px] font-semibold rounded">REVERSED</span>}<button onClick={() => onPrintReceipt(p._id)} title="View" className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"><Eye className="h-3.5 w-3.5" /></button><button onClick={() => onDownloadReceipt(p._id)} title="Download" className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"><Download className="h-3.5 w-3.5" /></button>{!p.isReversed && p.amount > 0 && (<><button onClick={() => onEditPayment(p)} title="Edit Payment" className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"><Edit className="h-3.5 w-3.5" /></button><button onClick={() => onReversePayment(p)} title="Reverse Payment" className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"><RotateCcw className="h-3.5 w-3.5" /></button></>)}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!loading && receipts.length > 0 && hasMore && (
        <div className="px-5 py-4 border-t border-gray-100 dark:border-[#38383A] flex justify-start items-center gap-2">
          <label className="text-xs text-gray-500 dark:text-[#8E8E93]">Load</label>
          <select
            onChange={(e) => { const n = parseInt(e.target.value, 10); if (n) onLoadMore(n); e.target.value = '' }}
            disabled={fetching}
            className="input input-sm text-xs w-32 disabled:opacity-60 disabled:cursor-not-allowed"
            defaultValue=""
          >
            <option value="" disabled>Select…</option>
            <option value="100">100 more</option>
            <option value="200">200 more</option>
            <option value="500">500 more</option>
          </select>
          {fetching && <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-500" />}
        </div>
      )}
    </div>
  </div>
  )
}

// ── Disputes Tab ──

const DisputesTab = ({ data, loading, resolvingDispute, resolveForm, onSetResolvingDispute, onSetResolveForm, onResolve, onRefresh }) => {
  if (loading) return <LoadingSpinner />
  return (
    <div className="space-y-6">
      {data.stuckPayments?.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-4"><AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0" /><div><h3 className="text-sm font-semibold text-amber-900 dark:text-amber-300">Stuck Payments ({data.stuckPayments.length})</h3><p className="text-xs text-amber-700 dark:text-amber-400/80 mt-0.5">Pending for more than 1 hour.</p></div></div>
          <div className="overflow-x-auto"><table className="w-full text-sm min-w-[600px]"><thead><tr className="text-left text-xs font-medium text-amber-800 dark:text-amber-400 uppercase tracking-wide border-b border-amber-200 dark:border-amber-800/30">{['Student', 'Invoice', 'Amount', 'Since'].map(h => <th key={h} className="pb-2 pr-4">{h}</th>)}</tr></thead><tbody className="divide-y divide-amber-100 dark:divide-amber-900/30">{data.stuckPayments.map(p => <tr key={p._id}><td className="py-2 pr-4 font-medium text-gray-900 dark:text-white">{p.studentId?.fullName || p.studentId?.name || 'N/A'}</td><td className="py-2 pr-4 text-gray-600 dark:text-[#8E8E93]">{p.invoiceId?.invoiceNumber || '-'}</td><td className="py-2 pr-4 font-mono text-gray-800 dark:text-white">{formatCurrency(p.amount)}</td><td className="py-2 text-xs text-gray-500 dark:text-[#8E8E93]">{new Date(p.createdAt).toLocaleString('en-IN')}</td></tr>)}</tbody></table></div>
        </div>
      )}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-[#38383A] flex items-center justify-between">
          <div className="flex items-center gap-2"><AlertCircle className="h-5 w-5 text-red-500" /><h3 className="font-semibold text-gray-900 dark:text-white">Active Disputes</h3>{data.disputes?.length > 0 && <span className="px-2 py-0.5 text-xs font-semibold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full">{data.disputes.length}</span>}</div>
          <button onClick={onRefresh} className="text-sm text-primary-600 dark:text-primary-400 font-medium">Refresh</button>
        </div>
        {!data.disputes?.length ? (
          <div className="text-center py-16"><div className="h-12 w-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-3"><Check className="h-6 w-6 text-green-600 dark:text-green-400" /></div><p className="text-gray-600 dark:text-[#8E8E93] font-medium">No active disputes</p></div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-[#38383A]">
            {data.disputes.map(d => (
              <div key={d._id} className="px-6 py-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap"><span className="font-semibold text-gray-900 dark:text-white">{d.studentId?.fullName || d.studentId?.name || 'N/A'}</span><StatusBadge status={d.status} /></div>
                    <p className="text-sm text-gray-600 dark:text-[#8E8E93] mt-1">Invoice: <span className="font-mono font-medium">{d.invoiceId?.invoiceNumber || '-'}</span>{d.invoiceId?.totalAmount && <> &middot; {formatCurrency(d.invoiceId.totalAmount)}</>}</p>
                    {d.reason && <p className="text-sm text-gray-500 dark:text-[#636366] mt-1 italic">&quot;{d.reason}&quot;</p>}
                  </div>
                  <button onClick={() => { onSetResolvingDispute(d._id); onSetResolveForm({ action: 'APPROVE', note: '' }) }} className="btn btn-primary btn-sm flex-shrink-0">Resolve</button>
                </div>
                {resolvingDispute === d._id && (
                  <div className="mt-4 p-4 bg-gray-50 dark:bg-[#2C2C2E] rounded-xl border border-gray-200 dark:border-[#38383A]">
                    <div className="flex gap-3 mb-3">{['APPROVE', 'REJECT'].map(a => <button key={a} onClick={() => onSetResolveForm(f => ({ ...f, action: a }))} className={`flex-1 py-2 text-sm font-medium rounded-xl border-2 transition-colors ${resolveForm.action === a ? a === 'APPROVE' ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400' : 'border-gray-200 dark:border-[#38383A] text-gray-500 dark:text-[#8E8E93]'}`}>{a === 'APPROVE' ? 'Approve' : 'Reject'}</button>)}</div>
                    <textarea value={resolveForm.note} onChange={e => onSetResolveForm(f => ({ ...f, note: e.target.value }))} placeholder="Admin note (required)..." rows={2} className="input mb-3 resize-none" />
                    <div className="flex gap-2 justify-end"><button onClick={() => onSetResolvingDispute(null)} className="btn btn-outline btn-sm">Cancel</button><button onClick={() => onResolve(d._id)} className="btn btn-primary btn-sm">Confirm</button></div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Reports Tab ──

const PAYMENT_METHODS = ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Card', 'Online']
const PERIOD_OPTIONS = [
  { id: 'today', label: 'Today' },
  { id: 'weekly', label: 'This Week' },
  { id: 'monthly', label: 'This Month' },
]

const METHOD_COLORS = {
  Cash: { bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-300 dark:border-amber-700/40', text: 'text-amber-800 dark:text-amber-300', value: 'text-amber-700 dark:text-amber-400', ring: 'ring-amber-400/30' },
  UPI: { bg: 'bg-purple-50 dark:bg-purple-900/20', border: 'border-purple-200 dark:border-purple-800/30', text: 'text-purple-800 dark:text-purple-300', value: 'text-purple-700 dark:text-purple-400', ring: '' },
  'Bank Transfer': { bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800/30', text: 'text-blue-800 dark:text-blue-300', value: 'text-blue-700 dark:text-blue-400', ring: '' },
  Cheque: { bg: 'bg-cyan-50 dark:bg-cyan-900/20', border: 'border-cyan-200 dark:border-cyan-800/30', text: 'text-cyan-800 dark:text-cyan-300', value: 'text-cyan-700 dark:text-cyan-400', ring: '' },
  Card: { bg: 'bg-pink-50 dark:bg-pink-900/20', border: 'border-pink-200 dark:border-pink-800/30', text: 'text-pink-800 dark:text-pink-300', value: 'text-pink-700 dark:text-pink-400', ring: '' },
  Online: { bg: 'bg-indigo-50 dark:bg-indigo-900/20', border: 'border-indigo-200 dark:border-indigo-800/30', text: 'text-indigo-800 dark:text-indigo-300', value: 'text-indigo-700 dark:text-indigo-400', ring: '' },
}
const DEFAULT_METHOD_COLOR = { bg: 'bg-gray-50 dark:bg-[#2C2C2E]', border: 'border-gray-200 dark:border-[#38383A]', text: 'text-gray-800 dark:text-[#8E8E93]', value: 'text-gray-700 dark:text-gray-400', ring: '' }

const ReportsTab = ({ activeSession }) => {
  const [period, setPeriod] = useState('today')
  const [methodFilter, setMethodFilter] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [showExportMenu, setShowExportMenu] = useState(false)

  const usingCustom = Boolean(startDate || endDate)
  const effectivePeriod = usingCustom ? undefined : period
  const filterArgs = {
    period: effectivePeriod,
    paymentMethod: methodFilter || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  }

  const { data: summaryData, isLoading } = useQuery({
    queryKey: ['fees-collection-summary', effectivePeriod, methodFilter, startDate, endDate, activeSession?._id],
    queryFn: async () => {
      const res = await feesReportsService.getCollectionSummary({ ...filterArgs, academicSessionId: activeSession?._id })
      return res.data
    },
    enabled: !!activeSession,
  })

  const handleExport = async (fmt) => {
    setShowExportMenu(false)
    const toastId = toast.loading(`Exporting ${fmt.toUpperCase()}...`)
    try {
      const blob = await feesReportsService.exportCollectionSummary({ ...filterArgs, format: fmt })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const periodSlug = usingCustom ? 'custom' : (period || 'monthly')
      a.download = `daily_collection_${periodSlug}_${new Date().toISOString().split('T')[0]}.${fmt === 'excel' ? 'xlsx' : 'csv'}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.dismiss(toastId)
      toast.success('Exported successfully')
    } catch {
      toast.dismiss(toastId)
      toast.error('Failed to export')
    }
  }

  const periodLabel = PERIOD_OPTIONS.find(p => p.id === period)?.label || 'This Month'

  const grandTotal = summaryData?.summary?.grandTotal || 0

  return (
    <div className="max-w-3xl mx-auto space-y-3">
      {/* Compact filter bar */}
      <div className="card p-3 sm:p-4 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Daily Fee Collection</h3>
          <div className="relative">
            <button onClick={() => setShowExportMenu(!showExportMenu)} className="btn btn-outline btn-sm flex items-center gap-1">
              <Download className="h-3.5 w-3.5" /> Export <ChevronDown className="h-3 w-3" />
            </button>
            {showExportMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} />
                <div className="absolute right-0 mt-1 w-40 bg-white dark:bg-[#2C2C2E] border border-gray-200 dark:border-[#38383A] rounded-xl shadow-lg z-20">
                  <button onClick={() => handleExport('csv')} className="w-full px-4 py-2 text-sm text-left text-gray-700 dark:text-[#8E8E93] hover:bg-gray-50 dark:hover:bg-[#3A3A3C] rounded-t-xl">Export CSV</button>
                  <button onClick={() => handleExport('excel')} className="w-full px-4 py-2 text-sm text-left text-gray-700 dark:text-[#8E8E93] hover:bg-gray-50 dark:hover:bg-[#3A3A3C] rounded-b-xl">Export Excel</button>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {PERIOD_OPTIONS.map(opt => (
            <button key={opt.id} onClick={() => { setPeriod(opt.id); setStartDate(''); setEndDate('') }}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${!usingCustom && period === opt.id ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-[#2C2C2E] text-gray-600 dark:text-[#8E8E93] hover:bg-gray-200 dark:hover:bg-[#3A3A3C]'}`}>
              {opt.label}
            </button>
          ))}
          <span className="mx-1 h-4 w-px bg-gray-200 dark:bg-[#38383A]" />
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
            className="px-2 py-1 text-xs rounded-md border border-gray-200 dark:border-[#38383A] bg-white dark:bg-[#2C2C2E] text-gray-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500" />
          <span className="text-xs text-gray-400">to</span>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
            className="px-2 py-1 text-xs rounded-md border border-gray-200 dark:border-[#38383A] bg-white dark:bg-[#2C2C2E] text-gray-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500" />
          {usingCustom && (
            <button onClick={() => { setStartDate(''); setEndDate('') }} className="text-xs text-gray-500 hover:text-red-500 px-1">Clear</button>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setMethodFilter('')}
            className={`px-2.5 py-0.5 text-[11px] font-medium rounded-md transition-all ${!methodFilter ? 'bg-gray-800 dark:bg-white text-white dark:text-gray-900' : 'bg-gray-100 dark:bg-[#2C2C2E] text-gray-600 dark:text-[#8E8E93] hover:bg-gray-200 dark:hover:bg-[#3A3A3C]'}`}>
            All
          </button>
          {PAYMENT_METHODS.map(m => {
            const colors = METHOD_COLORS[m] || DEFAULT_METHOD_COLOR
            return (
              <button key={m} onClick={() => setMethodFilter(m)}
                className={`px-2.5 py-0.5 text-[11px] font-medium rounded-md transition-all ${methodFilter === m ? `${colors.bg} ${colors.text} border ${colors.border}` : 'bg-gray-100 dark:bg-[#2C2C2E] text-gray-600 dark:text-[#8E8E93] hover:bg-gray-200 dark:hover:bg-[#3A3A3C]'}`}>
                {m}
              </button>
            )
          })}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><LoadingSpinner /></div>
      ) : !summaryData ? (
        <EmptyState icon={History} title="No data available" description="No collection data found for the selected period" />
      ) : (
        <>
          {/* Compact Total + Method breakdown in one vertical card */}
          <div className="card overflow-hidden">
            {/* Grand total strip */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-b border-green-200 dark:border-green-800/30">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-green-700 dark:text-green-400">Total Collection &middot; {periodLabel}</p>
                <p className="text-[11px] text-green-600/80 dark:text-green-400/70">{summaryData.summary?.totalCount || 0} payments &middot; Avg/day {formatCurrency(summaryData.summary?.dailyAverage || 0)}</p>
              </div>
              <p className="text-xl sm:text-2xl font-bold text-green-700 dark:text-green-400 tabular-nums pl-3">{formatCurrency(grandTotal)}</p>
            </div>

            {/* Method-wise vertical list — amounts indented on the right */}
            {summaryData.methodBreakdown?.length > 0 && (
              <div className="divide-y divide-gray-100 dark:divide-[#38383A]">
                <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-[#2C2C2E]">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-[#8E8E93]">Method</span>
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-[#8E8E93]">Amount</span>
                </div>
                {summaryData.methodBreakdown.map(mb => {
                  const colors = METHOD_COLORS[mb.method] || DEFAULT_METHOD_COLOR
                  const isCash = mb.method === 'Cash'
                  return (
                    <button key={mb.method} onClick={() => setMethodFilter(methodFilter === mb.method ? '' : mb.method)}
                      className={`w-full flex items-center justify-between px-4 py-2.5 transition-colors hover:bg-gray-50 dark:hover:bg-[#2C2C2E] ${methodFilter === mb.method ? 'bg-primary-50/50 dark:bg-primary-900/10' : ''}`}>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`inline-block h-2 w-2 rounded-full ${isCash ? 'bg-amber-400' : 'bg-gray-400 dark:bg-gray-500'}`} />
                        <span className={`text-sm font-medium ${colors.text}`}>{mb.method}</span>
                        <span className="text-[11px] text-gray-400">{mb.count} txn &middot; {mb.percentage}%</span>
                      </div>
                      {/* Amount indented deep on the right for emphasis */}
                      <div className="flex items-center">
                        <div className="w-12 h-1 bg-gray-100 dark:bg-[#38383A] rounded-full overflow-hidden mr-3">
                          <div className={`h-full ${isCash ? 'bg-amber-400' : 'bg-green-400'}`} style={{ width: `${Math.min(100, mb.percentage)}%` }} />
                        </div>
                        <span className={`text-sm font-bold tabular-nums min-w-[6rem] text-right pl-4 ${isCash ? 'text-amber-700 dark:text-amber-400' : 'text-gray-900 dark:text-white'}`}>{formatCurrency(mb.total)}</span>
                      </div>
                    </button>
                  )
                })}
                <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-[#2C2C2E]">
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">Grand Total</span>
                  <span className="text-sm font-bold text-green-700 dark:text-green-400 tabular-nums pl-4">{formatCurrency(grandTotal)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Day-wise Collection — vertical list */}
          {summaryData.byDate?.length > 0 && (
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-[#38383A] bg-gray-50 dark:bg-[#2C2C2E]">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-[#8E8E93]">Day-wise Collection</span>
                <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-[#8E8E93]">Amount</span>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-[#38383A]">
                {summaryData.byDate.map(d => {
                  const isToday = d.date === new Date().toISOString().split('T')[0]
                  return (
                    <div key={d.date} className={`flex items-center justify-between px-4 py-2.5 ${isToday ? 'bg-green-50/40 dark:bg-green-900/10' : ''}`}>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {new Date(d.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </span>
                        {isToday && <span className="text-[10px] uppercase font-semibold text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded">Today</span>}
                        <span className="text-[11px] text-gray-400">{d.count} txn</span>
                      </div>
                      <span className="text-sm font-bold tabular-nums text-green-600 dark:text-green-400 min-w-[6rem] text-right pl-4">{formatCurrency(d.total)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Recent Transactions */}
          {summaryData.payments?.length > 0 && (
            <div className="card overflow-hidden">
              <div className="p-4 border-b border-gray-200 dark:border-[#38383A]">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Recent Transactions ({periodLabel})</h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] divide-y divide-gray-200 dark:divide-[#38383A]">
                  <thead className="bg-gray-50 dark:bg-[#2C2C2E]">
                    <tr>
                      {['Receipt', 'Student', 'Class', 'Amount', 'Method', 'Date', 'Collected By'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-[#8E8E93] uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-[#1C1C1E] divide-y divide-gray-200 dark:divide-[#38383A]">
                    {summaryData.payments.map(p => {
                      const isCash = p.paymentMethod === 'Cash'
                      return (
                        <tr key={p._id} className={`${isCash ? 'bg-amber-50/30 dark:bg-amber-900/5' : ''} hover:bg-gray-50 dark:hover:bg-[#2C2C2E]`}>
                          <td className="px-4 py-3 whitespace-nowrap text-xs font-mono text-gray-600 dark:text-[#8E8E93]">{p.receiptNumber}</td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">{p.studentId?.fullName || p.studentId?.name || 'N/A'}</div>
                            <div className="text-xs text-gray-500 dark:text-[#8E8E93]">{p.studentId?.admissionNumber || ''}</div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-[#8E8E93]">{p.studentId?.classId?.name || '-'}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-green-600 dark:text-green-400">{formatCurrency(p.amount)}</td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${isCash ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 ring-1 ring-amber-300/40' : 'bg-gray-100 dark:bg-[#2C2C2E] text-gray-700 dark:text-[#8E8E93]'}`}>
                              {isCash && <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />}
                              {p.paymentMethod}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-[#8E8E93]">{p.paymentDate ? new Date(p.paymentDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '-'}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-[#8E8E93]">{p.collectedBy?.name || '-'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Empty state when no payments */}
          {(!summaryData.payments || summaryData.payments.length === 0) && (!summaryData.methodBreakdown || summaryData.methodBreakdown.length === 0) && (
            <EmptyState icon={DollarSign} title="No collections found" description={`No fee payments collected ${periodLabel.toLowerCase()}`} />
          )}
        </>
      )}
    </div>
  )
}

// ── Refunds Tab ──

const RefundsTab = () => {
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('')
  const [showInitiateModal, setShowInitiateModal] = useState(false)
  const [refundForm, setRefundForm] = useState({ paymentId: '', studentId: '', invoiceId: '', amount: '', reason: '', refundMethod: 'original' })
  const [processingId, setProcessingId] = useState(null)
  const [rejectModal, setRejectModal] = useState({ isOpen: false, refundId: null })
  const [rejectReason, setRejectReason] = useState('')

  const { data: refunds = [], isLoading: loading } = useQuery({ queryKey: ['fees-refunds', statusFilter], queryFn: async () => { const res = await refundsService.list({ status: statusFilter || undefined }); return res.data || [] } })
  const initiateRefundMutation = useMutation({ mutationFn: (data) => refundsService.initiate({ ...data, amount: parseFloat(data.amount) }), onSuccess: () => { toast.success('Refund initiated'); setShowInitiateModal(false); setRefundForm({ paymentId: '', studentId: '', invoiceId: '', amount: '', reason: '', refundMethod: 'original' }); queryClient.invalidateQueries({ queryKey: ['fees-refunds'] }) }, onError: (e) => toast.error(e.message || 'Failed') })

  const handleApprove = async (id) => { try { setProcessingId(id); await refundsService.approve(id); toast.success('Approved'); queryClient.invalidateQueries({ queryKey: ['fees-refunds'] }) } catch (e) { toast.error(e.message || 'Failed') } finally { setProcessingId(null) } }
  const handleReject = async () => { try { setProcessingId(rejectModal.refundId); await refundsService.reject(rejectModal.refundId, rejectReason); toast.success('Rejected'); setRejectModal({ isOpen: false, refundId: null }); setRejectReason(''); queryClient.invalidateQueries({ queryKey: ['fees-refunds'] }) } catch (e) { toast.error(e.message || 'Failed') } finally { setProcessingId(null) } }
  const handleProcess = async (id) => { try { setProcessingId(id); await refundsService.process(id, { processedDate: new Date().toISOString() }); toast.success('Processed'); queryClient.invalidateQueries({ queryKey: ['fees-refunds'] }) } catch (e) { toast.error(e.message || 'Failed') } finally { setProcessingId(null) } }

  const badgeCls = (s) => ({ pending: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400', approved: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400', processed: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400', rejected: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400' }[s] || 'bg-gray-100 dark:bg-[#2C2C2E] text-gray-800 dark:text-[#8E8E93]')

  return (
    <div className="space-y-4">
      <div className="card p-3 sm:p-4"><div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex sm:items-center gap-2 sm:gap-3 flex-col sm:flex-row"><h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Refunds</h3><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input text-sm w-auto"><option value="">All</option>{['pending', 'approved', 'processed', 'rejected'].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}</select></div>
        <button onClick={() => setShowInitiateModal(true)} className="btn btn-primary btn-sm flex items-center justify-center gap-1"><Plus className="h-4 w-4" />Initiate</button>
      </div></div>
      <div className="card overflow-hidden">
        {loading ? <div className="flex justify-center py-12"><LoadingSpinner /></div> : refunds.length === 0 ? <EmptyState icon={RotateCcw} title="No refunds" description="Initiate a refund for overpayments" /> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[600px] divide-y divide-gray-200 dark:divide-[#38383A]">
            <thead className="bg-gray-50 dark:bg-[#2C2C2E]"><tr>{['Student', 'Amount', 'Reason', 'Method', 'Status', 'Date', 'Actions'].map(h => <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-[#8E8E93] uppercase">{h}</th>)}</tr></thead>
            <tbody className="bg-white dark:bg-[#1C1C1E] divide-y divide-gray-200 dark:divide-[#38383A]">
              {refunds.map(r => (
                <tr key={r._id} className="hover:bg-gray-50 dark:hover:bg-[#2C2C2E]">
                  <td className="px-5 py-4 whitespace-nowrap"><div className="text-sm font-medium text-gray-900 dark:text-white">{r.studentId?.fullName || r.studentId?.name || 'N/A'}</div></td>
                  <td className="px-5 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(r.amount)}</td>
                  <td className="px-5 py-4 text-sm text-gray-600 dark:text-[#8E8E93] max-w-xs truncate">{r.reason}</td>
                  <td className="px-5 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-[#8E8E93] capitalize">{r.refundMethod || 'Original'}</td>
                  <td className="px-5 py-4 whitespace-nowrap"><span className={`px-2 py-1 text-xs font-semibold rounded-full capitalize ${badgeCls(r.status)}`}>{r.status}</span></td>
                  <td className="px-5 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-[#8E8E93]">{formatDate(r.createdAt)}</td>
                  <td className="px-5 py-4 whitespace-nowrap"><div className="flex gap-1">
                    {r.status === 'pending' && <><button onClick={() => handleApprove(r._id)} disabled={processingId === r._id} className="p-1.5 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg"><Check className="h-4 w-4" /></button><button onClick={() => setRejectModal({ isOpen: true, refundId: r._id })} className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"><Ban className="h-4 w-4" /></button></>}
                    {r.status === 'approved' && <button onClick={() => handleProcess(r._id)} disabled={processingId === r._id} className="btn btn-sm bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/30">{processingId === r._id ? '...' : 'Process'}</button>}
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>
      {showInitiateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"><div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-scale-in">
          <div className="p-5 border-b border-gray-100 dark:border-[#38383A] flex justify-between items-center"><h3 className="text-lg font-bold text-gray-900 dark:text-white">Initiate Refund</h3><button onClick={() => setShowInitiateModal(false)} className="btn-close"><X className="h-5 w-5" /></button></div>
          <form onSubmit={(e) => { e.preventDefault(); initiateRefundMutation.mutate(refundForm) }} className="p-5 space-y-4">
            <div><label className="label mb-1 block">Student</label><StudentSearch onSelectStudent={(s) => setRefundForm(f => ({ ...f, studentId: s._id }))} /></div>
            <div><label className="label mb-1 block">Amount *</label><input type="number" required min="1" className="input" placeholder="e.g. 5000" value={refundForm.amount} onChange={(e) => setRefundForm(f => ({ ...f, amount: e.target.value }))} /></div>
            <div><label className="label mb-1 block">Method</label><select className="input" value={refundForm.refundMethod} onChange={(e) => setRefundForm(f => ({ ...f, refundMethod: e.target.value }))}><option value="original">Original Method</option><option value="bank_transfer">Bank Transfer</option><option value="cash">Cash</option><option value="cheque">Cheque</option><option value="adjust_next">Adjust Next Invoice</option></select></div>
            <div><label className="label mb-1 block">Reason *</label><textarea required rows="3" className="input resize-none" placeholder="e.g. Overpayment..." value={refundForm.reason} onChange={(e) => setRefundForm(f => ({ ...f, reason: e.target.value }))} /></div>
            <div className="flex justify-end gap-3 pt-2"><button type="button" onClick={() => setShowInitiateModal(false)} className="btn btn-outline btn-sm">Cancel</button><button type="submit" disabled={initiateRefundMutation.isPending} className="btn btn-primary btn-sm">{initiateRefundMutation.isPending ? 'Initiating...' : 'Initiate'}</button></div>
          </form>
        </div></div>
      )}
      {rejectModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"><div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-scale-in">
          <div className="p-5 border-b border-gray-100 dark:border-[#38383A] flex justify-between items-center"><h3 className="text-base font-bold text-gray-900 dark:text-white">Reject Refund</h3><button onClick={() => { setRejectModal({ isOpen: false, refundId: null }); setRejectReason('') }} className="btn-close"><X className="h-4 w-4" /></button></div>
          <div className="p-5 space-y-4">
            <textarea required rows="3" className="input resize-none" placeholder="Rejection reason..." value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
            <div className="flex justify-end gap-3"><button onClick={() => { setRejectModal({ isOpen: false, refundId: null }); setRejectReason('') }} className="btn btn-outline btn-sm">Cancel</button><button onClick={handleReject} disabled={!rejectReason.trim()} className="btn btn-sm bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">Reject</button></div>
          </div>
        </div></div>
      )}
    </div>
  )
}

export default FeesFinance
