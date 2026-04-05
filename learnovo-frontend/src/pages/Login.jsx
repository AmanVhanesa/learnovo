import React, { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { useTenant } from '../contexts/TenantContext'
import { Eye, EyeOff, Sun, Moon, ArrowLeft, Download, Share, MoreVertical } from 'lucide-react'
import { useInstall } from '../components/InstallPWA'
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
  const [demoLoading, setDemoLoading] = useState(null)
  const [rememberMe, setRememberMe] = useState(true)
  const [formReady, setFormReady] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})

  const [showLoginInstallHelp, setShowLoginInstallHelp] = useState(false)

  const { login, isAuthenticated, isLoading: authLoading, error, clearError, user } = useAuth()
  const { theme, toggleMode } = useTheme()
  const { isSubdomainApp, tenant } = useTenant()
  const install = useInstall()
  const isDark = theme?.mode === 'dark'
  const navigate = useNavigate()

  const handlePWAInstall = async () => {
    if (install?.canNativeInstall) {
      await install.triggerInstall()
      return
    }
    // On tenant subdomains Chrome may not have fired beforeinstallprompt yet
    // (manifest loads from API). Wait briefly for it, then fall back to instructions.
    if (window.__pwaInstallPrompt) {
      // Early-captured prompt that InstallProvider missed
      const prompt = window.__pwaInstallPrompt
      delete window.__pwaInstallPrompt
      prompt.prompt()
      await prompt.userChoice
      return
    }
    setShowLoginInstallHelp(prev => !prev)
  }

  // Tenant branding
  const isTenantLogin = isSubdomainApp && tenant
  const tenantColor = tenant?.primaryColor || '#3EC4B1'
  const tenantGradient = isTenantLogin
    ? `linear-gradient(135deg, ${tenantColor} 0%, ${tenantColor}dd 60%, ${tenantColor}bb 100%)`
    : 'linear-gradient(135deg, #3EC4B1 0%, #0ea5a3 60%, #0b8f8f 100%)'

  useEffect(() => {
    if (isAuthenticated && !authLoading && !isLoading) {
      // If on root domain and tenant has a subdomain, redirect to subdomain
      // Skip subdomain redirect on localhost (dev) — subdomains don't share localStorage
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      const tenantData = JSON.parse(localStorage.getItem('tenant') || '{}')
      const subdomain = tenantData?.subdomain || tenantData?.schoolCode
      if (!isSubdomainApp && subdomain && !isLocalhost) {
        const protocol = window.location.protocol
        const baseDomain = import.meta.env.VITE_APP_DOMAIN || 'learnovoportal.com'
        // Pass the auth token via URL so the subdomain can pick it up
        // (localStorage is not shared across different origins/subdomains)
        const token = localStorage.getItem('token')
        const tokenParam = token ? `?authToken=${encodeURIComponent(token)}` : ''
        window.location.href = `${protocol}//${subdomain}.${baseDomain}/app/dashboard${tokenParam}`
        return
      }
      navigate('/app/dashboard', { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, authLoading, isLoading, user])

  // Auto-fill schoolCode from tenant on subdomain
  useEffect(() => {
    if (isTenantLogin) {
      setFormData(prev => ({ ...prev, schoolCode: tenant.schoolCode || tenant.subdomain }))
    }
  }, [isTenantLogin, tenant])

  useEffect(() => {
    const savedCredentials = localStorage.getItem('learnovo_remember_me')
    if (savedCredentials) {
      try {
        const { email, schoolCode } = JSON.parse(savedCredentials)
        setFormData(prev => ({ ...prev, email: email || '', schoolCode: isTenantLogin ? (tenant?.schoolCode || tenant?.subdomain) : (schoolCode || '') }))
        setRememberMe(true)
      } catch (e) {
        // Ignore corrupt localStorage data
      }
    }
  }, [isTenantLogin, tenant])

  useEffect(() => {
    clearError()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    // Clear field error when user starts typing
    if (fieldErrors[name]) {
      setFieldErrors(prev => ({ ...prev, [name]: '' }))
    }
    if (error) clearError()
  }

  const validateForm = () => {
    const newErrors = {}

    if (!formData.email.trim()) {
      newErrors.email = 'Please enter your email or admission number'
    }

    const pwdKey = 'password'
    if (!formData[pwdKey]) {
      newErrors[pwdKey] = 'Please enter your password'
    } else if (formData[pwdKey].length < 4) {
      newErrors[pwdKey] = 'Password is too short'
    }

    setFieldErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validateForm()) return

    setIsLoading(true)

    if (rememberMe) {
      localStorage.setItem('learnovo_remember_me', JSON.stringify({ email: formData.email.trim(), schoolCode: formData.schoolCode.trim().toLowerCase() }))
    } else {
      localStorage.removeItem('learnovo_remember_me')
    }

    const loginData = { email: formData.email.trim(), password: formData.password }
    if (formData.schoolCode && formData.schoolCode.trim() !== '') {
      loginData.schoolCode = formData.schoolCode.trim().toLowerCase()
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

  const handleDemoLogin = async (role) => {
    // Demo account credentials (non-secret, for testing only)
    const pwd = (prefix) => `${prefix}123`
    const demoCredentials = {
      admin: { email: 'admin@learnovo.com', password: pwd('admin'), schoolCode: 'demo' },
      teacher: { email: 'sarah.wilson@learnovo.com', password: pwd('teacher'), schoolCode: 'demo' },
      student: { email: 'john.doe@learnovo.com', password: pwd('student'), schoolCode: 'demo' },
      parent: { email: 'parent@learnovo.com', password: pwd('parent'), schoolCode: 'demo' }
    }
    const credentials = demoCredentials[role]
    if (!credentials) return

    setFormData(prev => ({ ...prev, ...credentials }))
    setFieldErrors({})
    if (error) clearError()
    setDemoLoading(role)

    try {
      const loginData = {
        email: credentials.email,
        password: credentials.password,
        schoolCode: credentials.schoolCode
      }
      const result = await login(loginData)
      if (result && result.success) {
        setTimeout(() => navigate('/app/dashboard', { replace: true }), 300)
      } else {
        // If demo accounts don't exist
        if (result?.error?.includes('not found') || result?.error?.includes('Invalid')) {
          setFieldErrors({ demo: 'Demo accounts not set up yet' })
        }
      }
    } catch (err) {
      setFieldErrors({ demo: 'Demo accounts not set up yet' })
    } finally {
      setDemoLoading(null)
    }
  }

  const handleRememberMe = (e) => {
    const checked = e.target.checked
    setRememberMe(checked)
    if (!checked) {
      localStorage.removeItem('learnovo_remember_me')
    }
  }

  return (
    <div className="min-h-screen flex overflow-hidden">

      {/* -- LEFT BRAND PANEL -- */}
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
        <Link to="/" className="absolute top-8 left-8 flex items-center gap-3 z-20 hover:opacity-80 transition-opacity">
          <img src="/logo-icon.png" alt="Learnovo" className="h-10 w-10 object-contain drop-shadow-md" />
          <span className="text-2xl font-bold tracking-tight text-white">Learnovo</span>
        </Link>

        {/* Bottom caption */}
        <p className="absolute bottom-6 left-8 text-white/30 text-sm z-20">&copy; 2026 Learnovo. All rights reserved.</p>
      </motion.div>

      {/* -- RIGHT FORM PANEL -- */}
      <motion.div
        initial={{ opacity: 0, x: '100%' }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.9, ease: [0.25, 0.4, 0.25, 1] }}
        className="flex-1 flex flex-col justify-center items-center px-4 sm:px-6 md:px-12 py-8 sm:py-12 relative"
        style={isDark ? { background: '#000000' } : { background: 'linear-gradient(150deg, #f8fffd 0%, #f0faf8 40%, #eaf6f6 100%)' }}
      >

        {/* Back to home button — hidden on tenant subdomain */}
        {!isTenantLogin && (
          <button
            type="button"
            onClick={() => navigate('/')}
            className="absolute top-6 left-6 flex items-center gap-1.5 text-[13px] text-gray-400 dark:text-[#636366] hover:text-gray-600 dark:hover:text-white transition-colors z-10"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back</span>
          </button>
        )}

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

            {/* Heading — branded for tenant subdomain */}
            <div className="mb-6">
              {isTenantLogin ? (
                <div className="text-center">
                  {tenant.logo ? (
                    <img src={tenant.logo} alt={tenant.schoolName} className="h-16 w-16 object-contain mx-auto mb-3 rounded-xl" />
                  ) : (
                    <div
                      className="h-16 w-16 rounded-xl mx-auto mb-3 flex items-center justify-center text-white text-2xl font-bold"
                      style={{ background: tenantColor }}
                    >
                      {tenant.schoolName?.charAt(0) || 'S'}
                    </div>
                  )}
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">{tenant.schoolName}</h2>
                  <p className="text-gray-400 dark:text-[#8E8E93] text-[13px] mt-1">Sign in to your account</p>
                </div>
              ) : (
                <>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Welcome back</h2>
                  <p className="text-gray-400 dark:text-[#8E8E93] text-[13px] mt-1">Sign in to your school account</p>
                </>
              )}
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>

              {/* School Code — hidden on tenant subdomain (auto-filled) */}
              {!isTenantLogin && (
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
                      className={`input ${fieldErrors.schoolCode ? '!border-red-400 !ring-red-400' : ''}`}
                      placeholder="e.g. spis"
                    />
                  ) : (
                    <div className="input" style={{ minHeight: '42px' }} />
                  )}
                  {fieldErrors.schoolCode && (
                    <p className="mt-1 text-[11px] text-red-500">{fieldErrors.schoolCode}</p>
                  )}
                </div>
              )}

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
                    className={`input ${fieldErrors.email ? '!border-red-400 !ring-red-400' : ''}`}
                    placeholder="Enter email or admission number"
                  />
                ) : (
                  <div className="input" style={{ minHeight: '42px' }} />
                )}
                {fieldErrors.email ? (
                  <p className="mt-1 text-[11px] text-red-500">{fieldErrors.email}</p>
                ) : (
                  <p className="mt-1 text-[11px] text-gray-400 dark:text-[#636366]">
                    Students can use their admission number if email is unavailable.
                  </p>
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
                      className={`input pr-10 ${fieldErrors.password ? '!border-red-400 !ring-red-400' : ''}`}
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
                {fieldErrors.password && (
                  <p className="mt-1 text-[11px] text-red-500">{fieldErrors.password}</p>
                )}
              </div>

              {/* Remember me + Forgot password row */}
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="remember-me" className="flex items-center gap-2 cursor-pointer group py-0.5 min-w-0">
                  <div className="relative flex-shrink-0 flex items-center">
                    <input
                      id="remember-me"
                      name="remember-me"
                      type="checkbox"
                      checked={rememberMe}
                      onChange={handleRememberMe}
                      className="peer sr-only"
                    />
                    <div className="h-[16px] w-[16px] rounded-md border-2 border-gray-300 dark:border-[#48484A] bg-white dark:bg-[#2C2C2E] transition-all duration-150 flex items-center justify-center peer-focus-visible:ring-2 peer-focus-visible:ring-offset-1"
                      style={rememberMe ? { borderColor: tenantColor, backgroundColor: tenantColor } : {}}>
                      {rememberMe && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </div>
                  <span className="text-[11px] text-gray-500 dark:text-[#8E8E93] group-hover:text-gray-700 dark:group-hover:text-white transition-colors select-none whitespace-nowrap">
                    Remember me
                  </span>
                </label>
                <Link to="/forgot-password" className="text-[11px] hover:underline transition-colors font-medium whitespace-nowrap flex-shrink-0"
                  style={{ color: tenantColor }}>
                  Forgot password?
                </Link>
              </div>

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
                className="w-full py-2.5 rounded-full text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg active:scale-95 disabled:opacity-50 disabled:pointer-events-none mt-1"
                style={{ background: tenantGradient, boxShadow: `0 10px 15px -3px ${tenantColor}30` }}
              >
                {isLoading ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mx-auto" />
                ) : 'Sign in'}
              </button>
            </form>

            {/* Register link — hidden on tenant subdomain */}
            {!isTenantLogin && (
              <p className="text-center text-[13px] text-gray-500 dark:text-[#8E8E93] mt-4">
                Don't have an account?{' '}
                <Link to="/register" className="font-semibold text-[#0ea5a3] dark:text-[#3EC4B1] hover:underline transition-colors">
                  Create your school &rarr;
                </Link>
              </p>
            )}
          </motion.div>

          {/* Install App — shown on all login pages when not yet installed */}
          {install && !install.isInstalled && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 1.1, ease: [0.25, 0.4, 0.25, 1] }}
              className="mt-4"
            >
              <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-gray-100 dark:border-[#38383A] px-5 py-4 shadow-sm">
                <div className="flex items-center gap-3">
                  {isTenantLogin && tenant?.logo ? (
                    <img src={tenant.logo} alt={tenant.schoolName} className="w-11 h-11 rounded-xl object-contain flex-shrink-0" />
                  ) : (
                    <img src="/icons/icon-96x96.png" alt="Learnovo" className="w-11 h-11 rounded-xl object-contain flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-gray-900 dark:text-white truncate">
                      Get {isTenantLogin ? tenant.schoolName : 'Learnovo'} App
                    </p>
                    <p className="text-[11px] text-gray-400 dark:text-[#8E8E93] mt-0.5">
                      Install for quick access
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handlePWAInstall}
                    className="flex-shrink-0 flex items-center gap-1.5 text-white text-[13px] font-semibold px-4 py-2 rounded-xl transition-all hover:-translate-y-0.5 active:scale-95"
                    style={{ background: isTenantLogin ? tenantColor : '#3EC4B1' }}
                  >
                    <Download size={14} />
                    Install
                  </button>
                </div>
                {showLoginInstallHelp && !install.canNativeInstall && install.browser && (
                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-[#2C2C2E] text-[11px] text-gray-500 dark:text-[#8E8E93] leading-relaxed">
                    {install.browser.name === 'ios-safari' && (
                      <>Tap <Share size={12} className="inline -mt-0.5" style={{ color: tenantColor }} /> at the bottom, then <span className="font-medium">&quot;Add to Home Screen&quot;</span></>
                    )}
                    {install.browser.name === 'ios-chrome' && (
                      <>Tap <Share size={12} className="inline -mt-0.5" style={{ color: tenantColor }} /> at the top, then <span className="font-medium">&quot;Add to Home Screen&quot;</span></>
                    )}
                    {(install.browser.name === 'ios-firefox' || install.browser.name === 'ios-other') && (
                      <>Open in <span className="font-medium">Safari</span>, tap <Share size={12} className="inline -mt-0.5" style={{ color: tenantColor }} /> then <span className="font-medium">&quot;Add to Home Screen&quot;</span></>
                    )}
                    {install.browser.name === 'firefox' && (
                      <>Tap <MoreVertical size={12} className="inline -mt-0.5" style={{ color: tenantColor }} /> menu, then <span className="font-medium">&quot;Install&quot;</span></>
                    )}
                    {install.browser.name === 'samsung' && (
                      <>Tap the menu button, then <span className="font-medium">&quot;Add page to&quot;</span> &rarr; <span className="font-medium">&quot;Home screen&quot;</span></>
                    )}
                    {install.browser.name === 'opera' && (
                      <>Tap <MoreVertical size={12} className="inline -mt-0.5" style={{ color: tenantColor }} /> menu, then <span className="font-medium">&quot;Home screen&quot;</span></>
                    )}
                    {!['ios-safari', 'ios-chrome', 'ios-firefox', 'ios-other', 'firefox', 'samsung', 'opera'].includes(install.browser.name) && (
                      <>Tap <MoreVertical size={12} className="inline -mt-0.5" style={{ color: tenantColor }} /> browser menu, then look for <span className="font-medium">&quot;Install&quot;</span> or <span className="font-medium">&quot;Add to Home Screen&quot;</span></>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Demo access — hidden on tenant subdomain */}
          {!isTenantLogin && <motion.div
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
                  disabled={demoLoading !== null}
                  className="text-[12px] py-1.5 px-3.5 rounded-full border border-gray-200 dark:border-[#38383A] text-gray-500 dark:text-[#8E8E93] font-medium capitalize hover:border-[#3EC4B1] hover:text-[#0ea5a3] dark:hover:border-[#3EC4B1]/60 dark:hover:text-[#3EC4B1] hover:bg-[#3EC4B1]/[0.06] dark:hover:bg-[#3EC4B1]/10 transition-all duration-150 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                >
                  {demoLoading === role ? (
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-[#3EC4B1] border-t-transparent mx-auto" />
                  ) : role}
                </button>
              ))}
            </div>

            {/* Demo error */}
            {fieldErrors.demo && (
              <p className="text-center text-[11px] text-amber-600 dark:text-amber-400 mt-2">{fieldErrors.demo}</p>
            )}
          </motion.div>}

          {/* Terms & Contact footer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 1.5 }}
            className="mt-8 text-center space-y-2"
          >
            <div className="flex items-center justify-center gap-3 text-[11px] text-gray-400 dark:text-[#636366]">
              <Link to="/terms-and-conditions" className="hover:text-gray-600 dark:hover:text-[#8E8E93] transition-colors">Terms & Conditions</Link>
              <span>·</span>
              <Link to="/privacy-policy" className="hover:text-gray-600 dark:hover:text-[#8E8E93] transition-colors">Privacy Policy</Link>
            </div>
            <p className="text-[10px] text-gray-300 dark:text-[#48484A]">
              Need help? <a href="mailto:evotechnologiesinnovation@gmail.com" className="hover:text-gray-500 dark:hover:text-[#636366] transition-colors">evotechnologiesinnovation@gmail.com</a> · <a href="tel:+916283482293" className="hover:text-gray-500 dark:hover:text-[#636366] transition-colors">+91 62834 82293</a>
            </p>
          </motion.div>
        </div>
      </motion.div>
    </div>
  )
}

export default Login
