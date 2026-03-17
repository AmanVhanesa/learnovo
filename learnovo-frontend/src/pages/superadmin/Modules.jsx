import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { superAdminService } from '../../services/superAdminService'
import toast from 'react-hot-toast'
import { Blocks, RefreshCw, Search, CheckCircle, Clock, Sparkles, School } from 'lucide-react'

const statusBadge = {
  stable: { label: 'Stable', class: 'bg-emerald-100 text-emerald-700' },
  beta: { label: 'Beta', class: 'bg-amber-100 text-amber-700' },
  coming_soon: { label: 'Coming Soon', class: 'bg-gray-100 text-gray-500' }
}

const Modules = () => {
  const [search, setSearch] = useState('')

  const { data: modules = [], isLoading, error, refetch } = useQuery({
    queryKey: ['superadmin-modules'],
    queryFn: async () => { const res = await superAdminService.getModules(); return res.data || [] },
  })

  const filtered = modules.filter(m => m.name.toLowerCase().includes(search.toLowerCase()) || m.slug.toLowerCase().includes(search.toLowerCase()))
  const stableCount = modules.filter(m => m.status === 'stable').length
  const betaCount = modules.filter(m => m.status === 'beta').length
  const comingSoonCount = modules.filter(m => m.status === 'coming_soon').length

  if (isLoading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="h-8 w-48 bg-gray-200 dark:bg-[#2C2C2E] rounded animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">{[1,2,3].map(i => <div key={i} className="h-24 bg-gray-200 dark:bg-[#2C2C2E] rounded-2xl animate-pulse" />)}</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">{[1,2,3,4,5,6].map(i => <div key={i} className="h-36 bg-gray-200 dark:bg-[#2C2C2E] rounded-2xl animate-pulse" />)}</div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
        <div><h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Module Management</h1><p className="text-sm text-gray-500 dark:text-[#8E8E93] mt-1">Manage platform modules available to tenants</p></div>
      </div>
      {error && (<div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 sm:p-4 flex items-center justify-between"><p className="text-sm text-red-700 dark:text-red-400 truncate">{error.response?.data?.message || error.message || 'Failed to load modules'}</p><button onClick={() => refetch()} className="text-red-600 hover:text-red-800 flex-shrink-0"><RefreshCw className="h-4 w-4" /></button></div>)}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="card p-4 sm:p-5 flex items-center gap-3"><div className="p-2 sm:p-2.5 rounded-xl bg-emerald-50 text-emerald-600 flex-shrink-0"><CheckCircle className="h-5 w-5" /></div><div><p className="text-xs font-medium text-gray-500 dark:text-[#8E8E93]">Stable Modules</p><p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{stableCount}</p></div></div>
        <div className="card p-4 sm:p-5 flex items-center gap-3"><div className="p-2 sm:p-2.5 rounded-xl bg-amber-50 text-amber-600 flex-shrink-0"><Sparkles className="h-5 w-5" /></div><div><p className="text-xs font-medium text-gray-500 dark:text-[#8E8E93]">Beta</p><p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{betaCount}</p></div></div>
        <div className="card p-4 sm:p-5 flex items-center gap-3"><div className="p-2 sm:p-2.5 rounded-xl bg-gray-100 text-gray-500 flex-shrink-0"><Clock className="h-5 w-5" /></div><div><p className="text-xs font-medium text-gray-500 dark:text-[#8E8E93]">Coming Soon</p><p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{comingSoonCount}</p></div></div>
      </div>
      <div className="relative w-full sm:max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" /><input type="text" placeholder="Search modules..." value={search} onChange={(e) => setSearch(e.target.value)} className="input pl-9 w-full" /></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {filtered.map((mod) => (
          <div key={mod.slug} className="card p-4 sm:p-5 hover:shadow-glass-md transition-shadow">
            <div className="flex items-start justify-between mb-3 gap-2">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0"><div className="p-2 rounded-xl bg-primary-50 text-primary-600 flex-shrink-0"><Blocks className="h-5 w-5" /></div><div className="min-w-0"><h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{mod.name}</h3><p className="text-xs text-gray-400 dark:text-[#636366] mt-0.5 truncate">{mod.slug}</p></div></div>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap flex-shrink-0 ${statusBadge[mod.status]?.class}`}>{statusBadge[mod.status]?.label}</span>
            </div>
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100 dark:border-[#38383A]">
              <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-[#8E8E93]"><School className="h-3.5 w-3.5" /><span>{mod.tenantsUsing || 0} tenants using</span></div>
              {mod.version && (<span className="text-[10px] font-medium text-gray-400 dark:text-[#636366] bg-gray-50 dark:bg-[#2C2C2E] px-2 py-0.5 rounded">v{mod.version}</span>)}
            </div>
          </div>
        ))}
      </div>
      {filtered.length === 0 && (<div className="text-center py-12"><Blocks className="h-12 w-12 mx-auto text-gray-300 dark:text-[#636366] mb-3" /><p className="text-lg font-medium text-gray-400 dark:text-[#636366]">No modules found</p></div>)}
    </div>
  )
}

export default Modules
