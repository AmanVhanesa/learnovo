import { useAuth } from '../contexts/AuthContext'
import { Eye, LogOut } from 'lucide-react'

const ImpersonationBanner = () => {
  const { isImpersonating, tenant, user, exitImpersonation } = useAuth()

  if (!isImpersonating) return null

  const schoolName = tenant?.schoolName || tenant?.schoolCode || 'Unknown School'
  const adminName = user?.name || user?.email || 'Admin'

  return (
    <div className="bg-amber-500 dark:bg-amber-600 text-black px-4 py-2 flex items-center justify-between gap-3 z-50 relative shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        <Eye className="w-4 h-4 shrink-0" />
        <span className="text-sm font-semibold truncate">
          Viewing as <span className="font-bold">{adminName}</span> in <span className="font-bold">{schoolName}</span>
        </span>
        <span className="hidden sm:inline text-xs bg-black/15 rounded-full px-2 py-0.5 font-medium shrink-0">
          Impersonation Mode
        </span>
      </div>
      <button
        onClick={exitImpersonation}
        className="flex items-center gap-1.5 bg-black/20 hover:bg-black/30 active:scale-[0.97] text-black text-sm font-semibold rounded-lg px-3 py-1.5 transition-all shrink-0 cursor-pointer"
      >
        <LogOut className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Exit</span>
      </button>
    </div>
  )
}

export default ImpersonationBanner
