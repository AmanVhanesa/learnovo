import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
    School, CheckCircle2, Ban, Users, IndianRupee,
    AlertTriangle, Eye, Clock, Plus, Megaphone, BarChart3,
    TrendingUp, RefreshCw
} from 'lucide-react'
import { Line, Doughnut } from 'react-chartjs-2'
import {
    Chart as ChartJS, CategoryScale, LinearScale, PointElement,
    LineElement, ArcElement, Title, Tooltip, Legend, Filler
} from 'chart.js'
import { superAdminService } from '../../services/superAdminService'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ArcElement, Title, Tooltip, Legend, Filler)

const planInfo = {
    free: { label: 'Free Trial', color: '#9CA3AF' },
    basic: { label: 'Basic', color: '#3EC4B1' },
    pro: { label: 'Pro', color: '#2355A6' },
    enterprise: { label: 'Enterprise', color: '#7c3aed' }
}

const SuperAdminDashboard = () => {
    const navigate = useNavigate()

    const { data: stats, isLoading, error, refetch } = useQuery({
        queryKey: ['superadmin-dashboard'],
        queryFn: async () => {
            const res = await superAdminService.getDashboardStats()
            if (res?.success && res?.data) return res.data
            return null
        },
    })

    const formatCurrency = (amount) => `₹${(amount || 0).toLocaleString('en-IN')}`

    if (isLoading) {
        return (
            <div className="space-y-4 sm:space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
                    {[1,2,3,4,5].map(i => <div key={i} className="h-24 sm:h-28 bg-gray-200 dark:bg-[#2C2C2E] rounded-2xl animate-pulse" />)}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                    {[1,2].map(i => <div key={i} className="h-64 sm:h-72 bg-gray-200 dark:bg-[#2C2C2E] rounded-2xl animate-pulse" />)}
                </div>
                <div className="h-48 sm:h-64 bg-gray-200 dark:bg-[#2C2C2E] rounded-2xl animate-pulse" />
            </div>
        )
    }

    const trendData = {
        labels: stats?.registrationsTrend?.labels || [],
        datasets: [{
            label: 'New Registrations',
            data: stats?.registrationsTrend?.data || [],
            borderColor: '#3EC4B1',
            backgroundColor: 'rgba(62, 196, 177, 0.1)',
            tension: 0.4,
            fill: true,
            pointRadius: 4,
            pointBackgroundColor: '#3EC4B1'
        }]
    }

    const planChartData = {
        labels: (stats?.planBreakdown || []).map(p => planInfo[p._id]?.label || p._id),
        datasets: [{
            data: (stats?.planBreakdown || []).map(p => p.count),
            backgroundColor: (stats?.planBreakdown || []).map(p => planInfo[p._id]?.color || '#cbd5e1'),
            borderWidth: 0
        }]
    }

    return (
        <div className="space-y-4 sm:space-y-6">
            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 sm:p-4 flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                        <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
                        <p className="text-sm text-red-600 dark:text-red-400 truncate">{error.response?.data?.message || error.message || 'Failed to connect to server'}</p>
                    </div>
                    <button onClick={() => refetch()} className="text-red-600 hover:text-red-800 flex-shrink-0">
                        <RefreshCw className="h-4 w-4" />
                    </button>
                </div>
            )}

            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
                <DashKpi icon={School} title="Total Schools" value={stats?.totalTenants || 0} color="indigo" onClick={() => navigate('/super-admin/schools')} />
                <DashKpi icon={CheckCircle2} title="Active Tenants" value={stats?.activeTenants || 0} color="emerald" onClick={() => navigate('/super-admin/schools')} />
                <DashKpi icon={Ban} title="Suspended" value={stats?.suspendedTenants || 0} color="red" onClick={() => navigate('/super-admin/schools')} />
                <DashKpi icon={Users} title="Total Students" value={(stats?.totalStudents || 0).toLocaleString()} color="blue" onClick={() => navigate('/super-admin/users')} />
                <DashKpi icon={IndianRupee} title="Monthly Revenue" value={formatCurrency(stats?.revenue?.monthly)} color="teal" onClick={() => navigate('/super-admin/billing')} />
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-2 sm:gap-3">
                <button onClick={() => navigate('/super-admin/schools')} className="btn btn-primary flex items-center gap-2 text-sm w-full sm:w-auto">
                    <Plus className="h-4 w-4" /> Add Tenant
                </button>
                <button onClick={() => navigate('/super-admin/communication')} className="btn btn-outline flex items-center gap-2 text-sm w-full sm:w-auto">
                    <Megaphone className="h-4 w-4" /> Send Announcement
                </button>
                <button onClick={() => navigate('/super-admin/reports')} className="btn btn-outline flex items-center gap-2 text-sm w-full sm:w-auto">
                    <BarChart3 className="h-4 w-4" /> View Reports
                </button>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                <div className="card p-4 sm:p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <TrendingUp className="h-5 w-5 text-primary-500" />
                        <h3 className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base">Registration Trend</h3>
                    </div>
                    <div className="h-48 sm:h-64">
                        <Line data={trendData} options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1e293b', cornerRadius: 8 } },
                            scales: {
                                x: { grid: { display: false }, ticks: { font: { size: 11 } } },
                                y: { grid: { color: '#f1f5f9' }, beginAtZero: true, ticks: { precision: 0, font: { size: 11 } } }
                            }
                        }} />
                    </div>
                </div>

                <div className="card p-4 sm:p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <School className="h-5 w-5 text-primary-500" />
                        <h3 className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base">Plan Distribution</h3>
                    </div>
                    <div className="h-48 sm:h-64 flex items-center justify-center">
                        <div className="w-44 h-44 sm:w-56 sm:h-56">
                            <Doughnut data={planChartData} options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                cutout: '65%',
                                plugins: { legend: { position: 'bottom', labels: { padding: 16, font: { size: 11 }, usePointStyle: true, pointStyle: 'circle' } } }
                            }} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Additional Stats Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <div className="card p-4 flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600"><Users className="h-5 w-5" /></div>
                    <div>
                        <p className="text-xs text-gray-500 dark:text-[#8E8E93]">Total Teachers</p>
                        <p className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">{(stats?.totalTeachers || 0).toLocaleString()}</p>
                    </div>
                </div>
                <div className="card p-4 flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-600"><Users className="h-5 w-5" /></div>
                    <div>
                        <p className="text-xs text-gray-500 dark:text-[#8E8E93]">Total Users</p>
                        <p className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">{(stats?.totalUsers || 0).toLocaleString()}</p>
                    </div>
                </div>
                <div className="card p-4 flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-600"><Clock className="h-5 w-5" /></div>
                    <div>
                        <p className="text-xs text-gray-500 dark:text-[#8E8E93]">Trial Tenants</p>
                        <p className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">{stats?.trialTenants || 0}</p>
                    </div>
                </div>
            </div>

            {/* Recent Registrations */}
            <div className="card overflow-hidden">
                <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-100 dark:border-[#38383A] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Recent Registrations</h2>
                    <button onClick={() => navigate('/super-admin/schools')} className="text-sm font-medium text-primary-600 hover:text-primary-700">
                        View all
                    </button>
                </div>
                <div className="overflow-x-auto">
                    {!stats?.recentRegistrations?.length ? (
                        <div className="p-8 text-center text-gray-400 dark:text-[#636366]">
                            <School className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                            <p>No recent registrations</p>
                        </div>
                    ) : (
                        <table className="w-full min-w-[640px]">
                            <thead>
                                <tr className="bg-gray-50 dark:bg-[#2C2C2E] border-b border-gray-100 dark:border-[#38383A]">
                                    <th className="px-4 sm:px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-[#8E8E93] uppercase">School</th>
                                    <th className="px-4 sm:px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-[#8E8E93] uppercase">Email</th>
                                    <th className="px-4 sm:px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-[#8E8E93] uppercase">Plan</th>
                                    <th className="px-4 sm:px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-[#8E8E93] uppercase">Status</th>
                                    <th className="px-4 sm:px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-[#8E8E93] uppercase">Joined</th>
                                    <th className="px-4 sm:px-5 py-3 text-right text-xs font-semibold text-gray-500 dark:text-[#8E8E93] uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 dark:divide-[#38383A]">
                                {stats.recentRegistrations.map((t) => (
                                    <tr key={t._id} className="hover:bg-gray-50 dark:hover:bg-[#2C2C2E] transition-colors">
                                        <td className="px-4 sm:px-5 py-3">
                                            <div className="flex items-center gap-2.5">
                                                <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                                                    <span className="text-primary-700 font-bold text-xs">{(t.schoolName || 'S').charAt(0).toUpperCase()}</span>
                                                </div>
                                                <span className="text-sm font-medium text-gray-900 dark:text-white">{t.schoolName || 'Unnamed'}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 sm:px-5 py-3 text-sm text-gray-500 dark:text-[#8E8E93]">{t.email || '-'}</td>
                                        <td className="px-4 sm:px-5 py-3">
                                            <div className="flex items-center gap-1.5">
                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: planInfo[t.subscription?.plan]?.color || '#9CA3AF' }} />
                                                <span className="text-sm text-gray-700 dark:text-[#8E8E93]">{planInfo[t.subscription?.plan]?.label || t.subscription?.plan}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 sm:px-5 py-3">
                                            <StatusBadge status={t.subscription?.status} />
                                        </td>
                                        <td className="px-4 sm:px-5 py-3 text-sm text-gray-500 dark:text-[#8E8E93]">{new Date(t.createdAt).toLocaleDateString()}</td>
                                        <td className="px-4 sm:px-5 py-3 text-right">
                                            <button
                                                onClick={() => navigate('/super-admin/schools')}
                                                className="inline-flex items-center px-2.5 py-1 border border-primary-200 text-xs font-medium rounded-lg text-primary-700 bg-primary-50 hover:bg-primary-100 transition-colors"
                                            >
                                                <Eye className="h-3.5 w-3.5 mr-1" /> View
                                            </button>
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

const DashKpi = ({ icon: Icon, title, value, color, onClick }) => {
    const colorMap = {
        indigo: 'bg-indigo-50 text-indigo-600',
        emerald: 'bg-emerald-50 text-emerald-600',
        red: 'bg-red-50 text-red-600',
        blue: 'bg-blue-50 text-blue-600',
        teal: 'bg-primary-50 text-primary-600'
    }
    return (
        <div onClick={onClick} className="card p-3 sm:p-5 cursor-pointer hover:shadow-glass-md transition-shadow group">
            <div className="flex items-center gap-2 sm:gap-3">
                <div className={`p-2 sm:p-2.5 rounded-xl ${colorMap[color]} group-hover:scale-105 transition-transform flex-shrink-0`}>
                    <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
                <div className="min-w-0">
                    <p className="text-[10px] sm:text-xs font-medium text-gray-500 dark:text-[#8E8E93] truncate">{title}</p>
                    <p className="text-base sm:text-xl font-bold text-gray-900 dark:text-white mt-0.5">{value}</p>
                </div>
            </div>
        </div>
    )
}

const StatusBadge = ({ status }) => {
    const colors = {
        active: 'bg-emerald-100 text-emerald-700',
        trial: 'bg-blue-100 text-blue-700',
        suspended: 'bg-red-100 text-red-700',
        cancelled: 'bg-gray-100 text-gray-500'
    }
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${colors[status] || 'bg-gray-100 text-gray-500'}`}>
            {status}
        </span>
    )
}

export default SuperAdminDashboard
