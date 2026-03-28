import React, { useState, useEffect } from 'react'
import { Bell, Mail, MessageSquare, LayoutDashboard, Save, Loader } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { settingsService } from '../../services/settingsService'
import toast from 'react-hot-toast'

const NotificationSettingsSection = () => {
    const queryClient = useQueryClient()
    const [notifSettings, setNotifSettings] = useState({
        email: {
            enabled: true,
            reminderDays: [7, 3, 1],
            overdueReminderDays: [1, 3, 7],
            templates: {
                feeReminder: 'Your fee payment is due on {dueDate}',
                feeOverdue: 'Your fee payment is overdue. Please pay immediately.',
                admissionApproved: 'Congratulations! Your admission has been approved.',
                admissionRejected: 'We regret to inform you that your admission has been rejected.'
            }
        },
        sms: {
            enabled: false,
            senderId: ''
        },
        dashboard: {
            enabled: true,
            showOverdueFees: true,
            showUpcomingFees: true
        }
    })

    const { data: settingsData, isLoading } = useQuery({
        queryKey: ['settings'],
        queryFn: () => settingsService.getSettings(),
    })

    useEffect(() => {
        if (settingsData?.success && settingsData.data?.notifications) {
            const n = settingsData.data.notifications
            setNotifSettings(prev => ({
                email: { ...prev.email, ...n.email, templates: { ...prev.email.templates, ...n.email?.templates } },
                sms: { ...prev.sms, ...n.sms },
                dashboard: { ...prev.dashboard, ...n.dashboard }
            }))
        }
    }, [settingsData])

    const saveMutation = useMutation({
        mutationFn: (data) => settingsService.updateNotifications(data),
        onSuccess: (data) => {
            if (data.success) {
                toast.success('Notification settings saved successfully')
                queryClient.invalidateQueries({ queryKey: ['settings'] })
            } else {
                toast.error(data.message || 'Failed to save notification settings')
            }
        },
        onError: (error) => {
            toast.error(error.response?.data?.message || 'Failed to save notification settings')
        }
    })

    const handleSave = () => {
        saveMutation.mutate({
            email: {
                enabled: notifSettings.email.enabled,
                reminderDays: notifSettings.email.reminderDays,
                overdueReminderDays: notifSettings.email.overdueReminderDays,
                templates: notifSettings.email.templates
            },
            sms: {
                enabled: notifSettings.sms.enabled,
                senderId: notifSettings.sms.senderId
            },
            dashboard: notifSettings.dashboard
        })
    }

    const updateEmailField = (field, value) => {
        setNotifSettings(prev => ({
            ...prev,
            email: { ...prev.email, [field]: value }
        }))
    }

    const updateTemplate = (key, value) => {
        setNotifSettings(prev => ({
            ...prev,
            email: { ...prev.email, templates: { ...prev.email.templates, [key]: value } }
        }))
    }

    const updateDays = (field, value) => {
        const days = value.split(',').map(d => parseInt(d.trim())).filter(d => !isNaN(d) && d > 0)
        updateEmailField(field, days)
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-32">
                <Loader className="h-6 w-6 animate-spin text-teal-600" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <Bell className="h-6 w-6 text-primary-600" />
                    <div>
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Notification Settings</h2>
                        <p className="text-sm text-gray-500 dark:text-[#8E8E93]">Configure how notifications are sent to users</p>
                    </div>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saveMutation.isPending}
                    className="btn btn-primary"
                >
                    {saveMutation.isPending ? (
                        <><Loader className="h-4 w-4 animate-spin mr-2" /> Saving...</>
                    ) : (
                        <><Save className="h-4 w-4 mr-2" /> Save</>
                    )}
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Email Notifications */}
                <div className="bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#38383A] rounded-2xl p-4 sm:p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <Mail className="h-5 w-5 text-blue-600" />
                            <h3 className="text-sm font-medium text-gray-900 dark:text-white">Email Notifications</h3>
                        </div>
                        <button
                            type="button"
                            onClick={() => updateEmailField('enabled', !notifSettings.email.enabled)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                notifSettings.email.enabled ? 'bg-primary-600' : 'bg-gray-200 dark:bg-[#38383A]'
                            }`}
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white dark:bg-[#1C1C1E] shadow-sm transition-transform ${
                                notifSettings.email.enabled ? 'translate-x-6' : 'translate-x-1'
                            }`} />
                        </button>
                    </div>

                    {notifSettings.email.enabled && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-700 dark:text-[#8E8E93] mb-1">
                                    Fee Reminder Days (before due date)
                                </label>
                                <input
                                    type="text"
                                    value={notifSettings.email.reminderDays?.join(', ') || ''}
                                    onChange={(e) => updateDays('reminderDays', e.target.value)}
                                    placeholder="e.g. 7, 3, 1"
                                    className="input"
                                />
                                <p className="text-xs text-gray-400 dark:text-[#636366] mt-1">Comma-separated days before due date</p>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 dark:text-[#8E8E93] mb-1">
                                    Overdue Reminder Days (after due date)
                                </label>
                                <input
                                    type="text"
                                    value={notifSettings.email.overdueReminderDays?.join(', ') || ''}
                                    onChange={(e) => updateDays('overdueReminderDays', e.target.value)}
                                    placeholder="e.g. 1, 3, 7"
                                    className="input"
                                />
                                <p className="text-xs text-gray-400 dark:text-[#636366] mt-1">Comma-separated days after due date</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* SMS Notifications */}
                <div className="bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#38383A] rounded-2xl p-4 sm:p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <MessageSquare className="h-5 w-5 text-green-600" />
                            <h3 className="text-sm font-medium text-gray-900 dark:text-white">SMS Notifications</h3>
                        </div>
                        <button
                            type="button"
                            onClick={() => setNotifSettings(prev => ({
                                ...prev,
                                sms: { ...prev.sms, enabled: !prev.sms.enabled }
                            }))}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                notifSettings.sms.enabled ? 'bg-primary-600' : 'bg-gray-200 dark:bg-[#38383A]'
                            }`}
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white dark:bg-[#1C1C1E] shadow-sm transition-transform ${
                                notifSettings.sms.enabled ? 'translate-x-6' : 'translate-x-1'
                            }`} />
                        </button>
                    </div>

                    {notifSettings.sms.enabled && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-700 dark:text-[#8E8E93] mb-1">
                                    Sender ID
                                </label>
                                <input
                                    type="text"
                                    value={notifSettings.sms.senderId || ''}
                                    onChange={(e) => setNotifSettings(prev => ({
                                        ...prev,
                                        sms: { ...prev.sms, senderId: e.target.value }
                                    }))}
                                    placeholder="e.g. LRNOVO"
                                    className="input"
                                />
                                <p className="text-xs text-gray-400 dark:text-[#636366] mt-1">6-character alphanumeric sender ID</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Dashboard Notifications */}
                <div className="bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#38383A] rounded-2xl p-4 sm:p-6 lg:col-span-2">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <LayoutDashboard className="h-5 w-5 text-purple-600" />
                            <h3 className="text-sm font-medium text-gray-900 dark:text-white">Dashboard Notifications</h3>
                        </div>
                        <button
                            type="button"
                            onClick={() => setNotifSettings(prev => ({
                                ...prev,
                                dashboard: { ...prev.dashboard, enabled: !prev.dashboard.enabled }
                            }))}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                notifSettings.dashboard.enabled ? 'bg-primary-600' : 'bg-gray-200 dark:bg-[#38383A]'
                            }`}
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white dark:bg-[#1C1C1E] shadow-sm transition-transform ${
                                notifSettings.dashboard.enabled ? 'translate-x-6' : 'translate-x-1'
                            }`} />
                        </button>
                    </div>

                    {notifSettings.dashboard.enabled && (
                        <div className="flex flex-col sm:flex-row gap-4">
                            <label className="flex items-center gap-3 cursor-pointer flex-1 p-3 rounded-xl border border-gray-200 dark:border-[#38383A] hover:bg-gray-50 dark:hover:bg-[#2C2C2E]">
                                <input
                                    type="checkbox"
                                    checked={notifSettings.dashboard.showOverdueFees}
                                    onChange={(e) => setNotifSettings(prev => ({
                                        ...prev,
                                        dashboard: { ...prev.dashboard, showOverdueFees: e.target.checked }
                                    }))}
                                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                />
                                <div>
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">Show Overdue Fees</p>
                                    <p className="text-xs text-gray-500 dark:text-[#8E8E93]">Display overdue fee alerts on dashboard</p>
                                </div>
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer flex-1 p-3 rounded-xl border border-gray-200 dark:border-[#38383A] hover:bg-gray-50 dark:hover:bg-[#2C2C2E]">
                                <input
                                    type="checkbox"
                                    checked={notifSettings.dashboard.showUpcomingFees}
                                    onChange={(e) => setNotifSettings(prev => ({
                                        ...prev,
                                        dashboard: { ...prev.dashboard, showUpcomingFees: e.target.checked }
                                    }))}
                                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                />
                                <div>
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">Show Upcoming Fees</p>
                                    <p className="text-xs text-gray-500 dark:text-[#8E8E93]">Display upcoming fee reminders on dashboard</p>
                                </div>
                            </label>
                        </div>
                    )}
                </div>
            </div>

            {/* Email Templates */}
            {notifSettings.email.enabled && (
                <div className="bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#38383A] rounded-2xl p-4 sm:p-6">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4">Email Templates</h3>
                    <p className="text-xs text-gray-500 dark:text-[#8E8E93] mb-4">
                        Use variables like {'{dueDate}'}, {'{amount}'}, {'{studentName}'} in your templates
                    </p>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-[#8E8E93] mb-1">Fee Reminder</label>
                            <textarea
                                value={notifSettings.email.templates?.feeReminder || ''}
                                onChange={(e) => updateTemplate('feeReminder', e.target.value)}
                                rows={2}
                                className="input"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-[#8E8E93] mb-1">Fee Overdue</label>
                            <textarea
                                value={notifSettings.email.templates?.feeOverdue || ''}
                                onChange={(e) => updateTemplate('feeOverdue', e.target.value)}
                                rows={2}
                                className="input"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-[#8E8E93] mb-1">Admission Approved</label>
                            <textarea
                                value={notifSettings.email.templates?.admissionApproved || ''}
                                onChange={(e) => updateTemplate('admissionApproved', e.target.value)}
                                rows={2}
                                className="input"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-[#8E8E93] mb-1">Admission Rejected</label>
                            <textarea
                                value={notifSettings.email.templates?.admissionRejected || ''}
                                onChange={(e) => updateTemplate('admissionRejected', e.target.value)}
                                rows={2}
                                className="input"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default NotificationSettingsSection
