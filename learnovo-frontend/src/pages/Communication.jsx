import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Mail, MessageSquare, Megaphone } from 'lucide-react'

const Communication = () => {
    const navigate = useNavigate()

    const modules = [
        {
            title: 'Notifications',
            description: 'Send in-app notifications to users',
            icon: Bell,
            path: '/app/notifications',
            color: 'bg-indigo-500'
        },
        {
            title: 'Email',
            description: 'Send email broadcasts',
            icon: Mail,
            path: '/app/communication/email',
            color: 'bg-blue-500'
        },
        {
            title: 'Announcements',
            description: 'Broadcast messages to students, teachers, and parents',
            icon: Megaphone,
            path: '/app/announcements',
            color: 'bg-purple-500'
        }
    ]

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-900">Communication</h1>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {modules.map((module, index) => (
                    <div
                        key={index}
                        onClick={() => navigate(module.path)}
                        className="bg-white rounded-lg shadow-sm p-6 cursor-pointer hover:shadow-md transition-shadow"
                    >
                        <div className={`w-12 h-12 rounded-lg ${module.color} bg-opacity-10 flex items-center justify-center mb-4`}>
                            <module.icon className={`w-6 h-6 ${module.color.replace('bg-', 'text-')}`} />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">{module.title}</h3>
                        <p className="text-gray-500 text-sm">{module.description}</p>
                    </div>
                ))}
            </div>
        </div>
    )
}

export default Communication
