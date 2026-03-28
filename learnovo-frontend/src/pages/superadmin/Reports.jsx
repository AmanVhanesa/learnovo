import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
    Building2, TrendingUp, Users, IndianRupee, Calculator,
    UserMinus, ArrowRightCircle, Download, RefreshCw, AlertTriangle,
    ChevronLeft, ChevronRight, ArrowUpDown, BarChart3, FileSpreadsheet,
    Calendar
} from 'lucide-react'
import { Line, Bar, Doughnut } from 'react-chartjs-2'
import {
    Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement,
    LineElement, ArcElement, Title, Tooltip, Legend, Filler
} from 'chart.js'
import toast from 'react-hot-toast'
import { superAdminService } from '../../services/superAdminService'
import { formatDate } from '../../utils/formatDate'

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Title, Tooltip, Legend, Filler)

const PERIOD_OPTIONS = [
    { label: '7d', value: '7d' },
    { label: '30d', value: '30d' },
    { label: '90d', value: '90d' },
    { label: '12m', value: '12m' },
]

const planInfo = {
    free: { label: 'Free Trial', color: '#9CA3AF' },
    basic: { label: 'Basic', color: '#3EC4B1' },
    pro: { label: 'Pro', color: '#2355A6' },
    enterprise: { label: 'Enterprise', color: '#7c3aed' },
}

const formatCurrency = (amount) => `₹${(amount || 0).toLocaleString('en-IN')}`

const monthName = (m) => ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][(m || 1) - 1] || ''

const Reports = () => {
    const [period, setPeriod] = useState('30d')
    const [customRange, setCustomRange] = useState({ startDate: '', endDate: '' })
    const [isCustom, setIsCustom] = useState(false)
    const [activityPage, setActivityPage] = useState(1)
    const [activitySort, setActivitySort] = useState({ field: 'lastActive', dir: 'desc' })

    const dateParams = useMemo(() => {
        if (isCustom && customRange.startDate && customRange.endDate) {
            return { startDate: customRange.startDate, endDate: customRange.endDate }
        }
        return { period }
    }, [period, isCustom, customRange])

    // ─── Queries ─────────────────────────────────────────────────────────────
    const { data: overview, isLoading: overviewLoading, error: overviewError, refetch: refetchOverview } = useQuery({
        queryKey: ['reports-overview', dateParams],
        queryFn: async () => {
            const res = await superAdminService.getReportsOverview(dateParams)
            return res?.data || res
        },
    })

    const { data: activityData, isLoading: activityLoading } = useQuery({
        queryKey: ['reports-school-activity', dateParams, activityPage, activitySort],
        queryFn: async () => {
            const res = await superAdminService.getSchoolActivityReport({
                ...dateParams,
                page: activityPage,
                limit: 10,
                sortBy: activitySort.field,
                sortOrder: activitySort.dir,
            })
            return res
        },
    })

    const { data: revenueData, isLoading: revenueLoading } = useQuery({
        queryKey: ['reports-revenue', dateParams],
        queryFn: async () => {
            const res = await superAdminService.getRevenueReport(dateParams)
            return res?.data || res
        },
    })

    const { data: funnelData, isLoading: funnelLoading } = useQuery({
        queryKey: ['reports-funnel', dateParams],
        queryFn: async () => {
            const res = await superAdminService.getTrialConversionFunnel(dateParams)
            return res?.data || res
        },
    })

    // ─── Detect dark mode ────────────────────────────────────────────────────
    const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
    const gridColor = isDark ? 'rgba(255,255,255,0.1)' : '#f1f5f9'
    const tickColor = isDark ? '#8E8E93' : '#6b7280'

    // ─── Export ──────────────────────────────────────────────────────────────
    const handleExport = async (type, format) => {
        try {
            const blob = await superAdminService.exportReport(type, { ...dateParams, format })
            const url = window.URL.createObjectURL(new Blob([blob]))
            const link = document.createElement('a')
            link.href = url
            link.setAttribute('download', `${type}-report.${format === 'excel' ? 'xlsx' : format}`)
            document.body.appendChild(link)
            link.click()
            link.remove()
            window.URL.revokeObjectURL(url)
            toast.success('Report exported')
        } catch {
            toast.error('Export failed')
        }
    }

    // ─── Chart Data ──────────────────────────────────────────────────────────
    const growthChartData = useMemo(() => {
        const trend = overview?.tenantGrowth || []
        const sorted = [...trend].sort((a, b) => {
            const ka = (a._id?.year || 0) * 100 + (a._id?.month || 0)
            const kb = (b._id?.year || 0) * 100 + (b._id?.month || 0)
            return ka - kb
        })
        return {
            labels: sorted.map(d => `${monthName(d._id?.month)} ${d._id?.year || ''}`),
            datasets: [{
                label: 'New Schools',
                data: sorted.map(d => d.count),
                borderColor: 'rgb(62, 196, 177)',
                backgroundColor: 'rgba(62, 196, 177, 0.1)',
                tension: 0.4,
                fill: true,
                pointRadius: 4,
                pointBackgroundColor: 'rgb(62, 196, 177)',
            }],
        }
    }, [overview])

    const revenueChartData = useMemo(() => {
        const monthly = overview?.monthlyRevenue || []
        const sorted = [...monthly].sort((a, b) => {
            const ka = (a._id?.year || 0) * 100 + (a._id?.month || 0)
            const kb = (b._id?.year || 0) * 100 + (b._id?.month || 0)
            return ka - kb
        })
        return {
            labels: sorted.map(d => `${monthName(d._id?.month)} ${d._id?.year || ''}`),
            datasets: [{
                label: 'Revenue',
                data: sorted.map(d => d.total),
                backgroundColor: 'rgba(62, 196, 177, 0.7)',
                borderColor: 'rgb(62, 196, 177)',
                borderWidth: 1,
                borderRadius: 6,
            }],
        }
    }, [overview])

    const planChartData = useMemo(() => {
        const plans = overview?.revenueByPlan || []
        return {
            labels: plans.map(p => planInfo[p._id]?.label || p._id),
            datasets: [{
                data: plans.map(p => p.count),
                backgroundColor: plans.map(p => planInfo[p._id]?.color || '#cbd5e1'),
                borderWidth: 0,
            }],
        }
    }, [overview])

    const totalPlans = (overview?.revenueByPlan || []).reduce((s, p) => s + p.count, 0)

    // ─── Sort handler ────────────────────────────────────────────────────────
    const handleSort = (field) => {
        setActivitySort(prev =>
            prev.field === field
                ? { field, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
                : { field, dir: 'desc' }
        )
        setActivityPage(1)
    }

    // ─── Loading skeleton ────────────────────────────────────────────────────
    if (overviewLoading && !overview) {
        return (
            <div className="space-y-4 sm:space-y-6">
                <div className="flex justify-between items-center">
                    <div className="h-7 w-48 bg-gray-200/60 rounded-xl animate-pulse dark:bg-[#2C2C2E]" />
                    <div className="h-10 w-64 bg-gray-200/60 rounded-xl animate-pulse dark:bg-[#2C2C2E]" />
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    {[1,2,3,4,5,6,7].map(i => (
                        <div key={i} className="h-24 sm:h-28 bg-gray-200/60 rounded-2xl animate-pulse dark:bg-[#2C2C2E]" />
                    ))}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                    {[1,2,3,4].map(i => (
                        <div key={i} className="h-64 sm:h-72 bg-gray-200/60 rounded-2xl animate-pulse dark:bg-[#2C2C2E]" />
                    ))}
                </div>
                <div className="h-64 bg-gray-200/60 rounded-2xl animate-pulse dark:bg-[#2C2C2E]" />
            </div>
        )
    }

    // ─── Error state ─────────────────────────────────────────────────────────
    if (overviewError && !overview) {
        return (
            <div className="space-y-4 sm:space-y-6">
                <div className="card p-8 sm:p-12 text-center">
                    <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-red-400" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Failed to load reports</h3>
                    <p className="text-sm text-gray-500 dark:text-[#8E8E93] mb-4">
                        {overviewError.response?.data?.message || overviewError.message || 'Something went wrong'}
                    </p>
                    <button onClick={() => refetchOverview()} className="btn btn-primary inline-flex items-center gap-2">
                        <RefreshCw className="h-4 w-4" /> Retry
                    </button>
                </div>
            </div>
        )
    }

    const schoolActivity = activityData?.data || []
    const activityPages = activityData?.pagination?.pages || 1
    const revenueByMonth = revenueData?.byMonth || []
    const funnel = funnelData || {}

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* ─── Date Range Filter ──────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-primary-500" />
                    <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">Reports & Analytics</h1>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {PERIOD_OPTIONS.map(opt => (
                        <button
                            key={opt.value}
                            onClick={() => { setPeriod(opt.value); setIsCustom(false) }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                                !isCustom && period === opt.value
                                    ? 'bg-primary-500 text-white'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-[#2C2C2E] dark:text-[#8E8E93] dark:hover:bg-[#38383A]'
                            }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                    <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-gray-400" />
                        <input
                            type="date"
                            value={customRange.startDate}
                            onChange={(e) => { setCustomRange(p => ({ ...p, startDate: e.target.value })); setIsCustom(true) }}
                            className="input w-32 text-xs py-1.5"
                        />
                        <span className="text-xs text-gray-400">to</span>
                        <input
                            type="date"
                            value={customRange.endDate}
                            onChange={(e) => { setCustomRange(p => ({ ...p, endDate: e.target.value })); setIsCustom(true) }}
                            className="input w-32 text-xs py-1.5"
                        />
                    </div>
                </div>
            </div>

            {/* ─── Section 1: Overview Cards ──────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <KpiCard
                    icon={Building2}
                    label="Total Active Schools"
                    value={overview?.totalActiveSchools || 0}
                    iconBg="bg-teal-50 dark:bg-teal-900/30"
                    iconColor="text-teal-600"
                />
                <KpiCard
                    icon={TrendingUp}
                    label="New Schools"
                    value={overview?.newSchools || 0}
                    change={overview?.newSchoolsChange}
                    iconBg="bg-blue-50 dark:bg-blue-900/30"
                    iconColor="text-blue-600"
                />
                <KpiCard
                    icon={Users}
                    label="Total Students"
                    value={(overview?.totalStudents || 0).toLocaleString()}
                    iconBg="bg-purple-50 dark:bg-purple-900/30"
                    iconColor="text-purple-600"
                />
                <KpiCard
                    icon={IndianRupee}
                    label="Total Revenue"
                    value={formatCurrency(overview?.totalRevenue)}
                    iconBg="bg-emerald-50 dark:bg-emerald-900/30"
                    iconColor="text-emerald-600"
                />
                <KpiCard
                    icon={Calculator}
                    label="Avg Revenue / School"
                    value={formatCurrency(overview?.avgRevenuePerSchool)}
                    iconBg="bg-cyan-50 dark:bg-cyan-900/30"
                    iconColor="text-cyan-600"
                />
                <KpiCard
                    icon={UserMinus}
                    label="Churn Rate"
                    value={`${(overview?.churnRate || 0).toFixed(1)}%`}
                    iconBg="bg-red-50 dark:bg-red-900/30"
                    iconColor="text-red-600"
                />
                <KpiCard
                    icon={ArrowRightCircle}
                    label="Trial → Paid"
                    value={`${(overview?.trialConversionRate || 0).toFixed(1)}%`}
                    iconBg="bg-amber-50 dark:bg-amber-900/30"
                    iconColor="text-amber-600"
                />
            </div>

            {/* ─── Section 2: Charts ──────────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                {/* School Growth */}
                <div className="card p-4 sm:p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <TrendingUp className="h-5 w-5 text-primary-500" />
                        <h3 className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base">School Growth</h3>
                    </div>
                    {growthChartData.labels.length === 0 ? (
                        <EmptyChart message="No growth data for this period" />
                    ) : (
                        <div className="h-48 sm:h-64">
                            <Line data={growthChartData} options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: {
                                    legend: { display: false },
                                    tooltip: { backgroundColor: '#1e293b', cornerRadius: 8, padding: 10 },
                                },
                                scales: {
                                    x: { grid: { display: false }, ticks: { font: { size: 11 }, color: tickColor } },
                                    y: { grid: { color: gridColor }, beginAtZero: true, ticks: { precision: 0, font: { size: 11 }, color: tickColor } },
                                },
                            }} />
                        </div>
                    )}
                </div>

                {/* Revenue by Month */}
                <div className="card p-4 sm:p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <IndianRupee className="h-5 w-5 text-primary-500" />
                        <h3 className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base">Revenue by Month</h3>
                    </div>
                    {revenueChartData.labels.length === 0 ? (
                        <EmptyChart message="No revenue data for this period" />
                    ) : (
                        <div className="h-48 sm:h-64">
                            <Bar data={revenueChartData} options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: {
                                    legend: { display: false },
                                    tooltip: {
                                        backgroundColor: '#1e293b',
                                        cornerRadius: 8,
                                        padding: 10,
                                        callbacks: { label: (ctx) => `Revenue: ${formatCurrency(ctx.raw)}` },
                                    },
                                },
                                scales: {
                                    x: { grid: { display: false }, ticks: { font: { size: 11 }, color: tickColor } },
                                    y: { grid: { color: gridColor }, beginAtZero: true, ticks: { font: { size: 11 }, color: tickColor, callback: (v) => `₹${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}` } },
                                },
                            }} />
                        </div>
                    )}
                </div>

                {/* Plan Distribution */}
                <div className="card p-4 sm:p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <Building2 className="h-5 w-5 text-primary-500" />
                        <h3 className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base">Plan Distribution</h3>
                    </div>
                    {planChartData.labels.length === 0 ? (
                        <EmptyChart message="No plan data available" />
                    ) : (
                        <div className="h-48 sm:h-64 flex items-center justify-center">
                            <div className="w-44 h-44 sm:w-56 sm:h-56 relative">
                                <Doughnut data={planChartData} options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    cutout: '65%',
                                    plugins: {
                                        legend: {
                                            position: 'bottom',
                                            labels: { padding: 16, font: { size: 11 }, usePointStyle: true, pointStyle: 'circle', color: tickColor },
                                        },
                                        tooltip: {
                                            callbacks: {
                                                label: (ctx) => `${ctx.label}: ${ctx.raw} (${totalPlans ? ((ctx.raw / totalPlans) * 100).toFixed(0) : 0}%)`,
                                            },
                                        },
                                    },
                                }} />
                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ top: '-12px' }}>
                                    <span className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{totalPlans}</span>
                                    <span className="text-[10px] text-gray-400">Total</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Trial Conversion Funnel */}
                <div className="card p-4 sm:p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <ArrowRightCircle className="h-5 w-5 text-primary-500" />
                        <h3 className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base">Trial Conversion Funnel</h3>
                    </div>
                    {funnelLoading ? (
                        <div className="space-y-4 py-4">
                            {[1,2,3,4].map(i => (
                                <div key={i} className="h-10 bg-gray-200/60 rounded-xl animate-pulse dark:bg-[#2C2C2E]" />
                            ))}
                        </div>
                    ) : !funnel.signedUp && !funnel.completedTrial && !funnel.convertedToPaid ? (
                        <EmptyChart message="No trial data for this period" />
                    ) : (
                        <FunnelVisualization data={funnel} />
                    )}
                </div>
            </div>

            {/* ─── Section 3: School Activity Report ──────────────────────────── */}
            <div className="card overflow-hidden">
                <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-100 dark:border-[#38383A] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">School Activity Report</h2>
                    <button
                        onClick={() => handleExport('school-activity', 'csv')}
                        className="btn btn-outline btn-sm inline-flex items-center gap-1.5 text-xs"
                    >
                        <Download className="h-3.5 w-3.5" /> Export CSV
                    </button>
                </div>
                {activityLoading ? (
                    <div className="p-4 space-y-3">
                        {[1,2,3,4,5].map(i => (
                            <div key={i} className="h-12 bg-gray-200/60 rounded-xl animate-pulse dark:bg-[#2C2C2E]" />
                        ))}
                    </div>
                ) : schoolActivity.length === 0 ? (
                    <div className="p-8 text-center text-gray-400 dark:text-[#636366]">
                        <Building2 className="h-10 w-10 mx-auto mb-2 text-gray-300 dark:text-[#48484A]" />
                        <p className="text-sm">No school activity data found</p>
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[700px]">
                                <thead>
                                    <tr className="bg-gray-50/80 dark:bg-[#2C2C2E]">
                                        {[
                                            { key: 'schoolName', label: 'School Name' },
                                            { key: 'plan', label: 'Plan' },
                                            { key: 'students', label: 'Students' },
                                            { key: 'teachers', label: 'Teachers' },
                                            { key: 'lastActive', label: 'Last Active' },
                                            { key: 'status', label: 'Status' },
                                        ].map(col => (
                                            <th
                                                key={col.key}
                                                onClick={() => handleSort(col.key)}
                                                className="px-4 sm:px-5 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700 dark:text-[#8E8E93] dark:hover:text-white transition-colors"
                                            >
                                                <span className="inline-flex items-center gap-1">
                                                    {col.label}
                                                    <ArrowUpDown className={`h-3 w-3 ${activitySort.field === col.key ? 'text-primary-500' : 'text-gray-300 dark:text-[#48484A]'}`} />
                                                </span>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50 dark:divide-[#38383A]">
                                    {schoolActivity.map((row, idx) => (
                                        <tr key={row._id || idx} className="hover:bg-primary-50 dark:hover:bg-[#2C2C2E] transition-colors">
                                            <td className="px-4 sm:px-5 py-3">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="h-7 w-7 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
                                                        <span className="text-primary-700 dark:text-primary-400 font-bold text-[10px]">{(row.schoolName || 'S').charAt(0).toUpperCase()}</span>
                                                    </div>
                                                    <span className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white">{row.schoolName || 'Unnamed'}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 sm:px-5 py-3">
                                                <div className="flex items-center gap-1.5">
                                                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: planInfo[row.plan]?.color || '#9CA3AF' }} />
                                                    <span className="text-xs sm:text-sm text-gray-700 dark:text-white">{planInfo[row.plan]?.label || row.plan || '-'}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 sm:px-5 py-3 text-xs sm:text-sm text-gray-700 dark:text-white">{(row.students || 0).toLocaleString()}</td>
                                            <td className="px-4 sm:px-5 py-3 text-xs sm:text-sm text-gray-700 dark:text-white">{(row.teachers || 0).toLocaleString()}</td>
                                            <td className="px-4 sm:px-5 py-3 text-xs sm:text-sm text-gray-700 dark:text-white">
                                                {row.lastActive ? formatDate(row.lastActive) : '-'}
                                            </td>
                                            <td className="px-4 sm:px-5 py-3">
                                                <StatusBadge status={row.status} />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {activityPages > 1 && (
                            <div className="px-4 sm:px-5 py-3 border-t border-gray-100 dark:border-[#38383A] flex items-center justify-between">
                                <p className="text-xs text-gray-500 dark:text-[#8E8E93]">Page {activityPage} of {activityPages}</p>
                                <div className="flex items-center gap-1.5">
                                    <button
                                        onClick={() => setActivityPage(p => Math.max(1, p - 1))}
                                        disabled={activityPage <= 1}
                                        className="btn btn-sm btn-outline p-1.5 disabled:opacity-40"
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                    </button>
                                    <button
                                        onClick={() => setActivityPage(p => Math.min(activityPages, p + 1))}
                                        disabled={activityPage >= activityPages}
                                        className="btn btn-sm btn-outline p-1.5 disabled:opacity-40"
                                    >
                                        <ChevronRight className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* ─── Section 4: Revenue Report ──────────────────────────────────── */}
            <div className="card overflow-hidden">
                <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-100 dark:border-[#38383A] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Revenue Breakdown</h2>
                    <button
                        onClick={() => handleExport('revenue', 'excel')}
                        className="btn btn-outline btn-sm inline-flex items-center gap-1.5 text-xs"
                    >
                        <FileSpreadsheet className="h-3.5 w-3.5" /> Export Excel
                    </button>
                </div>
                {revenueLoading ? (
                    <div className="p-4 space-y-3">
                        {[1,2,3,4].map(i => (
                            <div key={i} className="h-10 bg-gray-200/60 rounded-xl animate-pulse dark:bg-[#2C2C2E]" />
                        ))}
                    </div>
                ) : revenueByMonth.length === 0 ? (
                    <div className="p-8 text-center text-gray-400 dark:text-[#636366]">
                        <IndianRupee className="h-10 w-10 mx-auto mb-2 text-gray-300 dark:text-[#48484A]" />
                        <p className="text-sm">No revenue data available</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[640px]">
                            <thead>
                                <tr className="bg-gray-50/80 dark:bg-[#2C2C2E]">
                                    <th className="px-4 sm:px-5 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider dark:text-[#8E8E93]">Month</th>
                                    <th className="px-4 sm:px-5 py-3 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider dark:text-[#8E8E93]">Free Trial</th>
                                    <th className="px-4 sm:px-5 py-3 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider dark:text-[#8E8E93]">Basic</th>
                                    <th className="px-4 sm:px-5 py-3 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider dark:text-[#8E8E93]">Pro</th>
                                    <th className="px-4 sm:px-5 py-3 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider dark:text-[#8E8E93]">Enterprise</th>
                                    <th className="px-4 sm:px-5 py-3 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider dark:text-[#8E8E93]">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 dark:divide-[#38383A]">
                                {revenueByMonth.map((row, idx) => {
                                    const total = (row.free || 0) + (row.basic || 0) + (row.pro || 0) + (row.enterprise || 0)
                                    return (
                                        <tr key={idx} className="hover:bg-primary-50 dark:hover:bg-[#2C2C2E] transition-colors">
                                            <td className="px-4 sm:px-5 py-3 text-xs sm:text-sm font-medium text-gray-900 dark:text-white">{row.month || '-'}</td>
                                            <td className="px-4 sm:px-5 py-3 text-xs sm:text-sm text-gray-700 dark:text-white text-right">{formatCurrency(row.free)}</td>
                                            <td className="px-4 sm:px-5 py-3 text-xs sm:text-sm text-gray-700 dark:text-white text-right">{formatCurrency(row.basic)}</td>
                                            <td className="px-4 sm:px-5 py-3 text-xs sm:text-sm text-gray-700 dark:text-white text-right">{formatCurrency(row.pro)}</td>
                                            <td className="px-4 sm:px-5 py-3 text-xs sm:text-sm text-gray-700 dark:text-white text-right">{formatCurrency(row.enterprise)}</td>
                                            <td className="px-4 sm:px-5 py-3 text-xs sm:text-sm font-semibold text-gray-900 dark:text-white text-right">{formatCurrency(row.total || total)}</td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                            <tfoot>
                                <tr className="bg-gray-50/80 dark:bg-[#2C2C2E] border-t border-gray-200 dark:border-[#38383A]">
                                    <td className="px-4 sm:px-5 py-3 text-xs sm:text-sm font-bold text-gray-900 dark:text-white">MRR (Latest)</td>
                                    <td colSpan={4} />
                                    <td className="px-4 sm:px-5 py-3 text-xs sm:text-sm font-bold text-primary-600 dark:text-primary-400 text-right">
                                        {formatCurrency(
                                            revenueByMonth.length > 0
                                                ? (revenueByMonth[revenueByMonth.length - 1].total ||
                                                   (revenueByMonth[revenueByMonth.length - 1].free || 0) +
                                                   (revenueByMonth[revenueByMonth.length - 1].basic || 0) +
                                                   (revenueByMonth[revenueByMonth.length - 1].pro || 0) +
                                                   (revenueByMonth[revenueByMonth.length - 1].enterprise || 0))
                                                : 0
                                        )}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}
            </div>
        </div>
    )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

const KpiCard = ({ icon: Icon, label, value, change, iconBg, iconColor }) => (
    <div className="card p-4 sm:p-5">
        <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${iconBg} flex-shrink-0`}>
                <Icon className={`h-5 w-5 ${iconColor}`} />
            </div>
            <div className="min-w-0">
                <p className="text-[10px] sm:text-xs font-medium text-gray-500 dark:text-[#8E8E93] truncate">{label}</p>
                <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-base sm:text-xl font-bold text-gray-900 dark:text-white">{value}</p>
                    {change !== undefined && change !== null && (
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${
                            change >= 0
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-[rgba(48,209,88,0.12)] dark:text-[#30D158]'
                                : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                        }`}>
                            {change >= 0 ? '+' : ''}{change.toFixed(1)}%
                        </span>
                    )}
                </div>
            </div>
        </div>
    </div>
)

const StatusBadge = ({ status }) => {
    const styles = {
        active: 'bg-emerald-50 text-emerald-700 dark:bg-[rgba(48,209,88,0.12)] dark:text-[#30D158]',
        trial: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
        suspended: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400',
        cancelled: 'bg-gray-100 text-gray-500 dark:bg-[#2C2C2E] dark:text-[#8E8E93]',
        expired: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
    }
    return (
        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${styles[status] || styles.cancelled}`}>
            {status || 'unknown'}
        </span>
    )
}

const FunnelVisualization = ({ data }) => {
    const maxVal = Math.max(data.signedUp || 1, 1)
    const steps = [
        { label: 'Signed up for trial', value: data.signedUp || 0, color: '#3EC4B1' },
        { label: 'Completed trial', value: data.completedTrial || 0, color: '#2355A6' },
        { label: 'Converted to paid', value: data.convertedToPaid || 0, color: '#10b981' },
        { label: 'Conversion rate', value: `${(data.conversionRate || 0).toFixed(1)}%`, color: '#f59e0b', isPercent: true },
    ]

    return (
        <div className="space-y-3 py-2">
            {steps.map((step, idx) => {
                const widthPct = step.isPercent
                    ? Math.max(parseFloat(step.value) || 0, 8)
                    : Math.max((step.value / maxVal) * 100, 8)
                return (
                    <div key={idx}>
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-gray-600 dark:text-[#8E8E93]">{step.label}</span>
                            <span className="text-xs font-bold text-gray-900 dark:text-white">{step.isPercent ? step.value : step.value.toLocaleString()}</span>
                        </div>
                        <div className="w-full bg-gray-100 dark:bg-[#2C2C2E] rounded-lg h-8 overflow-hidden">
                            <div
                                className="h-full rounded-lg transition-all duration-500 flex items-center justify-end pr-2"
                                style={{ width: `${Math.min(widthPct, 100)}%`, backgroundColor: step.color }}
                            >
                                <span className="text-[10px] font-bold text-white drop-shadow-sm">
                                    {step.isPercent ? step.value : step.value.toLocaleString()}
                                </span>
                            </div>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

const EmptyChart = ({ message }) => (
    <div className="h-48 sm:h-64 flex flex-col items-center justify-center text-gray-400 dark:text-[#636366]">
        <BarChart3 className="h-10 w-10 mb-2 text-gray-300 dark:text-[#48484A]" />
        <p className="text-sm">{message}</p>
    </div>
)

export default Reports
