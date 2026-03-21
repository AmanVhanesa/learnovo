import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { superAdminService } from '../../services/superAdminService'
import toast from 'react-hot-toast'
import {
  Plus, Pencil, Trash2, Star, Check, X, Crown, Zap, Rocket, Building2,
  Users, GraduationCap, ToggleLeft, ToggleRight, ChevronDown, ChevronUp,
  Copy, Tag, Percent, IndianRupee, Calendar, Hash, Ticket, RefreshCw,
  Sparkles, Shield, BarChart3, FileText, Globe, MessageSquare, Palette,
  CreditCard, Settings, BookOpen, ClipboardList, Clock
} from 'lucide-react'

// ─── Feature definitions ──────────────────────────────────────────────────────
const ALL_FEATURES = [
  { key: 'coreAcademics', label: 'Core Academics', icon: BookOpen },
  { key: 'attendanceTracking', label: 'Attendance Tracking', icon: ClipboardList },
  { key: 'timetableManagement', label: 'Timetable Management', icon: Clock },
  { key: 'gradesExams', label: 'Grades & Exams', icon: FileText },
  { key: 'feesFinance', label: 'Fees & Finance', icon: IndianRupee },
  { key: 'basicReports', label: 'Basic Reports', icon: BarChart3 },
  { key: 'csvImport', label: 'CSV Import', icon: FileText },
  { key: 'parentPortal', label: 'Parent Portal', icon: Users },
  { key: 'advancedAnalytics', label: 'Advanced Analytics', icon: BarChart3 },
  { key: 'customReports', label: 'Custom Reports', icon: FileText },
  { key: 'apiAccess', label: 'API Access', icon: Globe },
  { key: 'paymentGateway', label: 'Payment Gateway', icon: CreditCard },
  { key: 'smsWhatsapp', label: 'SMS & WhatsApp', icon: MessageSquare },
  { key: 'customIntegrations', label: 'Custom Integrations', icon: Settings },
  { key: 'whiteLabel', label: 'White Label', icon: Palette },
]

// ─── Static fallback data ─────────────────────────────────────────────────────
const PLANS_FALLBACK = [
  {
    id: 'free_trial', name: 'Free Trial', price: 0, yearlyPrice: 0, period: '/ 14 days',
    limits: { students: 50, teachers: 5 }, activeSubscribers: 0, isActive: true, isPopular: false,
    features: {
      coreAcademics: true, attendanceTracking: true, timetableManagement: true,
      gradesExams: true, feesFinance: false, basicReports: true,
      csvImport: false, parentPortal: false, advancedAnalytics: false,
      customReports: false, apiAccess: false, paymentGateway: false,
      smsWhatsapp: false, customIntegrations: false, whiteLabel: false,
    },
  },
  {
    id: 'basic', name: 'Basic', price: 2999, yearlyPrice: 28790, period: '/ month',
    limits: { students: 500, teachers: 30 }, activeSubscribers: 0, isActive: true, isPopular: false,
    features: {
      coreAcademics: true, attendanceTracking: true, timetableManagement: true,
      gradesExams: true, feesFinance: true, basicReports: true,
      csvImport: true, parentPortal: true, advancedAnalytics: false,
      customReports: false, apiAccess: false, paymentGateway: false,
      smsWhatsapp: false, customIntegrations: false, whiteLabel: false,
    },
  },
  {
    id: 'pro', name: 'Pro', price: 6999, yearlyPrice: 67190, period: '/ month',
    limits: { students: 2000, teachers: 100 }, activeSubscribers: 0, isActive: true, isPopular: true,
    features: {
      coreAcademics: true, attendanceTracking: true, timetableManagement: true,
      gradesExams: true, feesFinance: true, basicReports: true,
      csvImport: true, parentPortal: true, advancedAnalytics: true,
      customReports: true, apiAccess: true, paymentGateway: true,
      smsWhatsapp: false, customIntegrations: false, whiteLabel: false,
    },
  },
  {
    id: 'enterprise', name: 'Enterprise', price: null, yearlyPrice: null, period: 'Custom',
    limits: { students: 0, teachers: 0 }, activeSubscribers: 0, isActive: true, isPopular: false,
    features: {
      coreAcademics: true, attendanceTracking: true, timetableManagement: true,
      gradesExams: true, feesFinance: true, basicReports: true,
      csvImport: true, parentPortal: true, advancedAnalytics: true,
      customReports: true, apiAccess: true, paymentGateway: true,
      smsWhatsapp: true, customIntegrations: true, whiteLabel: true,
    },
  },
]

const PLAN_ICONS = {
  free_trial: Zap,
  basic: Rocket,
  pro: Crown,
  enterprise: Building2,
}

const PLAN_COLORS = {
  free_trial: { bg: 'bg-gray-100 dark:bg-[#2C2C2E]', text: 'text-gray-600 dark:text-[#8E8E93]' },
  basic: { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-600 dark:text-blue-400' },
  pro: { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-600 dark:text-amber-400' },
  enterprise: { bg: 'bg-purple-50 dark:bg-purple-900/20', text: 'text-purple-600 dark:text-purple-400' },
}

const formatCurrency = (amount) => {
  if (amount === null || amount === undefined) return 'Custom'
  return `₹${amount.toLocaleString('en-IN')}`
}

const generateCouponCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = 'LRN'
  for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length))
  return code
}

// ─── Main Component ───────────────────────────────────────────────────────────
const Plans = () => {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('plans')
  const [showPlanModal, setShowPlanModal] = useState(false)
  const [editingPlan, setEditingPlan] = useState(null)
  const [showCouponModal, setShowCouponModal] = useState(false)
  const [editingCoupon, setEditingCoupon] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null)
  const [showComparisonTable, setShowComparisonTable] = useState(false)

  // ─── Plans Queries ────────────────────────────────────────────────────────
  const { data: plansData, isLoading: isLoadingPlans, error: plansError } = useQuery({
    queryKey: ['superadmin-plans'],
    queryFn: async () => {
      try {
        const res = await superAdminService.getPlans()
        if (res.success && res.data?.length > 0) return res.data
        return PLANS_FALLBACK
      } catch {
        return PLANS_FALLBACK
      }
    },
  })

  const plans = plansData || PLANS_FALLBACK

  const createPlanMutation = useMutation({
    mutationFn: (data) => superAdminService.createPlan(data),
    onSuccess: () => {
      toast.success('Plan created successfully')
      setShowPlanModal(false)
      setEditingPlan(null)
      queryClient.invalidateQueries({ queryKey: ['superadmin-plans'] })
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to create plan'),
  })

  const updatePlanMutation = useMutation({
    mutationFn: ({ id, data }) => superAdminService.updatePlan(id, data),
    onSuccess: () => {
      toast.success('Plan updated successfully')
      setShowPlanModal(false)
      setEditingPlan(null)
      queryClient.invalidateQueries({ queryKey: ['superadmin-plans'] })
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to update plan'),
  })

  const deletePlanMutation = useMutation({
    mutationFn: (id) => superAdminService.deletePlan(id),
    onSuccess: () => {
      toast.success('Plan deleted successfully')
      setShowDeleteConfirm(null)
      queryClient.invalidateQueries({ queryKey: ['superadmin-plans'] })
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to delete plan'),
  })

  // ─── Coupons Queries ──────────────────────────────────────────────────────
  const { data: couponsData, isLoading: isLoadingCoupons } = useQuery({
    queryKey: ['superadmin-coupons'],
    queryFn: async () => {
      const res = await superAdminService.getCoupons()
      return res.success ? res.data : []
    },
    enabled: activeTab === 'coupons',
  })

  const coupons = couponsData || []

  const createCouponMutation = useMutation({
    mutationFn: (data) => superAdminService.createCoupon(data),
    onSuccess: () => {
      toast.success('Coupon created successfully')
      setShowCouponModal(false)
      setEditingCoupon(null)
      queryClient.invalidateQueries({ queryKey: ['superadmin-coupons'] })
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to create coupon'),
  })

  const updateCouponMutation = useMutation({
    mutationFn: ({ id, data }) => superAdminService.updateCoupon(id, data),
    onSuccess: () => {
      toast.success('Coupon updated successfully')
      setShowCouponModal(false)
      setEditingCoupon(null)
      queryClient.invalidateQueries({ queryKey: ['superadmin-coupons'] })
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to update coupon'),
  })

  const deleteCouponMutation = useMutation({
    mutationFn: (id) => superAdminService.deleteCoupon(id),
    onSuccess: () => {
      toast.success('Coupon deleted successfully')
      setShowDeleteConfirm(null)
      queryClient.invalidateQueries({ queryKey: ['superadmin-coupons'] })
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to delete coupon'),
  })

  // ─── Plan Modal Handlers ──────────────────────────────────────────────────
  const openCreatePlan = () => {
    setEditingPlan({
      name: '',
      price: 0,
      yearlyPrice: 0,
      period: '/ month',
      limits: { students: 100, teachers: 10 },
      isPopular: false,
      isActive: true,
      features: ALL_FEATURES.reduce((acc, f) => ({ ...acc, [f.key]: false }), {}),
    })
    setShowPlanModal(true)
  }

  const openEditPlan = (plan) => {
    setEditingPlan({
      ...plan,
      _id: plan._id || plan.id,
      yearlyPrice: plan.yearlyPrice ?? (plan.price ? Math.round(plan.price * 12 * 0.8) : 0),
      features: plan.features || ALL_FEATURES.reduce((acc, f) => ({ ...acc, [f.key]: false }), {}),
    })
    setShowPlanModal(true)
  }

  const handleSavePlan = () => {
    if (!editingPlan.name.trim()) {
      toast.error('Plan name is required')
      return
    }
    const payload = {
      name: editingPlan.name,
      price: editingPlan.price,
      yearlyPrice: editingPlan.yearlyPrice,
      period: editingPlan.period,
      limits: editingPlan.limits,
      isPopular: editingPlan.isPopular,
      isActive: editingPlan.isActive,
      features: editingPlan.features,
    }
    if (editingPlan._id && editingPlan._id !== 'new') {
      updatePlanMutation.mutate({ id: editingPlan._id, data: payload })
    } else {
      createPlanMutation.mutate(payload)
    }
  }

  // ─── Coupon Modal Handlers ────────────────────────────────────────────────
  const openCreateCoupon = () => {
    setEditingCoupon({
      code: generateCouponCode(),
      discountType: 'percentage',
      discountValue: 10,
      validFrom: new Date().toISOString().split('T')[0],
      validUntil: '',
      maxUsage: 100,
      applicablePlans: [],
      isActive: true,
    })
    setShowCouponModal(true)
  }

  const openEditCoupon = (coupon) => {
    setEditingCoupon({
      ...coupon,
      _id: coupon._id || coupon.id,
      validFrom: coupon.validFrom ? new Date(coupon.validFrom).toISOString().split('T')[0] : '',
      validUntil: coupon.validUntil ? new Date(coupon.validUntil).toISOString().split('T')[0] : '',
    })
    setShowCouponModal(true)
  }

  const handleSaveCoupon = () => {
    if (!editingCoupon.code.trim()) {
      toast.error('Coupon code is required')
      return
    }
    if (!editingCoupon.discountValue || editingCoupon.discountValue <= 0) {
      toast.error('Discount value must be greater than 0')
      return
    }
    const payload = {
      code: editingCoupon.code.toUpperCase(),
      discountType: editingCoupon.discountType,
      discountValue: Number(editingCoupon.discountValue),
      validFrom: editingCoupon.validFrom || undefined,
      validUntil: editingCoupon.validUntil || undefined,
      maxUsage: Number(editingCoupon.maxUsage) || 0,
      applicablePlans: editingCoupon.applicablePlans,
      isActive: editingCoupon.isActive,
    }
    if (editingCoupon._id) {
      updateCouponMutation.mutate({ id: editingCoupon._id, data: payload })
    } else {
      createCouponMutation.mutate(payload)
    }
  }

  const getCouponStatus = (coupon) => {
    if (!coupon.isActive) return 'inactive'
    if (coupon.validUntil && new Date(coupon.validUntil) < new Date()) return 'expired'
    return 'active'
  }

  const couponStatusBadge = {
    active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    expired: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    inactive: 'bg-gray-100 text-gray-500 dark:bg-[#2C2C2E] dark:text-[#636366]',
  }

  // ─── Loading State ────────────────────────────────────────────────────────
  if (isLoadingPlans && activeTab === 'plans') {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="h-8 w-48 bg-gray-200 dark:bg-[#2C2C2E] rounded-xl animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-72 bg-gray-200 dark:bg-[#2C2C2E] rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Plans & Coupons</h1>
          <p className="text-sm text-gray-500 dark:text-[#8E8E93] mt-1">Manage subscription plans and discount coupons</p>
        </div>
        <button
          onClick={activeTab === 'plans' ? openCreatePlan : openCreateCoupon}
          className="inline-flex items-center justify-center gap-2 rounded-xl h-10 px-4 text-sm font-semibold bg-primary-600 text-white hover:bg-primary-500 dark:bg-[#3EC4B1] dark:text-black dark:hover:bg-[#35a89a] active:scale-[0.97] transition-all w-full sm:w-auto"
        >
          <Plus className="h-4 w-4" />
          {activeTab === 'plans' ? 'Add New Plan' : 'Create Coupon'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-[#2C2C2E] rounded-xl p-1 w-fit">
        <button
          onClick={() => setActiveTab('plans')}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
            activeTab === 'plans'
              ? 'bg-white dark:bg-[#1C1C1E] text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-[#8E8E93] hover:text-gray-700 dark:hover:text-white'
          }`}
        >
          Plans
        </button>
        <button
          onClick={() => setActiveTab('coupons')}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
            activeTab === 'coupons'
              ? 'bg-white dark:bg-[#1C1C1E] text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-[#8E8E93] hover:text-gray-700 dark:hover:text-white'
          }`}
        >
          Coupons
        </button>
      </div>

      {/* Error */}
      {plansError && activeTab === 'plans' && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 sm:p-4 flex items-center justify-between">
          <p className="text-sm text-red-700 dark:text-red-400">Failed to load plans. Showing default data.</p>
          <button onClick={() => queryClient.invalidateQueries({ queryKey: ['superadmin-plans'] })} className="text-red-600 hover:text-red-800 flex-shrink-0">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Plans Tab */}
      {activeTab === 'plans' && (
        <>
          {/* Plan Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {plans.map((plan) => {
              const planId = plan._id || plan.id
              const IconComp = PLAN_ICONS[plan.id] || PLAN_ICONS[plan.slug] || Star
              const colors = PLAN_COLORS[plan.id] || PLAN_COLORS[plan.slug] || PLAN_COLORS.basic
              const enabledFeatures = ALL_FEATURES.filter((f) => plan.features?.[f.key])
              const disabledFeatures = ALL_FEATURES.filter((f) => !plan.features?.[f.key])

              return (
                <div
                  key={planId}
                  className={`relative bg-white dark:bg-[#1C1C1E] rounded-2xl border transition-all hover:shadow-lg ${
                    plan.isPopular
                      ? 'border-primary-300 dark:border-[#3EC4B1] ring-1 ring-primary-200 dark:ring-[#3EC4B1]/30'
                      : 'border-gray-200 dark:border-[#38383A]'
                  }`}
                >
                  {/* Popular Badge */}
                  {plan.isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-primary-600 dark:bg-[#3EC4B1] text-white dark:text-black shadow-sm">
                        <Sparkles className="h-3 w-3" /> Most Popular
                      </span>
                    </div>
                  )}

                  <div className="p-5">
                    {/* Plan Icon & Name */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl ${colors.bg}`}>
                          <IconComp className={`h-5 w-5 ${colors.text}`} />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900 dark:text-white">{plan.name}</h3>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              plan.isActive !== false
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                : 'bg-gray-100 text-gray-500 dark:bg-[#2C2C2E] dark:text-[#636366]'
                            }`}>
                              {plan.isActive !== false ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => openEditPlan(plan)}
                        className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 dark:hover:text-white dark:hover:bg-[#2C2C2E] transition-colors"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Price */}
                    <div className="mb-4">
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-gray-900 dark:text-white">
                          {plan.price === null || plan.price === undefined ? 'Custom' : plan.price === 0 ? 'Free' : formatCurrency(plan.price)}
                        </span>
                        {plan.price > 0 && (
                          <span className="text-sm text-gray-500 dark:text-[#8E8E93]">{plan.period || '/ month'}</span>
                        )}
                      </div>
                      {plan.price === 0 && plan.period && (
                        <p className="text-xs text-gray-400 dark:text-[#636366] mt-0.5">{plan.period}</p>
                      )}
                    </div>

                    {/* Limits */}
                    <div className="flex gap-3 mb-4">
                      <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-[#8E8E93]">
                        <GraduationCap className="h-3.5 w-3.5" />
                        <span>{plan.limits?.students === 0 ? '∞' : (plan.limits?.students || 0)} students</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-[#8E8E93]">
                        <Users className="h-3.5 w-3.5" />
                        <span>{plan.limits?.teachers === 0 ? '∞' : (plan.limits?.teachers || 0)} teachers</span>
                      </div>
                    </div>

                    {/* Subscribers */}
                    <div className="flex items-center gap-1.5 mb-4 text-xs text-gray-400 dark:text-[#636366]">
                      <Shield className="h-3.5 w-3.5" />
                      <span>{plan.activeSubscribers || 0} active subscribers</span>
                    </div>

                    {/* Features */}
                    <div className="space-y-1.5 border-t border-gray-100 dark:border-[#38383A] pt-4">
                      {enabledFeatures.slice(0, 5).map((f) => (
                        <div key={f.key} className="flex items-center gap-2 text-sm">
                          <Check className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                          <span className="text-gray-700 dark:text-[#8E8E93]">{f.label}</span>
                        </div>
                      ))}
                      {enabledFeatures.length > 5 && (
                        <p className="text-xs text-primary-600 dark:text-[#3EC4B1] font-medium pl-6">
                          +{enabledFeatures.length - 5} more features
                        </p>
                      )}
                      {disabledFeatures.slice(0, 2).map((f) => (
                        <div key={f.key} className="flex items-center gap-2 text-sm">
                          <X className="h-3.5 w-3.5 text-gray-300 dark:text-[#636366] flex-shrink-0" />
                          <span className="text-gray-400 dark:text-[#636366] line-through">{f.label}</span>
                        </div>
                      ))}
                      {disabledFeatures.length > 2 && (
                        <p className="text-xs text-gray-400 dark:text-[#636366] pl-6">
                          +{disabledFeatures.length - 2} not included
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Feature Comparison Table (Collapsible) */}
          <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-gray-200 dark:border-[#38383A] overflow-hidden">
            <button
              onClick={() => setShowComparisonTable(!showComparisonTable)}
              className="w-full flex items-center justify-between p-4 sm:p-5 hover:bg-gray-50 dark:hover:bg-[#2C2C2E] transition-colors"
            >
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-gray-500 dark:text-[#8E8E93]" />
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">Full Feature Comparison</h2>
              </div>
              {showComparisonTable ? (
                <ChevronUp className="h-5 w-5 text-gray-400 dark:text-[#636366]" />
              ) : (
                <ChevronDown className="h-5 w-5 text-gray-400 dark:text-[#636366]" />
              )}
            </button>

            {showComparisonTable && (
              <div className="overflow-x-auto border-t border-gray-100 dark:border-[#38383A]">
                <table className="w-full min-w-[640px]">
                  <thead>
                    <tr className="bg-gray-50/80 dark:bg-[#2C2C2E]">
                      <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Feature</th>
                      {plans.map((plan) => (
                        <th key={plan._id || plan.id} className="px-4 py-3 text-center text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">
                          {plan.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-[#38383A]">
                    {/* Limits rows */}
                    <tr className="hover:bg-gray-50 dark:hover:bg-[#2C2C2E] transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-gray-700 dark:text-[#8E8E93]">Max Students</td>
                      {plans.map((plan) => (
                        <td key={plan._id || plan.id} className="px-4 py-3 text-sm text-center text-gray-900 dark:text-white font-medium">
                          {plan.limits?.students === 0 ? '∞' : (plan.limits?.students || 0).toLocaleString('en-IN')}
                        </td>
                      ))}
                    </tr>
                    <tr className="hover:bg-gray-50 dark:hover:bg-[#2C2C2E] transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-gray-700 dark:text-[#8E8E93]">Max Teachers</td>
                      {plans.map((plan) => (
                        <td key={plan._id || plan.id} className="px-4 py-3 text-sm text-center text-gray-900 dark:text-white font-medium">
                          {plan.limits?.teachers === 0 ? '∞' : (plan.limits?.teachers || 0).toLocaleString('en-IN')}
                        </td>
                      ))}
                    </tr>
                    <tr className="hover:bg-gray-50 dark:hover:bg-[#2C2C2E] transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-gray-700 dark:text-[#8E8E93]">Price (Monthly)</td>
                      {plans.map((plan) => (
                        <td key={plan._id || plan.id} className="px-4 py-3 text-sm text-center text-gray-900 dark:text-white font-medium">
                          {formatCurrency(plan.price)}
                        </td>
                      ))}
                    </tr>
                    {/* Feature rows */}
                    {ALL_FEATURES.map((feature) => (
                      <tr key={feature.key} className="hover:bg-gray-50 dark:hover:bg-[#2C2C2E] transition-colors">
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-[#8E8E93]">{feature.label}</td>
                        {plans.map((plan) => (
                          <td key={plan._id || plan.id} className="px-4 py-3 text-center">
                            {plan.features?.[feature.key] ? (
                              <Check className="h-4 w-4 text-emerald-500 mx-auto" />
                            ) : (
                              <X className="h-4 w-4 text-gray-300 dark:text-[#636366] mx-auto" />
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Coupons Tab */}
      {activeTab === 'coupons' && (
        <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-gray-200 dark:border-[#38383A] overflow-hidden">
          {isLoadingCoupons ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-200 border-t-primary-500 dark:border-[#38383A] dark:border-t-[#3EC4B1]" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr className="bg-gray-50/80 dark:bg-[#2C2C2E] border-b border-gray-100 dark:border-[#38383A]">
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Code</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Discount</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Valid Period</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Usage</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Plans</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-[#38383A]">
                  {coupons.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="px-4 py-16 text-center">
                        <Ticket className="h-12 w-12 mx-auto mb-3 text-gray-300 dark:text-[#636366]" />
                        <p className="text-base font-medium text-gray-400 dark:text-[#636366]">No coupons yet</p>
                        <p className="text-sm text-gray-400 dark:text-[#636366] mt-1">Create your first coupon to offer discounts</p>
                      </td>
                    </tr>
                  ) : (
                    coupons.map((coupon) => {
                      const status = getCouponStatus(coupon)
                      return (
                        <tr key={coupon._id || coupon.id} className="hover:bg-gray-50 dark:hover:bg-[#2C2C2E] transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <code className="text-sm font-mono font-semibold text-gray-900 dark:text-white bg-gray-100 dark:bg-[#2C2C2E] px-2 py-0.5 rounded">
                                {coupon.code}
                              </code>
                              <button
                                onClick={() => { navigator.clipboard.writeText(coupon.code); toast.success('Code copied!') }}
                                className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                            {coupon.discountType === 'percentage' ? `${coupon.discountValue}%` : formatCurrency(coupon.discountValue)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500 dark:text-[#8E8E93]">
                            <div>
                              {coupon.validFrom ? new Date(coupon.validFrom).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '-'}
                              {' → '}
                              {coupon.validUntil ? new Date(coupon.validUntil).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'No expiry'}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 dark:text-[#8E8E93]">
                            <span className="font-medium text-gray-900 dark:text-white">{coupon.usageCount || 0}</span>
                            <span className="text-gray-400 dark:text-[#636366]"> / {coupon.maxUsage || '∞'}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {coupon.applicablePlans?.length > 0 ? (
                                coupon.applicablePlans.map((p) => (
                                  <span key={p} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600 dark:bg-[#2C2C2E] dark:text-[#8E8E93]">
                                    {p}
                                  </span>
                                ))
                              ) : (
                                <span className="text-xs text-gray-400 dark:text-[#636366]">All plans</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${couponStatusBadge[status]}`}>
                              {status.charAt(0).toUpperCase() + status.slice(1)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => openEditCoupon(coupon)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 dark:hover:text-white dark:hover:bg-[#2C2C2E] transition-colors"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => setShowDeleteConfirm({ type: 'coupon', id: coupon._id || coupon.id, name: coupon.code })}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── Edit/Create Plan Modal ─────────────────────────────────────────── */}
      {showPlanModal && editingPlan && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 dark:bg-black/75 backdrop-blur-sm" onClick={() => { setShowPlanModal(false); setEditingPlan(null) }}>
          <div
            className="bg-white dark:bg-[#1C1C1E] rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-2xl mx-0 sm:mx-4 p-5 sm:p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-5">
              {editingPlan._id && editingPlan._id !== 'new' ? 'Edit Plan' : 'Create New Plan'}
            </h2>

            <div className="space-y-5">
              {/* Plan Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1.5">Plan Name</label>
                <input
                  type="text"
                  value={editingPlan.name}
                  onChange={(e) => setEditingPlan({ ...editingPlan, name: e.target.value })}
                  className="w-full h-11 sm:h-10 rounded-xl border border-gray-200 dark:border-[#38383A] bg-white dark:bg-[#1C1C1E] px-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-[#636366] focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-[#3EC4B1] transition-colors"
                  placeholder="e.g. Pro Plus"
                />
              </div>

              {/* Pricing */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1.5">Monthly Price (₹)</label>
                  <input
                    type="number"
                    value={editingPlan.price ?? ''}
                    onChange={(e) => {
                      const price = e.target.value === '' ? null : Number(e.target.value)
                      setEditingPlan({
                        ...editingPlan,
                        price,
                        yearlyPrice: price !== null ? Math.round(price * 12 * 0.8) : null,
                      })
                    }}
                    className="w-full h-11 sm:h-10 rounded-xl border border-gray-200 dark:border-[#38383A] bg-white dark:bg-[#1C1C1E] px-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-[#636366] focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-[#3EC4B1] transition-colors"
                    placeholder="0 for free, empty for custom"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1.5">Yearly Price (₹) <span className="text-xs text-gray-400 dark:text-[#636366]">20% off default</span></label>
                  <input
                    type="number"
                    value={editingPlan.yearlyPrice ?? ''}
                    onChange={(e) => setEditingPlan({ ...editingPlan, yearlyPrice: e.target.value === '' ? null : Number(e.target.value) })}
                    className="w-full h-11 sm:h-10 rounded-xl border border-gray-200 dark:border-[#38383A] bg-white dark:bg-[#1C1C1E] px-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-[#636366] focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-[#3EC4B1] transition-colors"
                    placeholder="Auto-calculated"
                    min="0"
                  />
                </div>
              </div>

              {/* Limits */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1.5">Max Students <span className="text-xs text-gray-400 dark:text-[#636366]">(0 = unlimited)</span></label>
                  <input
                    type="number"
                    value={editingPlan.limits?.students ?? 0}
                    onChange={(e) => setEditingPlan({ ...editingPlan, limits: { ...editingPlan.limits, students: Number(e.target.value) } })}
                    className="w-full h-11 sm:h-10 rounded-xl border border-gray-200 dark:border-[#38383A] bg-white dark:bg-[#1C1C1E] px-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-[#636366] focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-[#3EC4B1] transition-colors"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1.5">Max Teachers <span className="text-xs text-gray-400 dark:text-[#636366]">(0 = unlimited)</span></label>
                  <input
                    type="number"
                    value={editingPlan.limits?.teachers ?? 0}
                    onChange={(e) => setEditingPlan({ ...editingPlan, limits: { ...editingPlan.limits, teachers: Number(e.target.value) } })}
                    className="w-full h-11 sm:h-10 rounded-xl border border-gray-200 dark:border-[#38383A] bg-white dark:bg-[#1C1C1E] px-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-[#636366] focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-[#3EC4B1] transition-colors"
                    min="0"
                  />
                </div>
              </div>

              {/* Toggles Row */}
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <button
                    type="button"
                    onClick={() => setEditingPlan({ ...editingPlan, isPopular: !editingPlan.isPopular })}
                    className="relative"
                  >
                    {editingPlan.isPopular ? (
                      <ToggleRight className="h-6 w-6 text-primary-600 dark:text-[#3EC4B1]" />
                    ) : (
                      <ToggleLeft className="h-6 w-6 text-gray-400 dark:text-[#636366]" />
                    )}
                  </button>
                  <span className="text-sm text-gray-700 dark:text-[#8E8E93]">Mark as Popular</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <button
                    type="button"
                    onClick={() => setEditingPlan({ ...editingPlan, isActive: !editingPlan.isActive })}
                    className="relative"
                  >
                    {editingPlan.isActive ? (
                      <ToggleRight className="h-6 w-6 text-emerald-500" />
                    ) : (
                      <ToggleLeft className="h-6 w-6 text-gray-400 dark:text-[#636366]" />
                    )}
                  </button>
                  <span className="text-sm text-gray-700 dark:text-[#8E8E93]">Active</span>
                </label>
              </div>

              {/* Feature Toggles */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-3">Features</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {ALL_FEATURES.map((feature) => {
                    const FeatureIcon = feature.icon
                    const isEnabled = editingPlan.features?.[feature.key] ?? false
                    return (
                      <button
                        key={feature.key}
                        type="button"
                        onClick={() =>
                          setEditingPlan({
                            ...editingPlan,
                            features: { ...editingPlan.features, [feature.key]: !isEnabled },
                          })
                        }
                        className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all active:scale-[0.97] ${
                          isEnabled
                            ? 'border-primary-300 dark:border-[#3EC4B1]/50 bg-primary-50 dark:bg-[#3EC4B1]/10'
                            : 'border-gray-200 dark:border-[#38383A] bg-white dark:bg-[#1C1C1E] hover:bg-gray-50 dark:hover:bg-[#2C2C2E]'
                        }`}
                      >
                        <FeatureIcon className={`h-4 w-4 flex-shrink-0 ${isEnabled ? 'text-primary-600 dark:text-[#3EC4B1]' : 'text-gray-400 dark:text-[#636366]'}`} />
                        <span className={`text-sm ${isEnabled ? 'text-gray-900 dark:text-white font-medium' : 'text-gray-500 dark:text-[#8E8E93]'}`}>
                          {feature.label}
                        </span>
                        <div className="ml-auto">
                          {isEnabled ? (
                            <Check className="h-4 w-4 text-primary-600 dark:text-[#3EC4B1]" />
                          ) : (
                            <X className="h-4 w-4 text-gray-300 dark:text-[#636366]" />
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-2 border-t border-gray-100 dark:border-[#38383A]">
                <button
                  type="button"
                  onClick={() => { setShowPlanModal(false); setEditingPlan(null) }}
                  className="inline-flex items-center justify-center rounded-xl h-10 px-4 text-sm font-semibold border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 dark:border-[#38383A] dark:text-white dark:bg-transparent dark:hover:bg-[#2C2C2E] active:scale-[0.97] transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSavePlan}
                  disabled={createPlanMutation.isPending || updatePlanMutation.isPending}
                  className="inline-flex items-center justify-center gap-2 rounded-xl h-10 px-4 text-sm font-semibold bg-primary-600 text-white hover:bg-primary-500 dark:bg-[#3EC4B1] dark:text-black dark:hover:bg-[#35a89a] active:scale-[0.97] transition-all disabled:opacity-50"
                >
                  {createPlanMutation.isPending || updatePlanMutation.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Edit/Create Coupon Modal ───────────────────────────────────────── */}
      {showCouponModal && editingCoupon && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 dark:bg-black/75 backdrop-blur-sm" onClick={() => { setShowCouponModal(false); setEditingCoupon(null) }}>
          <div
            className="bg-white dark:bg-[#1C1C1E] rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-lg mx-0 sm:mx-4 p-5 sm:p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-5">
              {editingCoupon._id ? 'Edit Coupon' : 'Create Coupon'}
            </h2>

            <div className="space-y-4">
              {/* Code */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1.5">Coupon Code</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editingCoupon.code}
                    onChange={(e) => setEditingCoupon({ ...editingCoupon, code: e.target.value.toUpperCase() })}
                    className="flex-1 h-11 sm:h-10 rounded-xl border border-gray-200 dark:border-[#38383A] bg-white dark:bg-[#1C1C1E] px-3 text-sm font-mono text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-[#636366] focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-[#3EC4B1] transition-colors"
                    placeholder="SAVE20"
                  />
                  <button
                    type="button"
                    onClick={() => setEditingCoupon({ ...editingCoupon, code: generateCouponCode() })}
                    className="inline-flex items-center justify-center rounded-xl h-11 sm:h-10 px-3 text-sm font-semibold border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 dark:border-[#38383A] dark:text-white dark:bg-transparent dark:hover:bg-[#2C2C2E] active:scale-[0.97] transition-all"
                    title="Auto-generate code"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Discount Type & Value */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1.5">Discount Type</label>
                  <select
                    value={editingCoupon.discountType}
                    onChange={(e) => setEditingCoupon({ ...editingCoupon, discountType: e.target.value })}
                    className="w-full h-11 sm:h-10 rounded-xl border border-gray-200 dark:border-[#38383A] bg-white dark:bg-[#1C1C1E] px-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-[#3EC4B1] transition-colors"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="flat">Flat (₹)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1.5">
                    Discount Value {editingCoupon.discountType === 'percentage' ? '(%)' : '(₹)'}
                  </label>
                  <input
                    type="number"
                    value={editingCoupon.discountValue}
                    onChange={(e) => setEditingCoupon({ ...editingCoupon, discountValue: Number(e.target.value) })}
                    className="w-full h-11 sm:h-10 rounded-xl border border-gray-200 dark:border-[#38383A] bg-white dark:bg-[#1C1C1E] px-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-[#636366] focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-[#3EC4B1] transition-colors"
                    min="1"
                    max={editingCoupon.discountType === 'percentage' ? 100 : undefined}
                  />
                </div>
              </div>

              {/* Valid Period */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1.5">Valid From</label>
                  <input
                    type="date"
                    value={editingCoupon.validFrom}
                    onChange={(e) => setEditingCoupon({ ...editingCoupon, validFrom: e.target.value })}
                    className="w-full h-11 sm:h-10 rounded-xl border border-gray-200 dark:border-[#38383A] bg-white dark:bg-[#1C1C1E] px-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-[#3EC4B1] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1.5">Valid Until</label>
                  <input
                    type="date"
                    value={editingCoupon.validUntil}
                    onChange={(e) => setEditingCoupon({ ...editingCoupon, validUntil: e.target.value })}
                    className="w-full h-11 sm:h-10 rounded-xl border border-gray-200 dark:border-[#38383A] bg-white dark:bg-[#1C1C1E] px-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-[#3EC4B1] transition-colors"
                  />
                </div>
              </div>

              {/* Max Usage */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1.5">Max Usage Count <span className="text-xs text-gray-400 dark:text-[#636366]">(0 = unlimited)</span></label>
                <input
                  type="number"
                  value={editingCoupon.maxUsage}
                  onChange={(e) => setEditingCoupon({ ...editingCoupon, maxUsage: Number(e.target.value) })}
                  className="w-full h-11 sm:h-10 rounded-xl border border-gray-200 dark:border-[#38383A] bg-white dark:bg-[#1C1C1E] px-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-[#636366] focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-[#3EC4B1] transition-colors"
                  min="0"
                />
              </div>

              {/* Applicable Plans */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-2">Applicable Plans</label>
                <div className="flex flex-wrap gap-2">
                  {plans.map((plan) => {
                    const planName = plan.name || plan.id
                    const isSelected = editingCoupon.applicablePlans?.includes(planName)
                    return (
                      <button
                        key={plan._id || plan.id}
                        type="button"
                        onClick={() => {
                          const updated = isSelected
                            ? editingCoupon.applicablePlans.filter((p) => p !== planName)
                            : [...(editingCoupon.applicablePlans || []), planName]
                          setEditingCoupon({ ...editingCoupon, applicablePlans: updated })
                        }}
                        className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all active:scale-[0.97] ${
                          isSelected
                            ? 'border-primary-300 dark:border-[#3EC4B1]/50 bg-primary-50 dark:bg-[#3EC4B1]/10 text-primary-700 dark:text-[#3EC4B1]'
                            : 'border-gray-200 dark:border-[#38383A] bg-white dark:bg-[#1C1C1E] text-gray-500 dark:text-[#8E8E93] hover:bg-gray-50 dark:hover:bg-[#2C2C2E]'
                        }`}
                      >
                        {isSelected && <Check className="h-3 w-3 mr-1" />}
                        {planName}
                      </button>
                    )
                  })}
                </div>
                <p className="text-xs text-gray-400 dark:text-[#636366] mt-1.5">Leave empty to apply to all plans</p>
              </div>

              {/* Active Toggle */}
              <label className="flex items-center gap-2 cursor-pointer">
                <button
                  type="button"
                  onClick={() => setEditingCoupon({ ...editingCoupon, isActive: !editingCoupon.isActive })}
                >
                  {editingCoupon.isActive ? (
                    <ToggleRight className="h-6 w-6 text-emerald-500" />
                  ) : (
                    <ToggleLeft className="h-6 w-6 text-gray-400 dark:text-[#636366]" />
                  )}
                </button>
                <span className="text-sm text-gray-700 dark:text-[#8E8E93]">Active</span>
              </label>

              {/* Actions */}
              <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-2 border-t border-gray-100 dark:border-[#38383A]">
                <button
                  type="button"
                  onClick={() => { setShowCouponModal(false); setEditingCoupon(null) }}
                  className="inline-flex items-center justify-center rounded-xl h-10 px-4 text-sm font-semibold border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 dark:border-[#38383A] dark:text-white dark:bg-transparent dark:hover:bg-[#2C2C2E] active:scale-[0.97] transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveCoupon}
                  disabled={createCouponMutation.isPending || updateCouponMutation.isPending}
                  className="inline-flex items-center justify-center gap-2 rounded-xl h-10 px-4 text-sm font-semibold bg-primary-600 text-white hover:bg-primary-500 dark:bg-[#3EC4B1] dark:text-black dark:hover:bg-[#35a89a] active:scale-[0.97] transition-all disabled:opacity-50"
                >
                  {createCouponMutation.isPending || updateCouponMutation.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" />
                      Saving...
                    </>
                  ) : (
                    editingCoupon._id ? 'Save Changes' : 'Create Coupon'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Delete Confirmation Modal ──────────────────────────────────────── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/75 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(null)}>
          <div
            className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-xl w-full max-w-sm mx-4 p-5 sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-900/20">
                <Trash2 className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Delete {showDeleteConfirm.type === 'coupon' ? 'Coupon' : 'Plan'}</h3>
                <p className="text-sm text-gray-500 dark:text-[#8E8E93]">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-[#8E8E93] mb-5">
              Are you sure you want to delete <span className="font-semibold text-gray-900 dark:text-white">{showDeleteConfirm.name}</span>?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="inline-flex items-center justify-center rounded-xl h-10 px-4 text-sm font-semibold border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 dark:border-[#38383A] dark:text-white dark:bg-transparent dark:hover:bg-[#2C2C2E] active:scale-[0.97] transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (showDeleteConfirm.type === 'coupon') {
                    deleteCouponMutation.mutate(showDeleteConfirm.id)
                  } else {
                    deletePlanMutation.mutate(showDeleteConfirm.id)
                  }
                }}
                disabled={deleteCouponMutation.isPending || deletePlanMutation.isPending}
                className="inline-flex items-center justify-center gap-2 rounded-xl h-10 px-4 text-sm font-semibold bg-red-600 text-white hover:bg-red-500 active:scale-[0.97] transition-all disabled:opacity-50"
              >
                {deleteCouponMutation.isPending || deletePlanMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" />
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Plans
