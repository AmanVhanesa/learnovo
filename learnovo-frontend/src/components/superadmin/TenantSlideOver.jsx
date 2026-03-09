import React, { useState, useEffect } from 'react'
import {
    X, Mail, Phone, MapPin, Calendar, CreditCard, ShieldAlert,
    CheckCircle2, CheckSquare, Square, Ban, Trash2, Save,
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
            `⚠️ PERMANENTLY DELETE "${tenant?.schoolName}"?\n\nThis will deactivate the school and all its users. This action cannot be undone.`
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
    const planConfig = {
        free: { label: 'Free Trial', gradient: 'from-slate-500 to-gray-600', badge: 'bg-gray-100 text-gray-700 ring-1 ring-gray-300' },
        free_trial: { label: 'Free Trial', gradient: 'from-slate-500 to-gray-600', badge: 'bg-gray-100 text-gray-700 ring-1 ring-gray-300' },
        basic: { label: 'Basic', gradient: 'from-blue-500 to-cyan-600', badge: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200' },
        pro: { label: 'Pro', gradient: 'from-violet-500 to-purple-600', badge: 'bg-violet-50 text-violet-700 ring-1 ring-violet-200' },
        premium: { label: 'Premium', gradient: 'from-violet-500 to-purple-600', badge: 'bg-violet-50 text-violet-700 ring-1 ring-violet-200' },
        enterprise: { label: 'Enterprise', gradient: 'from-amber-500 to-orange-500', badge: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' },
    }
    const statusConfig = {
        active: { label: 'Active', dot: 'bg-emerald-400', ring: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' },
        trial: { label: 'Trial', dot: 'bg-blue-400', ring: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200' },
        suspended: { label: 'Suspended', dot: 'bg-red-400', ring: 'bg-red-50 text-red-700 ring-1 ring-red-200' },
        cancelled: { label: 'Cancelled', dot: 'bg-gray-400', ring: 'bg-gray-50 text-gray-700 ring-1 ring-gray-200' },
    }

    const currentStatus = tenant?.subscription?.status
    const plan = tenant?.subscription?.plan
    const pc = planConfig[plan] || planConfig.free
    const sc = statusConfig[currentStatus] || statusConfig.cancelled
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

    const SchoolInitials = ({ name, size = 'xl' }) => {
        const initials = name ? name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() : 'S'
        const colors = ['from-emerald-400 to-teal-500', 'from-violet-400 to-purple-500', 'from-blue-400 to-cyan-500', 'from-amber-400 to-orange-500']
        const color = colors[(name?.charCodeAt(0) || 0) % colors.length]
        return (
            <div className={`bg-gradient-to-br ${color} flex items-center justify-center rounded-2xl shadow-lg ${size === 'xl' ? 'h-16 w-16 text-xl' : 'h-10 w-10 text-sm'} font-bold text-white flex-shrink-0`}>
                {initials}
            </div>
        )
    }

    const UsageBar = ({ label, count, limit, percent, icon: Icon }) => (
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-primary-50 rounded-lg flex items-center justify-center">
                        <Icon className="h-3.5 w-3.5 text-primary-600" />
                    </div>
                    <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{label}</span>
                </div>
                <span className="text-xs text-gray-400">{limit > 0 ? `${percent}%` : '∞'}</span>
            </div>
            <div className="flex items-end gap-1 mb-2">
                <span className="text-2xl font-bold text-gray-900">{count.toLocaleString()}</span>
                {limit > 0 && <span className="text-sm text-gray-400 pb-0.5">/ {limit.toLocaleString()}</span>}
            </div>
            {limit > 0 && (
                <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all duration-500 ${percent > 90 ? 'bg-gradient-to-r from-red-400 to-red-500' : percent > 70 ? 'bg-gradient-to-r from-amber-400 to-orange-400' : 'bg-gradient-to-r from-primary-400 to-primary-500'}`}
                        style={{ width: `${percent}%` }}
                    />
                </div>
            )}
        </div>
    )

    const FeatureRow = ({ label, enabled }) => (
        <div className={`flex items-center justify-between px-4 py-3 rounded-xl border ${enabled ? 'bg-primary-50 border-primary-100' : 'bg-gray-50 border-gray-100'}`}>
            <span className={`text-sm font-medium ${enabled ? 'text-primary-800' : 'text-gray-400'}`}>{label}</span>
            {enabled
                ? <div className="flex items-center gap-1.5 text-xs text-primary-700 font-medium"><CheckCircle2 className="h-4 w-4 text-primary-500" /> Enabled</div>
                : <div className="flex items-center gap-1.5 text-xs text-gray-400"><Square className="h-4 w-4" /> Locked</div>
            }
        </div>
    )

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity"
                onClick={onClose}
            />

            {/* Centered Modal */}
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
                <div className={`relative w-full max-w-2xl bg-gray-50 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] transform transition-all duration-300 ease-out ${isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}>

                    {/* ── Hero Header ── */}
                    {!isLoading && tenant && (
                        <div className={`bg-gradient-to-br ${pc.gradient} px-6 pt-5 pb-6 flex-shrink-0 relative overflow-hidden`}>
                            {/* Decorative circles */}
                            <div className="absolute -top-6 -right-6 w-32 h-32 bg-white/10 rounded-full" />
                            <div className="absolute top-8 -right-2 w-16 h-16 bg-white/10 rounded-full" />

                            {/* Close button */}
                            <div className="flex justify-between items-start mb-5 relative z-10">
                                <span className="text-[10px] font-bold tracking-[0.15em] text-white/70 uppercase">Manage Tenant</span>
                                <button
                                    onClick={onClose}
                                    className="w-8 h-8 bg-white/20 hover:bg-white/30 text-white rounded-full flex items-center justify-center transition-colors"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            {/* School Identity */}
                            <div className="flex items-center gap-4 relative z-10">
                                {tenant.logo ? (
                                    <img src={tenant.logo} alt={tenant.schoolName} className="h-16 w-16 rounded-2xl object-cover shadow-lg ring-2 ring-white/30 flex-shrink-0" />
                                ) : (
                                    <SchoolInitials name={tenant.schoolName} />
                                )}
                                <div className="min-w-0">
                                    <h2 className="text-xl font-bold text-white leading-tight truncate">{tenant.schoolName || 'Unnamed School'}</h2>
                                    <div className="flex flex-wrap items-center gap-2 mt-2">
                                        <span className="bg-white/20 text-white text-[11px] font-semibold px-2 py-0.5 rounded-md">
                                            #{tenant.schoolCode?.toUpperCase()}
                                        </span>
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${sc.ring}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                                            {sc.label}
                                        </span>
                                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${pc.badge}`}>
                                            <Star className="h-2.5 w-2.5" /> {pc.label}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Loading Header Placeholder */}
                    {(isLoading || !tenant) && (
                        <div className="bg-gradient-to-br from-gray-400 to-gray-500 px-6 pt-5 pb-6 flex-shrink-0">
                            <div className="flex justify-between items-start mb-5">
                                <span className="text-[10px] font-bold tracking-widest text-white/70 uppercase">Manage Tenant</span>
                                <button onClick={onClose} className="w-8 h-8 bg-white/20 text-white rounded-full flex items-center justify-center">
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                            <div className="flex items-center gap-4 animate-pulse">
                                <div className="h-16 w-16 bg-white/20 rounded-2xl" />
                                <div className="space-y-2">
                                    <div className="h-5 w-40 bg-white/20 rounded" />
                                    <div className="h-3 w-24 bg-white/20 rounded" />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── Tabs ── */}
                    {tenant && (
                        <div className="flex border-b border-gray-200 bg-white px-4 flex-shrink-0">
                            {tabs.map(tab => {
                                const Icon = tab.icon
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${activeTab === tab.id
                                            ? 'border-primary-500 text-primary-700'
                                            : 'border-transparent text-gray-500 hover:text-gray-700'
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
                    <div className="flex-1 overflow-y-auto">
                        {isLoading || !tenant ? (
                            <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
                                <RefreshCw className="h-7 w-7 animate-spin text-primary-400" />
                                <span className="text-sm">Loading school details...</span>
                            </div>
                        ) : activeTab === 'overview' ? (
                            <div className="p-5 space-y-5">

                                {/* Contact Info */}
                                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                                    <div className="px-4 py-3 border-b border-gray-50">
                                        <p className="text-[11px] font-bold tracking-widest uppercase text-gray-400">Contact</p>
                                    </div>
                                    <div className="divide-y divide-gray-50">
                                        {[
                                            { icon: Mail, value: tenant.email, href: `mailto:${tenant.email}` },
                                            { icon: Phone, value: tenant.phone, href: `tel:${tenant.phone}` },
                                            { icon: MapPin, value: tenant.address && typeof tenant.address === 'object' ? Object.values(tenant.address).filter(Boolean).join(', ') : tenant.address },
                                            { icon: Calendar, value: `Joined ${new Date(tenant.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}` },
                                        ].map(({ icon: Icon, value, href }, i) => (
                                            <div key={i} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/70 transition-colors">
                                                <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center flex-shrink-0">
                                                    <Icon className="h-3.5 w-3.5 text-gray-400" />
                                                </div>
                                                {href
                                                    ? <a href={href} className="text-sm text-gray-700 hover:text-primary-600 truncate transition-colors">{value || 'Not provided'}</a>
                                                    : <span className="text-sm text-gray-700 truncate">{value || 'Not provided'}</span>
                                                }
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Usage */}
                                <div>
                                    <p className="text-[11px] font-bold tracking-widest uppercase text-gray-400 mb-3">Usage</p>
                                    <div className="grid grid-cols-2 gap-3">
                                        <UsageBar label="Students" count={studentCount} limit={studentLimit} percent={studentPercent} icon={GraduationCap} />
                                        <UsageBar label="Teachers" count={teacherCount} limit={teacherLimit} percent={teacherPercent} icon={Users} />
                                    </div>
                                </div>

                                {/* Features */}
                                <div>
                                    <p className="text-[11px] font-bold tracking-widest uppercase text-gray-400 mb-3">Feature Access</p>
                                    <div className="space-y-2">
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
                                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                                    <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
                                        <p className="text-[11px] font-bold tracking-widest uppercase text-gray-400">Subscription Plan</p>
                                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${pc.badge}`}>{pc.label}</span>
                                    </div>

                                    <div className="p-4 space-y-4">
                                        {showPlanChange ? (
                                            <div className="space-y-3 bg-blue-50 border border-blue-100 rounded-xl p-4">
                                                <p className="text-xs font-semibold text-blue-800">Select New Plan</p>
                                                <select
                                                    value={selectedPlan}
                                                    onChange={(e) => setSelectedPlan(e.target.value)}
                                                    className="block w-full border-gray-300 rounded-lg shadow-sm text-sm focus:ring-primary-500 focus:border-primary-500"
                                                >
                                                    <option value="free">Free Trial</option>
                                                    <option value="basic">Basic</option>
                                                    <option value="pro">Pro</option>
                                                    <option value="enterprise">Enterprise</option>
                                                </select>
                                                <div className="flex gap-2">
                                                    <button onClick={handleChangePlan} disabled={isUpdating || selectedPlan === plan}
                                                        className="flex-1 bg-primary-600 text-white text-xs font-semibold py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50 transition">
                                                        {isUpdating ? 'Saving...' : 'Confirm Change'}
                                                    </button>
                                                    <button onClick={() => setShowPlanChange(false)}
                                                        className="flex-1 bg-white border border-gray-200 text-gray-600 text-xs font-semibold py-2 rounded-lg hover:bg-gray-50 transition">
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <button onClick={() => setShowPlanChange(true)}
                                                className="w-full flex items-center justify-between p-3 rounded-xl border border-dashed border-gray-300 hover:border-primary-400 hover:bg-primary-50 transition-all group">
                                                <div className="flex items-center gap-2 text-sm font-medium text-gray-600 group-hover:text-primary-700">
                                                    <CreditCard className="h-4 w-4" />
                                                    Change Plan
                                                </div>
                                                <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-primary-500" />
                                            </button>
                                        )}

                                        {/* Date info */}
                                        <div className="flex items-center justify-between text-sm pt-1 border-t border-gray-50">
                                            <div className="flex items-center gap-1.5 text-gray-500">
                                                <Clock className="h-3.5 w-3.5" />
                                                <span className="text-xs">{isTrial ? 'Trial ends' : 'Period ends'}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-semibold text-gray-700">
                                                    {tenant.subscription?.trialEndsAt
                                                        ? new Date(tenant.subscription.trialEndsAt).toLocaleDateString()
                                                        : tenant.subscription?.currentPeriodEnd
                                                            ? new Date(tenant.subscription.currentPeriodEnd).toLocaleDateString()
                                                            : 'N/A'}
                                                </span>
                                                {isTrial && (
                                                    <button
                                                        onClick={() => setShowExtendTrial(!showExtendTrial)}
                                                        className="text-[11px] font-bold text-blue-600 hover:text-blue-700 underline"
                                                    >Extend</button>
                                                )}
                                            </div>
                                        </div>

                                        {showExtendTrial && (
                                            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex gap-2">
                                                <select value={trialDays} onChange={(e) => setTrialDays(Number(e.target.value))}
                                                    className="flex-1 text-xs border-gray-300 rounded-lg shadow-sm">
                                                    <option value={7}>+ 7 days</option>
                                                    <option value={14}>+ 14 days</option>
                                                    <option value={30}>+ 30 days</option>
                                                    <option value={60}>+ 60 days</option>
                                                </select>
                                                <button onClick={handleExtendTrial} disabled={isUpdating}
                                                    className="bg-blue-600 text-white px-4 text-xs font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition">
                                                    Extend
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Override Limits */}
                                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                                    <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
                                        <p className="text-[11px] font-bold tracking-widest uppercase text-gray-400">Custom Limits</p>
                                        <button
                                            onClick={() => setShowOverrideFeatures(!showOverrideFeatures)}
                                            className={`text-[11px] font-bold uppercase tracking-wide ${showOverrideFeatures ? 'text-red-500' : 'text-primary-600 hover:text-primary-700'}`}
                                        >
                                            {showOverrideFeatures ? 'Cancel' : 'Override'}
                                        </button>
                                    </div>

                                    {showOverrideFeatures ? (
                                        <div className="p-4 space-y-3 bg-amber-50/50">
                                            <p className="text-xs text-amber-700 font-medium flex items-center gap-1.5">
                                                <AlertTriangle className="h-3.5 w-3.5" />
                                                These limits override the plan defaults for this school only.
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
                                                            className="block w-full border border-gray-300 rounded-lg text-sm px-3 py-2 focus:ring-primary-500 focus:border-primary-500"
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                            <button onClick={handleOverrideFeatures} disabled={isUpdating}
                                                className="w-full bg-primary-600 text-white py-2 text-xs font-semibold rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-1.5 transition">
                                                <Save className="h-3.5 w-3.5" /> Apply Custom Limits
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="p-4 grid grid-cols-2 gap-3">
                                            <div className="bg-gray-50 rounded-xl p-3">
                                                <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-1">Students Cap</p>
                                                <p className="text-lg font-bold text-gray-900">{studentLimit > 0 ? studentLimit.toLocaleString() : '∞'}</p>
                                            </div>
                                            <div className="bg-gray-50 rounded-xl p-3">
                                                <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-1">Teachers Cap</p>
                                                <p className="text-lg font-bold text-gray-900">{teacherLimit > 0 ? teacherLimit.toLocaleString() : '∞'}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Danger Zone */}
                                <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <ShieldAlert className="h-4 w-4 text-red-500" />
                                        <p className="text-xs font-bold text-red-700 uppercase tracking-wider">Danger Zone</p>
                                    </div>
                                    <p className="text-xs text-red-500 mb-3 leading-relaxed">
                                        Deleting this tenant is irreversible. The account will be deactivated.
                                    </p>
                                    <button
                                        onClick={handleDeleteTenant}
                                        disabled={isUpdating}
                                        className="w-full flex items-center justify-center gap-2 py-2.5 border border-red-200 text-red-600 text-xs font-semibold rounded-xl hover:bg-red-100 hover:border-red-300 transition-colors disabled:opacity-50"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                        Delete Tenant Permanently
                                    </button>
                                </div>

                            </div>
                        )}
                    </div>

                    {/* ── Footer Action Bar ── */}
                    {tenant && (
                        <div className="flex-shrink-0 p-4 bg-white border-t border-gray-100 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
                            <div className="flex gap-3">
                                {isSuspended ? (
                                    <button onClick={() => handleStatusChange('activate')} disabled={isUpdating}
                                        className="flex-1 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white py-3 rounded-xl font-semibold text-sm transition-all shadow-sm shadow-emerald-200 flex items-center justify-center gap-2 disabled:opacity-50">
                                        <CheckCircle2 className="h-4 w-4" /> Activate Account
                                    </button>
                                ) : isTrial ? (
                                    <button onClick={() => handleStatusChange('activate')} disabled={isUpdating}
                                        className="flex-1 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white py-3 rounded-xl font-semibold text-sm transition-all shadow-sm shadow-primary-200 flex items-center justify-center gap-2 disabled:opacity-50">
                                        <Zap className="h-4 w-4" /> Activate — End Trial
                                    </button>
                                ) : isActive ? (
                                    <button onClick={() => handleStatusChange('suspend')} disabled={isUpdating}
                                        className="flex-1 bg-white border-2 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                                        <Ban className="h-4 w-4" /> Suspend Account
                                    </button>
                                ) : (
                                    <button onClick={() => handleStatusChange('activate')} disabled={isUpdating}
                                        className="flex-1 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white py-3 rounded-xl font-semibold text-sm transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50">
                                        <CheckCircle2 className="h-4 w-4" /> Reactivate Account
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    )
}

export default TenantSlideOver
