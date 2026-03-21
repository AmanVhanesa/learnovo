import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
    School, CheckCircle2, Ban, Users, IndianRupee,
    AlertTriangle, Eye, Clock, Plus, Megaphone, BarChart3,
    TrendingUp, RefreshCw, Activity, Bell, Edit2, Pause
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

    const { data: healthData } = useQuery({
        queryKey: ['superadmin-system-health-mini'],
        queryFn: async () => { const res = await superAdminService.getSystemHealth(); return res.data },
        refetchInterval: 60000,
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
                <DashKpi icon={IndianRupee} title="Monthly Revenue" value={formatCurrency(stats?.revenue?.monthly)} subtitle={!stats?.revenue?.monthly ? 'No revenue yet' : undefined} color="teal" onClick={() => navigate('/super-admin/billing')} />
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
                            plugins: {
                                legend: { display: false },
                                tooltip: {
                                    backgroundColor: '#1e293b',
                                    cornerRadius: 8,
                                    padding: 10,
                                    callbacks: {
                                        title: (items) => items[0]?.label || '',
                                        label: (ctx) => `Registrations: ${ctx.raw}`
                                    }
                                }
                            },
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
                        <div className="w-44 h-44 sm:w-56 sm:h-56 relative">
                            <Doughnut data={planChartData} options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                cutout: '65%',
                                plugins: {
                                    legend: { position: 'bottom', labels: { padding: 16, font: { size: 11 }, usePointStyle: true, pointStyle: 'circle' } },
                                    tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${ctx.raw} (${((ctx.raw / (stats?.totalTenants || 1)) * 100).toFixed(0)}%)` } }
                                }
                            }} />
                            {/* Center text */}
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ top: '-12px' }}>
                                <span className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{stats?.totalTenants || 0}</span>
                                <span className="text-[10px] text-gray-400">Total</span>
                            </div>
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

            {/* System Health Mini Widget */}
            {healthData && (() => {
                const heapUsed = healthData.server?.memoryUsage?.heapUsed || 0
                const heapTotal = healthData.server?.memoryUsage?.heapTotal || 0
                const heapPct = heapTotal ? Math.round((heapUsed / heapTotal) * 100) : 0
                const isCritical = heapPct > 85
                const heapColor = heapPct > 90 ? '#EF4444' : heapPct > 80 ? '#F97316' : heapPct > 60 ? '#EAB308' : '#3EC4B1'
                return (
                    <div onClick={() => navigate('/super-admin/system')} className="card p-4 cursor-pointer hover:shadow-glass-md transition-shadow">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <Activity className="h-5 w-5 text-primary-500" />
                                <h3 className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base">System Health</h3>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${isCritical ? 'bg-red-500' : 'bg-emerald-500'} animate-pulse`} />
                                <span className={`text-xs font-medium ${isCritical ? 'text-red-600' : 'text-emerald-600'}`}>{isCritical ? 'Needs Attention' : 'Healthy'}</span>
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <p className="text-xs text-gray-500 dark:text-[#8E8E93]">Heap Memory</p>
                                <p className="text-sm font-bold text-gray-900 dark:text-white">{heapUsed} MB</p>
                                <div className="w-full bg-gray-100 dark:bg-[#2C2C2E] rounded-full h-1.5 mt-1">
                                    <div className="h-1.5 rounded-full transition-all" style={{ width: `${Math.min(100, heapPct)}%`, backgroundColor: heapColor }} />
                                </div>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 dark:text-[#8E8E93]">Uptime</p>
                                <p className="text-sm font-bold text-gray-900 dark:text-white">{(() => { const s = healthData.server?.uptime || 0; const d = Math.floor(s/86400); const h = Math.floor((s%86400)/3600); const m = Math.floor((s%3600)/60); return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m` })()}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 dark:text-[#8E8E93]">DB Size</p>
                                <p className="text-sm font-bold text-gray-900 dark:text-white">{healthData.database?.totalSize || 0} MB</p>
                            </div>
                        </div>
                    </div>
                )
            })()}

            {/* Trials Expiring Soon */}
            {stats?.recentRegistrations?.length > 0 && (() => {
                const now = new Date()
                const trialTenants = (stats.recentRegistrations || []).filter(t => {
                    if (t.subscription?.status !== 'trial') return false
                    const trialEnd = t.subscription?.trialEndDate ? new Date(t.subscription.trialEndDate) : null
                    if (!trialEnd) return false
                    const daysLeft = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24))
                    return daysLeft >= 0 && daysLeft <= 7
                })
                if (!trialTenants.length) return null
                return (
                    <div className="card overflow-hidden">
                        <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-100 dark:border-[#38383A]">
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 text-amber-500" />
                                <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Trials Expiring Soon</h2>
                                <span className="text-xs text-gray-400">(Next 7 days)</span>
                            </div>
                        </div>
                        <div className="divide-y divide-gray-50 dark:divide-[#38383A]">
                            {trialTenants.map(t => {
                                const trialEnd = new Date(t.subscription.trialEndDate)
                                const daysLeft = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24))
                                const urgencyColor = daysLeft <= 2 ? 'text-red-600 bg-red-50' : daysLeft <= 5 ? 'text-orange-600 bg-orange-50' : 'text-yellow-600 bg-yellow-50'
                                return (
                                    <div key={t._id} className="px-4 sm:px-5 py-3 flex items-center justify-between">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                                                <span className="text-primary-700 font-bold text-xs">{(t.schoolName || 'S').charAt(0).toUpperCase()}</span>
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{t.schoolName}</p>
                                                <p className="text-xs text-gray-400">Expires {trialEnd.toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${urgencyColor}`}>
                                                {daysLeft === 0 ? 'Today' : `${daysLeft}d left`}
                                            </span>
                                            <button className="inline-flex items-center px-2.5 py-1 border border-amber-200 text-xs font-medium rounded-lg text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors">
                                                <Bell className="h-3 w-3 mr-1" /> Remind
                                            </button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )
            })()}

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
                                    <th className="px-4 sm:px-5 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">School</th>
                                    <th className="px-4 sm:px-5 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Email</th>
                                    <th className="px-4 sm:px-5 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Plan</th>
                                    <th className="px-4 sm:px-5 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Status</th>
                                    <th className="px-4 sm:px-5 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Joined</th>
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
                                            <div className="flex items-center justify-end gap-1.5">
                                                <button
                                                    onClick={() => navigate('/super-admin/schools')}
                                                    className="inline-flex items-center px-2.5 py-1 border border-primary-200 text-xs font-medium rounded-lg text-primary-700 bg-primary-50 hover:bg-primary-100 transition-colors"
                                                >
                                                    <Eye className="h-3.5 w-3.5 mr-1" /> View
                                                </button>
                                                <button
                                                    onClick={() => navigate('/super-admin/schools')}
                                                    className="inline-flex items-center px-2 py-1 border border-gray-200 dark:border-[#38383A] text-xs font-medium rounded-lg text-gray-600 dark:text-[#8E8E93] hover:bg-gray-50 dark:hover:bg-[#2C2C2E] transition-colors"
                                                >
                                                    <Edit2 className="h-3 w-3" />
                                                </button>
                                                {t.subscription?.status !== 'suspended' && (
                                                    <button
                                                        onClick={() => navigate('/super-admin/schools')}
                                                        className="inline-flex items-center px-2 py-1 border border-red-200 text-xs font-medium rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                                                    >
                                                        <Pause className="h-3 w-3" />
                                                    </button>
                                                )}
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

const DashKpi = ({ icon: Icon, title, value, subtitle, color, onClick }) => {
    const colorMap = {
        indigo: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400',
        emerald: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400',
        red: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400',
        blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
        teal: 'bg-primary-50 dark:bg-[rgba(62,196,177,0.12)] text-primary-600 dark:text-[#3EC4B1]'
    }
    return (
        <div onClick={onClick} className="card p-3 sm:p-5 cursor-pointer hover:shadow-glass-md transition-shadow group">
            <div className="flex items-center gap-2 sm:gap-3">
                <div className={`p-2 sm:p-2.5 rounded-xl ${colorMap[color]} group-hover:scale-105 transition-transform flex-shrink-0`}>
                    <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
                <div className="min-w-0">
                    <p className="text-[10px] sm:text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider truncate">{title}</p>
                    <p className="text-base sm:text-xl font-bold text-gray-900 dark:text-white mt-0.5">{value}</p>
                    {subtitle && <p className="text-[10px] text-gray-400 dark:text-[#636366] truncate">{subtitle}</p>}
                </div>
            </div>
        </div>
    )
}

const StatusBadge = ({ status }) => {
    const colors = {
        active: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-[rgba(48,209,88,0.12)] dark:text-[#30D158] dark:ring-0',
        trial: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-[rgba(255,214,10,0.12)] dark:text-[#FFD60A] dark:ring-0',
        suspended: 'bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-[rgba(255,69,58,0.12)] dark:text-[#FF453A] dark:ring-0',
        cancelled: 'bg-gray-50 text-gray-600 ring-1 ring-gray-200 dark:bg-[rgba(142,142,147,0.12)] dark:text-[#8E8E93] dark:ring-0',
    }
    return (
        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${colors[status] || colors.cancelled}`}>
            {status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown'}
        </span>
    )
}

export default SuperAdminDashboard
