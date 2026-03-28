import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Bell, CheckCheck, X, AlertTriangle, Info,
    CheckCircle2, ArrowRight, Sparkles
} from 'lucide-react';
import { useNotifications } from '../contexts/NotificationContext';
import { formatDateCompact } from '../utils/formatDate';

const TYPE_CONFIG = {
    success: {
        icon: CheckCircle2,
        iconColor: 'text-emerald-500',
        bg: 'bg-emerald-50 dark:bg-emerald-500/10',
        ring: 'ring-emerald-100 dark:ring-emerald-500/20',
        dot: 'bg-emerald-500',
    },
    warning: {
        icon: AlertTriangle,
        iconColor: 'text-amber-500',
        bg: 'bg-amber-50 dark:bg-amber-500/10',
        ring: 'ring-amber-100 dark:ring-amber-500/20',
        dot: 'bg-amber-500',
    },
    error: {
        icon: AlertTriangle,
        iconColor: 'text-red-500',
        bg: 'bg-red-50 dark:bg-red-500/10',
        ring: 'ring-red-100 dark:ring-red-500/20',
        dot: 'bg-red-500',
    },
    info: {
        icon: Info,
        iconColor: 'text-blue-500',
        bg: 'bg-blue-50 dark:bg-blue-500/10',
        ring: 'ring-blue-100 dark:ring-blue-500/20',
        dot: 'bg-blue-500',
    },
};

const formatTimeAgo = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const diff = now - date;
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return formatDateCompact(date);
};

const NotificationDropdown = ({ onClose, bellRef }) => {
    const {
        unreadCount,
        recentNotifications: notifications,
        fetchRecentNotifications,
        markAsRead,
        markAllAsRead,
        refresh
    } = useNotifications();
    const dropdownRef = useRef(null);
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            refresh();
            await fetchRecentNotifications();
            if (!cancelled) setIsLoading(false);
        })();

        const handleClickOutside = (event) => {
            if (
                dropdownRef.current && !dropdownRef.current.contains(event.target) &&
                bellRef?.current && !bellRef.current.contains(event.target)
            ) {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            cancelled = true;
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [onClose, bellRef, fetchRecentNotifications, refresh]);

    const handleNotificationClick = useCallback((notification) => {
        if (!notification.isRead) {
            markAsRead(notification._id);
        }
        if (notification.actionUrl) {
            navigate(notification.actionUrl);
            onClose();
        }
    }, [markAsRead, navigate, onClose]);

    const handleMarkAllAsRead = useCallback(async () => {
        await markAllAsRead();
    }, [markAllAsRead]);

    const getConfig = (type) => TYPE_CONFIG[type] || TYPE_CONFIG.info;

    return (
        <div
            ref={dropdownRef}
            className="absolute right-0 sm:right-0 mt-2.5 w-[calc(100vw-1rem)] sm:w-[400px] max-w-[calc(100vw-1rem)] bg-white/95 dark:bg-[#1C1C1E] backdrop-blur-xl rounded-2xl shadow-glass-lg ring-1 ring-white dark:ring-[#1C1C1E] z-50 flex flex-col animate-slide-down overflow-hidden -mr-2 sm:mr-0"
            style={{ maxHeight: 'min(520px, calc(100vh - 6rem))' }}
        >
            {/* ── Header ── */}
            <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-2.5">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white tracking-tight">
                        Notifications
                    </h3>
                    {unreadCount > 0 && (
                        <span className="inline-flex items-center h-5 px-1.5 rounded-md bg-red-500/10 text-[11px] font-bold text-red-600 dark:text-red-400 tabular-nums">
                            {unreadCount} new
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-1">
                    {unreadCount > 0 && (
                        <button
                            onClick={handleMarkAllAsRead}
                            className="btn-ghost btn-sm flex items-center gap-1.5 text-xs text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg px-2.5 py-1.5"
                        >
                            <CheckCheck className="h-3.5 w-3.5" />
                            <span>Read all</span>
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#2C2C2E] transition-colors"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            </div>

            <div className="h-px bg-gray-100 dark:bg-[#38383A]" />

            {/* ── List ── */}
            <div className="flex-1 overflow-y-auto overscroll-contain">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-3">
                        <div className="loading-spinner" />
                        <p className="text-xs text-gray-400 dark:text-[#636366]">Loading notifications...</p>
                    </div>
                ) : notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-14 px-6">
                        <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-[#2C2C2E] flex items-center justify-center mb-4">
                            <Sparkles className="h-7 w-7 text-gray-300 dark:text-[#636366]" />
                        </div>
                        <p className="text-sm font-medium text-gray-500 dark:text-[#8E8E93]">All caught up!</p>
                        <p className="text-xs text-gray-400 dark:text-[#636366] mt-1">No new notifications</p>
                    </div>
                ) : (
                    <div>
                        {notifications.map((notification, index) => {
                            const config = getConfig(notification.type);
                            const Icon = config.icon;
                            const isUnread = !notification.isRead;

                            return (
                                <div
                                    key={notification._id}
                                    onClick={() => handleNotificationClick(notification)}
                                    className={`group relative flex items-start gap-3 px-5 py-3.5 cursor-pointer transition-all duration-150
                                        ${isUnread
                                            ? 'bg-primary-50/40 dark:bg-primary-500/[0.04]'
                                            : 'hover:bg-gray-50 dark:hover:bg-[#2C2C2E]/60'
                                        }
                                        ${index < notifications.length - 1 ? 'border-b border-gray-100/60 dark:border-[#2C2C2E]' : ''}
                                    `}
                                >
                                    {/* Unread indicator bar */}
                                    {isUnread && (
                                        <div className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full bg-primary-500" />
                                    )}

                                    {/* Icon */}
                                    <div className={`flex-shrink-0 w-9 h-9 rounded-xl ${config.bg} ring-1 ${config.ring} flex items-center justify-center mt-0.5`}>
                                        <Icon className={`h-4 w-4 ${config.iconColor}`} />
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2">
                                            <h4 className={`text-[13px] leading-snug ${isUnread ? 'font-semibold text-gray-900 dark:text-white' : 'font-medium text-gray-600 dark:text-[#8E8E93]'}`}>
                                                {notification.title}
                                            </h4>
                                            <span className="flex-shrink-0 text-[11px] text-gray-400 dark:text-[#636366] tabular-nums whitespace-nowrap mt-0.5">
                                                {formatTimeAgo(notification.createdAt)}
                                            </span>
                                        </div>
                                        <p className={`mt-0.5 text-xs leading-relaxed line-clamp-2 ${isUnread ? 'text-gray-600 dark:text-[#8E8E93]' : 'text-gray-400 dark:text-[#636366]'}`}>
                                            {notification.message}
                                        </p>
                                        {notification.actionLabel && (
                                            <span className="inline-flex items-center gap-1 mt-1.5 text-[11px] font-medium text-primary-600 dark:text-primary-400 group-hover:underline">
                                                {notification.actionLabel}
                                                <ArrowRight className="h-3 w-3" />
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ── Footer ── */}
            {notifications.length > 0 && (
                <>
                    <div className="h-px bg-gray-100 dark:bg-[#38383A]" />
                    <div className="px-5 py-3">
                        <button
                            onClick={() => {
                                navigate('/app/notifications');
                                onClose();
                            }}
                            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                        >
                            View all notifications
                            <ArrowRight className="h-4 w-4" />
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

export default NotificationDropdown;
