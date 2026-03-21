import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { superAdminService } from '../../services/superAdminService'
import {
  Activity, RefreshCw, Server, Database, HardDrive, Cpu, Clock, Layers,
  AlertTriangle, Mail, Archive, Wifi, WifiOff, CheckCircle2, XCircle,
  CreditCard, Cloud, AlertCircle, Info, Shield
} from 'lucide-react'

const System = () => {
  const [autoRefresh, setAutoRefresh] = useState(true)

  const { data: health, isLoading, error, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['superadmin-system-health'],
    queryFn: async () => { const res = await superAdminService.getSystemHealth(); return res.data },
    refetchInterval: autoRefresh ? 30000 : false,
  })

  const [secondsAgo, setSecondsAgo] = useState(0)
  useEffect(() => {
    if (!dataUpdatedAt) return
    const interval = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - dataUpdatedAt) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [dataUpdatedAt])

  const formatUptime = (seconds) => {
    if (!seconds) return '0m'
    const d = Math.floor(seconds / 86400)
    const h = Math.floor((seconds % 86400) / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    if (d > 0) return `${d}d ${h}h ${m}m`
    if (h > 0) return `${h}h ${m}m`
    return `${m}m`
  }

  const getHeapColor = (percent) => {
    if (percent > 85) return '#EF4444'
    if (percent > 70) return '#F97316'
    if (percent > 60) return '#EAB308'
    return '#3EC4B1'
  }

  if (isLoading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="h-8 w-48 bg-gray-200 dark:bg-[#2C2C2E] rounded-xl animate-pulse" />
        <div className="h-16 bg-gray-200 dark:bg-[#2C2C2E] rounded-2xl animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-24 sm:h-28 bg-gray-200 dark:bg-[#2C2C2E] rounded-2xl animate-pulse" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {[1, 2].map(i => <div key={i} className="h-64 bg-gray-200 dark:bg-[#2C2C2E] rounded-2xl animate-pulse" />)}
        </div>
      </div>
    )
  }

  // Parse enhanced API response (supports both old and new format)
  const serverData = health?.server || {}
  const dbData = health?.database || {}
  const servicesData = health?.services || {}
  const alerts = health?.alerts || []
  const platformData = health?.platform || {}

  // Memory — support new nested format and old flat format
  const mem = serverData.memory || serverData.memoryUsage || {}
  const heapUsed = mem.heapUsed || 0
  const heapTotal = mem.heapTotal || 0
  const heapMax = mem.heapMax || heapTotal // V8 heap size limit (from --max-old-space-size)
  const heapPercent = mem.heapUsedPercent || (heapMax ? Math.round((heapUsed / heapMax) * 100) : 0)
  const rssMB = mem.rss || 0
  const externalMB = mem.external || 0
  const heapColor = getHeapColor(heapPercent)

  // Database — support new nested format and old flat format
  const dbStats = dbData.stats || {}
  const dbConns = dbData.connections || dbData.connectionPool || {}
  const dbStatus = dbData.status || (dbData.connectionState === 1 ? 'connected' : dbData.connectionState === 0 ? 'disconnected' : 'unknown')
  const dbCollections = dbStats.collections || dbData.collections || 0
  const dbObjects = dbStats.objects || dbData.objects || 0
  const dbIndexes = dbStats.indexes || dbData.indexes || 0
  const dbDataSize = dbStats.dataSize || dbData.totalSize || 0
  const dbStorageSize = dbStats.storageSize || dbData.storageSize || 0
  const dbAvgObjSize = dbStats.avgObjSize || 0
  const dbHost = dbData.host || ''
  const dbName = dbData.name || ''

  // Services
  const emailService = servicesData.email || health?.email || {}
  const cacheService = servicesData.cache || health?.cache || {}
  const storageService = servicesData.storage || {}
  const paymentService = servicesData.payment || {}

  // OS info
  const osInfo = serverData.os || {}
  const cpuInfo = serverData.cpu || {}

  // Overall status
  const overallStatus = health?.status || (heapPercent > 85 ? 'critical' : alerts.length > 0 ? 'warning' : 'healthy')
  const criticalAlerts = alerts.filter(a => a.level === 'critical')
  const warningAlerts = alerts.filter(a => a.level === 'warning')

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-[-0.025em]">System Health</h1>
          <p className="text-sm text-gray-500 dark:text-[#8E8E93] mt-1">Monitor server, database, and platform services</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Auto-refresh toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <button
              type="button"
              role="switch"
              aria-checked={autoRefresh}
              onClick={() => setAutoRefresh(v => !v)}
              className={`relative inline-flex flex-shrink-0 w-9 h-5 rounded-full transition-colors duration-200 ${
                autoRefresh ? 'bg-primary-500 dark:bg-[#3EC4B1]' : 'bg-gray-300 dark:bg-[#38383A]'
              }`}
            >
              <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200 ${
                autoRefresh ? 'translate-x-4' : 'translate-x-0.5'
              } translate-y-[2px]`} />
            </button>
            <span className="text-xs text-gray-500 dark:text-[#8E8E93] hidden sm:inline">Auto-refresh</span>
          </label>
          <span className="text-xs text-gray-400 dark:text-[#636366] hidden sm:inline">
            Updated {secondsAgo}s ago
          </span>
          <button onClick={() => refetch()} className="inline-flex items-center gap-2 h-10 px-4 text-sm font-semibold rounded-xl border border-gray-300 dark:border-[#38383A] text-gray-700 dark:text-white bg-white dark:bg-transparent hover:bg-gray-50 dark:hover:bg-[#2C2C2E] active:scale-[0.97] transition-all">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700 dark:text-red-400 truncate">{error.response?.data?.message || error.message || 'Failed to load system health'}</p>
          </div>
          <button onClick={() => refetch()} className="text-red-600 hover:text-red-800 flex-shrink-0"><RefreshCw className="h-4 w-4" /></button>
        </div>
      )}

      {/* Status Banner */}
      <StatusBanner status={overallStatus} alertCount={criticalAlerts.length + warningAlerts.length} />

      {/* Alert Cards */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert, i) => (
            <AlertCard key={i} alert={alert} />
          ))}
        </div>
      )}

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          icon={Clock}
          title="Uptime"
          value={serverData.uptimeFormatted || formatUptime(serverData.uptime || 0)}
          subtitle={`PID ${serverData.pid || 'N/A'}`}
          color="emerald"
        />
        <StatCard
          icon={Cpu}
          title="Heap Memory"
          value={`${heapUsed} / ${heapMax} MB`}
          subtitle={`${heapPercent}% used`}
          color={heapPercent > 80 ? 'red' : heapPercent > 60 ? 'amber' : 'blue'}
          progress={heapPercent}
          progressColor={heapColor}
        />
        <StatCard
          icon={Database}
          title="Database"
          value={`${dbDataSize} MB`}
          subtitle={`${dbCollections} collections`}
          color="purple"
          statusDot={dbStatus === 'connected' ? 'bg-emerald-500' : 'bg-red-500'}
        />
        <StatCard
          icon={Layers}
          title="Documents"
          value={(dbObjects || 0).toLocaleString()}
          subtitle={`${dbIndexes} indexes`}
          color="amber"
        />
      </div>

      {/* Two-Column Detail Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Server Details */}
        <div className="card p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-4">
            <Server className="h-5 w-5 text-primary-500 dark:text-[#3EC4B1]" />
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base">Server Details</h3>
          </div>
          <div className="space-y-3">
            <InfoRow label="Node.js Version" value={serverData.nodeVersion} />
            <InfoRow label="Platform" value={`${serverData.platform || 'N/A'} (${serverData.arch || ''})`} />
            <InfoRow label="Process ID" value={serverData.pid} />
            <InfoRow label="Environment" value={platformData.environment || process?.env?.NODE_ENV || 'N/A'} />
            <InfoRow label="App Version" value={platformData.version} />
            <InfoRow label="Timezone" value={platformData.timezone} />
            <div className="border-t border-gray-100 dark:border-[#38383A] pt-3 mt-3">
              <p className="text-[11px] font-semibold text-gray-400 dark:text-[#636366] uppercase tracking-wider mb-2">Memory</p>
              <InfoRow label="Heap Used" value={`${heapUsed} MB`} />
              <InfoRow label="Heap Allocated" value={`${heapTotal} MB`} />
              <InfoRow label="Heap Max" value={`${heapMax} MB`} />
              <InfoRow label="RSS Memory" value={`${rssMB} MB`} />
              <InfoRow label="External Memory" value={`${externalMB} MB`} />
              {/* Heap usage bar */}
              <div className="pt-2">
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-[#8E8E93] mb-1">
                  <span>Heap Usage</span>
                  <span style={{ color: heapColor, fontWeight: heapPercent > 80 ? 700 : 400 }}>{heapPercent}%</span>
                </div>
                <div className="w-full bg-gray-100 dark:bg-[#2C2C2E] rounded-full h-2">
                  <div className="h-2 rounded-full transition-all" style={{ width: `${Math.min(100, heapPercent)}%`, backgroundColor: heapColor }} />
                </div>
              </div>
            </div>
            {(osInfo.totalMemory || osInfo.freeMemory) && (
              <div className="border-t border-gray-100 dark:border-[#38383A] pt-3 mt-3">
                <p className="text-[11px] font-semibold text-gray-400 dark:text-[#636366] uppercase tracking-wider mb-2">Operating System</p>
                <InfoRow label="OS Type" value={osInfo.type} />
                <InfoRow label="OS Release" value={osInfo.release} />
                <InfoRow label="Total RAM" value={osInfo.totalMemory ? `${osInfo.totalMemory} MB` : 'N/A'} />
                <InfoRow label="Free RAM" value={osInfo.freeMemory ? `${osInfo.freeMemory} MB` : 'N/A'} />
                {cpuInfo.loadAvg && (
                  <InfoRow label="CPU Load (1m/5m/15m)" value={cpuInfo.loadAvg.map(v => v.toFixed(2)).join(' / ')} />
                )}
              </div>
            )}
          </div>
        </div>

        {/* Database Details */}
        <div className="card p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-4">
            <Database className="h-5 w-5 text-primary-500 dark:text-[#3EC4B1]" />
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base">Database Details</h3>
          </div>
          <div className="space-y-3">
            {/* Connection status */}
            <div className="flex items-center justify-between py-1.5 border-b border-gray-50 dark:border-[#38383A] gap-2">
              <span className="text-xs sm:text-sm text-gray-500 dark:text-[#8E8E93]">Connection</span>
              <span className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${dbStatus === 'connected' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                <span className={`text-xs sm:text-sm font-medium ${dbStatus === 'connected' ? 'text-emerald-500' : 'text-red-500'}`}>
                  {dbStatus === 'connected' ? 'Connected' : 'Disconnected'}
                </span>
              </span>
            </div>
            {dbName && <InfoRow label="Database" value={dbName} />}
            {dbHost && <InfoRow label="Host" value={dbHost.length > 30 ? dbHost.slice(0, 30) + '...' : dbHost} />}
            <InfoRow label="Data Size" value={`${dbDataSize} MB`} />
            <InfoRow label="Storage Size" value={`${dbStorageSize} MB`} />
            <InfoRow label="Collections" value={dbCollections} />
            <InfoRow label="Total Documents" value={(dbObjects || 0).toLocaleString()} />
            <InfoRow label="Total Indexes" value={dbIndexes} />
            {dbAvgObjSize > 0 && <InfoRow label="Avg Document Size" value={`${dbAvgObjSize} bytes`} />}
            {(dbConns.current != null || dbConns.available != null) && (
              <div className="border-t border-gray-100 dark:border-[#38383A] pt-3 mt-3">
                <p className="text-[11px] font-semibold text-gray-400 dark:text-[#636366] uppercase tracking-wider mb-2">Connection Pool</p>
                <InfoRow label="Current Connections" value={dbConns.current || 0} />
                <InfoRow label="Available Connections" value={dbConns.available || 0} />
                {dbConns.totalCreated != null && <InfoRow label="Total Created" value={dbConns.totalCreated} />}
                {(() => {
                  const total = (dbConns.current || 0) + (dbConns.available || 0)
                  const pct = total ? Math.round(((dbConns.current || 0) / total) * 100) : 0
                  return (
                    <div className="pt-2">
                      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-[#8E8E93] mb-1">
                        <span>Pool Utilization</span>
                        <span>{pct}% used</span>
                      </div>
                      <div className="w-full bg-gray-100 dark:bg-[#2C2C2E] rounded-full h-2">
                        <div className="h-2 rounded-full transition-all bg-primary-500 dark:bg-[#3EC4B1]" style={{ width: `${Math.min(100, pct)}%` }} />
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Services Status Row */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Platform Services</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          <ServiceCard
            icon={Mail}
            name="Email"
            status={emailService.status === 'configured' || emailService.queueLength != null ? 'configured' : 'not_configured'}
            details={emailService.queueLength != null ? `${emailService.pending || 0} pending, ${emailService.failed || 0} failed` : null}
          />
          <ServiceCard
            icon={Archive}
            name="Cache"
            status={cacheService.keys != null ? 'active' : 'not_configured'}
            details={cacheService.keys != null ? `${cacheService.keys} keys, ${cacheService.hitRate || 0}% hit rate` : null}
          />
          <ServiceCard
            icon={Cloud}
            name="Cloudinary"
            status={storageService.cloudinary || 'not_configured'}
          />
          <ServiceCard
            icon={HardDrive}
            name="AWS S3"
            status={storageService.s3 || 'not_configured'}
          />
          <ServiceCard
            icon={CreditCard}
            name="Razorpay"
            status={paymentService.razorpay || 'not_configured'}
          />
        </div>
      </div>

      {/* Mobile auto-refresh note */}
      <p className="text-xs text-gray-400 dark:text-[#636366] text-center sm:hidden">
        {autoRefresh ? 'Auto-refreshing every 30s' : 'Auto-refresh off'} &middot; Updated {secondsAgo}s ago
      </p>
    </div>
  )
}

/* ─── Status Banner ──────────────────────────────────────────────────────── */
const StatusBanner = ({ status, alertCount }) => {
  const config = {
    healthy: {
      bg: 'bg-emerald-50 dark:bg-[rgba(48,209,88,0.08)] border-emerald-200 dark:border-emerald-500/20',
      icon: <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />,
      title: 'All Systems Operational',
      titleColor: 'text-emerald-700 dark:text-[#30D158]',
    },
    warning: {
      bg: 'bg-amber-50 dark:bg-[rgba(255,214,10,0.08)] border-amber-200 dark:border-amber-500/20',
      icon: <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0" />,
      title: `Warning: ${alertCount} issue${alertCount !== 1 ? 's' : ''} detected`,
      titleColor: 'text-amber-700 dark:text-[#FFD60A]',
    },
    critical: {
      bg: 'bg-red-50 dark:bg-[rgba(255,69,58,0.08)] border-red-200 dark:border-red-500/20',
      icon: <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />,
      title: `Critical: ${alertCount} issue${alertCount !== 1 ? 's' : ''} require immediate attention`,
      titleColor: 'text-red-700 dark:text-[#FF453A]',
    },
  }
  const c = config[status] || config.healthy
  return (
    <div className={`rounded-2xl border p-4 sm:p-5 flex items-center gap-3 ${c.bg}`}>
      {c.icon}
      <div>
        <p className={`text-sm font-semibold ${c.titleColor}`}>{c.title}</p>
        <p className="text-xs text-gray-500 dark:text-[#8E8E93] mt-0.5">
          Last checked: {new Date().toLocaleString()}
        </p>
      </div>
    </div>
  )
}

/* ─── Alert Card ─────────────────────────────────────────────────────────── */
const AlertCard = ({ alert }) => {
  const isC = alert.level === 'critical'
  return (
    <div className={`rounded-2xl border p-4 flex items-start gap-3 ${
      isC
        ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
        : 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800'
    }`}>
      <AlertTriangle className={`h-5 w-5 flex-shrink-0 mt-0.5 ${isC ? 'text-red-500' : 'text-amber-500'}`} />
      <div>
        <p className={`text-sm font-semibold ${isC ? 'text-red-700 dark:text-red-400' : 'text-amber-700 dark:text-amber-400'}`}>
          {alert.title || (isC ? 'Critical Issue' : 'Warning')}
        </p>
        <p className={`text-sm mt-0.5 ${isC ? 'text-red-600/80 dark:text-red-400/80' : 'text-amber-600/80 dark:text-amber-400/80'}`}>
          {alert.message}
        </p>
      </div>
    </div>
  )
}

/* ─── Stat Card ──────────────────────────────────────────────────────────── */
const StatCard = ({ icon: Icon, title, value, subtitle, color, progress, progressColor, statusDot }) => {
  const colorMap = {
    emerald: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400',
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
    amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400',
    red: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400',
  }
  return (
    <div className="card p-3 sm:p-5">
      <div className="flex items-center gap-2 sm:gap-3">
        <div className={`p-2 sm:p-2.5 rounded-xl ${colorMap[color]} flex-shrink-0 relative`}>
          <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
          {statusDot && <span className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ${statusDot} border-2 border-white dark:border-[#1C1C1E]`} />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] sm:text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider truncate">{title}</p>
          <p className="text-sm sm:text-xl font-bold text-gray-900 dark:text-white mt-0.5 truncate">{value}</p>
          {subtitle && <p className="text-[10px] sm:text-xs text-gray-400 dark:text-[#636366] truncate">{subtitle}</p>}
        </div>
      </div>
      {progress != null && (
        <div className="mt-2">
          <div className="w-full bg-gray-100 dark:bg-[#2C2C2E] rounded-full h-1.5">
            <div className="h-1.5 rounded-full transition-all" style={{ width: `${Math.min(100, progress)}%`, backgroundColor: progressColor || '#3EC4B1' }} />
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Service Card ───────────────────────────────────────────────────────── */
const ServiceCard = ({ icon: Icon, name, status, details }) => {
  const isConfigured = status === 'configured' || status === 'active' || status === 'connected'
  return (
    <div className="card p-4 flex items-start gap-3">
      <div className={`p-2 rounded-xl flex-shrink-0 ${
        isConfigured
          ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
          : 'bg-gray-50 dark:bg-[#2C2C2E] text-gray-400 dark:text-[#636366]'
      }`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-900 dark:text-white">{name}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className={`w-1.5 h-1.5 rounded-full ${isConfigured ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-[#636366]'}`} />
          <span className={`text-xs ${isConfigured ? 'text-emerald-600 dark:text-[#30D158]' : 'text-gray-400 dark:text-[#636366]'}`}>
            {isConfigured ? 'Configured' : 'Not Configured'}
          </span>
        </div>
        {details && <p className="text-[11px] text-gray-400 dark:text-[#636366] mt-1">{details}</p>}
      </div>
    </div>
  )
}

/* ─── Info Row ───────────────────────────────────────────────────────────── */
const InfoRow = ({ label, value }) => (
  <div className="flex items-center justify-between py-1.5 border-b border-gray-50 dark:border-[#38383A] last:border-0 gap-2">
    <span className="text-xs sm:text-sm text-gray-500 dark:text-[#8E8E93] flex-shrink-0">{label}</span>
    <span className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white truncate text-right">{value ?? 'N/A'}</span>
  </div>
)

export default System
