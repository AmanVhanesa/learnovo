import React, { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  Settings, Clock, BookOpen, UserCog, Building2, Hammer,
  Plus, Trash2, Edit2, Copy, Archive, Send, X, Check,
  ChevronDown, AlertTriangle, Zap, RotateCcw, Lock, Unlock,
  Loader2, LayoutGrid, Search, GripVertical, Coffee
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { timetableService } from '../../services/timetableService'
import TimetableGrid from '../../components/timetable/TimetableGrid'
import TemplateSelector from '../../components/timetable/TemplateSelector'
import ConflictBadge from '../../components/timetable/ConflictBadge'
import api from '../../services/authService'

const TABS = [
  { id: 'templates', label: 'Templates', icon: LayoutGrid },
  { id: 'bell', label: 'Bell Schedule', icon: Clock },
  { id: 'allocations', label: 'Subject Allocation', icon: BookOpen },
  { id: 'constraints', label: 'Teacher Constraints', icon: UserCog },
  { id: 'rooms', label: 'Rooms', icon: Building2 },
  { id: 'build', label: 'Build Timetable', icon: Hammer }
]

const STATUS_BADGES = {
  draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  published: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400',
  archived: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
}

const WORKING_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const DAY_LABELS = { monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday' }

const SLOT_TYPES = [
  { value: 'period', label: 'Period' },
  { value: 'break', label: 'Break' },
  { value: 'lunch', label: 'Lunch' }
]

const CONSTRAINT_TYPES = [
  { value: 'unavailable', label: 'Unavailable' },
  { value: 'preferred', label: 'Preferred' },
  { value: 'maxPeriodsPerDay', label: 'Max Periods/Day' },
  { value: 'maxConsecutive', label: 'Max Consecutive Periods' },
  { value: 'noFirstPeriod', label: 'No First Period' },
  { value: 'noLastPeriod', label: 'No Last Period' }
]

const ROOM_TYPES = [
  { value: 'classroom', label: 'Classroom' },
  { value: 'lab', label: 'Laboratory' },
  { value: 'library', label: 'Library' },
  { value: 'auditorium', label: 'Auditorium' },
  { value: 'sports', label: 'Sports Facility' },
  { value: 'other', label: 'Other' }
]

const Modal = ({ show, onClose, title, children, width = 'max-w-lg' }) => {
  if (!show) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-xl w-full ${width} max-h-[90vh] flex flex-col`}>
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-[#38383A] flex-shrink-0">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-[#2C2C2E] text-gray-400 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}

const LoadingSkeleton = ({ rows = 5 }) => (
  <div className="space-y-3">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="h-12 animate-pulse bg-gray-200 dark:bg-gray-700 rounded-lg" />
    ))}
  </div>
)

const TimetableBuilder = () => {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('templates')
  const [selectedTemplateId, setSelectedTemplateId] = useState('')

  // Modal states
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState(null)
  const [showTimingModal, setShowTimingModal] = useState(false)
  const [editingTiming, setEditingTiming] = useState(null)
  const [showAllocationModal, setShowAllocationModal] = useState(false)
  const [editingAllocation, setEditingAllocation] = useState(null)
  const [showConstraintModal, setShowConstraintModal] = useState(false)
  const [showRoomModal, setShowRoomModal] = useState(false)
  const [editingRoom, setEditingRoom] = useState(null)
  const [showEntryModal, setShowEntryModal] = useState(false)
  const [entryModalSlot, setEntryModalSlot] = useState(null)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [generating, setGenerating] = useState(false)

  // Build tab state
  const [buildClassId, setBuildClassId] = useState('')
  const [buildSectionId, setBuildSectionId] = useState('')

  // Filter state
  const [allocClassFilter, setAllocClassFilter] = useState('')
  const [constraintTeacherFilter, setConstraintTeacherFilter] = useState('')

  // ──────────────────────────────────────────────────────────
  // QUERIES
  // ──────────────────────────────────────────────────────────

  const { data: templatesData, isLoading: templatesLoading } = useQuery({
    queryKey: ['timetable-templates'],
    queryFn: () => timetableService.getTemplates(),
  })
  const templates = templatesData?.data || templatesData || []

  const { data: timingsData, isLoading: timingsLoading } = useQuery({
    queryKey: ['timetable-timings', selectedTemplateId],
    queryFn: () => timetableService.getTimings(selectedTemplateId),
    enabled: !!selectedTemplateId && ['bell', 'build'].includes(activeTab)
  })
  const timings = timingsData?.data || timingsData || []

  const { data: allocationsData, isLoading: allocationsLoading } = useQuery({
    queryKey: ['timetable-allocations', selectedTemplateId, allocClassFilter],
    queryFn: () => timetableService.getAllocations(selectedTemplateId, allocClassFilter ? { classId: allocClassFilter } : {}),
    enabled: !!selectedTemplateId && activeTab === 'allocations'
  })
  const allocations = allocationsData?.data || allocationsData || []

  const { data: constraintsData, isLoading: constraintsLoading } = useQuery({
    queryKey: ['timetable-constraints', selectedTemplateId, constraintTeacherFilter],
    queryFn: () => timetableService.getConstraints(selectedTemplateId, constraintTeacherFilter ? { teacherId: constraintTeacherFilter } : {}),
    enabled: !!selectedTemplateId && activeTab === 'constraints'
  })
  const constraints = constraintsData?.data || constraintsData || []

  const { data: roomsData, isLoading: roomsLoading } = useQuery({
    queryKey: ['timetable-rooms'],
    queryFn: () => timetableService.getRooms(),
    enabled: activeTab === 'rooms' || activeTab === 'build'
  })
  const rooms = roomsData?.data || roomsData || []

  const { data: entriesData, isLoading: entriesLoading } = useQuery({
    queryKey: ['timetable-entries', selectedTemplateId, buildClassId, buildSectionId],
    queryFn: () => timetableService.getEntries(selectedTemplateId, {
      classId: buildClassId,
      sectionId: buildSectionId
    }),
    enabled: !!selectedTemplateId && activeTab === 'build' && !!buildClassId
  })
  const entries = entriesData?.data || entriesData || []

  // Dropdown data
  const { data: classesData } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => { const r = await api.get('/classes'); return r.data?.data || r.data || [] }
  })
  const classes = classesData || []

  const [allocModalClassId, setAllocModalClassId] = useState('')
  const activeSectionsClassId = allocModalClassId || buildClassId || allocClassFilter
  const { data: sectionsData } = useQuery({
    queryKey: ['sections', activeSectionsClassId],
    queryFn: async () => {
      const r = await api.get(`/classes/${activeSectionsClassId}`)
      const classData = r.data?.data || r.data || {}
      return classData.sections || []
    },
    enabled: !!activeSectionsClassId
  })
  const sections = sectionsData || []

  const { data: teachersData } = useQuery({
    queryKey: ['teachers'],
    queryFn: async () => { const r = await api.get('/teachers'); return r.data?.data || r.data || [] }
  })
  const teachers = teachersData || []

  const { data: subjectsData } = useQuery({
    queryKey: ['subjects'],
    queryFn: async () => { const r = await api.get('/subjects'); return r.data?.data || r.data || [] }
  })
  const subjects = subjectsData || []

  // ──────────────────────────────────────────────────────────
  // MUTATIONS
  // ──────────────────────────────────────────────────────────

  const templateMutation = useMutation({
    mutationFn: ({ id, data }) => id ? timetableService.updateTemplate(id, data) : timetableService.createTemplate(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['timetable-templates'])
      setShowTemplateModal(false)
      setEditingTemplate(null)
      toast.success(editingTemplate ? 'Template updated' : 'Template created')
    },
    onError: (err) => toast.error(err?.message || 'Failed to save template')
  })

  const deleteTemplateMutation = useMutation({
    mutationFn: (id) => timetableService.deleteTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['timetable-templates'])
      if (selectedTemplateId) setSelectedTemplateId('')
      toast.success('Template deleted')
    },
    onError: (err) => toast.error(err?.message || 'Failed to delete template')
  })

  const publishMutation = useMutation({
    mutationFn: (id) => timetableService.publishTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['timetable-templates'])
      toast.success('Template published successfully')
    },
    onError: (err) => {
      const errors = err?.errors || []
      if (errors.length > 0) {
        toast.error(`Cannot publish:\n${errors.join('\n')}`, { duration: 6000 })
      } else {
        toast.error(err?.message || 'Failed to publish. Complete all steps first.')
      }
    }
  })

  const archiveMutation = useMutation({
    mutationFn: (id) => timetableService.archiveTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['timetable-templates'])
      toast.success('Template archived')
    },
    onError: (err) => toast.error(err?.message || 'Failed to archive template')
  })

  const duplicateMutation = useMutation({
    mutationFn: (id) => timetableService.duplicateTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['timetable-templates'])
      toast.success('Template duplicated')
    },
    onError: (err) => toast.error(err?.message || 'Failed to duplicate template')
  })

  const timingMutation = useMutation({
    mutationFn: ({ templateId, slotId, data }) =>
      slotId
        ? timetableService.updateTiming(templateId, slotId, data)
        : timetableService.bulkSetTimings(templateId, [data]),
    onSuccess: () => {
      queryClient.invalidateQueries(['timetable-timings'])
      setShowTimingModal(false)
      setEditingTiming(null)
      toast.success('Timing saved')
    },
    onError: (err) => toast.error(err?.message || 'Failed to save timing')
  })

  const deleteTimingMutation = useMutation({
    mutationFn: ({ templateId, slotId }) => timetableService.deleteTiming(templateId, slotId),
    onSuccess: () => {
      queryClient.invalidateQueries(['timetable-timings'])
      toast.success('Timing deleted')
    },
    onError: (err) => toast.error(err?.message || 'Failed to delete timing')
  })

  const bulkTimingsMutation = useMutation({
    mutationFn: ({ templateId, timings }) => timetableService.bulkSetTimings(templateId, timings),
    onSuccess: () => {
      queryClient.invalidateQueries(['timetable-timings'])
      toast.success('Standard school day created')
    },
    onError: (err) => toast.error(err?.message || 'Failed to create standard schedule')
  })

  const allocationMutation = useMutation({
    mutationFn: ({ templateId, allocId, data }) =>
      allocId
        ? timetableService.updateAllocation(templateId, allocId, data)
        : timetableService.createAllocation(templateId, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['timetable-allocations'])
      setShowAllocationModal(false)
      setEditingAllocation(null)
      toast.success('Allocation saved')
    },
    onError: (err) => toast.error(err?.message || 'Failed to save allocation')
  })

  const deleteAllocationMutation = useMutation({
    mutationFn: ({ templateId, allocId }) => timetableService.deleteAllocation(templateId, allocId),
    onSuccess: () => {
      queryClient.invalidateQueries(['timetable-allocations'])
      toast.success('Allocation deleted')
    },
    onError: (err) => toast.error(err?.message || 'Failed to delete allocation')
  })

  const constraintMutation = useMutation({
    mutationFn: ({ templateId, data }) => timetableService.createConstraint(templateId, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['timetable-constraints'])
      setShowConstraintModal(false)
      toast.success('Constraint added')
    },
    onError: (err) => toast.error(err?.message || 'Failed to add constraint')
  })

  const deleteConstraintMutation = useMutation({
    mutationFn: ({ templateId, constraintId }) => timetableService.deleteConstraint(templateId, constraintId),
    onSuccess: () => {
      queryClient.invalidateQueries(['timetable-constraints'])
      toast.success('Constraint removed')
    },
    onError: (err) => toast.error(err?.message || 'Failed to remove constraint')
  })

  const roomMutation = useMutation({
    mutationFn: ({ id, data }) => id ? timetableService.updateRoom(id, data) : timetableService.createRoom(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['timetable-rooms'])
      setShowRoomModal(false)
      setEditingRoom(null)
      toast.success(editingRoom ? 'Room updated' : 'Room created')
    },
    onError: (err) => toast.error(err?.message || 'Failed to save room')
  })

  const deleteRoomMutation = useMutation({
    mutationFn: (id) => timetableService.deleteRoom(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['timetable-rooms'])
      toast.success('Room deleted')
    },
    onError: (err) => toast.error(err?.message || 'Failed to delete room')
  })

  const entryMutation = useMutation({
    mutationFn: ({ templateId, entryId, data }) =>
      entryId
        ? timetableService.updateEntry(templateId, entryId, data)
        : timetableService.createEntry(templateId, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['timetable-entries'])
      setShowEntryModal(false)
      setEntryModalSlot(null)
      toast.success('Entry saved')
    },
    onError: (err) => toast.error(err?.message || 'Failed to save entry')
  })

  const deleteEntryMutation = useMutation({
    mutationFn: ({ templateId, entryId }) => timetableService.deleteEntry(templateId, entryId),
    onSuccess: () => {
      queryClient.invalidateQueries(['timetable-entries'])
      toast.success('Entry removed')
    },
    onError: (err) => toast.error(err?.message || 'Failed to remove entry')
  })

  const clearEntriesMutation = useMutation({
    mutationFn: (templateId) => timetableService.clearEntries(templateId),
    onSuccess: () => {
      queryClient.invalidateQueries(['timetable-entries'])
      setShowClearConfirm(false)
      toast.success('All entries cleared')
    },
    onError: (err) => toast.error(err?.message || 'Failed to clear entries')
  })

  // ──────────────────────────────────────────────────────────
  // HANDLERS
  // ──────────────────────────────────────────────────────────

  const handleCreateStandardDay = () => {
    if (!selectedTemplateId) return
    const standardTimings = [
      { slotNumber: 1, label: 'Period 1', startTime: '08:00', endTime: '08:40', type: 'period' },
      { slotNumber: 2, label: 'Period 2', startTime: '08:40', endTime: '09:20', type: 'period' },
      { slotNumber: 3, label: 'Period 3', startTime: '09:20', endTime: '10:00', type: 'period' },
      { slotNumber: 4, label: 'Short Break', startTime: '10:00', endTime: '10:15', type: 'break' },
      { slotNumber: 5, label: 'Period 4', startTime: '10:15', endTime: '10:55', type: 'period' },
      { slotNumber: 6, label: 'Period 5', startTime: '10:55', endTime: '11:35', type: 'period' },
      { slotNumber: 7, label: 'Lunch Break', startTime: '11:35', endTime: '12:10', type: 'lunch' },
      { slotNumber: 8, label: 'Period 6', startTime: '12:10', endTime: '12:50', type: 'period' },
      { slotNumber: 9, label: 'Period 7', startTime: '12:50', endTime: '13:30', type: 'period' },
      { slotNumber: 10, label: 'Short Break', startTime: '13:30', endTime: '13:40', type: 'break' },
      { slotNumber: 11, label: 'Period 8', startTime: '13:40', endTime: '14:20', type: 'period' }
    ]
    bulkTimingsMutation.mutate({ templateId: selectedTemplateId, timings: standardTimings })
  }

  const handleGenerate = async () => {
    if (!selectedTemplateId) return
    try {
      setGenerating(true)
      await timetableService.generateTimetable(selectedTemplateId, {
        keepLocked: true,
        classId: buildClassId || undefined
      })
      queryClient.invalidateQueries(['timetable-entries'])
      toast.success('Timetable generated successfully!')
    } catch (err) {
      console.error('Generate error:', err)
      const errors = err?.errors || []
      if (errors.length > 0) {
        toast.error(errors.join(', '), { duration: 6000 })
      } else {
        toast.error(err?.message || 'Generation failed. Check allocations and constraints.', { duration: 6000 })
      }
    } finally {
      setGenerating(false)
    }
  }

  const handleCellClick = (day, timing) => {
    if (!selectedTemplateId || !buildClassId) return
    const timingSlotId = timing?._id
    const existing = entries.find(e =>
      e.dayOfWeek === day && (e.timingSlotId === timingSlotId || e.timingSlot === timingSlotId || e.timingSlot?._id === timingSlotId)
    )
    setEntryModalSlot({ day, timing, entry: existing || null })
    setShowEntryModal(true)
  }

  const handleEntryClick = (entry) => {
    const day = entry.dayOfWeek || entry.day
    const timing = timings.find(t => t._id === (entry.timingSlot?._id || entry.timingSlot || entry.timingSlotId))
    setEntryModalSlot({
      day,
      timing: timing || null,
      entry
    })
    setShowEntryModal(true)
  }

  // Build stats
  const buildStats = useMemo(() => {
    const periodTimings = timings.filter(t => t.type === 'period')
    const workingDays = templates.find(t => t._id === selectedTemplateId)?.workingDays || WORKING_DAYS.slice(0, 6)
    const totalSlots = periodTimings.length * workingDays.length
    const filledSlots = entries.length
    const conflicts = entries.filter(e => e.hasConflict).length
    return { totalSlots, filledSlots, conflicts }
  }, [entries, timings, selectedTemplateId, templates])

  // Teacher workload for allocations
  const teacherWorkload = useMemo(() => {
    const map = {}
    allocations.forEach(a => {
      const tid = a.teacher?._id || a.teacherId
      if (!tid) return
      const name = a.teacher?.name || a.teacherName || 'Unknown'
      if (!map[tid]) map[tid] = { name, total: 0 }
      map[tid].total += a.periodsPerWeek || 0
    })
    return map
  }, [allocations])

  // ──────────────────────────────────────────────────────────
  // FORM STATES
  // ──────────────────────────────────────────────────────────

  const [templateForm, setTemplateForm] = useState({ name: '', description: '', workingDays: WORKING_DAYS.slice(0, 6) })
  const [timingForm, setTimingForm] = useState({ slotNumber: '', label: '', startTime: '', endTime: '', type: 'period' })
  const [allocationForm, setAllocationForm] = useState({ classId: '', sectionId: '', subjectId: '', teacherId: '', periodsPerWeek: 1, requiresLab: false })
  const [constraintForm, setConstraintForm] = useState({ teacherId: '', type: 'unavailable', dayOfWeek: '', timingSlotId: '', value: '' })
  const [roomForm, setRoomForm] = useState({ name: '', type: 'classroom', building: '', floor: '', capacity: '', facilities: '' })
  const [entryForm, setEntryForm] = useState({ subjectId: '', teacherId: '', roomId: '' })

  // Reset forms when opening modals
  const openTemplateModal = (template = null) => {
    if (template) {
      setEditingTemplate(template)
      setTemplateForm({
        name: template.name || '',
        description: template.description || '',
        workingDays: template.workingDays || WORKING_DAYS.slice(0, 6)
      })
    } else {
      setEditingTemplate(null)
      setTemplateForm({ name: '', description: '', workingDays: WORKING_DAYS.slice(0, 6) })
    }
    setShowTemplateModal(true)
  }

  const openTimingModal = (timing = null) => {
    if (timing) {
      setEditingTiming(timing)
      setTimingForm({
        slotNumber: timing.slotNumber || '',
        label: timing.label || '',
        startTime: timing.startTime || '',
        endTime: timing.endTime || '',
        type: timing.type || 'period'
      })
    } else {
      setEditingTiming(null)
      const nextSlot = timings.length > 0 ? Math.max(...timings.map(t => t.slotNumber || 0)) + 1 : 1
      setTimingForm({ slotNumber: nextSlot, label: '', startTime: '', endTime: '', type: 'period' })
    }
    setShowTimingModal(true)
  }

  const openAllocationModal = (alloc = null) => {
    if (alloc) {
      setEditingAllocation(alloc)
      const cid = alloc.class?._id || alloc.classId || ''
      setAllocationForm({
        classId: cid,
        sectionId: alloc.section?._id || alloc.sectionId || '',
        subjectId: alloc.subject?._id || alloc.subjectId || '',
        teacherId: alloc.teacher?._id || alloc.teacherId || '',
        periodsPerWeek: alloc.periodsPerWeek || 1,
        requiresLab: alloc.requiresLab || false
      })
      setAllocModalClassId(cid)
    } else {
      setEditingAllocation(null)
      setAllocationForm({ classId: allocClassFilter || '', sectionId: '', subjectId: '', teacherId: '', periodsPerWeek: 1, requiresLab: false })
      setAllocModalClassId(allocClassFilter || '')
    }
    setShowAllocationModal(true)
  }

  const openRoomModal = (room = null) => {
    if (room) {
      setEditingRoom(room)
      setRoomForm({
        name: room.name || '',
        type: room.type || 'classroom',
        building: room.building || '',
        floor: room.floor || '',
        capacity: room.capacity || '',
        facilities: (room.facilities || []).join(', ')
      })
    } else {
      setEditingRoom(null)
      setRoomForm({ name: '', type: 'classroom', building: '', floor: '', capacity: '', facilities: '' })
    }
    setShowRoomModal(true)
  }

  // ──────────────────────────────────────────────────────────
  // SUBMIT HANDLERS
  // ──────────────────────────────────────────────────────────

  const handleTemplateSubmit = (e) => {
    e.preventDefault()
    if (!templateForm.name.trim()) return toast.error('Template name is required')
    templateMutation.mutate({
      id: editingTemplate?._id,
      data: templateForm
    })
  }

  const handleTimingSubmit = (e) => {
    e.preventDefault()
    if (!timingForm.startTime || !timingForm.endTime) return toast.error('Start and end times are required')
    timingMutation.mutate({
      templateId: selectedTemplateId,
      slotId: editingTiming?._id,
      data: timingForm
    })
  }

  const handleAllocationSubmit = (e) => {
    e.preventDefault()
    if (!allocationForm.classId || !allocationForm.subjectId || !allocationForm.teacherId) {
      return toast.error('Class, subject, and teacher are required')
    }
    allocationMutation.mutate({
      templateId: selectedTemplateId,
      allocId: editingAllocation?._id,
      data: allocationForm
    })
  }

  const handleConstraintSubmit = (e) => {
    e.preventDefault()
    if (!constraintForm.teacherId || !constraintForm.type) return toast.error('Teacher and type are required')
    const data = {
      teacherId: constraintForm.teacherId,
      type: constraintForm.type,
      ...(constraintForm.dayOfWeek && { dayOfWeek: constraintForm.dayOfWeek }),
      ...(constraintForm.timingSlotId && { timingSlotId: constraintForm.timingSlotId }),
      ...(constraintForm.value && { value: Number(constraintForm.value) })
    }
    constraintMutation.mutate({
      templateId: selectedTemplateId,
      data
    })
  }

  const handleRoomSubmit = (e) => {
    e.preventDefault()
    if (!roomForm.name.trim()) return toast.error('Room name is required')
    const data = {
      ...roomForm,
      capacity: roomForm.capacity ? Number(roomForm.capacity) : undefined,
      facilities: roomForm.facilities ? roomForm.facilities.split(',').map(f => f.trim()).filter(Boolean) : []
    }
    roomMutation.mutate({ id: editingRoom?._id, data })
  }

  const handleEntrySubmit = (e) => {
    e.preventDefault()
    if (!entryForm.subjectId || !entryForm.teacherId) return toast.error('Subject and teacher are required')
    entryMutation.mutate({
      templateId: selectedTemplateId,
      entryId: entryModalSlot.entry?._id,
      data: {
        subjectId: entryForm.subjectId,
        teacherId: entryForm.teacherId,
        roomId: entryForm.roomId || undefined,
        dayOfWeek: entryModalSlot.day,
        timingSlotId: entryModalSlot.timing?._id,
        classId: buildClassId,
        sectionId: buildSectionId || undefined
      }
    })
  }

  // ──────────────────────────────────────────────────────────
  // TAB CONTENT
  // ──────────────────────────────────────────────────────────

  const renderTemplatesTab = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Timetable Templates</h2>
        <button onClick={() => openTemplateModal()} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors">
          <Plus className="w-4 h-4" /> New Template
        </button>
      </div>

      {templatesLoading ? <LoadingSkeleton /> : templates.length === 0 ? (
        <div className="text-center py-16">
          <LayoutGrid className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400 mb-4">No templates yet. Create your first timetable template.</p>
          <button onClick={() => openTemplateModal()} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors">
            Create Template
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-[#2C2C2E]">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden sm:table-cell">Working Days</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">Created</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-[#38383A]">
              {templates.map(template => (
                <tr key={template._id} className="hover:bg-gray-50 dark:hover:bg-[#2C2C2E] transition-colors">
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{template.name}</p>
                      {template.description && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate max-w-[200px]">{template.description}</p>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium capitalize ${STATUS_BADGES[template.status] || STATUS_BADGES.draft}`}>
                      {template.status || 'draft'}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <p className="text-xs text-gray-500 dark:text-gray-400">{(template.workingDays || []).length} days</p>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {template.createdAt ? new Date(template.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {template.status === 'draft' && (
                        <button onClick={() => publishMutation.mutate(template._id)} className="p-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 transition-colors" title="Publish">
                          <Send className="w-4 h-4" />
                        </button>
                      )}
                      {template.status === 'published' && (
                        <button onClick={() => archiveMutation.mutate(template._id)} className="p-1.5 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 text-amber-600 dark:text-amber-400 transition-colors" title="Archive">
                          <Archive className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => duplicateMutation.mutate(template._id)} className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 dark:text-blue-400 transition-colors" title="Duplicate">
                        <Copy className="w-4 h-4" />
                      </button>
                      <button onClick={() => openTemplateModal(template)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-[#3A3A3C] text-gray-500 dark:text-gray-400 transition-colors" title="Edit">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => { if (confirm('Delete this template?')) deleteTemplateMutation.mutate(template._id) }} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 dark:text-red-400 transition-colors" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )

  const renderBellTab = () => (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Bell Schedule</h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Configure timing slots for the selected template</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleCreateStandardDay}
            disabled={!selectedTemplateId || bulkTimingsMutation.isLoading}
            className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-[#2C2C2E] text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-[#3A3A3C] transition-colors disabled:opacity-50"
          >
            <Coffee className="w-4 h-4" /> Standard School Day
          </button>
          <button
            onClick={() => openTimingModal()}
            disabled={!selectedTemplateId}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50"
          >
            <Plus className="w-4 h-4" /> Add Slot
          </button>
        </div>
      </div>

      {!selectedTemplateId ? (
        <p className="text-center py-12 text-sm text-gray-400 dark:text-gray-500">Select a template above to manage its bell schedule.</p>
      ) : timingsLoading ? <LoadingSkeleton /> : timings.length === 0 ? (
        <div className="text-center py-12">
          <Clock className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400 mb-3">No timing slots configured yet.</p>
          <p className="text-xs text-gray-400 dark:text-gray-500">Click "Standard School Day" for a preset or add slots manually.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {timings.sort((a, b) => (a.slotNumber || 0) - (b.slotNumber || 0)).map(timing => (
            <div key={timing._id || timing.slotNumber} className={`flex items-center gap-4 p-3 rounded-xl border transition-colors ${
              timing.type === 'break' || timing.type === 'lunch'
                ? 'bg-amber-50/50 dark:bg-amber-900/5 border-amber-100 dark:border-amber-800/20'
                : 'bg-white dark:bg-[#1C1C1E] border-gray-100 dark:border-[#38383A]'
            }`}>
              <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-[#2C2C2E] flex items-center justify-center text-xs font-bold text-gray-500 dark:text-gray-400">
                {timing.slotNumber}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {timing.label || `Slot ${timing.slotNumber}`}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {timing.startTime} - {timing.endTime}
                </p>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase ${
                timing.type === 'period'
                  ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                  : timing.type === 'lunch'
                    ? 'bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400'
                    : 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400'
              }`}>
                {timing.type}
              </span>
              <div className="flex items-center gap-1">
                <button onClick={() => openTimingModal(timing)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-[#2C2C2E] text-gray-400 transition-colors">
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => deleteTimingMutation.mutate({ templateId: selectedTemplateId, slotId: timing._id })}
                  className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  const renderAllocationsTab = () => (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Subject Allocation</h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Assign subjects to classes with teacher and periods per week</p>
        </div>
        <button
          onClick={() => openAllocationModal()}
          disabled={!selectedTemplateId}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50"
        >
          <Plus className="w-4 h-4" /> Add Allocation
        </button>
      </div>

      {/* Class filter */}
      {selectedTemplateId && (
        <select
          value={allocClassFilter}
          onChange={(e) => setAllocClassFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-200 dark:border-[#38383A] bg-white dark:bg-[#2C2C2E] text-sm text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary-500 focus:outline-none"
        >
          <option value="">All Classes</option>
          {classes.map(cls => (
            <option key={cls._id} value={cls._id}>{cls.name || cls.className}</option>
          ))}
        </select>
      )}

      {/* Teacher workload summary */}
      {Object.keys(teacherWorkload).length > 0 && (
        <div className="p-3 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-800/20">
          <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase mb-2">Teacher Workload</p>
          <div className="flex flex-wrap gap-2">
            {Object.values(teacherWorkload).map((w, i) => (
              <span key={i} className={`px-2 py-1 rounded-full text-xs font-medium ${
                w.total > 35 ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400' :
                w.total > 28 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400' :
                'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
              }`}>
                {w.name}: {w.total}p/w
                {w.total > 35 && <AlertTriangle className="w-3 h-3 inline ml-1" />}
              </span>
            ))}
          </div>
        </div>
      )}

      {!selectedTemplateId ? (
        <p className="text-center py-12 text-sm text-gray-400 dark:text-gray-500">Select a template above to manage allocations.</p>
      ) : allocationsLoading ? <LoadingSkeleton /> : allocations.length === 0 ? (
        <div className="text-center py-12">
          <BookOpen className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">No subject allocations yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-[#2C2C2E]">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Subject</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Class</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Teacher</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Periods/Week</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden sm:table-cell">Lab</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-[#38383A]">
              {allocations.map(alloc => (
                <tr key={alloc._id} className="hover:bg-gray-50 dark:hover:bg-[#2C2C2E] transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                    {alloc.subject?.name || alloc.subjectName || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                    {alloc.class?.name || alloc.className || '-'}
                    {(alloc.section?.name || alloc.sectionName) && ` - ${alloc.section?.name || alloc.sectionName}`}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                    {alloc.teacher?.name || alloc.teacherName || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-center font-medium text-gray-900 dark:text-white">
                    {alloc.periodsPerWeek || 0}
                  </td>
                  <td className="px-4 py-3 text-center hidden sm:table-cell">
                    {alloc.requiresLab ? (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400">Yes</span>
                    ) : (
                      <span className="text-xs text-gray-400">No</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openAllocationModal(alloc)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-[#3A3A3C] text-gray-400 transition-colors">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => deleteAllocationMutation.mutate({ templateId: selectedTemplateId, allocId: alloc._id })} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )

  const renderConstraintsTab = () => (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Teacher Constraints</h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Set teacher availability and scheduling preferences</p>
        </div>
        <button
          onClick={() => {
            setConstraintForm({ teacherId: constraintTeacherFilter || '', type: 'unavailable', dayOfWeek: '', timingSlotId: '', value: '' })
            setShowConstraintModal(true)
          }}
          disabled={!selectedTemplateId}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50"
        >
          <Plus className="w-4 h-4" /> Add Constraint
        </button>
      </div>

      {selectedTemplateId && (
        <select
          value={constraintTeacherFilter}
          onChange={(e) => setConstraintTeacherFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-200 dark:border-[#38383A] bg-white dark:bg-[#2C2C2E] text-sm text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary-500 focus:outline-none"
        >
          <option value="">All Teachers</option>
          {teachers.map(t => (
            <option key={t._id} value={t._id}>{t.name || `${t.firstName || ''} ${t.lastName || ''}`.trim()}</option>
          ))}
        </select>
      )}

      {!selectedTemplateId ? (
        <p className="text-center py-12 text-sm text-gray-400 dark:text-gray-500">Select a template above to manage constraints.</p>
      ) : constraintsLoading ? <LoadingSkeleton rows={3} /> : constraints.length === 0 ? (
        <div className="text-center py-12">
          <UserCog className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">No constraints configured yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {constraints.map(c => (
            <div key={c._id} className="flex items-center gap-4 p-3 bg-white dark:bg-[#1C1C1E] rounded-xl border border-gray-100 dark:border-[#38383A]">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {c.teacherId?.name || c.teacher?.name || c.teacherName || 'Unknown Teacher'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  <span className="capitalize">{c.type?.replace(/([A-Z])/g, ' $1').trim()}</span>
                  {c.dayOfWeek && ` · ${DAY_LABELS[c.dayOfWeek] || c.dayOfWeek}`}
                  {(c.timingSlotId?.label || c.timingSlot?.label) && ` · ${c.timingSlotId?.label || c.timingSlot?.label}`}
                  {c.value && ` · Value: ${c.value}`}
                </p>
              </div>
              <button
                onClick={() => deleteConstraintMutation.mutate({ templateId: selectedTemplateId, constraintId: c._id })}
                className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  const renderRoomsTab = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Rooms</h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Manage school rooms and labs</p>
        </div>
        <button onClick={() => openRoomModal()} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors">
          <Plus className="w-4 h-4" /> Add Room
        </button>
      </div>

      {roomsLoading ? <LoadingSkeleton /> : rooms.length === 0 ? (
        <div className="text-center py-12">
          <Building2 className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">No rooms configured yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-[#2C2C2E]">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Room Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden sm:table-cell">Building</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">Floor</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden sm:table-cell">Capacity</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden lg:table-cell">Facilities</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-[#38383A]">
              {rooms.map(room => (
                <tr key={room._id} className="hover:bg-gray-50 dark:hover:bg-[#2C2C2E] transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{room.name}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium capitalize bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
                      {room.type || 'classroom'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 hidden sm:table-cell">{room.building || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 hidden md:table-cell">{room.floor || '-'}</td>
                  <td className="px-4 py-3 text-sm text-center text-gray-500 dark:text-gray-400 hidden sm:table-cell">{room.capacity || '-'}</td>
                  <td className="px-4 py-3 text-xs text-gray-400 dark:text-gray-500 hidden lg:table-cell truncate max-w-[150px]">
                    {(room.facilities || []).join(', ') || '-'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openRoomModal(room)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-[#3A3A3C] text-gray-400 transition-colors">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => { if (confirm('Delete this room?')) deleteRoomMutation.mutate(room._id) }} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )

  const renderBuildTab = () => (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Build Timetable</h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Drag, drop, or auto-generate the timetable</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={handleGenerate}
            disabled={!selectedTemplateId || generating}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            {generating ? 'Generating...' : 'Auto-Generate'}
          </button>
          <button
            onClick={() => setShowClearConfirm(true)}
            disabled={!selectedTemplateId || entries.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm font-medium hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50"
          >
            <RotateCcw className="w-4 h-4" /> Clear All
          </button>
        </div>
      </div>

      {/* Class selector */}
      {selectedTemplateId && (
        <div className="flex flex-wrap gap-3">
          <select
            value={buildClassId}
            onChange={(e) => { setBuildClassId(e.target.value); setBuildSectionId('') }}
            className="px-3 py-2 rounded-lg border border-gray-200 dark:border-[#38383A] bg-white dark:bg-[#2C2C2E] text-sm text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary-500 focus:outline-none"
          >
            <option value="">Select Class</option>
            {classes.map(cls => (
              <option key={cls._id} value={cls._id}>{cls.name || cls.className}</option>
            ))}
          </select>
          <select
            value={buildSectionId}
            onChange={(e) => setBuildSectionId(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-200 dark:border-[#38383A] bg-white dark:bg-[#2C2C2E] text-sm text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary-500 focus:outline-none"
            disabled={!buildClassId}
          >
            <option value="">All Sections</option>
            {sections.map(sec => (
              <option key={sec._id} value={sec._id}>{sec.name || sec.sectionName}</option>
            ))}
          </select>
        </div>
      )}

      {/* Stats bar */}
      {selectedTemplateId && buildClassId && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white dark:bg-[#1C1C1E] rounded-xl border border-gray-100 dark:border-[#38383A] p-3 text-center">
            <p className="text-xs text-gray-400 dark:text-gray-500 uppercase">Filled</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              {buildStats.filledSlots}/{buildStats.totalSlots}
            </p>
          </div>
          <div className="bg-white dark:bg-[#1C1C1E] rounded-xl border border-gray-100 dark:border-[#38383A] p-3 text-center">
            <p className="text-xs text-gray-400 dark:text-gray-500 uppercase">Conflicts</p>
            <p className={`text-xl font-bold ${buildStats.conflicts > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
              {buildStats.conflicts}
            </p>
          </div>
          <div className="bg-white dark:bg-[#1C1C1E] rounded-xl border border-gray-100 dark:border-[#38383A] p-3 text-center">
            <p className="text-xs text-gray-400 dark:text-gray-500 uppercase">Progress</p>
            <p className="text-xl font-bold text-primary-600">
              {buildStats.totalSlots > 0 ? Math.round((buildStats.filledSlots / buildStats.totalSlots) * 100) : 0}%
            </p>
          </div>
        </div>
      )}

      {/* Grid */}
      {!selectedTemplateId ? (
        <p className="text-center py-12 text-sm text-gray-400 dark:text-gray-500">Select a template above to start building.</p>
      ) : !buildClassId ? (
        <p className="text-center py-12 text-sm text-gray-400 dark:text-gray-500">Select a class to build its timetable.</p>
      ) : entriesLoading || timingsLoading ? (
        <div className="h-96 animate-pulse bg-gray-200 dark:bg-gray-700 rounded-xl" />
      ) : (
        <div className="bg-white dark:bg-[#1C1C1E] rounded-xl shadow-sm border border-gray-100 dark:border-[#38383A] overflow-hidden">
          <TimetableGrid
            entries={entries}
            timings={timings}
            workingDays={templates.find(t => t._id === selectedTemplateId)?.workingDays || WORKING_DAYS.slice(0, 6)}
            mode="edit"
            onCellClick={handleCellClick}
            onEntryClick={handleEntryClick}
            highlightToday={false}
            substitutions={[]}
            loading={entriesLoading}
          />
        </div>
      )}
    </div>
  )

  // Input class for forms
  const inputClass = 'w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-[#38383A] bg-white dark:bg-[#2C2C2E] text-sm text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary-500 focus:outline-none dark:[color-scheme:dark]'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Settings className="w-6 h-6 text-primary-600" />
            Timetable Builder
          </h1>
          <p className="text-sm text-gray-500 dark:text-[#8E8E93] mt-1">Configure and build school timetables</p>
        </div>
      </div>

      {/* Template Selector (for all tabs except Templates) */}
      {activeTab !== 'templates' && (
        <div className="bg-white dark:bg-[#1C1C1E] rounded-xl shadow-sm border border-gray-100 dark:border-[#38383A] p-4">
          <TemplateSelector
            templates={templates}
            selectedId={selectedTemplateId}
            onChange={setSelectedTemplateId}
            loading={templatesLoading}
          />
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white dark:bg-[#1C1C1E] rounded-xl shadow-sm border border-gray-100 dark:border-[#38383A]">
        <div className="flex overflow-x-auto border-b border-gray-100 dark:border-[#38383A] scrollbar-hide">
          {TABS.map(tab => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            )
          })}
        </div>

        <div className="p-4 sm:p-6">
          {activeTab === 'templates' && renderTemplatesTab()}
          {activeTab === 'bell' && renderBellTab()}
          {activeTab === 'allocations' && renderAllocationsTab()}
          {activeTab === 'constraints' && renderConstraintsTab()}
          {activeTab === 'rooms' && renderRoomsTab()}
          {activeTab === 'build' && renderBuildTab()}
        </div>
      </div>

      {/* ── MODALS ──────────────────────────────────────────── */}

      {/* Template Modal */}
      <Modal show={showTemplateModal} onClose={() => setShowTemplateModal(false)} title={editingTemplate ? 'Edit Template' : 'New Template'}>
        <form onSubmit={handleTemplateSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
            <input type="text" value={templateForm.name} onChange={(e) => setTemplateForm(f => ({ ...f, name: e.target.value }))} className={inputClass} placeholder="e.g. 2026 Term 1 Timetable" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
            <textarea value={templateForm.description} onChange={(e) => setTemplateForm(f => ({ ...f, description: e.target.value }))} className={inputClass} rows={2} placeholder="Optional description" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Working Days</label>
            <div className="flex flex-wrap gap-2">
              {WORKING_DAYS.map(day => (
                <label key={day} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={templateForm.workingDays.includes(day)}
                    onChange={(e) => {
                      setTemplateForm(f => ({
                        ...f,
                        workingDays: e.target.checked
                          ? [...f.workingDays, day]
                          : f.workingDays.filter(d => d !== day)
                      }))
                    }}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{DAY_LABELS[day] || day}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowTemplateModal(false)} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#2C2C2E] rounded-lg transition-colors">Cancel</button>
            <button type="submit" disabled={templateMutation.isLoading} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50">
              {templateMutation.isLoading ? 'Saving...' : 'Save Template'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Timing Modal */}
      <Modal show={showTimingModal} onClose={() => setShowTimingModal(false)} title={editingTiming ? 'Edit Timing Slot' : 'Add Timing Slot'}>
        <form onSubmit={handleTimingSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Slot Number</label>
              <input type="number" min="1" value={timingForm.slotNumber} onChange={(e) => setTimingForm(f => ({ ...f, slotNumber: Number(e.target.value) }))} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
              <select value={timingForm.type} onChange={(e) => setTimingForm(f => ({ ...f, type: e.target.value }))} className={inputClass}>
                {SLOT_TYPES.map(st => <option key={st.value} value={st.value}>{st.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Label</label>
            <input type="text" value={timingForm.label} onChange={(e) => setTimingForm(f => ({ ...f, label: e.target.value }))} className={inputClass} placeholder="e.g. Period 1, Short Break" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Time * <span className="text-xs text-gray-400">(HH:MM)</span></label>
              <input
                type="text"
                value={timingForm.startTime}
                onChange={(e) => {
                  let v = e.target.value.replace(/[^\d:]/g, '')
                  if (v.length === 2 && !v.includes(':') && timingForm.startTime.length < 3) v += ':'
                  if (v.length <= 5) setTimingForm(f => ({ ...f, startTime: v }))
                }}
                className={inputClass}
                placeholder="08:00"
                maxLength={5}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Time * <span className="text-xs text-gray-400">(HH:MM)</span></label>
              <input
                type="text"
                value={timingForm.endTime}
                onChange={(e) => {
                  let v = e.target.value.replace(/[^\d:]/g, '')
                  if (v.length === 2 && !v.includes(':') && timingForm.endTime.length < 3) v += ':'
                  if (v.length <= 5) setTimingForm(f => ({ ...f, endTime: v }))
                }}
                className={inputClass}
                placeholder="08:40"
                maxLength={5}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowTimingModal(false)} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#2C2C2E] rounded-lg transition-colors">Cancel</button>
            <button type="submit" disabled={timingMutation.isLoading} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50">
              {timingMutation.isLoading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Allocation Modal */}
      <Modal show={showAllocationModal} onClose={() => setShowAllocationModal(false)} title={editingAllocation ? 'Edit Allocation' : 'Add Allocation'}>
        <form onSubmit={handleAllocationSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Class *</label>
              <select value={allocationForm.classId} onChange={(e) => { setAllocationForm(f => ({ ...f, classId: e.target.value, sectionId: '' })); setAllocModalClassId(e.target.value) }} className={inputClass}>
                <option value="">Select Class</option>
                {classes.map(cls => <option key={cls._id} value={cls._id}>{cls.name || cls.className}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Section</label>
              <select value={allocationForm.sectionId} onChange={(e) => setAllocationForm(f => ({ ...f, sectionId: e.target.value }))} className={inputClass}>
                <option value="">All Sections</option>
                {sections.map(sec => <option key={sec._id} value={sec._id}>{sec.name || sec.sectionName}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Subject *</label>
            <select value={allocationForm.subjectId} onChange={(e) => setAllocationForm(f => ({ ...f, subjectId: e.target.value }))} className={inputClass}>
              <option value="">Select Subject</option>
              {(subjects || []).map(s => <option key={s._id} value={s._id}>{s.name || s.subjectName}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Teacher *</label>
            <select value={allocationForm.teacherId} onChange={(e) => setAllocationForm(f => ({ ...f, teacherId: e.target.value }))} className={inputClass}>
              <option value="">Select Teacher</option>
              {teachers.map(t => <option key={t._id} value={t._id}>{t.name || `${t.firstName || ''} ${t.lastName || ''}`.trim()}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Periods/Week *</label>
              <input type="number" min="1" max="15" value={allocationForm.periodsPerWeek} onChange={(e) => setAllocationForm(f => ({ ...f, periodsPerWeek: Number(e.target.value) }))} className={inputClass} />
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={allocationForm.requiresLab} onChange={(e) => setAllocationForm(f => ({ ...f, requiresLab: e.target.checked }))} className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                <span className="text-sm text-gray-700 dark:text-gray-300">Requires Lab</span>
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowAllocationModal(false)} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#2C2C2E] rounded-lg transition-colors">Cancel</button>
            <button type="submit" disabled={allocationMutation.isLoading} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50">
              {allocationMutation.isLoading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Constraint Modal */}
      <Modal show={showConstraintModal} onClose={() => setShowConstraintModal(false)} title="Add Constraint">
        <form onSubmit={handleConstraintSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Teacher *</label>
            <select value={constraintForm.teacherId} onChange={(e) => setConstraintForm(f => ({ ...f, teacherId: e.target.value }))} className={inputClass}>
              <option value="">Select Teacher</option>
              {teachers.map(t => <option key={t._id} value={t._id}>{t.name || `${t.firstName || ''} ${t.lastName || ''}`.trim()}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type *</label>
            <select value={constraintForm.type} onChange={(e) => setConstraintForm(f => ({ ...f, type: e.target.value }))} className={inputClass}>
              {CONSTRAINT_TYPES.map(ct => <option key={ct.value} value={ct.value}>{ct.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Day</label>
              <select value={constraintForm.dayOfWeek} onChange={(e) => setConstraintForm(f => ({ ...f, dayOfWeek: e.target.value }))} className={inputClass}>
                <option value="">Any Day</option>
                {WORKING_DAYS.map(d => <option key={d} value={d}>{DAY_LABELS[d]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Timing Slot</label>
              <select value={constraintForm.timingSlotId} onChange={(e) => setConstraintForm(f => ({ ...f, timingSlotId: e.target.value }))} className={inputClass}>
                <option value="">Any Slot</option>
                {timings.filter(t => t.type === 'period').map(t => (
                  <option key={t._id} value={t._id}>Slot {t.slotNumber} - {t.label || ''}</option>
                ))}
              </select>
            </div>
          </div>
          {(constraintForm.type === 'maxPeriodsPerDay' || constraintForm.type === 'maxConsecutive') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Value</label>
              <input type="number" min="1" value={constraintForm.value} onChange={(e) => setConstraintForm(f => ({ ...f, value: e.target.value }))} className={inputClass} placeholder="e.g. 6" />
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowConstraintModal(false)} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#2C2C2E] rounded-lg transition-colors">Cancel</button>
            <button type="submit" disabled={constraintMutation.isLoading} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50">
              {constraintMutation.isLoading ? 'Adding...' : 'Add Constraint'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Room Modal */}
      <Modal show={showRoomModal} onClose={() => setShowRoomModal(false)} title={editingRoom ? 'Edit Room' : 'Add Room'}>
        <form onSubmit={handleRoomSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Room Name *</label>
              <input type="text" value={roomForm.name} onChange={(e) => setRoomForm(f => ({ ...f, name: e.target.value }))} className={inputClass} placeholder="e.g. Room 101" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
              <select value={roomForm.type} onChange={(e) => setRoomForm(f => ({ ...f, type: e.target.value }))} className={inputClass}>
                {ROOM_TYPES.map(rt => <option key={rt.value} value={rt.value}>{rt.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Building</label>
              <input type="text" value={roomForm.building} onChange={(e) => setRoomForm(f => ({ ...f, building: e.target.value }))} className={inputClass} placeholder="Block A" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Floor</label>
              <input type="text" value={roomForm.floor} onChange={(e) => setRoomForm(f => ({ ...f, floor: e.target.value }))} className={inputClass} placeholder="1st" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Capacity</label>
              <input type="number" min="1" value={roomForm.capacity} onChange={(e) => setRoomForm(f => ({ ...f, capacity: e.target.value }))} className={inputClass} placeholder="40" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Facilities (comma-separated)</label>
            <input type="text" value={roomForm.facilities} onChange={(e) => setRoomForm(f => ({ ...f, facilities: e.target.value }))} className={inputClass} placeholder="Projector, Whiteboard, AC" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowRoomModal(false)} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#2C2C2E] rounded-lg transition-colors">Cancel</button>
            <button type="submit" disabled={roomMutation.isLoading} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50">
              {roomMutation.isLoading ? 'Saving...' : 'Save Room'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Entry Modal (Build Tab) */}
      <Modal show={showEntryModal} onClose={() => setShowEntryModal(false)} title={entryModalSlot?.entry ? 'Edit Entry' : 'Add Entry'}>
        <form onSubmit={handleEntrySubmit} className="space-y-4">
          <div className="p-3 bg-gray-50 dark:bg-[#2C2C2E] rounded-lg mb-2">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {DAY_LABELS[entryModalSlot?.day] || entryModalSlot?.day} - {entryModalSlot?.timing?.label || `Slot ${entryModalSlot?.timing?.slotNumber || ''}`}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Subject *</label>
            <select
              value={entryForm.subjectId}
              onChange={(e) => setEntryForm(f => ({ ...f, subjectId: e.target.value }))}
              className={inputClass}
            >
              <option value="">Select Subject</option>
              {(subjects || []).map(s => <option key={s._id} value={s._id}>{s.name || s.subjectName}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Teacher *</label>
            <select
              value={entryForm.teacherId}
              onChange={(e) => setEntryForm(f => ({ ...f, teacherId: e.target.value }))}
              className={inputClass}
            >
              <option value="">Select Teacher</option>
              {teachers.map(t => <option key={t._id} value={t._id}>{t.name || `${t.firstName || ''} ${t.lastName || ''}`.trim()}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Room</label>
            <select
              value={entryForm.roomId}
              onChange={(e) => setEntryForm(f => ({ ...f, roomId: e.target.value }))}
              className={inputClass}
            >
              <option value="">No Room</option>
              {rooms.map(r => <option key={r._id} value={r._id}>{r.name}</option>)}
            </select>
          </div>
          <div className="flex justify-between items-center pt-2">
            {entryModalSlot?.entry && (
              <button
                type="button"
                onClick={() => {
                  deleteEntryMutation.mutate({ templateId: selectedTemplateId, entryId: entryModalSlot.entry._id })
                  setShowEntryModal(false)
                }}
                className="px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              >
                Remove Entry
              </button>
            )}
            <div className="flex gap-2 ml-auto">
              <button type="button" onClick={() => setShowEntryModal(false)} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#2C2C2E] rounded-lg transition-colors">Cancel</button>
              <button type="submit" disabled={entryMutation.isLoading} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50">
                {entryMutation.isLoading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Clear Confirmation */}
      <Modal show={showClearConfirm} onClose={() => setShowClearConfirm(false)} title="Clear All Entries?" width="max-w-sm">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          This will remove all timetable entries for this template. This action cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <button onClick={() => setShowClearConfirm(false)} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#2C2C2E] rounded-lg transition-colors">Cancel</button>
          <button
            onClick={() => clearEntriesMutation.mutate(selectedTemplateId)}
            disabled={clearEntriesMutation.isLoading}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {clearEntriesMutation.isLoading ? 'Clearing...' : 'Yes, Clear All'}
          </button>
        </div>
      </Modal>
    </div>
  )
}

export default TimetableBuilder
