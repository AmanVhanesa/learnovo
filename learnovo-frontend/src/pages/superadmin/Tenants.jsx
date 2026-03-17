import React, { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Search, Filter, ChevronLeft, ChevronRight, AlertTriangle, Building2, Users, GraduationCap, Clock } from 'lucide-react'
import { superAdminService } from '../../services/superAdminService'
import TenantSlideOver from '../../components/superadmin/TenantSlideOver'

const SuperAdminTenants = () => {
    const queryClient = useQueryClient()
    const [page, setPage] = useState(1)
    const [limit] = useState(10)
    const [search, setSearch] = useState('')
    const [searchInput, setSearchInput] = useState('')
    const [planFilter, setPlanFilter] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [selectedTenantId, setSelectedTenantId] = useState(null)
    const [isSlideOverOpen, setIsSlideOverOpen] = useState(false)

    const { data: tenantsData, isLoading, error } = useQuery({
        queryKey: ['superadmin-tenants', page, search, planFilter, statusFilter],
        queryFn: async () => {
            const res = await superAdminService.getTenants({ page, limit, search, plan: planFilter, status: statusFilter })
            if (res.success) {
                const total = res.pagination?.total || res.total || 0
                return { tenants: res.data, totalCount: total, totalPages: total ? Math.ceil(total / limit) : 1 }
            }
            return { tenants: [], totalCount: 0, totalPages: 1 }
        },
    })

    const tenants = tenantsData?.tenants || []
    const totalCount = tenantsData?.totalCount || 0
    const totalPages = tenantsData?.totalPages || 1

    const handleSearch = (e) => { e.preventDefault(); setSearch(searchInput); setPage(1) }
    const clearFilters = () => { setSearch(''); setSearchInput(''); setPlanFilter(''); setStatusFilter(''); setPage(1) }
    const openManageSlideOver = (id) => { setSelectedTenantId(id); setIsSlideOverOpen(true) }
    const handleTenantUpdate = () => { queryClient.invalidateQueries({ queryKey: ['superadmin-tenants'] }) }

    const statusConfig = {
        active: { label: 'Active', bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
        trial: { label: 'Trial', bg: 'bg-sky-50', text: 'text-sky-700', dot: 'bg-sky-500' },
        suspended: { label: 'Suspended', bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
        cancelled: { label: 'Cancelled', bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' },
    }
    const planConfig = {
        free_trial: { label: 'Free Trial', bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200' },
        basic: { label: 'Basic', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
        premium: { label: 'Premium', bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
        pro: { label: 'Pro', bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
        enterprise: { label: 'Enterprise', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
    }

    const activeCount = tenants.filter(t => t.subscription?.status === 'active').length
    const trialCount = tenants.filter(t => t.subscription?.status === 'trial').length
    const suspendedCount = tenants.filter(t => t.subscription?.status === 'suspended').length

    return (
        <div className="space-y-5">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tenant Schools</h1>
                    <p className="mt-0.5 text-sm text-gray-500 dark:text-[#8E8E93]">
                        Manage registered schools and subscriptions
                        {totalCount > 0 && <span className="text-gray-400 dark:text-[#636366]"> — {totalCount} total</span>}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: 'Total Schools', value: totalCount, icon: Building2, color: 'text-primary-600', bg: 'bg-primary-50' },
                    { label: 'Active', value: activeCount, icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                    { label: 'On Trial', value: trialCount, icon: Clock, color: 'text-sky-600', bg: 'bg-sky-50' },
                    { label: 'Suspended', value: suspendedCount, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
                ].map((stat) => {
                    const Icon = stat.icon
                    return (
                        <div key={stat.label} className="bg-white dark:bg-[#1C1C1E] rounded-xl border border-gray-100 dark:border-[#38383A] p-4 flex items-center gap-3">
                            <div className={`w-10 h-10 ${stat.bg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                                <Icon className={`h-5 w-5 ${stat.color}`} />
                            </div>
                            <div>
                                <p className="text-xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
                                <p className="text-xs text-gray-500 dark:text-[#8E8E93]">{stat.label}</p>
                            </div>
                        </div>
                    )
                })}
            </div>

            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
                    <p className="text-sm text-red-600 dark:text-red-400">{error.response?.data?.message || error.message || 'Failed to load schools'}</p>
                </div>
            )}

            <div className="bg-white dark:bg-[#1C1C1E] rounded-xl border border-gray-100 dark:border-[#38383A] p-3 sm:p-4">
                <div className="flex flex-col lg:flex-row gap-3">
                    <form onSubmit={handleSearch} className="flex-1">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-[#636366] pointer-events-none" />
                            <input type="text" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 dark:border-[#38383A] rounded-lg text-sm bg-gray-50 dark:bg-[#1C1C1E] dark:text-white placeholder-gray-400 dark:placeholder-[#636366] focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-colors" placeholder="Search by school name, email, or code..." />
                        </div>
                    </form>
                    <div className="flex flex-wrap sm:flex-nowrap gap-2 items-center">
                        <select value={planFilter} onChange={(e) => { setPlanFilter(e.target.value); setPage(1) }} className="block w-full sm:w-auto pl-3 pr-8 py-2.5 text-sm border border-gray-200 dark:border-[#38383A] rounded-lg bg-gray-50 dark:bg-[#1C1C1E] dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-colors">
                            <option value="">All Plans</option>
                            <option value="free_trial">Free Trial</option>
                            <option value="basic">Basic</option>
                            <option value="premium">Premium</option>
                            <option value="enterprise">Enterprise</option>
                        </select>
                        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }} className="block w-full sm:w-auto pl-3 pr-8 py-2.5 text-sm border border-gray-200 dark:border-[#38383A] rounded-lg bg-gray-50 dark:bg-[#1C1C1E] dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-colors">
                            <option value="">All Statuses</option>
                            <option value="active">Active</option>
                            <option value="trial">Trial</option>
                            <option value="suspended">Suspended</option>
                        </select>
                        {(search || planFilter || statusFilter) && (
                            <button onClick={clearFilters} className="text-xs text-gray-500 dark:text-[#8E8E93] hover:text-red-500 font-medium px-3 py-2.5 rounded-lg border border-gray-200 dark:border-[#38383A] hover:border-red-200 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors whitespace-nowrap">Clear</button>
                        )}
                    </div>
                </div>
            </div>

            <div className="space-y-3">
                {isLoading ? (
                    <div className="bg-white dark:bg-[#1C1C1E] rounded-xl border border-gray-100 dark:border-[#38383A] p-10">
                        <div className="flex flex-col items-center justify-center gap-3 text-gray-400">
                            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-200 border-t-primary-600" />
                            <span className="text-sm">Loading schools...</span>
                        </div>
                    </div>
                ) : tenants.length === 0 ? (
                    <div className="bg-white dark:bg-[#1C1C1E] rounded-xl border border-gray-100 dark:border-[#38383A] p-12">
                        <div className="flex flex-col items-center justify-center gap-2 text-gray-400">
                            <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mb-1"><Filter className="h-7 w-7 text-gray-300" /></div>
                            <p className="text-sm font-medium text-gray-500 dark:text-[#8E8E93]">No schools found</p>
                            <p className="text-xs text-gray-400 dark:text-[#636366]">Try adjusting your search or filters</p>
                            {(search || planFilter || statusFilter) && (<button onClick={clearFilters} className="mt-2 text-primary-600 hover:text-primary-700 font-medium text-sm">Clear all filters</button>)}
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="hidden md:block bg-white dark:bg-[#1C1C1E] rounded-xl border border-gray-100 dark:border-[#38383A] overflow-hidden">
                            <table className="min-w-full divide-y divide-gray-100 dark:divide-[#38383A]">
                                <thead>
                                    <tr className="bg-gray-50/80 dark:bg-[#2C2C2E]">
                                        <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">School</th>
                                        <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Contact</th>
                                        <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Plan</th>
                                        <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Status</th>
                                        <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Usage</th>
                                        <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Joined</th>
                                        <th className="px-5 py-3.5 text-right text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50 dark:divide-[#38383A]">
                                    {tenants.map((tenant) => {
                                        const sc = statusConfig[tenant.subscription?.status] || statusConfig.cancelled
                                        const pc = planConfig[tenant.subscription?.plan] || planConfig.free_trial
                                        const name = tenant.schoolName || tenant.organizationName || 'Unnamed School'
                                        const initials = name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
                                        const colors = ['bg-teal-500', 'bg-violet-500', 'bg-blue-500', 'bg-amber-500', 'bg-rose-500']
                                        const avatarColor = colors[(name.charCodeAt(0) || 0) % colors.length]
                                        return (
                                            <tr key={tenant._id} className="hover:bg-gray-50/50 dark:hover:bg-[#2C2C2E] transition-colors group">
                                                <td className="px-5 py-3.5"><div className="flex items-center gap-3"><div className={`w-9 h-9 ${avatarColor} rounded-lg flex items-center justify-center flex-shrink-0`}><span className="text-white font-bold text-xs">{initials}</span></div><div className="min-w-0"><p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{name}</p><p className="text-xs text-gray-400 dark:text-[#636366] font-mono">{tenant.schoolCode?.toUpperCase() || 'N/A'}</p></div></div></td>
                                                <td className="px-5 py-3.5"><p className="text-sm text-gray-700 dark:text-[#8E8E93] truncate max-w-[200px]">{tenant.email || tenant.adminEmail || '\u2014'}</p><p className="text-xs text-gray-400 dark:text-[#636366]">{tenant.phone || '\u2014'}</p></td>
                                                <td className="px-5 py-3.5"><span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${pc.bg} ${pc.text} ${pc.border}`}>{pc.label}</span></td>
                                                <td className="px-5 py-3.5"><span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${sc.bg} ${sc.text}`}><span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />{sc.label}</span></td>
                                                <td className="px-5 py-3.5"><div className="flex items-center gap-3 text-xs text-gray-500"><span className="flex items-center gap-1"><GraduationCap className="h-3 w-3" />{tenant.usage?.students || 0}</span><span className="flex items-center gap-1"><Users className="h-3 w-3" />{tenant.usage?.teachers || 0}</span></div></td>
                                                <td className="px-5 py-3.5 text-xs text-gray-500 dark:text-[#8E8E93]">{new Date(tenant.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                                                <td className="px-5 py-3.5 text-right"><button onClick={() => openManageSlideOver(tenant._id)} className="inline-flex items-center px-3.5 py-1.5 text-xs font-semibold rounded-lg text-primary-700 bg-primary-50 hover:bg-primary-100 border border-primary-200 transition-colors opacity-70 group-hover:opacity-100">Manage</button></td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>

                        <div className="md:hidden space-y-2.5">
                            {tenants.map((tenant) => {
                                const sc = statusConfig[tenant.subscription?.status] || statusConfig.cancelled
                                const pc = planConfig[tenant.subscription?.plan] || planConfig.free_trial
                                const name = tenant.schoolName || tenant.organizationName || 'Unnamed School'
                                const initials = name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
                                const colors = ['bg-teal-500', 'bg-violet-500', 'bg-blue-500', 'bg-amber-500', 'bg-rose-500']
                                const avatarColor = colors[(name.charCodeAt(0) || 0) % colors.length]
                                return (
                                    <div key={tenant._id} onClick={() => openManageSlideOver(tenant._id)} className="bg-white dark:bg-[#1C1C1E] rounded-xl border border-gray-100 dark:border-[#38383A] p-4 active:bg-gray-50 dark:active:bg-[#2C2C2E] transition-colors cursor-pointer">
                                        <div className="flex items-start gap-3">
                                            <div className={`w-10 h-10 ${avatarColor} rounded-lg flex items-center justify-center flex-shrink-0`}><span className="text-white font-bold text-sm">{initials}</span></div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{name}</p><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0 ${sc.bg} ${sc.text}`}><span className={`w-1 h-1 rounded-full ${sc.dot}`} />{sc.label}</span></div>
                                                <p className="text-xs text-gray-400 dark:text-[#636366] mt-0.5">{tenant.email || tenant.adminEmail || '\u2014'}</p>
                                                <div className="flex items-center gap-3 mt-2">
                                                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${pc.bg} ${pc.text} ${pc.border}`}>{pc.label}</span>
                                                    <span className="text-[10px] text-gray-400 font-mono">{tenant.schoolCode?.toUpperCase()}</span>
                                                    <span className="text-[10px] text-gray-400 flex items-center gap-0.5"><GraduationCap className="h-2.5 w-2.5" /> {tenant.usage?.students || 0}</span>
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

            {!isLoading && tenants.length > 0 && totalPages > 1 && (
                <div className="bg-white dark:bg-[#1C1C1E] rounded-xl border border-gray-100 dark:border-[#38383A] px-4 py-3 flex items-center justify-between">
                    <p className="text-xs text-gray-500 dark:text-[#8E8E93] hidden sm:block">Showing <span className="font-semibold text-gray-700 dark:text-white">{(page - 1) * limit + 1}</span> to <span className="font-semibold text-gray-700 dark:text-white">{Math.min(page * limit, totalCount)}</span> of <span className="font-semibold text-gray-700 dark:text-white">{totalCount}</span></p>
                    <div className="flex items-center gap-1">
                        <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="p-2 rounded-lg text-gray-500 dark:text-[#8E8E93] hover:bg-gray-100 dark:hover:bg-[#2C2C2E] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"><ChevronLeft className="h-4 w-4" /></button>
                        {[...Array(Math.min(totalPages, 7))].map((_, i) => { const pageNum = i + 1; return (<button key={pageNum} onClick={() => setPage(pageNum)} className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${page === pageNum ? 'bg-primary-600 text-white shadow-sm' : 'text-gray-500 dark:text-[#8E8E93] hover:bg-gray-100 dark:hover:bg-[#2C2C2E]'}`}>{pageNum}</button>) })}
                        <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="p-2 rounded-lg text-gray-500 dark:text-[#8E8E93] hover:bg-gray-100 dark:hover:bg-[#2C2C2E] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"><ChevronRight className="h-4 w-4" /></button>
                    </div>
                </div>
            )}

            <TenantSlideOver isOpen={isSlideOverOpen} onClose={() => setIsSlideOverOpen(false)} tenantId={selectedTenantId} onUpdate={handleTenantUpdate} />
        </div>
    )
}

export default SuperAdminTenants
