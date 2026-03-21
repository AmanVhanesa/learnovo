import { useState, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { superAdminService } from '../../services/superAdminService'
import toast from 'react-hot-toast'
import {
  Bar
} from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js'
import {
  IndianRupee, TrendingUp, Clock, AlertTriangle, CalendarClock,
  Search, Download, Eye, CheckCircle, X,
  ChevronLeft, ChevronRight, Plus, Receipt, FileText,
  RefreshCw, CreditCard, Building2, Calendar, Hash,
  Printer, StickyNote, Banknote
} from 'lucide-react'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

const formatCurrency = (amount) => `\u20B9${(amount || 0).toLocaleString('en-IN')}`

const formatDate = (date) => {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
}

const statusConfig = {
  paid: {
    label: 'Paid',
    classes: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-[rgba(48,209,88,0.12)] dark:text-[#30D158] dark:ring-0'
  },
  pending: {
    label: 'Pending',
    classes: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-[rgba(255,214,10,0.12)] dark:text-[#FFD60A] dark:ring-0'
  },
  overdue: {
    label: 'Overdue',
    classes: 'bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-[rgba(255,69,58,0.12)] dark:text-[#FF453A] dark:ring-0'
  },
  cancelled: {
    label: 'Cancelled',
    classes: 'bg-gray-50 text-gray-600 ring-1 ring-gray-200 dark:bg-[rgba(142,142,147,0.12)] dark:text-[#8E8E93] dark:ring-0'
  }
}

const StatusBadge = ({ status }) => {
  const config = statusConfig[status] || statusConfig.pending
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${config.classes}`}>
      {config.label}
    </span>
  )
}

const FALLBACK_CHART = {
  labels: ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'],
  datasets: [{
    label: 'Revenue',
    data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    backgroundColor: 'rgba(62, 196, 177, 0.7)',
    borderRadius: 6,
    borderSkipped: false
  }]
}

/* ─────────────────────────── Main Component ─────────────────────────── */
const Billing = () => {
  const queryClient = useQueryClient()

  // Table state
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [planFilter, setPlanFilter] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Modal state
  const [viewInvoice, setViewInvoice] = useState(null)
  const [markPaidInvoice, setMarkPaidInvoice] = useState(null)
  const [showCreateModal, setShowCreateModal] = useState(false)

  // Mark as paid form
  const [paidForm, setPaidForm] = useState({
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'razorpay',
    transactionRef: '',
    notes: ''
  })

  // Create invoice form
  const [createForm, setCreateForm] = useState({
    tenantId: '',
    plan: '',
    billingFrom: '',
    billingTo: '',
    amount: '',
    description: '',
    dueDate: ''
  })

  const printRef = useRef(null)

  /* ─── Queries ─── */

  const { data: billingStats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['superadmin-billing-stats'],
    queryFn: async () => {
      const res = await superAdminService.getBillingDashboard()
      return res.data
    }
  })

  const { data: invoicesData, isLoading: isLoadingInvoices, error: invoicesError, refetch } = useQuery({
    queryKey: ['superadmin-invoices', page, statusFilter, search, planFilter, dateFrom, dateTo],
    queryFn: async () => {
      const params = { page, limit: 20 }
      if (statusFilter) params.status = statusFilter
      if (search) params.search = search
      if (planFilter) params.plan = planFilter
      if (dateFrom) params.dateFrom = dateFrom
      if (dateTo) params.dateTo = dateTo
      const res = await superAdminService.getInvoices(params)
      return {
        invoices: res.data || [],
        totalPages: res.pagination?.pages || 1,
        totalCount: res.pagination?.total || 0
      }
    }
  })

  const { data: chartData } = useQuery({
    queryKey: ['superadmin-revenue-chart'],
    queryFn: async () => {
      try {
        const res = await superAdminService.getRevenueChart()
        return res.data
      } catch {
        return null
      }
    }
  })

  const { data: tenantsData } = useQuery({
    queryKey: ['superadmin-tenants-dropdown'],
    queryFn: async () => {
      const res = await superAdminService.getTenants({ limit: 100 })
      return res.data || []
    }
  })

  const { data: viewInvoiceData, isLoading: isLoadingViewInvoice } = useQuery({
    queryKey: ['superadmin-invoice-detail', viewInvoice?._id],
    queryFn: async () => {
      const res = await superAdminService.getInvoiceById(viewInvoice._id)
      return res.data
    },
    enabled: !!viewInvoice?._id
  })

  const invoices = invoicesData?.invoices || []
  const totalPages = invoicesData?.totalPages || 1
  const totalCount = invoicesData?.totalCount || 0

  /* ─── Mutations ─── */

  const markPaidMutation = useMutation({
    mutationFn: ({ id, data }) => superAdminService.updateInvoice(id, data),
    onSuccess: () => {
      toast.success('Invoice marked as paid')
      setMarkPaidInvoice(null)
      setPaidForm({ paymentDate: new Date().toISOString().split('T')[0], paymentMethod: 'razorpay', transactionRef: '', notes: '' })
      queryClient.invalidateQueries({ queryKey: ['superadmin-invoices'] })
      queryClient.invalidateQueries({ queryKey: ['superadmin-billing-stats'] })
      queryClient.invalidateQueries({ queryKey: ['superadmin-revenue-chart'] })
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to update invoice')
    }
  })

  const createInvoiceMutation = useMutation({
    mutationFn: (data) => superAdminService.createInvoice(data),
    onSuccess: () => {
      toast.success('Invoice created successfully')
      setShowCreateModal(false)
      setCreateForm({ tenantId: '', plan: '', billingFrom: '', billingTo: '', amount: '', description: '', dueDate: '' })
      queryClient.invalidateQueries({ queryKey: ['superadmin-invoices'] })
      queryClient.invalidateQueries({ queryKey: ['superadmin-billing-stats'] })
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to create invoice')
    }
  })

  /* ─── Handlers ─── */

  const handleSearch = useCallback(() => {
    setSearch(searchInput)
    setPage(1)
  }, [searchInput])

  const handleMarkPaidSubmit = (e) => {
    e.preventDefault()
    markPaidMutation.mutate({
      id: markPaidInvoice._id,
      data: {
        status: 'paid',
        paymentMethod: paidForm.paymentMethod,
        paidAt: paidForm.paymentDate,
        transactionRef: paidForm.transactionRef || undefined,
        notes: paidForm.notes || undefined
      }
    })
  }

  const handleCreateSubmit = (e) => {
    e.preventDefault()
    if (!createForm.tenantId) {
      toast.error('Please select a school')
      return
    }
    if (!createForm.amount || Number(createForm.amount) <= 0) {
      toast.error('Please enter a valid amount')
      return
    }
    createInvoiceMutation.mutate({
      tenantId: createForm.tenantId,
      plan: createForm.plan || undefined,
      billingFrom: createForm.billingFrom || undefined,
      billingTo: createForm.billingTo || undefined,
      totalAmount: Number(createForm.amount),
      description: createForm.description || undefined,
      dueDate: createForm.dueDate || undefined
    })
  }

  const handleDownloadPdf = useCallback(() => {
    if (!printRef.current) return
    const printWindow = window.open('', '_blank')
    printWindow.document.write(`
      <html>
        <head>
          <title>Invoice</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; color: #111; }
            table { width: 100%; border-collapse: collapse; margin: 16px 0; }
            th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
            th { font-size: 11px; text-transform: uppercase; color: #6b7280; }
            .header { display: flex; justify-content: space-between; margin-bottom: 32px; }
            .badge { display: inline-block; padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 600; }
            .paid { background: #d1fae5; color: #065f46; }
            .pending { background: #fef3c7; color: #92400e; }
            .overdue { background: #fee2e2; color: #991b1b; }
            .total-row { font-weight: 700; font-size: 16px; }
            @media print { body { padding: 20px; } }
          </style>
        </head>
        <body>${printRef.current.innerHTML}</body>
      </html>
    `)
    printWindow.document.close()
    setTimeout(() => { printWindow.print() }, 300)
  }, [])

  /* ─── Chart config ─── */
  const revenueChartData = chartData || FALLBACK_CHART
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => `Revenue: ${formatCurrency(ctx.raw)}`
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { size: 11 } }
      },
      y: {
        grid: { color: 'rgba(0,0,0,0.05)' },
        ticks: {
          font: { size: 11 },
          callback: (val) => `\u20B9${(val / 1000).toFixed(0)}k`
        }
      }
    }
  }

  /* ─── Loading skeleton ─── */
  if (isLoadingStats && !billingStats) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="h-8 w-56 bg-gray-200 dark:bg-[#2C2C2E] rounded-xl animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-28 bg-gray-200 dark:bg-[#2C2C2E] rounded-2xl animate-pulse" />
          ))}
        </div>
        <div className="h-72 bg-gray-200 dark:bg-[#2C2C2E] rounded-2xl animate-pulse" />
        <div className="h-96 bg-gray-200 dark:bg-[#2C2C2E] rounded-2xl animate-pulse" />
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">

      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Billing &amp; Revenue</h1>
          <p className="text-sm text-gray-500 dark:text-[#8E8E93] mt-1">Manage invoices, payments, and revenue tracking</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-primary-600 text-white hover:bg-primary-500 dark:bg-[#3EC4B1] dark:text-black dark:hover:bg-[#35a89a] rounded-xl h-10 px-4 text-sm font-semibold active:scale-[0.97] transition-all flex items-center gap-2 w-full sm:w-auto justify-center"
        >
          <Plus className="h-4 w-4" />
          Generate Invoice
        </button>
      </div>

      {/* ─── Error banner ─── */}
      {invoicesError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-3 sm:p-4 flex items-center justify-between">
          <p className="text-sm text-red-700 dark:text-red-400 truncate">
            {invoicesError.response?.data?.message || invoicesError.message || 'Failed to load billing data'}
          </p>
          <button onClick={() => refetch()} className="text-red-600 hover:text-red-800 flex-shrink-0 ml-3">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ─── Revenue Summary Cards ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <SummaryCard
          icon={IndianRupee}
          title="Total Revenue"
          value={formatCurrency(billingStats?.totalRevenue)}
          subtitle="All time"
          iconBg="bg-emerald-50 dark:bg-[rgba(48,209,88,0.12)]"
          iconColor="text-emerald-600 dark:text-[#30D158]"
        />
        <SummaryCard
          icon={TrendingUp}
          title="This Month"
          value={formatCurrency(billingStats?.collectedThisMonth)}
          subtitle="Collected"
          iconBg="bg-blue-50 dark:bg-[rgba(10,132,255,0.12)]"
          iconColor="text-blue-600 dark:text-[#0A84FF]"
        />
        <SummaryCard
          icon={RefreshCw}
          title="MRR"
          value={formatCurrency(billingStats?.mrr)}
          subtitle="Monthly recurring"
          iconBg="bg-violet-50 dark:bg-[rgba(175,82,222,0.12)]"
          iconColor="text-violet-600 dark:text-[#BF5AF2]"
        />
        <SummaryCard
          icon={Clock}
          title="Outstanding"
          value={formatCurrency(billingStats?.pending)}
          subtitle="Unpaid"
          iconBg="bg-amber-50 dark:bg-[rgba(255,214,10,0.12)]"
          iconColor="text-amber-600 dark:text-[#FFD60A]"
          highlight={billingStats?.pending > 0}
        />
        <SummaryCard
          icon={AlertTriangle}
          title="Overdue"
          value={formatCurrency(billingStats?.overdue)}
          subtitle={`${billingStats?.overdueCount || 0} invoices`}
          iconBg="bg-red-50 dark:bg-[rgba(255,69,58,0.12)]"
          iconColor="text-red-600 dark:text-[#FF453A]"
          highlight={billingStats?.overdue > 0}
        />
      </div>

      {/* ─── Revenue Chart ─── */}
      <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-gray-200 dark:border-[#38383A] p-4 sm:p-6">
        <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">Monthly Revenue</h2>
        <div className="h-64 sm:h-72">
          <Bar data={revenueChartData} options={chartOptions} />
        </div>
      </div>

      {/* ─── Invoice List Table ─── */}
      <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-gray-200 dark:border-[#38383A] overflow-hidden">

        {/* Filters */}
        <div className="p-3 sm:p-4 border-b border-gray-200 dark:border-[#38383A]">
          <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center justify-between">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
              Invoices
              {totalCount > 0 && (
                <span className="ml-2 text-sm font-normal text-gray-400 dark:text-[#636366]">({totalCount})</span>
              )}
            </h2>
            <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center w-full lg:w-auto">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-[#636366]" />
                <input
                  type="text"
                  placeholder="Search school or invoice..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="h-11 sm:h-10 rounded-xl border border-gray-200 dark:border-[#38383A] bg-white dark:bg-[#1C1C1E] text-gray-900 dark:text-white pl-9 pr-3 w-full sm:w-52 text-sm placeholder:text-gray-400 dark:placeholder:text-[#636366] focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-[#3EC4B1]"
                />
              </div>
              {/* Status filter */}
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
                className="h-11 sm:h-10 rounded-xl border border-gray-200 dark:border-[#38383A] bg-white dark:bg-[#1C1C1E] text-gray-900 dark:text-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-[#3EC4B1] w-full sm:w-36"
              >
                <option value="">All Status</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="overdue">Overdue</option>
                <option value="cancelled">Cancelled</option>
              </select>
              {/* Plan filter */}
              <input
                type="text"
                placeholder="Plan name..."
                value={planFilter}
                onChange={(e) => { setPlanFilter(e.target.value); setPage(1) }}
                className="h-11 sm:h-10 rounded-xl border border-gray-200 dark:border-[#38383A] bg-white dark:bg-[#1C1C1E] text-gray-900 dark:text-white px-3 text-sm placeholder:text-gray-400 dark:placeholder:text-[#636366] focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-[#3EC4B1] w-full sm:w-32"
              />
              {/* Date from */}
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
                title="From date"
                className="h-11 sm:h-10 rounded-xl border border-gray-200 dark:border-[#38383A] bg-white dark:bg-[#1C1C1E] text-gray-900 dark:text-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-[#3EC4B1] w-full sm:w-36"
              />
              {/* Date to */}
              <input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
                title="To date"
                className="h-11 sm:h-10 rounded-xl border border-gray-200 dark:border-[#38383A] bg-white dark:bg-[#1C1C1E] text-gray-900 dark:text-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-[#3EC4B1] w-full sm:w-36"
              />
            </div>
          </div>
        </div>

        {/* Table */}
        {isLoadingInvoices && !invoices.length ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-200 border-t-primary-500" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="bg-gray-50/80 dark:bg-[#2C2C2E]">
                  <th className="px-3 sm:px-4 py-3 text-left text-[11px] font-semibold uppercase text-gray-500 dark:text-[#8E8E93]">Invoice #</th>
                  <th className="px-3 sm:px-4 py-3 text-left text-[11px] font-semibold uppercase text-gray-500 dark:text-[#8E8E93]">School</th>
                  <th className="px-3 sm:px-4 py-3 text-left text-[11px] font-semibold uppercase text-gray-500 dark:text-[#8E8E93]">Plan</th>
                  <th className="px-3 sm:px-4 py-3 text-left text-[11px] font-semibold uppercase text-gray-500 dark:text-[#8E8E93]">Billing Period</th>
                  <th className="px-3 sm:px-4 py-3 text-right text-[11px] font-semibold uppercase text-gray-500 dark:text-[#8E8E93]">Amount</th>
                  <th className="px-3 sm:px-4 py-3 text-left text-[11px] font-semibold uppercase text-gray-500 dark:text-[#8E8E93]">Status</th>
                  <th className="px-3 sm:px-4 py-3 text-left text-[11px] font-semibold uppercase text-gray-500 dark:text-[#8E8E93]">Due Date</th>
                  <th className="px-3 sm:px-4 py-3 text-center text-[11px] font-semibold uppercase text-gray-500 dark:text-[#8E8E93]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-[#38383A]">
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-4 py-16 text-center">
                      <Receipt className="h-12 w-12 mx-auto mb-3 text-gray-300 dark:text-[#636366]" />
                      <p className="text-base font-medium text-gray-400 dark:text-[#636366]">No invoices found</p>
                      <p className="text-sm mt-1 text-gray-400 dark:text-[#636366]">Create your first invoice to get started</p>
                    </td>
                  </tr>
                ) : invoices.map((inv) => (
                  <tr key={inv._id} className="hover:bg-gray-50 dark:hover:bg-[#2C2C2E] transition-colors">
                    <td className="px-3 sm:px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                      {inv.invoiceNumber || '-'}
                    </td>
                    <td className="px-3 sm:px-4 py-3 text-sm text-primary-600 dark:text-[#3EC4B1] font-medium truncate max-w-[180px]">
                      {inv.tenantId?.schoolName || inv.tenantId?.name || 'N/A'}
                    </td>
                    <td className="px-3 sm:px-4 py-3 text-sm text-gray-600 dark:text-[#8E8E93]">
                      {inv.plan || inv.planName || '-'}
                    </td>
                    <td className="px-3 sm:px-4 py-3 text-sm text-gray-500 dark:text-[#8E8E93]">
                      {inv.billingFrom && inv.billingTo
                        ? `${formatDate(inv.billingFrom)} - ${formatDate(inv.billingTo)}`
                        : '-'}
                    </td>
                    <td className="px-3 sm:px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white text-right">
                      {formatCurrency(inv.totalAmount)}
                    </td>
                    <td className="px-3 sm:px-4 py-3">
                      <StatusBadge status={inv.status} />
                    </td>
                    <td className="px-3 sm:px-4 py-3 text-sm text-gray-500 dark:text-[#8E8E93]">
                      {formatDate(inv.dueDate)}
                    </td>
                    <td className="px-3 sm:px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setViewInvoice(inv)}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-primary-600 hover:bg-gray-100 dark:text-[#8E8E93] dark:hover:text-[#3EC4B1] dark:hover:bg-[#2C2C2E] transition-colors"
                          title="View invoice"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            setViewInvoice(inv)
                            setTimeout(() => handleDownloadPdf(), 500)
                          }}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-primary-600 hover:bg-gray-100 dark:text-[#8E8E93] dark:hover:text-[#3EC4B1] dark:hover:bg-[#2C2C2E] transition-colors"
                          title="Download PDF"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                        {inv.status !== 'paid' && inv.status !== 'cancelled' && (
                          <button
                            onClick={() => setMarkPaidInvoice(inv)}
                            className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:text-[#30D158] dark:hover:bg-[rgba(48,209,88,0.12)] transition-colors"
                            title="Mark as Paid"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-3 sm:px-4 py-3 border-t border-gray-200 dark:border-[#38383A]">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 dark:border-[#38383A] dark:text-white dark:bg-transparent dark:hover:bg-[#2C2C2E] rounded-xl h-10 px-4 text-sm font-semibold active:scale-[0.97] transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:pointer-events-none"
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Previous</span>
            </button>
            <span className="text-sm text-gray-500 dark:text-[#8E8E93]">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 dark:border-[#38383A] dark:text-white dark:bg-transparent dark:hover:bg-[#2C2C2E] rounded-xl h-10 px-4 text-sm font-semibold active:scale-[0.97] transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:pointer-events-none"
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* ═══════════════════════ Invoice Detail Modal ═══════════════════════ */}
      {viewInvoice && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 dark:bg-black/75 backdrop-blur-sm" onClick={() => setViewInvoice(null)}>
          <div
            className="bg-white dark:bg-[#1C1C1E] rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-2xl mx-0 sm:mx-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-[#38383A]">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary-600 dark:text-[#3EC4B1]" />
                Invoice Details
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadPdf}
                  className="border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 dark:border-[#38383A] dark:text-white dark:bg-transparent dark:hover:bg-[#2C2C2E] rounded-xl h-10 px-4 text-sm font-semibold active:scale-[0.97] transition-all flex items-center gap-2"
                >
                  <Printer className="h-4 w-4" />
                  <span className="hidden sm:inline">Download PDF</span>
                </button>
                <button
                  onClick={() => setViewInvoice(null)}
                  className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:text-[#636366] dark:hover:text-white dark:hover:bg-[#2C2C2E] transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modal body */}
            {isLoadingViewInvoice ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-200 border-t-primary-500" />
              </div>
            ) : (
              <div className="p-4 sm:p-6" ref={printRef}>
                {/* Invoice header info */}
                <div className="flex flex-col sm:flex-row justify-between gap-4 mb-6">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-[#8E8E93]">School</p>
                    <p className="text-base font-semibold text-gray-900 dark:text-white">
                      {(viewInvoiceData || viewInvoice)?.tenantId?.schoolName || (viewInvoiceData || viewInvoice)?.tenantId?.name || 'N/A'}
                    </p>
                    {(viewInvoiceData || viewInvoice)?.tenantId?.email && (
                      <p className="text-sm text-gray-500 dark:text-[#8E8E93]">
                        {(viewInvoiceData || viewInvoice).tenantId.email}
                      </p>
                    )}
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-sm text-gray-500 dark:text-[#8E8E93]">Invoice Number</p>
                    <p className="text-base font-semibold text-gray-900 dark:text-white">
                      {(viewInvoiceData || viewInvoice)?.invoiceNumber || '-'}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-[#8E8E93] mt-1">
                      Date: {formatDate((viewInvoiceData || viewInvoice)?.createdAt)}
                    </p>
                  </div>
                </div>

                {/* Details grid */}
                <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-gray-50 dark:bg-[#2C2C2E] rounded-xl">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-[#8E8E93] uppercase font-medium">Plan</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                      {(viewInvoiceData || viewInvoice)?.plan || (viewInvoiceData || viewInvoice)?.planName || '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-[#8E8E93] uppercase font-medium">Status</p>
                    <div className="mt-1">
                      <StatusBadge status={(viewInvoiceData || viewInvoice)?.status} />
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-[#8E8E93] uppercase font-medium">Billing Period</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                      {(viewInvoiceData || viewInvoice)?.billingFrom && (viewInvoiceData || viewInvoice)?.billingTo
                        ? `${formatDate((viewInvoiceData || viewInvoice).billingFrom)} - ${formatDate((viewInvoiceData || viewInvoice).billingTo)}`
                        : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-[#8E8E93] uppercase font-medium">Due Date</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                      {formatDate((viewInvoiceData || viewInvoice)?.dueDate)}
                    </p>
                  </div>
                </div>

                {/* Amount breakdown */}
                <div className="border border-gray-200 dark:border-[#38383A] rounded-xl overflow-hidden mb-6">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50/80 dark:bg-[#2C2C2E]">
                        <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase text-gray-500 dark:text-[#8E8E93]">Description</th>
                        <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase text-gray-500 dark:text-[#8E8E93]">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-[#38383A]">
                      <tr>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                          {(viewInvoiceData || viewInvoice)?.description || 'Subscription charge'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white text-right">
                          {formatCurrency((viewInvoiceData || viewInvoice)?.subtotal || (viewInvoiceData || viewInvoice)?.totalAmount)}
                        </td>
                      </tr>
                      {(viewInvoiceData || viewInvoice)?.tax > 0 && (
                        <tr>
                          <td className="px-4 py-3 text-sm text-gray-500 dark:text-[#8E8E93]">GST (18%)</td>
                          <td className="px-4 py-3 text-sm text-gray-500 dark:text-[#8E8E93] text-right">
                            {formatCurrency((viewInvoiceData || viewInvoice)?.tax)}
                          </td>
                        </tr>
                      )}
                      <tr className="bg-gray-50 dark:bg-[#2C2C2E]">
                        <td className="px-4 py-3 text-sm font-bold text-gray-900 dark:text-white">Total</td>
                        <td className="px-4 py-3 text-sm font-bold text-gray-900 dark:text-white text-right">
                          {formatCurrency((viewInvoiceData || viewInvoice)?.totalAmount)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Payment history */}
                {(viewInvoiceData || viewInvoice)?.paidAt && (
                  <div className="p-4 bg-emerald-50 dark:bg-[rgba(48,209,88,0.08)] rounded-xl">
                    <p className="text-sm font-medium text-emerald-700 dark:text-[#30D158]">
                      Paid on {formatDate((viewInvoiceData || viewInvoice).paidAt)}
                    </p>
                    {(viewInvoiceData || viewInvoice)?.paymentMethod && (
                      <p className="text-sm text-emerald-600 dark:text-[#30D158]/80 mt-1">
                        Method: {(viewInvoiceData || viewInvoice).paymentMethod}
                      </p>
                    )}
                    {(viewInvoiceData || viewInvoice)?.transactionRef && (
                      <p className="text-sm text-emerald-600 dark:text-[#30D158]/80 mt-0.5">
                        Ref: {(viewInvoiceData || viewInvoice).transactionRef}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════ Mark as Paid Modal ═══════════════════════ */}
      {markPaidInvoice && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 dark:bg-black/75 backdrop-blur-sm" onClick={() => setMarkPaidInvoice(null)}>
          <div
            className="bg-white dark:bg-[#1C1C1E] rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-md mx-0 sm:mx-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-[#38383A]">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-[#30D158]" />
                Mark as Paid
              </h2>
              <button
                onClick={() => setMarkPaidInvoice(null)}
                className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:text-[#636366] dark:hover:text-white dark:hover:bg-[#2C2C2E] transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleMarkPaidSubmit} className="p-4 sm:p-6 space-y-4">
              <div className="p-3 bg-gray-50 dark:bg-[#2C2C2E] rounded-xl">
                <p className="text-sm text-gray-500 dark:text-[#8E8E93]">
                  Invoice <span className="font-semibold text-gray-900 dark:text-white">{markPaidInvoice.invoiceNumber}</span> for{' '}
                  <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(markPaidInvoice.totalAmount)}</span>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1.5">
                  <Calendar className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />
                  Payment Date *
                </label>
                <input
                  type="date"
                  value={paidForm.paymentDate}
                  onChange={(e) => setPaidForm(p => ({ ...p, paymentDate: e.target.value }))}
                  required
                  className="h-11 sm:h-10 rounded-xl border border-gray-200 dark:border-[#38383A] bg-white dark:bg-[#1C1C1E] text-gray-900 dark:text-white px-3 w-full text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-[#3EC4B1]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1.5">
                  <CreditCard className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />
                  Payment Method *
                </label>
                <select
                  value={paidForm.paymentMethod}
                  onChange={(e) => setPaidForm(p => ({ ...p, paymentMethod: e.target.value }))}
                  required
                  className="h-11 sm:h-10 rounded-xl border border-gray-200 dark:border-[#38383A] bg-white dark:bg-[#1C1C1E] text-gray-900 dark:text-white px-3 w-full text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-[#3EC4B1]"
                >
                  <option value="razorpay">Razorpay</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cheque">Cheque</option>
                  <option value="upi">UPI</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1.5">
                  <Hash className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />
                  Transaction Reference
                </label>
                <input
                  type="text"
                  value={paidForm.transactionRef}
                  onChange={(e) => setPaidForm(p => ({ ...p, transactionRef: e.target.value }))}
                  placeholder="e.g. TXN_123456789"
                  className="h-11 sm:h-10 rounded-xl border border-gray-200 dark:border-[#38383A] bg-white dark:bg-[#1C1C1E] text-gray-900 dark:text-white px-3 w-full text-sm placeholder:text-gray-400 dark:placeholder:text-[#636366] focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-[#3EC4B1]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1.5">
                  <StickyNote className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />
                  Notes
                </label>
                <textarea
                  value={paidForm.notes}
                  onChange={(e) => setPaidForm(p => ({ ...p, notes: e.target.value }))}
                  placeholder="Optional payment notes..."
                  rows={3}
                  className="rounded-xl border border-gray-200 dark:border-[#38383A] bg-white dark:bg-[#1C1C1E] text-gray-900 dark:text-white px-3 py-2.5 w-full text-sm placeholder:text-gray-400 dark:placeholder:text-[#636366] focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-[#3EC4B1] resize-none"
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setMarkPaidInvoice(null)}
                  className="border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 dark:border-[#38383A] dark:text-white dark:bg-transparent dark:hover:bg-[#2C2C2E] rounded-xl h-10 px-4 text-sm font-semibold active:scale-[0.97] transition-all w-full sm:w-auto"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={markPaidMutation.isPending}
                  className="bg-primary-600 text-white hover:bg-primary-500 dark:bg-[#3EC4B1] dark:text-black dark:hover:bg-[#35a89a] rounded-xl h-10 px-4 text-sm font-semibold active:scale-[0.97] transition-all flex items-center justify-center gap-2 w-full sm:w-auto disabled:opacity-60"
                >
                  {markPaidMutation.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4" />
                      Confirm Payment
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════ Generate Invoice Modal ═══════════════════════ */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 dark:bg-black/75 backdrop-blur-sm" onClick={() => setShowCreateModal(false)}>
          <div
            className="bg-white dark:bg-[#1C1C1E] rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-lg mx-0 sm:mx-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-[#38383A]">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Receipt className="h-5 w-5 text-primary-600 dark:text-[#3EC4B1]" />
                Generate Invoice
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:text-[#636366] dark:hover:text-white dark:hover:bg-[#2C2C2E] transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-4 sm:p-6 space-y-4">
              {/* Select school */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1.5">
                  <Building2 className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />
                  School *
                </label>
                <select
                  value={createForm.tenantId}
                  onChange={(e) => {
                    const tenant = (tenantsData || []).find(t => t._id === e.target.value)
                    setCreateForm(p => ({
                      ...p,
                      tenantId: e.target.value,
                      plan: tenant?.plan?.name || tenant?.planName || '',
                      amount: tenant?.plan?.price || tenant?.planPrice || p.amount
                    }))
                  }}
                  required
                  className="h-11 sm:h-10 rounded-xl border border-gray-200 dark:border-[#38383A] bg-white dark:bg-[#1C1C1E] text-gray-900 dark:text-white px-3 w-full text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-[#3EC4B1]"
                >
                  <option value="">Select a school...</option>
                  {(tenantsData || []).map(t => (
                    <option key={t._id} value={t._id}>
                      {t.schoolName || t.name} {t.plan?.name ? `(${t.plan.name})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Plan */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1.5">
                  Plan
                </label>
                <input
                  type="text"
                  value={createForm.plan}
                  onChange={(e) => setCreateForm(p => ({ ...p, plan: e.target.value }))}
                  placeholder="e.g. Starter, Pro, Enterprise"
                  className="h-11 sm:h-10 rounded-xl border border-gray-200 dark:border-[#38383A] bg-white dark:bg-[#1C1C1E] text-gray-900 dark:text-white px-3 w-full text-sm placeholder:text-gray-400 dark:placeholder:text-[#636366] focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-[#3EC4B1]"
                />
              </div>

              {/* Billing period */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1.5">
                    Billing From
                  </label>
                  <input
                    type="date"
                    value={createForm.billingFrom}
                    onChange={(e) => setCreateForm(p => ({ ...p, billingFrom: e.target.value }))}
                    className="h-11 sm:h-10 rounded-xl border border-gray-200 dark:border-[#38383A] bg-white dark:bg-[#1C1C1E] text-gray-900 dark:text-white px-3 w-full text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-[#3EC4B1]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1.5">
                    Billing To
                  </label>
                  <input
                    type="date"
                    value={createForm.billingTo}
                    onChange={(e) => setCreateForm(p => ({ ...p, billingTo: e.target.value }))}
                    className="h-11 sm:h-10 rounded-xl border border-gray-200 dark:border-[#38383A] bg-white dark:bg-[#1C1C1E] text-gray-900 dark:text-white px-3 w-full text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-[#3EC4B1]"
                  />
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1.5">
                  <Banknote className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />
                  Amount (INR) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 dark:text-[#8E8E93]">{'\u20B9'}</span>
                  <input
                    type="number"
                    value={createForm.amount}
                    onChange={(e) => setCreateForm(p => ({ ...p, amount: e.target.value }))}
                    placeholder="0"
                    required
                    min="1"
                    className="h-11 sm:h-10 rounded-xl border border-gray-200 dark:border-[#38383A] bg-white dark:bg-[#1C1C1E] text-gray-900 dark:text-white pl-7 pr-3 w-full text-sm placeholder:text-gray-400 dark:placeholder:text-[#636366] focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-[#3EC4B1]"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1.5">
                  Description
                </label>
                <input
                  type="text"
                  value={createForm.description}
                  onChange={(e) => setCreateForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Monthly subscription charge"
                  className="h-11 sm:h-10 rounded-xl border border-gray-200 dark:border-[#38383A] bg-white dark:bg-[#1C1C1E] text-gray-900 dark:text-white px-3 w-full text-sm placeholder:text-gray-400 dark:placeholder:text-[#636366] focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-[#3EC4B1]"
                />
              </div>

              {/* Due date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1.5">
                  <CalendarClock className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />
                  Due Date
                </label>
                <input
                  type="date"
                  value={createForm.dueDate}
                  onChange={(e) => setCreateForm(p => ({ ...p, dueDate: e.target.value }))}
                  className="h-11 sm:h-10 rounded-xl border border-gray-200 dark:border-[#38383A] bg-white dark:bg-[#1C1C1E] text-gray-900 dark:text-white px-3 w-full text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-[#3EC4B1]"
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 dark:border-[#38383A] dark:text-white dark:bg-transparent dark:hover:bg-[#2C2C2E] rounded-xl h-10 px-4 text-sm font-semibold active:scale-[0.97] transition-all w-full sm:w-auto"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createInvoiceMutation.isPending}
                  className="bg-primary-600 text-white hover:bg-primary-500 dark:bg-[#3EC4B1] dark:text-black dark:hover:bg-[#35a89a] rounded-xl h-10 px-4 text-sm font-semibold active:scale-[0.97] transition-all flex items-center justify-center gap-2 w-full sm:w-auto disabled:opacity-60"
                >
                  {createInvoiceMutation.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      Generate Invoice
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────── Summary Card ─────────────────────────── */
const SummaryCard = ({ icon: Icon, title, value, subtitle, iconBg, iconColor, highlight }) => (
  <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-gray-200 dark:border-[#38383A] p-3 sm:p-5">
    <div className="flex items-center gap-2.5 sm:gap-3">
      <div className={`p-2 sm:p-2.5 rounded-xl ${iconBg} flex-shrink-0`}>
        <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${iconColor}`} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] sm:text-xs font-medium text-gray-500 dark:text-[#8E8E93] truncate">{title}</p>
        <p className={`text-base sm:text-xl font-bold mt-0.5 ${highlight ? 'text-red-600 dark:text-[#FF453A]' : 'text-gray-900 dark:text-white'}`}>
          {value}
        </p>
        {subtitle && (
          <p className="text-[10px] sm:text-xs text-gray-400 dark:text-[#636366]">{subtitle}</p>
        )}
      </div>
    </div>
  </div>
)

export default Billing
