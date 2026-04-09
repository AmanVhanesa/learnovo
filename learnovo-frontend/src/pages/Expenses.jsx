import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  LayoutDashboard, List, Plus, Tags, PiggyBank, BarChart3,
  Search, X, Check, Ban, Edit, Trash2, Eye,
  TrendingUp, TrendingDown, AlertTriangle, IndianRupee, Clock, Calendar,
  ChevronLeft, ChevronRight, Printer
} from 'lucide-react'
import { expensesService, expenseReportsService, expenseCategoriesService, expenseBudgetService } from '../services/expensesService'
import { academicSessionsService } from '../services/academicsService'
import ExportColumnPicker from '../components/ExportColumnPicker'
import { formatCurrency } from '../utils/formatCurrency'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'
import { highQualityPrint } from '../utils/highQualityPrint'

import LoadingSpinner from '../components/LoadingSpinner'
import EmptyState from '../components/EmptyState'
import StatusBadge from '../components/StatusBadge'
import KpiCard from '../components/KpiCard'

import AcademicSessionSelector from '../components/AcademicSessionSelector'
import ExpenseFormModal from '../components/expenses/ExpenseFormModal'
import ExpenseDetailModal from '../components/expenses/ExpenseDetailModal'
import CategoryFormModal from '../components/expenses/CategoryFormModal'
import BudgetFormModal from '../components/expenses/BudgetFormModal'

// Chart.js
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, ArcElement,
  PointElement, LineElement, Title, Tooltip, Legend, Filler
} from 'chart.js'
import { Bar, Doughnut, Line } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, PointElement, LineElement, Title, Tooltip, Legend, Filler)

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'list', label: 'All Expenses', icon: List },
  { id: 'categories', label: 'Categories', icon: Tags },
  { id: 'budget', label: 'Budget', icon: PiggyBank },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
]

const EMPTY_ARRAY = []
const PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'UPI', 'Cheque', 'Card']
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTH_NAMES_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const Expenses = () => {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('dashboard')
  const [isPrintLoading, setIsPrintLoading] = useState(false)
  const printRef = useRef(null)

  // List
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 })
  const [filters, setFilters] = useState({ search: '', status: '', category: '', paymentMethod: '', startDate: '', endDate: '', source: '' })
  const [selectedIds, setSelectedIds] = useState([])
  const [debouncedFilters, setDebouncedFilters] = useState(filters)

  // Budget
  const [budgetMonth, setBudgetMonth] = useState(new Date().getMonth() + 1)
  const [budgetYear, setBudgetYear] = useState(new Date().getFullYear())

  // Reports
  const [reportMonth, setReportMonth] = useState(new Date().getMonth() + 1)
  const [reportYear, setReportYear] = useState(new Date().getFullYear())

  // Modals
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [editingExpense, setEditingExpense] = useState(null)
  const [viewingExpense, setViewingExpense] = useState(null)
  const [showCategoryForm, setShowCategoryForm] = useState(false)
  const [editingCategory, setEditingCategory] = useState(null)
  const [showBudgetForm, setShowBudgetForm] = useState(false)
  const [editingBudget, setEditingBudget] = useState(null)
  const [budgetCategory, setBudgetCategory] = useState(null)

  // ── Debounce filters for list ──────────────────────────────────────────
  useEffect(() => {
    if (activeTab !== 'list') return
    const timeout = setTimeout(() => setDebouncedFilters(filters), 300)
    return () => clearTimeout(timeout)
  }, [filters, activeTab])

  // ── Queries ────────────────────────────────────────────────────────────

  const [selectedSession, setSelectedSession] = useState(null)

  const { data: activeSession, isLoading: sessionLoading } = useQuery({
    queryKey: ['expense-active-session'],
    queryFn: async () => { const res = await academicSessionsService.getActive(); return res.data },
  })

  const currentSession = selectedSession || activeSession

  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ['expense-categories'],
    queryFn: async () => {
      const res = await expenseCategoriesService.list()
      return res.data || []
    },
  })

  const isLoading = sessionLoading || categoriesLoading

  // Dashboard data
  const { data: dashboardQueryData } = useQuery({
    queryKey: ['expense-dashboard', currentSession?._id],
    queryFn: async () => {
      const sessionFilter = { academicSessionId: currentSession._id }
      const [dashRes, monthRes, catRes, recentRes] = await Promise.all([
        expenseReportsService.getDashboard(sessionFilter),
        expenseReportsService.getMonthly(sessionFilter),
        expenseReportsService.getByCategory(sessionFilter),
        expensesService.list({ limit: 10, sortBy: 'expenseDate', sortOrder: 'desc', academicSessionId: currentSession._id })
      ])
      return {
        dashboardData: dashRes.data,
        monthlyData: monthRes.data || [],
        categoryData: catRes.data || [],
        recentExpenses: recentRes.data || []
      }
    },
    enabled: !!currentSession && activeTab === 'dashboard',
  })

  const dashboardData = dashboardQueryData?.dashboardData || null
  const monthlyData = dashboardQueryData?.monthlyData || []
  const categoryData = dashboardQueryData?.categoryData || []
  const recentExpenses = dashboardQueryData?.recentExpenses || []

  // Expenses list
  const { data: expensesListData, isLoading: listLoading } = useQuery({
    queryKey: ['expenses-list', debouncedFilters, pagination.page, pagination.limit, currentSession?._id],
    queryFn: async () => {
      const res = await expensesService.list({ ...debouncedFilters, page: pagination.page, limit: pagination.limit, academicSessionId: currentSession?._id })
      return { expenses: res.data || [], pagination: res.pagination || { page: 1, limit: 20, total: 0, pages: 0 } }
    },
    enabled: !!currentSession && activeTab === 'list',
    placeholderData: (prev) => prev,
  })

  const expenses = expensesListData?.expenses || EMPTY_ARRAY

  // Sync pagination from query result
  useEffect(() => {
    if (expensesListData?.pagination) {
      setPagination(expensesListData.pagination)
    }
  }, [expensesListData?.pagination])

  // Reset selected when expenses change
  useEffect(() => {
    setSelectedIds([])
  }, [expenses])

  // Budgets
  const { data: budgets = [], isLoading: budgetLoading } = useQuery({
    queryKey: ['expense-budgets', budgetMonth, budgetYear],
    queryFn: async () => {
      const res = await expenseBudgetService.list({ month: budgetMonth, year: budgetYear })
      return res.data || []
    },
    enabled: activeTab === 'budget',
  })

  // Reports
  const { data: reportsQueryData, isLoading: reportLoading } = useQuery({
    queryKey: ['expense-reports', reportMonth, reportYear, currentSession?._id],
    queryFn: async () => {
      const startDate = new Date(reportYear, reportMonth - 1, 1).toISOString()
      const endDate = new Date(reportYear, reportMonth, 0, 23, 59, 59).toISOString()

      const [catRes, listRes] = await Promise.all([
        expenseReportsService.getByCategory({ startDate, endDate, academicSessionId: currentSession?._id }),
        expensesService.list({ startDate, endDate, limit: 100, academicSessionId: currentSession?._id })
      ])
      const reportCategoryData = catRes.data || []
      const expensesList = listRes.data || []
      const total = expensesList.reduce((s, e) => s + e.amount, 0)

      const dayMap = {}
      expensesList.forEach(e => {
        const day = new Date(e.expenseDate).getDate()
        dayMap[day] = (dayMap[day] || 0) + e.amount
      })
      const daysInMonth = new Date(reportYear, reportMonth, 0).getDate()
      const dayWise = Array.from({ length: daysInMonth }, (_, i) => ({ day: i + 1, amount: dayMap[i + 1] || 0 }))

      const prevStartDate = new Date(reportYear, reportMonth - 2, 1).toISOString()
      const prevEndDate = new Date(reportYear, reportMonth - 1, 0, 23, 59, 59).toISOString()
      let prevTotal = 0
      try {
        const prevCatRes = await expenseReportsService.getByCategory({ startDate: prevStartDate, endDate: prevEndDate, academicSessionId: currentSession?._id })
        prevTotal = (prevCatRes.data || []).reduce((s, c) => s + c.total, 0)
      } catch {}

      const changePercent = prevTotal > 0 ? Math.round(((total - prevTotal) / prevTotal) * 100) : 0

      return {
        reportData: { total, dayWise, prevTotal, changePercent, count: expensesList.length },
        reportCategoryData
      }
    },
    enabled: !!currentSession && activeTab === 'reports',
  })

  const reportData = reportsQueryData?.reportData || null
  const reportCategoryData = reportsQueryData?.reportCategoryData || []

  // ── Actions ─────────────────────────────────────────────────────────────────

  const handleSaveExpense = async (data) => {
    try {
      if (editingExpense) {
        await expensesService.update(editingExpense._id, data)
        toast.success('Expense updated')
      } else {
        await expensesService.create({ ...data, academicSessionId: currentSession?._id })
        toast.success('Expense added')
      }
      setShowExpenseForm(false)
      setEditingExpense(null)
      if (activeTab === 'list') queryClient.invalidateQueries({ queryKey: ['expenses-list'] })
      if (activeTab === 'dashboard') queryClient.invalidateQueries({ queryKey: ['expense-dashboard'] })
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save expense')
    }
  }

  const handleApprove = async (id) => {
    try {
      const res = await expensesService.approve(id)
      toast.success('Expense approved')
      setViewingExpense(res.data)
      if (activeTab === 'list') queryClient.invalidateQueries({ queryKey: ['expenses-list'] })
      if (activeTab === 'dashboard') queryClient.invalidateQueries({ queryKey: ['expense-dashboard'] })
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to approve')
    }
  }

  const handleReject = async (id, reason) => {
    try {
      const res = await expensesService.reject(id, reason)
      toast.success('Expense rejected')
      setViewingExpense(res.data)
      if (activeTab === 'list') queryClient.invalidateQueries({ queryKey: ['expenses-list'] })
      if (activeTab === 'dashboard') queryClient.invalidateQueries({ queryKey: ['expense-dashboard'] })
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to reject')
    }
  }

  const handleDelete = async (id) => {
    try {
      await expensesService.delete(id)
      toast.success('Expense deleted')
      setViewingExpense(null)
      if (activeTab === 'list') queryClient.invalidateQueries({ queryKey: ['expenses-list'] })
      if (activeTab === 'dashboard') queryClient.invalidateQueries({ queryKey: ['expense-dashboard'] })
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete')
    }
  }

  const handleBulkApprove = async () => {
    if (selectedIds.length === 0) return
    try {
      await expensesService.bulkApprove(selectedIds)
      toast.success(`${selectedIds.length} expenses approved`)
      queryClient.invalidateQueries({ queryKey: ['expenses-list'] })
    } catch (error) {
      toast.error('Bulk approve failed')
    }
  }

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return
    if (!window.confirm(`Delete ${selectedIds.length} expenses?`)) return
    try {
      await expensesService.bulkDelete(selectedIds)
      toast.success(`${selectedIds.length} expenses deleted`)
      queryClient.invalidateQueries({ queryKey: ['expenses-list'] })
    } catch (error) {
      toast.error('Bulk delete failed')
    }
  }

  const expenseExportColumns = [
    { key: 'date', label: 'Date', group: 'Basic', getValue: e => e.date ? new Date(e.date).toLocaleDateString() : '' },
    { key: 'title', label: 'Title', group: 'Basic', getValue: e => e.title || '' },
    { key: 'category', label: 'Category', group: 'Basic', getValue: e => e.category?.name || e.category || '' },
    { key: 'amount', label: 'Amount', group: 'Basic', getValue: e => e.amount || 0 },
    { key: 'status', label: 'Status', group: 'Basic', getValue: e => e.status || '' },
    { key: 'paymentMethod', label: 'Payment Method', group: 'Payment', getValue: e => e.paymentMethod || '' },
    { key: 'reference', label: 'Reference', group: 'Payment', getValue: e => e.reference || '' },
    { key: 'vendor', label: 'Vendor', group: 'Payment', getValue: e => e.vendor || '' },
    { key: 'description', label: 'Description', group: 'Details', getValue: e => e.description || '' },
    { key: 'addedBy', label: 'Added By', group: 'Audit', getValue: e => e.addedBy?.name || '' },
    { key: 'approvedBy', label: 'Approved By', group: 'Audit', getValue: e => e.approvedBy?.name || '' },
  ]

  const expenseExportPresets = {
    basic: { label: 'Basic', fields: ['date', 'title', 'category', 'amount', 'status'] },
    accounting: { label: 'Accounting', fields: ['date', 'title', 'category', 'amount', 'paymentMethod', 'reference', 'vendor'] },
    audit: { label: 'Audit Trail', fields: ['date', 'title', 'amount', 'status', 'addedBy', 'approvedBy'] },
  }

  const handleSaveCategory = async (data) => {
    try {
      if (editingCategory) {
        await expenseCategoriesService.update(editingCategory._id, data)
        toast.success('Category updated')
      } else {
        await expenseCategoriesService.create(data)
        toast.success('Category created')
      }
      setShowCategoryForm(false)
      setEditingCategory(null)
      queryClient.invalidateQueries({ queryKey: ['expense-categories'] })
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save category')
    }
  }

  const handleDeleteCategory = async (id) => {
    if (!window.confirm('Deactivate this category?')) return
    try {
      await expenseCategoriesService.delete(id)
      toast.success('Category deactivated')
      queryClient.invalidateQueries({ queryKey: ['expense-categories'] })
    } catch (error) {
      toast.error('Failed to deactivate category')
    }
  }

  const handleSeedCategories = async () => {
    try {
      const res = await expenseCategoriesService.seed()
      toast.success(res.message)
      queryClient.invalidateQueries({ queryKey: ['expense-categories'] })
    } catch (error) {
      toast.error('Failed to seed categories')
    }
  }

  const handleSaveBudget = async (data) => {
    try {
      await expenseBudgetService.save(data)
      toast.success('Budget saved')
      setShowBudgetForm(false)
      setEditingBudget(null)
      setBudgetCategory(null)
      queryClient.invalidateQueries({ queryKey: ['expense-budgets'] })
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save budget')
    }
  }

  const handleEditExpenseFromDetail = (exp) => {
    if (exp.isSystemGenerated) {
      toast.error('System-generated records cannot be modified')
      return
    }
    setViewingExpense(null)
    setEditingExpense(exp)
    setShowExpenseForm(true)
  }

  // Toggle select
  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }
  const selectableExpenses = expenses.filter(e => !e.isSystemGenerated)
  const toggleSelectAll = () => {
    if (selectedIds.length === selectableExpenses.length) setSelectedIds([])
    else setSelectedIds(selectableExpenses.map(e => e._id))
  }

  // Pagination helper
  const goToPage = (page) => {
    setPagination(prev => ({ ...prev, page }))
  }

  if (isLoading) return <LoadingSpinner />
  if (!currentSession) return <EmptyState icon={Calendar} title="No active academic session" description="Please activate an academic session first" />

  // ── Charts data ─────────────────────────────────────────────────────────────

  const monthlyChartData = {
    labels: monthlyData.map(d => `${MONTH_NAMES[(d._id?.month || 1) - 1]} ${d._id?.year || ''}`),
    datasets: [{
      label: 'Expenses',
      data: monthlyData.map(d => d.total),
      backgroundColor: 'rgba(62, 196, 177, 0.15)',
      borderColor: '#3EC4B1',
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
          <h1 className="page-title">Expense Management</h1>
          <AcademicSessionSelector
            selectedSessionId={currentSession._id}
            onSessionChange={setSelectedSession}
          />
        </div>
        <button
          onClick={() => { setEditingExpense(null); setShowExpenseForm(true) }}
          className="btn btn-primary"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Expense
        </button>
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
      {activeTab === 'budget' && renderBudget()}
      {activeTab === 'reports' && renderReportsTab()}

      {/* Modals */}
      {showExpenseForm && (
        <ExpenseFormModal
          expense={editingExpense}
          categories={categories.filter(c => c.isActive)}
          onClose={() => { setShowExpenseForm(false); setEditingExpense(null) }}
          onSave={handleSaveExpense}
        />
      )}
      {viewingExpense && (
        <ExpenseDetailModal
          expense={viewingExpense}
          onClose={() => setViewingExpense(null)}
          onApprove={handleApprove}
          onReject={handleReject}
          onEdit={handleEditExpenseFromDetail}
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
      {showBudgetForm && (
        <BudgetFormModal
          budget={editingBudget}
          category={budgetCategory}
          month={budgetMonth}
          year={budgetYear}
          onClose={() => { setShowBudgetForm(false); setEditingBudget(null); setBudgetCategory(null) }}
          onSave={handleSaveBudget}
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
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard title="This Month" value={formatCurrency(dashboardData?.totalThisMonth || 0)} Icon={IndianRupee} />
          <KpiCard title="This Academic Year" value={formatCurrency(dashboardData?.totalThisYear || 0)} Icon={TrendingUp} />
          <KpiCard title="Pending Approvals" value={dashboardData?.pendingApprovals || 0} Icon={Clock} onPrimary={() => { setFilters(prev => ({ ...prev, status: 'Pending' })); setActiveTab('list') }} primaryLabel="View" />
          <KpiCard title="Budget Utilization" value={`${dashboardData?.budgetUtilization || 0}%`} Icon={PiggyBank} trend={dashboardData?.budgetUtilization > 90 ? 'down' : dashboardData?.budgetUtilization > 0 ? 'up' : 'flat'} delta={dashboardData?.budgetUtilization > 90 ? 'Over budget!' : null} />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="stat-card">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-[#8E8E93] mb-4">Monthly Expenses</h3>
            <div className="h-64">
              {monthlyData.length > 0 ? (
                <Bar data={monthlyChartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { callback: v => `${(v / 1000).toFixed(0)}k` } }, x: { grid: { display: false } } } }} />
              ) : (
                <EmptyState icon={BarChart3} title="No data yet" description="Add expenses to see monthly trends" />
              )}
            </div>
          </div>

          <div className="stat-card">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-[#8E8E93] mb-4">By Category</h3>
            <div className="h-64 flex items-center justify-center">
              {categoryData.length > 0 ? (
                <Doughnut data={categoryChartData} options={{ responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { position: window.innerWidth < 768 ? 'bottom' : 'right', labels: { usePointStyle: true, pointStyle: 'circle', padding: 12, font: { size: 11 } } }, tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${formatCurrency(ctx.raw)}` } } } }} />
              ) : (
                <EmptyState icon={Tags} title="No data yet" description="Add expenses to see category breakdown" />
              )}
            </div>
          </div>
        </div>

        {/* Recent Expenses Table */}
        <div className="stat-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-[#8E8E93]">Recent Expenses</h3>
            <button onClick={() => setActiveTab('list')} className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline">View all</button>
          </div>
          {recentExpenses.length > 0 ? (
            <div className="overflow-x-auto -mx-5">
              <table className="w-full min-w-[600px] text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-[#2C2C2E]">
                    <th className="text-left py-3 px-5 text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Date</th>
                    <th className="text-left py-3 px-5 text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Title</th>
                    <th className="text-left py-3 px-5 text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Category</th>
                    <th className="text-right py-3 px-5 text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Amount</th>
                    <th className="text-center py-3 px-5 text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentExpenses.map(exp => (
                    <tr key={exp._id} onClick={() => setViewingExpense(exp)} className="border-b border-gray-50 dark:border-[#38383A]/20 hover:bg-primary-50/40 dark:hover:bg-primary-500/[0.03] cursor-pointer transition-colors">
                      <td className="py-3 px-5 text-gray-500 dark:text-[#8E8E93] whitespace-nowrap">{new Date(exp.expenseDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</td>
                      <td className="py-3 px-5 font-medium text-gray-900 dark:text-white">{exp.title}</td>
                      <td className="py-3 px-5"><span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: exp.category?.color || '#6B7280' }} /><span className="text-gray-600 dark:text-[#8E8E93]">{exp.category?.name || '\u2014'}</span></span></td>
                      <td className="py-3 px-5 text-right font-semibold text-gray-900 dark:text-white tabular-nums">{formatCurrency(exp.amount)}</td>
                      <td className="py-3 px-5 text-center"><StatusBadge status={exp.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon={List} title="No expenses yet" description="Click 'Add Expense' to get started" />
          )}
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // TAB: All Expenses List
  // ══════════════════════════════════════════════════════════════════════════════
  function renderList() {
    return (
      <div className="space-y-4">
        {/* Filters */}
        <div className="stat-card !p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="relative flex-1 min-w-0 sm:min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-[#636366]" />
              <input type="text" value={filters.search} onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))} className="input pl-10" placeholder="Search expenses..." />
              {filters.search && (<button onClick={() => setFilters(prev => ({ ...prev, search: '' }))} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="h-4 w-4 text-gray-400 dark:text-[#636366] hover:text-gray-600 dark:hover:text-white" /></button>)}
            </div>
            <select value={filters.status} onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))} className="input w-full sm:w-auto min-w-0 sm:min-w-[130px]"><option value="">All Status</option><option value="Pending">Pending</option><option value="Approved">Approved</option><option value="Rejected">Rejected</option></select>
            <select value={filters.category} onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))} className="input w-full sm:w-auto min-w-0 sm:min-w-[140px]"><option value="">All Categories</option>{categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}</select>
            <select value={filters.paymentMethod} onChange={(e) => setFilters(prev => ({ ...prev, paymentMethod: e.target.value }))} className="input w-full sm:w-auto min-w-0 sm:min-w-[150px]"><option value="">All Methods</option>{PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}</select>
            <select value={filters.source} onChange={(e) => setFilters(prev => ({ ...prev, source: e.target.value }))} className="input w-full sm:w-auto min-w-0 sm:min-w-[140px]"><option value="">All Sources</option><option value="manual">Manual</option><option value="payroll">From Payroll</option></select>
            <input type="date" value={filters.startDate} onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))} className="input w-full sm:w-auto" placeholder="Start date" />
            <input type="date" value={filters.endDate} onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))} className="input w-full sm:w-auto" placeholder="End date" />
          </div>
        </div>

        {/* Bulk actions + Export */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex gap-2">
            {selectedIds.length > 0 && (
              <>
                <button onClick={handleBulkApprove} className="btn btn-sm bg-emerald-600 text-white hover:bg-emerald-500 shadow-md"><Check className="h-3.5 w-3.5 mr-1.5" />Approve ({selectedIds.length})</button>
                <button onClick={handleBulkDelete} className="btn btn-sm btn-danger"><Trash2 className="h-3.5 w-3.5 mr-1.5" />Delete ({selectedIds.length})</button>
              </>
            )}
            {selectedIds.length === 0 && (<p className="text-xs text-gray-400 dark:text-[#8E8E93]">{pagination.total > 0 ? `${pagination.total} expense${pagination.total !== 1 ? 's' : ''} found` : ''}</p>)}
          </div>
          <ExportColumnPicker
            data={expenses}
            columns={expenseExportColumns}
            presets={expenseExportPresets}
            filename="expenses"
            title="Export Expenses"
            sheetName="Expenses"
            buttonLabel="Export"
            buttonClassName="btn btn-sm btn-outline"
          />
        </div>

        {/* Table */}
        <div className="card overflow-hidden">
          {listLoading ? <LoadingSpinner /> : expenses.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-sm">
                <thead>
                  <tr className="bg-gray-50/80 dark:bg-[#2C2C2E] border-b border-gray-100 dark:border-[#38383A]">
                    <th className="py-3.5 px-4 w-10"><input type="checkbox" checked={selectedIds.length === selectableExpenses.length && selectableExpenses.length > 0} onChange={toggleSelectAll} className="rounded border-gray-300 dark:border-[#38383A] text-primary-600 focus:ring-primary-500" /></th>
                    <th className="text-left py-3.5 px-4 text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Date</th>
                    <th className="text-left py-3.5 px-4 text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Title</th>
                    <th className="text-left py-3.5 px-4 text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Category</th>
                    <th className="text-right py-3.5 px-4 text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Amount</th>
                    <th className="text-left py-3.5 px-4 text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Method</th>
                    <th className="text-center py-3.5 px-4 text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Status</th>
                    <th className="text-left py-3.5 px-4 text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Added By</th>
                    <th className="text-center py-3.5 px-4 text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Source</th>
                    <th className="text-center py-3.5 px-4 text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map(exp => (
                    <tr key={exp._id} className="border-b border-gray-50 dark:border-[#38383A]/20 hover:bg-primary-50/40 dark:hover:bg-primary-500/[0.03] transition-colors">
                      <td className="py-3.5 px-4"><input type="checkbox" checked={selectedIds.includes(exp._id)} onChange={() => toggleSelect(exp._id)} disabled={exp.isSystemGenerated} className={`rounded border-gray-300 dark:border-[#38383A] text-primary-600 focus:ring-primary-500${exp.isSystemGenerated ? ' opacity-50 cursor-not-allowed' : ''}`} /></td>
                      <td className="py-3.5 px-4 text-gray-500 dark:text-[#8E8E93] whitespace-nowrap">{new Date(exp.expenseDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}</td>
                      <td className="py-3.5 px-4 font-medium text-gray-900 dark:text-white max-w-[200px] truncate">{exp.title}</td>
                      <td className="py-3.5 px-4"><span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: exp.category?.color || '#6B7280' }} /><span className="text-gray-600 dark:text-[#8E8E93] whitespace-nowrap">{exp.category?.name || '\u2014'}</span></span></td>
                      <td className="py-3.5 px-4 text-right font-semibold text-gray-900 dark:text-white whitespace-nowrap tabular-nums">{formatCurrency(exp.amount)}</td>
                      <td className="py-3.5 px-4 text-gray-500 dark:text-[#8E8E93] whitespace-nowrap">{exp.paymentMethod}</td>
                      <td className="py-3.5 px-4 text-center"><StatusBadge status={exp.status} /></td>
                      <td className="py-3.5 px-4 text-gray-500 dark:text-[#8E8E93] whitespace-nowrap">{exp.addedBy?.name || '\u2014'}</td>
                      <td className="py-3.5 px-4 text-center">
                        {exp.isSystemGenerated || exp.referenceType === 'payroll'
                          ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">From Payroll</span>
                          : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">Manual</span>
                        }
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-center gap-0.5">
                          <button onClick={() => setViewingExpense(exp)} className="btn-icon" title="View"><Eye className="h-4 w-4" /></button>
                          <button onClick={() => { if (exp.isSystemGenerated) return; setEditingExpense(exp); setShowExpenseForm(true) }} className={`btn-icon${exp.isSystemGenerated ? ' opacity-50 cursor-not-allowed' : ''}`} disabled={exp.isSystemGenerated} title={exp.isSystemGenerated ? 'System-generated records cannot be modified' : 'Edit'}><Edit className="h-4 w-4" /></button>
                          {exp.status === 'Pending' && !exp.isSystemGenerated && (
                            <>
                              <button onClick={() => handleApprove(exp._id)} className="p-2 rounded-xl text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition-all" title="Approve"><Check className="h-4 w-4" /></button>
                              <button onClick={() => handleReject(exp._id, '')} className="p-2 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all" title="Reject"><Ban className="h-4 w-4" /></button>
                            </>
                          )}
                          <button onClick={() => { if (exp.isSystemGenerated) return; handleDelete(exp._id) }} className={`p-2 rounded-xl text-gray-400 dark:text-[#636366] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all${exp.isSystemGenerated ? ' opacity-50 cursor-not-allowed' : ''}`} disabled={exp.isSystemGenerated} title={exp.isSystemGenerated ? 'System-generated records cannot be modified' : 'Delete'}><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-6"><EmptyState icon={List} title="No expenses found" description="Try adjusting your filters or add a new expense" /></div>
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
                    <td className="py-3.5 px-5 text-center"><StatusBadge status={cat.isActive ? 'Active' : 'Inactive'} /></td>
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
            <div className="p-6"><EmptyState icon={Tags} title="No categories yet" description="Create categories to organize your expenses" action={<button onClick={handleSeedCategories} className="btn btn-sm btn-primary">Seed Default Categories</button>} /></div>
          )}
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // TAB: Budget
  // ══════════════════════════════════════════════════════════════════════════════
  function renderBudget() {
    const activeCategories = categories.filter(c => c.isActive)

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <select value={budgetMonth} onChange={(e) => setBudgetMonth(parseInt(e.target.value))} className="input w-auto">{MONTH_NAMES_FULL.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}</select>
          <select value={budgetYear} onChange={(e) => setBudgetYear(parseInt(e.target.value))} className="input w-auto">{[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}</select>
        </div>

        <div className="card overflow-hidden">
          {budgetLoading ? <LoadingSpinner /> : (
            <>
              <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-sm">
                <thead>
                  <tr className="bg-gray-50/80 dark:bg-[#2C2C2E] border-b border-gray-100 dark:border-[#38383A]">
                    <th className="text-left py-3.5 px-5 text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Category</th>
                    <th className="text-right py-3.5 px-5 text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Budget</th>
                    <th className="text-right py-3.5 px-5 text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Spent</th>
                    <th className="text-right py-3.5 px-5 text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Remaining</th>
                    <th className="text-left py-3.5 px-5 text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider min-w-[180px]">Utilization</th>
                    <th className="text-center py-3.5 px-5 text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {activeCategories.map(cat => {
                    const budget = budgets.find(b => (b.category?._id || b.category) === cat._id)
                    const budgetAmt = budget?.budgetAmount || 0
                    const spent = budget?.spent || 0
                    const remaining = budgetAmt - spent
                    const util = budgetAmt > 0 ? Math.round((spent / budgetAmt) * 100) : 0
                    const isOver = util > 90

                    return (
                      <tr key={cat._id} className="border-b border-gray-50 dark:border-[#38383A]/20 hover:bg-primary-50/40 dark:hover:bg-primary-500/[0.03] transition-colors">
                        <td className="py-3.5 px-5"><span className="inline-flex items-center gap-2.5"><span className="w-3 h-3 rounded-full flex-shrink-0 ring-1 ring-black/5" style={{ backgroundColor: cat.color || '#6B7280' }} /><span className="font-medium text-gray-900 dark:text-white">{cat.name}</span></span></td>
                        <td className="py-3.5 px-5 text-right text-gray-600 dark:text-[#8E8E93] tabular-nums">{budgetAmt > 0 ? formatCurrency(budgetAmt) : <span className="text-gray-300 dark:text-[#636366]">&mdash;</span>}</td>
                        <td className="py-3.5 px-5 text-right font-semibold text-gray-900 dark:text-white tabular-nums">{formatCurrency(spent)}</td>
                        <td className={`py-3.5 px-5 text-right font-semibold tabular-nums ${remaining < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-[#8E8E93]'}`}>{budgetAmt > 0 ? formatCurrency(remaining) : <span className="text-gray-300 dark:text-[#636366]">&mdash;</span>}</td>
                        <td className="py-3.5 px-5">{budgetAmt > 0 ? (<div className="flex items-center gap-3"><div className="flex-1 h-2.5 bg-gray-100 dark:bg-[#2C2C2E] rounded-full overflow-hidden"><div className={`h-full rounded-full transition-all duration-500 ${isOver ? 'bg-red-500' : util > 70 ? 'bg-amber-500' : 'bg-primary-500'}`} style={{ width: `${Math.min(util, 100)}%` }} /></div><span className={`text-xs font-bold tabular-nums min-w-[36px] text-right ${isOver ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-[#8E8E93]'}`}>{util}%</span>{isOver && <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />}</div>) : (<span className="text-xs text-gray-400 dark:text-[#636366] italic">No budget set</span>)}</td>
                        <td className="py-3.5 px-5 text-center"><button onClick={() => { setBudgetCategory(cat); setEditingBudget(budget); setShowBudgetForm(true) }} className="btn btn-sm btn-outline">{budgetAmt > 0 ? 'Edit' : 'Set Budget'}</button></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              </div>
              {activeCategories.length === 0 && (<div className="p-6"><EmptyState icon={Tags} title="No active categories" description="Create expense categories first to set budgets" /></div>)}
            </>
          )}
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // TAB: Reports
  // ══════════════════════════════════════════════════════════════════════════════
  function renderReportsTab() {
    const dayWiseChartData = reportData?.dayWise ? {
      labels: reportData.dayWise.map(d => d.day),
      datasets: [{ label: 'Daily Expenses', data: reportData.dayWise.map(d => d.amount), borderColor: '#3EC4B1', backgroundColor: 'rgba(62, 196, 177, 0.08)', fill: true, tension: 0.3, pointRadius: 2, pointHoverRadius: 6, pointBackgroundColor: '#3EC4B1', pointBorderColor: '#fff', pointBorderWidth: 2 }]
    } : null

    return (
      <div className="space-y-6" ref={printRef}>
        {/* Month/Year selector */}
        <div className="flex items-center gap-3">
          <select value={reportMonth} onChange={(e) => setReportMonth(parseInt(e.target.value))} className="input w-auto">{MONTH_NAMES_FULL.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}</select>
          <select value={reportYear} onChange={(e) => setReportYear(parseInt(e.target.value))} className="input w-auto">{[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}</select>
        </div>

        {reportLoading ? <LoadingSpinner /> : reportData ? (
          <>
            {/* Summary row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="stat-card"><p className="text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Total This Month</p><p className="text-2xl font-bold text-gray-900 dark:text-white mt-2 tabular-nums">{formatCurrency(reportData.total)}</p><p className="text-xs text-gray-400 dark:text-[#636366] mt-1">{reportData.count} expense{reportData.count !== 1 ? 's' : ''}</p></div>
              <div className="stat-card"><p className="text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Previous Month</p><p className="text-2xl font-bold text-gray-900 dark:text-white mt-2 tabular-nums">{formatCurrency(reportData.prevTotal)}</p></div>
              <div className="stat-card"><p className="text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Month-over-Month</p><div className="flex items-center gap-2.5 mt-2"><p className={`text-2xl font-bold tabular-nums ${reportData.changePercent > 0 ? 'text-red-600 dark:text-red-400' : reportData.changePercent < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-900 dark:text-white'}`}>{reportData.changePercent > 0 ? '+' : ''}{reportData.changePercent}%</p>{reportData.changePercent > 0 && <TrendingUp className="h-5 w-5 text-red-500" />}{reportData.changePercent < 0 && <TrendingDown className="h-5 w-5 text-emerald-500" />}</div><p className="text-xs text-gray-400 dark:text-[#636366] mt-1">{reportData.changePercent > 0 ? 'Spending increased' : reportData.changePercent < 0 ? 'Spending decreased' : 'No change'}</p></div>
            </div>

            {/* Day-wise chart */}
            {dayWiseChartData && (
              <div className="stat-card">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-[#8E8E93] mb-4">Daily Expense Trend</h3>
                <div className="h-64">
                  <Line data={dayWiseChartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { callback: v => `${(v / 1000).toFixed(0)}k` } }, x: { grid: { display: false }, title: { display: true, text: 'Day of Month', font: { size: 11 }, color: '#9CA3AF' } } } }} />
                </div>
              </div>
            )}

            {/* Category breakdown */}
            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-[#38383A]"><h3 className="text-sm font-semibold text-gray-700 dark:text-[#8E8E93]">Category Breakdown</h3></div>
              {reportCategoryData.length > 0 ? (
                <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] text-sm">
                  <thead><tr className="bg-gray-50/80 dark:bg-[#2C2C2E] border-b border-gray-100 dark:border-[#38383A]"><th className="text-left py-3 px-5 text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Category</th><th className="text-right py-3 px-5 text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Amount</th><th className="text-right py-3 px-5 text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Count</th><th className="text-right py-3 px-5 text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">% of Total</th></tr></thead>
                  <tbody>
                    {reportCategoryData.map(cat => {
                      const pct = reportData.total > 0 ? Math.round((cat.total / reportData.total) * 100) : 0
                      return (
                        <tr key={cat._id} className="border-b border-gray-50 dark:border-[#38383A]/20 last:border-0">
                          <td className="py-3 px-5"><span className="inline-flex items-center gap-2.5"><span className="w-3 h-3 rounded-full ring-1 ring-black/5" style={{ backgroundColor: cat.color || '#6B7280' }} /><span className="font-medium text-gray-900 dark:text-white">{cat.name}</span></span></td>
                          <td className="py-3 px-5 text-right font-semibold text-gray-900 dark:text-white tabular-nums">{formatCurrency(cat.total)}</td>
                          <td className="py-3 px-5 text-right text-gray-500 dark:text-[#8E8E93] tabular-nums">{cat.count}</td>
                          <td className="py-3 px-5 text-right"><div className="inline-flex items-center gap-2"><div className="w-16 h-1.5 bg-gray-100 dark:bg-[#2C2C2E] rounded-full overflow-hidden"><div className="h-full rounded-full bg-primary-500" style={{ width: `${pct}%` }} /></div><span className="text-xs font-medium text-gray-500 dark:text-[#8E8E93] tabular-nums min-w-[28px] text-right">{pct}%</span></div></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                </div>
              ) : (
                <div className="p-6"><EmptyState icon={BarChart3} title="No data for this month" /></div>
              )}
            </div>

            {/* Print/Export */}
            <div className="flex gap-2">
              <button onClick={async () => { if (!printRef.current) return; setIsPrintLoading(true); try { await highQualityPrint(printRef.current, 'Expense-Report', { scale: 2, format: 'a4', orientation: 'portrait', margin: 10 }); } catch (e) { console.error('Print failed:', e); toast.error('Failed to prepare print.'); } finally { setIsPrintLoading(false); } }} disabled={isPrintLoading} className="btn btn-sm btn-outline"><Printer className="h-3.5 w-3.5 mr-1.5" />{isPrintLoading ? 'Preparing...' : 'Print Report'}</button>
              <ExportColumnPicker
                data={expenses}
                columns={expenseExportColumns}
                presets={expenseExportPresets}
                filename="expenses_report"
                title="Export Expenses"
                sheetName="Expenses"
                buttonLabel="Export"
                buttonClassName="btn btn-sm btn-outline"
              />
            </div>
          </>
        ) : (
          <div className="stat-card"><EmptyState icon={BarChart3} title="Select a month to view reports" /></div>
        )}
      </div>
    )
  }
}

export default Expenses
