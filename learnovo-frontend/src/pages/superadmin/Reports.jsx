import { useQuery } from '@tanstack/react-query'
import { superAdminService } from '../../services/superAdminService'
import { Bar, Line, Doughnut } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Title, Tooltip, Legend, Filler } from 'chart.js'
import { BarChart3, RefreshCw, TrendingUp, Users, MapPin, IndianRupee } from 'lucide-react'

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Title, Tooltip, Legend, Filler)

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const Reports = () => {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['superadmin-reports'],
    queryFn: async () => { const res = await superAdminService.getReportsOverview(); return res.data },
  })

  if (isLoading) {
    return (<div className="space-y-4 sm:space-y-6"><div className="h-8 w-48 bg-gray-200 dark:bg-[#2C2C2E] rounded animate-pulse" /><div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">{[1,2,3,4].map(i => <div key={i} className="h-56 sm:h-72 bg-gray-200 dark:bg-[#2C2C2E] rounded-2xl animate-pulse" />)}</div></div>)
  }

  const tenantGrowthChart = {
    labels: data?.tenantGrowth?.map(d => `${monthNames[d._id.month - 1]} ${d._id.year}`) || [],
    datasets: [{ label: 'New Tenants', data: data?.tenantGrowth?.map(d => d.count) || [], borderColor: '#3EC4B1', backgroundColor: 'rgba(62, 196, 177, 0.1)', tension: 0.4, fill: true, pointRadius: 4, pointBackgroundColor: '#3EC4B1' }]
  }
  const revenueByPlanChart = {
    labels: data?.revenueByPlan?.map(d => d._id || 'Unknown') || [],
    datasets: [{ data: data?.revenueByPlan?.map(d => d.count) || [], backgroundColor: ['#e5e7eb', '#3EC4B1', '#2355A6', '#7c3aed'], borderWidth: 0 }]
  }
  const usersByRoleChart = {
    labels: data?.usersByRole?.map(d => d._id || 'Unknown') || [],
    datasets: [{ label: 'Users', data: data?.usersByRole?.map(d => d.count) || [], backgroundColor: '#3EC4B1', borderRadius: 8, maxBarThickness: 40 }]
  }
  const monthlyRevenueChart = {
    labels: data?.monthlyRevenue?.map(d => `${monthNames[d._id.month - 1]}`) || [],
    datasets: [{ label: 'Revenue', data: data?.monthlyRevenue?.map(d => d.total) || [], borderColor: '#2355A6', backgroundColor: 'rgba(35, 85, 166, 0.1)', tension: 0.4, fill: true, pointRadius: 4, pointBackgroundColor: '#2355A6' }]
  }

  const chartOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1e293b', titleFont: { size: 12 }, bodyFont: { size: 11 }, padding: 10, cornerRadius: 8 } },
    scales: { x: { grid: { display: false }, ticks: { font: { size: 11 } } }, y: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 11 } }, beginAtZero: true } }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
        <div><h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Reports & Analytics</h1><p className="text-sm text-gray-500 dark:text-[#8E8E93] mt-1">Platform-wide insights and performance metrics</p></div>
        <button onClick={() => refetch()} className="btn btn-outline flex items-center gap-2 w-full sm:w-auto"><RefreshCw className="h-4 w-4" /> Refresh</button>
      </div>
      {error && (<div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 sm:p-4 flex items-center justify-between"><p className="text-sm text-red-700 dark:text-red-400 truncate">{error.response?.data?.message || error.message || 'Failed to load reports'}</p><button onClick={() => refetch()} className="text-red-600 hover:text-red-800 flex-shrink-0"><RefreshCw className="h-4 w-4" /></button></div>)}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="card p-4 sm:p-5"><div className="flex items-center gap-2 mb-4"><TrendingUp className="h-5 w-5 text-primary-500" /><h3 className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base">Tenant Growth (12 months)</h3></div><div className="h-48 sm:h-64"><Line data={tenantGrowthChart} options={chartOptions} /></div></div>
        <div className="card p-4 sm:p-5"><div className="flex items-center gap-2 mb-4"><IndianRupee className="h-5 w-5 text-primary-500" /><h3 className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base">Tenants by Plan</h3></div><div className="h-48 sm:h-64 flex items-center justify-center"><div className="w-40 h-40 sm:w-48 sm:h-48"><Doughnut data={revenueByPlanChart} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { padding: 16, font: { size: 11 } } } }, cutout: '65%' }} /></div></div></div>
        <div className="card p-4 sm:p-5"><div className="flex items-center gap-2 mb-4"><Users className="h-5 w-5 text-primary-500" /><h3 className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base">Users by Role</h3></div><div className="h-48 sm:h-64"><Bar data={usersByRoleChart} options={chartOptions} /></div></div>
        <div className="card p-4 sm:p-5"><div className="flex items-center gap-2 mb-4"><BarChart3 className="h-5 w-5 text-primary-500" /><h3 className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base">Monthly Revenue</h3></div><div className="h-48 sm:h-64"><Line data={monthlyRevenueChart} options={chartOptions} /></div></div>
      </div>
      {data?.tenantsByRegion?.length > 0 && (
        <div className="card p-4 sm:p-5"><div className="flex items-center gap-2 mb-4"><MapPin className="h-5 w-5 text-primary-500" /><h3 className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base">Tenants by Region</h3></div><div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-3">{data.tenantsByRegion.slice(0, 12).map((region) => (<div key={region._id} className="bg-gray-50 dark:bg-[#2C2C2E] rounded-xl p-3 text-center"><p className="text-lg font-bold text-gray-900 dark:text-white">{region.count}</p><p className="text-xs text-gray-500 dark:text-[#8E8E93] truncate">{region._id}</p></div>))}</div></div>
      )}
    </div>
  )
}

export default Reports
