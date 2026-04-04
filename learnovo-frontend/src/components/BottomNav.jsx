import React from 'react'
import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Users, CreditCard, Calendar, MoreHorizontal, BookCheck, Megaphone, BookOpen } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const BottomNav = () => {
  const { user } = useAuth()
  const role = user?.role

  // Role-aware nav items
  const getItems = () => {
    if (['student', 'parent'].includes(role)) {
      return [
        { name: 'Dashboard', href: '/app/dashboard', icon: LayoutDashboard },
        { name: 'My Fees', href: '/app/student/fees', icon: CreditCard },
        { name: 'Homework', href: '/app/homework', icon: BookCheck },
        { name: 'Announce', href: '/app/announcements', icon: Megaphone },
      ]
    }

    if (role === 'teacher') {
      return [
        { name: 'Dashboard', href: '/app/dashboard', icon: LayoutDashboard },
        { name: 'Students', href: '/app/students', icon: Users },
        { name: 'Homework', href: '/app/homework', icon: BookOpen },
        { name: 'Attendance', href: '/app/attendance', icon: Calendar },
      ]
    }

    const base = [
      { name: 'Dashboard', href: '/app/dashboard', icon: LayoutDashboard },
    ]

    if (['admin'].includes(role)) {
      base.push({ name: 'Students', href: '/app/students', icon: Users })
      base.push({ name: 'Fees', href: '/app/fees-finance', icon: CreditCard })
    }

    base.push({ name: 'Attendance', href: '/app/attendance', icon: Calendar })
    base.push({ name: 'More', href: '/app/settings', icon: MoreHorizontal })

    return base.slice(0, 5)
  }

  const items = getItems()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-[#1C1C1E] backdrop-blur-xl border-t border-gray-200 dark:border-[#2C2C2E] xl:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-center justify-around h-14">
        {items.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center flex-1 h-full py-1 text-[10px] font-medium transition-colors ${
                isActive
                  ? 'text-primary-600 dark:text-[#3EC4B1]'
                  : 'text-gray-400 dark:text-[#8E8E93]'
              }`
            }
          >
            <item.icon className="h-5 w-5 mb-0.5" />
            {item.name}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

export default BottomNav
