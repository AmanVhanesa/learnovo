import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  TrendingUp, TrendingDown, IndianRupee, ArrowUpRight, ArrowDownRight,
  BarChart3, PieChart, Clock, AlertTriangle, Download, Printer,
  Calendar, List
} from 'lucide-react'
import { financeDashboardService } from '../services/financeDashboardService'
import { formatCurrency } from '../utils/formatCurrency'
import toast from 'react-hot-toast'

import LoadingSpinner from '../components/LoadingSpinner'
import EmptyState from '../components/EmptyState'
import KpiCard from '../components/KpiCard'

import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, ArcElement,
  PointElement, LineElement, Title, Tooltip, Legend, Filler
} from 'chart.js'
import { Bar, Doughnut } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, PointElement, LineElement, Title, Tooltip, Legend, Filler)

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const FinanceDashboard = () => {
  const navigate = useNavigate()
  const [reportRange, setReportRange] = useState('6')

  // Dashboard data
  const { data: dashData, isLoading: dashLoading } = useQuery({
    queryKey: ['finance-dashboard'],
    queryFn: async () => {
      const res = await financeDashboardService.getDashboard()
      return res.data
    }
  })

  // Monthly comparison
  const { data: comparisonData = [] } = useQuery({
    queryKey: ['finance-comparison', reportRange],
    queryFn: async () => {
      const res = await financeDashboardService.getMonthlyComparison(parseInt(reportRange))
      return res.data || []
    }
  })

  // Expense breakdown
  const { data: expenseBreakdown = [] } = useQuery({
    queryKey: ['finance-expense-breakdown'],
    queryFn: async () => {
      const res = await financeDashboardService.getExpenseBreakdown()
      return res.data || []
    }
  })

  // Export combined report
  const handleExportCsv = async () => {
    try {
      const now = new Date()
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()
      const blob = await financeDashboardService.getReport({ startDate, endDate, format: 'csv' })
      const url = window.URL.createObjectURL(new Blob([blob]))
      const a = document.createElement('a')
      a.href = url
      a.download = 'finance-report.csv'
      a.click()
      window.URL.revokeObjectURL(url)
      toast.success('Report downloaded')
    } catch (error) {
      toast.error('Export failed')
    }
  }

  if (dashLoading) return <LoadingSpinner />

  // Chart data: Income vs Expense comparison
  const comparisonChartData = {
    labels: comparisonData.map(d => `${MONTH_NAMES[d.month - 1]} ${d.year}`),
    datasets: [
      {
        label: 'Income',
        data: comparisonData.map(d => d.income),
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
        borderColor: '#10B981',
        borderWidth: 2,
        borderRadius: 6,
      },
      {
        label: 'Expense',
        data: comparisonData.map(d => d.expense),
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
        borderColor: '#EF4444',
        borderWidth: 2,
        borderRadius: 6,
      }
    ]
  }

  // Expense breakdown donut
  const breakdownChartData = {
    labels: expenseBreakdown.map(d => d.name),
    datasets: [{
      data: expenseBreakdown.map(d => d.total),
      backgroundColor: expenseBreakdown.map(d => d.color || '#6B7280'),
      borderWidth: 0,
      hoverOffset: 8
    }]
  }

  const netMonth = dashData?.netBalanceMonth || 0
  const netYear = dashData?.netBalanceYear || 0

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="page-header mb-6">
        <div>
          <h1 className="page-title">Finance Dashboard</h1>
          <p className="page-subtitle">Overview of income, expenses, and net balance</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="btn btn-outline"><Printer className="h-4 w-4 mr-2" />Print</button>
          <button onClick={handleExportCsv} className="btn btn-primary"><Download className="h-4 w-4 mr-2" />Export Report</button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <KpiCard
          title="Net Balance (Month)"
          value={formatCurrency(Math.abs(netMonth))}
          Icon={netMonth >= 0 ? TrendingUp : TrendingDown}
          trend={netMonth >= 0 ? 'up' : 'down'}
          delta={netMonth >= 0 ? 'Surplus' : 'Deficit'}
        />
        <KpiCard
          title="Income This Month"
          value={formatCurrency(dashData?.incomeThisMonth || 0)}
          Icon={ArrowUpRight}
          onPrimary={() => navigate('/app/income')}
          primaryLabel="View Income"
        />
        <KpiCard
          title="Expenses This Month"
          value={formatCurrency(dashData?.expenseThisMonth || 0)}
          Icon={ArrowDownRight}
          onPrimary={() => navigate('/app/expenses')}
          primaryLabel="View Expenses"
        />
        <KpiCard
          title="Pending Approvals"
          value={dashData?.pendingApprovals || 0}
          Icon={Clock}
          trend={dashData?.pendingApprovals > 0 ? 'down' : 'flat'}
          delta={dashData?.pendingApprovals > 0 ? 'Needs attention' : null}
          onPrimary={() => navigate('/app/expenses')}
          primaryLabel="Review"
        />
      </div>

      {/* Year totals */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="stat-card">
          <p className="text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wide mb-1">Total Income (Year)</p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{formatCurrency(dashData?.incomeThisYear || 0)}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wide mb-1">Total Expenses (Year)</p>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400 tabular-nums">{formatCurrency(dashData?.expenseThisYear || 0)}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wide mb-1">Net Balance (Year)</p>
          <p className={`text-2xl font-bold tabular-nums ${netYear >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
            {netYear >= 0 ? '+' : '-'}{formatCurrency(Math.abs(netYear))}
          </p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Income vs Expense comparison */}
        <div className="stat-card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-[#8E8E93]">Income vs Expenses</h3>
            <select value={reportRange} onChange={(e) => setReportRange(e.target.value)} className="input w-auto text-xs !py-1.5 !px-2.5">
              <option value="3">Last 3 months</option>
              <option value="6">Last 6 months</option>
              <option value="12">Last 12 months</option>
            </select>
          </div>
          <div className="h-72">
            {comparisonData.length > 0 ? (
              <Bar data={comparisonChartData} options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { position: 'top', labels: { usePointStyle: true, pointStyle: 'circle', padding: 16, font: { size: 12 } } },
                  tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${formatCurrency(ctx.raw)}` } }
                },
                scales: {
                  y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { callback: v => `${(v / 1000).toFixed(0)}k` } },
                  x: { grid: { display: false } }
                }
              }} />
            ) : (
              <EmptyState icon={BarChart3} title="No data yet" description="Add income and expense records to see comparison" />
            )}
          </div>
        </div>

        {/* Expense category breakdown */}
        <div className="stat-card">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-[#8E8E93] mb-4">Expense Breakdown</h3>
          <div className="h-72 flex items-center justify-center">
            {expenseBreakdown.length > 0 ? (
              <Doughnut data={breakdownChartData} options={{
                responsive: true,
                maintainAspectRatio: false,
                cutout: '60%',
                plugins: {
                  legend: { position: 'bottom', labels: { usePointStyle: true, pointStyle: 'circle', padding: 10, font: { size: 10 } } },
                  tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${formatCurrency(ctx.raw)}` } }
                }
              }} />
            ) : (
              <EmptyState icon={PieChart} title="No data" description="Add expenses to see breakdown" />
            )}
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="stat-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-[#8E8E93]">Recent Transactions</h3>
        </div>
        {dashData?.recentTransactions?.length > 0 ? (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full min-w-[600px] text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-[#2C2C2E]">
                  <th className="text-left py-3 px-5 text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Type</th>
                  <th className="text-left py-3 px-5 text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Date</th>
                  <th className="text-left py-3 px-5 text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Title</th>
                  <th className="text-left py-3 px-5 text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Category</th>
                  <th className="text-left py-3 px-5 text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Method</th>
                  <th className="text-right py-3 px-5 text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Amount</th>
                </tr>
              </thead>
              <tbody>
                {dashData.recentTransactions.map(txn => (
                  <tr key={txn._id} className="border-b border-gray-50 dark:border-[#38383A]/20 hover:bg-primary-50/40 dark:hover:bg-primary-500/[0.03] transition-colors">
                    <td className="py-3 px-5">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
                        txn.type === 'income'
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                          : 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400'
                      }`}>
                        {txn.type === 'income' ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                        {txn.type === 'income' ? 'Income' : 'Expense'}
                      </span>
                    </td>
                    <td className="py-3 px-5 text-gray-500 dark:text-[#8E8E93] whitespace-nowrap">{new Date(txn.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</td>
                    <td className="py-3 px-5 font-medium text-gray-900 dark:text-white">{txn.title}</td>
                    <td className="py-3 px-5">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: txn.category?.color || '#6B7280' }} />
                        <span className="text-gray-600 dark:text-[#8E8E93]">{txn.category?.name || '\u2014'}</span>
                      </span>
                    </td>
                    <td className="py-3 px-5 text-gray-500 dark:text-[#8E8E93] whitespace-nowrap">{txn.paymentMethod}</td>
                    <td className={`py-3 px-5 text-right font-semibold tabular-nums whitespace-nowrap ${
                      txn.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                    }`}>
                      {txn.type === 'income' ? '+' : '-'}{formatCurrency(txn.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={List} title="No transactions yet" description="Add income or expense records to see them here" />
        )}
      </div>
    </div>
  )
}

export default FinanceDashboard
