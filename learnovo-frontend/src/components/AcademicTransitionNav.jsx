import { NavLink } from 'react-router-dom'
import { TrendingUp, ArrowRightLeft, CalendarClock, History } from 'lucide-react'

const links = [
  { to: '/app/academic/promotion', label: 'Promotion', icon: TrendingUp },
  { to: '/app/academic/sections', label: 'Sections', icon: ArrowRightLeft },
  { to: '/app/academic/year-rollover', label: 'Year Rollover', icon: CalendarClock },
  { to: '/app/academic/history', label: 'History', icon: History },
]

export default function AcademicTransitionNav() {
  return (
    <nav className="flex gap-1 p-1 bg-gray-100 dark:bg-[#2C2C2E] rounded-xl w-fit">
      {links.map(link => (
        <NavLink
          key={link.to}
          to={link.to}
          className={({ isActive }) =>
            `flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              isActive
                ? 'bg-white dark:bg-[#3A3A3C] text-teal-600 dark:text-teal-400 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`
          }
        >
          <link.icon className="w-3.5 h-3.5" />
          {link.label}
        </NavLink>
      ))}
    </nav>
  )
}
