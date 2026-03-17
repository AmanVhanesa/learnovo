import React, { useState, useEffect } from 'react'
import {
    X, Mail, Phone, MapPin, Calendar, CreditCard, ShieldAlert,
    CheckCircle2, Square, Ban, Trash2, Save,
    Users, GraduationCap, Zap, Settings, RefreshCw, ChevronRight,
    Star, TrendingUp, Clock, AlertTriangle
} from 'lucide-react'
import { superAdminService } from '../../services/superAdminService'
import toast from 'react-hot-toast'

const TenantSlideOver = ({ isOpen, onClose, tenantId, onUpdate }) => {
    const [tenant, setTenant] = useState(null)
    const [isLoading, setIsLoading] = useState(false)
    const [isUpdating, setIsUpdating] = useState(false)
    const [activeTab, setActiveTab] = useState('overview')

    const [showPlanChange, setShowPlanChange] = useState(false)
    const [selectedPlan, setSelectedPlan] = useState('')
    const [showExtendTrial, setShowExtendTrial] = useState(false)
    const [trialDays, setTrialDays] = useState(14)
    const [showOverrideFeatures, setShowOverrideFeatures] = useState(false)
    const [overrideLimits, setOverrideLimits] = useState({ students: 0, teachers: 0 })

    useEffect(() => {
        if (isOpen && tenantId) {
            setActiveTab('overview')
            fetchTenantDetails()
        } else {
            setTenant(null)
            setShowPlanChange(false)
            setShowExtendTrial(false)
            setShowOverrideFeatures(false)
        }
    }, [isOpen, tenantId])

    const fetchTenantDetails = async () => {
        setIsLoading(true)
        try {
            const res = await superAdminService.getTenantById(tenantId)
            if (res.success) {
                setTenant(res.data)
                setSelectedPlan(res.data.subscription?.plan || '')
                setOverrideLimits({
                    students: res.data.subscription?.customLimits?.students || res.data.planConfig?.limits?.students || 0,
                    teachers: res.data.subscription?.customLimits?.teachers || res.data.planConfig?.limits?.teachers || 0,
                })
            }
        } catch {
            toast.error('Failed to load tenant details')
            onClose()
        } finally {
            setIsLoading(false)
        }
    }

    const handleStatusChange = async (action) => {
        if (!window.confirm(`Are you sure you want to ${action} this account?`)) return
        setIsUpdating(true)
        try {
            if (action === 'suspend') {
                await superAdminService.suspendTenant(tenantId)
                toast.success('Account suspended')
            } else if (action === 'activate') {
                await superAdminService.activateTenant(tenantId)
                toast.success('Account activated!')
            }
            fetchTenantDetails()
            if (onUpdate) onUpdate()
        } catch {
            toast.error(`Failed to ${action} account`)
        } finally {
            setIsUpdating(false)
        }
    }

    const handleChangePlan = async () => {
        setIsUpdating(true)
        try {
            await superAdminService.updateTenantPlan(tenantId, { plan: selectedPlan })
            toast.success('Plan updated!')
            setShowPlanChange(false)
            fetchTenantDetails()
            if (onUpdate) onUpdate()
        } catch {
            toast.error('Failed to update plan')
        } finally {
            setIsUpdating(false)
        }
    }

    const handleExtendTrial = async () => {
        setIsUpdating(true)
        try {
            await superAdminService.extendTenantTrial(tenantId, trialDays)
            toast.success(`Trial extended by ${trialDays} days!`)
            setShowExtendTrial(false)
            fetchTenantDetails()
            if (onUpdate) onUpdate()
        } catch {
            toast.error('Failed to extend trial')
        } finally {
            setIsUpdating(false)
        }
    }

    const handleOverrideFeatures = async () => {
        setIsUpdating(true)
        try {
            await superAdminService.overrideFeatures(tenantId, {
                customLimits: {
                    students: Number(overrideLimits.students),
                    teachers: Number(overrideLimits.teachers),
                }
            })
            toast.success('Custom limits applied!')
            setShowOverrideFeatures(false)
            fetchTenantDetails()
            if (onUpdate) onUpdate()
        } catch {
            toast.error('Failed to apply custom limits')
        } finally {
            setIsUpdating(false)
        }
    }

    const handleDeleteTenant = async () => {
        if (!window.confirm(
            `PERMANENTLY DELETE "${tenant?.schoolName}"?\n\nThis will deactivate the school and all its users. This action cannot be undone.`
        )) return
        setIsUpdating(true)
        try {
            await superAdminService.deleteTenant(tenantId)
            toast.success('Tenant deleted')
            onClose()
            if (onUpdate) onUpdate()
        } catch {
            toast.error('Failed to delete tenant')
        } finally {
            setIsUpdating(false)
        }
    }

    if (!isOpen) return null

    // --- Styling helpers ---
    const planLabel = {
        free: 'Free Trial', free_trial: 'Free Trial', basic: 'Basic',
        pro: 'Pro', premium: 'Premium', enterprise: 'Enterprise',
    }
    const planBadgeStyle = {
        free: 'bg-gray-100 text-gray-600 border-gray-200',
        free_trial: 'bg-gray-100 text-gray-600 border-gray-200',
        basic: 'bg-blue-50 text-blue-700 border-blue-200',
        pro: 'bg-violet-50 text-violet-700 border-violet-200',
        premium: 'bg-violet-50 text-violet-700 border-violet-200',
        enterprise: 'bg-amber-50 text-amber-700 border-amber-200',
    }
    const statusStyle = {
        active: { label: 'Active', dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700' },
        trial: { label: 'Trial', dot: 'bg-sky-500', badge: 'bg-sky-50 text-sky-700' },
        suspended: { label: 'Suspended', dot: 'bg-red-500', badge: 'bg-red-50 text-red-700' },
        cancelled: { label: 'Cancelled', dot: 'bg-gray-400', badge: 'bg-gray-50 text-gray-600' },
    }

    const currentStatus = tenant?.subscription?.status
    const plan = tenant?.subscription?.plan
    const pLabel = planLabel[plan] || plan || 'Free'
    const pBadge = planBadgeStyle[plan] || planBadgeStyle.free
    const ss = statusStyle[currentStatus] || statusStyle.cancelled
    const isSuspended = currentStatus === 'suspended'
    const isTrial = currentStatus === 'trial'
    const isActive = currentStatus === 'active'

    const studentLimit = tenant?.subscription?.customLimits?.students || tenant?.planConfig?.limits?.students || 0
    const studentCount = tenant?.usage?.students || 0
    const studentPercent = studentLimit ? Math.min(100, Math.round((studentCount / studentLimit) * 100)) : 0
    const teacherLimit = tenant?.subscription?.customLimits?.teachers || tenant?.planConfig?.limits?.teachers || 0
    const teacherCount = tenant?.usage?.teachers || 0
    const teacherPercent = teacherLimit ? Math.min(100, Math.round((teacherCount / teacherLimit) * 100)) : 0

    const tabs = [
        { id: 'overview', label: 'Overview', icon: TrendingUp },
        { id: 'settings', label: 'Settings', icon: Settings },
    ]

    const getInitials = (name) => name ? name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() : 'S'
    const avatarColors = ['bg-teal-600', 'bg-violet-600', 'bg-blue-600', 'bg-amber-600', 'bg-rose-600']
    const getAvatarColor = (name) => avatarColors[(name?.charCodeAt(0) || 0) % avatarColors.length]

    const UsageBar = ({ label, count, limit, percent, icon: Icon }) => (
        <div className="bg-white dark:bg-[#1C1C1E] rounded-xl border border-gray-100 dark:border-[#38383A] p-4">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-primary-50 rounded-lg flex items-center justify-center">
                        <Icon className="h-3.5 w-3.5 text-primary-600" />
                    </div>
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</span>
                </div>
                <span className="text-xs text-gray-400 dark:text-[#636366]">{limit > 0 ? `${percent}%` : 'Unlimited'}</span>
            </div>
            <div className="flex items-end gap-1 mb-2">
                <span className="text-2xl font-bold text-gray-900 dark:text-white">{count.toLocaleString()}</span>
                {limit > 0 && <span className="text-sm text-gray-400 pb-0.5">/ {limit.toLocaleString()}</span>}
            </div>
            {limit > 0 && (
                <div className="h-1.5 w-full bg-gray-100 dark:bg-[#2C2C2E] rounded-full overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all duration-500 ${percent > 90 ? 'bg-red-500' : percent > 70 ? 'bg-amber-500' : 'bg-primary-500'}`}
                        style={{ width: `${percent}%` }}
                    />
                </div>
            )}
        </div>
    )

    const FeatureRow = ({ label, enabled }) => (
        <div className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg ${enabled ? 'bg-primary-50/60 dark:bg-primary-900/20' : 'bg-gray-50 dark:bg-[#2C2C2E]'}`}>
            <span className={`text-sm ${enabled ? 'text-gray-800 dark:text-white' : 'text-gray-400 dark:text-[#636366]'}`}>{label}</span>
            {enabled
                ? <CheckCircle2 className="h-4 w-4 text-primary-500" />
                : <Square className="h-4 w-4 text-gray-300" />
            }
        </div>
    )

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
                <div className={`relative w-full max-w-2xl bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-2xl flex flex-col max-h-[90vh] transform transition-all duration-200 ${isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}>

                    {/* ── Header ── */}
                    {!isLoading && tenant ? (
                        <div className="px-6 pt-5 pb-4 border-b border-gray-100 dark:border-[#38383A] flex-shrink-0">
                            {/* Top row */}
                            <div className="flex items-start justify-between mb-4">
                                <span className="text-[10px] font-bold tracking-[0.15em] text-gray-400 dark:text-[#636366] uppercase">Manage Tenant</span>
                                <button
                                    onClick={onClose}
                                    className="w-8 h-8 hover:bg-gray-100 dark:hover:bg-[#2C2C2E] text-gray-400 hover:text-gray-600 dark:hover:text-white rounded-lg flex items-center justify-center transition-colors"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            {/* School identity */}
                            <div className="flex items-center gap-4">
                                {tenant.logo ? (
                                    <img src={tenant.logo} alt={tenant.schoolName} className="h-14 w-14 rounded-xl object-cover ring-1 ring-gray-200 flex-shrink-0" />
                                ) : (
                                    <div className={`w-14 h-14 ${getAvatarColor(tenant.schoolName)} rounded-xl flex items-center justify-center flex-shrink-0`}>
                                        <span className="text-white font-bold text-lg">{getInitials(tenant.schoolName)}</span>
                                    </div>
                                )}
                                <div className="min-w-0 flex-1">
                                    <h2 className="text-lg font-bold text-gray-900 dark:text-white leading-tight truncate">{tenant.schoolName || 'Unnamed School'}</h2>
                                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                        <span className="bg-gray-100 text-gray-600 text-[11px] font-semibold px-2 py-0.5 rounded font-mono">
                                            #{tenant.schoolCode?.toUpperCase()}
                                        </span>
                                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${ss.badge}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${ss.dot}`} />
                                            {ss.label}
                                        </span>
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border ${pBadge}`}>
                                            <Star className="h-2.5 w-2.5" /> {pLabel}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="px-6 pt-5 pb-4 border-b border-gray-100 dark:border-[#38383A] flex-shrink-0">
                            <div className="flex items-start justify-between mb-4">
                                <span className="text-[10px] font-bold tracking-[0.15em] text-gray-400 dark:text-[#636366] uppercase">Manage Tenant</span>
                                <button onClick={onClose} className="w-8 h-8 hover:bg-gray-100 dark:hover:bg-[#2C2C2E] text-gray-400 rounded-lg flex items-center justify-center">
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                            <div className="flex items-center gap-4 animate-pulse">
                                <div className="w-14 h-14 bg-gray-200 rounded-xl" />
                                <div className="space-y-2 flex-1">
                                    <div className="h-5 w-40 bg-gray-200 rounded" />
                                    <div className="h-3 w-28 bg-gray-100 rounded" />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── Tabs ── */}
                    {tenant && (
                        <div className="flex border-b border-gray-100 dark:border-[#38383A] px-6 flex-shrink-0 bg-gray-50/50 dark:bg-[#2C2C2E]/50">
                            {tabs.map(tab => {
                                const Icon = tab.icon
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${activeTab === tab.id
                                            ? 'border-primary-500 text-primary-700'
                                            : 'border-transparent text-gray-400 dark:text-[#636366] hover:text-gray-600 dark:hover:text-white'
                                            }`}
                                    >
                                        <Icon className="h-3.5 w-3.5" />
                                        {tab.label}
                                    </button>
                                )
                            })}
                        </div>
                    )}

                    {/* ── Content ── */}
                    <div className="flex-1 overflow-y-auto bg-gray-50/30 dark:bg-[#000000]/30">
                        {isLoading || !tenant ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400 dark:text-[#636366]">
                                <RefreshCw className="h-6 w-6 animate-spin text-primary-400" />
                                <span className="text-sm">Loading school details...</span>
                            </div>
                        ) : activeTab === 'overview' ? (
                            <div className="p-5 space-y-5">

                                {/* Contact Info */}
                                <div className="bg-white dark:bg-[#1C1C1E] rounded-xl border border-gray-100 dark:border-[#38383A] overflow-hidden">
                                    <div className="px-4 py-2.5 border-b border-gray-50 dark:border-[#38383A] bg-gray-50/50 dark:bg-[#2C2C2E]/50">
                                        <p className="text-[11px] font-bold tracking-widest uppercase text-gray-400 dark:text-[#636366]">Contact</p>
                                    </div>
                                    <div className="divide-y divide-gray-50 dark:divide-[#38383A]">
                                        {[
                                            { icon: Mail, value: tenant.email, href: `mailto:${tenant.email}`, fallback: 'No email provided' },
                                            { icon: Phone, value: tenant.phone, href: tenant.phone ? `tel:${tenant.phone}` : null, fallback: 'Not provided' },
                                            { icon: MapPin, value: tenant.address && typeof tenant.address === 'object' ? Object.values(tenant.address).filter(Boolean).join(', ') : tenant.address, fallback: 'Not provided' },
                                            { icon: Calendar, value: tenant.createdAt ? `Joined ${new Date(tenant.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}` : null, fallback: 'Unknown' },
                                        ].map(({ icon: Icon, value, href, fallback }, i) => (
                                            <div key={i} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/50 dark:hover:bg-[#2C2C2E]/50 transition-colors">
                                                <div className="w-8 h-8 bg-gray-50 dark:bg-[#2C2C2E] rounded-lg flex items-center justify-center flex-shrink-0">
                                                    <Icon className="h-3.5 w-3.5 text-gray-400 dark:text-[#636366]" />
                                                </div>
                                                {href && value
                                                    ? <a href={href} className="text-sm text-gray-700 dark:text-[#8E8E93] hover:text-primary-600 truncate transition-colors">{value}</a>
                                                    : <span className={`text-sm truncate ${value ? 'text-gray-700 dark:text-[#8E8E93]' : 'text-gray-400 dark:text-[#636366]'}`}>{value || fallback}</span>
                                                }
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Usage */}
                                <div>
                                    <p className="text-[11px] font-bold tracking-widest uppercase text-gray-400 dark:text-[#636366] mb-3">Usage</p>
                                    <div className="grid grid-cols-2 gap-3">
                                        <UsageBar label="Students" count={studentCount} limit={studentLimit} percent={studentPercent} icon={GraduationCap} />
                                        <UsageBar label="Teachers" count={teacherCount} limit={teacherLimit} percent={teacherPercent} icon={Users} />
                                    </div>
                                </div>

                                {/* Features */}
                                <div>
                                    <p className="text-[11px] font-bold tracking-widest uppercase text-gray-400 dark:text-[#636366] mb-3">Feature Access</p>
                                    <div className="space-y-1.5 bg-white dark:bg-[#1C1C1E] rounded-xl border border-gray-100 dark:border-[#38383A] p-3">
                                        <FeatureRow label="Core Academics" enabled={true} />
                                        <FeatureRow label="Attendance Tracking" enabled={true} />
                                        <FeatureRow label="Timetable & Homework" enabled={true} />
                                        <FeatureRow label="Grades & Exams" enabled={['basic', 'pro', 'premium', 'enterprise'].includes(plan)} />
                                        <FeatureRow label="Result Cards (PDF)" enabled={['basic', 'pro', 'premium', 'enterprise'].includes(plan)} />
                                        <FeatureRow label="Fees & Finance" enabled={['basic', 'pro', 'premium', 'enterprise'].includes(plan)} />
                                        <FeatureRow label="Fee Receipts (PDF)" enabled={['basic', 'pro', 'premium', 'enterprise'].includes(plan)} />
                                        <FeatureRow label="Basic Reports" enabled={['basic', 'pro', 'premium', 'enterprise'].includes(plan)} />
                                        <FeatureRow label="Advanced Analytics" enabled={['pro', 'premium', 'enterprise'].includes(plan)} />
                                        <FeatureRow label="Custom Reports" enabled={['pro', 'premium', 'enterprise'].includes(plan)} />
                                        <FeatureRow label="CSV Import" enabled={['basic', 'pro', 'premium', 'enterprise'].includes(plan)} />
                                        <FeatureRow label="API Access" enabled={['pro', 'premium', 'enterprise'].includes(plan)} />
                                        <FeatureRow label="Custom Integrations" enabled={['enterprise'].includes(plan)} />
                                        <FeatureRow label="Dedicated Account Manager" enabled={['enterprise'].includes(plan)} />
                                    </div>
                                </div>

                            </div>
                        ) : (
                            <div className="p-5 space-y-5">

                                {/* Subscription */}
                                <div className="bg-white dark:bg-[#1C1C1E] rounded-xl border border-gray-100 dark:border-[#38383A] overflow-hidden">
                                    <div className="px-4 py-2.5 border-b border-gray-50 dark:border-[#38383A] flex items-center justify-between bg-gray-50/50 dark:bg-[#2C2C2E]/50">
                                        <p className="text-[11px] font-bold tracking-widest uppercase text-gray-400 dark:text-[#636366]">Subscription Plan</p>
                                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${pBadge}`}>{pLabel}</span>
                                    </div>

                                    <div className="p-4 space-y-4">
                                        {showPlanChange ? (
                                            <div className="space-y-3 bg-primary-50/50 border border-primary-100 rounded-xl p-4">
                                                <p className="text-xs font-semibold text-primary-800">Select New Plan</p>
                                                <select
                                                    value={selectedPlan}
                                                    onChange={(e) => setSelectedPlan(e.target.value)}
                                                    className="block w-full border-gray-200 rounded-lg shadow-sm text-sm focus:ring-primary-500 focus:border-primary-500"
                                                >
                                                    <option value="free">Free Trial</option>
                                                    <option value="basic">Basic</option>
                                                    <option value="pro">Pro</option>
                                                    <option value="enterprise">Enterprise</option>
                                                </select>
                                                <div className="flex gap-2">
                                                    <button onClick={handleChangePlan} disabled={isUpdating || selectedPlan === plan}
                                                        className="flex-1 bg-primary-600 text-white text-xs font-semibold py-2.5 rounded-lg hover:bg-primary-700 disabled:opacity-50 transition">
                                                        {isUpdating ? 'Saving...' : 'Confirm Change'}
                                                    </button>
                                                    <button onClick={() => setShowPlanChange(false)}
                                                        className="flex-1 bg-white dark:bg-[#1C1C1E] border border-gray-200 text-gray-600 text-xs font-semibold py-2.5 rounded-lg hover:bg-gray-50 transition">
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <button onClick={() => setShowPlanChange(true)}
                                                className="w-full flex items-center justify-between p-3 rounded-xl border border-dashed border-gray-200 hover:border-primary-300 hover:bg-primary-50/50 transition-all group">
                                                <div className="flex items-center gap-2 text-sm font-medium text-gray-500 group-hover:text-primary-700">
                                                    <CreditCard className="h-4 w-4" />
                                                    Change Plan
                                                </div>
                                                <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-primary-500" />
                                            </button>
                                        )}

                                        {/* Date info */}
                                        <div className="flex items-center justify-between text-sm pt-1 border-t border-gray-50 dark:border-[#38383A]">
                                            <div className="flex items-center gap-1.5 text-gray-500 dark:text-[#8E8E93]">
                                                <Clock className="h-3.5 w-3.5" />
                                                <span className="text-xs">{isTrial ? 'Trial ends' : 'Period ends'}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-semibold text-gray-700 dark:text-white">
                                                    {tenant.subscription?.trialEndsAt
                                                        ? new Date(tenant.subscription.trialEndsAt).toLocaleDateString()
                                                        : tenant.subscription?.currentPeriodEnd
                                                            ? new Date(tenant.subscription.currentPeriodEnd).toLocaleDateString()
                                                            : 'N/A'}
                                                </span>
                                                {isTrial && (
                                                    <button
                                                        onClick={() => setShowExtendTrial(!showExtendTrial)}
                                                        className="text-[11px] font-bold text-primary-600 hover:text-primary-700 underline"
                                                    >Extend</button>
                                                )}
                                            </div>
                                        </div>

                                        {showExtendTrial && (
                                            <div className="bg-primary-50/50 border border-primary-100 rounded-xl p-3 flex gap-2">
                                                <select value={trialDays} onChange={(e) => setTrialDays(Number(e.target.value))}
                                                    className="flex-1 text-xs border-gray-200 rounded-lg shadow-sm">
                                                    <option value={7}>+ 7 days</option>
                                                    <option value={14}>+ 14 days</option>
                                                    <option value={30}>+ 30 days</option>
                                                    <option value={60}>+ 60 days</option>
                                                </select>
                                                <button onClick={handleExtendTrial} disabled={isUpdating}
                                                    className="bg-primary-600 text-white px-4 text-xs font-semibold rounded-lg hover:bg-primary-700 disabled:opacity-50 transition">
                                                    Extend
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Override Limits */}
                                <div className="bg-white dark:bg-[#1C1C1E] rounded-xl border border-gray-100 dark:border-[#38383A] overflow-hidden">
                                    <div className="px-4 py-2.5 border-b border-gray-50 dark:border-[#38383A] flex items-center justify-between bg-gray-50/50 dark:bg-[#2C2C2E]/50">
                                        <p className="text-[11px] font-bold tracking-widest uppercase text-gray-400 dark:text-[#636366]">Custom Limits</p>
                                        <button
                                            onClick={() => setShowOverrideFeatures(!showOverrideFeatures)}
                                            className={`text-[11px] font-bold uppercase tracking-wide ${showOverrideFeatures ? 'text-red-500' : 'text-primary-600 hover:text-primary-700'}`}
                                        >
                                            {showOverrideFeatures ? 'Cancel' : 'Override'}
                                        </button>
                                    </div>

                                    {showOverrideFeatures ? (
                                        <div className="p-4 space-y-3">
                                            <p className="text-xs text-amber-700 font-medium flex items-center gap-1.5 bg-amber-50 px-3 py-2 rounded-lg">
                                                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                                                These limits override plan defaults for this school only.
                                            </p>
                                            <div className="grid grid-cols-2 gap-3">
                                                {[
                                                    { label: 'Max Students', key: 'students' },
                                                    { label: 'Max Teachers', key: 'teachers' },
                                                ].map(({ label, key }) => (
                                                    <div key={key}>
                                                        <label className="block text-xs text-gray-600 font-medium mb-1">{label}</label>
                                                        <input
                                                            type="number" min="0"
                                                            value={overrideLimits[key]}
                                                            onChange={(e) => setOverrideLimits({ ...overrideLimits, [key]: e.target.value })}
                                                            className="block w-full border border-gray-200 rounded-lg text-sm px-3 py-2 focus:ring-primary-500 focus:border-primary-500"
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                            <button onClick={handleOverrideFeatures} disabled={isUpdating}
                                                className="w-full bg-primary-600 text-white py-2.5 text-xs font-semibold rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-1.5 transition">
                                                <Save className="h-3.5 w-3.5" /> Apply Custom Limits
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="p-4 grid grid-cols-2 gap-3">
                                            <div className="bg-gray-50 dark:bg-[#2C2C2E] rounded-lg p-3">
                                                <p className="text-[10px] text-gray-400 dark:text-[#636366] font-semibold uppercase tracking-wide mb-1">Students Cap</p>
                                                <p className="text-lg font-bold text-gray-900 dark:text-white">{studentLimit > 0 ? studentLimit.toLocaleString() : 'Unlimited'}</p>
                                            </div>
                                            <div className="bg-gray-50 dark:bg-[#2C2C2E] rounded-lg p-3">
                                                <p className="text-[10px] text-gray-400 dark:text-[#636366] font-semibold uppercase tracking-wide mb-1">Teachers Cap</p>
                                                <p className="text-lg font-bold text-gray-900 dark:text-white">{teacherLimit > 0 ? teacherLimit.toLocaleString() : 'Unlimited'}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Danger Zone */}
                                <div className="bg-white dark:bg-[#1C1C1E] border border-red-100 dark:border-red-900/50 rounded-xl overflow-hidden">
                                    <div className="px-4 py-2.5 border-b border-red-50 dark:border-red-900/30 bg-red-50/50 dark:bg-red-900/10 flex items-center gap-2">
                                        <ShieldAlert className="h-3.5 w-3.5 text-red-500" />
                                        <p className="text-[11px] font-bold text-red-600 uppercase tracking-wider">Danger Zone</p>
                                    </div>
                                    <div className="p-4">
                                        <p className="text-xs text-gray-500 dark:text-[#8E8E93] mb-3 leading-relaxed">
                                            Permanently deactivate this school and all its users. This cannot be undone.
                                        </p>
                                        <button
                                            onClick={handleDeleteTenant}
                                            disabled={isUpdating}
                                            className="w-full flex items-center justify-center gap-2 py-2.5 border border-red-200 text-red-600 text-xs font-semibold rounded-lg hover:bg-red-50 hover:border-red-300 transition-colors disabled:opacity-50"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                            Delete Tenant Permanently
                                        </button>
                                    </div>
                                </div>

                            </div>
                        )}
                    </div>

                    {/* ── Footer Action Bar ── */}
                    {tenant && (
                        <div className="flex-shrink-0 px-5 py-4 bg-white dark:bg-[#1C1C1E] border-t border-gray-100 dark:border-[#2C2C2E]">
                            {isSuspended ? (
                                <button onClick={() => handleStatusChange('activate')} disabled={isUpdating}
                                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                                    <CheckCircle2 className="h-4 w-4" /> Activate Account
                                </button>
                            ) : isTrial ? (
                                <button onClick={() => handleStatusChange('activate')} disabled={isUpdating}
                                    className="w-full bg-primary-600 hover:bg-primary-700 text-white py-3 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                                    <Zap className="h-4 w-4" /> Activate — End Trial
                                </button>
                            ) : isActive ? (
                                <button onClick={() => handleStatusChange('suspend')} disabled={isUpdating}
                                    className="w-full border-2 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 py-3 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                                    <Ban className="h-4 w-4" /> Suspend Account
                                </button>
                            ) : (
                                <button onClick={() => handleStatusChange('activate')} disabled={isUpdating}
                                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                                    <CheckCircle2 className="h-4 w-4" /> Reactivate Account
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </>
    )
}

export default TenantSlideOver
