import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { superAdminService } from '../../services/superAdminService'
import toast from 'react-hot-toast'
import { Megaphone, Mail, Plus, RefreshCw, Search, Send, Eye, Trash2, Edit2, Clock, CheckCircle, ChevronLeft, ChevronRight, FileText } from 'lucide-react'

const tabs = [
  { id: 'announcements', label: 'Announcements', icon: Megaphone },
  { id: 'email-templates', label: 'Email Templates', icon: Mail }
]

const Communication = () => {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('announcements')
  const [page, setPage] = useState(1)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newAnnouncement, setNewAnnouncement] = useState({ title: '', body: '', targetType: 'all', channels: { inApp: true, email: false, sms: false } })

  const { data: announcementsData, isLoading: isLoadingAnn, error: annError, refetch: refetchAnn } = useQuery({
    queryKey: ['superadmin-announcements', page],
    queryFn: async () => { const res = await superAdminService.getAnnouncements({ page, limit: 15 }); return { announcements: res.data || [], totalPages: res.pagination?.pages || 1 } },
    enabled: activeTab === 'announcements',
  })

  const { data: templates = [], isLoading: isLoadingTmpl, error: tmplError, refetch: refetchTmpl } = useQuery({
    queryKey: ['superadmin-email-templates'],
    queryFn: async () => { const res = await superAdminService.getEmailTemplates(); return res.data || [] },
    enabled: activeTab === 'email-templates',
  })

  const announcements = announcementsData?.announcements || []
  const totalPages = announcementsData?.totalPages || 1
  const isLoading = activeTab === 'announcements' ? isLoadingAnn : isLoadingTmpl
  const error = activeTab === 'announcements' ? annError : tmplError

  const createAnnouncementMutation = useMutation({
    mutationFn: (data) => superAdminService.createAnnouncement(data),
    onSuccess: () => { toast.success('Announcement sent successfully'); setShowCreateModal(false); setNewAnnouncement({ title: '', body: '', targetType: 'all', channels: { inApp: true, email: false, sms: false } }); queryClient.invalidateQueries({ queryKey: ['superadmin-announcements'] }) },
    onError: (err) => { toast.error(err.response?.data?.message || 'Failed to create announcement') },
  })

  const deleteAnnouncementMutation = useMutation({
    mutationFn: (id) => superAdminService.deleteAnnouncement(id),
    onSuccess: () => { toast.success('Announcement deleted'); queryClient.invalidateQueries({ queryKey: ['superadmin-announcements'] }) },
    onError: () => { toast.error('Failed to delete') },
  })

  const handleCreateAnnouncement = async (e) => { e.preventDefault(); if (!newAnnouncement.title || !newAnnouncement.body) { toast.error('Title and body are required'); return }; createAnnouncementMutation.mutate(newAnnouncement) }
  const handleDeleteAnnouncement = async (id) => { if (!confirm('Delete this announcement?')) return; deleteAnnouncementMutation.mutate(id) }
  const handleRefetch = () => { if (activeTab === 'announcements') refetchAnn(); else refetchTmpl() }

  const statusColors = { draft: 'bg-gray-100 text-gray-600', scheduled: 'bg-blue-100 text-blue-700', sent: 'bg-emerald-100 text-emerald-700', cancelled: 'bg-red-100 text-red-700' }

  if (isLoading && announcements.length === 0 && templates.length === 0) {
    return (<div className="space-y-4 sm:space-y-6"><div className="h-8 w-48 bg-gray-200 dark:bg-[#2C2C2E] rounded animate-pulse" /><div className="h-12 bg-gray-200 dark:bg-[#2C2C2E] rounded-xl animate-pulse" /><div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-gray-200 dark:bg-[#2C2C2E] rounded-2xl animate-pulse" />)}</div></div>)
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
        <div><h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Communication</h1><p className="text-sm text-gray-500 dark:text-[#8E8E93] mt-1">Manage platform announcements and email templates</p></div>
        {activeTab === 'announcements' && (<button onClick={() => setShowCreateModal(true)} className="btn btn-primary flex items-center gap-2 w-full sm:w-auto"><Plus className="h-4 w-4" /> New Announcement</button>)}
      </div>

      {error && (<div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 sm:p-4 flex items-center justify-between"><p className="text-sm text-red-700 dark:text-red-400 truncate">{error.response?.data?.message || error.message || 'Failed to load data'}</p><button onClick={handleRefetch} className="text-red-600 hover:text-red-800 flex-shrink-0"><RefreshCw className="h-4 w-4" /></button></div>)}

      <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
        <div className="flex gap-1 bg-gray-100 dark:bg-[#2C2C2E] p-1 rounded-xl w-fit whitespace-nowrap">
          {tabs.map(tab => (<button key={tab.id} onClick={() => { setActiveTab(tab.id); setPage(1) }} className={`flex items-center gap-2 px-3 sm:px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === tab.id ? 'bg-white dark:bg-[#1C1C1E] text-primary-700 shadow-sm' : 'text-gray-500 dark:text-[#8E8E93] hover:text-gray-700 dark:hover:text-white'}`}><tab.icon className="h-4 w-4" />{tab.label}</button>))}
        </div>
      </div>

      {activeTab === 'announcements' && (
        <div className="space-y-3">
          {announcements.length === 0 ? (
            <div className="card p-8 sm:p-12 text-center"><Megaphone className="h-12 w-12 mx-auto text-gray-300 dark:text-[#636366] mb-3" /><p className="text-lg font-medium text-gray-400 dark:text-[#636366]">No announcements yet</p><p className="text-sm text-gray-400 dark:text-[#636366] mt-1">Send your first platform announcement</p></div>
          ) : announcements.map((ann) => (
            <div key={ann._id} className="card p-3 sm:p-4 hover:shadow-glass-md transition-shadow">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1"><h3 className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base">{ann.title}</h3><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusColors[ann.status]}`}>{ann.status}</span></div>
                  <p className="text-sm text-gray-500 dark:text-[#8E8E93] line-clamp-2">{ann.body?.replace(/<[^>]*>/g, '').slice(0, 200)}</p>
                  <div className="flex flex-wrap items-center gap-3 sm:gap-4 mt-2 text-xs text-gray-400 dark:text-[#636366]"><span>Target: {ann.targetType}</span>{ann.channels?.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> Email</span>}{ann.channels?.sms && <span>SMS</span>}<span>{new Date(ann.createdAt).toLocaleDateString()}</span></div>
                </div>
                <button onClick={() => handleDeleteAnnouncement(ann._id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 flex-shrink-0"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'email-templates' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {templates.length === 0 ? (
            <div className="col-span-full card p-8 sm:p-12 text-center"><Mail className="h-12 w-12 mx-auto text-gray-300 dark:text-[#636366] mb-3" /><p className="text-lg font-medium text-gray-400 dark:text-[#636366]">No email templates</p></div>
          ) : templates.map((tmpl) => (
            <div key={tmpl._id} className="card p-4 sm:p-5 hover:shadow-glass-md transition-shadow">
              <div className="flex items-center gap-2 mb-2"><FileText className="h-4 w-4 text-primary-500" /><h3 className="text-sm font-semibold text-gray-900 dark:text-white">{tmpl.name}</h3></div>
              <p className="text-xs text-gray-500 dark:text-[#8E8E93] mb-1">Type: {tmpl.type}</p><p className="text-xs text-gray-400 dark:text-[#636366]">Subject: {tmpl.subject}</p>
              {tmpl.variables?.length > 0 && (<div className="flex flex-wrap gap-1 mt-2">{tmpl.variables.map(v => (<span key={v} className="text-[10px] bg-gray-100 dark:bg-[#2C2C2E] text-gray-500 dark:text-[#8E8E93] px-1.5 py-0.5 rounded">{`{{${v}}}`}</span>))}</div>)}
            </div>
          ))}
        </div>
      )}

      {activeTab === 'announcements' && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn btn-outline btn-sm flex items-center gap-1 disabled:opacity-50"><ChevronLeft className="h-4 w-4" /> <span className="hidden sm:inline">Previous</span></button>
          <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn btn-outline btn-sm flex items-center gap-1 disabled:opacity-50"><span className="hidden sm:inline">Next</span> <ChevronRight className="h-4 w-4" /></button>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#1C1C1E] rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-lg mx-0 sm:mx-4 p-4 sm:p-6 animate-scale-in max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">New Announcement</h2>
            <form onSubmit={handleCreateAnnouncement} className="space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">Title *</label><input type="text" value={newAnnouncement.title} onChange={e => setNewAnnouncement(p => ({ ...p, title: e.target.value }))} className="input w-full" required /></div>
              <div><label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">Message *</label><textarea value={newAnnouncement.body} onChange={e => setNewAnnouncement(p => ({ ...p, body: e.target.value }))} className="input w-full h-32 resize-none" required /></div>
              <div><label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">Target</label><select value={newAnnouncement.targetType} onChange={e => setNewAnnouncement(p => ({ ...p, targetType: e.target.value }))} className="input w-full"><option value="all">All Tenants</option><option value="plan_based">By Plan</option></select></div>
              <div><label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-2">Channels</label><div className="flex flex-wrap gap-4">{['inApp', 'email', 'sms'].map(ch => (<label key={ch} className="flex items-center gap-2 text-sm text-gray-600 dark:text-[#8E8E93]"><input type="checkbox" checked={newAnnouncement.channels[ch]} onChange={e => setNewAnnouncement(p => ({ ...p, channels: { ...p.channels, [ch]: e.target.checked } }))} className="rounded text-primary-500" />{ch === 'inApp' ? 'In-App' : ch.toUpperCase()}</label>))}</div></div>
              <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-2"><button type="button" onClick={() => setShowCreateModal(false)} className="btn btn-outline w-full sm:w-auto">Cancel</button><button type="submit" className="btn btn-primary flex items-center justify-center gap-2 w-full sm:w-auto"><Send className="h-4 w-4" /> Send</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Communication
