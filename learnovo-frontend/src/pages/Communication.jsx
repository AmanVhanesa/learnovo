import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Megaphone, Settings, MessageSquare, FileText } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useNotifications } from '../contexts/NotificationContext'

const Communication = () => {
    const navigate = useNavigate()
    const { user } = useAuth()
    const { unreadCount } = useNotifications()

    const modules = [
        {
            title: 'Announcements',
            description: 'Broadcast important messages to students, teachers, and parents',
            icon: Megaphone,
            path: '/app/announcements',
            color: 'bg-purple-500',
            badge: null
        },
        {
            title: 'Circulars',
            description: 'Issue, share, print and archive official school circulars',
            icon: FileText,
            path: '/app/circulars',
            color: 'bg-teal-500',
            badge: null
        },
        {
            title: 'Notifications',
            description: 'View and manage all in-app notifications',
            icon: Bell,
            path: '/app/notifications',
            color: 'bg-indigo-500',
            badge: unreadCount > 0 ? unreadCount : null
        },
        {
            title: 'Notification Settings',
            description: 'Configure which notifications you want to receive',
            icon: Settings,
            path: '/app/notification-preferences',
            color: 'bg-gray-500',
            badge: null
        }
    ]

    return (
        <div className="space-y-4 sm:space-y-6">
            <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Communication</h1>
                <p className="text-sm text-gray-500 dark:text-[#8E8E93] mt-1">
                    {user?.role === 'admin'
                        ? 'Manage announcements and notifications for your school'
                        : 'View announcements and manage your notification preferences'}
                </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
                {modules.map((module, index) => (
                    <div
                        key={index}
                        onClick={() => navigate(module.path)}
                        className="bg-white dark:bg-white/[0.08] dark:border dark:border-white/[0.15] dark:shadow-[0_4px_24px_rgba(0,0,0,0.10)] rounded-2xl shadow-glass p-4 sm:p-6 cursor-pointer hover:shadow-glass-md transition-all hover:-translate-y-0.5 relative"
                    >
                        <div className={`w-12 h-12 rounded-xl ${module.color} bg-opacity-10 dark:bg-opacity-20 flex items-center justify-center mb-4`}>
                            <module.icon className={`w-6 h-6 ${module.color.replace('bg-', 'text-')}`} />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">{module.title}</h3>
                        <p className="text-gray-500 dark:text-[#8E8E93] text-sm">{module.description}</p>
                        {module.badge && (
                            <span className="absolute top-4 right-4 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                                {module.badge > 9 ? '9+' : module.badge}
                            </span>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}

export default Communication
