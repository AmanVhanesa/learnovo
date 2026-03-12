import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    School,
    CheckCircle2,
    Ban,
    Users,
    IndianRupee,
    AlertTriangle,
    Eye,
    MoreVertical
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

            // Setup mock data for UI building if backend endpoint is unavailable
            if (process.env.NODE_ENV === 'development') {
                console.log("Using fallback mock data for Super Admin Dashboard UI")
                setStats({
                    counts: {
                        totalTenants: 45,
                        activeTenants: 38,
                        suspendedTenants: 2,
                        totalStudents: 12450,
                    },
                    revenueEstimate: {
                        monthly: 95000,
                        annual: 1140000
                    },
                    planBreakdown: [
                        { _id: 'free_trial', count: 12 },
                        { _id: 'basic', count: 15 },
                        { _id: 'premium', count: 10 },
                        { _id: 'enterprise', count: 8 }
                    ],
                    registrationsTrend: {
                        labels: ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'],
                        data: [4, 6, 8, 12, 10, 5]
                    },
                    recentRegistrations: [
                        { _id: '1', name: 'Springfield Academy', adminEmail: 'admin@springfield.edu', subscription: { plan: 'premium', status: 'active' }, createdAt: new Date(Date.now() - 86400000).toISOString() },
                        { _id: '2', name: 'Lincoln High', adminEmail: 'admin@lincolnhigh.org', subscription: { plan: 'free_trial', status: 'trial' }, createdAt: new Date(Date.now() - 172800000).toISOString() },
                        { _id: '3', name: 'Oakwood Elementary', adminEmail: 'admin@oakwood.edu', subscription: { plan: 'basic', status: 'active' }, createdAt: new Date(Date.now() - 259200000).toISOString() },
                        { _id: '4', name: 'Westside High', adminEmail: 'admin@westside.edu', subscription: { plan: 'enterprise', status: 'suspended' }, createdAt: new Date(Date.now() - 432000000).toISOString() },
                    ]
                })
            }
        } finally {
            setIsLoading(false)
        }
    }

    const kpiCards = [
        {
            title: 'Total Schools',
            value: stats?.counts?.totalTenants || 0,
            icon: School,
            color: 'text-indigo-600',
            bgColor: 'bg-indigo-100',
            onClick: () => navigate('/super-admin/schools')
        },
        {
            title: 'Active Tenants',
            value: stats?.counts?.activeTenants || 0,
            icon: CheckCircle2,
            color: 'text-green-600',
            bgColor: 'bg-green-100',
            onClick: () => navigate('/super-admin/schools?status=active')
        },
        {
            title: 'Suspended Accounts',
            value: stats?.counts?.suspendedTenants || 0,
            icon: Ban,
            color: 'text-red-600',
            bgColor: 'bg-red-100',
            onClick: () => navigate('/super-admin/schools?status=suspended')
        },
        {
            title: 'Total Students',
            value: (stats?.counts?.totalStudents || 0).toLocaleString(),
            icon: Users,
            color: 'text-blue-600',
            bgColor: 'bg-blue-100',
            onClick: () => navigate('/super-admin/users?role=student')
        },
        {
            title: 'Monthly Revenue',
            value: formatCurrency(stats?.revenueEstimate?.monthly || 0),
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

    // Map the plan strings to their display names and colors
    const planInfo = {
        free_trial: { label: 'Free Trial', color: '#9CA3AF' }, // gray
        basic: { label: 'Basic', color: '#3B82F6' }, // blue
        premium: { label: 'Premium', color: '#8B5CF6' }, // purple
        enterprise: { label: 'Enterprise', color: '#F59E0B' }, // gold
    }

    const getPlanChartData = () => {
        if (!stats?.planBreakdown || !Array.isArray(stats.planBreakdown)) return { labels: [], datasets: [] }

        // Sort logic to maintain standard order
        const order = ['free_trial', 'basic', 'premium', 'enterprise']
        const sortedBreakdown = [...stats.planBreakdown].sort((a, b) => order.indexOf(a._id) - order.indexOf(b._id))

        const labels = sortedBreakdown.map(item => planInfo[item._id]?.label || item._id)
        const data = sortedBreakdown.map(item => item.count)
        const bgColors = sortedBreakdown.map(item => planInfo[item._id]?.color || '#cbd5e1')

        return {
            labels,
            datasets: [
                {
                    data,
                    backgroundColor: bgColors,
                    borderWidth: 0,
                }
            ]
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
                        className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
                    >
                        Try again
                    </button>
                </div>
            )}

            {/* Stats grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                {isLoading ? (
                    [...Array(5)].map((_, i) => <CardSkeleton key={i} />)
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
                            filterOptions={{}} // No specific filters for super admin trend right now
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
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                        School Name
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                        Admin Email
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                        Plan
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                        Status
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                        Registered
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {stats.recentRegistrations.map((tenant) => (
                                    <tr key={tenant._id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center">
                                                    <span className="text-primary-700 font-bold text-xs">{(tenant.schoolName || tenant.organizationName || 'School').charAt(0).toUpperCase()}</span>
                                                </div>
                                                <div className="ml-3">
                                                    <p className="text-sm font-medium text-gray-900">{tenant.schoolName || tenant.organizationName || 'Unnamed School'}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <p className="text-sm text-gray-600">{tenant.email || tenant.adminEmail || 'No email provided'}</p>
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
                                            <div className="flex justify-end items-center space-x-2">
                                                <button
                                                    onClick={() => { }} // Will open slide-over in full implementation
                                                    className="inline-flex items-center px-2.5 py-1.5 border border-primary-200 text-xs font-medium rounded text-primary-700 bg-primary-50 hover:bg-primary-100 transition-colors"
                                                >
                                                    <Eye className="h-3.5 w-3.5 mr-1" />
                                                    View
                                                </button>
                                                <button className="text-gray-400 hover:text-gray-600">
                                                    <MoreVertical className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    )
}

export default SuperAdminDashboard
