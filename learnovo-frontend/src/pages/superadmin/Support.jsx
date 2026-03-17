import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { superAdminService } from '../../services/superAdminService'
import toast from 'react-hot-toast'
import { LifeBuoy, RefreshCw, Search, Filter, MessageSquare, ChevronLeft, ChevronRight, Clock, AlertCircle, CheckCircle2, XCircle, ArrowUpRight, Send, X } from 'lucide-react'

const priorityColors = { low: 'bg-gray-100 text-gray-600', medium: 'bg-blue-100 text-blue-700', high: 'bg-amber-100 text-amber-700', critical: 'bg-red-100 text-red-700' }
const statusColors = { open: 'bg-blue-100 text-blue-700', in_progress: 'bg-amber-100 text-amber-700', waiting_on_customer: 'bg-purple-100 text-purple-700', resolved: 'bg-emerald-100 text-emerald-700', closed: 'bg-gray-100 text-gray-500' }

const Support = () => {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [replyText, setReplyText] = useState('')

  const { data: stats } = useQuery({
    queryKey: ['superadmin-support-stats'],
    queryFn: async () => { const res = await superAdminService.getSupportStats(); return res.data },
  })

  const { data: ticketsData, isLoading, error, refetch } = useQuery({
    queryKey: ['superadmin-support-tickets', page, statusFilter, priorityFilter],
    queryFn: async () => {
      const res = await superAdminService.getSupportTickets({ page, limit: 15, status: statusFilter || undefined, priority: priorityFilter || undefined })
      return { tickets: res.data || [], totalPages: res.pagination?.pages || 1 }
    },
  })

  const tickets = ticketsData?.tickets || []
  const totalPages = ticketsData?.totalPages || 1

  const handleViewTicket = async (ticketId) => {
    try { const res = await superAdminService.getSupportTicketById(ticketId); setSelectedTicket(res.data) }
    catch (err) { toast.error('Failed to load ticket details') }
  }

  const replyMutation = useMutation({
    mutationFn: ({ id, data }) => superAdminService.replySupportTicket(id, data),
    onSuccess: () => { toast.success('Reply sent'); setReplyText(''); handleViewTicket(selectedTicket._id) },
    onError: () => { toast.error('Failed to send reply') },
  })

  const statusChangeMutation = useMutation({
    mutationFn: ({ id, data }) => superAdminService.updateSupportTicket(id, data),
    onSuccess: (_, variables) => {
      toast.success(`Ticket ${variables.data.status.replace('_', ' ')}`)
      queryClient.invalidateQueries({ queryKey: ['superadmin-support-tickets'] })
      queryClient.invalidateQueries({ queryKey: ['superadmin-support-stats'] })
      if (selectedTicket?._id === variables.id) handleViewTicket(variables.id)
    },
    onError: () => { toast.error('Failed to update status') },
  })

  const handleReply = async () => { if (!replyText.trim()) return; replyMutation.mutate({ id: selectedTicket._id, data: { message: replyText } }) }
  const handleStatusChange = async (ticketId, newStatus) => { statusChangeMutation.mutate({ id: ticketId, data: { status: newStatus } }) }
  const formatTime = (ms) => { if (!ms) return 'N/A'; const hours = Math.round(ms / (1000 * 60 * 60)); if (hours < 24) return `${hours}h`; return `${Math.round(hours / 24)}d` }

  if (isLoading && !stats) {
    return (<div className="space-y-4 sm:space-y-6"><div className="h-8 w-48 bg-gray-200 dark:bg-[#2C2C2E] rounded animate-pulse" /><div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">{[1,2,3,4].map(i => <div key={i} className="h-20 sm:h-24 bg-gray-200 dark:bg-[#2C2C2E] rounded-2xl animate-pulse" />)}</div><div className="h-64 sm:h-96 bg-gray-200 dark:bg-[#2C2C2E] rounded-2xl animate-pulse" /></div>)
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div><h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Support & Helpdesk</h1><p className="text-sm text-gray-500 dark:text-[#8E8E93] mt-1">Manage support tickets and track SLA metrics</p></div>
      {error && (<div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 sm:p-4 flex items-center justify-between"><p className="text-sm text-red-700 dark:text-red-400 truncate">{error.response?.data?.message || error.message || 'Failed to load support data'}</p><button onClick={() => refetch()} className="text-red-600 hover:text-red-800 flex-shrink-0"><RefreshCw className="h-4 w-4" /></button></div>)}

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="card p-3 sm:p-4 flex items-center gap-2 sm:gap-3"><div className="p-1.5 sm:p-2 rounded-xl bg-blue-50 text-blue-600 flex-shrink-0"><MessageSquare className="h-4 w-4 sm:h-5 sm:w-5" /></div><div className="min-w-0"><p className="text-[10px] sm:text-xs text-gray-500 dark:text-[#8E8E93] truncate">Open Tickets</p><p className="text-base sm:text-xl font-bold dark:text-white">{stats.byStatus?.find(s => s._id === 'open')?.count || 0}</p></div></div>
          <div className="card p-3 sm:p-4 flex items-center gap-2 sm:gap-3"><div className="p-1.5 sm:p-2 rounded-xl bg-amber-50 text-amber-600 flex-shrink-0"><Clock className="h-4 w-4 sm:h-5 sm:w-5" /></div><div className="min-w-0"><p className="text-[10px] sm:text-xs text-gray-500 dark:text-[#8E8E93] truncate">In Progress</p><p className="text-base sm:text-xl font-bold dark:text-white">{stats.byStatus?.find(s => s._id === 'in_progress')?.count || 0}</p></div></div>
          <div className="card p-3 sm:p-4 flex items-center gap-2 sm:gap-3"><div className="p-1.5 sm:p-2 rounded-xl bg-emerald-50 text-emerald-600 flex-shrink-0"><CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5" /></div><div className="min-w-0"><p className="text-[10px] sm:text-xs text-gray-500 dark:text-[#8E8E93] truncate">Resolved</p><p className="text-base sm:text-xl font-bold dark:text-white">{stats.byStatus?.find(s => s._id === 'resolved')?.count || 0}</p></div></div>
          <div className="card p-3 sm:p-4 flex items-center gap-2 sm:gap-3"><div className="p-1.5 sm:p-2 rounded-xl bg-purple-50 text-purple-600 flex-shrink-0"><ArrowUpRight className="h-4 w-4 sm:h-5 sm:w-5" /></div><div className="min-w-0"><p className="text-[10px] sm:text-xs text-gray-500 dark:text-[#8E8E93] truncate">Avg Response</p><p className="text-base sm:text-xl font-bold dark:text-white">{formatTime(stats.avgResponseTimeMs)}</p></div></div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-4 sm:gap-6">
        <div className="flex-1 min-w-0">
          <div className="card">
            <div className="p-3 sm:p-4 border-b border-gray-100 dark:border-[#38383A] flex flex-col sm:flex-row flex-wrap gap-2">
              <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }} className="input w-full sm:w-36 text-sm"><option value="">All Status</option><option value="open">Open</option><option value="in_progress">In Progress</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select>
              <select value={priorityFilter} onChange={(e) => { setPriorityFilter(e.target.value); setPage(1) }} className="input w-full sm:w-36 text-sm"><option value="">All Priority</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select>
            </div>
            <div className="divide-y divide-gray-50 dark:divide-[#38383A]">
              {tickets.length === 0 ? (<div className="p-8 sm:p-12 text-center"><LifeBuoy className="h-12 w-12 mx-auto text-gray-300 dark:text-[#636366] mb-3" /><p className="text-lg font-medium text-gray-400 dark:text-[#636366]">No tickets found</p></div>
              ) : tickets.map((ticket) => (
                <div key={ticket._id} onClick={() => handleViewTicket(ticket._id)} className={`p-3 sm:p-4 hover:bg-gray-50 dark:hover:bg-[#2C2C2E] cursor-pointer transition-colors ${selectedTicket?._id === ticket._id ? 'bg-primary-50/50 dark:bg-primary-900/20' : ''}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1"><span className="text-xs font-mono text-gray-400">{ticket.ticketNumber}</span><span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${priorityColors[ticket.priority]}`}>{ticket.priority}</span><span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${statusColors[ticket.status]}`}>{ticket.status?.replace('_', ' ')}</span></div>
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{ticket.subject}</h4>
                      <p className="text-xs text-gray-500 dark:text-[#8E8E93] mt-0.5 truncate">{ticket.tenantId?.schoolName || 'Unknown school'} &middot; {ticket.category} &middot; {new Date(ticket.createdAt).toLocaleDateString()}</p>
                    </div>
                    <span className="text-xs text-gray-400 flex items-center gap-1 flex-shrink-0"><MessageSquare className="h-3 w-3" />{ticket.messages?.length || 0}</span>
                  </div>
                </div>
              ))}
            </div>
            {totalPages > 1 && (<div className="flex items-center justify-between px-3 sm:px-4 py-3 border-t border-gray-100 dark:border-[#38383A]"><button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn btn-outline btn-sm disabled:opacity-50"><ChevronLeft className="h-4 w-4" /></button><span className="text-xs text-gray-500">Page {page} of {totalPages}</span><button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn btn-outline btn-sm disabled:opacity-50"><ChevronRight className="h-4 w-4" /></button></div>)}
          </div>
        </div>

        {selectedTicket && (
          <>
            <div className="fixed inset-0 z-50 bg-black/50 lg:hidden" onClick={() => setSelectedTicket(null)} />
            <div className="fixed inset-x-0 bottom-0 top-12 z-50 lg:relative lg:inset-auto lg:z-auto w-full lg:w-[400px] card rounded-t-2xl lg:rounded-2xl overflow-hidden flex flex-col">
              <div className="p-3 sm:p-4 border-b border-gray-100 dark:border-[#38383A]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono text-gray-400 dark:text-[#636366]">{selectedTicket.ticketNumber}</span>
                  <div className="flex items-center gap-2">
                    <select value={selectedTicket.status} onChange={(e) => handleStatusChange(selectedTicket._id, e.target.value)} className="input text-xs py-1 px-2 w-auto"><option value="open">Open</option><option value="in_progress">In Progress</option><option value="waiting_on_customer">Waiting on Customer</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select>
                    <button onClick={() => setSelectedTicket(null)} className="lg:hidden p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-[#2C2C2E]"><X className="h-5 w-5" /></button>
                  </div>
                </div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">{selectedTicket.subject}</h3>
                <p className="text-xs text-gray-500 dark:text-[#8E8E93] mt-1">{selectedTicket.tenantId?.schoolName} &middot; {selectedTicket.category} &middot; {selectedTicket.priority}</p>
              </div>
              <div className="p-3 sm:p-4 space-y-3 flex-1 overflow-y-auto">
                <div className="bg-gray-50 dark:bg-[#2C2C2E] rounded-lg p-3"><p className="text-xs font-medium text-gray-600 dark:text-[#8E8E93] mb-1">{selectedTicket.createdBy?.name || 'Tenant'}</p><p className="text-sm text-gray-800 dark:text-white">{selectedTicket.description}</p></div>
                {selectedTicket.messages?.map((msg, i) => (<div key={i} className={`rounded-lg p-3 ${msg.sender === 'superadmin' ? 'bg-primary-50 dark:bg-primary-900/20 ml-4' : 'bg-gray-50 dark:bg-[#2C2C2E] mr-4'}`}><p className="text-xs font-medium text-gray-600 dark:text-[#8E8E93] mb-1">{msg.senderName || msg.sender} {msg.isInternal && <span className="text-amber-600">(Internal)</span>}</p><p className="text-sm text-gray-800 dark:text-white">{msg.message}</p><p className="text-[10px] text-gray-400 dark:text-[#636366] mt-1">{new Date(msg.createdAt).toLocaleString()}</p></div>))}
              </div>
              <div className="p-3 sm:p-4 border-t border-gray-100 dark:border-[#38383A]"><div className="flex gap-2"><input type="text" value={replyText} onChange={(e) => setReplyText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleReply()} placeholder="Type your reply..." className="input flex-1 text-sm" /><button onClick={handleReply} disabled={!replyText.trim()} className="btn btn-primary p-2 disabled:opacity-50 flex-shrink-0"><Send className="h-4 w-4" /></button></div></div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default Support
