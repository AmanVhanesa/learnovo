import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useSuperAdminAuth } from '../../contexts/SuperAdminContext'
import { useTheme } from '../../contexts/ThemeContext'
import { Eye, EyeOff, Sun, Moon, ArrowLeft } from 'lucide-react'
import { motion } from 'framer-motion'
import { HeroGeometric } from '../../components/ui/ShapeLandingHero'

const SuperAdminLogin = () => {
    const [formData, setFormData] = useState({ email: '', password: '' })
    const [showPassword, setShowPassword] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [formReady, setFormReady] = useState(false)
    const [rememberMe, setRememberMe] = useState(true)

    const { login, isAuthenticated, isLoading: authLoading, error, clearError } = useSuperAdminAuth()
    const { theme, toggleMode } = useTheme()
    const isDark = theme?.mode === 'dark'
    const navigate = useNavigate()

    useEffect(() => {
        if (isAuthenticated && !authLoading && !isLoading) {
            navigate('/super-admin/dashboard', { replace: true })
        }
    }, [isAuthenticated, authLoading, isLoading, navigate])

    useEffect(() => {
        const saved = localStorage.getItem('superadmin_remember_me')
        if (saved) {
            try {
                const { email } = JSON.parse(saved)
                setFormData(prev => ({ ...prev, email: email || '' }))
                setRememberMe(true)
            } catch (e) { /* ignore corrupt data */ }
        }
    }, [])

    useEffect(() => {
        clearError()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const handleChange = (e) => {
        const { name, value } = e.target
        setFormData(prev => ({ ...prev, [name]: value }))
        if (error) clearError()
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setIsLoading(true)

        if (rememberMe) {
            localStorage.setItem('superadmin_remember_me', JSON.stringify({ email: formData.email.trim() }))
        } else {
            localStorage.removeItem('superadmin_remember_me')
        }

        try {
            const result = await login(formData)
            if (result && result.success) {
                setIsLoading(false)
                setTimeout(() => navigate('/super-admin/dashboard', { replace: true }), 300)
            } else {
                setIsLoading(false)
            }
        } catch {
            setIsLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex overflow-hidden">
            {/* -- LEFT BRAND PANEL (matches main login exactly) -- */}
            <motion.div
                initial={{ opacity: 0, x: '-100%' }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.9, ease: [0.25, 0.4, 0.25, 1] }}
                className="hidden lg:block lg:w-5/12 xl:w-1/2 relative"
            >
                <HeroGeometric
                    title1="Platform"
                    title2="Administration"
                    description="Manage the entire Learnovo platform from one place."
                >
                    {/* Feature pills — same style as main login */}
                    <div className="flex flex-wrap gap-2 justify-center">
                        {['Schools', 'Analytics', 'Revenue', 'System Health'].map(f => (
                            <span key={f} className="px-3 py-1 rounded-full text-sm font-medium text-white/90"
                                style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)', border: '1px solid rgba(62,196,177,0.3)' }}>
                                {f}
                            </span>
                        ))}
                    </div>
                </HeroGeometric>

                {/* Logo overlay top-left */}
                <div className="absolute top-8 left-8 flex items-center gap-3 z-20">
                    <img src="/logo-icon.png" alt="Learnovo" className="h-10 w-10 object-contain drop-shadow-md" />
                    <span className="text-2xl font-bold tracking-tight text-white">Learnovo</span>
                </div>

                {/* Bottom caption */}
                <p className="absolute bottom-6 left-8 text-white/30 text-sm z-20">&copy; 2026 Learnovo. All rights reserved.</p>
            </motion.div>

            {/* -- RIGHT FORM PANEL (matches main login exactly) -- */}
            <motion.div
                initial={{ opacity: 0, x: '100%' }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.9, ease: [0.25, 0.4, 0.25, 1] }}
                className="flex-1 flex flex-col justify-center items-center px-4 sm:px-6 md:px-12 py-8 sm:py-12 relative"
                style={isDark ? { background: '#000000' } : { background: 'linear-gradient(150deg, #f8fffd 0%, #f0faf8 40%, #eaf6f6 100%)' }}
            >
                {/* Back to school login */}
                <button
                    type="button"
                    onClick={() => navigate('/login')}
                    className="absolute top-6 left-6 flex items-center gap-1.5 text-[13px] text-gray-400 dark:text-[#636366] hover:text-gray-600 dark:hover:text-white transition-colors z-10"
                >
                    <ArrowLeft className="h-4 w-4" />
                    <span>Back to school login</span>
                </button>

                {/* Dark/Light mode toggle */}
                <button
                    type="button"
                    onClick={toggleMode}
                    className="absolute top-6 right-6 p-2 rounded-full border transition-all duration-200 hover:scale-105 active:scale-95"
                    style={isDark
                        ? { background: '#1C1C1E', borderColor: '#38383A', color: '#FFD60A' }
                        : { background: '#ffffff', borderColor: '#e5e7eb', color: '#6b7280', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }
                    }
                    title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                >
                    {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </button>

                {/* Mobile-only logo */}
                <div className="flex lg:hidden items-center gap-2 mb-8">
                    <img src="/logo-icon.png" alt="Learnovo" className="h-9 w-9 object-contain" />
                    <span className="text-xl font-bold text-gray-900 dark:text-white">Learnovo</span>
                </div>

                <div className="w-full max-w-[380px]">
                    {/* Card wrapper — matches main login */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.7, delay: 0.9, ease: [0.25, 0.4, 0.25, 1] }}
                        onAnimationComplete={() => setFormReady(true)}
                        className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-lg shadow-teal-100/40 dark:shadow-black/20 border border-gray-100 dark:border-[#38383A] px-6 sm:px-7 py-6 sm:py-7 relative"
                    >
                        {/* Super Admin Badge */}
                        <div className="absolute -top-3 right-6 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full">
                            Super Admin
                        </div>

                        {/* Heading — matches main but different text */}
                        <div className="mb-6">
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Super Admin Access</h2>
                            <p className="text-gray-400 dark:text-[#8E8E93] text-[13px] mt-1">Platform administration credentials</p>
                        </div>

                        <form className="space-y-4" onSubmit={handleSubmit}>
                            {/* Email */}
                            <div>
                                <label htmlFor="email" className="block text-[13px] font-medium text-gray-600 dark:text-[#8E8E93] mb-1">
                                    Admin Email
                                </label>
                                {formReady ? (
                                    <input
                                        id="email"
                                        name="email"
                                        type="email"
                                        autoComplete="email"
                                        autoFocus
                                        required
                                        value={formData.email}
                                        onChange={handleChange}
                                        className="input"
                                        placeholder="admin@learnovo.com"
                                    />
                                ) : (
                                    <div className="input" style={{ minHeight: '42px' }} />
                                )}
                            </div>

                            {/* Password */}
                            <div>
                                <label htmlFor="password" className="block text-[13px] font-medium text-gray-600 dark:text-[#8E8E93] mb-1">
                                    Password
                                </label>
                                <div className="relative">
                                    {formReady ? (
                                        <input
                                            id="password"
                                            name="password"
                                            type={showPassword ? 'text' : 'password'}
                                            autoComplete="current-password"
                                            required
                                            value={formData.password}
                                            onChange={handleChange}
                                            className="input pr-10"
                                            placeholder="Enter your password"
                                        />
                                    ) : (
                                        <div className="input" style={{ minHeight: '42px' }} />
                                    )}
                                    {formReady && (
                                        <button
                                            type="button"
                                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 dark:text-[#636366] hover:text-gray-600 dark:hover:text-white transition-colors"
                                            onClick={() => setShowPassword(!showPassword)}
                                        >
                                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Remember me */}
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={rememberMe}
                                    onChange={(e) => {
                                        setRememberMe(e.target.checked)
                                        if (!e.target.checked) localStorage.removeItem('superadmin_remember_me')
                                    }}
                                    className="sr-only peer"
                                />
                                <div className="w-4 h-4 rounded border border-gray-300 dark:border-[#48484A] bg-white dark:bg-[#2C2C2E] peer-checked:bg-teal-500 peer-checked:border-teal-500 flex items-center justify-center transition-colors">
                                    {rememberMe && (
                                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>
                                    )}
                                </div>
                                <span className="text-[13px] text-gray-500 dark:text-[#8E8E93]">Remember me</span>
                            </label>

                            {/* Error */}
                            {error && (
                                <div className="rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 px-3.5 py-2.5">
                                    <p className="text-[13px] font-medium text-red-600 dark:text-red-400">{error}</p>
                                </div>
                            )}

                            {/* Submit — same teal gradient as main */}
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full py-2.5 rounded-full text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-teal-200/60 dark:hover:shadow-teal-900/40 active:scale-95 disabled:opacity-50 disabled:pointer-events-none mt-1"
                                style={{ background: 'linear-gradient(135deg, #3EC4B1 0%, #0ea5a3 60%, #0b8f8f 100%)' }}
                            >
                                {isLoading ? (
                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mx-auto" />
                                ) : 'Sign in as Super Admin'}
                            </button>
                        </form>
                    </motion.div>

                    {/* Back to school login link */}
                    <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 1.2, ease: [0.25, 0.4, 0.25, 1] }}
                        className="mt-6 text-center"
                    >
                        <Link to="/login" className="text-[13px] text-gray-400 dark:text-[#636366] hover:text-gray-600 dark:hover:text-white transition-colors">
                            &larr; Back to school login
                        </Link>
                    </motion.div>
                </div>
            </motion.div>
        </div>
    )
}

export default SuperAdminLogin
