import React from 'react'
import { Palette, Sun, Moon } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'

const ThemeLanguageSection = ({ form, updateField }) => {
    const { theme, toggleMode, updateTheme } = useTheme()

    const handleLanguageChange = (lang) => {
        updateField('theme.language', lang)
        updateTheme({ language: lang })
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
                <Palette className="h-6 w-6 text-primary-600" />
                <div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Theme & Language</h2>
                    <p className="text-sm text-gray-500 dark:text-[#8E8E93]">Customize appearance and language preferences</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Theme Mode */}
                <div className="bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#38383A] rounded-lg p-4 sm:p-6">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4">Theme Mode</h3>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            {theme.mode === 'dark' ? (
                                <Moon className="h-5 w-5 text-indigo-500" />
                            ) : (
                                <Sun className="h-5 w-5 text-yellow-500" />
                            )}
                            <div>
                                <p className="text-sm font-medium text-gray-900 dark:text-white">
                                    {theme.mode === 'dark' ? 'Dark Mode' : 'Light Mode'}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-[#8E8E93]">
                                    {theme.mode === 'dark' ? 'True black OLED theme' : 'Classic bright theme'}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={toggleMode}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-[#1C1C1E] ${
                                theme.mode === 'dark' ? 'bg-primary-500' : 'bg-gray-300'
                            }`}
                            role="switch"
                            aria-checked={theme.mode === 'dark'}
                        >
                            <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                                    theme.mode === 'dark' ? 'translate-x-6' : 'translate-x-1'
                                }`}
                            />
                        </button>
                    </div>
                    <p className="text-xs text-gray-400 dark:text-[#636366] mt-3">
                        You can also toggle theme using the button in the header bar.
                    </p>
                </div>

                {/* Language */}
                <div className="bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#38383A] rounded-lg p-4 sm:p-6">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4">Language</h3>
                    <div>
                        <label className="label dark:text-[#8E8E93]">Interface Language</label>
                        <select
                            className="input"
                            value={form.theme?.language || 'en'}
                            onChange={(e) => handleLanguageChange(e.target.value)}
                        >
                            <option value="en">English</option>
                            <option value="hi">हिन्दी (Hindi)</option>
                            <option value="mr">मराठी (Marathi)</option>
                            <option value="gu">ગુજરાતી (Gujarati)</option>
                            <option value="ta">தமிழ் (Tamil)</option>
                            <option value="te">తెలుగు (Telugu)</option>
                        </select>
                        <p className="text-xs text-gray-500 dark:text-[#8E8E93] mt-2">
                            Select the default language for the interface
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ThemeLanguageSection
