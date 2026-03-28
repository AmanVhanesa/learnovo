import { useState, useEffect, useCallback, Fragment } from 'react'
import { superAdminService } from '../../services/superAdminService'
import { formatDateShort as formatDate, formatDateTime } from '../../utils/formatDate'
import toast from 'react-hot-toast'
import {
    X, Building2, Users, FileText, Activity, StickyNote, Settings, ChevronRight,
    Mail, Phone, MapPin, Calendar, Clock, Crown, Shield, GraduationCap, BookOpen,
    HardDrive, DollarSign, CreditCard, Check, AlertTriangle, Trash2, RotateCcw,
    KeyRound, Send, Plus, ChevronLeft, ChevronDown, Upload, Globe, Hash, Eye,
    UserCircle, Loader2, RefreshCw, XCircle, CheckCircle2, Ban, Zap, Star
} from 'lucide-react'

const TABS = [
    { key: 'overview', label: 'Overview', icon: Building2 },
    { key: 'users', label: 'Users', icon: Users },
    { key: 'invoices', label: 'Invoices', icon: FileText },
    { key: 'activity', label: 'Activity', icon: Activity },
    { key: 'notes', label: 'Notes', icon: StickyNote },
]

const STATUS_STYLES = {
    active: {
        light: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
        dark: 'dark:bg-[rgba(48,209,88,0.12)] dark:text-[#30D158] dark:ring-0',
    },
    trial: {
        light: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
        dark: 'dark:bg-[rgba(255,214,10,0.12)] dark:text-[#FFD60A] dark:ring-0',
    },
    pending: {
        light: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
        dark: 'dark:bg-[rgba(255,214,10,0.12)] dark:text-[#FFD60A] dark:ring-0',
    },
    suspended: {
        light: 'bg-red-50 text-red-700 ring-1 ring-red-200',
        dark: 'dark:bg-[rgba(255,69,58,0.12)] dark:text-[#FF453A] dark:ring-0',
    },
    cancelled: {
        light: 'bg-red-50 text-red-700 ring-1 ring-red-200',
        dark: 'dark:bg-[rgba(255,69,58,0.12)] dark:text-[#FF453A] dark:ring-0',
    },
}

const PLAN_COLORS = {
    free: 'bg-gray-100 text-gray-700 dark:bg-[#2C2C2E] dark:text-[#8E8E93]',
    starter: 'bg-blue-50 text-blue-700 dark:bg-[rgba(10,132,255,0.12)] dark:text-[#0A84FF]',
    professional: 'bg-purple-50 text-purple-700 dark:bg-[rgba(191,90,242,0.12)] dark:text-[#BF5AF2]',
    enterprise: 'bg-amber-50 text-amber-700 dark:bg-[rgba(255,214,10,0.12)] dark:text-[#FFD60A]',
}

const AVATAR_COLORS = [
    'bg-primary-500', 'bg-blue-500', 'bg-purple-500', 'bg-pink-500',
    'bg-amber-500', 'bg-emerald-500', 'bg-rose-500', 'bg-cyan-500',
]

function getAvatarColor(name) {
    if (!name) return AVATAR_COLORS[0]
    let hash = 0
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}


function getTrialCountdown(trialEnd) {
    if (!trialEnd) return null
    const now = new Date()
    const end = new Date(trialEnd)
    const diff = end - now
    if (diff <= 0) return { text: 'Expired', expired: true }
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
    return { text: `${days} day${days !== 1 ? 's' : ''} remaining`, expired: false }
}

function StatusBadge({ status }) {
    const s = (status || 'pending').toLowerCase()
    const style = STATUS_STYLES[s] || STATUS_STYLES.pending
    return (
        <span className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full ${style.light} ${style.dark}`}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
        </span>
    )
}

function PlanBadge({ plan }) {
    const p = (plan || 'free').toLowerCase()
    const color = PLAN_COLORS[p] || PLAN_COLORS.free
    return (
        <span className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full ${color}`}>
            <Crown className="w-3 h-3 mr-1" />
            {p.charAt(0).toUpperCase() + p.slice(1)}
        </span>
    )
}

function RoleBadge({ role }) {
    const r = (role || 'user').toLowerCase()
    const colors = {
        admin: 'bg-purple-50 text-purple-700 dark:bg-[rgba(191,90,242,0.12)] dark:text-[#BF5AF2]',
        teacher: 'bg-blue-50 text-blue-700 dark:bg-[rgba(10,132,255,0.12)] dark:text-[#0A84FF]',
        student: 'bg-emerald-50 text-emerald-700 dark:bg-[rgba(48,209,88,0.12)] dark:text-[#30D158]',
        user: 'bg-gray-100 text-gray-600 dark:bg-[#2C2C2E] dark:text-[#8E8E93]',
    }
    return (
        <span className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full ${colors[r] || colors.user}`}>
            {r.charAt(0).toUpperCase() + r.slice(1)}
        </span>
    )
}

function InvoiceStatusBadge({ status }) {
    const s = (status || 'pending').toLowerCase()
    const map = {
        paid: STATUS_STYLES.active,
        pending: STATUS_STYLES.pending,
        overdue: STATUS_STYLES.suspended,
        cancelled: STATUS_STYLES.cancelled,
        draft: { light: 'bg-gray-100 text-gray-600 ring-1 ring-gray-200', dark: 'dark:bg-[#2C2C2E] dark:text-[#8E8E93] dark:ring-0' },
    }
    const style = map[s] || map.pending
    return (
        <span className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full ${style.light} ${style.dark}`}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
        </span>
    )
}

function ProgressBar({ current, max, label, unit }) {
    const isUnlimited = max === -1 || max === null || max === undefined
    const pct = isUnlimited ? 0 : (max > 0 ? Math.min((current / max) * 100, 100) : 0)
    const isHigh = !isUnlimited && pct >= 90
    const isMid = !isUnlimited && pct >= 70 && pct < 90
    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-[#8E8E93]">{label}</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                    {current?.toLocaleString()}{unit ? ` ${unit}` : ''} <span className="text-gray-400 dark:text-[#636366] font-normal">/ {isUnlimited ? 'Unlimited' : `${max?.toLocaleString()}${unit ? ` ${unit}` : ''}`}</span>
                </span>
            </div>
            <div className="h-2 rounded-full bg-gray-100 dark:bg-[#2C2C2E] overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-500 ${isHigh ? 'bg-red-500 dark:bg-[#FF453A]' : isMid ? 'bg-amber-500 dark:bg-[#FFD60A]' : 'bg-primary-500 dark:bg-[#3EC4B1]'}`}
                    style={{ width: `${isUnlimited ? 0 : pct}%` }}
                />
            </div>
        </div>
    )
}

function Spinner() {
    return (
        <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-200 border-t-primary-500" />
        </div>
    )
}

function EmptyState({ icon: Icon, title, description }) {
    return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-[#2C2C2E] flex items-center justify-center mb-3">
                <Icon className="w-6 h-6 text-gray-400 dark:text-[#636366]" />
            </div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{title}</p>
            {description && <p className="text-xs text-gray-500 dark:text-[#8E8E93] mt-1">{description}</p>}
        </div>
    )
}

function ErrorState({ message, onRetry }) {
    return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-[rgba(255,69,58,0.12)] flex items-center justify-center mb-3">
                <AlertTriangle className="w-6 h-6 text-red-500 dark:text-[#FF453A]" />
            </div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Failed to load data</p>
            <p className="text-xs text-gray-500 dark:text-[#8E8E93] mt-1">{message || 'An error occurred'}</p>
            {onRetry && (
                <button
                    onClick={onRetry}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-xl h-10 px-4 text-sm font-semibold text-gray-600 hover:bg-gray-100/80 dark:text-[#3EC4B1] dark:hover:bg-[rgba(62,196,177,0.08)] active:scale-[0.97] transition-all"
                >
                    <RefreshCw className="w-4 h-4" /> Retry
                </button>
            )}
        </div>
    )
}

// ─── Confirm Modal ─────────────────────────────────────────────────────────
function ConfirmModal({ isOpen, onClose, title, description, confirmLabel, confirmStyle, inputLabel, inputMatch, onConfirm, loading }) {
    const [inputValue, setInputValue] = useState('')

    useEffect(() => {
        if (isOpen) setInputValue('')
    }, [isOpen])

    if (!isOpen) return null

    const canConfirm = inputMatch ? inputValue === inputMatch : true

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 dark:bg-black/75 backdrop-blur-sm p-4" onClick={onClose}>
            <div
                className="bg-white dark:bg-[#1C1C1E] rounded-2xl w-full max-w-md p-6 space-y-4 shadow-xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-[rgba(255,69,58,0.12)] flex items-center justify-center flex-shrink-0">
                        <AlertTriangle className="w-5 h-5 text-red-600 dark:text-[#FF453A]" />
                    </div>
                    <div>
                        <h3 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h3>
                        <p className="text-sm text-gray-500 dark:text-[#8E8E93] mt-1">{description}</p>
                    </div>
                </div>

                {inputLabel && (
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1.5">{inputLabel}</label>
                        <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            placeholder={inputMatch || ''}
                            className="w-full h-11 sm:h-10 rounded-xl border border-gray-200 dark:border-[#38383A] bg-white dark:bg-[#2C2C2E] px-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-[#636366] focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-[#3EC4B1]"
                        />
                    </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="rounded-xl h-10 px-4 text-sm font-semibold text-gray-600 hover:bg-gray-100/80 dark:text-[#3EC4B1] dark:hover:bg-[rgba(62,196,177,0.08)] active:scale-[0.97] transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onConfirm(inputValue)}
                        disabled={!canConfirm || loading}
                        className={`rounded-xl h-10 px-4 text-sm font-semibold active:scale-[0.97] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${confirmStyle || 'bg-red-600 text-white hover:bg-red-500 dark:bg-[#FF453A] dark:hover:bg-[#FF6961]'}`}
                    >
                        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ─── Main Component ────────────────────────────────────────────────────────
export default function TenantSlideOver({ isOpen, onClose, tenantId, onUpdate }) {
    const [activeTab, setActiveTab] = useState('overview')
    const [tenant, setTenant] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    // Tab data states
    const [users, setUsers] = useState([])
    const [usersLoading, setUsersLoading] = useState(false)
    const [usersError, setUsersError] = useState(null)
    const [usersPage, setUsersPage] = useState(1)
    const [usersTotalPages, setUsersTotalPages] = useState(1)

    const [invoices, setInvoices] = useState([])
    const [invoicesLoading, setInvoicesLoading] = useState(false)
    const [invoicesError, setInvoicesError] = useState(null)

    const [activities, setActivities] = useState([])
    const [activitiesLoading, setActivitiesLoading] = useState(false)
    const [activitiesError, setActivitiesError] = useState(null)

    const [notes, setNotes] = useState([])
    const [notesLoading, setNotesLoading] = useState(false)
    const [notesError, setNotesError] = useState(null)
    const [newNote, setNewNote] = useState('')
    const [savingNote, setSavingNote] = useState(false)

    // Action states
    const [showActions, setShowActions] = useState(false)
    const [selectedPlan, setSelectedPlan] = useState('')
    const [plans, setPlans] = useState([])
    const [trialDays, setTrialDays] = useState(7)
    const [actionLoading, setActionLoading] = useState(null)

    // Confirm modals
    const [suspendModal, setSuspendModal] = useState(false)
    const [deleteModal, setDeleteModal] = useState(false)
    const [deleteNoteId, setDeleteNoteId] = useState(null)

    // ─── Fetch Tenant ──────────────────────────────────────────────────────
    const fetchTenant = useCallback(async () => {
        if (!tenantId) return
        setLoading(true)
        setError(null)
        try {
            const res = await superAdminService.getTenantById(tenantId)
            if (res.success) {
                setTenant(res.data)
                setSelectedPlan(res.data?.subscription?.plan || res.data?.plan || '')
            } else {
                setError(res.message || 'Failed to fetch tenant')
            }
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'Failed to fetch tenant')
        } finally {
            setLoading(false)
        }
    }, [tenantId])

    useEffect(() => {
        if (isOpen && tenantId) {
            setActiveTab('overview')
            fetchTenant()
        }
        if (!isOpen) {
            setTenant(null)
            setLoading(true)
            setError(null)
            setShowActions(false)
        }
    }, [isOpen, tenantId, fetchTenant])

    // ─── Fetch Tab Data ────────────────────────────────────────────────────
    const fetchUsers = useCallback(async (page = 1) => {
        if (!tenantId) return
        setUsersLoading(true)
        setUsersError(null)
        try {
            const res = await superAdminService.getTenantUsers(tenantId, { page, limit: 10 })
            if (res.success) {
                setUsers(res.data || [])
                const total = res.pagination?.total || res.total || 0
                setUsersTotalPages(Math.max(1, Math.ceil(total / 10)))
                setUsersPage(page)
            } else {
                setUsersError(res.message || 'Failed to load users')
            }
        } catch (err) {
            setUsersError(err.response?.data?.message || 'Failed to load users')
        } finally {
            setUsersLoading(false)
        }
    }, [tenantId])

    const fetchInvoices = useCallback(async () => {
        if (!tenantId) return
        setInvoicesLoading(true)
        setInvoicesError(null)
        try {
            const res = await superAdminService.getTenantInvoices(tenantId)
            if (res.success) {
                setInvoices(res.data || [])
            } else {
                setInvoicesError(res.message || 'Failed to load invoices')
            }
        } catch (err) {
            setInvoicesError(err.response?.data?.message || 'Failed to load invoices')
        } finally {
            setInvoicesLoading(false)
        }
    }, [tenantId])

    const fetchActivity = useCallback(async () => {
        if (!tenantId) return
        setActivitiesLoading(true)
        setActivitiesError(null)
        try {
            const res = await superAdminService.getTenantActivity(tenantId)
            if (res.success) {
                setActivities(res.data || [])
            } else {
                setActivitiesError(res.message || 'Failed to load activity')
            }
        } catch (err) {
            setActivitiesError(err.response?.data?.message || 'Failed to load activity')
        } finally {
            setActivitiesLoading(false)
        }
    }, [tenantId])

    const fetchNotes = useCallback(async () => {
        if (!tenantId) return
        setNotesLoading(true)
        setNotesError(null)
        try {
            const res = await superAdminService.getTenantNotes(tenantId)
            if (res.success) {
                setNotes(res.data || [])
            } else {
                setNotesError(res.message || 'Failed to load notes')
            }
        } catch (err) {
            setNotesError(err.response?.data?.message || 'Failed to load notes')
        } finally {
            setNotesLoading(false)
        }
    }, [tenantId])

    useEffect(() => {
        if (!isOpen || !tenantId) return
        if (activeTab === 'users') fetchUsers(1)
        if (activeTab === 'invoices') fetchInvoices()
        if (activeTab === 'activity') fetchActivity()
        if (activeTab === 'notes') fetchNotes()
    }, [activeTab, isOpen, tenantId, fetchUsers, fetchInvoices, fetchActivity, fetchNotes])

    // Fetch plans for change plan action
    useEffect(() => {
        if (showActions && plans.length === 0) {
            superAdminService.getPlans().then(res => {
                if (res.success) setPlans(res.data || [])
            }).catch(() => {})
        }
    }, [showActions, plans.length])

    // ─── Actions ───────────────────────────────────────────────────────────
    const handleChangePlan = async () => {
        if (!selectedPlan) return
        setActionLoading('plan')
        try {
            const res = await superAdminService.updateTenantPlan(tenantId, { plan: selectedPlan })
            if (res.success) {
                toast.success('Plan updated successfully')
                fetchTenant()
                onUpdate?.()
            } else {
                toast.error(res.message || 'Failed to update plan')
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to update plan')
        } finally {
            setActionLoading(null)
        }
    }

    const handleExtendTrial = async () => {
        if (!trialDays || trialDays < 1) return
        setActionLoading('trial')
        try {
            const res = await superAdminService.extendTenantTrial(tenantId, trialDays)
            if (res.success) {
                toast.success(`Trial extended by ${trialDays} days`)
                fetchTenant()
                onUpdate?.()
            } else {
                toast.error(res.message || 'Failed to extend trial')
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to extend trial')
        } finally {
            setActionLoading(null)
        }
    }

    const handleSuspend = async () => {
        setActionLoading('suspend')
        try {
            const res = await superAdminService.suspendTenant(tenantId)
            if (res.success) {
                toast.success('Account suspended')
                setSuspendModal(false)
                fetchTenant()
                onUpdate?.()
            } else {
                toast.error(res.message || 'Failed to suspend account')
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to suspend account')
        } finally {
            setActionLoading(null)
        }
    }

    const handleReactivate = async () => {
        setActionLoading('reactivate')
        try {
            const res = await superAdminService.activateTenant(tenantId)
            if (res.success) {
                toast.success('Account reactivated')
                fetchTenant()
                onUpdate?.()
            } else {
                toast.error(res.message || 'Failed to reactivate account')
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to reactivate account')
        } finally {
            setActionLoading(null)
        }
    }

    const handleResetAdminPassword = async () => {
        setActionLoading('reset')
        try {
            const res = await superAdminService.resetTenantAdminPassword(tenantId)
            if (res.success) {
                toast.success('Password reset email sent to admin')
            } else {
                toast.error(res.message || 'Failed to reset password')
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to reset password')
        } finally {
            setActionLoading(null)
        }
    }

    const handleDelete = async () => {
        setActionLoading('delete')
        try {
            const res = await superAdminService.deleteTenant(tenantId)
            if (res.success) {
                toast.success('School deleted permanently')
                setDeleteModal(false)
                onClose()
                onUpdate?.()
            } else {
                toast.error(res.message || 'Failed to delete school')
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to delete school')
        } finally {
            setActionLoading(null)
        }
    }

    const handleAddNote = async () => {
        if (!newNote.trim()) return
        setSavingNote(true)
        try {
            const res = await superAdminService.createTenantNote(tenantId, { content: newNote.trim() })
            if (res.success) {
                toast.success('Note added')
                setNewNote('')
                fetchNotes()
            } else {
                toast.error(res.message || 'Failed to add note')
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to add note')
        } finally {
            setSavingNote(false)
        }
    }

    const handleDeleteNote = async (noteId) => {
        setDeleteNoteId(null)
        try {
            const res = await superAdminService.deleteTenantNote(tenantId, noteId)
            if (res.success) {
                toast.success('Note deleted')
                fetchNotes()
            } else {
                toast.error(res.message || 'Failed to delete note')
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to delete note')
        }
    }

    // ─── Derived Data ──────────────────────────────────────────────────────
    const schoolName = tenant?.schoolName || tenant?.name || ''
    const schoolCode = tenant?.schoolCode || tenant?.code || ''
    const status = (tenant?.subscription?.status || tenant?.status || 'pending').toLowerCase()
    const plan = tenant?.subscription?.plan || tenant?.plan || 'free'
    const subdomain = tenant?.subdomain || ''
    const adminEmail = tenant?.adminEmail || tenant?.email || tenant?.admin?.email || ''
    const phone = tenant?.phone || tenant?.contactPhone || ''
    const addressObj = tenant?.address || {}
    const address = typeof addressObj === 'string'
        ? addressObj
        : [addressObj.street, addressObj.city, addressObj.state, addressObj.country, addressObj.zipCode].filter(Boolean).join(', ')
    const registrationDate = tenant?.createdAt
    const lastActivity = tenant?.lastActivity || tenant?.updatedAt
    const trialEnd = tenant?.subscription?.trialEndsAt || tenant?.subscription?.trialEnd || tenant?.trialEnd
    const subscriptionStart = tenant?.subscription?.startDate || tenant?.subscriptionStart
    const subscriptionEnd = tenant?.subscription?.endDate || tenant?.subscription?.currentPeriodEnd || tenant?.subscriptionEnd
    const usage = tenant?.usage || {}
    const rawFeatures = tenant?.features || tenant?.subscription?.features || tenant?.settings?.features || []
    const features = Array.isArray(rawFeatures)
        ? rawFeatures
        : Object.entries(rawFeatures).map(([key, value]) => ({ name: key, enabled: value }))
    const quickStats = {
        totalUsers: tenant?.stats?.totalUsers || usage?.totalUsers || 0,
        totalInvoices: tenant?.stats?.totalInvoices || 0,
        totalRevenue: tenant?.stats?.totalRevenue || 0,
        lastPayment: tenant?.stats?.lastPaymentDate || null,
    }
    const isSuspended = status === 'suspended'

    if (!isOpen) return null

    // ─── Render ────────────────────────────────────────────────────────────
    return (
        <Fragment>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-40 bg-black/40 dark:bg-black/75 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Slide Over Panel */}
            <div className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl flex">
                <div className="relative flex flex-col w-full bg-white dark:bg-[#1C1C1E] shadow-2xl overflow-hidden">

                    {/* ─── Header ───────────────────────────────────────────── */}
                    <div className="flex-shrink-0 border-b border-gray-200 dark:border-[#38383A] px-6 py-4">
                        {loading ? (
                            <div className="flex items-center gap-4 animate-pulse">
                                <div className="w-12 h-12 rounded-2xl bg-gray-200 dark:bg-[#2C2C2E]" />
                                <div className="flex-1 space-y-2">
                                    <div className="h-5 w-48 rounded bg-gray-200 dark:bg-[#2C2C2E]" />
                                    <div className="h-4 w-32 rounded bg-gray-100 dark:bg-[#2C2C2E]" />
                                </div>
                            </div>
                        ) : tenant ? (
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className={`w-12 h-12 rounded-2xl ${getAvatarColor(schoolName)} flex items-center justify-center flex-shrink-0`}>
                                        <span className="text-lg font-bold text-white">
                                            {schoolName.charAt(0).toUpperCase()}
                                        </span>
                                    </div>
                                    <div className="min-w-0">
                                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white truncate">{schoolName}</h2>
                                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                                            {schoolCode && (
                                                <span className="inline-flex items-center px-2 py-0.5 text-xs font-mono font-medium rounded-md bg-gray-100 text-gray-600 dark:bg-[#2C2C2E] dark:text-[#8E8E93]">
                                                    {schoolCode}
                                                </span>
                                            )}
                                            <StatusBadge status={status} />
                                            <PlanBadge plan={plan} />
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="rounded-xl h-10 w-10 flex items-center justify-center text-gray-400 hover:bg-gray-100/80 dark:text-[#636366] dark:hover:bg-[rgba(62,196,177,0.08)] active:scale-[0.97] transition-all flex-shrink-0"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        ) : null}
                    </div>

                    {/* ─── Tabs ──────────────────────────────────────────────── */}
                    <div className="flex-shrink-0 border-b border-gray-200 dark:border-[#38383A] px-6 overflow-x-auto">
                        <nav className="flex gap-1 -mb-px">
                            {TABS.map(tab => {
                                const Icon = tab.icon
                                const isActive = activeTab === tab.key && !showActions
                                return (
                                    <button
                                        key={tab.key}
                                        onClick={() => { setActiveTab(tab.key); setShowActions(false) }}
                                        className={`flex items-center gap-1.5 px-3 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                                            isActive
                                                ? 'border-primary-500 text-primary-600 dark:border-[#3EC4B1] dark:text-[#3EC4B1]'
                                                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-[#8E8E93] dark:hover:text-white'
                                        }`}
                                    >
                                        <Icon className="w-4 h-4" />
                                        <span className="hidden sm:inline">{tab.label}</span>
                                    </button>
                                )
                            })}

                            {/* Actions Toggle */}
                            <button
                                onClick={() => setShowActions(!showActions)}
                                className={`flex items-center gap-1.5 px-3 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap ml-auto ${
                                    showActions
                                        ? 'border-primary-500 text-primary-600 dark:border-[#3EC4B1] dark:text-[#3EC4B1]'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-[#8E8E93] dark:hover:text-white'
                                }`}
                            >
                                <Settings className="w-4 h-4" />
                                <span className="hidden sm:inline">Actions</span>
                            </button>
                        </nav>
                    </div>

                    {/* ─── Body ──────────────────────────────────────────────── */}
                    <div className="flex-1 overflow-y-auto">
                        {loading ? (
                            <Spinner />
                        ) : error ? (
                            <ErrorState message={error} onRetry={fetchTenant} />
                        ) : showActions ? (
                            <ActionsPanel
                                tenant={tenant}
                                plans={plans}
                                selectedPlan={selectedPlan}
                                setSelectedPlan={setSelectedPlan}
                                trialDays={trialDays}
                                setTrialDays={setTrialDays}
                                actionLoading={actionLoading}
                                isSuspended={isSuspended}
                                onChangePlan={handleChangePlan}
                                onExtendTrial={handleExtendTrial}
                                onSuspend={() => setSuspendModal(true)}
                                onReactivate={handleReactivate}
                                onResetPassword={handleResetAdminPassword}
                                onDelete={() => setDeleteModal(true)}
                            />
                        ) : (
                            <div className="p-6">
                                {activeTab === 'overview' && (
                                    <OverviewTab
                                        tenant={tenant}
                                        schoolName={schoolName}
                                        schoolCode={schoolCode}
                                        subdomain={subdomain}
                                        adminEmail={adminEmail}
                                        phone={phone}
                                        address={address}
                                        registrationDate={registrationDate}
                                        lastActivity={lastActivity}
                                        plan={plan}
                                        status={status}
                                        trialEnd={trialEnd}
                                        subscriptionStart={subscriptionStart}
                                        subscriptionEnd={subscriptionEnd}
                                        usage={usage}
                                        features={features}
                                        quickStats={quickStats}
                                    />
                                )}
                                {activeTab === 'users' && (
                                    <UsersTab
                                        users={users}
                                        loading={usersLoading}
                                        error={usersError}
                                        page={usersPage}
                                        totalPages={usersTotalPages}
                                        onPageChange={fetchUsers}
                                        onRetry={() => fetchUsers(usersPage)}
                                    />
                                )}
                                {activeTab === 'invoices' && (
                                    <InvoicesTab
                                        invoices={invoices}
                                        loading={invoicesLoading}
                                        error={invoicesError}
                                        onRetry={fetchInvoices}
                                    />
                                )}
                                {activeTab === 'activity' && (
                                    <ActivityTab
                                        activities={activities}
                                        loading={activitiesLoading}
                                        error={activitiesError}
                                        onRetry={fetchActivity}
                                    />
                                )}
                                {activeTab === 'notes' && (
                                    <NotesTab
                                        notes={notes}
                                        loading={notesLoading}
                                        error={notesError}
                                        newNote={newNote}
                                        setNewNote={setNewNote}
                                        savingNote={savingNote}
                                        onAddNote={handleAddNote}
                                        deleteNoteId={deleteNoteId}
                                        setDeleteNoteId={setDeleteNoteId}
                                        onDeleteNote={handleDeleteNote}
                                        onRetry={fetchNotes}
                                    />
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ─── Confirm Modals ─────────────────────────────────────────── */}
            <ConfirmModal
                isOpen={suspendModal}
                onClose={() => setSuspendModal(false)}
                title="Suspend Account"
                description={`This will immediately suspend "${schoolName}" and lock all users out. Type the school name to confirm.`}
                confirmLabel="Suspend Account"
                inputLabel="Type the school name to confirm"
                inputMatch={schoolName}
                onConfirm={handleSuspend}
                loading={actionLoading === 'suspend'}
            />

            <ConfirmModal
                isOpen={deleteModal}
                onClose={() => setDeleteModal(false)}
                title="Delete School Permanently"
                description={`This action is irreversible. All data for "${schoolName}" will be permanently deleted including users, courses, and files. Type DELETE to confirm.`}
                confirmLabel="Delete Permanently"
                confirmStyle="bg-red-700 text-white hover:bg-red-600 dark:bg-[#FF453A] dark:hover:bg-[#FF6961]"
                inputLabel={'Type "DELETE" to confirm'}
                inputMatch="DELETE"
                onConfirm={handleDelete}
                loading={actionLoading === 'delete'}
            />
        </Fragment>
    )
}

// ─── Overview Tab ──────────────────────────────────────────────────────────
function OverviewTab({ tenant, schoolName, schoolCode, subdomain, adminEmail, phone, address, registrationDate, lastActivity, plan, status, trialEnd, subscriptionStart, subscriptionEnd, usage, features, quickStats }) {
    const trialCountdown = getTrialCountdown(trialEnd)

    return (
        <div className="space-y-6">
            {/* School Info */}
            <section className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-gray-200 dark:border-[#38383A] overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 dark:border-[#2C2C2E]">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-gray-400 dark:text-[#636366]" />
                        School Information
                    </h3>
                </div>
                <div className="px-5 py-4 space-y-3">
                    <InfoRow icon={Building2} label="Name" value={schoolName} />
                    <InfoRow icon={Hash} label="Code" value={schoolCode} />
                    <InfoRow icon={Globe} label="Subdomain" value={subdomain ? `${subdomain}.learnovoportal.com` : 'Not set'} />
                    <InfoRow icon={Mail} label="Admin Email" value={adminEmail} />
                    <InfoRow icon={Phone} label="Phone" value={phone || 'Not provided'} />
                    <InfoRow icon={MapPin} label="Address" value={address || 'Not provided'} />
                    <InfoRow icon={Calendar} label="Registered" value={formatDate(registrationDate)} />
                    <InfoRow icon={Clock} label="Last Activity" value={formatDateTime(lastActivity)} />
                </div>
            </section>

            {/* Subscription */}
            <section className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-gray-200 dark:border-[#38383A] overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 dark:border-[#2C2C2E]">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <Crown className="w-4 h-4 text-gray-400 dark:text-[#636366]" />
                        Subscription
                    </h3>
                </div>
                <div className="px-5 py-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500 dark:text-[#8E8E93]">Plan</span>
                        <PlanBadge plan={plan} />
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500 dark:text-[#8E8E93]">Status</span>
                        <StatusBadge status={status} />
                    </div>
                    {trialEnd && (
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-500 dark:text-[#8E8E93]">Trial Ends</span>
                            <div className="text-right">
                                <span className="text-sm font-medium text-gray-900 dark:text-white">{formatDate(trialEnd)}</span>
                                {trialCountdown && (
                                    <span className={`ml-2 text-xs font-medium ${trialCountdown.expired ? 'text-red-500 dark:text-[#FF453A]' : 'text-amber-600 dark:text-[#FFD60A]'}`}>
                                        ({trialCountdown.text})
                                    </span>
                                )}
                            </div>
                        </div>
                    )}
                    {subscriptionStart && (
                        <InfoRow icon={Calendar} label="Start Date" value={formatDate(subscriptionStart)} />
                    )}
                    {subscriptionEnd && (
                        <InfoRow icon={Calendar} label="End Date" value={formatDate(subscriptionEnd)} />
                    )}
                </div>
            </section>

            {/* Usage */}
            <section className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-gray-200 dark:border-[#38383A] overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 dark:border-[#2C2C2E]">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <Activity className="w-4 h-4 text-gray-400 dark:text-[#636366]" />
                        Usage
                    </h3>
                </div>
                <div className="px-5 py-4 space-y-4">
                    <ProgressBar
                        current={usage?.students || usage?.currentStudents || 0}
                        max={usage?.maxStudents ?? null}
                        label="Students"
                    />
                    <ProgressBar
                        current={usage?.teachers || usage?.currentTeachers || 0}
                        max={usage?.maxTeachers ?? null}
                        label="Teachers"
                    />
                    <ProgressBar
                        current={usage?.storageUsed || usage?.currentStorage || 0}
                        max={usage?.maxStorage ?? null}
                        label="Storage"
                        unit="GB"
                    />
                </div>
            </section>

            {/* Quick Stats */}
            <section className="grid grid-cols-2 gap-3">
                <StatCard icon={Users} label="Total Users" value={quickStats.totalUsers} />
                <StatCard icon={FileText} label="Invoices" value={quickStats.totalInvoices} />
                <StatCard icon={DollarSign} label="Revenue" value={`$${quickStats.totalRevenue?.toLocaleString() || '0'}`} />
                <StatCard icon={CreditCard} label="Last Payment" value={quickStats.lastPayment ? formatDate(quickStats.lastPayment) : 'None'} small />
            </section>

            {/* Features */}
            {features.length > 0 && (
                <section className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-gray-200 dark:border-[#38383A] overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100 dark:border-[#2C2C2E]">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                            <Zap className="w-4 h-4 text-gray-400 dark:text-[#636366]" />
                            Features
                        </h3>
                    </div>
                    <div className="px-5 py-4">
                        <div className="grid grid-cols-2 gap-2">
                            {features.map((feature, i) => {
                                const featureName = typeof feature === 'string' ? feature : feature?.name || feature?.key || ''
                                const enabled = typeof feature === 'string' ? true : feature?.enabled !== false
                                return (
                                    <div key={i} className="flex items-center gap-2 text-sm">
                                        {enabled ? (
                                            <Check className="w-4 h-4 text-emerald-500 dark:text-[#30D158] flex-shrink-0" />
                                        ) : (
                                            <X className="w-4 h-4 text-gray-300 dark:text-[#636366] flex-shrink-0" />
                                        )}
                                        <span className={enabled ? 'text-gray-700 dark:text-white' : 'text-gray-400 dark:text-[#636366]'}>
                                            {featureName}
                                        </span>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </section>
            )}
        </div>
    )
}

function InfoRow({ icon: Icon, label, value }) {
    return (
        <div className="flex items-center justify-between py-1">
            <span className="flex items-center gap-2 text-sm text-gray-500 dark:text-[#8E8E93]">
                <Icon className="w-4 h-4" />
                {label}
            </span>
            <span className="text-sm font-medium text-gray-900 dark:text-white text-right truncate max-w-[60%]">{value}</span>
        </div>
    )
}

function StatCard({ icon: Icon, label, value, small }) {
    return (
        <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-gray-200 dark:border-[#38383A] p-4">
            <div className="flex items-center gap-2 mb-2">
                <Icon className="w-4 h-4 text-gray-400 dark:text-[#636366]" />
                <span className="text-xs text-gray-500 dark:text-[#8E8E93]">{label}</span>
            </div>
            <p className={`font-semibold text-gray-900 dark:text-white ${small ? 'text-sm' : 'text-xl'}`}>{value}</p>
        </div>
    )
}

// ─── Users Tab ─────────────────────────────────────────────────────────────
function UsersTab({ users, loading, error, page, totalPages, onPageChange, onRetry }) {
    if (loading) return <Spinner />
    if (error) return <ErrorState message={error} onRetry={onRetry} />
    if (users.length === 0) return <EmptyState icon={Users} title="No users found" description="This school has no registered users yet." />

    return (
        <div className="space-y-4">
            <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-[#38383A]">
                <table className="w-full">
                    <thead>
                        <tr className="bg-gray-50/80 dark:bg-[#2C2C2E]">
                            <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-[#8E8E93]">User</th>
                            <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-[#8E8E93]">Role</th>
                            <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-[#8E8E93]">Status</th>
                            <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-[#8E8E93]">Last Login</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-[#2C2C2E]">
                        {users.map(user => (
                            <tr key={user._id || user.id} className="hover:bg-gray-50 dark:hover:bg-[#2C2C2E] transition-colors">
                                <td className="px-4 py-3">
                                    <div>
                                        <p className="text-sm font-medium text-gray-900 dark:text-white">{user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'N/A'}</p>
                                        <p className="text-xs text-gray-500 dark:text-[#8E8E93]">{user.email}</p>
                                    </div>
                                </td>
                                <td className="px-4 py-3"><RoleBadge role={user.role} /></td>
                                <td className="px-4 py-3"><StatusBadge status={user.status || (user.isActive ? 'active' : 'suspended')} /></td>
                                <td className="px-4 py-3 text-xs text-gray-500 dark:text-[#8E8E93]">{user.lastLogin ? formatDateTime(user.lastLogin) : 'Never'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                    <button
                        onClick={() => onPageChange(page - 1)}
                        disabled={page <= 1}
                        className="rounded-xl h-10 px-4 text-sm font-semibold text-gray-600 hover:bg-gray-100/80 dark:text-[#3EC4B1] dark:hover:bg-[rgba(62,196,177,0.08)] active:scale-[0.97] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                    >
                        <ChevronLeft className="w-4 h-4" /> Previous
                    </button>
                    <span className="text-sm text-gray-500 dark:text-[#8E8E93]">
                        Page {page} of {totalPages}
                    </span>
                    <button
                        onClick={() => onPageChange(page + 1)}
                        disabled={page >= totalPages}
                        className="rounded-xl h-10 px-4 text-sm font-semibold text-gray-600 hover:bg-gray-100/80 dark:text-[#3EC4B1] dark:hover:bg-[rgba(62,196,177,0.08)] active:scale-[0.97] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                    >
                        Next <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            )}
        </div>
    )
}

// ─── Invoices Tab ──────────────────────────────────────────────────────────
function InvoicesTab({ invoices, loading, error, onRetry }) {
    if (loading) return <Spinner />
    if (error) return <ErrorState message={error} onRetry={onRetry} />
    if (invoices.length === 0) return <EmptyState icon={FileText} title="No invoices" description="No invoices have been generated for this school." />

    return (
        <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-[#38383A]">
            <table className="w-full">
                <thead>
                    <tr className="bg-gray-50/80 dark:bg-[#2C2C2E]">
                        <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-[#8E8E93]">Invoice</th>
                        <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-[#8E8E93]">Amount</th>
                        <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-[#8E8E93]">Status</th>
                        <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-[#8E8E93]">Due Date</th>
                        <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-[#8E8E93]">Method</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-[#2C2C2E]">
                    {invoices.map(inv => (
                        <tr key={inv._id || inv.id} className="hover:bg-gray-50 dark:hover:bg-[#2C2C2E] transition-colors">
                            <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                                {inv.invoiceNumber || inv.number || `INV-${(inv._id || inv.id || '').slice(-6)}`}
                            </td>
                            <td className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white">
                                ${(inv.amount || inv.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-4 py-3"><InvoiceStatusBadge status={inv.status} /></td>
                            <td className="px-4 py-3 text-xs text-gray-500 dark:text-[#8E8E93]">{formatDate(inv.dueDate)}</td>
                            <td className="px-4 py-3 text-xs text-gray-500 dark:text-[#8E8E93] capitalize">{inv.paymentMethod || inv.method || 'N/A'}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

// ─── Activity Tab ──────────────────────────────────────────────────────────
function ActivityTab({ activities, loading, error, onRetry }) {
    if (loading) return <Spinner />
    if (error) return <ErrorState message={error} onRetry={onRetry} />
    if (activities.length === 0) return <EmptyState icon={Activity} title="No activity" description="No recent activity recorded for this school." />

    return (
        <div className="space-y-0">
            {activities.map((item, idx) => (
                <div key={item._id || item.id || idx} className="relative flex gap-4 pb-6 last:pb-0">
                    {/* Timeline line */}
                    {idx < activities.length - 1 && (
                        <div className="absolute left-[15px] top-8 bottom-0 w-px bg-gray-200 dark:bg-[#38383A]" />
                    )}
                    {/* Dot */}
                    <div className="relative flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 dark:bg-[#2C2C2E] flex items-center justify-center">
                        <Activity className="w-4 h-4 text-gray-500 dark:text-[#8E8E93]" />
                    </div>
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900 dark:text-white">{item.action || item.description || item.message || 'Activity'}</p>
                        <div className="flex items-center gap-2 mt-1">
                            {(item.user || item.userName || item.performedBy) && (
                                <span className="text-xs text-gray-500 dark:text-[#8E8E93]">
                                    by {item.user?.name || item.userName || item.performedBy}
                                </span>
                            )}
                            <span className="text-xs text-gray-400 dark:text-[#636366]">
                                {formatDateTime(item.createdAt || item.timestamp || item.date)}
                            </span>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    )
}

// ─── Notes Tab ─────────────────────────────────────────────────────────────
function NotesTab({ notes, loading, error, newNote, setNewNote, savingNote, onAddNote, deleteNoteId, setDeleteNoteId, onDeleteNote, onRetry }) {
    if (loading) return <Spinner />
    if (error) return <ErrorState message={error} onRetry={onRetry} />

    return (
        <div className="space-y-6">
            {/* Add Note */}
            <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-gray-200 dark:border-[#38383A] p-5">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Add Custom Note</h4>
                <textarea
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Write an internal note about this school..."
                    rows={3}
                    className="w-full rounded-xl border border-gray-200 dark:border-[#38383A] bg-white dark:bg-[#2C2C2E] px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-[#636366] focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-[#3EC4B1] resize-none"
                />
                <div className="flex justify-end mt-3">
                    <button
                        onClick={onAddNote}
                        disabled={!newNote.trim() || savingNote}
                        className="rounded-xl h-10 px-4 text-sm font-semibold bg-primary-600 text-white hover:bg-primary-500 dark:bg-[#3EC4B1] dark:text-black dark:hover:bg-[#35a89a] active:scale-[0.97] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {savingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        Save Note
                    </button>
                </div>
            </div>

            {/* Notes List */}
            {notes.length === 0 ? (
                <EmptyState icon={StickyNote} title="No notes yet" description="Add internal notes about this school for your team." />
            ) : (
                <div className="space-y-3">
                    {notes.map(note => (
                        <div key={note._id || note.id} className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-gray-200 dark:border-[#38383A] p-4">
                            <div className="flex items-start justify-between gap-3">
                                <p className="text-sm text-gray-900 dark:text-white flex-1 whitespace-pre-wrap">{note.content || note.text || note.body}</p>
                                <button
                                    onClick={() => setDeleteNoteId(note._id || note.id)}
                                    className="rounded-xl h-8 w-8 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:text-[#636366] dark:hover:text-[#FF453A] dark:hover:bg-[rgba(255,69,58,0.08)] active:scale-[0.97] transition-all flex-shrink-0"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="flex items-center gap-2 mt-2 text-xs text-gray-400 dark:text-[#636366]">
                                {(note.author || note.createdBy) && (
                                    <span>{typeof note.author === 'object' ? note.author.name : (note.author || note.createdBy)}</span>
                                )}
                                <span>{formatDateTime(note.createdAt || note.date)}</span>
                            </div>

                            {/* Inline delete confirm */}
                            {deleteNoteId === (note._id || note.id) && (
                                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-[#2C2C2E] flex items-center justify-between">
                                    <span className="text-xs text-red-600 dark:text-[#FF453A] font-medium">Delete this note?</span>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setDeleteNoteId(null)}
                                            className="rounded-xl h-8 px-3 text-xs font-semibold text-gray-600 hover:bg-gray-100/80 dark:text-[#3EC4B1] dark:hover:bg-[rgba(62,196,177,0.08)] active:scale-[0.97] transition-all"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={() => onDeleteNote(note._id || note.id)}
                                            className="rounded-xl h-8 px-3 text-xs font-semibold bg-red-600 text-white hover:bg-red-500 dark:bg-[#FF453A] dark:hover:bg-[#FF6961] active:scale-[0.97] transition-all"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

// ─── Actions Panel ─────────────────────────────────────────────────────────
function ActionsPanel({ tenant, plans, selectedPlan, setSelectedPlan, trialDays, setTrialDays, actionLoading, isSuspended, onChangePlan, onExtendTrial, onSuspend, onReactivate, onResetPassword, onDelete }) {
    return (
        <div className="p-6 space-y-6">
            {/* Change Plan */}
            <section className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-gray-200 dark:border-[#38383A] p-5 space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <Crown className="w-4 h-4 text-gray-400 dark:text-[#636366]" />
                    Change Plan
                </h3>
                <div className="flex items-center gap-3">
                    <select
                        value={selectedPlan}
                        onChange={(e) => setSelectedPlan(e.target.value)}
                        className="flex-1 h-11 sm:h-10 rounded-xl border border-gray-200 dark:border-[#38383A] bg-white dark:bg-[#2C2C2E] px-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-[#3EC4B1]"
                    >
                        <option value="">Select a plan</option>
                        {plans.map(p => (
                            <option key={p._id || p.id} value={p.slug || p.name?.toLowerCase()}>
                                {p.name} {p.price ? `- $${p.price}/mo` : ''}
                            </option>
                        ))}
                        {plans.length === 0 && (
                            <>
                                <option value="free">Free</option>
                                <option value="starter">Starter</option>
                                <option value="professional">Professional</option>
                                <option value="enterprise">Enterprise</option>
                            </>
                        )}
                    </select>
                    <button
                        onClick={onChangePlan}
                        disabled={!selectedPlan || actionLoading === 'plan'}
                        className="rounded-xl h-10 px-4 text-sm font-semibold bg-primary-600 text-white hover:bg-primary-500 dark:bg-[#3EC4B1] dark:text-black dark:hover:bg-[#35a89a] active:scale-[0.97] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {actionLoading === 'plan' && <Loader2 className="w-4 h-4 animate-spin" />}
                        Save
                    </button>
                </div>
            </section>

            {/* Extend Trial */}
            <section className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-gray-200 dark:border-[#38383A] p-5 space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-400 dark:text-[#636366]" />
                    Extend Trial
                </h3>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 flex-1">
                        <input
                            type="number"
                            value={trialDays}
                            onChange={(e) => setTrialDays(Math.max(1, parseInt(e.target.value) || 1))}
                            min={1}
                            max={365}
                            className="w-24 h-11 sm:h-10 rounded-xl border border-gray-200 dark:border-[#38383A] bg-white dark:bg-[#2C2C2E] px-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-[#3EC4B1] text-center"
                        />
                        <span className="text-sm text-gray-500 dark:text-[#8E8E93]">days</span>
                    </div>
                    <button
                        onClick={onExtendTrial}
                        disabled={actionLoading === 'trial'}
                        className="rounded-xl h-10 px-4 text-sm font-semibold bg-primary-600 text-white hover:bg-primary-500 dark:bg-[#3EC4B1] dark:text-black dark:hover:bg-[#35a89a] active:scale-[0.97] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {actionLoading === 'trial' && <Loader2 className="w-4 h-4 animate-spin" />}
                        Extend
                    </button>
                </div>
            </section>

            {/* Account Actions */}
            <section className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-gray-200 dark:border-[#38383A] p-5 space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <Shield className="w-4 h-4 text-gray-400 dark:text-[#636366]" />
                    Account Actions
                </h3>
                <div className="space-y-3">
                    {/* Suspend / Reactivate */}
                    {isSuspended ? (
                        <button
                            onClick={onReactivate}
                            disabled={actionLoading === 'reactivate'}
                            className="w-full rounded-xl h-10 px-4 text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-500 dark:bg-[#30D158] dark:text-black dark:hover:bg-[#28b84c] active:scale-[0.97] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {actionLoading === 'reactivate' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                            Reactivate Account
                        </button>
                    ) : (
                        <button
                            onClick={onSuspend}
                            disabled={actionLoading === 'suspend'}
                            className="w-full rounded-xl h-10 px-4 text-sm font-semibold bg-red-600 text-white hover:bg-red-500 dark:bg-[#FF453A] dark:hover:bg-[#FF6961] active:scale-[0.97] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {actionLoading === 'suspend' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
                            Suspend Account
                        </button>
                    )}

                    {/* Reset Admin Password */}
                    <button
                        onClick={onResetPassword}
                        disabled={actionLoading === 'reset'}
                        className="w-full rounded-xl h-10 px-4 text-sm font-semibold text-gray-600 hover:bg-gray-100/80 dark:text-[#3EC4B1] dark:hover:bg-[rgba(62,196,177,0.08)] active:scale-[0.97] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 border border-gray-200 dark:border-[#38383A]"
                    >
                        {actionLoading === 'reset' ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                        Reset Admin Password
                    </button>
                </div>
            </section>

            {/* Danger Zone */}
            <section className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-red-200 dark:border-red-900/40 p-5 space-y-4">
                <h3 className="text-sm font-semibold text-red-600 dark:text-[#FF453A] flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Danger Zone
                </h3>
                <p className="text-xs text-gray-500 dark:text-[#8E8E93]">
                    This action is permanent and cannot be undone. All school data, users, courses, and files will be permanently deleted.
                </p>
                <button
                    onClick={onDelete}
                    disabled={actionLoading === 'delete'}
                    className="w-full rounded-xl h-10 px-4 text-sm font-semibold bg-red-700 text-white hover:bg-red-600 dark:bg-[#FF453A] dark:hover:bg-[#FF6961] active:scale-[0.97] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {actionLoading === 'delete' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    Delete School Permanently
                </button>
            </section>
        </div>
    )
}
