import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Eye, EyeOff } from 'lucide-react'

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    schoolCode: ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)

  const { login, isAuthenticated, isLoading: authLoading, error, clearError } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (isAuthenticated && !authLoading && !isLoading) {
      navigate('/app/dashboard', { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, authLoading, isLoading])

  useEffect(() => {
    const savedCredentials = localStorage.getItem('learnovo_remember_me')
    if (savedCredentials) {
      try {
        const { email, schoolCode } = JSON.parse(savedCredentials)
        setFormData(prev => ({ ...prev, email: email || '', schoolCode: schoolCode || '' }))
        setRememberMe(true)
      } catch (e) {
        console.error('Error loading saved credentials:', e)
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
        setTimeout(() => navigate('/app/dashboard', { replace: true }), 300)
      } else {
        setIsLoading(false)
      }
    } catch (err) {
      console.error('Login error:', err)
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
    <div className="min-h-screen flex">

      {/* ── LEFT BRAND PANEL ── */}
      <div
        className="hidden lg:flex lg:w-5/12 xl:w-1/2 flex-col justify-between p-12 text-white relative overflow-hidden"
        style={{ background: 'linear-gradient(145deg, #1a6b6b 0%, #2a9090 40%, #1e7a7a 100%)' }}
      >
        {/* Subtle background circles */}
        <div className="absolute -top-16 -left-16 w-72 h-72 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #ffffff 0%, transparent 70%)' }} />
        <div className="absolute -bottom-24 -right-12 w-96 h-96 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #ffffff 0%, transparent 70%)' }} />

        {/* Logo top-left */}
        <div className="flex items-center gap-3 relative z-10">
          <img src="/logo-icon.png" alt="Learnovo" className="h-10 w-10 object-contain drop-shadow-md" />
          <span className="text-2xl font-bold tracking-tight">Learnovo</span>
        </div>

        {/* Center tagline */}
        <div className="relative z-10">
          <h1 className="text-4xl xl:text-5xl font-bold leading-tight mb-4">
            Manage your<br />school smarter.
          </h1>
          <p className="text-white/75 text-lg leading-relaxed max-w-sm">
            One platform for students, teachers, fees, attendance, and everything in between.
          </p>

          {/* Feature pills */}
          <div className="mt-8 flex flex-wrap gap-2">
            {['Student Management', 'Attendance', 'Fees & Finance', 'Reports'].map(f => (
              <span key={f} className="px-3 py-1 rounded-full text-sm font-medium"
                style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}>
                {f}
              </span>
            ))}
          </div>
        </div>

        {/* Bottom caption */}
        <p className="text-white/50 text-sm relative z-10">© 2025 Learnovo. All rights reserved.</p>
      </div>

      {/* ── RIGHT FORM PANEL ── */}
      <div className="flex-1 flex flex-col justify-center items-center bg-white px-6 py-12 sm:px-12">

        {/* Mobile-only logo */}
        <div className="flex lg:hidden items-center gap-2 mb-8">
          <img src="/logo-icon.png" alt="Learnovo" className="h-9 w-9 object-contain" />
          <span className="text-xl font-bold text-gray-900">Learnovo</span>
        </div>

        <div className="w-full max-w-md">

          {/* Heading */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-1">Welcome back</h2>
            <p className="text-gray-500 text-sm">Sign in to your school account</p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>

            {/* School Code */}
            <div>
              <label htmlFor="schoolCode" className="block text-sm font-medium text-gray-700 mb-1.5">
                School Code
              </label>
              <input
                id="schoolCode"
                name="schoolCode"
                type="text"
                value={formData.schoolCode}
                onChange={handleChange}
                className="input"
                placeholder="e.g. spis"
              />
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                Email or Admission Number
              </label>
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
              <p className="mt-1.5 text-xs text-gray-400">
                Students can login with their admission number if email is unavailable.
              </p>
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

            {/* Remember me */}
            <div className="flex items-center">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded cursor-pointer"
              />
              <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-600 cursor-pointer">
                Remember my email and school code
              </label>
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
              className="btn btn-primary w-full py-2.5 text-base font-semibold"
              style={{ marginTop: '4px' }}
            >
              {isLoading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent mx-auto" />
              ) : 'Sign in'}
            </button>
          </form>

          {/* Demo access */}
          <div className="mt-8">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-100" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white px-3 text-gray-400 uppercase tracking-wider font-medium">Demo Access</span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-4 gap-2">
              {['admin', 'teacher', 'student', 'parent'].map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => handleDemoLogin(role)}
                  className="text-xs py-2 px-1 rounded-lg border border-gray-200 text-gray-500 font-medium capitalize hover:border-teal-300 hover:text-teal-700 hover:bg-teal-50 transition-all duration-150"
                >
                  {role}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login
