import { useState, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { superAdminService } from '../../services/superAdminService'
import toast from 'react-hot-toast'
import {
  Blocks, LayoutGrid, Table2, Building2, Search, Save, ChevronDown,
  BookOpen, ClipboardCheck, CalendarClock, GraduationCap, Banknote,
  Users, BarChart3, CreditCard, MessageSquare, Code2, Award, Bus, Wallet,
  Shield, Check
} from 'lucide-react'

// ─── Inline Toggle ──────────────────────────────────────────────────────────
const Toggle = ({ enabled, onChange, disabled = false, size = 'default' }) => {
  const isSmall = size === 'small'
  const w = isSmall ? 'w-8 h-[18px]' : 'w-9 h-5'
  const dot = isSmall ? 'h-3.5 w-3.5' : 'h-4 w-4'
  const translate = isSmall ? 'translate-x-[14px]' : 'translate-x-4'
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      disabled={disabled}
      onClick={() => !disabled && onChange(!enabled)}
      className={`relative inline-flex flex-shrink-0 ${w} rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:focus-visible:ring-[#3EC4B1] ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      } ${
        enabled
          ? 'bg-primary-500 dark:bg-[#3EC4B1]'
          : 'bg-gray-300 dark:bg-[#38383A]'
      }`}
    >
      <span
        className={`pointer-events-none inline-block ${dot} rounded-full bg-white shadow transform transition-transform duration-200 ease-in-out ${
          enabled ? translate : 'translate-x-0.5'
        } translate-y-[3px]`}
      />
    </button>
  )
}

// ─── Static fallback modules ────────────────────────────────────────────────
const FALLBACK_MODULES = [
  { _id: '1', name: 'Core Academics', slug: 'core-academics', description: 'Core academic management including classes, sections, subjects, and curriculum mapping.', status: 'Stable', icon: 'BookOpen', version: '2.1.0', tenantsUsing: 0, isGlobal: true, planAccess: { free: true, basic: true, pro: true, enterprise: true } },
  { _id: '2', name: 'Attendance Tracking', slug: 'attendance-tracking', description: 'Student and staff attendance with biometric integration support.', status: 'Stable', icon: 'ClipboardCheck', version: '1.8.0', tenantsUsing: 0, isGlobal: true, planAccess: { free: true, basic: true, pro: true, enterprise: true } },
  { _id: '3', name: 'Timetable Management', slug: 'timetable-management', description: 'Automated timetable generation with conflict detection.', status: 'Stable', icon: 'CalendarClock', version: '1.5.0', tenantsUsing: 0, isGlobal: true, planAccess: { free: false, basic: true, pro: true, enterprise: true } },
  { _id: '4', name: 'Grades & Exams', slug: 'grades-exams', description: 'Examination scheduling, grading, and report card generation.', status: 'Stable', icon: 'GraduationCap', version: '2.0.0', tenantsUsing: 0, isGlobal: true, planAccess: { free: false, basic: true, pro: true, enterprise: true } },
  { _id: '5', name: 'Fees & Finance', slug: 'fees-finance', description: 'Fee collection, invoicing, and financial reporting.', status: 'Stable', icon: 'Banknote', version: '1.9.0', tenantsUsing: 0, isGlobal: true, planAccess: { free: false, basic: true, pro: true, enterprise: true } },
  { _id: '6', name: 'Parent Portal', slug: 'parent-portal', description: 'Dedicated portal for parents to view attendance, grades, and communicate with teachers.', status: 'Stable', icon: 'Users', version: '1.6.0', tenantsUsing: 0, isGlobal: true, planAccess: { free: false, basic: false, pro: true, enterprise: true } },
  { _id: '7', name: 'Advanced Analytics', slug: 'advanced-analytics', description: 'In-depth dashboards, predictive analytics, and custom reports.', status: 'Beta', icon: 'BarChart3', version: '0.9.0', tenantsUsing: 0, isGlobal: true, planAccess: { free: false, basic: false, pro: true, enterprise: true } },
  { _id: '8', name: 'Payment Gateway', slug: 'payment-gateway', description: 'Online fee payment with Razorpay/Stripe integration.', status: 'Stable', icon: 'CreditCard', version: '1.4.0', tenantsUsing: 0, isGlobal: true, planAccess: { free: false, basic: false, pro: true, enterprise: true } },
  { _id: '9', name: 'SMS & WhatsApp Alerts', slug: 'sms-whatsapp-alerts', description: 'Automated notifications via SMS and WhatsApp for events and reminders.', status: 'Stable', icon: 'MessageSquare', version: '1.3.0', tenantsUsing: 0, isGlobal: true, planAccess: { free: false, basic: false, pro: true, enterprise: true } },
  { _id: '10', name: 'API Access', slug: 'api-access', description: 'RESTful API access for third-party integrations.', status: 'Beta', icon: 'Code2', version: '0.8.0', tenantsUsing: 0, isGlobal: true, planAccess: { free: false, basic: false, pro: false, enterprise: true } },
  { _id: '11', name: 'Certificates', slug: 'certificates', description: 'Generate and manage student certificates with custom templates.', status: 'Stable', icon: 'Award', version: '1.2.0', tenantsUsing: 0, isGlobal: true, planAccess: { free: false, basic: false, pro: true, enterprise: true } },
  { _id: '12', name: 'Transport Management', slug: 'transport-management', description: 'Route planning, vehicle tracking, and transport fee management.', status: 'Coming Soon', icon: 'Bus', version: '0.1.0', tenantsUsing: 0, isGlobal: false, planAccess: { free: false, basic: false, pro: false, enterprise: true } },
  { _id: '13', name: 'Payroll Management', slug: 'payroll-management', description: 'Staff salary processing, payslips, and tax management.', status: 'Coming Soon', icon: 'Wallet', version: '0.1.0', tenantsUsing: 0, isGlobal: false, planAccess: { free: false, basic: false, pro: false, enterprise: true } },
]

const ICON_MAP = {
  BookOpen, ClipboardCheck, CalendarClock, GraduationCap, Banknote,
  Users, BarChart3, CreditCard, MessageSquare, Code2, Award, Bus, Wallet,
  Blocks, Shield,
}

const getModuleIcon = (iconName) => ICON_MAP[iconName] || Blocks

const ALWAYS_ON_SLUGS = ['core-academics', 'attendance-tracking']

const STATUS_STYLES = {
  Stable: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  Beta: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  'Coming Soon': 'bg-gray-100 text-gray-500 dark:bg-[#2C2C2E] dark:text-[#8E8E93]',
}

const PLAN_COLORS = {
  free: { dot: 'bg-gray-400', header: 'text-gray-600 dark:text-[#8E8E93]', bg: 'bg-gray-50 dark:bg-[#2C2C2E]' },
  basic: { dot: 'bg-blue-500', header: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' },
  pro: { dot: 'bg-violet-500', header: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-900/20' },
  enterprise: { dot: 'bg-teal-500', header: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-50 dark:bg-teal-900/20' },
}

const PLAN_LABELS = { free: 'Free', basic: 'Basic', pro: 'Pro', enterprise: 'Enterprise' }
const PLANS = ['free', 'basic', 'pro', 'enterprise']
const TABS = [
  { id: 'grid', label: 'Module Grid', icon: LayoutGrid },
  { id: 'matrix', label: 'Plan Matrix', icon: Table2 },
  { id: 'tenant', label: 'Tenant Override', icon: Building2 },
]

// ─── Main Component ─────────────────────────────────────────────────────────
const Modules = () => {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('grid')

  // Fetch modules
  const { data: modulesData, isLoading, error } = useQuery({
    queryKey: ['superadmin-modules'],
    queryFn: async () => {
      const res = await superAdminService.getModules()
      return res.data
    },
  })

  const modules = modulesData?.length ? modulesData : FALLBACK_MODULES

  // ─── Global toggle mutation ───────────────────────────────────────────
  const globalToggleMutation = useMutation({
    mutationFn: ({ id, data }) => superAdminService.updateModule(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin-modules'] })
      toast.success('Module updated successfully')
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to update module')
    },
  })

  // ─── Plan access mutation ─────────────────────────────────────────────
  const planAccessMutation = useMutation({
    mutationFn: (data) => superAdminService.updateModulePlanAccess(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin-modules'] })
      toast.success('Plan access updated')
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to update plan access')
    },
  })

  const handleGlobalToggle = useCallback((mod) => {
    if (ALWAYS_ON_SLUGS.includes(mod.slug)) return
    globalToggleMutation.mutate({ id: mod._id, data: { isGlobal: !mod.isGlobal } })
  }, [globalToggleMutation])

  const handlePlanToggle = useCallback((moduleId, plan, currentValue) => {
    planAccessMutation.mutate({ moduleId, plan, enabled: !currentValue })
  }, [planAccessMutation])

  // ─── Loading state ────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="h-8 w-56 bg-gray-200 dark:bg-[#2C2C2E] rounded-xl animate-pulse" />
        <div className="h-10 w-80 bg-gray-200 dark:bg-[#2C2C2E] rounded-xl animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-52 bg-gray-200 dark:bg-[#2C2C2E] rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  // ─── Error state ──────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Modules</h1>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4 sm:p-6 text-center">
          <p className="text-sm text-red-700 dark:text-red-400">{error.response?.data?.message || error.message || 'Failed to load modules'}</p>
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['superadmin-modules'] })}
            className="mt-3 inline-flex items-center gap-2 rounded-xl h-10 px-4 text-sm font-semibold bg-primary-600 text-white hover:bg-primary-500 dark:bg-[#3EC4B1] dark:text-black dark:hover:bg-[#35a89a] active:scale-[0.97] transition-all"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Modules</h1>
        <p className="text-sm text-gray-500 dark:text-[#8E8E93] mt-1">Manage platform modules, plan access, and tenant overrides</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-gray-100 dark:bg-[#2C2C2E] w-full sm:w-auto sm:inline-flex">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center justify-center gap-2 rounded-lg px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold transition-all flex-1 sm:flex-none ${
                isActive
                  ? 'bg-white dark:bg-[#1C1C1E] text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-[#8E8E93] hover:text-gray-700 dark:hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'grid' && (
        <ModuleGrid
          modules={modules}
          onGlobalToggle={handleGlobalToggle}
          isToggling={globalToggleMutation.isPending}
        />
      )}
      {activeTab === 'matrix' && (
        <PlanMatrix
          modules={modules}
          onPlanToggle={handlePlanToggle}
          isToggling={planAccessMutation.isPending}
        />
      )}
      {activeTab === 'tenant' && (
        <TenantOverride modules={modules} />
      )}
    </div>
  )
}

// ─── Section 1: Module Grid ─────────────────────────────────────────────────
const ModuleGrid = ({ modules, onGlobalToggle, isToggling }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {modules.map((mod) => {
        const Icon = getModuleIcon(mod.icon)
        const isAlwaysOn = ALWAYS_ON_SLUGS.includes(mod.slug)
        return (
          <div
            key={mod._id}
            className="bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#38383A] rounded-2xl p-4 sm:p-5 flex flex-col gap-3 transition-all hover:shadow-md"
          >
            {/* Top row: icon, name, status */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-xl bg-primary-50 dark:bg-[#3EC4B1]/10 flex-shrink-0">
                  <Icon className="h-5 w-5 text-primary-600 dark:text-[#3EC4B1]" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{mod.name}</h3>
                  <span className={`inline-block mt-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${STATUS_STYLES[mod.status] || STATUS_STYLES['Coming Soon']}`}>
                    {mod.status}
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-mono text-gray-400 dark:text-[#636366] flex-shrink-0">v{mod.version}</span>
            </div>

            {/* Description */}
            <p className="text-xs text-gray-500 dark:text-[#8E8E93] leading-relaxed line-clamp-2">{mod.description}</p>

            {/* Plan dots */}
            <div className="flex items-center gap-1.5">
              {PLANS.map((plan) => (
                <div key={plan} className="flex items-center gap-1" title={`${PLAN_LABELS[plan]}: ${mod.planAccess?.[plan] ? 'Enabled' : 'Disabled'}`}>
                  <span className={`w-2 h-2 rounded-full ${mod.planAccess?.[plan] ? PLAN_COLORS[plan].dot : 'bg-gray-200 dark:bg-[#38383A]'}`} />
                  <span className="text-[10px] text-gray-400 dark:text-[#636366]">{PLAN_LABELS[plan][0]}</span>
                </div>
              ))}
            </div>

            {/* Bottom row: tenant count + global toggle */}
            <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-[#38383A]">
              <span className="text-xs text-gray-400 dark:text-[#636366]">
                {mod.tenantsUsing ?? 0} tenants using
              </span>
              <div className="flex items-center gap-2">
                {isAlwaysOn && (
                  <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">Always On</span>
                )}
                <Toggle
                  enabled={mod.isGlobal}
                  onChange={() => onGlobalToggle(mod)}
                  disabled={isAlwaysOn || isToggling}
                />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Section 2: Plan Matrix ─────────────────────────────────────────────────
const PlanMatrix = ({ modules, onPlanToggle, isToggling }) => {
  return (
    <div className="bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#38383A] rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead>
            <tr className="bg-gray-50/80 dark:bg-[#2C2C2E]">
              <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-[#8E8E93] px-4 sm:px-5 py-3">Module</th>
              {PLANS.map((plan) => (
                <th key={plan} className="text-center px-3 sm:px-5 py-3">
                  <div className="flex flex-col items-center gap-1">
                    <span className={`w-2.5 h-2.5 rounded-full ${PLAN_COLORS[plan].dot}`} />
                    <span className={`text-[11px] font-semibold uppercase tracking-wider ${PLAN_COLORS[plan].header}`}>
                      {PLAN_LABELS[plan]}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-[#38383A]">
            {modules.map((mod) => {
              const Icon = getModuleIcon(mod.icon)
              return (
                <tr key={mod._id} className="hover:bg-gray-50 dark:hover:bg-[#2C2C2E] transition-colors">
                  <td className="px-4 sm:px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Icon className="h-4 w-4 text-gray-400 dark:text-[#636366] flex-shrink-0" />
                      <div className="min-w-0">
                        <span className="text-sm font-medium text-gray-900 dark:text-white truncate block">{mod.name}</span>
                        <span className={`text-[10px] font-medium ${STATUS_STYLES[mod.status] || STATUS_STYLES['Coming Soon']} px-1.5 py-0.5 rounded-full`}>{mod.status}</span>
                      </div>
                    </div>
                  </td>
                  {PLANS.map((plan) => (
                    <td key={plan} className="text-center px-3 sm:px-5 py-3">
                      <div className="flex justify-center">
                        <Toggle
                          enabled={!!mod.planAccess?.[plan]}
                          onChange={() => onPlanToggle(mod._id, plan, mod.planAccess?.[plan])}
                          disabled={isToggling}
                          size="small"
                        />
                      </div>
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Section 3: Tenant Override ──────────────────────────────────────────────
const TenantOverride = ({ modules }) => {
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTenant, setSelectedTenant] = useState(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [overrides, setOverrides] = useState({})
  const [isSaving, setIsSaving] = useState(false)

  // Fetch tenants
  const { data: tenantsData, isLoading: tenantsLoading } = useQuery({
    queryKey: ['superadmin-tenants-list'],
    queryFn: async () => {
      const res = await superAdminService.getTenants({ limit: 100 })
      return res.data
    },
  })

  const tenants = tenantsData?.tenants || tenantsData || []

  const filteredTenants = useMemo(() => {
    if (!searchQuery.trim()) return tenants
    const q = searchQuery.toLowerCase()
    return tenants.filter((t) =>
      (t.schoolName || t.name || '').toLowerCase().includes(q) ||
      (t.subdomain || '').toLowerCase().includes(q)
    )
  }, [tenants, searchQuery])

  const handleSelectTenant = useCallback((tenant) => {
    setSelectedTenant(tenant)
    setDropdownOpen(false)
    setSearchQuery('')
    // Initialize overrides from modules' global state
    const initial = {}
    modules.forEach((mod) => {
      initial[mod.slug] = mod.isGlobal
    })
    setOverrides(initial)
  }, [modules])

  const handleToggleOverride = useCallback((slug) => {
    setOverrides((prev) => ({ ...prev, [slug]: !prev[slug] }))
  }, [])

  const handleSave = async () => {
    if (!selectedTenant) return
    setIsSaving(true)
    try {
      const moduleOverrides = Object.entries(overrides).map(([slug, enabled]) => ({
        slug,
        enabled,
      }))
      await superAdminService.overrideTenantModules(selectedTenant._id, { modules: moduleOverrides })
      queryClient.invalidateQueries({ queryKey: ['superadmin-modules'] })
      toast.success(`Module overrides saved for ${selectedTenant.schoolName || selectedTenant.name}`)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save overrides')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Tenant selector */}
      <div className="bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#38383A] rounded-2xl p-4 sm:p-5">
        <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">Select Tenant</label>
        <p className="text-xs text-gray-500 dark:text-[#8E8E93] mb-3">Override module access for a specific tenant. Enable Pro features for a Basic school, or disable modules individually.</p>
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="w-full flex items-center justify-between h-11 sm:h-10 rounded-xl border border-gray-200 dark:border-[#38383A] bg-white dark:bg-[#1C1C1E] px-4 text-sm text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-[#2C2C2E] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:focus-visible:ring-[#3EC4B1]"
          >
            <span className={selectedTenant ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-[#636366]'}>
              {selectedTenant ? (selectedTenant.schoolName || selectedTenant.name) : 'Choose a tenant...'}
            </span>
            <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {dropdownOpen && (
            <div className="absolute z-20 mt-1 w-full bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#38383A] rounded-xl shadow-lg overflow-hidden">
              <div className="p-2 border-b border-gray-100 dark:border-[#38383A]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search tenants..."
                    className="w-full h-9 pl-9 pr-3 rounded-lg border border-gray-200 dark:border-[#38383A] bg-gray-50 dark:bg-[#2C2C2E] text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-[#636366] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:focus-visible:ring-[#3EC4B1]"
                    autoFocus
                  />
                </div>
              </div>
              <div className="max-h-48 overflow-y-auto">
                {tenantsLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-200 border-t-primary-500" />
                  </div>
                ) : filteredTenants.length === 0 ? (
                  <p className="text-sm text-gray-400 dark:text-[#636366] text-center py-4">No tenants found</p>
                ) : (
                  filteredTenants.map((tenant) => (
                    <button
                      key={tenant._id}
                      onClick={() => handleSelectTenant(tenant)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-[#2C2C2E] transition-colors"
                    >
                      <div className="w-8 h-8 rounded-lg bg-primary-50 dark:bg-[#3EC4B1]/10 flex items-center justify-center flex-shrink-0">
                        <Building2 className="h-4 w-4 text-primary-600 dark:text-[#3EC4B1]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{tenant.schoolName || tenant.name}</p>
                        <p className="text-xs text-gray-400 dark:text-[#636366] truncate">{tenant.subdomain || tenant.email}</p>
                      </div>
                      {selectedTenant?._id === tenant._id && (
                        <Check className="h-4 w-4 text-primary-500 dark:text-[#3EC4B1] ml-auto flex-shrink-0" />
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Module overrides list */}
      {selectedTenant && (
        <div className="bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#38383A] rounded-2xl overflow-hidden">
          <div className="px-4 sm:px-5 py-3 bg-gray-50/80 dark:bg-[#2C2C2E] flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                Overrides for {selectedTenant.schoolName || selectedTenant.name}
              </h3>
              <p className="text-xs text-gray-500 dark:text-[#8E8E93] mt-0.5">Toggle modules on or off for this specific tenant</p>
            </div>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-xl h-10 px-4 text-sm font-semibold bg-primary-600 text-white hover:bg-primary-500 dark:bg-[#3EC4B1] dark:text-black dark:hover:bg-[#35a89a] active:scale-[0.97] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Overrides
            </button>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-[#38383A]">
            {modules.map((mod) => {
              const Icon = getModuleIcon(mod.icon)
              const isEnabled = overrides[mod.slug] ?? mod.isGlobal
              return (
                <div
                  key={mod._id}
                  className="flex items-center justify-between px-4 sm:px-5 py-3 hover:bg-gray-50 dark:hover:bg-[#2C2C2E] transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon className="h-4 w-4 text-gray-400 dark:text-[#636366] flex-shrink-0" />
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-gray-900 dark:text-white truncate block">{mod.name}</span>
                      <span className="text-xs text-gray-400 dark:text-[#636366]">{mod.description}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                    <span className={`text-xs font-medium ${isEnabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-[#636366]'}`}>
                      {isEnabled ? 'On' : 'Off'}
                    </span>
                    <Toggle
                      enabled={isEnabled}
                      onChange={() => handleToggleOverride(mod.slug)}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Empty state when no tenant selected */}
      {!selectedTenant && (
        <div className="bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#38383A] rounded-2xl p-8 sm:p-12 text-center">
          <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-[#2C2C2E] flex items-center justify-center mx-auto mb-4">
            <Building2 className="h-6 w-6 text-gray-400 dark:text-[#636366]" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">No tenant selected</h3>
          <p className="text-xs text-gray-500 dark:text-[#8E8E93] max-w-sm mx-auto">
            Select a tenant from the dropdown above to customize their module access. You can enable Pro features for Basic plan schools or disable specific modules.
          </p>
        </div>
      )}
    </div>
  )
}

export default Modules
