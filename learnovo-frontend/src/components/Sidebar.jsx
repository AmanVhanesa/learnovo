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
  Menu
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
      { name: 'Teachers', href: '/app/teachers', icon: GraduationCap, roles: ['admin'] },
      { name: 'Classes', href: '/app/classes', icon: School, roles: ['admin'] },
      { name: 'Fees', href: '/app/fees', icon: CreditCard, roles: ['admin', 'teacher', 'student', 'parent'] },
      { name: 'Attendance', href: '/app/attendance', icon: Calendar, roles: ['teacher'] },
      { name: 'Assignments', href: '/app/assignments', icon: BookOpen, roles: ['admin', 'teacher', 'student'] },
      { name: 'Admissions', href: '/app/admissions', icon: UserPlus, roles: ['admin'] },
      { name: 'Reports', href: '/app/reports', icon: BarChart3, roles: ['admin', 'teacher'] },
      { name: 'Notifications', href: '/app/notifications', icon: Bell, roles: ['admin', 'teacher', 'student', 'parent'] },
      { name: 'Settings', href: '/app/settings', icon: Settings, roles: ['admin'] },
    ]

    return baseItems.filter(item => item.roles.includes(user?.role))
  }

  const menuItems = getMenuItems()

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out',
          'lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <img 
                src="/learnovo.png" 
                alt="Learnovo Logo" 
                className="h-8 w-8 object-contain"
                onError={(e) => {
                  // Fallback to icon if logo fails to load
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'flex';
                }}
              />
              <div className="h-8 w-8 bg-primary-500 rounded-lg items-center justify-center hidden">
                <GraduationCap className="h-5 w-5 text-white" />
              </div>
            </div>
            <div className="ml-3">
              <h1 className="text-lg font-semibold text-gray-900">Learnovo</h1>
            </div>
          </div>
          <button
            onClick={onClose}
            className="md:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="mt-8 px-4">
          <div className="space-y-2">
            {menuItems.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive }) =>
                  `group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
                    isActive
                      ? 'bg-primary-50 text-primary-700 border-r-2 border-primary-500'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`
                }
                onClick={() => {
                  if (window.innerWidth < 768) {
                    onClose()
                  }
                }}
              >
                <item.icon
                  className={`mr-3 h-5 w-5 flex-shrink-0 ${
                    location.pathname === item.href
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
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
          <div className="flex items-center mb-4">
            <div className="flex-shrink-0">
              <div className="h-8 w-8 bg-gray-300 rounded-full flex items-center justify-center">
                <span className="text-sm font-medium text-gray-700">
                  {user?.name?.charAt(0)?.toUpperCase()}
                </span>
              </div>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-900">{user?.name}</p>
              {user?.admissionNumber && (
                <p className="text-xs font-mono text-teal-600">{user.admissionNumber}</p>
              )}
              <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
            </div>
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
