import { useState, useCallback, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { superAdminService } from '../../services/superAdminService'
import toast from 'react-hot-toast'
import {
  LifeBuoy, BookOpen, Search, Plus, Download, X, Send, ChevronLeft, ChevronRight,
  Clock, AlertCircle, CheckCircle2, MessageSquare, Paperclip, Eye, EyeOff,
  Tag, Trash2, Edit2, Filter, RefreshCw, ArrowRight, AlertTriangle,
  TrendingUp, BarChart3, FileText, ExternalLink, ChevronDown
} from 'lucide-react'

/* ─────────────────── Config Maps ─────────────────── */

const PRIORITY_CONFIG = {
  critical: { label: 'Critical', classes: 'bg-red-50 text-red-700 dark:bg-[rgba(255,69,58,0.12)] dark:text-[#FF453A]' },
  high: { label: 'High', classes: 'bg-amber-50 text-amber-700 dark:bg-[rgba(255,214,10,0.12)] dark:text-[#FFD60A]' },
  medium: { label: 'Medium', classes: 'bg-blue-50 text-blue-700 dark:bg-[rgba(59,130,246,0.12)] dark:text-[#64D2FF]' },
  low: { label: 'Low', classes: 'bg-gray-50 text-gray-600 dark:bg-[rgba(142,142,147,0.12)] dark:text-[#8E8E93]' }
}

const STATUS_CONFIG = {
  open: { label: 'Open', classes: 'bg-blue-50 text-blue-700 dark:bg-[rgba(59,130,246,0.12)] dark:text-[#64D2FF]' },
  in_progress: { label: 'In Progress', classes: 'bg-purple-50 text-purple-700 dark:bg-[rgba(175,82,222,0.12)] dark:text-[#BF5AF2]' },
  waiting: { label: 'Waiting', classes: 'bg-amber-50 text-amber-700 dark:bg-[rgba(255,214,10,0.12)] dark:text-[#FFD60A]' },
  resolved: { label: 'Resolved', classes: 'bg-emerald-50 text-emerald-700 dark:bg-[rgba(48,209,88,0.12)] dark:text-[#30D158]' },
  closed: { label: 'Closed', classes: 'bg-gray-50 text-gray-500 dark:bg-[rgba(142,142,147,0.12)] dark:text-[#8E8E93]' }
}

const STATUS_FLOW = ['open', 'in_progress', 'waiting', 'resolved', 'closed']

const KB_CATEGORIES = ['Getting Started', 'Billing', 'Features', 'Troubleshooting', 'FAQ', 'API', 'Integrations']

const PriorityBadge = ({ priority }) => {
  const config = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.medium
  return <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${config.classes}`}>{config.label}</span>
}

const StatusBadge = ({ status }) => {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.open
  return <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${config.classes}`}>{config.label}</span>
}

const formatDate = (date) => {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

const formatTime = (date) => {
  if (!date) return ''
  return new Date(date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

const formatMs = (ms) => {
  if (!ms) return '-'
  const hours = Math.floor(ms / 3600000)
  const minutes = Math.floor((ms % 3600000) / 60000)
  if (hours > 24) return `${Math.round(hours / 24)}d`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

/* ─────────────────── Skeleton Loader ─────────────────── */

const SkeletonRow = () => (
  <div className="flex items-center gap-3 p-3 sm:p-4">
    <div className="w-4 h-4 bg-gray-200/60 rounded animate-pulse dark:bg-[#2C2C2E]" />
    <div className="flex-1 space-y-2">
      <div className="h-4 w-3/4 bg-gray-200/60 rounded-xl animate-pulse dark:bg-[#2C2C2E]" />
      <div className="h-3 w-1/2 bg-gray-200/60 rounded-xl animate-pulse dark:bg-[#2C2C2E]" />
    </div>
    <div className="h-5 w-16 bg-gray-200/60 rounded-xl animate-pulse dark:bg-[#2C2C2E]" />
  </div>
)

const SkeletonCard = () => (
  <div className="card p-3 sm:p-4 lg:p-5 space-y-2">
    <div className="h-3 w-20 bg-gray-200/60 rounded-xl animate-pulse dark:bg-[#2C2C2E]" />
    <div className="h-7 w-12 bg-gray-200/60 rounded-xl animate-pulse dark:bg-[#2C2C2E]" />
  </div>
)

/* ═══════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════ */

const Support = () => {
  const queryClient = useQueryClient()

  // Tabs
  const [activeTab, setActiveTab] = useState('tickets')

  // ─── Ticket state ───
  const [page, setPage] = useState(1)
  const [limit] = useState(15)
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [assignedFilter, setAssignedFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const debounceRef = useRef(null)
  const [selectedTicketId, setSelectedTicketId] = useState(null)
  const [showTicketDetail, setShowTicketDetail] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedTicketIds, setSelectedTicketIds] = useState([])
  const [showBulkBar, setShowBulkBar] = useState(false)
  const [bulkAssignTo, setBulkAssignTo] = useState('')

  // ─── Reply state ───
  const [replyText, setReplyText] = useState('')
  const [isInternalNote, setIsInternalNote] = useState(false)
  const [replyAttachment, setReplyAttachment] = useState(null)
  const [newTag, setNewTag] = useState('')

  // ─── Create ticket state ───
  const [createForm, setCreateForm] = useState({ schoolSearch: '', tenantId: '', subject: '', description: '', priority: 'medium', notifySchool: true })
  const [schoolResults, setSchoolResults] = useState([])
  const schoolSearchRef = useRef(null)

  // ─── KB state ───
  const [kbPage, setKbPage] = useState(1)
  const [kbCategory, setKbCategory] = useState('')
  const [showKBModal, setShowKBModal] = useState(false)
  const [editingArticle, setEditingArticle] = useState(null)
  const [kbForm, setKbForm] = useState({ title: '', body: '', category: 'Getting Started', tags: '', status: 'draft' })

  // ─── Debounced search ───
  const handleSearchInput = useCallback((value) => {
    setSearchInput(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setSearch(value)
      setPage(1)
    }, 300)
  }, [])

  // ─── Data queries ───

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['superadmin-support-stats'],
    queryFn: async () => {
      const res = await superAdminService.getSupportStats()
      return res.data || {}
    }
  })

  const { data: ticketsData, isLoading: ticketsLoading, error: ticketsError } = useQuery({
    queryKey: ['superadmin-support-tickets', page, search, statusFilter, priorityFilter, assignedFilter, dateFrom, dateTo],
    queryFn: async () => {
      const params = { page, limit }
      if (search) params.search = search
      if (statusFilter) params.status = statusFilter
      if (priorityFilter) params.priority = priorityFilter
      if (assignedFilter) params.assignedTo = assignedFilter
      if (dateFrom) params.dateFrom = dateFrom
      if (dateTo) params.dateTo = dateTo
      const res = await superAdminService.getSupportTickets(params)
      return { tickets: res.data || [], totalPages: res.pagination?.pages || 1 }
    }
  })

  const tickets = ticketsData?.tickets || []
  const totalPages = ticketsData?.totalPages || 1

  const { data: ticketDetail, isLoading: detailLoading } = useQuery({
    queryKey: ['superadmin-support-ticket', selectedTicketId],
    queryFn: async () => {
      const res = await superAdminService.getSupportTicketById(selectedTicketId)
      return res.data || null
    },
    enabled: !!selectedTicketId
  })

  const { data: adminsData } = useQuery({
    queryKey: ['superadmin-admins-list'],
    queryFn: async () => {
      const res = await superAdminService.getSuperAdmins()
      return res.data || []
    }
  })
  const admins = adminsData || []

  const { data: kbData, isLoading: kbLoading, error: kbError } = useQuery({
    queryKey: ['superadmin-kb', kbPage, kbCategory],
    queryFn: async () => {
      const params = { page: kbPage, limit: 15 }
      if (kbCategory) params.category = kbCategory
      const res = await superAdminService.getKnowledgeBase(params)
      return { articles: res.data || [], totalPages: res.pagination?.pages || 1 }
    },
    enabled: activeTab === 'kb'
  })
  const kbArticles = kbData?.articles || []
  const kbTotalPages = kbData?.totalPages || 1

  // ─── Mutations ───

  const replyMutation = useMutation({
    mutationFn: ({ id, data }) => superAdminService.replySupportTicket(id, data),
    onSuccess: () => {
      toast.success('Reply sent successfully')
      setReplyText('')
      setIsInternalNote(false)
      setReplyAttachment(null)
      queryClient.invalidateQueries({ queryKey: ['superadmin-support-ticket', selectedTicketId] })
      queryClient.invalidateQueries({ queryKey: ['superadmin-support-tickets'] })
    },
    onError: (err) => toast.error(err?.response?.data?.message || 'Failed to send reply')
  })

  const updateTicketMutation = useMutation({
    mutationFn: ({ id, data }) => superAdminService.updateSupportTicket(id, data),
    onSuccess: () => {
      toast.success('Ticket updated successfully')
      queryClient.invalidateQueries({ queryKey: ['superadmin-support-ticket', selectedTicketId] })
      queryClient.invalidateQueries({ queryKey: ['superadmin-support-tickets'] })
      queryClient.invalidateQueries({ queryKey: ['superadmin-support-stats'] })
    },
    onError: (err) => toast.error(err?.response?.data?.message || 'Failed to update ticket')
  })

  const createTicketMutation = useMutation({
    mutationFn: (data) => superAdminService.createSupportTicket(data),
    onSuccess: () => {
      toast.success('Ticket created successfully')
      setShowCreateModal(false)
      setCreateForm({ schoolSearch: '', tenantId: '', subject: '', description: '', priority: 'medium', notifySchool: true })
      setSchoolResults([])
      queryClient.invalidateQueries({ queryKey: ['superadmin-support-tickets'] })
      queryClient.invalidateQueries({ queryKey: ['superadmin-support-stats'] })
    },
    onError: (err) => toast.error(err?.response?.data?.message || 'Failed to create ticket')
  })

  const bulkUpdateMutation = useMutation({
    mutationFn: (data) => superAdminService.bulkUpdateTickets(data),
    onSuccess: () => {
      toast.success('Bulk action completed')
      setSelectedTicketIds([])
      setShowBulkBar(false)
      queryClient.invalidateQueries({ queryKey: ['superadmin-support-tickets'] })
      queryClient.invalidateQueries({ queryKey: ['superadmin-support-stats'] })
    },
    onError: (err) => toast.error(err?.response?.data?.message || 'Bulk action failed')
  })

  const createKBMutation = useMutation({
    mutationFn: (data) => superAdminService.createKBArticle(data),
    onSuccess: () => {
      toast.success('Article created successfully')
      setShowKBModal(false)
      resetKBForm()
      queryClient.invalidateQueries({ queryKey: ['superadmin-kb'] })
    },
    onError: (err) => toast.error(err?.response?.data?.message || 'Failed to create article')
  })

  const updateKBMutation = useMutation({
    mutationFn: ({ id, data }) => superAdminService.updateKBArticle(id, data),
    onSuccess: () => {
      toast.success('Article updated successfully')
      setShowKBModal(false)
      setEditingArticle(null)
      resetKBForm()
      queryClient.invalidateQueries({ queryKey: ['superadmin-kb'] })
    },
    onError: (err) => toast.error(err?.response?.data?.message || 'Failed to update article')
  })

  const deleteKBMutation = useMutation({
    mutationFn: (id) => superAdminService.deleteKBArticle(id),
    onSuccess: () => {
      toast.success('Article deleted successfully')
      queryClient.invalidateQueries({ queryKey: ['superadmin-kb'] })
    },
    onError: (err) => toast.error(err?.response?.data?.message || 'Failed to delete article')
  })

  // ─── Handlers ───

  const openTicketDetail = (id) => {
    setSelectedTicketId(id)
    setShowTicketDetail(true)
    setReplyText('')
    setIsInternalNote(false)
    setReplyAttachment(null)
    setNewTag('')
  }

  const closeTicketDetail = () => {
    setShowTicketDetail(false)
    setSelectedTicketId(null)
  }

  const handleReply = () => {
    if (!replyText.trim()) return
    const data = { message: replyText.trim(), isInternal: isInternalNote }
    if (replyAttachment) data.attachments = [replyAttachment.name]
    replyMutation.mutate({ id: selectedTicketId, data })
  }

  const handleStatusChange = (newStatus) => {
    updateTicketMutation.mutate({ id: selectedTicketId, data: { status: newStatus } })
  }

  const handlePriorityChange = (newPriority) => {
    updateTicketMutation.mutate({ id: selectedTicketId, data: { priority: newPriority } })
  }

  const handleAssignChange = (assignedTo) => {
    updateTicketMutation.mutate({ id: selectedTicketId, data: { assignedTo: assignedTo || null } })
  }

  const handleAddTag = () => {
    if (!newTag.trim() || !ticketDetail) return
    const existing = ticketDetail.tags || []
    if (existing.includes(newTag.trim())) return
    updateTicketMutation.mutate({ id: selectedTicketId, data: { tags: [...existing, newTag.trim()] } })
    setNewTag('')
  }

  const handleRemoveTag = (tag) => {
    if (!ticketDetail) return
    const updated = (ticketDetail.tags || []).filter(t => t !== tag)
    updateTicketMutation.mutate({ id: selectedTicketId, data: { tags: updated } })
  }

  const handleCreateTicket = () => {
    if (!createForm.tenantId || !createForm.subject.trim() || !createForm.description.trim()) {
      toast.error('Please fill in all required fields')
      return
    }
    createTicketMutation.mutate({
      tenantId: createForm.tenantId,
      subject: createForm.subject.trim(),
      description: createForm.description.trim(),
      priority: createForm.priority,
      notifySchool: createForm.notifySchool
    })
  }

  const handleSchoolSearch = useCallback(async (query) => {
    setCreateForm(prev => ({ ...prev, schoolSearch: query, tenantId: '' }))
    if (query.length < 2) { setSchoolResults([]); return }
    try {
      const res = await superAdminService.searchTenants(query)
      setSchoolResults(res.data || [])
    } catch {
      setSchoolResults([])
    }
  }, [])

  const selectSchool = (tenant) => {
    setCreateForm(prev => ({ ...prev, schoolSearch: tenant.schoolName || tenant.name, tenantId: tenant._id }))
    setSchoolResults([])
  }

  const toggleTicketSelection = (id) => {
    setSelectedTicketIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      setShowBulkBar(next.length > 0)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedTicketIds.length === tickets.length) {
      setSelectedTicketIds([])
      setShowBulkBar(false)
    } else {
      setSelectedTicketIds(tickets.map(t => t._id))
      setShowBulkBar(true)
    }
  }

  const handleBulkClose = () => {
    if (!window.confirm(`Close ${selectedTicketIds.length} selected ticket(s)?`)) return
    bulkUpdateMutation.mutate({ ticketIds: selectedTicketIds, action: 'status', value: 'closed' })
  }

  const handleBulkAssign = () => {
    if (!bulkAssignTo) return
    bulkUpdateMutation.mutate({ ticketIds: selectedTicketIds, action: 'assign', value: bulkAssignTo })
  }

  const handleExport = async () => {
    try {
      const params = {}
      if (statusFilter) params.status = statusFilter
      if (priorityFilter) params.priority = priorityFilter
      if (search) params.search = search
      const blob = await superAdminService.exportTickets(params)
      const url = window.URL.createObjectURL(new Blob([blob]))
      const a = document.createElement('a')
      a.href = url
      a.download = `support-tickets-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      window.URL.revokeObjectURL(url)
      toast.success('Tickets exported successfully')
    } catch {
      toast.error('Failed to export tickets')
    }
  }

  const resetKBForm = () => {
    setKbForm({ title: '', body: '', category: 'Getting Started', tags: '', status: 'draft' })
  }

  const openCreateKB = () => {
    setEditingArticle(null)
    resetKBForm()
    setShowKBModal(true)
  }

  const openEditKB = (article) => {
    setEditingArticle(article)
    setKbForm({
      title: article.title || '',
      body: article.body || '',
      category: article.category || 'Getting Started',
      tags: (article.tags || []).join(', '),
      status: article.status || 'draft'
    })
    setShowKBModal(true)
  }

  const handleSaveKB = () => {
    if (!kbForm.title.trim() || !kbForm.body.trim()) {
      toast.error('Title and body are required')
      return
    }
    const payload = {
      title: kbForm.title.trim(),
      body: kbForm.body.trim(),
      category: kbForm.category,
      tags: kbForm.tags ? kbForm.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      status: kbForm.status
    }
    if (editingArticle) {
      updateKBMutation.mutate({ id: editingArticle._id, data: payload })
    } else {
      createKBMutation.mutate(payload)
    }
  }

  const handleDeleteKB = (article) => {
    if (!window.confirm(`Delete article "${article.title}"? This action cannot be undone.`)) return
    deleteKBMutation.mutate(article._id)
  }

  const handleTogglePublish = (article) => {
    const newStatus = article.status === 'published' ? 'draft' : 'published'
    updateKBMutation.mutate({ id: article._id, data: { status: newStatus } })
  }

  const clearFilters = () => {
    setSearch('')
    setSearchInput('')
    setStatusFilter('')
    setPriorityFilter('')
    setAssignedFilter('')
    setDateFrom('')
    setDateTo('')
    setPage(1)
  }

  // ─── Computed stats ───
  const openCount = stats?.byStatus?.find(s => s._id === 'open')?.count || 0
  const criticalCount = stats?.byStatus?.find(s => s._id === 'critical')?.count ||
    tickets.filter(t => t.priority === 'critical' && t.status !== 'closed').length || 0
  const avgResponseTime = stats?.avgResponseTimeMs || 0
  const resolutionRate = stats?.resolutionRate || 0

  /* ═══════════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════════ */

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Support & Helpdesk</h1>
          <p className="text-sm text-gray-500 dark:text-[#8E8E93] mt-0.5">Manage tickets and knowledge base</p>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === 'tickets' && (
            <>
              <button onClick={handleExport} className="btn btn-outline btn-sm">
                <Download className="w-4 h-4 mr-1.5" />Export
              </button>
              <button onClick={() => setShowCreateModal(true)} className="btn btn-primary btn-sm">
                <Plus className="w-4 h-4 mr-1.5" />New Ticket
              </button>
            </>
          )}
          {activeTab === 'kb' && (
            <button onClick={openCreateKB} className="btn btn-primary btn-sm">
              <Plus className="w-4 h-4 mr-1.5" />New Article
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100/80 dark:bg-[#2C2C2E] rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('tickets')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'tickets'
              ? 'bg-white dark:bg-[#3A3A3C] text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-[#8E8E93] hover:text-gray-700 dark:hover:text-white'
          }`}
        >
          <LifeBuoy className="w-4 h-4" />Tickets
        </button>
        <button
          onClick={() => setActiveTab('kb')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'kb'
              ? 'bg-white dark:bg-[#3A3A3C] text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-[#8E8E93] hover:text-gray-700 dark:hover:text-white'
          }`}
        >
          <BookOpen className="w-4 h-4" />Knowledge Base
        </button>
      </div>

      {/* ═══════════ TAB 1: TICKETS ═══════════ */}
      {activeTab === 'tickets' && (
        <>
          {/* Quick Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {statsLoading ? (
              <>
                <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
              </>
            ) : (
              <>
                <div className="card p-3 sm:p-4 lg:p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Open Tickets</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{openCount}</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-[rgba(59,130,246,0.12)] flex items-center justify-center">
                      <LifeBuoy className="w-5 h-5 text-blue-600 dark:text-[#64D2FF]" />
                    </div>
                  </div>
                </div>

                <div className={`card p-3 sm:p-4 lg:p-5 ${criticalCount > 0 ? 'ring-1 ring-red-200 dark:ring-[#FF453A]/30' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Critical</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{criticalCount}</p>
                    </div>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      criticalCount > 0
                        ? 'bg-red-50 dark:bg-[rgba(255,69,58,0.12)] animate-pulse'
                        : 'bg-red-50 dark:bg-[rgba(255,69,58,0.12)]'
                    }`}>
                      <AlertCircle className={`w-5 h-5 ${criticalCount > 0 ? 'text-red-600 dark:text-[#FF453A]' : 'text-red-400 dark:text-[#FF453A]/60'}`} />
                    </div>
                  </div>
                </div>

                <div className="card p-3 sm:p-4 lg:p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Avg Response</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{formatMs(avgResponseTime)}</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-[rgba(175,82,222,0.12)] flex items-center justify-center">
                      <Clock className="w-5 h-5 text-purple-600 dark:text-[#BF5AF2]" />
                    </div>
                  </div>
                </div>

                <div className="card p-3 sm:p-4 lg:p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Resolution Rate</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{resolutionRate}%</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-[rgba(48,209,88,0.12)] flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-[#30D158]" />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Filters Bar */}
          <div className="card p-3 sm:p-4 lg:p-5">
            <div className="flex flex-col lg:flex-row gap-3">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-[#636366]" />
                <input
                  type="text"
                  placeholder="Search by ticket #, school, subject..."
                  value={searchInput}
                  onChange={(e) => handleSearchInput(e.target.value)}
                  className="input w-full pl-10"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
                  className="input w-auto min-w-[120px]"
                >
                  <option value="">All Status</option>
                  {STATUS_FLOW.map(s => (
                    <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                  ))}
                </select>
                <select
                  value={priorityFilter}
                  onChange={(e) => { setPriorityFilter(e.target.value); setPage(1) }}
                  className="input w-auto min-w-[120px]"
                >
                  <option value="">All Priority</option>
                  {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
                <select
                  value={assignedFilter}
                  onChange={(e) => { setAssignedFilter(e.target.value); setPage(1) }}
                  className="input w-auto min-w-[120px]"
                >
                  <option value="">All Assignees</option>
                  {admins.map(a => (
                    <option key={a._id} value={a._id}>{a.name || a.email}</option>
                  ))}
                </select>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
                  className="input w-auto"
                  placeholder="From"
                />
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
                  className="input w-auto"
                  placeholder="To"
                />
                {(statusFilter || priorityFilter || assignedFilter || dateFrom || dateTo || search) && (
                  <button onClick={clearFilters} className="btn btn-outline btn-sm">
                    <X className="w-3.5 h-3.5 mr-1" />Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Bulk Action Bar */}
          {showBulkBar && selectedTicketIds.length > 0 && (
            <div className="card p-3 sm:p-4 flex flex-wrap items-center gap-3 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800">
              <span className="text-sm font-medium text-gray-900 dark:text-white">{selectedTicketIds.length} selected</span>
              <div className="flex items-center gap-2 ml-auto">
                <select
                  value={bulkAssignTo}
                  onChange={(e) => setBulkAssignTo(e.target.value)}
                  className="input w-auto text-sm"
                >
                  <option value="">Assign to...</option>
                  {admins.map(a => (
                    <option key={a._id} value={a._id}>{a.name || a.email}</option>
                  ))}
                </select>
                <button
                  onClick={handleBulkAssign}
                  disabled={!bulkAssignTo || bulkUpdateMutation.isPending}
                  className="btn btn-outline btn-sm disabled:opacity-50"
                >
                  Assign
                </button>
                <button
                  onClick={handleBulkClose}
                  disabled={bulkUpdateMutation.isPending}
                  className="btn btn-outline btn-sm text-red-600 dark:text-[#FF453A] border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  Close Selected
                </button>
                <button
                  onClick={handleExport}
                  className="btn btn-outline btn-sm"
                >
                  <Download className="w-3.5 h-3.5 mr-1" />Export
                </button>
                <button
                  onClick={() => { setSelectedTicketIds([]); setShowBulkBar(false) }}
                  className="btn btn-outline btn-sm"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Ticket List + Detail */}
          <div className="flex flex-col lg:flex-row gap-4 sm:gap-6">
            {/* Left: Ticket List */}
            <div className={`${showTicketDetail && selectedTicketId ? 'hidden lg:block lg:w-[420px] lg:flex-shrink-0' : 'w-full'}`}>
              <div className="rounded-2xl overflow-hidden shadow-glass">
                {/* Table Header */}
                <div className="bg-gray-50/80 dark:bg-[#2C2C2E] px-3 sm:px-4 py-2.5 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={tickets.length > 0 && selectedTicketIds.length === tickets.length}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-gray-300 dark:border-[#636366] text-primary-600"
                  />
                  <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider flex-1">Tickets</span>
                  <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider hidden sm:block w-20 text-center">Priority</span>
                  <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider hidden sm:block w-24 text-center">Status</span>
                </div>

                {/* Loading */}
                {ticketsLoading && (
                  <div className="bg-white dark:bg-[#1C1C1E]">
                    {Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}
                  </div>
                )}

                {/* Error */}
                {ticketsError && !ticketsLoading && (
                  <div className="bg-white dark:bg-[#1C1C1E] p-8 text-center">
                    <div className="w-12 h-12 bg-gray-50 dark:bg-[#2C2C2E] rounded-full flex items-center justify-center mx-auto mb-3">
                      <AlertTriangle className="w-6 h-6 text-gray-400 dark:text-[#636366]" />
                    </div>
                    <p className="text-sm text-gray-500 dark:text-[#8E8E93]">Failed to load tickets</p>
                    <button onClick={() => queryClient.invalidateQueries({ queryKey: ['superadmin-support-tickets'] })} className="btn btn-outline btn-sm mt-3">
                      <RefreshCw className="w-3.5 h-3.5 mr-1" />Retry
                    </button>
                  </div>
                )}

                {/* Empty */}
                {!ticketsLoading && !ticketsError && tickets.length === 0 && (
                  <div className="bg-white dark:bg-[#1C1C1E] p-8 text-center">
                    <div className="w-12 h-12 bg-gray-50 dark:bg-[#2C2C2E] rounded-full flex items-center justify-center mx-auto mb-3">
                      <LifeBuoy className="w-6 h-6 text-gray-400 dark:text-[#636366]" />
                    </div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">No tickets found</p>
                    <p className="text-xs text-gray-500 dark:text-[#8E8E93] mt-1">Adjust your filters or create a new ticket</p>
                  </div>
                )}

                {/* Rows */}
                {!ticketsLoading && !ticketsError && tickets.map(ticket => (
                  <div
                    key={ticket._id}
                    onClick={() => openTicketDetail(ticket._id)}
                    className={`flex items-center gap-2 px-3 sm:px-4 py-3 cursor-pointer border-b border-gray-50 dark:border-[#2C2C2E] hover:bg-primary-50 dark:hover:bg-[#2C2C2E] transition-colors ${
                      selectedTicketId === ticket._id ? 'bg-primary-50/60 dark:bg-[#2C2C2E]' : 'bg-white dark:bg-[#1C1C1E]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedTicketIds.includes(ticket._id)}
                      onChange={(e) => { e.stopPropagation(); toggleTicketSelection(ticket._id) }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-4 h-4 rounded border-gray-300 dark:border-[#636366] text-primary-600 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs sm:text-sm truncate ${ticket.unread ? 'font-bold text-gray-900 dark:text-white' : 'text-gray-900 dark:text-white'}`}>
                          {ticket.subject || 'No subject'}
                        </span>
                        {ticket.messageCount > 0 && (
                          <span className="flex items-center gap-0.5 text-[10px] text-gray-400 dark:text-[#636366] flex-shrink-0">
                            <MessageSquare className="w-3 h-3" />{ticket.messageCount}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-gray-500 dark:text-[#8E8E93] font-mono">#{ticket.ticketNumber || ticket._id?.slice(-6)}</span>
                        <span className="text-[11px] text-gray-400 dark:text-[#636366] truncate">{ticket.tenantName || ticket.schoolName || '-'}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 sm:hidden">
                        <PriorityBadge priority={ticket.priority} />
                        <StatusBadge status={ticket.status} />
                      </div>
                    </div>
                    <div className="hidden sm:block w-20 text-center flex-shrink-0">
                      <PriorityBadge priority={ticket.priority} />
                    </div>
                    <div className="hidden sm:block w-24 text-center flex-shrink-0">
                      <StatusBadge status={ticket.status} />
                    </div>
                    <div className="text-[10px] text-gray-400 dark:text-[#636366] text-right w-16 flex-shrink-0 hidden lg:block">
                      {formatDate(ticket.updatedAt || ticket.createdAt)}
                    </div>
                  </div>
                ))}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="bg-white dark:bg-[#1C1C1E] px-3 sm:px-4 py-3 flex items-center justify-between border-t border-gray-50 dark:border-[#2C2C2E]">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="btn btn-outline btn-sm disabled:opacity-40"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-xs text-gray-500 dark:text-[#8E8E93]">Page {page} of {totalPages}</span>
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                      className="btn btn-outline btn-sm disabled:opacity-40"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Ticket Detail */}
            {showTicketDetail && selectedTicketId && (
              <>
                {/* Mobile overlay */}
                <div className="fixed inset-0 z-50 lg:hidden bg-black/50 backdrop-blur-sm" onClick={closeTicketDetail} />
                <div className={`
                  fixed inset-x-0 bottom-0 z-50 lg:relative lg:inset-auto lg:z-auto
                  bg-white dark:bg-[#1C1C1E] rounded-t-2xl lg:rounded-2xl shadow-xl lg:shadow-glass
                  max-h-[90vh] lg:max-h-none overflow-y-auto animate-scale-in
                  lg:flex-1 lg:min-w-0
                `}>
                  {detailLoading ? (
                    <div className="p-4 sm:p-6 space-y-4">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="h-4 bg-gray-200/60 rounded-xl animate-pulse dark:bg-[#2C2C2E]" style={{ width: `${70 - i * 10}%` }} />
                      ))}
                    </div>
                  ) : !ticketDetail ? (
                    <div className="p-8 text-center">
                      <p className="text-sm text-gray-500 dark:text-[#8E8E93]">Ticket not found</p>
                    </div>
                  ) : (
                    <div className="flex flex-col">
                      {/* Detail Header */}
                      <div className="p-3 sm:p-4 lg:p-5 border-b border-gray-100 dark:border-[#2C2C2E]">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-mono text-gray-400 dark:text-[#636366]">#{ticketDetail.ticketNumber || ticketDetail._id?.slice(-6)}</span>
                              <button onClick={closeTicketDetail} className="lg:hidden ml-auto p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-[#2C2C2E]">
                                <X className="w-5 h-5 text-gray-400" />
                              </button>
                            </div>
                            <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mt-1 break-words">{ticketDetail.subject}</h2>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-gray-500 dark:text-[#8E8E93]">
                              <span className="font-medium text-primary-600 dark:text-primary-400 cursor-pointer hover:underline">
                                {ticketDetail.tenantName || ticketDetail.schoolName || '-'}
                              </span>
                              <span>{ticketDetail.createdByName || ticketDetail.createdBy?.name || '-'}</span>
                              <span>{ticketDetail.createdByEmail || ticketDetail.createdBy?.email || ''}</span>
                              <span>Created {formatDate(ticketDetail.createdAt)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Controls */}
                        <div className="flex flex-wrap items-center gap-2 mt-3">
                          <select
                            value={ticketDetail.priority || 'medium'}
                            onChange={(e) => handlePriorityChange(e.target.value)}
                            className="input w-auto text-xs"
                          >
                            {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
                              <option key={k} value={k}>{v.label}</option>
                            ))}
                          </select>
                          <select
                            value={ticketDetail.status || 'open'}
                            onChange={(e) => handleStatusChange(e.target.value)}
                            className="input w-auto text-xs"
                          >
                            {STATUS_FLOW.map(s => (
                              <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                            ))}
                          </select>
                          <select
                            value={ticketDetail.assignedTo || ''}
                            onChange={(e) => handleAssignChange(e.target.value)}
                            className="input w-auto text-xs"
                          >
                            <option value="">Unassigned</option>
                            {admins.map(a => (
                              <option key={a._id} value={a._id}>{a.name || a.email}</option>
                            ))}
                          </select>
                        </div>

                        {/* Status Toolbar */}
                        <div className="flex items-center gap-1 mt-3 overflow-x-auto pb-1">
                          {STATUS_FLOW.map((s, i) => {
                            const isCurrent = ticketDetail.status === s
                            const isPast = STATUS_FLOW.indexOf(ticketDetail.status) > i
                            return (
                              <div key={s} className="flex items-center">
                                {i > 0 && <ArrowRight className="w-3 h-3 text-gray-300 dark:text-[#636366] mx-0.5 flex-shrink-0" />}
                                <button
                                  onClick={() => handleStatusChange(s)}
                                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors ${
                                    isCurrent
                                      ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400 ring-1 ring-primary-300 dark:ring-primary-700'
                                      : isPast
                                        ? 'bg-gray-100 text-gray-600 dark:bg-[#2C2C2E] dark:text-[#8E8E93]'
                                        : 'bg-gray-50 text-gray-400 dark:bg-[#1C1C1E] dark:text-[#636366] hover:bg-gray-100 dark:hover:bg-[#2C2C2E]'
                                  }`}
                                >
                                  {STATUS_CONFIG[s].label}
                                </button>
                              </div>
                            )
                          })}
                        </div>

                        {/* Tags */}
                        <div className="flex flex-wrap items-center gap-1.5 mt-3">
                          {(ticketDetail.tags || []).map(tag => (
                            <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 dark:bg-[#2C2C2E] rounded-md text-[11px] text-gray-600 dark:text-[#8E8E93]">
                              <Tag className="w-3 h-3" />{tag}
                              <button onClick={() => handleRemoveTag(tag)} className="ml-0.5 hover:text-red-500">
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={newTag}
                              onChange={(e) => setNewTag(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag() } }}
                              placeholder="Add tag..."
                              className="input w-24 text-[11px] py-0.5 px-2"
                            />
                            {newTag && (
                              <button onClick={handleAddTag} className="text-primary-600 dark:text-primary-400 hover:text-primary-700">
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Message Thread */}
                      <div className="p-3 sm:p-4 lg:p-5 space-y-3 flex-1 overflow-y-auto max-h-[40vh] lg:max-h-[50vh]">
                        {/* Initial description */}
                        {ticketDetail.description && (
                          <div className="bg-gray-50 dark:bg-[#2C2C2E] rounded-xl p-3">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-xs font-medium text-gray-900 dark:text-white">{ticketDetail.createdByName || ticketDetail.createdBy?.name || 'School'}</span>
                              <span className="text-[10px] text-gray-400 dark:text-[#636366]">{formatDate(ticketDetail.createdAt)} {formatTime(ticketDetail.createdAt)}</span>
                            </div>
                            <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{ticketDetail.description}</p>
                          </div>
                        )}

                        {/* Messages */}
                        {(ticketDetail.messages || []).map((msg, i) => {
                          const isAdmin = msg.senderType === 'admin' || msg.senderType === 'superadmin' || msg.isAdmin
                          const isInternal = msg.isInternal

                          if (isInternal) {
                            return (
                              <div key={msg._id || i} className="bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-400 rounded-r-xl p-3 ml-2">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase">(Internal Note)</span>
                                  <span className="text-xs font-medium text-gray-900 dark:text-white">{msg.senderName || 'Admin'}</span>
                                  <span className="text-[10px] text-gray-400 dark:text-[#636366]">{formatDate(msg.createdAt)} {formatTime(msg.createdAt)}</span>
                                </div>
                                <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{msg.message}</p>
                              </div>
                            )
                          }

                          if (isAdmin) {
                            return (
                              <div key={msg._id || i} className="bg-primary-50 dark:bg-primary-900/20 rounded-xl p-3 ml-4">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs font-medium text-gray-900 dark:text-white">{msg.senderName || 'Support'}</span>
                                  <span className="text-[10px] text-gray-400 dark:text-[#636366]">{formatDate(msg.createdAt)} {formatTime(msg.createdAt)}</span>
                                </div>
                                <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{msg.message}</p>
                                {msg.attachments?.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    {msg.attachments.map((a, j) => (
                                      <span key={j} className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/60 dark:bg-[#2C2C2E] rounded text-[10px] text-gray-500 dark:text-[#8E8E93]">
                                        <Paperclip className="w-3 h-3" />{typeof a === 'string' ? a : a.name}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )
                          }

                          return (
                            <div key={msg._id || i} className="bg-gray-50 dark:bg-[#2C2C2E] rounded-xl p-3">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-medium text-gray-900 dark:text-white">{msg.senderName || 'School'}</span>
                                <span className="text-[10px] text-gray-400 dark:text-[#636366]">{formatDate(msg.createdAt)} {formatTime(msg.createdAt)}</span>
                              </div>
                              <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{msg.message}</p>
                              {msg.attachments?.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {msg.attachments.map((a, j) => (
                                    <span key={j} className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/60 dark:bg-[#1C1C1E] rounded text-[10px] text-gray-500 dark:text-[#8E8E93]">
                                      <Paperclip className="w-3 h-3" />{typeof a === 'string' ? a : a.name}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                        })}

                        {(ticketDetail.messages || []).length === 0 && !ticketDetail.description && (
                          <div className="text-center py-6">
                            <MessageSquare className="w-8 h-8 text-gray-300 dark:text-[#636366] mx-auto mb-2" />
                            <p className="text-xs text-gray-400 dark:text-[#636366]">No messages yet</p>
                          </div>
                        )}
                      </div>

                      {/* Reply Section */}
                      <div className="p-3 sm:p-4 lg:p-5 border-t border-gray-100 dark:border-[#2C2C2E]">
                        <textarea
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder={isInternalNote ? 'Write an internal note...' : 'Type your reply...'}
                          rows={3}
                          className={`input w-full resize-none ${isInternalNote ? 'border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-900/10' : ''}`}
                        />
                        <div className="flex items-center justify-between mt-2 gap-2">
                          <div className="flex items-center gap-3">
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isInternalNote}
                                onChange={(e) => setIsInternalNote(e.target.checked)}
                                className="w-3.5 h-3.5 rounded border-gray-300 dark:border-[#636366] text-amber-500"
                              />
                              <span className="text-xs text-gray-500 dark:text-[#8E8E93]">Internal Note</span>
                            </label>
                            <label className="flex items-center gap-1 cursor-pointer text-xs text-gray-500 dark:text-[#8E8E93] hover:text-gray-700 dark:hover:text-white">
                              <Paperclip className="w-3.5 h-3.5" />
                              <span>{replyAttachment ? replyAttachment.name : 'Attach'}</span>
                              <input type="file" className="hidden" onChange={(e) => setReplyAttachment(e.target.files?.[0] || null)} />
                            </label>
                            {replyAttachment && (
                              <button onClick={() => setReplyAttachment(null)} className="text-xs text-red-500 hover:text-red-700">
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                          <button
                            onClick={handleReply}
                            disabled={!replyText.trim() || replyMutation.isPending}
                            className="btn btn-primary btn-sm disabled:opacity-50"
                          >
                            {replyMutation.isPending ? (
                              <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <Send className="w-3.5 h-3.5 mr-1" />
                                {isInternalNote ? 'Add Note' : 'Reply'}
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Placeholder when no ticket selected on desktop */}
            {!showTicketDetail && tickets.length > 0 && (
              <div className="hidden lg:flex flex-1 items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 dark:border-[#2C2C2E] min-h-[400px]">
                <div className="text-center">
                  <div className="w-12 h-12 bg-gray-50 dark:bg-[#2C2C2E] rounded-full flex items-center justify-center mx-auto mb-3">
                    <MessageSquare className="w-6 h-6 text-gray-400 dark:text-[#636366]" />
                  </div>
                  <p className="text-sm text-gray-500 dark:text-[#8E8E93]">Select a ticket to view details</p>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ═══════════ TAB 2: KNOWLEDGE BASE ═══════════ */}
      {activeTab === 'kb' && (
        <>
          {/* Category Filter */}
          <div className="card p-3 sm:p-4 lg:p-5 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-gray-500 dark:text-[#8E8E93] mr-1">Category:</span>
            <button
              onClick={() => { setKbCategory(''); setKbPage(1) }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                !kbCategory
                  ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
                  : 'bg-gray-50 text-gray-600 dark:bg-[#2C2C2E] dark:text-[#8E8E93] hover:bg-gray-100 dark:hover:bg-[#3A3A3C]'
              }`}
            >
              All
            </button>
            {KB_CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => { setKbCategory(cat); setKbPage(1) }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  kbCategory === cat
                    ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
                    : 'bg-gray-50 text-gray-600 dark:bg-[#2C2C2E] dark:text-[#8E8E93] hover:bg-gray-100 dark:hover:bg-[#3A3A3C]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Article List */}
          <div className="rounded-2xl overflow-hidden shadow-glass">
            {/* Header */}
            <div className="bg-gray-50/80 dark:bg-[#2C2C2E] px-3 sm:px-4 py-2.5 grid grid-cols-12 gap-2">
              <span className="col-span-5 sm:col-span-5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Title</span>
              <span className="col-span-3 sm:col-span-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Category</span>
              <span className="col-span-2 sm:col-span-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-center">Status</span>
              <span className="hidden sm:block col-span-1 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-center">Views</span>
              <span className="col-span-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</span>
            </div>

            {/* Loading */}
            {kbLoading && (
              <div className="bg-white dark:bg-[#1C1C1E]">
                {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
              </div>
            )}

            {/* Error */}
            {kbError && !kbLoading && (
              <div className="bg-white dark:bg-[#1C1C1E] p-8 text-center">
                <div className="w-12 h-12 bg-gray-50 dark:bg-[#2C2C2E] rounded-full flex items-center justify-center mx-auto mb-3">
                  <AlertTriangle className="w-6 h-6 text-gray-400 dark:text-[#636366]" />
                </div>
                <p className="text-sm text-gray-500 dark:text-[#8E8E93]">Failed to load articles</p>
                <button onClick={() => queryClient.invalidateQueries({ queryKey: ['superadmin-kb'] })} className="btn btn-outline btn-sm mt-3">
                  <RefreshCw className="w-3.5 h-3.5 mr-1" />Retry
                </button>
              </div>
            )}

            {/* Empty */}
            {!kbLoading && !kbError && kbArticles.length === 0 && (
              <div className="bg-white dark:bg-[#1C1C1E] p-8 text-center">
                <div className="w-12 h-12 bg-gray-50 dark:bg-[#2C2C2E] rounded-full flex items-center justify-center mx-auto mb-3">
                  <BookOpen className="w-6 h-6 text-gray-400 dark:text-[#636366]" />
                </div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">No articles yet</p>
                <p className="text-xs text-gray-500 dark:text-[#8E8E93] mt-1">Create your first knowledge base article</p>
                <button onClick={openCreateKB} className="btn btn-primary btn-sm mt-3">
                  <Plus className="w-4 h-4 mr-1" />Create Article
                </button>
              </div>
            )}

            {/* Rows */}
            {!kbLoading && !kbError && kbArticles.map(article => (
              <div
                key={article._id}
                className="grid grid-cols-12 gap-2 items-center px-3 sm:px-4 py-3 bg-white dark:bg-[#1C1C1E] border-b border-gray-50 dark:border-[#2C2C2E] hover:bg-primary-50 dark:hover:bg-[#2C2C2E] transition-colors"
              >
                <div className="col-span-5 sm:col-span-5 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white truncate">{article.title}</p>
                  {article.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {article.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-[#2C2C2E] text-gray-500 dark:text-[#8E8E93] rounded">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="col-span-3 sm:col-span-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-medium bg-blue-50 text-blue-700 dark:bg-[rgba(59,130,246,0.12)] dark:text-[#64D2FF]">
                    {article.category || '-'}
                  </span>
                </div>
                <div className="col-span-2 sm:col-span-2 text-center">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${
                    article.status === 'published'
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-[rgba(48,209,88,0.12)] dark:text-[#30D158]'
                      : 'bg-gray-50 text-gray-500 dark:bg-[rgba(142,142,147,0.12)] dark:text-[#8E8E93]'
                  }`}>
                    {article.status === 'published' ? 'Published' : 'Draft'}
                  </span>
                </div>
                <div className="hidden sm:flex col-span-1 items-center justify-center text-xs text-gray-500 dark:text-[#8E8E93]">
                  <Eye className="w-3 h-3 mr-1" />{article.viewCount || 0}
                </div>
                <div className="col-span-2 flex items-center justify-end gap-1">
                  <button
                    onClick={() => handleTogglePublish(article)}
                    title={article.status === 'published' ? 'Unpublish' : 'Publish'}
                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-[#2C2C2E] text-gray-400 dark:text-[#636366] hover:text-gray-600 dark:hover:text-white transition-colors"
                  >
                    {article.status === 'published' ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => openEditKB(article)}
                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-[#2C2C2E] text-gray-400 dark:text-[#636366] hover:text-gray-600 dark:hover:text-white transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteKB(article)}
                    className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 dark:text-[#636366] hover:text-red-600 dark:hover:text-[#FF453A] transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}

            {/* Pagination */}
            {kbTotalPages > 1 && (
              <div className="bg-white dark:bg-[#1C1C1E] px-3 sm:px-4 py-3 flex items-center justify-between border-t border-gray-50 dark:border-[#2C2C2E]">
                <button
                  onClick={() => setKbPage(p => Math.max(1, p - 1))}
                  disabled={kbPage <= 1}
                  className="btn btn-outline btn-sm disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs text-gray-500 dark:text-[#8E8E93]">Page {kbPage} of {kbTotalPages}</span>
                <button
                  onClick={() => setKbPage(p => Math.min(kbTotalPages, p + 1))}
                  disabled={kbPage >= kbTotalPages}
                  className="btn btn-outline btn-sm disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* ═══════════ CREATE TICKET MODAL ═══════════ */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowCreateModal(false)}>
          <div
            className="bg-white dark:bg-[#1C1C1E] rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-[#2C2C2E] flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">Create New Ticket</h3>
              <button onClick={() => setShowCreateModal(false)} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-[#2C2C2E]">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-4 sm:p-5 space-y-4">
              {/* School search */}
              <div className="relative">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">School *</label>
                <input
                  ref={schoolSearchRef}
                  type="text"
                  value={createForm.schoolSearch}
                  onChange={(e) => handleSchoolSearch(e.target.value)}
                  placeholder="Search for a school..."
                  className="input w-full"
                />
                {schoolResults.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white dark:bg-[#2C2C2E] rounded-xl shadow-lg border border-gray-200 dark:border-[#3A3A3C] max-h-40 overflow-y-auto">
                    {schoolResults.map(t => (
                      <button
                        key={t._id}
                        onClick={() => selectSchool(t)}
                        className="w-full px-3 py-2 text-left text-sm text-gray-900 dark:text-white hover:bg-primary-50 dark:hover:bg-[#3A3A3C] transition-colors"
                      >
                        {t.schoolName || t.name}
                        {t.subdomain && <span className="text-xs text-gray-400 dark:text-[#636366] ml-2">{t.subdomain}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Subject *</label>
                <input
                  type="text"
                  value={createForm.subject}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, subject: e.target.value }))}
                  placeholder="Brief description of the issue"
                  className="input w-full"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Description *</label>
                <textarea
                  value={createForm.description}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Detailed description of the issue..."
                  rows={4}
                  className="input w-full resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Priority</label>
                <select
                  value={createForm.priority}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, priority: e.target.value }))}
                  className="input w-full"
                >
                  {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={createForm.notifySchool}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, notifySchool: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-300 dark:border-[#636366] text-primary-600"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Create & Notify School</span>
              </label>
            </div>
            <div className="p-4 sm:p-5 border-t border-gray-100 dark:border-[#2C2C2E] flex justify-end gap-2">
              <button onClick={() => setShowCreateModal(false)} className="btn btn-outline btn-sm">Cancel</button>
              <button
                onClick={handleCreateTicket}
                disabled={createTicketMutation.isPending}
                className="btn btn-primary btn-sm disabled:opacity-50"
              >
                {createTicketMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
                Create Ticket
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ KB ARTICLE MODAL ═══════════ */}
      {showKBModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => { setShowKBModal(false); setEditingArticle(null) }}>
          <div
            className="bg-white dark:bg-[#1C1C1E] rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-[#2C2C2E] flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                {editingArticle ? 'Edit Article' : 'Create Article'}
              </h3>
              <button onClick={() => { setShowKBModal(false); setEditingArticle(null) }} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-[#2C2C2E]">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-4 sm:p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Title *</label>
                <input
                  type="text"
                  value={kbForm.title}
                  onChange={(e) => setKbForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Article title"
                  className="input w-full"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Body *</label>
                <textarea
                  value={kbForm.body}
                  onChange={(e) => setKbForm(prev => ({ ...prev, body: e.target.value }))}
                  placeholder="Article content..."
                  rows={8}
                  className="input w-full resize-y"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                <select
                  value={kbForm.category}
                  onChange={(e) => setKbForm(prev => ({ ...prev, category: e.target.value }))}
                  className="input w-full"
                >
                  {KB_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Tags (comma separated)</label>
                <input
                  type="text"
                  value={kbForm.tags}
                  onChange={(e) => setKbForm(prev => ({ ...prev, tags: e.target.value }))}
                  placeholder="e.g. setup, billing, api"
                  className="input w-full"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                <select
                  value={kbForm.status}
                  onChange={(e) => setKbForm(prev => ({ ...prev, status: e.target.value }))}
                  className="input w-full"
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>
              </div>
            </div>
            <div className="p-4 sm:p-5 border-t border-gray-100 dark:border-[#2C2C2E] flex justify-end gap-2">
              <button onClick={() => { setShowKBModal(false); setEditingArticle(null) }} className="btn btn-outline btn-sm">Cancel</button>
              <button
                onClick={handleSaveKB}
                disabled={createKBMutation.isPending || updateKBMutation.isPending}
                className="btn btn-primary btn-sm disabled:opacity-50"
              >
                {(createKBMutation.isPending || updateKBMutation.isPending) ? (
                  <RefreshCw className="w-4 h-4 animate-spin mr-1" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 mr-1" />
                )}
                {editingArticle ? 'Save Changes' : 'Create Article'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Support
