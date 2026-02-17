import React, { useState, useEffect } from 'react';
import { Bell, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';
import notificationsService from '../services/notificationsService';

const NotificationPreferences = () => {
    const [preferences, setPreferences] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const categories = [
        { key: 'admission', label: 'Admissions', description: 'New admissions, approvals, and rejections' },
        { key: 'fee', label: 'Fees', description: 'Fee invoices, payments, and reminders' },
        { key: 'academic', label: 'Academic', description: 'Assignments, exams, and results' },
        { key: 'attendance', label: 'Attendance', description: 'Attendance updates and absences' },
        { key: 'employee', label: 'Employee', description: 'Employee-related notifications' },
        { key: 'exam', label: 'Exams', description: 'Exam schedules and results' },
        { key: 'announcement', label: 'Announcements', description: 'School-wide announcements' },
        { key: 'system', label: 'System', description: 'System updates and maintenance' }
    ];

    useEffect(() => {
        fetchPreferences();
    }, []);

    const fetchPreferences = async () => {
        try {
            setLoading(true);
            const response = await notificationsService.getPreferences();
            setPreferences(response.data);
        } catch (error) {
            console.error('Error fetching preferences:', error);
            toast.error('Failed to load notification preferences');
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = (category, channel) => {
        setPreferences(prev => ({
            ...prev,
            preferences: {
                ...prev.preferences,
                [category]: {
                    ...prev.preferences[category],
                    [channel]: !prev.preferences[category]?.[channel]
                }
            }
        }));
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            await notificationsService.updatePreferences(preferences.preferences);
            toast.success('Preferences saved successfully');
        } catch (error) {
            console.error('Error saving preferences:', error);
            toast.error('Failed to save preferences');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (!preferences) {
        return (
            <div className="p-6">
                <div className="text-center py-12 bg-white rounded-lg shadow">
                    <Bell size={48} className="mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-600">Unable to load preferences</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-4xl mx-auto">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Notification Preferences</h1>
                <p className="text-gray-600 mt-1">Manage your notification settings for different categories</p>
            </div>

            {/* Info Alert */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                    <Bell className="text-blue-600 mt-0.5" size={20} />
                    <div>
                        <h3 className="font-medium text-blue-900">About Notifications</h3>
                        <p className="text-sm text-blue-700 mt-1">
                            Currently, only in-app notifications are enabled. Email and WhatsApp notifications are disabled as they require paid services.
                        </p>
                    </div>
                </div>
            </div>

            {/* Preferences Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Category
                            </th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                In-App
                            </th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Email
                            </th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                WhatsApp
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {categories.map((category) => (
                            <tr key={category.key} className="hover:bg-gray-50">
                                <td className="px-6 py-4">
                                    <div>
                                        <div className="font-medium text-gray-900">{category.label}</div>
                                        <div className="text-sm text-gray-500">{category.description}</div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <button
                                        onClick={() => handleToggle(category.key, 'inApp')}
                                        className={`inline-flex items-center justify-center w-10 h-10 rounded-full transition-colors ${preferences.preferences[category.key]?.inApp
                                                ? 'bg-green-100 text-green-600 hover:bg-green-200'
                                                : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                            }`}
                                    >
                                        {preferences.preferences[category.key]?.inApp ? (
                                            <Check size={20} />
                                        ) : (
                                            <X size={20} />
                                        )}
                                    </button>
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <button
                                        disabled
                                        className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 text-gray-300 cursor-not-allowed"
                                        title="Email notifications are currently disabled"
                                    >
                                        <X size={20} />
                                    </button>
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <button
                                        disabled
                                        className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 text-gray-300 cursor-not-allowed"
                                        title="WhatsApp notifications are currently disabled"
                                    >
                                        <X size={20} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Save Button */}
            <div className="mt-6 flex justify-end">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {saving ? 'Saving...' : 'Save Preferences'}
                </button>
            </div>
        </div>
    );
};

export default NotificationPreferences;
