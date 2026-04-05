import React, { useState } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useUserDisplay } from '../hooks/useUserDisplay'
import { cn } from '../utils/cn'
import { useIsLargeDesktop } from '../hooks/useMediaQuery'
import UserAvatar from './UserAvatar'
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  CreditCard,
  UserPlus,
  BarChart3,
  Settings,
  Bell,
  LogOut,
  X,
  Calendar,
  BookOpen,
  School,
  Menu,
  ClipboardList,
  Bus,
  Award,
  Wallet,
  BookCheck,
  List,
  Megaphone,
  ReceiptText,
  CalendarClock,
  LayoutGrid,
  CircleDollarSign,
  PieChart,
  Merge,
  Download,
  Share,
  MoreVertical
} from 'lucide-react'
import { useInstall } from './InstallPWA'

const Sidebar = ({ isOpen, onClose }) => {
  const { user, logout } = useAuth()
  const { photoUrl, displayName, initials, role } = useUserDisplay()
  const navigate = useNavigate()
  const location = useLocation()
  const [logoFailed, setLogoFailed] = useState(false)
  const isLargeDesktop = useIsLargeDesktop()
  const install = useInstall()
  const [showInstallHelp, setShowInstallHelp] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  // Build grouped menu sections based on user role
  const getMenuSections = () => {
    const r = user?.role
    if (!r) return []

    const sections = []

    // ── Overview (all roles) ──────────────────────────────────────
    sections.push({
      items: [
        { name: 'Dashboard', href: '/app/dashboard', icon: LayoutDashboard, roles: ['admin', 'teacher', 'student', 'parent'] },
      ]
    })

    // ── People ────────────────────────────────────────────────────
    const peopleItems = [
      { name: 'Students', href: '/app/students', icon: Users, roles: ['admin', 'teacher', 'parent'] },
      { name: 'Student Lists', href: '/app/student-lists', icon: List, roles: ['admin', 'teacher'] },
      { name: 'Employees', href: '/app/employees', icon: UserPlus, roles: ['admin'] },
    ].filter(i => i.roles.includes(r))

    if (peopleItems.length > 0) {
      sections.push({ label: 'People', items: peopleItems })
    }

    // ── Academics ─────────────────────────────────────────────────
    const academicItems = [
      { name: 'Academics', href: '/app/academics', icon: School, roles: ['admin', 'teacher'] },
      { name: 'Attendance', href: '/app/attendance', icon: Calendar, roles: ['admin', 'teacher', 'parent', 'student'] },
      { name: 'Homework', href: '/app/homework', icon: BookCheck, roles: ['admin', 'teacher', 'student'] },
      { name: 'Assignments', href: '/app/assignments', icon: BookOpen, roles: ['admin', 'teacher', 'student'] },
      { name: 'Exams & Results', href: '/app/exams', icon: ClipboardList, roles: ['admin', 'teacher', 'student', 'parent'] },
      { name: 'Timetable', href: '/app/timetable', icon: CalendarClock, roles: ['admin', 'teacher', 'student', 'parent'], end: true },
      { name: 'Timetable Builder', href: '/app/timetable/builder', icon: LayoutGrid, roles: ['admin'] },
    ].filter(i => i.roles.includes(r))

    if (academicItems.length > 0) {
      sections.push({ label: 'Academics', items: academicItems })
    }

    // ── Fees & Finance (unified section for all fee + finance items) ──
    const feesFinanceItems = [
      { name: 'My Fees', href: '/app/student/fees', icon: CreditCard, roles: ['student', 'parent'] },
      { name: 'Fee Collection', href: '/app/fees-finance', icon: CreditCard, roles: ['admin'] },
      { name: 'Finance Overview', href: '/app/finance-dashboard', icon: PieChart, roles: ['admin'] },
      { name: 'Income', href: '/app/income', icon: CircleDollarSign, roles: ['admin'] },
      { name: 'Expenses', href: '/app/expenses', icon: ReceiptText, roles: ['admin'] },
      { name: 'Payroll', href: '/app/payroll', icon: Wallet, roles: ['admin'] },
    ].filter(i => i.roles.includes(r))

    if (feesFinanceItems.length > 0) {
      sections.push({ label: 'Fees & Finance', items: feesFinanceItems })
    }

    // ── Operations ────────────────────────────────────────────────
    const opsItems = [
      { name: 'Transport', href: '/app/transport', icon: Bus, roles: ['admin'] },
      { name: 'Certificates', href: '/app/certificates', icon: Award, roles: ['admin', 'teacher'] },
      { name: 'Communication', href: '/app/communication', icon: Bell, roles: ['admin', 'teacher'] },
      { name: 'Announcements', href: '/app/announcements', icon: Megaphone, roles: ['student', 'parent'] },
    ].filter(i => i.roles.includes(r))

    if (opsItems.length > 0) {
      sections.push({ label: 'Operations', items: opsItems })
    }

    // ── Admin ─────────────────────────────────────────────────────
    const adminItems = [
      { name: 'Reports', href: '/app/reports', icon: BarChart3, roles: ['admin', 'teacher'] },
      { name: 'Settings', href: '/app/settings', icon: Settings, roles: ['admin'] },
    ].filter(i => i.roles.includes(r))

    if (adminItems.length > 0) {
      sections.push({ label: 'Admin', items: adminItems })
    }

    return sections
  }

  const menuSections = getMenuSections()

  return (
    <>
      {/* Mobile/Tablet overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-gray-600/75 dark:bg-black/60 xl:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 bg-white/95 dark:bg-[#1C1C1E] backdrop-blur-xl shadow-glass-lg border-r border-gray-200 dark:border-[#38383A] transform transition-transform duration-300 ease-in-out flex flex-col',
          'xl:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-100 dark:border-[#2C2C2E] flex-shrink-0">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              {!logoFailed ? (
                <img
                  src="/logo-icon.png"
                  alt="Learnovo Logo"
                  className="h-9 w-9 object-contain"
                  onError={() => setLogoFailed(true)}
                />
              ) : (
                <div className="h-9 w-9 bg-primary-500 rounded-lg flex items-center justify-center">
                  <GraduationCap className="h-5 w-5 text-white" />
                </div>
              )}
            </div>
            <div className="ml-3">
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Learnovo</h1>
            </div>
          </div>
          <button
            onClick={onClose}
            className="xl:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-[#2C2C2E] dark:hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto mt-2 px-4 pb-4">
          {menuSections.map((section, sIdx) => (
            <div key={sIdx} className={sIdx > 0 ? 'mt-5' : ''}>
              {section.label && (
                <p className="px-3 mb-1.5 text-[10px] font-semibold text-gray-400 dark:text-[#8E8E93] uppercase tracking-widest">
                  {section.label}
                </p>
              )}
              <div className="space-y-1">
                {section.items.map((item) => {
                  // Use "end" match for items whose paths are prefixes of other items
                  // e.g. /app/timetable should not stay active when on /app/timetable/builder
                  const useEnd = item.end || false
                  return (
                  <NavLink
                    key={item.name}
                    to={item.href}
                    end={useEnd}
                    className={({ isActive }) =>
                      `group flex items-center px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 ${isActive
                        ? 'bg-primary-50 dark:bg-[rgba(62,196,177,0.12)] text-primary-700 dark:text-[#3EC4B1] shadow-sm ring-1 ring-primary-100 dark:ring-[rgba(62,196,177,0.2)]'
                        : 'text-gray-600 dark:text-white hover:bg-gray-50/80 dark:hover:bg-[#2C2C2E] hover:text-gray-900 dark:hover:text-white'
                      }`
                    }
                    onClick={() => {
                      if (!isLargeDesktop) {
                        onClose()
                      }
                    }}
                  >
                    <item.icon
                      className={`mr-3 h-5 w-5 flex-shrink-0 ${location.pathname === item.href
                        ? 'text-[#3EC4B1]'
                        : 'text-gray-400 dark:text-[#8E8E93] group-hover:text-gray-500 dark:group-hover:text-white'
                        }`}
                    />
                    {item.name}
                  </NavLink>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Install App + Sign out */}
        <div className="px-4 py-3 border-t border-gray-100 dark:border-[#2C2C2E] flex-shrink-0 space-y-1">
          {install && !install.isInstalled && (
            <>
              <button
                onClick={async () => {
                  if (install.canNativeInstall) {
                    await install.triggerInstall()
                  } else {
                    setShowInstallHelp(prev => !prev)
                  }
                }}
                className="w-full flex items-center px-3 py-2.5 text-sm font-medium text-primary-600 dark:text-[#3EC4B1] hover:bg-primary-50 dark:hover:bg-[rgba(62,196,177,0.1)] rounded-xl transition-all duration-200"
              >
                <Download className="mr-3 h-4 w-4" />
                Install App
              </button>
              {showInstallHelp && !install.canNativeInstall && install.browser && (
                <div className="mx-3 mb-1 p-3 rounded-lg bg-gray-50 dark:bg-[#2C2C2E] text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                  {install.browser.name === 'ios-safari' && (
                    <>Tap <Share size={12} className="inline -mt-0.5 text-primary-500" /> at the bottom, then <span className="font-medium">&quot;Add to Home Screen&quot;</span></>
                  )}
                  {install.browser.name === 'ios-chrome' && (
                    <>Tap <Share size={12} className="inline -mt-0.5 text-primary-500" /> at the top, then <span className="font-medium">&quot;Add to Home Screen&quot;</span></>
                  )}
                  {(install.browser.name === 'ios-firefox' || install.browser.name === 'ios-other') && (
                    <>Open in <span className="font-medium">Safari</span>, tap <Share size={12} className="inline -mt-0.5 text-primary-500" /> then <span className="font-medium">&quot;Add to Home Screen&quot;</span></>
                  )}
                  {install.browser.name === 'firefox' && (
                    <>Tap <MoreVertical size={12} className="inline -mt-0.5 text-primary-500" /> menu, then <span className="font-medium">&quot;Install&quot;</span></>
                  )}
                  {install.browser.name === 'samsung' && (
                    <>Tap the menu button, then <span className="font-medium">&quot;Add page to&quot;</span> &rarr; <span className="font-medium">&quot;Home screen&quot;</span></>
                  )}
                  {install.browser.name === 'opera' && (
                    <>Tap <MoreVertical size={12} className="inline -mt-0.5 text-primary-500" /> menu, then <span className="font-medium">&quot;Home screen&quot;</span></>
                  )}
                  {!['ios-safari', 'ios-chrome', 'ios-firefox', 'ios-other', 'firefox', 'samsung', 'opera'].includes(install.browser.name) && (
                    <>Tap <MoreVertical size={12} className="inline -mt-0.5 text-primary-500" /> browser menu, then look for <span className="font-medium">&quot;Install&quot;</span> or <span className="font-medium">&quot;Add to Home Screen&quot;</span></>
                  )}
                </div>
              )}
            </>
          )}
          <button
            onClick={handleLogout}
            className="w-full flex items-center px-3 py-2.5 text-sm font-medium text-gray-500 dark:text-[#8E8E93] hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/10 dark:hover:text-red-400 rounded-xl transition-all duration-200"
          >
            <LogOut className="mr-3 h-4 w-4" />
            Sign out
          </button>
        </div>
      </div>
    </>
  )
}

export default Sidebar
