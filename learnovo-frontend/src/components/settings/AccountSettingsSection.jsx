import React from 'react'
import { User, Globe, Calendar, Clock } from 'lucide-react'

const AccountSettingsSection = ({ form, updateField }) => {
    const timezones = [
        { value: 'Asia/Kolkata', label: 'India (IST)' },
        { value: 'America/New_York', label: 'New York (EST)' },
        { value: 'America/Los_Angeles', label: 'Los Angeles (PST)' },
        { value: 'Europe/London', label: 'London (GMT)' },
        { value: 'Asia/Dubai', label: 'Dubai (GST)' },
        { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
    ]

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
                <User className="h-6 w-6 text-primary-600" />
                <div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Account Settings</h2>
                    <p className="text-sm text-gray-500 dark:text-[#8E8E93]">Manage account preferences and regional settings</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Timezone */}
                <div className="bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#38383A] rounded-2xl p-4 sm:p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Globe className="h-5 w-5 text-gray-600 dark:text-[#8E8E93]" />
                        <h3 className="text-sm font-medium text-gray-900 dark:text-white">Timezone</h3>
                    </div>
                    <select
                        className="input"
                        value={form.account?.timezone || 'Asia/Kolkata'}
                        onChange={(e) => updateField('account.timezone', e.target.value)}
                    >
                        {timezones.map((tz) => (
                            <option key={tz.value} value={tz.value}>
                                {tz.label}
                            </option>
                        ))}
                    </select>
                    <p className="text-xs text-gray-500 dark:text-[#8E8E93] mt-2">
                        Affects attendance, exams, and report timestamps
                    </p>
                </div>

                {/* Date Format */}
                <div className="bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#38383A] rounded-2xl p-4 sm:p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Calendar className="h-5 w-5 text-gray-600 dark:text-[#8E8E93]" />
                        <h3 className="text-sm font-medium text-gray-900 dark:text-white">Date Format</h3>
                    </div>
                    <select
                        className="input"
                        value={form.account?.dateFormat || 'DD/MM/YYYY'}
                        onChange={(e) => updateField('account.dateFormat', e.target.value)}
                    >
                        <option value="DD/MM/YYYY">DD/MM/YYYY (31/12/2024)</option>
                        <option value="MM/DD/YYYY">MM/DD/YYYY (12/31/2024)</option>
                        <option value="YYYY-MM-DD">YYYY-MM-DD (2024-12-31)</option>
                    </select>
                    <p className="text-xs text-gray-500 dark:text-[#8E8E93] mt-2">
                        How dates are displayed throughout the system
                    </p>
                </div>

                {/* Time Format */}
                <div className="bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#38383A] rounded-2xl p-4 sm:p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Clock className="h-5 w-5 text-gray-600 dark:text-[#8E8E93]" />
                        <h3 className="text-sm font-medium text-gray-900 dark:text-white">Time Format</h3>
                    </div>
                    <div className="space-y-3">
                        <label className="flex items-center gap-3 p-3 border border-gray-200 dark:border-[#38383A] rounded-xl cursor-pointer hover:border-primary-500 transition-colors">
                            <input
                                type="radio"
                                name="timeFormat"
                                value="12h"
                                checked={form.account?.timeFormat === '12h'}
                                onChange={(e) => updateField('account.timeFormat', e.target.value)}
                                className="text-primary-600 focus:ring-primary-500"
                            />
                            <div>
                                <p className="text-sm font-medium text-gray-900 dark:text-white">12-hour</p>
                                <p className="text-xs text-gray-500 dark:text-[#8E8E93]">2:30 PM</p>
                            </div>
                        </label>
                        <label className="flex items-center gap-3 p-3 border border-gray-200 dark:border-[#38383A] rounded-xl cursor-pointer hover:border-primary-500 transition-colors">
                            <input
                                type="radio"
                                name="timeFormat"
                                value="24h"
                                checked={form.account?.timeFormat === '24h'}
                                onChange={(e) => updateField('account.timeFormat', e.target.value)}
                                className="text-primary-600 focus:ring-primary-500"
                            />
                            <div>
                                <p className="text-sm font-medium text-gray-900 dark:text-white">24-hour</p>
                                <p className="text-xs text-gray-500 dark:text-[#8E8E93]">14:30</p>
                            </div>
                        </label>
                    </div>
                </div>

                {/* Currency (from existing settings) */}
                <div className="bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#38383A] rounded-2xl p-4 sm:p-6">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4">Currency</h3>
                    <div className="space-y-3">
                        <div>
                            <label className="label">Default Currency</label>
                            <select
                                className="input"
                                value={form.currency?.default || 'INR'}
                                onChange={(e) => {
                                    const symbolMap = {
                                        'INR': '₹',
                                        'USD': '$',
                                        'EUR': '€',
                                        'GBP': '£'
                                    }
                                    updateField('currency.default', e.target.value)
                                    updateField('currency.symbol', symbolMap[e.target.value] || '₹')
                                }}
                            >
                                <option value="INR">Indian Rupee (₹)</option>
                                <option value="USD">US Dollar ($)</option>
                                <option value="EUR">Euro (€)</option>
                                <option value="GBP">British Pound (£)</option>
                            </select>
                        </div>
                        <div>
                            <label className="label">Symbol Position</label>
                            <select
                                className="input"
                                value={form.currency?.position || 'before'}
                                onChange={(e) => updateField('currency.position', e.target.value)}
                            >
                                <option value="before">Before Amount (₹100)</option>
                                <option value="after">After Amount (100₹)</option>
                            </select>
                        </div>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-[#8E8E93] mt-2">
                        Currency affects all fee displays and reports
                    </p>
                </div>
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-2xl p-4">
                <p className="text-sm text-yellow-800 dark:text-yellow-300">
                    <strong>Important:</strong> Changing timezone or date format affects how data is displayed system-wide. Existing records are not modified.
                </p>
            </div>
        </div>
    )
}

export default AccountSettingsSection
