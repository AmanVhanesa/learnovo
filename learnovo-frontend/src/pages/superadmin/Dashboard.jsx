import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    School,
    CheckCircle2,
    Clock,
    Ban,
    Users,
    IndianRupee,
    AlertTriangle,
    Eye,
    MoreVertical,
    RefreshCw
} from 'lucide-react'
import { Line, Doughnut } from 'react-chartjs-2'
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js'
import KpiCard from '../../components/KpiCard'
import ChartCard from '../../components/ChartCard'
import { CardSkeleton, ChartSkeleton } from '../../components/LoadingSkeleton'
import { superAdminService } from '../../services/superAdminService'
import { useSettings } from '../../contexts/SettingsContext'
import TenantSlideOver from '../../components/superadmin/TenantSlideOver'

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    ArcElement,
    Title,
    Tooltip,
    Legend
)

const SuperAdminDashboard = () => {
    const navigate = useNavigate()
    const { formatCurrency } = useSettings()
    const [stats, setStats] = useState(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState(null)

    // SlideOver state for Recent Registrations "View" buttons
    const [selectedTenantId, setSelectedTenantId] = useState(null)
    const [isSlideOverOpen, setIsSlideOverOpen] = useState(false)

    useEffect(() => {
        fetchDashboardData()
    }, [])

    const fetchDashboardData = async () => {
        try {
            setIsLoading(true)
            setError(null)
            const res = await superAdminService.getDashboardStats()
            if (res?.success && res?.data) {
                setStats(res.data)
            } else {
                throw new Error('Failed to load dashboard data')
            }
        } catch (err) {
            console.error('Error fetching dashboard data:', err)
            setError(err.response?.data?.message || err.message || 'Failed to connect to server')
        } finally {
            setIsLoading(false)
        }
    }

    const openTenantSlideOver = (tenantId) => {
        setSelectedTenantId(tenantId)
        setIsSlideOverOpen(true)
    }

    const kpiCards = [
        {
            title: 'Total Schools',
            value: stats?.totalTenants || 0,
            icon: School,
            color: 'text-indigo-600',
            bgColor: 'bg-indigo-100',
            onClick: () => navigate('/super-admin/schools')
        },
        {
            title: 'Active Schools',
            value: stats?.activeTenants || 0,
            icon: CheckCircle2,
            color: 'text-green-600',
            bgColor: 'bg-green-100',
            onClick: () => navigate('/super-admin/schools?status=active')
        },
        {
            title: 'On Trial',
            value: stats?.trialTenants || 0,
            icon: Clock,
            color: 'text-blue-600',
            bgColor: 'bg-blue-100',
            onClick: () => navigate('/super-admin/schools?status=trial')
        },
        {
            title: 'Suspended',
            value: stats?.suspendedTenants || 0,
            icon: Ban,
            color: 'text-red-600',
            bgColor: 'bg-red-100',
            onClick: () => navigate('/super-admin/schools?status=suspended')
        },
        {
            title: 'Total Students',
            value: (stats?.totalStudents || 0).toLocaleString(),
            icon: Users,
            color: 'text-purple-600',
            bgColor: 'bg-purple-100',
            onClick: () => navigate('/super-admin/users?role=student')
        },
        {
            title: 'Monthly Revenue',
            value: formatCurrency(stats?.revenue?.monthly || 0),
            icon: IndianRupee,
            color: 'text-teal-600',
            bgColor: 'bg-teal-100',
            onClick: () => { }
        }
    ]

    const trendData = {
        labels: stats?.registrationsTrend?.labels || ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        datasets: [
            {
                label: 'New Registrations',
                data: stats?.registrationsTrend?.data || [0, 0, 0, 0, 0, 0],
                borderColor: '#00B894',
                backgroundColor: 'rgba(0, 184, 148, 0.1)',
                tension: 0.4,
                fill: true
            }
        ]
    }

    // Plan info mapping — matches updated backend plan IDs
    const planInfo = {
        free: { label: 'Free Trial', color: '#9CA3AF' },
        basic: { label: 'Basic', color: '#3B82F6' },
        pro: { label: 'Pro', color: '#8B5CF6' },
        enterprise: { label: 'Enterprise', color: '#F59E0B' },
        // Legacy keys for backwards compatibility
        free_trial: { label: 'Free Trial', color: '#9CA3AF' },
        premium: { label: 'Premium', color: '#8B5CF6' },
    }

    const getPlanChartData = () => {
        const breakdown = stats?.planBreakdown
        if (!breakdown) return { labels: [], datasets: [] }

        // Accept both array [{_id, count}] and object {plan: count} formats
        let items = []
        if (Array.isArray(breakdown)) {
            items = breakdown
        } else if (typeof breakdown === 'object') {
            items = Object.entries(breakdown).map(([_id, count]) => ({ _id, count }))
        }

        if (!items.length) return { labels: [], datasets: [] }

        const order = ['free', 'basic', 'pro', 'enterprise', 'free_trial', 'premium']
        const sorted = [...items].sort((a, b) => order.indexOf(a._id) - order.indexOf(b._id))

        return {
            labels: sorted.map(item => planInfo[item._id]?.label || item._id),
            datasets: [{
                data: sorted.map(item => item.count),
                backgroundColor: sorted.map(item => planInfo[item._id]?.color || '#cbd5e1'),
                borderWidth: 0,
            }]
        }
    }

    const getStatusBadge = (status) => {
        switch (status) {
            case 'active':
                return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">Active</span>
            case 'trial':
                return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">Trial</span>
            case 'suspended':
                return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">Suspended</span>
            case 'cancelled':
                return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">Cancelled</span>
            default:
                return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">{status}</span>
        }
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
            {/* Error Message */}
            {error && !stats && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4">
                    <div className="flex items-center">
                        <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
                        <p className="text-sm text-red-600">{error}</p>
                    </div>
                    <button
                        onClick={() => fetchDashboardData()}
                        className="mt-2 text-sm text-red-600 hover:text-red-800 underline flex items-center gap-1"
                    >
                        <RefreshCw className="h-3 w-3" /> Try again
                    </button>
                </div>
            )}

            {/* Stats grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                {isLoading ? (
                    [...Array(6)].map((_, i) => <CardSkeleton key={i} />)
                ) : (
                    kpiCards.map((stat, index) => (
                        <KpiCard
                            key={index}
                            title={stat.title}
                            value={stat.value}
                            Icon={stat.icon}
                            primaryLabel="View details"
                            onPrimary={stat.onClick}
                        />
                    ))
                )}
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5 lg:gap-6">
                {isLoading ? (
                    <>
                        <ChartSkeleton />
                        <ChartSkeleton />
                    </>
                ) : (
                    <>
                        <ChartCard
                            title="New Registrations Trend"
                            onExport={() => { }}
                            filterOptions={{}}
                        >
                            {() => (
                                <Line data={trendData} options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
                                }} />
                            )}
                        </ChartCard>

                        <ChartCard
                            title="Plan Distribution"
                            onExport={() => { }}
                            filterOptions={{}}
                        >
                            {() => (
                                <div className="flex items-center justify-center h-full relative">
                                    <Doughnut data={getPlanChartData()} options={{
                                        responsive: true,
                                        maintainAspectRatio: false,
                                        cutout: '70%',
                                        plugins: { legend: { position: 'right' } }
                                    }} />
                                </div>
                            )}
                        </ChartCard>
                    </>
                )}
            </div>

            {/* Recent Registrations Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center">
                    <h2 className="text-lg font-semibold text-gray-900">Recent Registrations</h2>
                    <button
                        onClick={() => navigate('/super-admin/schools')}
                        className="text-sm font-medium text-primary-600 hover:text-primary-700"
                    >
                        View all
                    </button>
                </div>

                <div className="overflow-x-auto">
                    {isLoading ? (
                        <div className="p-8 text-center text-gray-500">Loading...</div>
                    ) : !stats?.recentRegistrations?.length ? (
                        <div className="p-8 text-center text-gray-500">No recent registrations found</div>
                    ) : (
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">School Name</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Admin Email</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Plan</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Registered</th>
                                    <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {stats.recentRegistrations.map((tenant) => (
                                    <tr key={tenant._id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center">
                                                    <span className="text-primary-700 font-bold text-xs">{(tenant.schoolName || 'S').charAt(0).toUpperCase()}</span>
                                                </div>
                                                <div className="ml-3">
                                                    <p className="text-sm font-medium text-gray-900">{tenant.schoolName || 'Unnamed School'}</p>
                                                    <p className="text-xs text-gray-400">{tenant.schoolCode}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <p className="text-sm text-gray-600">{tenant.email || 'No email provided'}</p>
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
                                                onClick={() => openTenantSlideOver(tenant._id)}
                                                className="inline-flex items-center px-2.5 py-1.5 border border-primary-200 text-xs font-medium rounded text-primary-700 bg-primary-50 hover:bg-primary-100 transition-colors"
                                            >
                                                <Eye className="h-3.5 w-3.5 mr-1" />
                                                View
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Tenant Slide Over */}
            <TenantSlideOver
                isOpen={isSlideOverOpen}
                onClose={() => setIsSlideOverOpen(false)}
                tenantId={selectedTenantId}
                onUpdate={fetchDashboardData}
            />
        </div>
    )
}

export default SuperAdminDashboard
