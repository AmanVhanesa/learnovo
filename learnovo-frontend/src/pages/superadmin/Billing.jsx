import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { superAdminService } from '../../services/superAdminService'
import toast from 'react-hot-toast'
import {
  Receipt, IndianRupee, Clock, AlertTriangle, RefreshCw,
  Search, Filter, Download, Eye, CheckCircle, XCircle,
  ChevronLeft, ChevronRight, Plus, CreditCard
} from 'lucide-react'

const statusColors = {
  paid: 'bg-emerald-100 text-emerald-700',
  sent: 'bg-blue-100 text-blue-700',
  draft: 'bg-gray-100 text-gray-600',
  overdue: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
  refunded: 'bg-amber-100 text-amber-700',
  partially_refunded: 'bg-amber-100 text-amber-700'
}

const Billing = () => {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(null)

  const { data: billingStats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['superadmin-billing-stats'],
    queryFn: async () => { const res = await superAdminService.getBillingDashboard(); return res.data },
  })

  const { data: invoicesData, isLoading: isLoadingInvoices, error, refetch } = useQuery({
    queryKey: ['superadmin-invoices', page, statusFilter, search],
    queryFn: async () => {
      const res = await superAdminService.getInvoices({ page, limit: 15, status: statusFilter || undefined, search: search || undefined })
      return { invoices: res.data || [], totalPages: res.pagination?.pages || 1 }
    },
  })

  const invoices = invoicesData?.invoices || []
  const totalPages = invoicesData?.totalPages || 1
  const isLoading = isLoadingStats || isLoadingInvoices

  const markPaidMutation = useMutation({
    mutationFn: ({ id, data }) => superAdminService.updateInvoice(id, data),
    onSuccess: () => { toast.success('Invoice marked as paid'); queryClient.invalidateQueries({ queryKey: ['superadmin-invoices'] }); queryClient.invalidateQueries({ queryKey: ['superadmin-billing-stats'] }) },
    onError: () => { toast.error('Failed to update invoice') },
  })

  const handleMarkPaid = async (invoice) => {
    if (!confirm(`Mark invoice ${invoice.invoiceNumber} as paid?`)) return
    markPaidMutation.mutate({ id: invoice._id, data: { status: 'paid', paymentMethod: 'bank_transfer', paidAt: new Date().toISOString() } })
  }

  const formatCurrency = (amount) => `\u20B9${(amount || 0).toLocaleString('en-IN')}`

  if (isLoading && !billingStats) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="h-8 w-48 bg-gray-200 dark:bg-[#2C2C2E] rounded animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">{[1,2,3,4].map(i => <div key={i} className="h-24 sm:h-28 bg-gray-200 dark:bg-[#2C2C2E] rounded-2xl animate-pulse" />)}</div>
        <div className="h-64 sm:h-96 bg-gray-200 dark:bg-[#2C2C2E] rounded-2xl animate-pulse" />
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
        <div><h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Billing & Payments</h1><p className="text-sm text-gray-500 dark:text-[#8E8E93] mt-1">Manage invoices, payments, and revenue tracking</p></div>
        <button onClick={() => setShowCreateModal(true)} className="btn btn-primary flex items-center gap-2 w-full sm:w-auto"><Plus className="h-4 w-4" /> Create Invoice</button>
      </div>
      {error && (<div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 sm:p-4 flex items-center justify-between"><p className="text-sm text-red-700 dark:text-red-400 truncate">{error.response?.data?.message || error.message || 'Failed to load billing data'}</p><button onClick={() => refetch()} className="text-red-600 hover:text-red-800 flex-shrink-0"><RefreshCw className="h-4 w-4" /></button></div>)}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard icon={IndianRupee} title="Collected This Month" value={formatCurrency(billingStats?.collectedThisMonth)} color="emerald" />
        <KpiCard icon={Clock} title="Pending" value={formatCurrency(billingStats?.pending)} color="blue" />
        <KpiCard icon={AlertTriangle} title="Overdue" value={formatCurrency(billingStats?.overdue)} subtitle={`${billingStats?.overdueCount || 0} invoices`} color="red" />
        <KpiCard icon={RefreshCw} title="Upcoming Renewals" value={billingStats?.upcomingRenewals || 0} subtitle="this month" color="amber" />
      </div>
      <div className="card">
        <div className="p-3 sm:p-4 border-b border-gray-100 dark:border-[#38383A] flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Invoices</h2>
          <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center w-full sm:w-auto">
            <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" /><input type="text" placeholder="Search invoices..." value={searchInput} onChange={(e) => setSearchInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && setSearch(searchInput)} className="input pl-9 w-full sm:w-48" /></div>
            <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }} className="input w-full sm:w-36"><option value="">All Status</option><option value="draft">Draft</option><option value="sent">Sent</option><option value="paid">Paid</option><option value="overdue">Overdue</option><option value="refunded">Refunded</option></select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead><tr className="bg-gray-50 dark:bg-[#2C2C2E] border-b border-gray-100 dark:border-[#38383A]"><th className="px-3 sm:px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-[#8E8E93] uppercase">Invoice #</th><th className="px-3 sm:px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-[#8E8E93] uppercase">School</th><th className="px-3 sm:px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-[#8E8E93] uppercase">Amount</th><th className="px-3 sm:px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-[#8E8E93] uppercase">Status</th><th className="px-3 sm:px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-[#8E8E93] uppercase">Due Date</th><th className="px-3 sm:px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-[#8E8E93] uppercase">Payment</th><th className="px-3 sm:px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-[#8E8E93] uppercase">Actions</th></tr></thead>
            <tbody className="divide-y divide-gray-50 dark:divide-[#38383A]">
              {invoices.length === 0 ? (
                <tr><td colSpan="7" className="px-4 py-12 text-center text-gray-400 dark:text-[#636366]"><Receipt className="h-12 w-12 mx-auto mb-3 text-gray-300 dark:text-[#636366]" /><p className="text-lg font-medium">No invoices found</p><p className="text-sm mt-1">Create your first invoice to get started</p></td></tr>
              ) : invoices.map((inv) => (
                <tr key={inv._id} className="hover:bg-gray-50 dark:hover:bg-[#2C2C2E] transition-colors">
                  <td className="px-3 sm:px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{inv.invoiceNumber}</td>
                  <td className="px-3 sm:px-4 py-3 text-sm text-gray-600 dark:text-[#8E8E93]">{inv.tenantId?.schoolName || 'N/A'}</td>
                  <td className="px-3 sm:px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(inv.totalAmount)}</td>
                  <td className="px-3 sm:px-4 py-3"><span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[inv.status] || 'bg-gray-100 text-gray-600'}`}>{inv.status}</span></td>
                  <td className="px-3 sm:px-4 py-3 text-sm text-gray-500 dark:text-[#8E8E93]">{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : '-'}</td>
                  <td className="px-3 sm:px-4 py-3 text-sm text-gray-500 dark:text-[#8E8E93]">{inv.paymentMethod || '-'}</td>
                  <td className="px-3 sm:px-4 py-3"><div className="flex items-center gap-1">{inv.status !== 'paid' && inv.status !== 'cancelled' && (<button onClick={() => handleMarkPaid(inv)} className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50" title="Mark as Paid"><CheckCircle className="h-4 w-4" /></button>)}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-3 sm:px-4 py-3 border-t border-gray-100 dark:border-[#38383A]">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn btn-outline btn-sm flex items-center gap-1 disabled:opacity-50"><ChevronLeft className="h-4 w-4" /> <span className="hidden sm:inline">Previous</span></button>
            <span className="text-sm text-gray-500 dark:text-[#8E8E93]">Page {page} of {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn btn-outline btn-sm flex items-center gap-1 disabled:opacity-50"><span className="hidden sm:inline">Next</span> <ChevronRight className="h-4 w-4" /></button>
          </div>
        )}
      </div>
    </div>
  )
}

const KpiCard = ({ icon: Icon, title, value, subtitle, color }) => {
  const colorMap = { emerald: 'bg-emerald-50 text-emerald-600', blue: 'bg-blue-50 text-blue-600', red: 'bg-red-50 text-red-600', amber: 'bg-amber-50 text-amber-600' }
  return (
    <div className="card p-3 sm:p-5"><div className="flex items-center gap-2 sm:gap-3"><div className={`p-2 sm:p-2.5 rounded-xl ${colorMap[color]} flex-shrink-0`}><Icon className="h-4 w-4 sm:h-5 sm:w-5" /></div><div className="min-w-0"><p className="text-[10px] sm:text-xs font-medium text-gray-500 dark:text-[#8E8E93] truncate">{title}</p><p className="text-base sm:text-xl font-bold text-gray-900 dark:text-white mt-0.5">{value}</p>{subtitle && <p className="text-[10px] sm:text-xs text-gray-400 dark:text-[#636366]">{subtitle}</p>}</div></div></div>
  )
}

export default Billing
