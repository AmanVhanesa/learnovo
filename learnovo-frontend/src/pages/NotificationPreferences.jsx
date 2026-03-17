import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Bell, Check, X, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import notificationsService from '../services/notificationsService';

const DEFAULT_PREFERENCES = {
    admission: { inApp: true },
    fee: { inApp: true },
    academic: { inApp: true },
    attendance: { inApp: true },
    employee: { inApp: true },
    exam: { inApp: true },
    announcement: { inApp: true },
    system: { inApp: true }
};

const NotificationPreferences = () => {
    const navigate = useNavigate();
    const [preferences, setPreferences] = useState(null);

    const categories = [
        { key: 'admission', label: 'Admissions', description: 'New admissions, approvals, and rejections' },
        { key: 'fee', label: 'Fees', description: 'Fee invoices, payments, and reminders' },
        { key: 'academic', label: 'Academic', description: 'Assignments, homework, and class updates' },
        { key: 'attendance', label: 'Attendance', description: 'Attendance updates and absence alerts' },
        { key: 'exam', label: 'Exams', description: 'Exam schedules, results, and report cards' },
        { key: 'announcement', label: 'Announcements', description: 'School-wide announcements and notices' },
        { key: 'system', label: 'System', description: 'System updates and maintenance notices' }
    ];

    const { data: prefsData, isLoading: loading } = useQuery({
        queryKey: ['notification-preferences'],
        queryFn: async () => {
            try {
                const response = await notificationsService.getPreferences();
                return response.data || { preferences: DEFAULT_PREFERENCES };
            } catch {
                console.warn('Preferences endpoint not available, using defaults');
                return { preferences: DEFAULT_PREFERENCES };
            }
        },
    });

    // Sync fetched preferences into local state
    useEffect(() => {
        if (prefsData) {
            setPreferences(prefsData);
        }
    }, [prefsData]);

    const saveMutation = useMutation({
        mutationFn: (prefs) => notificationsService.updatePreferences(prefs),
        onSuccess: () => {
            toast.success('Preferences saved successfully');
        },
        onError: (error) => {
            if (error.response?.status === 404) {
                localStorage.setItem('notificationPreferences', JSON.stringify(preferences.preferences));
                toast.success('Preferences saved locally');
            } else {
                toast.error('Failed to save preferences');
            }
        }
    });

    const handleToggle = (category) => {
        setPreferences(prev => ({
            ...prev,
            preferences: {
                ...prev.preferences,
                [category]: {
                    ...prev.preferences[category],
                    inApp: !prev.preferences[category]?.inApp
                }
            }
        }));
    };

    const handleSave = () => {
        saveMutation.mutate(preferences.preferences);
    };

    const enabledCount = preferences
        ? Object.values(preferences.preferences || {}).filter(p => p?.inApp).length
        : 0;

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3 sm:gap-4">
                <button
                    onClick={() => navigate(-1)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-[#2C2C2E] rounded-lg flex-shrink-0"
                >
                    <ArrowLeft className="h-5 w-5 text-gray-500 dark:text-[#8E8E93]" />
                </button>
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Notification Preferences</h1>
                    <p className="text-sm text-gray-500 dark:text-[#8E8E93] mt-1">
                        Choose which notifications you want to receive ({enabledCount}/{categories.length} enabled)
                    </p>
                </div>
            </div>

            {/* Preferences List */}
            <div className="card overflow-hidden divide-y divide-gray-100 dark:divide-dark-border">
                {categories.map((category) => {
                    const isEnabled = preferences?.preferences?.[category.key]?.inApp !== false;
                    return (
                        <div key={category.key} className="flex items-center justify-between px-4 sm:px-6 py-4 hover:bg-gray-50 dark:hover:bg-[#2C2C2E]/50">
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 dark:text-white">{category.label}</p>
                                <p className="text-xs text-gray-500 dark:text-[#8E8E93] mt-0.5">{category.description}</p>
                            </div>
                            <button
                                onClick={() => handleToggle(category.key)}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ml-4 flex-shrink-0 ${
                                    isEnabled
                                        ? 'bg-primary-600'
                                        : 'bg-gray-200 dark:bg-[#38383A]'
                                }`}
                            >
                                <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white dark:bg-[#1C1C1E] shadow-sm transition-transform ${
                                        isEnabled ? 'translate-x-6' : 'translate-x-1'
                                    }`}
                                />
                            </button>
                        </div>
                    );
                })}
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
                <button
                    onClick={handleSave}
                    disabled={saveMutation.isPending}
                    className="btn btn-primary px-6 w-full sm:w-auto"
                >
                    {saveMutation.isPending ? 'Saving...' : 'Save Preferences'}
                </button>
            </div>
        </div>
    );
};

export default NotificationPreferences;
