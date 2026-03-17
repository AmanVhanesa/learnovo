import { useQuery } from '@tanstack/react-query'
import { superAdminService } from '../../services/superAdminService'
import { Activity, RefreshCw, Server, Database, HardDrive, Cpu, Clock, Layers } from 'lucide-react'

const System = () => {
  const { data: health, isLoading, error, refetch } = useQuery({
    queryKey: ['superadmin-system-health'],
    queryFn: async () => { const res = await superAdminService.getSystemHealth(); return res.data },
  })

  const formatUptime = (seconds) => { const d = Math.floor(seconds / 86400); const h = Math.floor((seconds % 86400) / 3600); const m = Math.floor((seconds % 3600) / 60); return `${d}d ${h}h ${m}m` }

  if (isLoading) {
    return (<div className="space-y-4 sm:space-y-6"><div className="h-8 w-48 bg-gray-200 dark:bg-[#2C2C2E] rounded animate-pulse" /><div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">{[1,2,3,4].map(i => <div key={i} className="h-24 sm:h-28 bg-gray-200 dark:bg-[#2C2C2E] rounded-2xl animate-pulse" />)}</div><div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">{[1,2].map(i => <div key={i} className="h-48 sm:h-64 bg-gray-200 dark:bg-[#2C2C2E] rounded-2xl animate-pulse" />)}</div></div>)
  }

  const server = health?.server || {}
  const db = health?.database || {}

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
        <div><h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">System Health</h1><p className="text-sm text-gray-500 dark:text-[#8E8E93] mt-1">Monitor server, database, and platform performance</p></div>
        <button onClick={() => refetch()} className="btn btn-outline flex items-center gap-2 w-full sm:w-auto"><RefreshCw className="h-4 w-4" /> Refresh</button>
      </div>
      {error && (<div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 sm:p-4 flex items-center justify-between"><p className="text-sm text-red-700 dark:text-red-400 truncate">{error.response?.data?.message || error.message || 'Failed to load system health'}</p><button onClick={() => refetch()} className="text-red-600 hover:text-red-800 flex-shrink-0"><RefreshCw className="h-4 w-4" /></button></div>)}
      <div className="card p-4 sm:p-5 flex items-center gap-3 sm:gap-4"><div className="h-4 w-4 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" /><div><p className="text-sm font-semibold text-gray-900 dark:text-white">All Systems Operational</p><p className="text-xs text-gray-500 dark:text-[#8E8E93]">Last checked: {new Date().toLocaleString()}</p></div></div>
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard icon={Clock} title="Uptime" value={formatUptime(server.uptime || 0)} color="emerald" />
        <StatCard icon={Cpu} title="Memory (Heap)" value={`${server.memoryUsage?.heapUsed || 0} MB`} subtitle={`of ${server.memoryUsage?.heapTotal || 0} MB`} color="blue" />
        <StatCard icon={Database} title="DB Size" value={`${db.totalSize || 0} MB`} subtitle={`${db.collections || 0} collections`} color="purple" />
        <StatCard icon={Layers} title="DB Objects" value={(db.objects || 0).toLocaleString()} subtitle={`${db.indexes || 0} indexes`} color="amber" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="card p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-4"><Server className="h-5 w-5 text-primary-500" /><h3 className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base">Server Details</h3></div>
          <div className="space-y-3">
            <InfoRow label="Node.js Version" value={server.nodeVersion} />
            <InfoRow label="Platform" value={server.platform} />
            <InfoRow label="RSS Memory" value={`${server.memoryUsage?.rss || 0} MB`} />
            <InfoRow label="Heap Used" value={`${server.memoryUsage?.heapUsed || 0} MB`} />
            <InfoRow label="Heap Total" value={`${server.memoryUsage?.heapTotal || 0} MB`} />
            <InfoRow label="Uptime" value={formatUptime(server.uptime || 0)} />
            <div className="pt-2"><div className="flex items-center justify-between text-xs text-gray-500 dark:text-[#8E8E93] mb-1"><span>Heap Usage</span><span>{server.memoryUsage?.heapTotal ? Math.round((server.memoryUsage.heapUsed / server.memoryUsage.heapTotal) * 100) : 0}%</span></div><div className="w-full bg-gray-100 dark:bg-[#2C2C2E] rounded-full h-2"><div className="bg-primary-500 h-2 rounded-full transition-all" style={{ width: `${server.memoryUsage?.heapTotal ? Math.min(100, (server.memoryUsage.heapUsed / server.memoryUsage.heapTotal) * 100) : 0}%` }} /></div></div>
          </div>
        </div>
        <div className="card p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-4"><Database className="h-5 w-5 text-primary-500" /><h3 className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base">Database Details</h3></div>
          <div className="space-y-3">
            <InfoRow label="Data Size" value={`${db.totalSize || 0} MB`} />
            <InfoRow label="Storage Size" value={`${db.storageSize || 0} MB`} />
            <InfoRow label="Collections" value={db.collections} />
            <InfoRow label="Total Documents" value={(db.objects || 0).toLocaleString()} />
            <InfoRow label="Total Indexes" value={db.indexes} />
            {db.connectionPool && (<><InfoRow label="Current Connections" value={db.connectionPool.current} /><InfoRow label="Available Connections" value={db.connectionPool.available} /></>)}
          </div>
        </div>
      </div>
    </div>
  )
}

const StatCard = ({ icon: Icon, title, value, subtitle, color }) => {
  const colorMap = { emerald: 'bg-emerald-50 text-emerald-600', blue: 'bg-blue-50 text-blue-600', purple: 'bg-purple-50 text-purple-600', amber: 'bg-amber-50 text-amber-600' }
  return (<div className="card p-3 sm:p-5"><div className="flex items-center gap-2 sm:gap-3"><div className={`p-2 sm:p-2.5 rounded-xl ${colorMap[color]} flex-shrink-0`}><Icon className="h-4 w-4 sm:h-5 sm:w-5" /></div><div className="min-w-0"><p className="text-[10px] sm:text-xs font-medium text-gray-500 dark:text-[#8E8E93] truncate">{title}</p><p className="text-sm sm:text-xl font-bold text-gray-900 dark:text-white mt-0.5 truncate">{value}</p>{subtitle && <p className="text-[10px] sm:text-xs text-gray-400 dark:text-[#636366] truncate">{subtitle}</p>}</div></div></div>)
}

const InfoRow = ({ label, value }) => (<div className="flex items-center justify-between py-1.5 border-b border-gray-50 dark:border-[#38383A] last:border-0 gap-2"><span className="text-xs sm:text-sm text-gray-500 dark:text-[#8E8E93] flex-shrink-0">{label}</span><span className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white truncate text-right">{value ?? 'N/A'}</span></div>)

export default System
