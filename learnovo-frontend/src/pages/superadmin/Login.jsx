import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSuperAdminAuth } from '../../contexts/SuperAdminContext'
import { Eye, EyeOff } from 'lucide-react'

const SuperAdminLogin = () => {
    const [formData, setFormData] = useState({
        email: '',
        password: ''
    })
    const [showPassword, setShowPassword] = useState(false)
    const [isLoading, setIsLoading] = useState(false)

    const { login, isAuthenticated, isLoading: authLoading, error, clearError } = useSuperAdminAuth()
    const navigate = useNavigate()

    useEffect(() => {
        if (isAuthenticated && !authLoading && !isLoading) {
            navigate('/super-admin/dashboard', { replace: true })
        }
    }, [isAuthenticated, authLoading, isLoading, navigate])

    useEffect(() => {
        clearError()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const handleChange = (e) => {
        const { name, value } = e.target
        setFormData(prev => ({ ...prev, [name]: value }))
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setIsLoading(true)

        try {
            const result = await login(formData)
            if (result && result.success) {
                setIsLoading(false)
                setTimeout(() => navigate('/super-admin/dashboard', { replace: true }), 300)
            } else {
                setIsLoading(false)
            }
        } catch (err) {
            console.error('Super Admin Login error:', err)
            setIsLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex">
            {/* ── LEFT BRAND PANEL (Matches main app) ── */}
            <div
                className="hidden lg:flex lg:w-5/12 xl:w-1/2 flex-col justify-between p-12 text-white relative overflow-hidden"
                style={{ background: 'linear-gradient(145deg, #1a6b6b 0%, #2a9090 40%, #1e7a7a 100%)' }}
            >
                <div className="absolute -top-16 -left-16 w-72 h-72 rounded-full opacity-10"
                    style={{ background: 'radial-gradient(circle, #ffffff 0%, transparent 70%)' }} />
                <div className="absolute -bottom-24 -right-12 w-96 h-96 rounded-full opacity-10"
                    style={{ background: 'radial-gradient(circle, #ffffff 0%, transparent 70%)' }} />

                {/* Logo top-left */}
                <div className="flex items-center gap-3 relative z-10">
                    <img src="/logo-icon.png" alt="Learnovo" className="h-10 w-10 object-contain drop-shadow-md" />
                    <span className="text-2xl font-bold tracking-tight">Learnovo</span>
                </div>

                {/* Center tagline for Super Admin */}
                <div className="relative z-10">
                    <h1 className="text-4xl xl:text-5xl font-bold leading-tight mb-4">
                        Platform<br />Command Center
                    </h1>
                    <p className="text-white/75 text-lg leading-relaxed max-w-sm">
                        Manage tenants, subscriptions, and system-wide configurations from one place.
                    </p>

                    <div className="mt-8 flex flex-wrap gap-2">
                        {['Tenant Management', 'Billing & Plans', 'Audit Logs', 'Platform Metrics'].map(f => (
                            <span key={f} className="px-3 py-1 rounded-full text-sm font-medium"
                                style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}>
                                {f}
                            </span>
                        ))}
                    </div>
                </div>

                <p className="text-white/50 text-sm relative z-10">© 2025 Learnovo. All rights reserved.</p>
            </div>

            {/* ── RIGHT FORM PANEL ── */}
            <div
                className="flex-1 flex flex-col justify-center items-center px-6 py-12 sm:px-12"
                style={{ background: 'linear-gradient(150deg, #f8fffd 0%, #f0faf8 40%, #eaf6f6 100%)' }}
            >
                <div className="flex lg:hidden items-center gap-2 mb-8">
                    <img src="/logo-icon.png" alt="Learnovo" className="h-9 w-9 object-contain" />
                    <span className="text-xl font-bold text-gray-900">Learnovo</span>
                </div>

                <div className="w-full max-w-md">
                    {/* Card wrapper */}
                    <div className="bg-white rounded-2xl shadow-lg shadow-teal-100/60 border border-white/80 px-8 py-8 relative">

                        {/* Super Admin Badge */}
                        <div className="absolute -top-3 right-6 bg-red-100 border border-red-200 text-red-700 text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full shadow-sm">
                            Super Admin
                        </div>

                        {/* Heading */}
                        <div className="mb-7">
                            <h2 className="text-3xl font-bold text-gray-900 mb-1">Welcome back</h2>
                            <p className="text-gray-400 text-sm">Sign in to the platform portal</p>
                        </div>

                        <form className="space-y-5" onSubmit={handleSubmit}>
                            {/* Email */}
                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                                    Admin Email
                                </label>
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    value={formData.email}
                                    onChange={handleChange}
                                    className="input"
                                    placeholder="admin@learnovo.com"
                                />
                            </div>

                            {/* Password */}
                            <div>
                                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                                    Password
                                </label>
                                <div className="relative">
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
                                    <button
                                        type="button"
                                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                                        onClick={() => setShowPassword(!showPassword)}
                                    >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>

                            {/* Error */}
                            {error && (
                                <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3">
                                    <p className="text-sm font-medium text-red-700">{error}</p>
                                </div>
                            )}

                            {/* Submit */}
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full py-3 rounded-xl text-base font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-teal-200/60 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                                style={{ background: 'linear-gradient(135deg, #1a9090 0%, #0d7070 60%, #0a5f5f 100%)' }}
                            >
                                {isLoading ? (
                                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent mx-auto" />
                                ) : 'Sign in as Super Admin'}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default SuperAdminLogin
