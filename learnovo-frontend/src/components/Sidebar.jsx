import React from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { cn } from '../utils/cn'
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
  BookCheck
} from 'lucide-react'

const Sidebar = ({ isOpen, onClose }) => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  // Define menu items based on user role
  const getMenuItems = () => {
    const baseItems = [
      { name: 'Dashboard', href: '/app/dashboard', icon: LayoutDashboard, roles: ['admin', 'teacher', 'student', 'parent'] },
      { name: 'Students', href: '/app/students', icon: Users, roles: ['admin', 'teacher', 'parent'] },
      { name: 'Employees', href: '/app/employees', icon: UserPlus, roles: ['admin'] },
      { name: 'Academics', href: '/app/academics', icon: School, roles: ['admin', 'teacher', 'student'] },
      { name: 'Fees & Finance', href: '/app/fees-finance', icon: CreditCard, roles: ['admin'] },
      { name: 'Payroll', href: '/app/payroll', icon: Wallet, roles: ['admin'] },
      { name: 'Attendance', href: '/app/attendance', icon: Calendar, roles: ['admin', 'teacher', 'parent'] },
      { name: 'Homework', href: '/app/homework', icon: BookCheck, roles: ['admin', 'teacher', 'student'] },
      { name: 'Exams & Results', href: '/app/exams', icon: ClipboardList, roles: ['admin', 'teacher', 'student', 'parent'] },
      { name: 'Transport', href: '/app/transport', icon: Bus, roles: ['admin'] },
      { name: 'Communication', href: '/app/communication', icon: Bell, roles: ['admin', 'teacher'] },
      { name: 'Reports', href: '/app/reports', icon: BarChart3, roles: ['admin', 'teacher'] },
      { name: 'Certificates', href: '/app/certificates', icon: Award, roles: ['admin', 'teacher'] },
      { name: 'Settings', href: '/app/settings', icon: Settings, roles: ['admin'] },
    ]

    return baseItems.filter(item => item.roles.includes(user?.role))
  }

  const menuItems = getMenuItems()

  return (
    <>
      {/* Mobile/Tablet overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 xl:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out flex flex-col',
          'xl:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <img
                src="/logo-icon.png"
                alt="Learnovo Logo"
                className="h-9 w-9 object-contain"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'flex';
                }}
              />
              <div className="h-9 w-9 bg-primary-500 rounded-lg items-center justify-center hidden">
                <GraduationCap className="h-5 w-5 text-white" />
              </div>
            </div>
            <div className="ml-3">
              <h1 className="text-lg font-semibold text-gray-900">Learnovo</h1>
            </div>
          </div>
          <button
            onClick={onClose}
            className="xl:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto mt-4 px-4 pb-4">
          <div className="space-y-2">
            {menuItems.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive }) =>
                  `group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${isActive
                    ? 'bg-primary-50 text-primary-700 border-r-2 border-primary-500'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`
                }
                onClick={() => {
                  if (window.innerWidth < 1280) { // xl breakpoint
                    onClose()
                  }
                }}
              >
                <item.icon
                  className={`mr-3 h-5 w-5 flex-shrink-0 ${location.pathname === item.href
                    ? 'text-primary-500'
                    : 'text-gray-400 group-hover:text-gray-500'
                    }`}
                />
                {item.name}
              </NavLink>
            ))}
          </div>
        </nav>

        {/* User info and logout */}
        <div className="p-4 border-t border-gray-200 flex-shrink-0 bg-white">
          <div
            className="flex items-center mb-4 cursor-pointer hover:bg-gray-50 p-2 rounded-md transition-colors duration-200"
            onClick={() => navigate('/app/profile')}
            title="Edit Profile"
          >
            <div className="flex-shrink-0">
              <div className="h-8 w-8 bg-gray-300 rounded-full flex items-center justify-center">
                <span className="text-sm font-medium text-gray-700">
                  {user?.name?.charAt(0)?.toUpperCase()}
                </span>
              </div>
            </div>
            <div className="ml-3 overflow-hidden">
              <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
              {user?.admissionNumber && (
                <p className="text-xs font-mono text-teal-600 truncate">{user.admissionNumber}</p>
              )}
              <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
            </div>
            <Settings className="ml-auto h-4 w-4 text-gray-400" />
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 rounded-md transition-colors duration-200"
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
