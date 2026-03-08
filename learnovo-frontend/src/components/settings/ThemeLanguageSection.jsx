import React from 'react'
import { Palette, Sun, Moon } from 'lucide-react'

const ThemeLanguageSection = ({ form, updateField }) => {
    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
                <Palette className="h-6 w-6 text-primary-600" />
                <div>
                    <h2 className="text-xl font-semibold text-gray-900">Theme & Language</h2>
                    <p className="text-sm text-gray-500">Customize appearance and language preferences</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Theme Mode */}
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <h3 className="text-sm font-medium text-gray-900 mb-4">Theme Mode</h3>
                    <div className="space-y-3">
                        <label className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-primary-500 transition-colors">
                            <input
                                type="radio"
                                name="themeMode"
                                value="light"
                                checked={form.theme?.mode === 'light'}
                                onChange={(e) => updateField('theme.mode', e.target.value)}
                                className="text-primary-600 focus:ring-primary-500"
                            />
                            <Sun className="h-5 w-5 text-yellow-500" />
                            <div className="flex-1">
                                <p className="text-sm font-medium text-gray-900">Light Mode</p>
                                <p className="text-xs text-gray-500">Classic bright theme</p>
                            </div>
                        </label>
                        <label className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-primary-500 transition-colors">
                            <input
                                type="radio"
                                name="themeMode"
                                value="dark"
                                checked={form.theme?.mode === 'dark'}
                                onChange={(e) => updateField('theme.mode', e.target.value)}
                                className="text-primary-600 focus:ring-primary-500"
                            />
                            <Moon className="h-5 w-5 text-indigo-500" />
                            <div className="flex-1">
                                <p className="text-sm font-medium text-gray-900">Dark Mode</p>
                                <p className="text-xs text-gray-500">Easy on the eyes</p>
                            </div>
                        </label>
                    </div>
                </div>

                {/* Language */}
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <h3 className="text-sm font-medium text-gray-900 mb-4">Language</h3>
                    <div>
                        <label className="label">Interface Language</label>
                        <select
                            className="input"
                            value={form.theme?.language || 'en'}
                            onChange={(e) => updateField('theme.language', e.target.value)}
                        >
                            <option value="en">English</option>
                            <option value="hi">हिन्दी (Hindi)</option>
                            <option value="mr">मराठी (Marathi)</option>
                            <option value="gu">ગુજરાતી (Gujarati)</option>
                            <option value="ta">தமிழ் (Tamil)</option>
                            <option value="te">తెలుగు (Telugu)</option>
                        </select>
                        <p className="text-xs text-gray-500 mt-2">
                            Select the default language for the interface
                        </p>
                    </div>
                </div>

                {/* Primary Color */}
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <h3 className="text-sm font-medium text-gray-900 mb-4">Primary Color</h3>
                    <div className="flex items-center gap-4">
                        <input
                            type="color"
                            className="h-12 w-20 rounded border border-gray-300 cursor-pointer"
                            value={form.theme?.primaryColor || '#3EC4B1'}
                            onChange={(e) => updateField('theme.primaryColor', e.target.value)}
                        />
                        <div className="flex-1">
                            <input
                                type="text"
                                className="input"
                                value={form.theme?.primaryColor || '#3EC4B1'}
                                onChange={(e) => updateField('theme.primaryColor', e.target.value)}
                                placeholder="#3EC4B1"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Main brand color used throughout the app
                            </p>
                        </div>
                    </div>
                </div>

                {/* Secondary Color */}
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <h3 className="text-sm font-medium text-gray-900 mb-4">Secondary Color</h3>
                    <div className="flex items-center gap-4">
                        <input
                            type="color"
                            className="h-12 w-20 rounded border border-gray-300 cursor-pointer"
                            value={form.theme?.secondaryColor || '#2355A6'}
                            onChange={(e) => updateField('theme.secondaryColor', e.target.value)}
                        />
                        <div className="flex-1">
                            <input
                                type="text"
                                className="input"
                                value={form.theme?.secondaryColor || '#2355A6'}
                                onChange={(e) => updateField('theme.secondaryColor', e.target.value)}
                                placeholder="#2355A6"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Accent color for secondary elements
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <p className="text-sm text-blue-800">
                    <strong>Note:</strong> Theme changes apply instantly. Color changes may require a page refresh to fully apply.
                </p>
            </div>
        </div>
    )
}

export default ThemeLanguageSection
