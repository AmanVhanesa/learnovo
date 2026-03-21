import { useState, useEffect, useCallback, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import {
    Search, Filter, ChevronLeft, ChevronRight, AlertTriangle, Building2, Users, GraduationCap,
    Clock, Plus, Download, ArrowUpDown, X, Eye, Edit2, Ban, CheckCircle2, RefreshCw
} from 'lucide-react'
import { superAdminService } from '../../services/superAdminService'
import TenantSlideOver from '../../components/superadmin/TenantSlideOver'
import toast from 'react-hot-toast'

const SuperAdminTenants = () => {
    const queryClient = useQueryClient()
    const [searchParams, setSearchParams] = useSearchParams()

    const [page, setPage] = useState(() => Number(searchParams.get('page')) || 1)
    const [limit] = useState(20)
    const [search, setSearch] = useState(() => searchParams.get('q') || '')
    const [searchInput, setSearchInput] = useState(() => searchParams.get('q') || '')
    const [planFilter, setPlanFilter] = useState(() => searchParams.get('plan') || '')
    const [statusFilter, setStatusFilter] = useState(() => searchParams.get('status') || '')
    const [sortBy, setSortBy] = useState(() => searchParams.get('sort') || 'newest')
    const [selectedTenantId, setSelectedTenantId] = useState(null)
    const [isSlideOverOpen, setIsSlideOverOpen] = useState(false)
    const [showCreateModal, setShowCreateModal] = useState(false)
    const debounceRef = useRef(null)

    // Sync filters to URL params
    useEffect(() => {
        const params = {}
        if (search) params.q = search
        if (planFilter) params.plan = planFilter
        if (statusFilter) params.status = statusFilter
        if (sortBy && sortBy !== 'newest') params.sort = sortBy
        if (page > 1) params.page = page
        setSearchParams(params, { replace: true })
    }, [search, planFilter, statusFilter, sortBy, page, setSearchParams])

    // Debounced search (300ms)
    const handleSearchInput = useCallback((value) => {
        setSearchInput(value)
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => {
            setSearch(value)
            setPage(1)
        }, 300)
    }, [])

    const { data: tenantsData, isLoading, error } = useQuery({
        queryKey: ['superadmin-tenants', page, search, planFilter, statusFilter, sortBy],
        queryFn: async () => {
            const res = await superAdminService.getTenants({
                page, limit, search, plan: planFilter || undefined, status: statusFilter || undefined, sort: sortBy
            })
            if (res.success) {
                const total = res.pagination?.total || res.total || 0
                return {
                    tenants: res.data,
                    totalCount: total,
                    totalPages: total ? Math.ceil(total / limit) : 1,
                    statusCounts: res.statusCounts || {}
                }
            }
            return { tenants: [], totalCount: 0, totalPages: 1, statusCounts: {} }
        },
    })

    const tenants = tenantsData?.tenants || []
    const totalCount = tenantsData?.totalCount || 0
    const totalPages = tenantsData?.totalPages || 1
    const statusCounts = tenantsData?.statusCounts || {}

    const clearFilters = () => {
        setSearch(''); setSearchInput(''); setPlanFilter(''); setStatusFilter(''); setSortBy('newest'); setPage(1)
    }
    const openManageSlideOver = (id) => { setSelectedTenantId(id); setIsSlideOverOpen(true) }
    const handleTenantUpdate = () => { queryClient.invalidateQueries({ queryKey: ['superadmin-tenants'] }) }

    // CSV export
    const handleExportCSV = () => {
        if (!tenants.length) return toast.error('No data to export')
        const headers = ['School Name', 'School Code', 'Email', 'Phone', 'Plan', 'Status', 'Students', 'Teachers', 'Registered']
        const rows = tenants.map(t => [
            t.schoolName || t.organizationName || '',
            t.schoolCode || '',
            t.email || t.adminEmail || '',
            t.phone || '',
            t.subscription?.plan || '',
            t.subscription?.status || '',
            t.usage?.students || 0,
            t.usage?.teachers || 0,
            t.createdAt ? new Date(t.createdAt).toLocaleDateString() : ''
        ])
        const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n')
        const blob = new Blob([csv], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `learnovo-schools-${new Date().toISOString().split('T')[0]}.csv`
        a.click()
        URL.revokeObjectURL(url)
        toast.success('CSV exported')
    }

    const statusConfig = {
        active: { label: 'Active', bg: 'bg-emerald-50 dark:bg-[rgba(48,209,88,0.12)]', text: 'text-emerald-700 dark:text-[#30D158]', ring: 'ring-emerald-200', dot: 'bg-emerald-500' },
        trial: { label: 'Trial', bg: 'bg-amber-50 dark:bg-[rgba(255,214,10,0.12)]', text: 'text-amber-700 dark:text-[#FFD60A]', ring: 'ring-amber-200', dot: 'bg-amber-500' },
        suspended: { label: 'Suspended', bg: 'bg-red-50 dark:bg-[rgba(255,69,58,0.12)]', text: 'text-red-700 dark:text-[#FF453A]', ring: 'ring-red-200', dot: 'bg-red-500' },
        cancelled: { label: 'Cancelled', bg: 'bg-gray-50 dark:bg-[rgba(142,142,147,0.12)]', text: 'text-gray-600 dark:text-[#8E8E93]', ring: 'ring-gray-200', dot: 'bg-gray-400' },
    }
    const planConfig = {
        free: { label: 'Free Trial', bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200' },
        free_trial: { label: 'Free Trial', bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200' },
        basic: { label: 'Basic', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
        pro: { label: 'Pro', bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
        enterprise: { label: 'Enterprise', bg: 'bg-primary-50', text: 'text-primary-700', border: 'border-primary-200' },
    }

    const activeCount = statusCounts.active ?? tenants.filter(t => t.subscription?.status === 'active').length
    const trialCount = statusCounts.trial ?? tenants.filter(t => t.subscription?.status === 'trial').length
    const suspendedCount = statusCounts.suspended ?? tenants.filter(t => t.subscription?.status === 'suspended').length

    const sortOptions = [
        { value: 'newest', label: 'Newest First' },
        { value: 'oldest', label: 'Oldest First' },
        { value: 'name_asc', label: 'Name A-Z' },
        { value: 'name_desc', label: 'Name Z-A' },
        { value: 'students_desc', label: 'Most Students' },
    ]

    return (
        <div className="space-y-4 sm:space-y-5">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-[-0.025em]">Tenant Schools</h1>
                    <p className="mt-0.5 text-sm text-gray-500 dark:text-[#8E8E93]">
                        Manage registered schools and subscriptions
                        {totalCount > 0 && <span className="text-gray-400 dark:text-[#636366]"> — {totalCount} total</span>}
                    </p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    <button onClick={handleExportCSV} className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 h-10 px-4 text-sm font-semibold rounded-xl border border-gray-300 dark:border-[#38383A] text-gray-700 dark:text-white bg-white dark:bg-transparent hover:bg-gray-50 dark:hover:bg-[#2C2C2E] active:scale-[0.97] transition-all">
                        <Download className="h-4 w-4" /> Export
                    </button>
                    <button onClick={() => setShowCreateModal(true)} className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 h-10 px-4 text-sm font-semibold rounded-xl bg-primary-600 dark:bg-[#3EC4B1] text-white dark:text-black hover:bg-primary-500 dark:hover:bg-[#35a89a] shadow-md active:scale-[0.97] transition-all">
                        <Plus className="h-4 w-4" /> Add Tenant
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: 'Total Schools', value: totalCount, icon: Building2, color: 'text-primary-600', bg: 'bg-primary-50' },
                    { label: 'Active', value: activeCount, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                    { label: 'On Trial', value: trialCount, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
                    { label: 'Suspended', value: suspendedCount, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
                ].map((stat) => {
                    const Icon = stat.icon
                    return (
                        <div key={stat.label} className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-gray-100 dark:border-[#38383A] p-3 sm:p-4 flex items-center gap-3">
                            <div className={`w-10 h-10 ${stat.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                                <Icon className={`h-5 w-5 ${stat.color}`} />
                            </div>
                            <div>
                                <p className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
                                <p className="text-xs text-gray-500 dark:text-[#8E8E93]">{stat.label}</p>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Error */}
            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
                    <p className="text-sm text-red-600 dark:text-red-400">{error.response?.data?.message || error.message || 'Failed to load schools'}</p>
                </div>
            )}

            {/* Search + Filters */}
            <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-gray-100 dark:border-[#38383A] p-3 sm:p-4">
                <div className="flex flex-col lg:flex-row gap-3">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-[#636366] pointer-events-none" />
                        <input
                            type="text"
                            value={searchInput}
                            onChange={(e) => handleSearchInput(e.target.value)}
                            className="block w-full pl-10 pr-3.5 h-11 sm:h-10 border border-gray-200 dark:border-[#38383A] rounded-xl text-sm bg-white dark:bg-[#1C1C1E] dark:text-white placeholder-gray-400 dark:placeholder-[#636366] focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:focus:ring-[#3EC4B1] dark:focus:border-[#3EC4B1] transition-colors"
                            placeholder="Search by school name, email, or code..."
                        />
                    </div>
                    <div className="flex flex-wrap sm:flex-nowrap gap-2 items-center">
                        <select value={planFilter} onChange={(e) => { setPlanFilter(e.target.value); setPage(1) }} className="block w-full sm:w-auto pl-3 pr-8 h-11 sm:h-10 text-sm border border-gray-200 dark:border-[#38383A] rounded-xl bg-white dark:bg-[#1C1C1E] dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:focus:ring-[#3EC4B1] dark:focus:border-[#3EC4B1] transition-colors">
                            <option value="">All Plans</option>
                            <option value="free">Free Trial</option>
                            <option value="basic">Basic</option>
                            <option value="pro">Pro</option>
                            <option value="enterprise">Enterprise</option>
                        </select>
                        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }} className="block w-full sm:w-auto pl-3 pr-8 h-11 sm:h-10 text-sm border border-gray-200 dark:border-[#38383A] rounded-xl bg-white dark:bg-[#1C1C1E] dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:focus:ring-[#3EC4B1] dark:focus:border-[#3EC4B1] transition-colors">
                            <option value="">All Statuses</option>
                            <option value="active">Active</option>
                            <option value="trial">Trial</option>
                            <option value="suspended">Suspended</option>
                            <option value="cancelled">Cancelled</option>
                        </select>
                        <select value={sortBy} onChange={(e) => { setSortBy(e.target.value); setPage(1) }} className="block w-full sm:w-auto pl-3 pr-8 h-11 sm:h-10 text-sm border border-gray-200 dark:border-[#38383A] rounded-xl bg-white dark:bg-[#1C1C1E] dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:focus:ring-[#3EC4B1] dark:focus:border-[#3EC4B1] transition-colors">
                            {sortOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                        {(search || planFilter || statusFilter || sortBy !== 'newest') && (
                            <button onClick={clearFilters} className="text-xs text-gray-500 dark:text-[#8E8E93] hover:text-red-500 font-semibold px-3 h-10 rounded-xl border border-gray-200 dark:border-[#38383A] hover:border-red-200 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors whitespace-nowrap">
                                Clear
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="space-y-3">
                {isLoading ? (
                    <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-gray-100 dark:border-[#38383A] p-10">
                        <div className="flex flex-col items-center justify-center gap-3 text-gray-400">
                            <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-200 dark:border-[#2C2C2E] border-t-primary-500" />
                            <span className="text-sm">Loading schools...</span>
                        </div>
                    </div>
                ) : tenants.length === 0 ? (
                    <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-gray-100 dark:border-[#38383A] p-12">
                        <div className="flex flex-col items-center justify-center gap-2">
                            <div className="w-12 h-12 bg-gray-50 dark:bg-[#2C2C2E] rounded-full flex items-center justify-center">
                                <Filter className="h-6 w-6 text-gray-400 dark:text-[#636366]" />
                            </div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">No schools found</p>
                            <p className="text-sm text-gray-500 dark:text-[#8E8E93]">Try adjusting your search or filters</p>
                            {(search || planFilter || statusFilter) && (
                                <button onClick={clearFilters} className="mt-2 text-primary-600 hover:text-primary-700 font-semibold text-sm">Clear all filters</button>
                            )}
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Desktop Table */}
                        <div className="hidden md:block bg-white dark:bg-[#1C1C1E] rounded-2xl border border-gray-100 dark:border-[#38383A] overflow-hidden shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_1px_2px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.04)]">
                            <div className="overflow-x-auto">
                                <table className="min-w-[600px] w-full">
                                    <thead>
                                        <tr className="bg-gray-50/80 dark:bg-[#2C2C2E]">
                                            <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">School</th>
                                            <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Email</th>
                                            <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Plan</th>
                                            <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Status</th>
                                            <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Students</th>
                                            <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Teachers</th>
                                            <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Joined</th>
                                            <th className="px-5 py-3.5 text-right text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50 dark:divide-[#2C2C2E]">
                                        {tenants.map((tenant) => {
                                            const sc = statusConfig[tenant.subscription?.status] || statusConfig.cancelled
                                            const pc = planConfig[tenant.subscription?.plan] || planConfig.free_trial
                                            const name = tenant.schoolName || tenant.organizationName || 'Unnamed School'
                                            const initials = name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
                                            const colors = ['bg-teal-500', 'bg-violet-500', 'bg-blue-500', 'bg-amber-500', 'bg-rose-500']
                                            const avatarColor = colors[(name.charCodeAt(0) || 0) % colors.length]
                                            return (
                                                <tr key={tenant._id} className="hover:bg-primary-50 dark:hover:bg-[#2C2C2E] transition-colors group">
                                                    <td className="px-5 py-3.5">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-9 h-9 ${avatarColor} rounded-xl flex items-center justify-center flex-shrink-0`}>
                                                                <span className="text-white font-bold text-xs">{initials}</span>
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{name}</p>
                                                                <p className="text-xs text-gray-400 dark:text-[#636366] font-mono">{tenant.schoolCode?.toUpperCase() || 'N/A'}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-3.5">
                                                        <p className="text-xs sm:text-sm text-gray-700 dark:text-[#8E8E93] truncate max-w-[180px]">{tenant.email || tenant.adminEmail || '\u2014'}</p>
                                                    </td>
                                                    <td className="px-5 py-3.5">
                                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border ${pc.bg} ${pc.text} ${pc.border}`}>{pc.label}</span>
                                                    </td>
                                                    <td className="px-5 py-3.5">
                                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ring-1 ${sc.bg} ${sc.text} ${sc.ring}`}>
                                                            <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />{sc.label}
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-3.5 text-xs sm:text-sm text-gray-700 dark:text-white">
                                                        <span className="flex items-center gap-1"><GraduationCap className="h-3.5 w-3.5 text-gray-400" />{tenant.usage?.students || 0}</span>
                                                    </td>
                                                    <td className="px-5 py-3.5 text-xs sm:text-sm text-gray-700 dark:text-white">
                                                        <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5 text-gray-400" />{tenant.usage?.teachers || 0}</span>
                                                    </td>
                                                    <td className="px-5 py-3.5 text-xs text-gray-500 dark:text-[#8E8E93]">
                                                        {new Date(tenant.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                    </td>
                                                    <td className="px-5 py-3.5 text-right">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <button onClick={() => openManageSlideOver(tenant._id)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl text-primary-700 dark:text-[#3EC4B1] bg-primary-50 dark:bg-[rgba(62,196,177,0.08)] hover:bg-primary-100 dark:hover:bg-[rgba(62,196,177,0.15)] border border-primary-200 dark:border-[rgba(62,196,177,0.2)] transition-colors opacity-70 group-hover:opacity-100">
                                                                <Eye className="h-3 w-3" /> View
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Mobile Cards */}
                        <div className="md:hidden space-y-2.5">
                            {tenants.map((tenant) => {
                                const sc = statusConfig[tenant.subscription?.status] || statusConfig.cancelled
                                const pc = planConfig[tenant.subscription?.plan] || planConfig.free_trial
                                const name = tenant.schoolName || tenant.organizationName || 'Unnamed School'
                                const initials = name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
                                const colors = ['bg-teal-500', 'bg-violet-500', 'bg-blue-500', 'bg-amber-500', 'bg-rose-500']
                                const avatarColor = colors[(name.charCodeAt(0) || 0) % colors.length]
                                return (
                                    <div key={tenant._id} onClick={() => openManageSlideOver(tenant._id)} className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-gray-100 dark:border-[#38383A] p-4 active:bg-gray-50 dark:active:bg-[#2C2C2E] transition-colors cursor-pointer">
                                        <div className="flex items-start gap-3">
                                            <div className={`w-10 h-10 ${avatarColor} rounded-xl flex items-center justify-center flex-shrink-0`}><span className="text-white font-bold text-sm">{initials}</span></div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-2">
                                                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{name}</p>
                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold ring-1 flex-shrink-0 ${sc.bg} ${sc.text} ${sc.ring}`}>
                                                        <span className={`w-1 h-1 rounded-full ${sc.dot}`} />{sc.label}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-gray-400 dark:text-[#636366] mt-0.5">{tenant.email || tenant.adminEmail || '\u2014'}</p>
                                                <div className="flex items-center gap-3 mt-2">
                                                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${pc.bg} ${pc.text} ${pc.border}`}>{pc.label}</span>
                                                    <span className="text-[10px] text-gray-400 font-mono">{tenant.schoolCode?.toUpperCase()}</span>
                                                    <span className="text-[10px] text-gray-400 flex items-center gap-0.5"><GraduationCap className="h-2.5 w-2.5" /> {tenant.usage?.students || 0}</span>
                                                    <span className="text-[10px] text-gray-400 flex items-center gap-0.5"><Users className="h-2.5 w-2.5" /> {tenant.usage?.teachers || 0}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </>
                )}
            </div>

            {/* Pagination */}
            {!isLoading && tenants.length > 0 && (
                <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-gray-100 dark:border-[#38383A] px-4 py-3 flex items-center justify-between">
                    <p className="text-xs text-gray-500 dark:text-[#8E8E93] hidden sm:block">
                        Showing <span className="font-semibold text-gray-700 dark:text-white">{(page - 1) * limit + 1}</span> to <span className="font-semibold text-gray-700 dark:text-white">{Math.min(page * limit, totalCount)}</span> of <span className="font-semibold text-gray-700 dark:text-white">{totalCount}</span> schools
                    </p>
                    <div className="flex items-center gap-1">
                        <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="p-2 rounded-xl text-gray-500 dark:text-[#8E8E93] hover:bg-gray-100 dark:hover:bg-[#2C2C2E] disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                            <ChevronLeft className="h-4 w-4" />
                        </button>
                        {(() => {
                            const pages = []
                            const maxVisible = 7
                            let start = Math.max(1, page - Math.floor(maxVisible / 2))
                            let end = Math.min(totalPages, start + maxVisible - 1)
                            if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1)
                            for (let i = start; i <= end; i++) {
                                pages.push(
                                    <button key={i} onClick={() => setPage(i)} className={`w-8 h-8 rounded-xl text-xs font-semibold transition-colors ${page === i ? 'bg-primary-600 dark:bg-[#3EC4B1] text-white dark:text-black shadow-sm' : 'text-gray-500 dark:text-[#8E8E93] hover:bg-gray-100 dark:hover:bg-[#2C2C2E]'}`}>{i}</button>
                                )
                            }
                            return pages
                        })()}
                        <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="p-2 rounded-xl text-gray-500 dark:text-[#8E8E93] hover:bg-gray-100 dark:hover:bg-[#2C2C2E] disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* Create Tenant Modal */}
            {showCreateModal && <CreateTenantModal onClose={() => setShowCreateModal(false)} onSuccess={handleTenantUpdate} />}

            {/* Tenant Slide Over */}
            <TenantSlideOver isOpen={isSlideOverOpen} onClose={() => setIsSlideOverOpen(false)} tenantId={selectedTenantId} onUpdate={handleTenantUpdate} />
        </div>
    )
}

// ── Create Tenant Modal ──
const CreateTenantModal = ({ onClose, onSuccess }) => {
    const queryClient = useQueryClient()
    const [form, setForm] = useState({
        schoolName: '', adminEmail: '', adminPassword: '', phone: '', schoolCode: '',
        plan: 'free', maxStudents: '', maxTeachers: ''
    })

    const createMutation = useMutation({
        mutationFn: (data) => superAdminService.createTenant(data),
        onSuccess: (res) => {
            toast.success(`School created! Code: ${res.data?.schoolCode || form.schoolCode}`)
            queryClient.invalidateQueries({ queryKey: ['superadmin-tenants'] })
            if (onSuccess) onSuccess()
            onClose()
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Failed to create school'),
    })

    const generateCode = () => {
        const code = form.schoolName
            .replace(/[^a-zA-Z0-9]/g, '')
            .substring(0, 6)
            .toLowerCase() + Math.floor(100 + Math.random() * 900)
        setForm(p => ({ ...p, schoolCode: code }))
    }

    const handleSubmit = (e) => {
        e.preventDefault()
        if (!form.schoolName || !form.adminEmail || !form.adminPassword) {
            toast.error('Please fill all required fields')
            return
        }
        if (form.adminPassword.length < 8) {
            toast.error('Password must be at least 8 characters')
            return
        }
        const payload = {
            schoolName: form.schoolName,
            adminEmail: form.adminEmail,
            adminPassword: form.adminPassword,
            phone: form.phone || undefined,
            schoolCode: form.schoolCode || undefined,
            plan: form.plan,
        }
        if (form.plan === 'enterprise') {
            if (form.maxStudents) payload.customLimits = { ...payload.customLimits, students: Number(form.maxStudents) }
            if (form.maxTeachers) payload.customLimits = { ...payload.customLimits, teachers: Number(form.maxTeachers) }
        }
        createMutation.mutate(payload)
    }

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 dark:bg-black/75 backdrop-blur-sm" onClick={onClose}>
            <div onClick={(e) => e.stopPropagation()} className="bg-white dark:bg-[#1C1C1E] rounded-t-2xl sm:rounded-2xl shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_4px_8px_rgba(0,0,0,0.04),0_16px_40px_rgba(0,0,0,0.08)] w-full max-w-lg mx-0 sm:mx-4 p-5 sm:p-6 max-h-[90vh] overflow-y-auto animate-scale-in">
                <div className="flex items-center justify-between mb-5">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">Create New School</h2>
                    <button onClick={onClose} className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 dark:hover:bg-[#2C2C2E] hover:text-gray-600 transition-colors"><X className="h-4 w-4" /></button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">School Name *</label>
                        <input type="text" value={form.schoolName} onChange={e => setForm(p => ({ ...p, schoolName: e.target.value }))} className="block w-full h-11 sm:h-10 rounded-xl border border-gray-200 dark:border-[#38383A] bg-white dark:bg-[#1C1C1E] dark:text-white px-3.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:focus:ring-[#3EC4B1] dark:focus:border-[#3EC4B1]" required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">Admin Email *</label>
                        <input type="email" value={form.adminEmail} onChange={e => setForm(p => ({ ...p, adminEmail: e.target.value }))} className="block w-full h-11 sm:h-10 rounded-xl border border-gray-200 dark:border-[#38383A] bg-white dark:bg-[#1C1C1E] dark:text-white px-3.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:focus:ring-[#3EC4B1] dark:focus:border-[#3EC4B1]" required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">Admin Password *</label>
                        <input type="password" value={form.adminPassword} onChange={e => setForm(p => ({ ...p, adminPassword: e.target.value }))} className="block w-full h-11 sm:h-10 rounded-xl border border-gray-200 dark:border-[#38383A] bg-white dark:bg-[#1C1C1E] dark:text-white px-3.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:focus:ring-[#3EC4B1] dark:focus:border-[#3EC4B1]" required minLength={8} placeholder="Min 8 characters" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">Phone Number</label>
                        <input type="tel" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} className="block w-full h-11 sm:h-10 rounded-xl border border-gray-200 dark:border-[#38383A] bg-white dark:bg-[#1C1C1E] dark:text-white px-3.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:focus:ring-[#3EC4B1] dark:focus:border-[#3EC4B1]" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">School Code *</label>
                        <div className="flex gap-2">
                            <input type="text" value={form.schoolCode} onChange={e => setForm(p => ({ ...p, schoolCode: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '') }))} className="block flex-1 h-11 sm:h-10 rounded-xl border border-gray-200 dark:border-[#38383A] bg-white dark:bg-[#1C1C1E] dark:text-white px-3.5 text-sm font-mono focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:focus:ring-[#3EC4B1] dark:focus:border-[#3EC4B1]" required placeholder="e.g. demo123" />
                            <button type="button" onClick={generateCode} className="h-11 sm:h-10 px-3 rounded-xl text-xs font-semibold border border-gray-200 dark:border-[#38383A] text-gray-600 dark:text-[#8E8E93] hover:bg-gray-50 dark:hover:bg-[#2C2C2E] transition-colors whitespace-nowrap">
                                <RefreshCw className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-2">Plan</label>
                        <div className="grid grid-cols-2 gap-2">
                            {[
                                { id: 'free', label: 'Free Trial', color: 'border-gray-300 bg-gray-50' },
                                { id: 'basic', label: 'Basic', color: 'border-blue-300 bg-blue-50' },
                                { id: 'pro', label: 'Pro', color: 'border-violet-300 bg-violet-50' },
                                { id: 'enterprise', label: 'Enterprise', color: 'border-primary-300 bg-primary-50' },
                            ].map(p => (
                                <label key={p.id} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 cursor-pointer transition-all ${form.plan === p.id ? p.color + ' ring-2 ring-offset-1 ring-primary-400' : 'border-gray-200 dark:border-[#38383A] hover:border-gray-300'}`}>
                                    <input type="radio" name="plan" value={p.id} checked={form.plan === p.id} onChange={e => setForm(prev => ({ ...prev, plan: e.target.value }))} className="sr-only" />
                                    <span className="text-sm font-semibold text-gray-700 dark:text-white">{p.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                    {form.plan === 'enterprise' && (
                        <div className="grid grid-cols-2 gap-3 p-3 bg-primary-50/50 dark:bg-[rgba(62,196,177,0.08)] rounded-xl border border-primary-100 dark:border-[rgba(62,196,177,0.2)]">
                            <div>
                                <label className="block text-xs font-medium text-gray-600 dark:text-[#8E8E93] mb-1">Max Students</label>
                                <input type="number" min="0" value={form.maxStudents} onChange={e => setForm(p => ({ ...p, maxStudents: e.target.value }))} className="block w-full h-9 rounded-lg border border-gray-200 dark:border-[#38383A] bg-white dark:bg-[#1C1C1E] dark:text-white px-3 text-sm" placeholder="Unlimited" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 dark:text-[#8E8E93] mb-1">Max Teachers</label>
                                <input type="number" min="0" value={form.maxTeachers} onChange={e => setForm(p => ({ ...p, maxTeachers: e.target.value }))} className="block w-full h-9 rounded-lg border border-gray-200 dark:border-[#38383A] bg-white dark:bg-[#1C1C1E] dark:text-white px-3 text-sm" placeholder="Unlimited" />
                            </div>
                        </div>
                    )}
                    <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-2">
                        <button type="button" onClick={onClose} className="h-10 px-4 text-sm font-semibold rounded-xl border border-gray-300 dark:border-[#38383A] text-gray-700 dark:text-white bg-white dark:bg-transparent hover:bg-gray-50 dark:hover:bg-[#2C2C2E] active:scale-[0.97] transition-all w-full sm:w-auto">Cancel</button>
                        <button type="submit" disabled={createMutation.isPending} className="h-10 px-4 text-sm font-semibold rounded-xl bg-primary-600 dark:bg-[#3EC4B1] text-white dark:text-black hover:bg-primary-500 dark:hover:bg-[#35a89a] shadow-md active:scale-[0.97] transition-all disabled:opacity-50 w-full sm:w-auto">
                            {createMutation.isPending ? 'Creating...' : 'Create School'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

export default SuperAdminTenants
