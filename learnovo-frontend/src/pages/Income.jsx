import React, { useState, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  LayoutDashboard, List, Plus, Tags, BarChart3,
  Search, X, Edit, Trash2, Eye,
  TrendingUp, IndianRupee, Clock, Calendar,
  ChevronLeft, ChevronRight, Printer
} from 'lucide-react'
import { incomeService, incomeReportsService, incomeCategoriesService } from '../services/incomeService'
import { academicSessionsService } from '../services/academicsService'
import ExportColumnPicker from '../components/ExportColumnPicker'
import { formatCurrency } from '../utils/formatCurrency'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'
import { highQualityPrint } from '../utils/highQualityPrint'

import LoadingSpinner from '../components/LoadingSpinner'
import EmptyState from '../components/EmptyState'
import KpiCard from '../components/KpiCard'

import AcademicSessionSelector from '../components/AcademicSessionSelector'
import IncomeFormModal from '../components/income/IncomeFormModal'
import IncomeDetailModal from '../components/income/IncomeDetailModal'
import CategoryFormModal from '../components/income/CategoryFormModal'

import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, ArcElement,
  PointElement, LineElement, Title, Tooltip, Legend, Filler
} from 'chart.js'
import { Bar, Doughnut } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, PointElement, LineElement, Title, Tooltip, Legend, Filler)

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'list', label: 'All Income', icon: List },
  { id: 'categories', label: 'Categories', icon: Tags },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
]

const EMPTY_ARRAY = []
const PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'UPI', 'Cheque', 'Card']
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTH_NAMES_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const Income = () => {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('dashboard')
  const [isPrintLoading, setIsPrintLoading] = useState(false)
  const printRef = useRef(null)

  // List
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 })
  const [filters, setFilters] = useState({ search: '', category: '', paymentMethod: '', startDate: '', endDate: '', source: '' })
  const [selectedIds, setSelectedIds] = useState([])
  const [debouncedFilters, setDebouncedFilters] = useState(filters)

  // Reports
  const [reportMonth, setReportMonth] = useState(new Date().getMonth() + 1)
  const [reportYear, setReportYear] = useState(new Date().getFullYear())

  // Modals
  const [showIncomeForm, setShowIncomeForm] = useState(false)
  const [editingIncome, setEditingIncome] = useState(null)
  const [viewingIncome, setViewingIncome] = useState(null)
  const [showCategoryForm, setShowCategoryForm] = useState(false)
  const [editingCategory, setEditingCategory] = useState(null)

  // Debounce filters
  useEffect(() => {
    if (activeTab !== 'list') return
    const timeout = setTimeout(() => setDebouncedFilters(filters), 300)
    return () => clearTimeout(timeout)
  }, [filters, activeTab])

  // ── Queries ────────────────────────────────────────────────────────────

  const [selectedSession, setSelectedSession] = useState(null)

  const { data: activeSession, isLoading: sessionLoading } = useQuery({
    queryKey: ['income-active-session'],
    queryFn: async () => { const res = await academicSessionsService.getActive(); return res.data },
  })

  // Default to active session on first load
  const currentSession = selectedSession || activeSession
  const isViewOnly = currentSession && !currentSession.isActive

  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ['income-categories'],
    queryFn: async () => {
      const res = await incomeCategoriesService.list()
      return res.data || []
    },
  })

  const isLoading = sessionLoading || categoriesLoading

  // Dashboard data
  const { data: dashboardQueryData } = useQuery({
    queryKey: ['income-dashboard', currentSession?._id],
    queryFn: async () => {
      const sessionFilter = { academicSessionId: currentSession._id }
      const [dashRes, monthRes, catRes, recentRes] = await Promise.all([
        incomeReportsService.getDashboard(sessionFilter),
        incomeReportsService.getMonthly(sessionFilter),
        incomeReportsService.getByCategory(sessionFilter),
        incomeService.list({ limit: 10, sortBy: 'incomeDate', sortOrder: 'desc', academicSessionId: currentSession._id })
      ])
      return {
        dashboardData: dashRes.data,
        monthlyData: monthRes.data || [],
        categoryData: catRes.data || [],
        recentIncome: recentRes.data || []
      }
    },
    enabled: !!currentSession && activeTab === 'dashboard',
  })

  const dashboardData = dashboardQueryData?.dashboardData || null
  const monthlyData = dashboardQueryData?.monthlyData || []
  const categoryData = dashboardQueryData?.categoryData || []
  const recentIncome = dashboardQueryData?.recentIncome || []

  // Income list
  const { data: incomeListData, isLoading: listLoading } = useQuery({
    queryKey: ['income-list', debouncedFilters, pagination.page, pagination.limit, currentSession?._id],
    queryFn: async () => {
      const res = await incomeService.list({ ...debouncedFilters, page: pagination.page, limit: pagination.limit, academicSessionId: currentSession?._id })
      return { incomes: res.data || [], pagination: res.pagination || { page: 1, limit: 20, total: 0, pages: 0 } }
    },
    enabled: !!currentSession && activeTab === 'list',
    placeholderData: (prev) => prev,
  })

  const incomes = incomeListData?.incomes || EMPTY_ARRAY

  useEffect(() => {
    if (incomeListData?.pagination) {
      setPagination(incomeListData.pagination)
    }
  }, [incomeListData?.pagination])

  useEffect(() => {
    setSelectedIds([])
  }, [incomes])

  // Reports
  const { data: reportsQueryData, isLoading: reportLoading } = useQuery({
    queryKey: ['income-reports', reportMonth, reportYear, currentSession?._id],
    queryFn: async () => {
      const startDate = new Date(reportYear, reportMonth - 1, 1).toISOString()
      const endDate = new Date(reportYear, reportMonth, 0, 23, 59, 59).toISOString()

      const [catRes, listRes] = await Promise.all([
        incomeReportsService.getByCategory({ startDate, endDate, academicSessionId: currentSession?._id }),
        incomeService.list({ startDate, endDate, limit: 100, academicSessionId: currentSession?._id })
      ])
      const reportCategoryData = catRes.data || []
      const incomesList = listRes.data || []
      const total = incomesList.reduce((s, i) => s + i.amount, 0)

      const dayMap = {}
      incomesList.forEach(i => {
        const day = new Date(i.incomeDate).getDate()
        dayMap[day] = (dayMap[day] || 0) + i.amount
      })
      const daysInMonth = new Date(reportYear, reportMonth, 0).getDate()
      const dayWise = Array.from({ length: daysInMonth }, (_, i) => ({ day: i + 1, amount: dayMap[i + 1] || 0 }))

      const prevStartDate = new Date(reportYear, reportMonth - 2, 1).toISOString()
      const prevEndDate = new Date(reportYear, reportMonth - 1, 0, 23, 59, 59).toISOString()
      let prevTotal = 0
      try {
        const prevCatRes = await incomeReportsService.getByCategory({ startDate: prevStartDate, endDate: prevEndDate, academicSessionId: currentSession?._id })
        prevTotal = (prevCatRes.data || []).reduce((s, c) => s + c.total, 0)
      } catch {}

      const changePercent = prevTotal > 0 ? Math.round(((total - prevTotal) / prevTotal) * 100) : 0

      return {
        reportData: { total, dayWise, prevTotal, changePercent, count: incomesList.length },
        reportCategoryData
      }
    },
    enabled: !!currentSession && activeTab === 'reports',
  })

  const reportData = reportsQueryData?.reportData || null
  const reportCategoryData = reportsQueryData?.reportCategoryData || []

  // ── Actions ─────────────────────────────────────────────────────────────────

  const handleSaveIncome = async (data) => {
    try {
      if (editingIncome) {
        await incomeService.update(editingIncome._id, data)
        toast.success('Income updated')
      } else {
        await incomeService.create({ ...data, academicSessionId: currentSession?._id })
        toast.success('Income added')
      }
      setShowIncomeForm(false)
      setEditingIncome(null)
      if (activeTab === 'list') queryClient.invalidateQueries({ queryKey: ['income-list'] })
      if (activeTab === 'dashboard') queryClient.invalidateQueries({ queryKey: ['income-dashboard'] })
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save income')
    }
  }

  const handleDelete = async (id) => {
    try {
      await incomeService.delete(id)
      toast.success('Income deleted')
      setViewingIncome(null)
      if (activeTab === 'list') queryClient.invalidateQueries({ queryKey: ['income-list'] })
      if (activeTab === 'dashboard') queryClient.invalidateQueries({ queryKey: ['income-dashboard'] })
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete')
    }
  }

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return
    if (!window.confirm(`Delete ${selectedIds.length} income records?`)) return
    try {
      await incomeService.bulkDelete(selectedIds)
      toast.success(`${selectedIds.length} records deleted`)
      queryClient.invalidateQueries({ queryKey: ['income-list'] })
    } catch (error) {
      toast.error('Bulk delete failed')
    }
  }

  const incomeExportColumns = [
    { key: 'date', label: 'Date', group: 'Basic', getValue: i => i.date ? new Date(i.date).toLocaleDateString() : '' },
    { key: 'title', label: 'Title', group: 'Basic', getValue: i => i.title || '' },
    { key: 'category', label: 'Category', group: 'Basic', getValue: i => i.category?.name || i.category || '' },
    { key: 'amount', label: 'Amount', group: 'Basic', getValue: i => i.amount || 0 },
    { key: 'paymentMethod', label: 'Payment Method', group: 'Payment', getValue: i => i.paymentMethod || '' },
    { key: 'reference', label: 'Reference', group: 'Payment', getValue: i => i.reference || '' },
    { key: 'receivedFrom', label: 'Received From', group: 'Payment', getValue: i => i.receivedFrom || '' },
    { key: 'receivedBy', label: 'Received By', group: 'Audit', getValue: i => i.receivedBy?.name || i.receivedBy || '' },
    { key: 'addedBy', label: 'Added By', group: 'Audit', getValue: i => i.addedBy?.name || '' },
    { key: 'description', label: 'Description', group: 'Details', getValue: i => i.description || '' },
  ]

  const incomeExportPresets = {
    basic: { label: 'Basic', fields: ['date', 'title', 'category', 'amount'] },
    accounting: { label: 'Accounting', fields: ['date', 'title', 'category', 'amount', 'paymentMethod', 'reference'] },
  }

  const handleSaveCategory = async (data) => {
    try {
      if (editingCategory) {
        await incomeCategoriesService.update(editingCategory._id, data)
        toast.success('Category updated')
      } else {
        await incomeCategoriesService.create(data)
        toast.success('Category created')
      }
      setShowCategoryForm(false)
      setEditingCategory(null)
      queryClient.invalidateQueries({ queryKey: ['income-categories'] })
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save category')
    }
  }

  const handleDeleteCategory = async (id) => {
    if (!window.confirm('Deactivate this category?')) return
    try {
      await incomeCategoriesService.delete(id)
      toast.success('Category deactivated')
      queryClient.invalidateQueries({ queryKey: ['income-categories'] })
    } catch (error) {
      toast.error('Failed to deactivate category')
    }
  }

  const handleSeedCategories = async () => {
    try {
      const res = await incomeCategoriesService.seed()
      toast.success(res.message)
      queryClient.invalidateQueries({ queryKey: ['income-categories'] })
    } catch (error) {
      toast.error('Failed to seed categories')
    }
  }

  const handleEditIncomeFromDetail = (inc) => {
    if (inc.isSystemGenerated) {
      toast.error('System-generated records cannot be modified')
      return
    }
    setViewingIncome(null)
    setEditingIncome(inc)
    setShowIncomeForm(true)
  }

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }
  const toggleSelectAll = () => {
    const selectableIncomes = incomes.filter(i => !i.isSystemGenerated)
    if (selectedIds.length === selectableIncomes.length) setSelectedIds([])
    else setSelectedIds(selectableIncomes.map(i => i._id))
  }

  const goToPage = (page) => {
    setPagination(prev => ({ ...prev, page }))
  }

  if (isLoading) return <LoadingSpinner />
  if (!currentSession) return <EmptyState icon={Calendar} title="No active academic session" description="Please activate an academic session first" />

  // Charts data
  const monthlyChartData = {
    labels: monthlyData.map(d => `${MONTH_NAMES[(d._id?.month || 1) - 1]} ${d._id?.year || ''}`),
    datasets: [{
      label: 'Income',
      data: monthlyData.map(d => d.total),
      backgroundColor: 'rgba(16, 185, 129, 0.15)',
      borderColor: '#10B981',
      borderWidth: 2,
      borderRadius: 8,
      fill: true,
      tension: 0.4
    }]
  }

  const categoryChartData = {
    labels: categoryData.map(d => d.name),
    datasets: [{
      data: categoryData.map(d => d.total),
      backgroundColor: categoryData.map(d => d.color || '#6B7280'),
      borderWidth: 0,
      hoverOffset: 8
    }]
  }

  // ── RENDER ──────────────────────────────────────────────────────────────────

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="page-header mb-6">
        <div>
          <h1 className="page-title">Income Management</h1>
          <AcademicSessionSelector
            selectedSessionId={currentSession._id}
            onSessionChange={setSelectedSession}
          />
        </div>
        {!isViewOnly && (
          <button
            onClick={() => { setEditingIncome(null); setShowIncomeForm(true) }}
            className="btn btn-primary"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Income
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100/80 dark:bg-[#2C2C2E] rounded-xl mb-6 overflow-x-auto overflow-y-hidden whitespace-nowrap scrollbar-hide">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 text-sm font-medium rounded-lg whitespace-nowrap transition-all duration-200 flex-shrink-0 ${
              activeTab === tab.id
                ? 'bg-white dark:bg-[#1C1C1E] text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-[#8E8E93] hover:text-gray-700 dark:hover:text-white'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'dashboard' && renderDashboard()}
      {activeTab === 'list' && renderList()}
      {activeTab === 'categories' && renderCategories()}
      {activeTab === 'reports' && renderReportsTab()}

      {/* Modals */}
      {showIncomeForm && (
        <IncomeFormModal
          income={editingIncome}
          categories={categories.filter(c => c.isActive)}
          onClose={() => { setShowIncomeForm(false); setEditingIncome(null) }}
          onSave={handleSaveIncome}
        />
      )}
      {viewingIncome && (
        <IncomeDetailModal
          income={viewingIncome}
          onClose={() => setViewingIncome(null)}
          onEdit={handleEditIncomeFromDetail}
          onDelete={handleDelete}
        />
      )}
      {showCategoryForm && (
        <CategoryFormModal
          category={editingCategory}
          onClose={() => { setShowCategoryForm(false); setEditingCategory(null) }}
          onSave={handleSaveCategory}
        />
      )}
    </div>
  )

  // ══════════════════════════════════════════════════════════════════════════════
  // TAB: Dashboard
  // ══════════════════════════════════════════════════════════════════════════════
  function renderDashboard() {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <KpiCard title="This Month" value={formatCurrency(dashboardData?.totalThisMonth || 0)} Icon={IndianRupee} />
          <KpiCard title="This Academic Year" value={formatCurrency(dashboardData?.totalThisYear || 0)} Icon={TrendingUp} />
          <KpiCard title="Total Records" value={dashboardData?.totalRecords || 0} Icon={List} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="stat-card">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-[#8E8E93] mb-4">Monthly Income</h3>
            <div className="h-64">
              {monthlyData.length > 0 ? (
                <Bar data={monthlyChartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { callback: v => `${(v / 1000).toFixed(0)}k` } }, x: { grid: { display: false } } } }} />
              ) : (
                <EmptyState icon={BarChart3} title="No data yet" description="Add income records to see monthly trends" />
              )}
            </div>
          </div>

          <div className="stat-card">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-[#8E8E93] mb-4">By Category</h3>
            <div className="h-64 flex items-center justify-center">
              {categoryData.length > 0 ? (
                <Doughnut data={categoryChartData} options={{ responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { position: window.innerWidth < 768 ? 'bottom' : 'right', labels: { usePointStyle: true, pointStyle: 'circle', padding: 12, font: { size: 11 } } }, tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${formatCurrency(ctx.raw)}` } } } }} />
              ) : (
                <EmptyState icon={Tags} title="No data yet" description="Add income records to see category breakdown" />
              )}
            </div>
          </div>
        </div>

        {/* Recent Income Table */}
        <div className="stat-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-[#8E8E93]">Recent Income</h3>
            <button onClick={() => setActiveTab('list')} className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline">View all</button>
          </div>
          {recentIncome.length > 0 ? (
            <div className="overflow-x-auto -mx-5">
              <table className="w-full min-w-[600px] text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-[#2C2C2E]">
                    <th className="text-left py-3 px-5 text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Date</th>
                    <th className="text-left py-3 px-5 text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Title</th>
                    <th className="text-left py-3 px-5 text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Category</th>
                    <th className="text-right py-3 px-5 text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {recentIncome.map(inc => (
                    <tr key={inc._id} onClick={() => setViewingIncome(inc)} className="border-b border-gray-50 dark:border-[#38383A]/20 hover:bg-primary-50/40 dark:hover:bg-primary-500/[0.03] cursor-pointer transition-colors">
                      <td className="py-3 px-5 text-gray-500 dark:text-[#8E8E93] whitespace-nowrap">{new Date(inc.incomeDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</td>
                      <td className="py-3 px-5 font-medium text-gray-900 dark:text-white">{inc.title}</td>
                      <td className="py-3 px-5"><span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: inc.category?.color || '#6B7280' }} /><span className="text-gray-600 dark:text-[#8E8E93]">{inc.category?.name || '\u2014'}</span></span></td>
                      <td className="py-3 px-5 text-right font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">+{formatCurrency(inc.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon={List} title="No income yet" description="Click 'Add Income' to get started" />
          )}
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // TAB: All Income List
  // ══════════════════════════════════════════════════════════════════════════════
  function renderList() {
    return (
      <div className="space-y-4">
        {/* Filters */}
        <div className="stat-card !p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="relative flex-1 min-w-0 sm:min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-[#636366]" />
              <input type="text" value={filters.search} onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))} className="input pl-10" placeholder="Search income..." />
              {filters.search && (<button onClick={() => setFilters(prev => ({ ...prev, search: '' }))} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="h-4 w-4 text-gray-400 dark:text-[#636366] hover:text-gray-600 dark:hover:text-white" /></button>)}
            </div>
            <select value={filters.category} onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))} className="input w-full sm:w-auto min-w-0 sm:min-w-[140px]"><option value="">All Categories</option>{categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}</select>
            <select value={filters.paymentMethod} onChange={(e) => setFilters(prev => ({ ...prev, paymentMethod: e.target.value }))} className="input w-full sm:w-auto min-w-0 sm:min-w-[150px]"><option value="">All Methods</option>{PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}</select>
            <select value={filters.source} onChange={(e) => setFilters(prev => ({ ...prev, source: e.target.value }))} className="input w-full sm:w-auto min-w-0 sm:min-w-[140px]"><option value="">All Sources</option><option value="manual">Manual</option><option value="fee_collection">From Fees</option></select>
            <input type="date" value={filters.startDate} onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))} className="input w-full sm:w-auto" />
            <input type="date" value={filters.endDate} onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))} className="input w-full sm:w-auto" />
          </div>
        </div>

        {/* Bulk actions + Export */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex gap-2">
            {selectedIds.length > 0 && (
              <button onClick={handleBulkDelete} className="btn btn-sm btn-danger"><Trash2 className="h-3.5 w-3.5 mr-1.5" />Delete ({selectedIds.length})</button>
            )}
            {selectedIds.length === 0 && (<p className="text-xs text-gray-400 dark:text-[#8E8E93]">{pagination.total > 0 ? `${pagination.total} record${pagination.total !== 1 ? 's' : ''} found` : ''}</p>)}
          </div>
          <ExportColumnPicker
            data={incomes}
            columns={incomeExportColumns}
            presets={incomeExportPresets}
            filename="income"
            title="Export Income"
            sheetName="Income"
            buttonLabel="Export"
            buttonClassName="btn btn-sm btn-outline"
          />
        </div>

        {/* Table */}
        <div className="card overflow-hidden">
          {listLoading ? <LoadingSpinner /> : incomes.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-sm">
                <thead>
                  <tr className="bg-gray-50/80 dark:bg-[#2C2C2E] border-b border-gray-100 dark:border-[#38383A]">
                    <th className="py-3.5 px-4 w-10"><input type="checkbox" checked={selectedIds.length === incomes.filter(i => !i.isSystemGenerated).length && incomes.filter(i => !i.isSystemGenerated).length > 0} onChange={toggleSelectAll} className="rounded border-gray-300 dark:border-[#38383A] text-primary-600 focus:ring-primary-500" /></th>
                    <th className="text-left py-3.5 px-4 text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Date</th>
                    <th className="text-left py-3.5 px-4 text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Title</th>
                    <th className="text-left py-3.5 px-4 text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Source</th>
                    <th className="text-left py-3.5 px-4 text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Category</th>
                    <th className="text-right py-3.5 px-4 text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Amount</th>
                    <th className="text-left py-3.5 px-4 text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Method</th>
                    <th className="text-left py-3.5 px-4 text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Received By</th>
                    <th className="text-center py-3.5 px-4 text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {incomes.map(inc => (
                    <tr key={inc._id} className="border-b border-gray-50 dark:border-[#38383A]/20 hover:bg-primary-50/40 dark:hover:bg-primary-500/[0.03] transition-colors">
                      <td className="py-3.5 px-4">{inc.isSystemGenerated ? <input type="checkbox" disabled className="rounded border-gray-300 dark:border-[#38383A] text-primary-600 opacity-50 cursor-not-allowed" title="System-generated records cannot be modified" /> : <input type="checkbox" checked={selectedIds.includes(inc._id)} onChange={() => toggleSelect(inc._id)} className="rounded border-gray-300 dark:border-[#38383A] text-primary-600 focus:ring-primary-500" />}</td>
                      <td className="py-3.5 px-4 text-gray-500 dark:text-[#8E8E93] whitespace-nowrap">{new Date(inc.incomeDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}</td>
                      <td className="py-3.5 px-4 font-medium text-gray-900 dark:text-white max-w-[200px] truncate">{inc.title}</td>
                      <td className="py-3.5 px-4">{inc.isSystemGenerated || inc.referenceType === 'fee_payment' ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">From Fees</span> : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">Manual</span>}</td>
                      <td className="py-3.5 px-4"><span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: inc.category?.color || '#6B7280' }} /><span className="text-gray-600 dark:text-[#8E8E93] whitespace-nowrap">{inc.category?.name || '\u2014'}</span></span></td>
                      <td className="py-3.5 px-4 text-right font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap tabular-nums">+{formatCurrency(inc.amount)}</td>
                      <td className="py-3.5 px-4 text-gray-500 dark:text-[#8E8E93] whitespace-nowrap">{inc.paymentMethod}</td>
                      <td className="py-3.5 px-4 text-gray-500 dark:text-[#8E8E93] whitespace-nowrap">{inc.receivedBy || '\u2014'}</td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-center gap-0.5">
                          <button onClick={() => setViewingIncome(inc)} className="btn-icon" title="View"><Eye className="h-4 w-4" /></button>
                          <button onClick={() => { if (!inc.isSystemGenerated) { setEditingIncome(inc); setShowIncomeForm(true) } }} className={`btn-icon ${inc.isSystemGenerated ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={inc.isSystemGenerated} title={inc.isSystemGenerated ? 'System-generated records cannot be modified' : 'Edit'}><Edit className="h-4 w-4" /></button>
                          <button onClick={() => { if (!inc.isSystemGenerated) handleDelete(inc._id) }} className={`p-2 rounded-xl transition-all ${inc.isSystemGenerated ? 'text-gray-400 dark:text-[#636366] opacity-50 cursor-not-allowed' : 'text-gray-400 dark:text-[#636366] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10'}`} disabled={inc.isSystemGenerated} title={inc.isSystemGenerated ? 'System-generated records cannot be modified' : 'Delete'}><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-6"><EmptyState icon={List} title="No income found" description="Try adjusting your filters or add a new income record" /></div>
          )}

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between px-5 py-3.5 border-t border-gray-100 dark:border-[#2C2C2E] bg-gray-50/50 dark:bg-[#2C2C2E]/30">
              <p className="text-xs text-gray-500 dark:text-[#8E8E93]">Showing <span className="font-medium">{((pagination.page - 1) * pagination.limit) + 1}</span>&ndash;<span className="font-medium">{Math.min(pagination.page * pagination.limit, pagination.total)}</span> of <span className="font-medium">{pagination.total}</span></p>
              <div className="flex gap-1">
                <button onClick={() => goToPage(pagination.page - 1)} disabled={pagination.page <= 1} className="btn-icon disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
                <button onClick={() => goToPage(pagination.page + 1)} disabled={pagination.page >= pagination.pages} className="btn-icon disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // TAB: Categories
  // ══════════════════════════════════════════════════════════════════════════════
  function renderCategories() {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500 dark:text-[#8E8E93]">{categories.length} categor{categories.length === 1 ? 'y' : 'ies'}</p>
          <div className="flex gap-2">
            {categories.length === 0 && (<button onClick={handleSeedCategories} className="btn btn-sm btn-outline">Seed Defaults</button>)}
            <button onClick={() => { setEditingCategory(null); setShowCategoryForm(true) }} className="btn btn-sm btn-primary"><Plus className="h-3.5 w-3.5 mr-1.5" />Add Category</button>
          </div>
        </div>

        <div className="card overflow-hidden">
          {categories.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-sm">
                <thead>
                  <tr className="bg-gray-50/80 dark:bg-[#2C2C2E] border-b border-gray-100 dark:border-[#38383A]">
                    <th className="text-left py-3.5 px-5 text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Color</th>
                    <th className="text-left py-3.5 px-5 text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Name</th>
                    <th className="text-center py-3.5 px-5 text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Status</th>
                    <th className="text-center py-3.5 px-5 text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map(cat => (
                    <tr key={cat._id} className="border-b border-gray-50 dark:border-[#38383A]/20 hover:bg-primary-50/40 dark:hover:bg-primary-500/[0.03] transition-colors">
                      <td className="py-3.5 px-5"><span className="w-7 h-7 rounded-lg inline-flex items-center justify-center ring-1 ring-black/5" style={{ backgroundColor: cat.color || '#6B7280' }} /></td>
                      <td className="py-3.5 px-5 font-medium text-gray-900 dark:text-white">{cat.name}</td>
                      <td className="py-3.5 px-5 text-center"><span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${cat.isActive ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-gray-100 text-gray-500 dark:bg-[#38383A] dark:text-[#8E8E93]'}`}>{cat.isActive ? 'Active' : 'Inactive'}</span></td>
                      <td className="py-3.5 px-5">
                        <div className="flex items-center justify-center gap-0.5">
                          <button onClick={() => { setEditingCategory(cat); setShowCategoryForm(true) }} className="btn-icon" title="Edit"><Edit className="h-4 w-4" /></button>
                          {cat.isActive && (<button onClick={() => handleDeleteCategory(cat._id)} className="p-2 rounded-xl text-gray-400 dark:text-[#636366] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all" title="Deactivate"><Trash2 className="h-4 w-4" /></button>)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-6"><EmptyState icon={Tags} title="No categories yet" description="Click 'Seed Defaults' to get started or add your own" /></div>
          )}
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // TAB: Reports
  // ══════════════════════════════════════════════════════════════════════════════
  function renderReportsTab() {
    const reportChartData = {
      labels: (reportData?.dayWise || []).map(d => d.day),
      datasets: [{
        label: 'Daily Income',
        data: (reportData?.dayWise || []).map(d => d.amount),
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        borderColor: '#10B981',
        borderWidth: 2,
        borderRadius: 4,
        fill: true,
        tension: 0.4
      }]
    }

    const reportCatChartData = {
      labels: reportCategoryData.map(d => d.name),
      datasets: [{
        data: reportCategoryData.map(d => d.total),
        backgroundColor: reportCategoryData.map(d => d.color || '#6B7280'),
        borderWidth: 0,
        hoverOffset: 8
      }]
    }

    return (
      <div className="space-y-6" ref={printRef}>
        {/* Month selector */}
        <div className="stat-card !p-4 flex flex-wrap items-center gap-3">
          <select value={reportMonth} onChange={(e) => setReportMonth(parseInt(e.target.value))} className="input w-auto">
            {MONTH_NAMES_FULL.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={reportYear} onChange={(e) => setReportYear(parseInt(e.target.value))} className="input w-auto">
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <div className="flex-1" />
          <button onClick={async () => { if (!printRef.current) return; setIsPrintLoading(true); try { await highQualityPrint(printRef.current, 'Income-Report', { scale: 2, format: 'a4', orientation: 'portrait', margin: 10 }); } catch (e) { console.error('Print failed:', e); toast.error('Failed to prepare print.'); } finally { setIsPrintLoading(false); } }} disabled={isPrintLoading} className="btn btn-sm btn-outline"><Printer className="h-3.5 w-3.5 mr-1.5" />{isPrintLoading ? 'Preparing...' : 'Print'}</button>
          <ExportColumnPicker
            data={incomes}
            columns={incomeExportColumns}
            presets={incomeExportPresets}
            filename="income_report"
            title="Export Income"
            sheetName="Income"
            buttonLabel="Export"
            buttonClassName="btn btn-sm btn-outline"
          />
        </div>

        {reportLoading ? <LoadingSpinner /> : reportData ? (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <KpiCard title={`${MONTH_NAMES_FULL[reportMonth - 1]} Total`} value={formatCurrency(reportData.total)} Icon={IndianRupee} />
              <KpiCard title="Total Transactions" value={reportData.count} Icon={List} />
              <KpiCard
                title="vs Previous Month"
                value={reportData.changePercent !== 0 ? `${reportData.changePercent > 0 ? '+' : ''}${reportData.changePercent}%` : 'No change'}
                Icon={TrendingUp}
                trend={reportData.changePercent > 0 ? 'up' : reportData.changePercent < 0 ? 'down' : 'flat'}
                delta={reportData.prevTotal > 0 ? `Prev: ${formatCurrency(reportData.prevTotal)}` : null}
              />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="stat-card">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-[#8E8E93] mb-4">Daily Income</h3>
                <div className="h-64">
                  <Bar data={reportChartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.04)' } }, x: { grid: { display: false } } } }} />
                </div>
              </div>
              <div className="stat-card">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-[#8E8E93] mb-4">Category Breakdown</h3>
                <div className="h-64 flex items-center justify-center">
                  {reportCategoryData.length > 0 ? (
                    <Doughnut data={reportCatChartData} options={{ responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { position: 'right', labels: { usePointStyle: true, pointStyle: 'circle', padding: 12, font: { size: 11 } } }, tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${formatCurrency(ctx.raw)}` } } } }} />
                  ) : (
                    <EmptyState icon={Tags} title="No data" description="No income in this period" />
                  )}
                </div>
              </div>
            </div>

            {/* Category summary table */}
            {reportCategoryData.length > 0 && (
              <div className="stat-card">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-[#8E8E93] mb-4">Category Summary</h3>
                <div className="overflow-x-auto -mx-5">
                  <table className="w-full min-w-[400px] text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-[#2C2C2E]">
                        <th className="text-left py-3 px-5 text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Category</th>
                        <th className="text-right py-3 px-5 text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Amount</th>
                        <th className="text-right py-3 px-5 text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Count</th>
                        <th className="text-right py-3 px-5 text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">% of Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportCategoryData.map(cat => (
                        <tr key={cat._id} className="border-b border-gray-50 dark:border-[#38383A]/20">
                          <td className="py-3 px-5"><span className="inline-flex items-center gap-2"><span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color || '#6B7280' }} /><span className="font-medium text-gray-900 dark:text-white">{cat.name}</span></span></td>
                          <td className="py-3 px-5 text-right font-semibold text-gray-900 dark:text-white tabular-nums">{formatCurrency(cat.total)}</td>
                          <td className="py-3 px-5 text-right text-gray-500 dark:text-[#8E8E93] tabular-nums">{cat.count}</td>
                          <td className="py-3 px-5 text-right text-gray-500 dark:text-[#8E8E93] tabular-nums">{reportData.total > 0 ? `${Math.round((cat.total / reportData.total) * 100)}%` : '0%'}</td>
                        </tr>
                      ))}
                      <tr className="bg-gray-50/80 dark:bg-[#2C2C2E]/50 font-semibold">
                        <td className="py-3 px-5 text-gray-900 dark:text-white">Total</td>
                        <td className="py-3 px-5 text-right text-gray-900 dark:text-white tabular-nums">{formatCurrency(reportData.total)}</td>
                        <td className="py-3 px-5 text-right text-gray-700 dark:text-[#8E8E93] tabular-nums">{reportData.count}</td>
                        <td className="py-3 px-5 text-right text-gray-700 dark:text-[#8E8E93]">100%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        ) : (
          <EmptyState icon={BarChart3} title="No data" description="Select a month with income data" />
        )}
      </div>
    )
  }
}

export default Income
