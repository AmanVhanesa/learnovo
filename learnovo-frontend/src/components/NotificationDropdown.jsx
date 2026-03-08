import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCircle, X, AlertTriangle, Info } from 'lucide-react';
import notificationsService from '../services/notificationsService';

const NotificationDropdown = ({ onClose, onNotificationRead }) => {
    const [notifications, setNotifications] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const dropdownRef = useRef(null);
    const navigate = useNavigate();

    useEffect(() => {
        fetchRecentNotifications();

        // Close dropdown when clicking outside
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    const fetchRecentNotifications = async () => {
        try {
            setIsLoading(true);
            const response = await notificationsService.getNotifications({ limit: 5 });
            if (response.success) {
                console.log('Notifications received:', response.data);
                // Log first notification to see structure
                if (response.data.length > 0) {
                    console.log('First notification:', response.data[0]);
                    console.log('createdAt value:', response.data[0].createdAt);
                    console.log('createdAt type:', typeof response.data[0].createdAt);
                }
                setNotifications(response.data);
            }
        } catch (error) {
            console.error('Error fetching notifications:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleNotificationClick = async (notification) => {
        try {
            // Mark as read if unread
            if (!notification.isRead) {
                await notificationsService.markAsRead(notification._id);
                onNotificationRead();
            }

            // Navigate to action URL if exists
            if (notification.actionUrl) {
                navigate(notification.actionUrl);
                onClose();
            }
        } catch (error) {
            console.error('Error handling notification click:', error);
        }
    };

    const handleMarkAllAsRead = async () => {
        try {
            await notificationsService.markAllAsRead();
            onNotificationRead();
            fetchRecentNotifications();
        } catch (error) {
            console.error('Error marking all as read:', error);
        }
    };

    const getNotificationIcon = (type) => {
        switch (type) {
            case 'success':
                return <CheckCircle className="h-5 w-5 text-green-500" />;
            case 'warning':
                return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
            case 'error':
                return <AlertTriangle className="h-5 w-5 text-red-500" />;
            default:
                return <Info className="h-5 w-5 text-blue-500" />;
        }
    };

    const getNotificationBgColor = (type, isRead) => {
        if (isRead) return 'bg-white';

        switch (type) {
            case 'success':
                return 'bg-green-50';
            case 'warning':
                return 'bg-yellow-50';
            case 'error':
                return 'bg-red-50';
            default:
                return 'bg-blue-50';
        }
    };

    const formatTimeAgo = (dateString) => {
        if (!dateString) return 'Unknown';

        const date = new Date(dateString);

        // Check if date is valid
        if (isNaN(date.getTime())) {
            console.error('Invalid date:', dateString);
            return 'Invalid Date';
        }

        const now = new Date();
        const diff = now - date;

        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
        return date.toLocaleDateString();
    };

    const unreadCount = notifications.filter(n => !n.isRead).length;

    return (
        <div
            ref={dropdownRef}
            className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-[600px] flex flex-col"
        >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <div>
                    <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
                    {unreadCount > 0 && (
                        <p className="text-xs text-gray-500 mt-0.5">
                            {unreadCount} unread
                        </p>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                        <button
                            onClick={handleMarkAllAsRead}
                            className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                        >
                            Mark all read
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className="p-1 text-gray-400 hover:text-gray-600 rounded"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* Notifications List */}
            <div className="flex-1 overflow-y-auto">
                {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <div className="loading-spinner"></div>
                    </div>
                ) : notifications.length === 0 ? (
                    <div className="text-center py-12">
                        <Bell className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-sm text-gray-500">No notifications yet</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {notifications.map((notification) => (
                            <div
                                key={notification._id}
                                onClick={() => handleNotificationClick(notification)}
                                className={`p-4 hover:bg-gray-50 transition-colors cursor-pointer ${getNotificationBgColor(notification.type, notification.isRead)
                                    }`}
                            >
                                <div className="flex items-start gap-3">
                                    {/* Icon */}
                                    <div className="flex-shrink-0 mt-0.5">
                                        {getNotificationIcon(notification.type)}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2">
                                            <h4 className={`text-sm font-medium ${!notification.isRead ? 'text-gray-900' : 'text-gray-600'
                                                }`}>
                                                {notification.title}
                                            </h4>
                                            {!notification.isRead && (
                                                <span className="flex-shrink-0 h-2 w-2 bg-primary-500 rounded-full mt-1.5"></span>
                                            )}
                                        </div>
                                        <p className={`mt-1 text-sm ${!notification.isRead ? 'text-gray-700' : 'text-gray-500'
                                            } line-clamp-2`}>
                                            {notification.message}
                                        </p>
                                        <div className="mt-2 flex items-center gap-2">
                                            <p className="text-xs text-gray-400">
                                                {formatTimeAgo(notification.createdAt)}
                                            </p>
                                            {notification.actionLabel && (
                                                <>
                                                    <span className="text-gray-300">•</span>
                                                    <span className="text-xs text-primary-600 font-medium">
                                                        {notification.actionLabel}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
                <div className="p-3 border-t border-gray-200 bg-gray-50">
                    <button
                        onClick={() => {
                            navigate('/app/notifications');
                            onClose();
                        }}
                        className="w-full text-center text-sm text-primary-600 hover:text-primary-700 font-medium py-2"
                    >
                        View all notifications
                    </button>
                </div>
            )}
        </div>
    );
};

export default NotificationDropdown;
