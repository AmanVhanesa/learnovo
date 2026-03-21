import { useState } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useSuperAdminAuth } from '../../contexts/SuperAdminContext'
import { superAdminService } from '../../services/superAdminService'
import { cn } from '../../utils/cn'
import { useIsLargeDesktop } from '../../hooks/useMediaQuery'
import {
    LayoutDashboard,
    School,
    Users,
    CreditCard,
    LogOut,
    X,
    GraduationCap,
    Receipt,
    Blocks,
    Megaphone,
    LifeBuoy,
    BarChart3,
    ShieldCheck,
    Settings,
    Activity,
} from 'lucide-react'

const SuperAdminSidebar = ({ isOpen, onClose }) => {
    const { superAdmin, logout } = useSuperAdminAuth()
    const navigate = useNavigate()
    const location = useLocation()
    const isLargeDesktop = useIsLargeDesktop()

    // Lightweight health check for sidebar alert dot
    const { data: healthData } = useQuery({
        queryKey: ['superadmin-sidebar-health'],
        queryFn: async () => { const res = await superAdminService.getSystemHealth(); return res.data },
        refetchInterval: 60000,
        staleTime: 30000,
    })
    const heapCritical = (() => {
        const mem = healthData?.server?.memoryUsage
        if (!mem?.heapUsed || !mem?.heapTotal) return false
        return (mem.heapUsed / mem.heapTotal) * 100 > 85
    })()

    const handleLogout = () => {
        logout()
        navigate('/super-admin-login')
    }

    const initials = superAdmin?.name?.charAt(0)?.toUpperCase() || 'S'

    const menuItems = [
        { name: 'Dashboard', href: '/super-admin/dashboard', icon: LayoutDashboard },
        { name: 'Tenants (Schools)', href: '/super-admin/schools', icon: School },
        { name: 'Subscriptions & Plans', href: '/super-admin/plans', icon: CreditCard },
        { name: 'Billing & Payments', href: '/super-admin/billing', icon: Receipt },
        { name: 'Users', href: '/super-admin/users', icon: Users },
        { name: 'Modules', href: '/super-admin/modules', icon: Blocks },
        { name: 'Communication', href: '/super-admin/communication', icon: Megaphone },
        { name: 'Support & Helpdesk', href: '/super-admin/support', icon: LifeBuoy },
        { name: 'Reports & Analytics', href: '/super-admin/reports', icon: BarChart3 },
        { name: 'Audit Logs', href: '/super-admin/audit-log', icon: ShieldCheck },
        { name: 'Platform Settings', href: '/super-admin/settings', icon: Settings },
        { name: 'System Health', href: '/super-admin/system', icon: Activity, alert: heapCritical },
    ]

    return (
        <>
            {/* Mobile/Tablet overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/30 dark:bg-black/75 xl:hidden"
                    onClick={onClose}
                />
            )}

            {/* Sidebar — 256px (w-64) to match main app, with backdrop-blur */}
            <div
                className={cn(
                    'fixed inset-y-0 left-0 z-50 w-64 bg-white/95 dark:bg-[#1C1C1E] backdrop-blur-xl border-r border-gray-200/60 dark:border-[#38383A] transform transition-transform duration-300 ease-in-out flex flex-col',
                    'xl:translate-x-0',
                    isOpen ? 'translate-x-0' : '-translate-x-full'
                )}
            >
                {/* Logo header — h-16 to match main sidebar */}
                <div className="flex items-center justify-between h-16 px-5 border-b border-gray-200/60 dark:border-[#38383A] flex-shrink-0">
                    <div className="flex items-center">
                        <div className="flex-shrink-0">
                            <SuperAdminLogo />
                        </div>
                        <div className="ml-3">
                            <h1 className="text-lg font-semibold text-gray-900 dark:text-white tracking-tight">Learnovo</h1>
                            <p className="text-[10px] font-semibold text-primary-500 dark:text-[#3EC4B1] -mt-0.5 tracking-widest uppercase">Super Admin</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="xl:hidden p-2 rounded-xl text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-[#2C2C2E] transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Section label */}
                <div className="px-5 pt-4 pb-1">
                    <p className="text-[11px] font-semibold text-gray-400 dark:text-[#636366] uppercase tracking-wider">Navigation</p>
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto px-3 pb-4">
                    <div className="space-y-0.5">
                        {menuItems.map((item) => (
                            <NavLink
                                key={item.name}
                                to={item.href}
                                className={({ isActive }) =>
                                    cn(
                                        'group flex items-center px-3 py-2 text-[13px] font-medium rounded-xl transition-all duration-200',
                                        isActive
                                            ? 'bg-primary-50 dark:bg-[rgba(62,196,177,0.08)] text-primary-700 dark:text-[#3EC4B1]'
                                            : 'text-gray-600 dark:text-[#8E8E93] hover:bg-gray-50 dark:hover:bg-[#2C2C2E] hover:text-gray-900 dark:hover:text-white'
                                    )
                                }
                                onClick={() => {
                                    if (!isLargeDesktop) onClose()
                                }}
                            >
                                <item.icon
                                    className={cn(
                                        'mr-2.5 h-[18px] w-[18px] flex-shrink-0',
                                        location.pathname.startsWith(item.href)
                                            ? 'text-primary-500 dark:text-[#3EC4B1]'
                                            : 'text-gray-400 dark:text-[#636366] group-hover:text-gray-500 dark:group-hover:text-white'
                                    )}
                                />
                                <span className="flex-1">{item.name}</span>
                                {item.alert && (
                                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                                )}
                            </NavLink>
                        ))}
                    </div>
                </nav>

                {/* User Profile + Sign out */}
                <div className="p-3 border-t border-gray-200/60 dark:border-[#38383A] flex-shrink-0">
                    <div className="w-full flex items-center gap-3 mb-2 px-2 py-1.5 rounded-xl text-left">
                        <div className="h-9 w-9 rounded-full overflow-hidden bg-primary-500 flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-bold text-white">{initials}</span>
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{superAdmin?.name || 'Super Admin'}</p>
                            <p className="text-[11px] text-primary-600 dark:text-[#3EC4B1] font-medium truncate">{superAdmin?.email || 'admin@learnovo.com'}</p>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center px-3 py-2 text-sm font-medium text-gray-600 dark:text-[#8E8E93] hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 rounded-xl transition-colors duration-200"
                    >
                        <LogOut className="mr-3 h-4 w-4" />
                        Sign out
                    </button>
                </div>
            </div>
        </>
    )
}

const SuperAdminLogo = () => {
  const [logoFailed, setLogoFailed] = useState(false)
  if (logoFailed) {
    return (
      <div className="h-9 w-9 bg-primary-500 rounded-xl flex items-center justify-center">
        <GraduationCap className="h-5 w-5 text-white" />
      </div>
    )
  }
  return (
    <img
      src="/logo-icon.png"
      alt="Learnovo Logo"
      className="h-9 w-9 object-contain"
      onError={() => setLogoFailed(true)}
    />
  )
}

export default SuperAdminSidebar
