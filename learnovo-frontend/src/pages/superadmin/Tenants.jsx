import React, { useState, useEffect } from 'react'
import { Search, Filter, Plus, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react'
import { superAdminService } from '../../services/superAdminService'
import TenantSlideOver from '../../components/superadmin/TenantSlideOver'

const SuperAdminTenants = () => {
    const [tenants, setTenants] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState(null)

    // Pagination & Filters
    const [page, setPage] = useState(1)
    const [limit] = useState(10)
    const [totalPages, setTotalPages] = useState(1)
    const [totalCount, setTotalCount] = useState(0)
    const [search, setSearch] = useState('')
    const [searchInput, setSearchInput] = useState('')
    const [planFilter, setPlanFilter] = useState('')
    const [statusFilter, setStatusFilter] = useState('')

    // SlideOver state
    const [selectedTenantId, setSelectedTenantId] = useState(null)
    const [isSlideOverOpen, setIsSlideOverOpen] = useState(false)

    useEffect(() => {
        fetchTenants()
    }, [page, search, planFilter, statusFilter])

    const fetchTenants = async () => {
        setIsLoading(true)
        setError(null)
        try {
            const res = await superAdminService.getTenants({
                page, limit, search, plan: planFilter, status: statusFilter
            })
            if (res.success) {
                setTenants(res.data)
                const total = res.pagination?.total || res.total || 0
                setTotalCount(total)
                if (total) setTotalPages(Math.ceil(total / limit))
            }
        } catch (err) {
            console.error('Error fetching tenants:', err)
            setError(err.response?.data?.message || 'Failed to load schools')
            // Fallback data for UI dev
            if (process.env.NODE_ENV === 'development') {
                setTenants([
                    { _id: '1', name: 'Springfield Academy', schoolCode: 'SFA', adminEmail: 'admin@springfield.edu', subscription: { plan: 'premium', status: 'active' }, createdAt: new Date(Date.now() - 86400000).toISOString() },
                    { _id: '2', name: 'Lincoln High', schoolCode: 'LHS', adminEmail: 'admin@lincolnhigh.org', subscription: { plan: 'free_trial', status: 'trial' }, createdAt: new Date(Date.now() - 172800000).toISOString() },
                    { _id: '3', name: 'Oakwood Elementary', schoolCode: 'OAK', adminEmail: 'admin@oakwood.edu', subscription: { plan: 'basic', status: 'active' }, createdAt: new Date(Date.now() - 259200000).toISOString() },
                ])
                setTotalPages(1)
            }
        } finally {
            setIsLoading(false)
        }
    }

    const handleSearch = (e) => {
        e.preventDefault()
        setSearch(searchInput)
        setPage(1) // Reset to first page
    }

    const clearFilters = () => {
        setSearch('')
        setSearchInput('')
        setPlanFilter('')
        setStatusFilter('')
        setPage(1)
    }

    const openManageSlideOver = (id) => {
        setSelectedTenantId(id)
        setIsSlideOverOpen(true)
    }

    // Badges (identical logic to Dashboard for consistency)
    const getStatusBadge = (status) => {
        switch (status) {
            case 'active': return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">Active</span>
            case 'trial': return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">Trial</span>
            case 'suspended': return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">Suspended</span>
            case 'cancelled': return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">Cancelled</span>
            default: return null
        }
    }

    const planInfo = {
        free_trial: { label: 'Free Trial', color: '#9CA3AF' },
        basic: { label: 'Basic', color: '#3B82F6' },
        premium: { label: 'Premium', color: '#8B5CF6' },
        enterprise: { label: 'Enterprise', color: '#F59E0B' },
    }

    const getPlanBadge = (plan) => {
        const info = planInfo[plan] || { label: plan, color: '#6b7280' }
        return (
            <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: info.color }}></div>
                <span className="text-sm font-medium text-gray-700">{info.label}</span>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header and Actions */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Schools</h1>
                    <p className="mt-1 text-sm text-gray-500">
                        Manage all registered tenant schools and their subscriptions.
                        {totalCount > 0 && <span className="ml-1 text-gray-400">({totalCount} total)</span>}
                    </p>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4 flex items-center">
                    <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
                    <p className="text-sm text-red-600">{error}</p>
                </div>
            )}

            {/* Filters Toolbar */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <div className="flex flex-col lg:flex-row gap-4">

                    <form onSubmit={handleSearch} className="flex-1">
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search className="h-4 w-4 text-gray-400" />
                            </div>
                            <input
                                type="text"
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                                placeholder="Search by school name, email, or code..."
                            />
                        </div>
                    </form>

                    <div className="flex flex-wrap sm:flex-nowrap gap-3 items-center">
                        <div className="relative">
                            <select
                                value={planFilter}
                                onChange={(e) => { setPlanFilter(e.target.value); setPage(1); }}
                                className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-lg"
                            >
                                <option value="">All Plans</option>
                                <option value="free_trial">Free Trial</option>
                                <option value="basic">Basic</option>
                                <option value="premium">Premium</option>
                                <option value="enterprise">Enterprise</option>
                            </select>
                        </div>

                        <div className="relative">
                            <select
                                value={statusFilter}
                                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                                className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-lg"
                            >
                                <option value="">All Statuses</option>
                                <option value="active">Active</option>
                                <option value="trial">Trial</option>
                                <option value="suspended">Suspended</option>
                            </select>
                        </div>

                        {(search || planFilter || statusFilter) && (
                            <button
                                onClick={clearFilters}
                                className="text-sm text-gray-500 hover:text-gray-700 underline px-2 whitespace-nowrap"
                            >
                                Clear Filters
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Main Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto min-h-[400px]">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    School Detail
                                </th>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    Admin Contact
                                </th>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    Subscription
                                </th>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    Status
                                </th>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    Joined Date
                                </th>
                                <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {isLoading ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-10 text-center text-gray-500">
                                        <div className="flex justify-center items-center">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                                            <span className="ml-3">Loading schools...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : tenants.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-10 text-center text-gray-500">
                                        <div className="flex flex-col justify-center items-center">
                                            <Filter className="h-10 w-10 text-gray-300 mb-2" />
                                            <p>No schools found matching your criteria.</p>
                                            {(search || planFilter || statusFilter) && (
                                                <button onClick={clearFilters} className="mt-2 text-primary-600 hover:text-primary-800 font-medium text-sm">
                                                    Clear all filters
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                tenants.map((tenant) => (
                                    <tr key={tenant._id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center">
                                                <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-primary-100 flex items-center justify-center">
                                                    <span className="text-primary-700 font-bold text-lg">{(tenant.schoolName || tenant.organizationName || 'School').charAt(0).toUpperCase()}</span>
                                                </div>
                                                <div className="ml-4">
                                                    <div className="text-sm font-medium text-gray-900">{tenant.schoolName || tenant.organizationName || 'Unnamed School'}</div>
                                                    <div className="text-xs text-gray-500">Code: {tenant.schoolCode || 'N/A'}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-900">{tenant.email || tenant.adminEmail || 'No email provided'}</div>
                                            <div className="text-xs text-gray-500">{tenant.phone || '-'}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {getPlanBadge(tenant.subscription?.plan)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {getStatusBadge(tenant.subscription?.status)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {new Date(tenant.createdAt).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button
                                                onClick={() => openManageSlideOver(tenant._id)}
                                                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-semibold rounded text-white bg-primary-600 hover:bg-primary-700 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                                            >
                                                Manage
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {!isLoading && tenants.length > 0 && totalPages > 1 && (
                    <div className="bg-white px-4 py-3 border-t border-gray-200 flex items-center justify-between sm:px-6">
                        <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                            <div>
                                <p className="text-sm text-gray-700">
                                    Showing <span className="font-medium">{(page - 1) * limit + 1}</span> to <span className="font-medium">{Math.min(page * limit, totalCount)}</span> of <span className="font-medium">{totalCount}</span> schools
                                </p>
                            </div>
                            <div>
                                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                                    <button
                                        onClick={() => setPage(Math.max(1, page - 1))}
                                        disabled={page === 1}
                                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                                    >
                                        <span className="sr-only">Previous</span>
                                        <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                                    </button>
                                    {[...Array(totalPages)].map((_, i) => (
                                        <button
                                            key={i + 1}
                                            onClick={() => setPage(i + 1)}
                                            className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${page === i + 1
                                                ? 'z-10 bg-primary-50 border-primary-500 text-primary-600'
                                                : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                                                }`}
                                        >
                                            {i + 1}
                                        </button>
                                    ))}
                                    <button
                                        onClick={() => setPage(Math.min(totalPages, page + 1))}
                                        disabled={page === totalPages}
                                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                                    >
                                        <span className="sr-only">Next</span>
                                        <ChevronRight className="h-5 w-5" aria-hidden="true" />
                                    </button>
                                </nav>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Tenant Slide Over Drawer */}
            <TenantSlideOver
                isOpen={isSlideOverOpen}
                onClose={() => setIsSlideOverOpen(false)}
                tenantId={selectedTenantId}
                onUpdate={fetchTenants}
            />
        </div>
    )
}

export default SuperAdminTenants
