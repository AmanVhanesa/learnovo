import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { Eye, EyeOff, Sun, Moon } from 'lucide-react'
import { motion } from 'framer-motion'
import { HeroGeometric } from '../components/ui/ShapeLandingHero'

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    schoolCode: ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [formReady, setFormReady] = useState(false)

  const { login, isAuthenticated, isLoading: authLoading, error, clearError, user } = useAuth()
  const { theme, toggleMode } = useTheme()
  const isDark = theme?.mode === 'dark'
  const navigate = useNavigate()

  useEffect(() => {
    if (isAuthenticated && !authLoading && !isLoading) {
      navigate('/app/dashboard', { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, authLoading, isLoading, user])

  useEffect(() => {
    const savedCredentials = localStorage.getItem('learnovo_remember_me')
    if (savedCredentials) {
      try {
        const { email, schoolCode } = JSON.parse(savedCredentials)
        setFormData(prev => ({ ...prev, email: email || '', schoolCode: schoolCode || '' }))
        setRememberMe(true)
      } catch (e) {
      }
    }
  }, [])

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

    if (rememberMe) {
      localStorage.setItem('learnovo_remember_me', JSON.stringify({ email: formData.email, schoolCode: formData.schoolCode }))
    } else {
      localStorage.removeItem('learnovo_remember_me')
    }

    const loginData = { email: formData.email, password: formData.password }
    if (formData.schoolCode && formData.schoolCode.trim() !== '') {
      loginData.schoolCode = formData.schoolCode.trim()
    }

    try {
      const result = await login(loginData)
      if (result && result.success) {
        setIsLoading(false)
        const targetRoute = '/app/dashboard'
        setTimeout(() => navigate(targetRoute, { replace: true }), 300)
      } else {
        setIsLoading(false)
      }
    } catch (err) {
      setIsLoading(false)
    }
  }

  const handleDemoLogin = (role) => {
    const demoCredentials = {
      admin: { email: 'admin@learnovo.com', password: 'admin123', schoolCode: 'demo' },
      teacher: { email: 'sarah.wilson@learnovo.com', password: 'teacher123', schoolCode: 'demo' },
      student: { email: 'john.doe@learnovo.com', password: 'student123', schoolCode: 'demo' },
      parent: { email: 'parent@learnovo.com', password: 'parent123', schoolCode: 'demo' }
    }
    const credentials = demoCredentials[role]
    if (credentials) setFormData(prev => ({ ...prev, ...credentials }))
  }

  return (
    <div className="min-h-screen flex overflow-hidden">

      {/* ── LEFT BRAND PANEL ── */}
      <motion.div
        initial={{ opacity: 0, x: '-100%' }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.9, ease: [0.25, 0.4, 0.25, 1] }}
        className="hidden lg:block lg:w-5/12 xl:w-1/2 relative"
      >
        <HeroGeometric
          title1="Manage your school"
          title2="smarter."
          description="One platform for students, teachers, fees, attendance, and everything in between."
        >
          {/* Feature pills */}
          <div className="flex flex-wrap gap-2 justify-center">
            {['Student Management', 'Attendance', 'Fees & Finance', 'Reports'].map(f => (
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
        <p className="absolute bottom-6 left-8 text-white/30 text-sm z-20">&copy; 2025 Learnovo. All rights reserved.</p>
      </motion.div>

      {/* ── RIGHT FORM PANEL ── */}
      <motion.div
        initial={{ opacity: 0, x: '100%' }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.9, ease: [0.25, 0.4, 0.25, 1] }}
        className="flex-1 flex flex-col justify-center items-center px-4 sm:px-6 md:px-12 py-8 sm:py-12 relative"
        style={isDark ? { background: '#000000' } : { background: 'linear-gradient(150deg, #f8fffd 0%, #f0faf8 40%, #eaf6f6 100%)' }}
      >

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

          {/* Card wrapper */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.9, ease: [0.25, 0.4, 0.25, 1] }}
            onAnimationComplete={() => setFormReady(true)}
            className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-lg shadow-teal-100/40 dark:shadow-black/20 border border-gray-100 dark:border-[#38383A] px-6 sm:px-7 py-6 sm:py-7"
          >

            {/* Heading */}
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Welcome back</h2>
              <p className="text-gray-400 dark:text-[#8E8E93] text-[13px] mt-1">Sign in to your school account</p>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>

              {/* School Code */}
              <div>
                <label htmlFor="schoolCode" className="block text-[13px] font-medium text-gray-600 dark:text-[#8E8E93] mb-1">
                  School Code
                </label>
                {formReady ? (
                  <input
                    id="schoolCode"
                    name="schoolCode"
                    type="text"
                    autoFocus
                    value={formData.schoolCode}
                    onChange={handleChange}
                    className="input"
                    placeholder="e.g. spis"
                  />
                ) : (
                  <div className="input" style={{ minHeight: '42px' }} />
                )}
              </div>

              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-[13px] font-medium text-gray-600 dark:text-[#8E8E93] mb-1">
                  Email or Admission Number
                </label>
                {formReady ? (
                  <input
                    id="email"
                    name="email"
                    type="text"
                    autoComplete="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    className="input"
                    placeholder="Enter email or admission number"
                  />
                ) : (
                  <div className="input" style={{ minHeight: '42px' }} />
                )}
                <p className="mt-1 text-[11px] text-gray-400 dark:text-[#636366]">
                  Students can use their admission number if email is unavailable.
                </p>
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
              <label htmlFor="remember-me" className="flex items-center gap-2.5 cursor-pointer group py-0.5">
                <div className="relative flex items-center">
                  <input
                    id="remember-me"
                    name="remember-me"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="peer sr-only"
                  />
                  <div className="h-[18px] w-[18px] rounded-md border-2 border-gray-300 dark:border-[#48484A] bg-white dark:bg-[#2C2C2E] peer-checked:border-[#3EC4B1] peer-checked:bg-[#3EC4B1] transition-all duration-150 flex items-center justify-center peer-focus-visible:ring-2 peer-focus-visible:ring-[#3EC4B1]/40 peer-focus-visible:ring-offset-1">
                    {rememberMe && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </div>
                <span className="text-[13px] text-gray-500 dark:text-[#8E8E93] group-hover:text-gray-700 dark:group-hover:text-white transition-colors select-none">
                  Remember my email and school code
                </span>
              </label>

              {/* Error */}
              {error && (
                <div className="rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 px-3.5 py-2.5">
                  <p className="text-[13px] font-medium text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 rounded-full text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-teal-200/60 dark:hover:shadow-teal-900/40 active:scale-95 disabled:opacity-50 disabled:pointer-events-none mt-1"
                style={{ background: 'linear-gradient(135deg, #3EC4B1 0%, #0ea5a3 60%, #0b8f8f 100%)' }}
              >
                {isLoading ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mx-auto" />
                ) : 'Sign in'}
              </button>
            </form>
          </motion.div>

          {/* Demo access */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.2, ease: [0.25, 0.4, 0.25, 1] }}
            className="mt-6"
          >
            <div className="relative mb-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200/80 dark:border-[#38383A]" />
              </div>
              <div className="relative flex justify-center">
                <span
                  className="px-3 text-[11px] text-gray-400 dark:text-[#636366] uppercase tracking-widest font-medium"
                  style={isDark ? { background: '#000000' } : { background: '#f3faf9' }}
                >
                  Quick Demo
                </span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2">
              {['admin', 'teacher', 'student', 'parent'].map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => handleDemoLogin(role)}
                  className="text-[12px] py-1.5 px-3.5 rounded-full border border-gray-200 dark:border-[#38383A] text-gray-500 dark:text-[#8E8E93] font-medium capitalize hover:border-[#3EC4B1] hover:text-[#0ea5a3] dark:hover:border-[#3EC4B1]/60 dark:hover:text-[#3EC4B1] hover:bg-[#3EC4B1]/[0.06] dark:hover:bg-[#3EC4B1]/10 transition-all duration-150 active:scale-95"
                >
                  {role}
                </button>
              ))}
            </div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  )
}

export default Login
