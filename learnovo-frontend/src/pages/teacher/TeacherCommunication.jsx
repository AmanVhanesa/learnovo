import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Send, MessageSquare, Clock, Trash2, X, Users, Search, AlertCircle } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { attendanceService } from '../../services/attendanceService'
import announcementsService from '../../services/announcementsService'
import toast from 'react-hot-toast'

const TeacherCommunication = () => {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState('compose')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null)

  // Compose form state
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [targetType, setTargetType] = useState('my-classes')
  const [selectedClassId, setSelectedClassId] = useState('')
  const [priority, setPriority] = useState('medium')

  // Fetch teacher's classes
  const { data: myClasses = [] } = useQuery({
    queryKey: ['teacher-comm-classes'],
    queryFn: async () => {
      const res = await attendanceService.getTeacherClasses()
      return res?.data || []
    },
  })

  // Fetch sent announcements (all, then filter to teacher's)
  const { data: sentAnnouncements = [], isLoading: historyLoading } = useQuery({
    queryKey: ['teacher-announcements'],
    queryFn: async () => {
      const res = await announcementsService.getAnnouncements({ limit: 100 })
      const all = res?.data || []
      return all.filter(a => {
        const creatorId = a.createdBy?._id || a.createdBy
        return creatorId === user._id || creatorId === user.id
      })
    },
  })

  // Create announcement mutation
  const createMutation = useMutation({
    mutationFn: async (data) => announcementsService.createAnnouncement(data),
    onSuccess: () => {
      toast.success('Announcement sent successfully!')
      queryClient.invalidateQueries({ queryKey: ['teacher-announcements'] })
      setTitle('')
      setMessage('')
      setTargetType('my-classes')
      setSelectedClassId('')
      setPriority('medium')
      setActiveTab('sent')
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || 'Failed to send announcement')
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id) => announcementsService.deleteAnnouncement(id),
    onSuccess: () => {
      toast.success('Announcement deleted')
      queryClient.invalidateQueries({ queryKey: ['teacher-announcements'] })
      setShowDeleteConfirm(null)
    },
    onError: () => toast.error('Failed to delete announcement'),
  })

  const handleSend = (e) => {
    e.preventDefault()
    if (!title.trim() || !message.trim()) {
      toast.error('Title and message are required')
      return
    }

    let targetAudience = ['student']
    let targetClasses = []

    if (targetType === 'my-classes') {
      targetClasses = myClasses.map(c => c._id)
    } else if (targetType === 'specific-class') {
      if (!selectedClassId) { toast.error('Please select a class'); return }
      targetClasses = [selectedClassId]
    } else if (targetType === 'parents') {
      targetAudience = ['parent']
      targetClasses = myClasses.map(c => c._id)
    }

    createMutation.mutate({
      title: title.trim(),
      message: message.trim(),
      targetAudience,
      targetClasses,
      priority,
    })
  }

  const getPriorityBadge = (p) => {
    switch (p) {
      case 'high': return 'bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-[rgba(255,69,58,0.12)] dark:text-[#FF453A] dark:ring-0'
      case 'medium': return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-[rgba(255,214,10,0.12)] dark:text-[#FFD60A] dark:ring-0'
      default: return 'bg-gray-50 text-gray-600 ring-1 ring-gray-200 dark:bg-[rgba(142,142,147,0.12)] dark:text-[#8E8E93] dark:ring-0'
    }
  }

  const tabs = [
    { id: 'compose', label: 'Compose', icon: Send },
    { id: 'sent', label: 'Sent History', icon: Clock },
  ]

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Communication</h1>
        <p className="text-sm text-gray-500 dark:text-[#8E8E93] mt-1">
          Send announcements to your class students and parents
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="card p-4 sm:p-5 text-center">
          <MessageSquare className="h-6 w-6 text-primary-500 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{sentAnnouncements.length}</p>
          <p className="text-sm text-gray-500 dark:text-[#8E8E93]">Announcements Sent</p>
        </div>
        <div className="card p-4 sm:p-5 text-center">
          <Users className="h-6 w-6 text-blue-500 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{myClasses.length}</p>
          <p className="text-sm text-gray-500 dark:text-[#8E8E93]">My Classes</p>
        </div>
        <div className="card p-4 sm:p-5 text-center col-span-2 sm:col-span-1">
          <AlertCircle className="h-6 w-6 text-amber-500 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {sentAnnouncements.filter(a => a.priority === 'high').length}
          </p>
          <p className="text-sm text-gray-500 dark:text-[#8E8E93]">High Priority</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-[#38383A] overflow-x-auto overflow-y-hidden">
        <nav className="-mb-px flex space-x-4 sm:space-x-8 whitespace-nowrap">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-gray-500 dark:text-[#8E8E93] hover:text-gray-700 dark:hover:text-white hover:border-gray-300 dark:hover:border-[#38383A]'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Compose Tab */}
      {activeTab === 'compose' && (
        <div className="card p-4 sm:p-6">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">New Announcement</h2>
          <form onSubmit={handleSend} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1.5">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Announcement title"
                className="w-full px-3 py-2 input"
                required
                maxLength={200}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1.5">
                Message <span className="text-red-500">*</span>
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write your announcement..."
                rows={5}
                className="w-full px-3 py-2 input"
                required
                maxLength={2000}
              />
              <p className="text-xs text-gray-400 dark:text-[#636366] mt-1">{message.length}/2000</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1.5">
                  Send To
                </label>
                <select
                  value={targetType}
                  onChange={(e) => { setTargetType(e.target.value); setSelectedClassId('') }}
                  className="w-full px-3 py-2 input"
                >
                  <option value="my-classes">All My Classes</option>
                  <option value="specific-class">Specific Class</option>
                  <option value="parents">Parents of My Students</option>
                </select>
              </div>

              {targetType === 'specific-class' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1.5">
                    Select Class <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    className="w-full px-3 py-2 input"
                    required
                  >
                    <option value="">Choose a class</option>
                    {myClasses.map(cls => (
                      <option key={cls._id} value={cls._id}>{cls.name || cls.grade}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1.5">
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full px-3 py-2 input"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="btn btn-primary flex items-center gap-2 w-full sm:w-auto justify-center"
              >
                <Send className="h-4 w-4" />
                {createMutation.isPending ? 'Sending...' : 'Send Announcement'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Sent History Tab */}
      {activeTab === 'sent' && (
        <div className="space-y-4">
          {historyLoading ? (
            <div className="flex items-center justify-center h-48"><div className="loading-spinner" /></div>
          ) : sentAnnouncements.length === 0 ? (
            <div className="card p-12 text-center">
              <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-600 dark:text-[#8E8E93]">No announcements sent yet</p>
              <p className="text-sm text-gray-500 dark:text-[#636366] mt-1">Your sent announcements will appear here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sentAnnouncements.map(ann => (
                <div key={ann._id} className="card p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{ann.title}</h3>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-semibold ${getPriorityBadge(ann.priority)}`}>
                          {ann.priority}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-[#8E8E93] line-clamp-2 mb-2">{ann.message}</p>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-[#636366]">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {ann.createdAt ? new Date(ann.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {(ann.targetAudience || []).join(', ')}
                        </span>
                        {ann.notificationsSent > 0 && (
                          <span>{ann.notificationsSent} notified</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => setShowDeleteConfirm(ann._id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-md hover:bg-red-50 dark:hover:bg-red-500/10 flex-shrink-0"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && createPortal(
        <div className="fixed inset-0 bg-black/40 dark:bg-black/75 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass-lg w-full max-w-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Delete Announcement?</h3>
            <p className="text-sm text-gray-600 dark:text-[#8E8E93] mb-6">This cannot be undone. Students who already received the notification will still see it.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowDeleteConfirm(null)} className="btn btn-outline">Cancel</button>
              <button
                onClick={() => deleteMutation.mutate(showDeleteConfirm)}
                disabled={deleteMutation.isPending}
                className="btn bg-red-600 text-white hover:bg-red-500 rounded-xl h-10 px-4 text-sm font-semibold"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

export default TeacherCommunication
