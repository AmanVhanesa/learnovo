import React, { useState, useCallback, useRef } from 'react';
import { Bell } from 'lucide-react';
import NotificationDropdown from './NotificationDropdown';
import { useNotifications } from '../contexts/NotificationContext';

const NotificationBell = () => {
    const { unreadCount } = useNotifications();
    const [isOpen, setIsOpen] = useState(false);
    const bellRef = useRef(null);

    const handleToggle = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsOpen(prev => !prev);
    }, []);

    const handleClose = useCallback(() => {
        setIsOpen(false);
    }, []);

    return (
        <div className="relative" ref={bellRef}>
            <button
                onClick={handleToggle}
                type="button"
                className={`relative p-2 rounded-xl transition-all duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                    isOpen
                        ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400'
                        : 'text-gray-500 dark:text-[#8E8E93] hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#2C2C2E]'
                }`}
                aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
            >
                <Bell className="h-5 w-5" />

                {/* Unread badge */}
                {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center h-[18px] min-w-[18px] px-1 rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white dark:ring-dark-card pointer-events-none tabular-nums">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <NotificationDropdown onClose={handleClose} bellRef={bellRef} />
            )}
        </div>
    );
};

export default NotificationBell;
