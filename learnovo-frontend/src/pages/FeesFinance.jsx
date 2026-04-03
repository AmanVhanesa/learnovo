import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  DollarSign, TrendingUp, AlertCircle, AlertTriangle, Calendar,
  Users, FileText, Search, X, Plus, Receipt, Settings, History,
  Edit, Trash2, Eye, Printer, RotateCcw, Check, Ban, List,
  ArrowUpRight, ArrowDownRight, Download, ChevronDown, ChevronUp,
  Copy
} from 'lucide-react'
import {
  feesReportsService, invoicesService, paymentsService, feeStructuresService, refundsService, discountsService, allocationsService
} from '../services/feesService'
import { academicSessionsService, classesService } from '../services/academicsService'
import { useAuth } from '../contexts/AuthContext'
import { formatCurrency } from '../utils/formatCurrency'
import { formatDate } from '../utils/formatDate'
import { sortByRelevance } from '../utils/searchRelevance'
import { printReceiptHighQuality, downloadReceiptAsPdf, buildReceiptHtml } from '../utils/receiptHelpers'
import toast from 'react-hot-toast'

// Shared UI
import LoadingSpinner from '../components/LoadingSpinner'
import EmptyState from '../components/EmptyState'
import StatusBadge from '../components/StatusBadge'
import EditInvoiceModal from '../components/EditInvoiceModal'

// Fees sub-components
import StudentSearch from '../components/fees/StudentSearch'
import FeeStructureModal from '../components/fees/FeeStructureModal'
import IndividualInvoiceModal from '../components/fees/IndividualInvoiceModal'
import BulkInvoiceForm from '../components/fees/BulkInvoiceForm'
import BulkDeleteInvoiceForm from '../components/fees/BulkDeleteInvoiceForm'
import PaymentModal from '../components/fees/PaymentModal'
import AllInvoicesTab from '../components/fees/AllInvoicesTab'
import AnnualAllocationsTab from '../components/fees/AnnualAllocationsTab'

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
  const [activeTab, setActiveTab] = useState('dashboard')

  const [showFeeStructureModal, setShowFeeStructureModal] = useState(false)
  const [editingFeeStructure, setEditingFeeStructure] = useState(null)
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [studentInvoices, setStudentInvoices] = useState([])
  const [studentPayments, setStudentPayments] = useState([])
  const [editingInvoice, setEditingInvoice] = useState(null)
  const [receiptFilters, setReceiptFilters] = useState({ search: '', paymentMethod: '', startDate: '', endDate: '' })
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
    queryKey: ['fees-classes'],
    queryFn: async () => { const res = await classesService.list(); return res.data || [] },
    enabled: !!activeSession && (activeTab === 'feeStructure' || activeTab === 'invoices'),
  })

  const { data: defaulters = [], isLoading: defaultersLoading } = useQuery({
    queryKey: ['fees-defaulters', activeSession?._id],
    queryFn: async () => { const res = await feesReportsService.getDefaulters({ academicSessionId: activeSession?._id }); return res.data || [] },
    enabled: !!activeSession && activeTab === 'defaulters',
  })

  const { data: collectionReport } = useQuery({
    queryKey: ['fees-collection-report'],
    queryFn: async () => {
      const endDate = new Date(); const startDate = new Date(); startDate.setDate(1)
      const res = await feesReportsService.getCollectionReport({ startDate: startDate.toISOString().split('T')[0], endDate: endDate.toISOString().split('T')[0] })
      return res.data
    },
    enabled: !!activeSession && activeTab === 'reports',
  })

  const { data: allReceipts = [], isLoading: receiptsLoading } = useQuery({
    queryKey: ['fees-receipts', receiptFilters.paymentMethod, receiptFilters.startDate, receiptFilters.endDate, receiptFilters.search],
    queryFn: async () => {
      const params = {}
      if (receiptFilters.paymentMethod) params.paymentMethod = receiptFilters.paymentMethod
      if (receiptFilters.startDate) params.startDate = receiptFilters.startDate
      if (receiptFilters.endDate) params.endDate = receiptFilters.endDate
      const res = await paymentsService.list(params)
      let data = res.data || []
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
      return data
    },
    enabled: !!activeSession && activeTab === 'receipts',
  })

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
      setShowPaymentModal(true)
    } catch { toast.error('Failed to load student data') }
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
      const response = await paymentsService.getReceipt(paymentId)
      const { payment, school } = response.data
      await downloadReceiptAsPdf(payment, school)
      toast.dismiss(toastId)
      toast.success('Receipt downloaded!')
    } catch (err) {
      toast.dismiss(toastId)
      console.error('Receipt download error:', err)
      toast.error('Failed to download receipt')
    }
  }

  const handlePrintReceipt = async (paymentId) => {
    try {
      const toastId = toast.loading('Opening receipt preview...')
      const response = await paymentsService.getReceipt(paymentId)
      const { payment, school } = response.data
      toast.dismiss(toastId)
      const html = buildReceiptHtml(payment, school)
      const win = window.open('', '_blank', 'width=600,height=800')
      if (win) {
        win.document.write(html)
        win.document.close()
      } else {
        toast.error('Pop-up blocked. Please allow pop-ups for this site.')
      }
    } catch {
      toast.dismiss()
      toast.error('Failed to load receipt')
    }
  }

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
      <div className="border-b border-gray-200 dark:border-[#38383A] overflow-x-auto scrollbar-none">
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
        {activeTab === 'allInvoices' && <AllInvoicesTab activeSession={activeSession} onEditInvoice={setEditingInvoice} onCollectPayment={async (inv) => { if (inv.studentId) { const s = typeof inv.studentId === 'object' ? inv.studentId : { _id: inv.studentId }; await handleSelectStudent(s) } }} onPrintReceipt={handlePrintReceipt} onDownloadReceipt={handleDownloadReceiptPdf} onDeleteInvoice={handleDeleteInvoice} />}
        {activeTab === 'feeStructure' && <FeeStructureTab feeStructures={feeStructures} classes={classes} onCreateNew={() => { setEditingFeeStructure(null); setShowFeeStructureModal(true) }} onEdit={(s) => { setEditingFeeStructure(s); setShowFeeStructureModal(true) }} onDelete={async (id) => { if (window.confirm('Delete this fee structure?')) { try { await feeStructuresService.delete(id); toast.success('Deleted'); queryClient.invalidateQueries({ queryKey: ['fee-structures'] }) } catch { toast.error('Failed') } } }} onDuplicate={async (s) => { try { await feeStructuresService.create({ classId: typeof s.classId === 'object' ? s.classId._id : s.classId, sectionId: s.sectionId ? (typeof s.sectionId === 'object' ? s.sectionId._id : s.sectionId) : null, academicSessionId: activeSession._id, feeHeads: s.feeHeads.map(h => ({ name: h.name, amount: h.amount, frequency: h.frequency, isCompulsory: h.isCompulsory, dueDay: h.dueDay })), isActive: true }); toast.success('Duplicated'); queryClient.invalidateQueries({ queryKey: ['fee-structures'] }) } catch { toast.error('Failed') } }} />}
        {activeTab === 'invoices' && <InvoicesTab classes={classes} feeStructures={feeStructures} activeSession={activeSession} onShowIndividual={() => setShowInvoiceModal(true)} />}
        {activeTab === 'collect' && <CollectPaymentTab dashboardData={dashboardData} selectedStudent={selectedStudent} onSelectStudent={handleSelectStudent} />}
        {activeTab === 'defaulters' && <DefaultersTab defaulters={defaulters} loading={defaultersLoading} />}
        {activeTab === 'receipts' && <ReceiptsTab receipts={allReceipts} loading={receiptsLoading} filters={receiptFilters} onFilterChange={setReceiptFilters} onClearFilters={() => setReceiptFilters({ search: '', paymentMethod: '', startDate: '', endDate: '' })} onPrintReceipt={handlePrintReceipt} onDownloadReceipt={handleDownloadReceiptPdf} />}
        {activeTab === 'refunds' && <RefundsTab />}
        {activeTab === 'disputes' && <DisputesTab data={disputesData} loading={disputesLoading} resolvingDispute={resolvingDispute} resolveForm={resolveForm} onSetResolvingDispute={setResolvingDispute} onSetResolveForm={setResolveForm} onResolve={handleResolveDispute} onRefresh={() => queryClient.invalidateQueries({ queryKey: ['fees-disputes'] })} />}
        {activeTab === 'reports' && collectionReport && <ReportsTab report={collectionReport} />}
      </div>

      {/* Modals */}
      {showFeeStructureModal && <FeeStructureModal feeStructure={editingFeeStructure} classes={classes} activeSession={activeSession} onClose={() => { setShowFeeStructureModal(false); setEditingFeeStructure(null) }} onSuccess={() => { setShowFeeStructureModal(false); setEditingFeeStructure(null); queryClient.invalidateQueries({ queryKey: ['fee-structures'] }); toast.success(editingFeeStructure ? 'Updated' : 'Created') }} />}
      {showInvoiceModal && <IndividualInvoiceModal feeStructures={feeStructures} activeSession={activeSession} onClose={() => setShowInvoiceModal(false)} onSuccess={() => { setShowInvoiceModal(false); toast.success('Invoice generated'); queryClient.invalidateQueries({ queryKey: ['fees-dashboard'] }) }} />}
      {showPaymentModal && <PaymentModal student={selectedStudent} invoices={studentInvoices} payments={studentPayments} onPrintReceipt={handlePrintReceipt} onDownloadReceipt={handleDownloadReceiptPdf} onClose={() => { setShowPaymentModal(false); setSelectedStudent(null); setStudentInvoices([]); setStudentPayments([]) }} onSuccess={() => { setShowPaymentModal(false); setSelectedStudent(null); setStudentInvoices([]); queryClient.invalidateQueries({ queryKey: ['fees-dashboard'] }); queryClient.invalidateQueries({ queryKey: ['fees-receipts'] }); toast.success('Payment collected') }} />}
      {editingInvoice && <EditInvoiceModal invoice={editingInvoice} onClose={() => setEditingInvoice(null)} onSuccess={() => { setEditingInvoice(null); queryClient.invalidateQueries({ queryKey: ['fees-dashboard'] }) }} />}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// TAB COMPONENTS
// ════════════════════════════════════════════════════════════════════════════

const DashboardTab = ({ data, onPrintReceipt, onDownloadReceipt, onEditInvoice, onDeleteInvoice, onNavigate }) => {
  const summary = data.summary || {}
  const totalExpected = (summary.totalCollected || 0) + (summary.totalPending || 0) + (summary.totalOverdue || 0)
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

const DefaultersTab = ({ defaulters, loading }) => {
  const queryClient = useQueryClient()
  const [applyingLateFee, setApplyingLateFee] = useState(false)
  const [lateFeeModal, setLateFeeModal] = useState({ isOpen: false, invoiceId: null, studentName: '' })
  const [lateFeeAmount, setLateFeeAmount] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState('totalBalance')
  const [sortAsc, setSortAsc] = useState(false)

  const handleApplyLateFee = async () => {
    if (!lateFeeModal.invoiceId || !lateFeeAmount || parseFloat(lateFeeAmount) <= 0) { toast.error('Enter a valid amount'); return }
    try { setApplyingLateFee(true); await invoicesService.applyLateFee(lateFeeModal.invoiceId, parseFloat(lateFeeAmount)); toast.success('Late fee applied'); setLateFeeModal({ isOpen: false, invoiceId: null, studentName: '' }); setLateFeeAmount(''); queryClient.invalidateQueries({ queryKey: ['fees-defaulters'] }) }
    catch (error) { toast.error(error.response?.data?.message || 'Failed') } finally { setApplyingLateFee(false) }
  }

  const safeDefaulters = defaulters.filter(d => (d.liveBalance ?? d.totalBalance) > 0 && d.studentId)
  const filteredDefaulters = safeDefaulters.filter(d => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (d.studentId?.fullName || d.studentId?.name || '').toLowerCase().includes(q) || (d.studentId?.admissionNumber || d.studentId?.studentId || '').toLowerCase().includes(q) || (d.studentId?.phone || '').toLowerCase().includes(q)
  })

  const sortedDefaulters = [...filteredDefaulters].sort((a, b) => {
    const dir = sortAsc ? 1 : -1
    if (sortField === 'name') return dir * ((a.studentId?.fullName || a.studentId?.name || '').localeCompare(b.studentId?.fullName || b.studentId?.name || ''))
    if (sortField === 'totalBalance') return dir * ((a.liveBalance ?? a.totalBalance ?? 0) - (b.liveBalance ?? b.totalBalance ?? 0))
    if (sortField === 'overdueDays') return dir * ((a.overdueDays ?? 0) - (b.overdueDays ?? 0))
    if (sortField === 'dueDate') return dir * ((a.oldestDueDate ? new Date(a.oldestDueDate).getTime() : 0) - (b.oldestDueDate ? new Date(b.oldestDueDate).getTime() : 0))
    return 0
  })

  const totalOutstanding = safeDefaulters.reduce((sum, d) => sum + (d.liveBalance ?? d.totalBalance ?? 0), 0)
  const SortIcon = ({ field }) => <span className="inline-block ml-1 text-[10px] opacity-50">{sortField === field ? (sortAsc ? '▲' : '▼') : '⇅'}</span>
  const handleSort = (f) => { if (sortField === f) setSortAsc(!sortAsc); else { setSortField(f); setSortAsc(false) } }
  const formatDueDate = (d) => { if (!d) return '-'; const dt = new Date(d); return isNaN(dt.getTime()) ? '-' : dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) }

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-4">
      {safeDefaulters.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="card p-4"><p className="text-[10px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wide">Total Defaulters</p><p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">{safeDefaulters.length}</p></div>
          <div className="card p-4"><p className="text-[10px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wide">Total Outstanding</p><p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">{formatCurrency(totalOutstanding)}</p></div>
          <div className="card p-4"><p className="text-[10px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wide">Avg. Overdue</p><p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{safeDefaulters.length ? Math.round(safeDefaulters.reduce((s, d) => s + (d.overdueDays || 0), 0) / safeDefaulters.length) : 0} days</p></div>
        </div>
      )}

      <div className="card p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Fee Defaulters</h3>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-[#636366]" /><input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 pr-8 py-2 border border-gray-200 dark:border-[#38383A] dark:bg-[#1C1C1E] dark:text-white dark:placeholder-[#636366] rounded-xl text-sm w-full sm:w-56 focus:outline-none focus:ring-2 focus:ring-primary-300" />{searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-gray-100 dark:hover:bg-[#2C2C2E] rounded-full"><X className="h-3.5 w-3.5 text-gray-400" /></button>}</div>
            <span className="text-sm text-gray-600 dark:text-[#8E8E93] whitespace-nowrap">{filteredDefaulters.length} students</span>
          </div>
        </div>

        {sortedDefaulters.length === 0 ? <EmptyState icon={Users} title={searchQuery ? 'No matching defaulters' : 'No defaulters'} description={searchQuery ? 'Try adjusting search' : 'All students are up to date'} /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[750px] divide-y divide-gray-200 dark:divide-[#38383A]">
              <thead className="bg-gray-50 dark:bg-[#2C2C2E]"><tr>
                {[{ l: 'Student', f: 'name' }, { l: 'Total Due', f: 'totalBalance' }, { l: 'Due Date', f: 'dueDate' }, { l: 'Overdue', f: 'overdueDays' }, { l: 'Invoices' }, { l: 'Contact' }, { l: 'Actions', r: true }].map(c => (
                  <th key={c.l} onClick={c.f ? () => handleSort(c.f) : undefined} className={`px-5 py-3 text-xs font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wide ${c.r ? 'text-right' : 'text-left'} ${c.f ? 'cursor-pointer select-none hover:text-gray-700 dark:hover:text-white' : ''}`}>{c.l}{c.f && <SortIcon field={c.f} />}</th>
                ))}
              </tr></thead>
              <tbody className="bg-white dark:bg-[#1C1C1E] divide-y divide-gray-100 dark:divide-[#38383A]">
                {sortedDefaulters.map((d) => {
                  const bal = d.liveBalance ?? d.totalBalance ?? 0, ov = d.overdueDays ?? 0
                  return (
                    <tr key={d._id} className="hover:bg-gray-50 dark:hover:bg-[#2C2C2E] transition-colors">
                      <td className="px-5 py-4 whitespace-nowrap"><div className="text-sm font-medium text-gray-900 dark:text-white">{d.studentId?.fullName || d.studentId?.name || 'Unknown'}</div><div className="text-xs text-gray-500 dark:text-[#8E8E93]">{d.studentId?.admissionNumber || '-'}</div></td>
                      <td className="px-5 py-4 whitespace-nowrap text-sm font-semibold text-red-600 dark:text-red-400">{formatCurrency(bal)}</td>
                      <td className="px-5 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">{formatDueDate(d.oldestDueDate)}</td>
                      <td className="px-5 py-4 whitespace-nowrap"><span className={`inline-flex px-2.5 py-0.5 text-xs font-semibold rounded-full ${ov > 60 ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400' : ov > 30 ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-400' : ov > 0 ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400' : 'bg-gray-100 dark:bg-gray-800/30 text-gray-600 dark:text-gray-400'}`}>{ov > 0 ? `${ov} days` : 'Not yet due'}</span></td>
                      <td className="px-5 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-[#8E8E93]">{d.unpaidInvoiceCount ?? d.invoiceIds?.length ?? '-'} unpaid</td>
                      <td className="px-5 py-4 whitespace-nowrap"><div className="text-sm text-gray-600 dark:text-[#8E8E93]">{d.studentId?.phone || '-'}</div></td>
                      <td className="px-5 py-4 whitespace-nowrap text-right">{d.invoiceIds?.[0] && <button onClick={() => setLateFeeModal({ isOpen: true, invoiceId: d.invoiceIds[0], studentName: d.studentId?.fullName || d.studentId?.name || 'Student' })} className="text-xs px-3 py-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800/30 transition-colors">+ Late Fee</button>}</td>
                    </tr>
                  )
                })}
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

const ReceiptsTab = ({ receipts, loading, filters, onFilterChange, onClearFilters, onPrintReceipt, onDownloadReceipt }) => (
  <div className="space-y-4">
    <div className="card p-3 sm:p-4">
      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:items-end">
        <div className="w-full sm:flex-1 sm:min-w-[200px]"><label className="label mb-1 block text-xs">Search</label><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-[#636366]" /><input type="text" placeholder="Name, receipt no..." value={filters.search} onChange={e => onFilterChange({ ...filters, search: e.target.value })} className="input pl-9 text-sm" /></div></div>
        <div className="w-full sm:w-auto sm:min-w-[150px]"><label className="label mb-1 block text-xs">Method</label><select value={filters.paymentMethod} onChange={e => onFilterChange({ ...filters, paymentMethod: e.target.value })} className="input text-sm"><option value="">All</option>{['Cash', 'Online', 'Cheque', 'Bank Transfer', 'UPI', 'Card'].map(m => <option key={m} value={m}>{m}</option>)}</select></div>
        <div className="w-full sm:w-auto sm:min-w-[140px]"><label className="label mb-1 block text-xs">From</label><input type="date" value={filters.startDate} onChange={e => onFilterChange({ ...filters, startDate: e.target.value })} className="input text-sm" /></div>
        <div className="w-full sm:w-auto sm:min-w-[140px]"><label className="label mb-1 block text-xs">To</label><input type="date" value={filters.endDate} onChange={e => onFilterChange({ ...filters, endDate: e.target.value })} className="input text-sm" /></div>
        <button onClick={onClearFilters} className="btn btn-outline btn-sm flex items-center justify-center gap-1"><X className="h-3.5 w-3.5" /> Clear</button>
      </div>
    </div>
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 dark:border-[#38383A] flex items-center justify-between"><h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2"><FileText className="h-4 w-4 text-primary-500" /> All Receipts {!loading && <span className="text-xs font-normal text-gray-400 dark:text-[#636366]">({receipts.length})</span>}</h3></div>
      {loading ? <LoadingSpinner /> : receipts.length === 0 ? <EmptyState icon={FileText} title="No receipts" description="Try adjusting filters" /> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] divide-y divide-gray-200 dark:divide-[#38383A]">
            <thead className="bg-gray-50 dark:bg-[#2C2C2E]"><tr>{['Receipt No.', 'Student', 'Class', 'Amount', 'Method', 'Date', 'Actions'].map(h => <th key={h} className={`px-5 py-3 text-xs font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wide ${h === 'Actions' ? 'text-right' : 'text-left'}`}>{h}</th>)}</tr></thead>
            <tbody className="bg-white dark:bg-[#1C1C1E] divide-y divide-gray-100 dark:divide-[#38383A]">
              {receipts.map((p) => (
                <tr key={p._id} className="hover:bg-gray-50 dark:hover:bg-[#2C2C2E] transition-colors">
                  <td className="px-5 py-3 whitespace-nowrap text-sm font-mono font-semibold text-primary-600 dark:text-primary-400">{p.receiptNumber}</td>
                  <td className="px-5 py-3 whitespace-nowrap"><div className="text-sm font-medium text-gray-900 dark:text-white">{p.studentId?.name || p.studentId?.fullName || 'N/A'}</div><div className="text-xs text-gray-400 dark:text-[#636366]">{p.studentId?.admissionNumber || ''}</div></td>
                  <td className="px-5 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-[#8E8E93]">{p.studentId?.classId?.name || '-'}</td>
                  <td className="px-5 py-3 whitespace-nowrap text-sm font-semibold text-green-600 dark:text-green-400">{formatCurrency(p.amount)}</td>
                  <td className="px-5 py-3 whitespace-nowrap"><span className="px-2 py-0.5 bg-gray-100 dark:bg-[#2C2C2E] text-gray-700 dark:text-[#8E8E93] text-xs rounded-md font-medium">{p.paymentMethod}</span></td>
                  <td className="px-5 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-[#8E8E93]">{new Date(p.paymentDate).toLocaleDateString('en-IN')}</td>
                  <td className="px-5 py-3 whitespace-nowrap text-right"><div className="flex justify-end gap-1"><button onClick={() => onPrintReceipt(p._id)} className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"><Eye className="h-3.5 w-3.5" /></button><button onClick={() => onDownloadReceipt(p._id)} className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"><Download className="h-3.5 w-3.5" /></button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  </div>
)

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

const ReportsTab = ({ report }) => (
  <div className="card p-4 sm:p-6">
    <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-6">Collection Report (This Month)</h3>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
      <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/30 rounded-xl"><p className="text-sm font-medium text-green-900 dark:text-green-300">Total Collected</p><p className="text-2xl font-bold text-green-700 dark:text-green-400 mt-2">{formatCurrency(report.summary.totalAmount)}</p><p className="text-sm text-green-600 dark:text-green-400/80 mt-1">{report.summary.totalCount} payments</p></div>
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/30 rounded-xl"><p className="text-sm font-medium text-blue-900 dark:text-blue-300">Daily Average</p><p className="text-2xl font-bold text-blue-700 dark:text-blue-400 mt-2">{formatCurrency(report.summary.totalAmount / (report.byDate?.length || 1))}</p></div>
    </div>
    {report.byDate?.length > 0 && (
      <div className="overflow-x-auto"><table className="w-full min-w-[600px] divide-y divide-gray-200 dark:divide-[#38383A]"><thead className="bg-gray-50 dark:bg-[#2C2C2E]"><tr>{['Date', 'Collections', 'Amount'].map(h => <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-[#8E8E93] uppercase">{h}</th>)}</tr></thead><tbody className="bg-white dark:bg-[#1C1C1E] divide-y divide-gray-200 dark:divide-[#38383A]">{report.byDate.map(d => <tr key={d.date} className="hover:bg-gray-50 dark:hover:bg-[#2C2C2E]"><td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{new Date(d.date).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-[#8E8E93]">{d.count}</td><td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600 dark:text-green-400">{formatCurrency(d.amount)}</td></tr>)}</tbody></table></div>
    )}
  </div>
)

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
