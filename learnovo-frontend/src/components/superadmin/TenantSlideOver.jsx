import React, { useState, useEffect } from 'react'
import { X, Building2, Mail, Phone, MapPin, Calendar, CreditCard, ShieldAlert, CheckCircle2, CheckSquare, Square, Ban, Trash2, Save, Clock } from 'lucide-react'
import { superAdminService } from '../../services/superAdminService'
import toast from 'react-hot-toast'

const TenantSlideOver = ({ isOpen, onClose, tenantId, onUpdate }) => {
    const [tenant, setTenant] = useState(null)
    const [isLoading, setIsLoading] = useState(false)
    const [isUpdating, setIsUpdating] = useState(false)

    // Plan change state
    const [showPlanChange, setShowPlanChange] = useState(false)
    const [selectedPlan, setSelectedPlan] = useState('')

    // Extend trial state
    const [showExtendTrial, setShowExtendTrial] = useState(false)
    const [trialDays, setTrialDays] = useState(7)

    // Override features state
    const [showOverrideFeatures, setShowOverrideFeatures] = useState(false)
    const [overrideLimits, setOverrideLimits] = useState({ students: 0, teachers: 0 })

    useEffect(() => {
        if (isOpen && tenantId) {
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
        } catch (error) {
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
                toast.success('Account suspended successfully')
            } else if (action === 'activate') {
                await superAdminService.activateTenant(tenantId)
                toast.success('Account activated successfully')
            }
            fetchTenantDetails()
            if (onUpdate) onUpdate()
        } catch (error) {
            toast.error(`Failed to ${action} account`)
        } finally {
            setIsUpdating(false)
        }
    }

    const handleChangePlan = async () => {
        setIsUpdating(true)
        try {
            await superAdminService.updateTenantPlan(tenantId, { plan: selectedPlan })
            toast.success('Plan updated successfully')
            setShowPlanChange(false)
            fetchTenantDetails()
            if (onUpdate) onUpdate()
        } catch (error) {
            toast.error('Failed to update plan')
        } finally {
            setIsUpdating(false)
        }
    }

    const handleExtendTrial = async () => {
        setIsUpdating(true)
        try {
            await superAdminService.extendTenantTrial(tenantId, trialDays)
            toast.success(`Trial extended by ${trialDays} days`)
            setShowExtendTrial(false)
            fetchTenantDetails()
            if (onUpdate) onUpdate()
        } catch (error) {
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
            toast.success('Custom limits applied successfully')
            setShowOverrideFeatures(false)
            fetchTenantDetails()
            if (onUpdate) onUpdate()
        } catch (error) {
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
            toast.success('Tenant deleted successfully')
            onClose()
            if (onUpdate) onUpdate()
        } catch (error) {
            toast.error('Failed to delete tenant')
        } finally {
            setIsUpdating(false)
        }
    }

    if (!isOpen) return null

    // Helper styling
    const planColors = {
        free: 'bg-gray-100 text-gray-800',
        free_trial: 'bg-gray-100 text-gray-800',
        basic: 'bg-blue-100 text-blue-800',
        pro: 'bg-purple-100 text-purple-800',
        premium: 'bg-purple-100 text-purple-800',
        enterprise: 'bg-yellow-100 text-yellow-800'
    }
    const planNames = {
        free: 'Free Trial',
        free_trial: 'Free Trial',
        basic: 'Basic',
        pro: 'Pro',
        premium: 'Premium',
        enterprise: 'Enterprise'
    }
    const statusColors = {
        active: 'bg-green-100 text-green-800',
        trial: 'bg-blue-100 text-blue-800',
        suspended: 'bg-red-100 text-red-800',
        cancelled: 'bg-gray-100 text-gray-800'
    }

    const studentLimit = tenant?.subscription?.customLimits?.students || tenant?.planConfig?.limits?.students || 0
    const studentCount = tenant?.usage?.students || 0
    const studentPercent = studentLimit ? Math.min(100, Math.round((studentCount / studentLimit) * 100)) : 0

    const teacherLimit = tenant?.subscription?.customLimits?.teachers || tenant?.planConfig?.limits?.teachers || 0
    const teacherCount = tenant?.usage?.teachers || 0
    const teacherPercent = teacherLimit ? Math.min(100, Math.round((teacherCount / teacherLimit) * 100)) : 0

    const currentStatus = tenant?.subscription?.status
    const isSuspended = currentStatus === 'suspended'
    const isTrial = currentStatus === 'trial'
    const isActive = currentStatus === 'active'

    return (
        <>
            <div className="fixed inset-0 bg-gray-900 bg-opacity-50 z-40 transition-opacity" onClick={onClose} />

            <div className={`fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-2xl transform transition-transform duration-300 ease-in-out flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50 flex-shrink-0">
                    <h2 className="text-lg font-semibold text-gray-900">Manage Tenant</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200 text-gray-500 transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Content area */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {isLoading || !tenant ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                        </div>
                    ) : (
                        <>
                            {/* Profile Header */}
                            <div className="flex items-start gap-4 pb-6 border-b border-gray-100">
                                <div className="h-16 w-16 rounded-xl bg-primary-100 flex items-center justify-center flex-shrink-0 shadow-sm">
                                    {tenant.logo ? (
                                        <img src={tenant.logo} alt={tenant.schoolName} className="h-full w-full object-cover rounded-xl" />
                                    ) : (
                                        <span className="text-2xl font-bold text-primary-700">{(tenant.schoolName || 'S').charAt(0)}</span>
                                    )}
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-gray-900 leading-tight">{tenant.schoolName || 'Unnamed School'}</h3>
                                    <div className="flex items-center mt-1 space-x-2 flex-wrap gap-1">
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
                                            {tenant.schoolCode}
                                        </span>
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${statusColors[currentStatus] || 'bg-gray-100 text-gray-800'}`}>
                                            {currentStatus?.toUpperCase()}
                                        </span>
                                        {tenant.subscription?.isManualOverride && (
                                            <span className="bg-yellow-100 text-yellow-800 text-[10px] px-2 py-0.5 rounded-full border border-yellow-200">Custom Limits</span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Contact Info */}
                            <div className="space-y-3">
                                <h4 className="text-xs font-bold tracking-wider text-gray-500 uppercase">Contact Information</h4>
                                <div className="grid grid-cols-1 gap-3 text-sm">
                                    <div className="flex items-center text-gray-600">
                                        <Mail className="h-4 w-4 mr-3 text-gray-400" />
                                        <span className="truncate">{tenant.email || 'Not provided'}</span>
                                    </div>
                                    <div className="flex items-center text-gray-600">
                                        <Phone className="h-4 w-4 mr-3 text-gray-400" />
                                        <span>{tenant.phone || 'Not provided'}</span>
                                    </div>
                                    <div className="flex items-start text-gray-600">
                                        <MapPin className="h-4 w-4 mr-3 text-gray-400 mt-0.5" />
                                        <span>{tenant.address && typeof tenant.address === 'object'
                                            ? Object.values(tenant.address).filter(Boolean).join(', ')
                                            : tenant.address || 'Not provided'}</span>
                                    </div>
                                    <div className="flex items-center text-gray-600">
                                        <Calendar className="h-4 w-4 mr-3 text-gray-400" />
                                        <span>Registered: {new Date(tenant.createdAt).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Subscription Card */}
                            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                                <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                                    <h4 className="text-sm font-bold text-gray-900 flex items-center">
                                        <CreditCard className="h-4 w-4 mr-2 text-primary-600" />
                                        Subscription
                                    </h4>
                                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${planColors[tenant.subscription?.plan] || 'bg-gray-100 text-gray-800'}`}>
                                        {planNames[tenant.subscription?.plan] || tenant.subscription?.plan}
                                    </span>
                                </div>

                                <div className="p-5 space-y-4">
                                    {/* Plan Change */}
                                    {showPlanChange ? (
                                        <div className="space-y-3 bg-gray-50 p-3 rounded-lg border border-gray-200">
                                            <label className="text-xs font-medium text-gray-700">Select New Plan</label>
                                            <select
                                                value={selectedPlan}
                                                onChange={(e) => setSelectedPlan(e.target.value)}
                                                className="block w-full border-gray-300 rounded-md shadow-sm sm:text-sm focus:ring-primary-500 focus:border-primary-500"
                                            >
                                                <option value="free">Free Trial</option>
                                                <option value="basic">Basic</option>
                                                <option value="pro">Pro</option>
                                                <option value="enterprise">Enterprise</option>
                                            </select>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={handleChangePlan}
                                                    disabled={isUpdating || selectedPlan === tenant.subscription?.plan}
                                                    className="flex-1 bg-primary-600 text-white text-xs font-medium py-1.5 rounded hover:bg-primary-700 disabled:opacity-50"
                                                >Save</button>
                                                <button
                                                    onClick={() => setShowPlanChange(false)}
                                                    className="flex-1 bg-white border border-gray-300 text-gray-700 text-xs font-medium py-1.5 rounded hover:bg-gray-50"
                                                >Cancel</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <p className="text-xs text-gray-500">Current Plan</p>
                                                <p className="text-sm font-semibold text-gray-900">{planNames[tenant.subscription?.plan] || tenant.subscription?.plan}</p>
                                            </div>
                                            <button
                                                onClick={() => setShowPlanChange(true)}
                                                className="text-xs font-medium text-primary-600 hover:text-primary-800 hover:underline"
                                            >Change Plan</button>
                                        </div>
                                    )}

                                    {/* Trial End / Period End */}
                                    <div className="pt-3 border-t border-gray-100">
                                        <p className="text-xs text-gray-500 mb-1">
                                            {isTrial ? 'Trial Ends' : 'Period Ends'}
                                        </p>
                                        <div className="flex justify-between items-center">
                                            <p className="text-sm font-medium text-gray-900">
                                                {tenant.subscription?.trialEndsAt
                                                    ? new Date(tenant.subscription.trialEndsAt).toLocaleDateString()
                                                    : tenant.subscription?.currentPeriodEnd
                                                        ? new Date(tenant.subscription.currentPeriodEnd).toLocaleDateString()
                                                        : 'N/A'}
                                            </p>
                                            {isTrial && (
                                                <button
                                                    onClick={() => setShowExtendTrial(!showExtendTrial)}
                                                    className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline"
                                                >Extend Trial</button>
                                            )}
                                        </div>

                                        {showExtendTrial && (
                                            <div className="mt-3 flex gap-2">
                                                <select
                                                    value={trialDays}
                                                    onChange={(e) => setTrialDays(Number(e.target.value))}
                                                    className="block w-full text-xs border-gray-300 rounded-md shadow-sm"
                                                >
                                                    <option value={7}>+ 7 days</option>
                                                    <option value={14}>+ 14 days</option>
                                                    <option value={30}>+ 30 days</option>
                                                    <option value={60}>+ 60 days</option>
                                                </select>
                                                <button
                                                    onClick={handleExtendTrial}
                                                    disabled={isUpdating}
                                                    className="bg-blue-600 text-white px-3 text-xs font-medium rounded hover:bg-blue-700 transition disabled:opacity-50"
                                                >Extend</button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Usage Stats */}
                            <div className="space-y-3">
                                <h4 className="text-xs font-bold tracking-wider text-gray-500 uppercase">Usage Limits</h4>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
                                        <p className="text-xs text-gray-500 font-medium mb-1">Students</p>
                                        <p className="text-lg font-bold text-gray-900 mb-2">
                                            {studentCount} <span className="text-xs text-gray-400 font-normal">/ {studentLimit || '∞'}</span>
                                        </p>
                                        {studentLimit > 0 && (
                                            <div className="w-full bg-gray-200 rounded-full h-1.5">
                                                <div
                                                    className={`h-1.5 rounded-full ${studentPercent > 90 ? 'bg-red-500' : 'bg-primary-500'}`}
                                                    style={{ width: `${studentPercent}%` }}
                                                ></div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
                                        <p className="text-xs text-gray-500 font-medium mb-1">Teachers</p>
                                        <p className="text-lg font-bold text-gray-900 mb-2">
                                            {teacherCount} <span className="text-xs text-gray-400 font-normal">/ {teacherLimit || '∞'}</span>
                                        </p>
                                        {teacherLimit > 0 && (
                                            <div className="w-full bg-gray-200 rounded-full h-1.5">
                                                <div
                                                    className={`h-1.5 rounded-full ${teacherPercent > 90 ? 'bg-red-500' : 'bg-primary-500'}`}
                                                    style={{ width: `${teacherPercent}%` }}
                                                ></div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Feature Access + Override */}
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <h4 className="text-xs font-bold tracking-wider text-gray-500 uppercase">Feature Access</h4>
                                    <button
                                        onClick={() => setShowOverrideFeatures(!showOverrideFeatures)}
                                        className="text-[10px] font-bold text-primary-600 hover:text-primary-800 uppercase tracking-wider"
                                    >
                                        {showOverrideFeatures ? 'Hide' : 'Override Limits'}
                                    </button>
                                </div>

                                {/* Override Limits Inline Form */}
                                {showOverrideFeatures && (
                                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
                                        <p className="text-xs text-amber-700 font-medium">Set custom limits for this school (overrides plan defaults)</p>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs text-gray-600 mb-1">Max Students (0 = plan default)</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={overrideLimits.students}
                                                    onChange={(e) => setOverrideLimits({ ...overrideLimits, students: e.target.value })}
                                                    className="block w-full border border-gray-300 rounded text-sm px-2 py-1.5 focus:ring-primary-500 focus:border-primary-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs text-gray-600 mb-1">Max Teachers (0 = plan default)</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={overrideLimits.teachers}
                                                    onChange={(e) => setOverrideLimits({ ...overrideLimits, teachers: e.target.value })}
                                                    className="block w-full border border-gray-300 rounded text-sm px-2 py-1.5 focus:ring-primary-500 focus:border-primary-500"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={handleOverrideFeatures}
                                                disabled={isUpdating}
                                                className="flex-1 bg-primary-600 text-white text-xs font-medium py-1.5 rounded hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-1"
                                            >
                                                <Save className="h-3 w-3" /> Apply Overrides
                                            </button>
                                            <button
                                                onClick={() => setShowOverrideFeatures(false)}
                                                className="flex-1 bg-white border border-gray-300 text-gray-700 text-xs font-medium py-1.5 rounded hover:bg-gray-50"
                                            >Cancel</button>
                                        </div>
                                    </div>
                                )}

                                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden text-sm shadow-sm">
                                    <div className="flex items-center justify-between p-3 border-b border-gray-100 hover:bg-gray-50">
                                        <span className="text-gray-700 font-medium">Core Academics</span>
                                        <CheckSquare className="h-4 w-4 text-primary-500" />
                                    </div>
                                    <div className="flex items-center justify-between p-3 border-b border-gray-100 hover:bg-gray-50">
                                        <span className="text-gray-700 font-medium">Attendance Tracking</span>
                                        <CheckSquare className="h-4 w-4 text-primary-500" />
                                    </div>
                                    <div className="flex items-center justify-between p-3 border-b border-gray-100 hover:bg-gray-50">
                                        <span className={`font-medium ${tenant.subscription?.plan !== 'free' && tenant.subscription?.plan !== 'free_trial' ? 'text-gray-700' : 'text-gray-400'}`}>
                                            Fees &amp; Finance
                                        </span>
                                        {tenant.subscription?.plan !== 'free' && tenant.subscription?.plan !== 'free_trial'
                                            ? <CheckSquare className="h-4 w-4 text-primary-500" />
                                            : <Square className="h-4 w-4 text-gray-300" />}
                                    </div>
                                    <div className="flex items-center justify-between p-3 hover:bg-gray-50">
                                        <span className={`font-medium ${['pro', 'premium', 'enterprise'].includes(tenant.subscription?.plan) ? 'text-gray-700' : 'text-gray-400'}`}>
                                            Advanced Analytics
                                        </span>
                                        {['pro', 'premium', 'enterprise'].includes(tenant.subscription?.plan)
                                            ? <CheckSquare className="h-4 w-4 text-primary-500" />
                                            : <Square className="h-4 w-4 text-gray-300" />}
                                    </div>
                                </div>
                            </div>

                            {/* Danger Zone */}
                            <div className="border border-red-200 rounded-lg p-4 bg-red-50">
                                <h4 className="text-xs font-bold text-red-800 uppercase tracking-wider mb-2 flex items-center gap-1">
                                    <ShieldAlert className="h-3.5 w-3.5" /> Danger Zone
                                </h4>
                                <p className="text-xs text-red-600 mb-3">Deleting a tenant is permanent. All school data will remain in the database but the account will be deactivated.</p>
                                <button
                                    onClick={handleDeleteTenant}
                                    disabled={isUpdating}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-red-300 text-red-700 text-xs font-medium rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                                >
                                    <Trash2 className="h-4 w-4" />
                                    Delete Tenant
                                </button>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer Actions */}
                {tenant && (
                    <div className="p-4 border-t border-gray-200 bg-gray-50 flex gap-3 flex-shrink-0">
                        {isSuspended ? (
                            <button
                                onClick={() => handleStatusChange('activate')}
                                disabled={isUpdating}
                                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 px-4 rounded-lg font-medium text-sm transition-colors flex items-center justify-center shadow-sm disabled:opacity-50"
                            >
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                Activate Account
                            </button>
                        ) : isTrial ? (
                            <button
                                onClick={() => handleStatusChange('activate')}
                                disabled={isUpdating}
                                className="flex-1 bg-primary-600 hover:bg-primary-700 text-white py-2.5 px-4 rounded-lg font-medium text-sm transition-colors flex items-center justify-center shadow-sm disabled:opacity-50"
                            >
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                Activate (End Trial)
                            </button>
                        ) : isActive ? (
                            <button
                                onClick={() => handleStatusChange('suspend')}
                                disabled={isUpdating}
                                className="flex-1 bg-white border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 py-2.5 px-4 rounded-lg font-medium text-sm transition-colors flex items-center justify-center shadow-sm disabled:opacity-50"
                            >
                                <Ban className="h-4 w-4 mr-2" />
                                Suspend Account
                            </button>
                        ) : (
                            <button
                                onClick={() => handleStatusChange('activate')}
                                disabled={isUpdating}
                                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 px-4 rounded-lg font-medium text-sm transition-colors flex items-center justify-center shadow-sm disabled:opacity-50"
                            >
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                Reactivate
                            </button>
                        )}
                    </div>
                )}
            </div>
        </>
    )
}

export default TenantSlideOver
