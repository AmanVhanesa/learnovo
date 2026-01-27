import React, { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import NotificationDropdown from './NotificationDropdown';
import notificationsService from '../services/notificationsService';

const NotificationBell = () => {
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Fetch unread count on mount and every 30 seconds
    useEffect(() => {
        fetchUnreadCount();
        const interval = setInterval(fetchUnreadCount, 30000); // Poll every 30 seconds
        return () => clearInterval(interval);
    }, []);

    const fetchUnreadCount = async () => {
        try {
            setIsLoading(true);
            const response = await notificationsService.getUnreadCount();
            if (response.success) {
                setUnreadCount(response.data.count);
            }
        } catch (error) {
            console.error('Error fetching unread count:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleToggle = () => {
        setIsOpen(!isOpen);
    };

    const handleClose = () => {
        setIsOpen(false);
    };

    const handleNotificationRead = () => {
        // Refresh unread count when a notification is marked as read
        fetchUnreadCount();
    };

    return (
        <div className="relative">
            {/* Bell Icon Button */}
            <button
                onClick={handleToggle}
                className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors duration-200"
                aria-label="Notifications"
            >
                <Bell className="h-5 w-5" />

                {/* Unread Badge */}
                {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex items-center justify-center rounded-full h-4 w-4 bg-red-500 text-[10px] font-semibold text-white">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    </span>
                )}
            </button>

            {/* Dropdown */}
            {isOpen && (
                <NotificationDropdown
                    onClose={handleClose}
                    onNotificationRead={handleNotificationRead}
                />
            )}
        </div>
    );
};

export default NotificationBell;
