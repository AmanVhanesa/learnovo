import { useState, useCallback, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { superAdminService } from '../../services/superAdminService'
import toast from 'react-hot-toast'
import {
  Megaphone, Clock, Mail, History, Plus, Eye, Trash2, Edit2, X, Send,
  Search, ChevronLeft, ChevronRight, AlertTriangle, Bell, MessageSquare,
  Smartphone, Calendar, Paperclip, Copy, FlaskConical, FileText,
  Inbox, XCircle
} from 'lucide-react'

// ─── Toggle Component ────────────────────────────────────────────────────────
const Toggle = ({ enabled, onChange, disabled = false, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={enabled}
    aria-label={label}
    disabled={disabled}
    onClick={() => !disabled && onChange(!enabled)}
    className={`relative inline-flex flex-shrink-0 w-9 h-5 rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:focus-visible:ring-[#3EC4B1] ${
      disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
    } ${
      enabled
        ? 'bg-primary-500 dark:bg-[#3EC4B1]'
        : 'bg-gray-300 dark:bg-[#38383A]'
    }`}
  >
    <span
      className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200 ease-in-out ${
        enabled ? 'translate-x-4' : 'translate-x-0.5'
      } translate-y-[2px]`}
    />
  </button>
)

// ─── Tab config ──────────────────────────────────────────────────────────────
const TABS = [
  { key: 'announcements', label: 'Announcements', icon: Megaphone },
  { key: 'scheduled', label: 'Scheduled', icon: Clock },
  { key: 'templates', label: 'Email Templates', icon: Mail },
  { key: 'history', label: 'Email History', icon: History },
]

const PLAN_OPTIONS = [
  { value: 'free_trial', label: 'Free Trial' },
  { value: 'basic', label: 'Basic' },
  { value: 'pro', label: 'Pro' },
  { value: 'enterprise', label: 'Enterprise' },
]

// ─── Status badge helper ─────────────────────────────────────────────────────
const statusBadge = (status) => {
  const map = {
    sent: 'bg-emerald-50 text-emerald-700 dark:bg-[rgba(48,209,88,0.12)] dark:text-[#30D158]',
    delivered: 'bg-emerald-50 text-emerald-700 dark:bg-[rgba(48,209,88,0.12)] dark:text-[#30D158]',
    active: 'bg-emerald-50 text-emerald-700 dark:bg-[rgba(48,209,88,0.12)] dark:text-[#30D158]',
    scheduled: 'bg-amber-50 text-amber-700 dark:bg-[rgba(255,214,10,0.12)] dark:text-[#FFD60A]',
    pending: 'bg-amber-50 text-amber-700 dark:bg-[rgba(255,214,10,0.12)] dark:text-[#FFD60A]',
    draft: 'bg-gray-50 text-gray-600 dark:bg-[rgba(142,142,147,0.12)] dark:text-[#8E8E93]',
    cancelled: 'bg-red-50 text-red-700 dark:bg-[rgba(255,69,58,0.12)] dark:text-[#FF453A]',
    failed: 'bg-red-50 text-red-700 dark:bg-[rgba(255,69,58,0.12)] dark:text-[#FF453A]',
    bounced: 'bg-red-50 text-red-700 dark:bg-[rgba(255,69,58,0.12)] dark:text-[#FF453A]',
  }
  const cls = map[status?.toLowerCase()] || map.draft
  return `inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${cls}`
}

const formatDate = (d) => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}

// ─── Skeleton rows ───────────────────────────────────────────────────────────
const TableSkeleton = ({ rows = 5, cols = 5 }) => (
  Array.from({ length: rows }).map((_, i) => (
    <tr key={i}>
      {Array.from({ length: cols }).map((_, j) => (
        <td key={j} className="px-4 py-3">
          <div className="h-4 bg-gray-200/60 rounded-xl animate-pulse dark:bg-[#2C2C2E]" style={{ width: `${50 + Math.random() * 40}%` }} />
        </td>
      ))}
    </tr>
  ))
)

const CardSkeleton = ({ count = 4 }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-gray-100 dark:border-[#38383A] p-4 space-y-3">
        <div className="h-5 bg-gray-200/60 rounded-xl animate-pulse dark:bg-[#2C2C2E] w-2/3" />
        <div className="h-4 bg-gray-200/60 rounded-xl animate-pulse dark:bg-[#2C2C2E] w-full" />
        <div className="h-4 bg-gray-200/60 rounded-xl animate-pulse dark:bg-[#2C2C2E] w-1/2" />
        <div className="flex gap-2">
          <div className="h-8 bg-gray-200/60 rounded-xl animate-pulse dark:bg-[#2C2C2E] w-16" />
          <div className="h-8 bg-gray-200/60 rounded-xl animate-pulse dark:bg-[#2C2C2E] w-16" />
        </div>
      </div>
    ))}
  </div>
)

const EmptyState = ({ icon: Icon, title, description }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <div className="w-12 h-12 bg-gray-50 dark:bg-[#2C2C2E] rounded-full flex items-center justify-center mb-3">
      <Icon className="h-5 w-5 text-gray-400 dark:text-[#636366]" />
    </div>
    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
    <p className="mt-1 text-xs text-gray-500 dark:text-[#8E8E93] max-w-xs">{description}</p>
  </div>
)

// ─── Pagination Component ────────────────────────────────────────────────────
const Pagination = ({ page, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-between pt-3">
      <p className="text-xs text-gray-500 dark:text-[#8E8E93]">Page {page} of {totalPages}</p>
      <div className="flex gap-1.5">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-gray-200 dark:border-[#38383A] text-gray-600 dark:text-[#8E8E93] hover:bg-gray-50 dark:hover:bg-[#2C2C2E] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-gray-200 dark:border-[#38383A] text-gray-600 dark:text-[#8E8E93] hover:bg-gray-50 dark:hover:bg-[#2C2C2E] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

// ─── Compose Announcement Modal ──────────────────────────────────────────────
const ComposeAnnouncementModal = ({ open, onClose, editData, onSuccess }) => {
  const [title, setTitle] = useState(editData?.title || '')
  const [message, setMessage] = useState(editData?.message || '')
  const [attachment, setAttachment] = useState(null)
  const [targetType, setTargetType] = useState(editData?.targetType || 'all')
  const [selectedPlans, setSelectedPlans] = useState(editData?.selectedPlans || [])
  const [selectedSchools, setSelectedSchools] = useState(editData?.selectedSchools || [])
  const [schoolSearch, setSchoolSearch] = useState('')
  const [channelEmail, setChannelEmail] = useState(editData?.channels?.email ?? false)
  const [channelSms, setChannelSms] = useState(editData?.channels?.sms ?? false)
  const [scheduleType, setScheduleType] = useState(editData?.scheduledAt ? 'later' : 'now')
  const [scheduleDate, setScheduleDate] = useState(editData?.scheduledAt ? editData.scheduledAt.split('T')[0] : '')
  const [scheduleTime, setScheduleTime] = useState(editData?.scheduledAt ? editData.scheduledAt.split('T')[1]?.slice(0, 5) : '')
  const [showPreview, setShowPreview] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const searchDebounce = useRef(null)

  const { data: searchResults, isFetching: isSearching } = useQuery({
    queryKey: ['tenant-search', schoolSearch],
    queryFn: async () => {
      if (!schoolSearch || schoolSearch.length < 2) return []
      const res = await superAdminService.searchTenants(schoolSearch)
      return res.data || []
    },
    enabled: schoolSearch.length >= 2 && targetType === 'specific',
  })

  const handleSchoolSearchInput = useCallback((value) => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current)
    searchDebounce.current = setTimeout(() => setSchoolSearch(value), 300)
  }, [])

  const addSchool = (school) => {
    if (!selectedSchools.find(s => s._id === school._id)) {
      setSelectedSchools(prev => [...prev, school])
    }
    setSchoolSearch('')
  }

  const removeSchool = (id) => {
    setSelectedSchools(prev => prev.filter(s => s._id !== id))
  }

  const togglePlan = (plan) => {
    setSelectedPlans(prev =>
      prev.includes(plan) ? prev.filter(p => p !== plan) : [...prev, plan]
    )
  }

  const handleSubmit = async () => {
    if (!title.trim()) return toast.error('Title is required')
    if (!message.trim()) return toast.error('Message is required')
    if (targetType === 'plan' && selectedPlans.length === 0) return toast.error('Select at least one plan')
    if (targetType === 'specific' && selectedSchools.length === 0) return toast.error('Select at least one school')
    if (scheduleType === 'later' && (!scheduleDate || !scheduleTime)) return toast.error('Set schedule date and time')

    setSubmitting(true)
    try {
      const payload = {
        title: title.trim(),
        message: message.trim(),
        targetType,
        selectedPlans: targetType === 'plan' ? selectedPlans : undefined,
        selectedSchools: targetType === 'specific' ? selectedSchools.map(s => s._id) : undefined,
        channels: { inApp: true, email: channelEmail, sms: channelSms },
        scheduledAt: scheduleType === 'later' ? `${scheduleDate}T${scheduleTime}` : undefined,
      }
      if (editData?._id) {
        await superAdminService.updateAnnouncement(editData._id, payload)
        toast.success('Announcement updated')
      } else {
        await superAdminService.createAnnouncement(payload)
        toast.success(scheduleType === 'later' ? 'Announcement scheduled' : 'Announcement sent')
      }
      onSuccess()
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save announcement')
    } finally {
      setSubmitting(false)
    }
  }

  const handlePreview = async () => {
    try {
      await superAdminService.previewAnnouncement({ title, message })
      setShowPreview(true)
    } catch {
      setShowPreview(true)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#1C1C1E] rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-scale-in" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gray-100 dark:border-[#38383A]">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            {editData ? 'Edit Announcement' : 'New Announcement'}
          </h2>
          <button onClick={onClose} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-gray-100 dark:hover:bg-[#2C2C2E] transition-colors">
            <X className="h-4 w-4 text-gray-500 dark:text-[#8E8E93]" />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Title *</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Announcement title"
              className="input w-full"
            />
          </div>

          {/* Message */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Message *</label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Write your announcement message..."
              rows={6}
              className="input w-full resize-y"
            />
          </div>

          {/* Attachment */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              <Paperclip className="inline h-3.5 w-3.5 mr-1" />Attachment (optional)
            </label>
            <input
              type="file"
              onChange={e => setAttachment(e.target.files?.[0] || null)}
              className="block w-full text-xs text-gray-500 dark:text-[#8E8E93] file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary-50 file:text-primary-700 dark:file:bg-[rgba(62,196,177,0.12)] dark:file:text-[#3EC4B1] hover:file:bg-primary-100"
            />
            {attachment && (
              <p className="mt-1 text-xs text-gray-500 dark:text-[#8E8E93]">{attachment.name}</p>
            )}
          </div>

          {/* Target Audience */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Target Audience</label>
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'all', label: 'All Tenants' },
                { value: 'plan', label: 'By Plan' },
                { value: 'specific', label: 'Specific Schools' },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setTargetType(opt.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    targetType === opt.value
                      ? 'bg-primary-50 border-primary-300 text-primary-700 dark:bg-[rgba(62,196,177,0.12)] dark:border-[#3EC4B1] dark:text-[#3EC4B1]'
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 dark:bg-[#1C1C1E] dark:border-[#38383A] dark:text-[#8E8E93] dark:hover:bg-[#2C2C2E]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* By Plan checkboxes */}
            {targetType === 'plan' && (
              <div className="mt-3 flex flex-wrap gap-2">
                {PLAN_OPTIONS.map(p => (
                  <label key={p.value} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-[#38383A] cursor-pointer hover:bg-gray-50 dark:hover:bg-[#2C2C2E] transition-colors">
                    <input
                      type="checkbox"
                      checked={selectedPlans.includes(p.value)}
                      onChange={() => togglePlan(p.value)}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{p.label}</span>
                  </label>
                ))}
              </div>
            )}

            {/* Specific Schools search */}
            {targetType === 'specific' && (
              <div className="mt-3 space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-[#636366] pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search schools..."
                    onChange={e => handleSchoolSearchInput(e.target.value)}
                    className="input w-full pl-9"
                  />
                </div>
                {isSearching && <p className="text-xs text-gray-400 dark:text-[#636366]">Searching...</p>}
                {searchResults && searchResults.length > 0 && (
                  <div className="border border-gray-200 dark:border-[#38383A] rounded-xl max-h-32 overflow-y-auto">
                    {searchResults.map(s => (
                      <button
                        key={s._id}
                        onClick={() => addSchool(s)}
                        className="w-full text-left px-3 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-primary-50 dark:hover:bg-[#2C2C2E] transition-colors"
                      >
                        {s.schoolName || s.organizationName}
                      </button>
                    ))}
                  </div>
                )}
                {selectedSchools.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedSchools.map(s => (
                      <span key={s._id} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-primary-50 text-primary-700 dark:bg-[rgba(62,196,177,0.12)] dark:text-[#3EC4B1] text-xs font-medium">
                        {s.schoolName || s.organizationName}
                        <button onClick={() => removeSchool(s._id)} className="hover:text-red-500 transition-colors">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Delivery Channels */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Delivery Channels</label>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-primary-500 dark:text-[#3EC4B1]" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">In-App</span>
                </div>
                <span className="text-xs text-gray-400 dark:text-[#636366]">Always on</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-blue-500" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Email</span>
                </div>
                <Toggle enabled={channelEmail} onChange={setChannelEmail} label="Email channel" />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">SMS</span>
                </div>
                <div className="flex items-center gap-2">
                  <Toggle enabled={channelSms} onChange={setChannelSms} disabled label="SMS channel" />
                  <span className="text-[10px] text-gray-400 dark:text-[#636366]">Not configured</span>
                </div>
              </div>
            </div>
          </div>

          {/* Schedule */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Schedule</label>
            <div className="flex gap-3">
              {[
                { value: 'now', label: 'Send Now' },
                { value: 'later', label: 'Schedule for Later' },
              ].map(opt => (
                <label key={opt.value} className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="schedule"
                    checked={scheduleType === opt.value}
                    onChange={() => setScheduleType(opt.value)}
                    className="text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{opt.label}</span>
                </label>
              ))}
            </div>
            {scheduleType === 'later' && (
              <div className="mt-3 flex gap-3">
                <input
                  type="date"
                  value={scheduleDate}
                  onChange={e => setScheduleDate(e.target.value)}
                  className="input flex-1"
                />
                <input
                  type="time"
                  value={scheduleTime}
                  onChange={e => setScheduleTime(e.target.value)}
                  className="input flex-1"
                />
              </div>
            )}
          </div>

          {/* Preview section */}
          {showPreview && (
            <div className="border border-gray-200 dark:border-[#38383A] rounded-xl p-4 space-y-2">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Preview</h4>
              <div className="bg-gray-50 dark:bg-[#2C2C2E] rounded-lg p-3">
                <p className="text-sm font-bold text-gray-900 dark:text-white">{title || 'Untitled'}</p>
                <p className="mt-1 text-xs text-gray-600 dark:text-[#8E8E93] whitespace-pre-wrap">{message || 'No message'}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 p-4 sm:p-5 border-t border-gray-100 dark:border-[#38383A]">
          <button
            onClick={handlePreview}
            className="inline-flex items-center justify-center gap-2 h-10 px-4 text-sm font-semibold rounded-xl border border-gray-300 dark:border-[#38383A] text-gray-700 dark:text-white bg-white dark:bg-transparent hover:bg-gray-50 dark:hover:bg-[#2C2C2E] active:scale-[0.97] transition-all"
          >
            <Eye className="h-4 w-4" /> Preview
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="inline-flex items-center justify-center gap-2 h-10 px-5 text-sm font-semibold rounded-xl bg-primary-600 dark:bg-[#3EC4B1] text-white dark:text-black hover:bg-primary-500 dark:hover:bg-[#35a89a] shadow-md active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <Send className="h-4 w-4" />
            {submitting ? 'Sending...' : scheduleType === 'later' ? 'Schedule' : editData ? 'Update' : 'Send Now'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Edit Email Template Modal ───────────────────────────────────────────────
const EditTemplateModal = ({ open, onClose, template, onSuccess }) => {
  const [subject, setSubject] = useState(template?.subject || '')
  const [htmlContent, setHtmlContent] = useState(template?.htmlContent || template?.content || '')
  const [showPreview, setShowPreview] = useState(false)
  const [previewHtml, setPreviewHtml] = useState('')
  const [saving, setSaving] = useState(false)
  const [sendingTest, setSendingTest] = useState(false)

  const variables = template?.variables || []

  const handleSave = async () => {
    setSaving(true)
    try {
      await superAdminService.updateEmailTemplate(template._id, { subject, htmlContent })
      toast.success('Template saved')
      onSuccess()
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save template')
    } finally {
      setSaving(false)
    }
  }

  const handlePreview = async () => {
    try {
      const res = await superAdminService.previewEmailTemplate(template._id)
      setPreviewHtml(res.data || htmlContent)
    } catch {
      setPreviewHtml(htmlContent)
    }
    setShowPreview(!showPreview)
  }

  const handleSendTest = async () => {
    if (!confirm('Send a test email with this template?')) return
    setSendingTest(true)
    try {
      await superAdminService.sendTestEmail(template._id)
      toast.success('Test email sent')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send test email')
    } finally {
      setSendingTest(false)
    }
  }

  const insertVariable = (variable) => {
    setHtmlContent(prev => prev + `{{${variable}}}`)
  }

  if (!open || !template) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#1C1C1E] rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto animate-scale-in" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gray-100 dark:border-[#38383A]">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Edit Template</h2>
          <button onClick={onClose} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-gray-100 dark:hover:bg-[#2C2C2E] transition-colors">
            <X className="h-4 w-4 text-gray-500 dark:text-[#8E8E93]" />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          {/* Template Name (read-only) */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Template Name</label>
            <div className="px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-[#2C2C2E] text-sm text-gray-600 dark:text-[#8E8E93] border border-gray-200 dark:border-[#38383A]">
              {template.name}
            </div>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Subject Line</label>
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              className="input w-full"
            />
          </div>

          {/* HTML Content */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">HTML Content</label>
            <textarea
              value={htmlContent}
              onChange={e => setHtmlContent(e.target.value)}
              rows={12}
              className="input w-full font-mono text-xs resize-y"
            />
          </div>

          {/* Available Variables */}
          {variables.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Available Variables</label>
              <div className="flex flex-wrap gap-1.5">
                {variables.map(v => (
                  <button
                    key={v}
                    onClick={() => insertVariable(v)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-100 dark:bg-[#2C2C2E] text-xs font-mono text-gray-600 dark:text-[#8E8E93] hover:bg-primary-50 hover:text-primary-700 dark:hover:bg-[rgba(62,196,177,0.12)] dark:hover:text-[#3EC4B1] transition-colors cursor-pointer"
                  >
                    <Copy className="h-3 w-3" />{`{{${v}}}`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Preview */}
          {showPreview && (
            <div className="border border-gray-200 dark:border-[#38383A] rounded-xl overflow-hidden">
              <div className="px-3 py-2 bg-gray-50 dark:bg-[#2C2C2E] text-xs font-semibold text-gray-500 dark:text-[#8E8E93]">Preview</div>
              <div
                className="p-4 bg-white dark:bg-[#1C1C1E] text-sm"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 p-4 sm:p-5 border-t border-gray-100 dark:border-[#38383A]">
          <div className="flex gap-2">
            <button
              onClick={handlePreview}
              className="inline-flex items-center justify-center gap-2 h-9 px-3 text-xs font-semibold rounded-xl border border-gray-300 dark:border-[#38383A] text-gray-700 dark:text-white bg-white dark:bg-transparent hover:bg-gray-50 dark:hover:bg-[#2C2C2E] active:scale-[0.97] transition-all"
            >
              <Eye className="h-3.5 w-3.5" /> {showPreview ? 'Hide Preview' : 'Preview'}
            </button>
            <button
              onClick={handleSendTest}
              disabled={sendingTest}
              className="inline-flex items-center justify-center gap-2 h-9 px-3 text-xs font-semibold rounded-xl border border-gray-300 dark:border-[#38383A] text-gray-700 dark:text-white bg-white dark:bg-transparent hover:bg-gray-50 dark:hover:bg-[#2C2C2E] active:scale-[0.97] disabled:opacity-50 transition-all"
            >
              <FlaskConical className="h-3.5 w-3.5" /> {sendingTest ? 'Sending...' : 'Send Test'}
            </button>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 h-10 px-5 text-sm font-semibold rounded-xl bg-primary-600 dark:bg-[#3EC4B1] text-white dark:text-black hover:bg-primary-500 dark:hover:bg-[#35a89a] shadow-md active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Communication Component ────────────────────────────────────────────
const Communication = () => {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('announcements')
  const [announcementsPage, setAnnouncementsPage] = useState(1)
  const [historyPage, setHistoryPage] = useState(1)
  const [showCompose, setShowCompose] = useState(false)
  const [editAnnouncementData, setEditAnnouncementData] = useState(null)
  const [viewAnnouncement, setViewAnnouncement] = useState(null)
  const [editTemplate, setEditTemplate] = useState(null)
  const [historyTypeFilter, setHistoryTypeFilter] = useState('')
  const [historyDateFrom, setHistoryDateFrom] = useState('')
  const [historyDateTo, setHistoryDateTo] = useState('')

  // ─── Announcements Query ─────────────────────────────────────────────────
  const { data: announcementsData, isLoading: loadingAnnouncements, error: announcementsError } = useQuery({
    queryKey: ['superadmin-announcements', announcementsPage],
    queryFn: async () => {
      const res = await superAdminService.getAnnouncements({ page: announcementsPage, limit: 10 })
      return { items: res.data || [], totalPages: res.pagination?.pages || 1 }
    },
    enabled: activeTab === 'announcements',
  })

  // ─── Scheduled Query ─────────────────────────────────────────────────────
  const { data: scheduledData, isLoading: loadingScheduled, error: scheduledError } = useQuery({
    queryKey: ['superadmin-scheduled-announcements'],
    queryFn: async () => {
      const res = await superAdminService.getScheduledAnnouncements({})
      return res.data || []
    },
    enabled: activeTab === 'scheduled',
  })

  // ─── Email Templates Query ──────────────────────────────────────────────
  const { data: templatesData, isLoading: loadingTemplates, error: templatesError } = useQuery({
    queryKey: ['superadmin-email-templates'],
    queryFn: async () => {
      const res = await superAdminService.getEmailTemplates()
      return res.data || []
    },
    enabled: activeTab === 'templates',
  })

  // ─── Email History Query ────────────────────────────────────────────────
  const { data: historyData, isLoading: loadingHistory, error: historyError } = useQuery({
    queryKey: ['superadmin-email-history', historyPage, historyTypeFilter, historyDateFrom, historyDateTo],
    queryFn: async () => {
      const params = { page: historyPage, limit: 20 }
      if (historyTypeFilter) params.type = historyTypeFilter
      if (historyDateFrom) params.dateFrom = historyDateFrom
      if (historyDateTo) params.dateTo = historyDateTo
      const res = await superAdminService.getEmailHistory(params)
      return { items: res.data || [], totalPages: res.pagination?.pages || 1 }
    },
    enabled: activeTab === 'history',
  })

  // ─── Mutations ──────────────────────────────────────────────────────────
  const deleteAnnouncementMutation = useMutation({
    mutationFn: (id) => superAdminService.deleteAnnouncement(id),
    onSuccess: () => {
      toast.success('Announcement deleted')
      queryClient.invalidateQueries({ queryKey: ['superadmin-announcements'] })
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to delete'),
  })

  const cancelAnnouncementMutation = useMutation({
    mutationFn: (id) => superAdminService.cancelAnnouncement(id),
    onSuccess: () => {
      toast.success('Scheduled announcement cancelled')
      queryClient.invalidateQueries({ queryKey: ['superadmin-scheduled-announcements'] })
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to cancel'),
  })

  const handleDelete = (id) => {
    if (!confirm('Are you sure you want to delete this announcement?')) return
    deleteAnnouncementMutation.mutate(id)
  }

  const handleCancel = (id) => {
    if (!confirm('Cancel this scheduled announcement? This cannot be undone.')) return
    cancelAnnouncementMutation.mutate(id)
  }

  const handleComposeSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['superadmin-announcements'] })
    queryClient.invalidateQueries({ queryKey: ['superadmin-scheduled-announcements'] })
  }

  const handleTemplateSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['superadmin-email-templates'] })
  }

  const openEdit = (item) => {
    setEditAnnouncementData(item)
    setShowCompose(true)
  }

  const openCompose = () => {
    setEditAnnouncementData(null)
    setShowCompose(true)
  }

  const channelIcon = (ch) => {
    if (ch === 'inApp') return <Bell className="h-3.5 w-3.5 text-primary-500 dark:text-[#3EC4B1]" />
    if (ch === 'email') return <Mail className="h-3.5 w-3.5 text-blue-500" />
    if (ch === 'sms') return <Smartphone className="h-3.5 w-3.5 text-green-500" />
    return null
  }

  const getTargetLabel = (item) => {
    if (item.targetType === 'all') return 'All Tenants'
    if (item.targetType === 'plan') return `Plans: ${(item.selectedPlans || []).join(', ')}`
    if (item.targetType === 'specific') return `${(item.selectedSchools || []).length} School(s)`
    return item.targetType || '—'
  }

  // ─── Error component ───────────────────────────────────────────────────
  const ErrorBanner = ({ error: err }) => (
    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4 flex items-center gap-2">
      <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
      <p className="text-sm text-red-600 dark:text-red-400">{err?.response?.data?.message || err?.message || 'Something went wrong'}</p>
    </div>
  )

  // ─── Render Announcements Tab ──────────────────────────────────────────
  const renderAnnouncements = () => {
    const items = announcementsData?.items || []
    const totalPages = announcementsData?.totalPages || 1

    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <button onClick={openCompose} className="inline-flex items-center justify-center gap-2 h-10 px-4 text-sm font-semibold rounded-xl bg-primary-600 dark:bg-[#3EC4B1] text-white dark:text-black hover:bg-primary-500 dark:hover:bg-[#35a89a] shadow-md active:scale-[0.97] transition-all">
            <Plus className="h-4 w-4" /> New Announcement
          </button>
        </div>

        {announcementsError && <ErrorBanner error={announcementsError} />}

        <div className="rounded-2xl overflow-hidden shadow-glass">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50/80 dark:bg-[#2C2C2E]">
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Title</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Target</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Channels</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Date</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Delivery</th>
                  <th className="text-right px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-[#1C1C1E]">
                {loadingAnnouncements ? (
                  <TableSkeleton rows={5} cols={6} />
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <EmptyState icon={Megaphone} title="No announcements yet" description="Create your first announcement to communicate with tenant schools." />
                    </td>
                  </tr>
                ) : (
                  items.map(item => (
                    <tr key={item._id} className="border-b border-gray-50 dark:border-[#2C2C2E] hover:bg-primary-50 dark:hover:bg-[#2C2C2E] transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white truncate max-w-[200px]">{item.title}</p>
                        <p className="text-[11px] text-gray-400 dark:text-[#636366] sm:hidden mt-0.5">{formatDate(item.createdAt)}</p>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className="text-xs text-gray-600 dark:text-[#8E8E93]">{getTargetLabel(item)}</span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <div className="flex items-center gap-1.5">
                          {item.channels && Object.entries(item.channels).filter(([, v]) => v).map(([k]) => (
                            <span key={k} title={k}>{channelIcon(k)}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="text-xs text-gray-500 dark:text-[#8E8E93]">{formatDate(item.createdAt)}</span>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                          {item.deliveredCount ?? 0}/{item.totalRecipients ?? 0}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setViewAnnouncement(item)}
                            className="h-8 w-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-[rgba(62,196,177,0.12)] dark:hover:text-[#3EC4B1] transition-colors"
                            title="View"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {item.status !== 'sent' && (
                            <button
                              onClick={() => handleDelete(item._id)}
                              className="h-8 w-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 dark:hover:text-[#FF453A] transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {!loadingAnnouncements && items.length > 0 && (
            <div className="px-4 py-3 bg-white dark:bg-[#1C1C1E] border-t border-gray-50 dark:border-[#2C2C2E]">
              <Pagination page={announcementsPage} totalPages={totalPages} onPageChange={setAnnouncementsPage} />
            </div>
          )}
        </div>
      </div>
    )
  }

  // ─── Render Scheduled Tab ─────────────────────────────────────────────
  const renderScheduled = () => {
    const items = scheduledData || []

    return (
      <div className="space-y-4">
        {scheduledError && <ErrorBanner error={scheduledError} />}

        <div className="rounded-2xl overflow-hidden shadow-glass">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50/80 dark:bg-[#2C2C2E]">
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Title</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Target</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Scheduled For</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Preview</th>
                  <th className="text-right px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-[#1C1C1E]">
                {loadingScheduled ? (
                  <TableSkeleton rows={3} cols={5} />
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      <EmptyState icon={Clock} title="No scheduled announcements" description="Schedule an announcement to send it at a later date and time." />
                    </td>
                  </tr>
                ) : (
                  items.map(item => (
                    <tr key={item._id} className="border-b border-gray-50 dark:border-[#2C2C2E] hover:bg-primary-50 dark:hover:bg-[#2C2C2E] transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white">{item.title}</p>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className="text-xs text-gray-600 dark:text-[#8E8E93]">{getTargetLabel(item)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-amber-500" />
                          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{formatDate(item.scheduledAt)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <p className="text-xs text-gray-500 dark:text-[#8E8E93] truncate max-w-[200px]">{item.message}</p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEdit(item)}
                            className="h-8 w-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-[rgba(62,196,177,0.12)] dark:hover:text-[#3EC4B1] transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleCancel(item._id)}
                            className="h-8 w-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 dark:hover:text-[#FF453A] transition-colors"
                            title="Cancel"
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  // ─── Render Email Templates Tab ───────────────────────────────────────
  const renderTemplates = () => {
    const items = templatesData || []

    if (templatesError) return <ErrorBanner error={templatesError} />

    if (loadingTemplates) return <CardSkeleton count={6} />

    if (items.length === 0) {
      return <EmptyState icon={Mail} title="No email templates" description="Email templates will appear here once configured in the system." />
    }

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map(tpl => (
          <div key={tpl._id} className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-gray-100 dark:border-[#38383A] p-3 sm:p-4 lg:p-5 flex flex-col shadow-glass">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">{tpl.name}</h3>
                  {tpl.type && <p className="text-[11px] text-gray-400 dark:text-[#636366]">{tpl.type}</p>}
                </div>
              </div>
            </div>

            <p className="text-xs text-gray-600 dark:text-[#8E8E93] mb-3 line-clamp-2">{tpl.subject || 'No subject'}</p>

            {tpl.variables && tpl.variables.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {tpl.variables.slice(0, 4).map(v => (
                  <span key={v} className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-[#2C2C2E] text-[10px] font-mono text-gray-500 dark:text-[#8E8E93]">
                    {`{{${v}}}`}
                  </span>
                ))}
                {tpl.variables.length > 4 && (
                  <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-[#2C2C2E] text-[10px] text-gray-400 dark:text-[#636366]">
                    +{tpl.variables.length - 4} more
                  </span>
                )}
              </div>
            )}

            <div className="mt-auto flex items-center gap-2 pt-2 border-t border-gray-50 dark:border-[#2C2C2E]">
              <button
                onClick={() => setEditTemplate(tpl)}
                className="inline-flex items-center gap-1 h-8 px-2.5 text-xs font-semibold rounded-lg border border-gray-200 dark:border-[#38383A] text-gray-700 dark:text-white bg-white dark:bg-transparent hover:bg-gray-50 dark:hover:bg-[#2C2C2E] active:scale-[0.97] transition-all"
              >
                <Edit2 className="h-3 w-3" /> Edit
              </button>
              <button
                onClick={async () => {
                  try {
                    const res = await superAdminService.previewEmailTemplate(tpl._id)
                    const win = window.open('', '_blank')
                    if (win) { win.document.write(res.data || '<p>No preview available</p>'); win.document.close() }
                  } catch {
                    toast.error('Failed to load preview')
                  }
                }}
                className="inline-flex items-center gap-1 h-8 px-2.5 text-xs font-semibold rounded-lg border border-gray-200 dark:border-[#38383A] text-gray-700 dark:text-white bg-white dark:bg-transparent hover:bg-gray-50 dark:hover:bg-[#2C2C2E] active:scale-[0.97] transition-all"
              >
                <Eye className="h-3 w-3" /> Preview
              </button>
              <button
                onClick={async () => {
                  if (!confirm('Send a test email for this template?')) return
                  try {
                    await superAdminService.sendTestEmail(tpl._id)
                    toast.success('Test email sent')
                  } catch (err) {
                    toast.error(err.response?.data?.message || 'Failed to send test')
                  }
                }}
                className="inline-flex items-center gap-1 h-8 px-2.5 text-xs font-semibold rounded-lg border border-gray-200 dark:border-[#38383A] text-gray-700 dark:text-white bg-white dark:bg-transparent hover:bg-gray-50 dark:hover:bg-[#2C2C2E] active:scale-[0.97] transition-all"
              >
                <FlaskConical className="h-3 w-3" /> Test
              </button>
            </div>
          </div>
        ))}
      </div>
    )
  }

  // ─── Render Email History Tab ─────────────────────────────────────────
  const renderHistory = () => {
    const items = historyData?.items || []
    const totalPages = historyData?.totalPages || 1

    return (
      <div className="space-y-4">
        {/* Filters */}
        <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-gray-100 dark:border-[#38383A] p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-shrink-0">
              <select
                value={historyTypeFilter}
                onChange={e => { setHistoryTypeFilter(e.target.value); setHistoryPage(1) }}
                className="block w-full sm:w-auto pl-3 pr-8 h-10 text-sm border border-gray-200 dark:border-[#38383A] rounded-xl bg-white dark:bg-[#1C1C1E] dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-[#3EC4B1] transition-colors"
              >
                <option value="">All Types</option>
                <option value="welcome">Welcome</option>
                <option value="announcement">Announcement</option>
                <option value="billing">Billing</option>
                <option value="notification">Notification</option>
                <option value="password_reset">Password Reset</option>
              </select>
            </div>
            <input
              type="date"
              value={historyDateFrom}
              onChange={e => { setHistoryDateFrom(e.target.value); setHistoryPage(1) }}
              className="input flex-1 sm:flex-none sm:w-36"
              placeholder="From"
            />
            <input
              type="date"
              value={historyDateTo}
              onChange={e => { setHistoryDateTo(e.target.value); setHistoryPage(1) }}
              className="input flex-1 sm:flex-none sm:w-36"
              placeholder="To"
            />
            {(historyTypeFilter || historyDateFrom || historyDateTo) && (
              <button
                onClick={() => { setHistoryTypeFilter(''); setHistoryDateFrom(''); setHistoryDateTo(''); setHistoryPage(1) }}
                className="text-xs text-gray-500 dark:text-[#8E8E93] hover:text-red-500 font-semibold px-3 h-10 rounded-xl border border-gray-200 dark:border-[#38383A] hover:border-red-200 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors whitespace-nowrap"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {historyError && <ErrorBanner error={historyError} />}

        <div className="rounded-2xl overflow-hidden shadow-glass">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50/80 dark:bg-[#2C2C2E]">
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Recipient</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Subject</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Type</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Date</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-[#1C1C1E]">
                {loadingHistory ? (
                  <TableSkeleton rows={8} cols={5} />
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      <EmptyState icon={Inbox} title="No email history" description="Sent emails and their delivery status will appear here." />
                    </td>
                  </tr>
                ) : (
                  items.map((item, idx) => (
                    <tr key={item._id || idx} className="border-b border-gray-50 dark:border-[#2C2C2E] hover:bg-primary-50 dark:hover:bg-[#2C2C2E] transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white truncate max-w-[180px]">{item.recipient || item.email || '—'}</p>
                        <p className="text-[11px] text-gray-400 dark:text-[#636366] sm:hidden mt-0.5 truncate">{item.subject}</p>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <p className="text-xs text-gray-600 dark:text-[#8E8E93] truncate max-w-[220px]">{item.subject || '—'}</p>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 dark:bg-[#2C2C2E] text-[11px] font-medium text-gray-600 dark:text-[#8E8E93] capitalize">
                          {item.type || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={statusBadge(item.status)}>
                          {item.status || 'unknown'}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="text-xs text-gray-500 dark:text-[#8E8E93]">{formatDate(item.sentAt || item.createdAt)}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {!loadingHistory && items.length > 0 && (
            <div className="px-4 py-3 bg-white dark:bg-[#1C1C1E] border-t border-gray-50 dark:border-[#2C2C2E]">
              <Pagination page={historyPage} totalPages={totalPages} onPageChange={setHistoryPage} />
            </div>
          )}
        </div>
      </div>
    )
  }

  // ─── View Announcement Detail Modal ───────────────────────────────────
  const renderViewModal = () => {
    if (!viewAnnouncement) return null
    const item = viewAnnouncement
    return (
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setViewAnnouncement(null)}>
        <div className="bg-white dark:bg-[#1C1C1E] rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-scale-in" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gray-100 dark:border-[#38383A]">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Announcement Detail</h2>
            <button onClick={() => setViewAnnouncement(null)} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-gray-100 dark:hover:bg-[#2C2C2E] transition-colors">
              <X className="h-4 w-4 text-gray-500 dark:text-[#8E8E93]" />
            </button>
          </div>
          <div className="p-4 sm:p-5 space-y-4">
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider mb-1">Title</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{item.title}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider mb-1">Message</p>
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{item.message}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider mb-1">Target</p>
                <p className="text-sm text-gray-700 dark:text-gray-300">{getTargetLabel(item)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider mb-1">Channels</p>
                <div className="flex gap-1.5">
                  {item.channels && Object.entries(item.channels).filter(([, v]) => v).map(([k]) => (
                    <span key={k}>{channelIcon(k)}</span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider mb-1">Delivery</p>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{item.deliveredCount ?? 0}/{item.totalRecipients ?? 0} delivered</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider mb-1">Date</p>
                <p className="text-sm text-gray-700 dark:text-gray-300">{formatDate(item.createdAt)}</p>
              </div>
            </div>
            {item.status && (
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider mb-1">Status</p>
                <span className={statusBadge(item.status)}>{item.status}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-[-0.025em]">Communication</h1>
        <p className="mt-0.5 text-sm text-gray-500 dark:text-[#8E8E93]">Manage announcements, email templates, and communication history</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-[#2C2C2E] rounded-xl overflow-x-auto">
        {TABS.map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-white dark:bg-[#1C1C1E] text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-[#8E8E93] hover:text-gray-700 dark:hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'announcements' && renderAnnouncements()}
      {activeTab === 'scheduled' && renderScheduled()}
      {activeTab === 'templates' && renderTemplates()}
      {activeTab === 'history' && renderHistory()}

      {/* Modals */}
      <ComposeAnnouncementModal
        open={showCompose}
        onClose={() => { setShowCompose(false); setEditAnnouncementData(null) }}
        editData={editAnnouncementData}
        onSuccess={handleComposeSuccess}
      />

      <EditTemplateModal
        open={!!editTemplate}
        onClose={() => setEditTemplate(null)}
        template={editTemplate}
        onSuccess={handleTemplateSuccess}
      />

      {renderViewModal()}
    </div>
  )
}

export default Communication
