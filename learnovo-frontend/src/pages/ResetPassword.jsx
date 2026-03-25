import React, { useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, ArrowLeft, CheckCircle } from 'lucide-react'
import { motion } from 'framer-motion'
import { useTheme } from '../contexts/ThemeContext'
import { authService } from '../services/authService'
import { HeroGeometric } from '../components/ui/ShapeLandingHero'
import { Sun, Moon } from 'lucide-react'

const ResetPassword = () => {
  const { theme, toggleMode } = useTheme()
  const isDark = theme?.mode === 'dark'
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token')

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!password) {
      setError('Please enter a new password')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (!token) {
      setError('Invalid or missing reset token. Please request a new reset link.')
      return
    }

    setIsLoading(true)

    try {
      await authService.resetPassword(token, password)
      setSuccess(true)
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to reset password. The link may have expired.'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  const passwordsMatch = password && confirmPassword && password === confirmPassword

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
          title1="Set your new"
          title2="password."
          description="Choose a strong password to keep your school account secure."
        >
          <div className="flex flex-wrap gap-2 justify-center">
            {['Secure', 'Encrypted', 'Protected'].map(f => (
              <span key={f} className="px-3 py-1 rounded-full text-sm font-medium text-white/90"
                style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)', border: '1px solid rgba(62,196,177,0.3)' }}>
                {f}
              </span>
            ))}
          </div>
        </HeroGeometric>

        <Link to="/" className="absolute top-8 left-8 flex items-center gap-3 z-20 hover:opacity-80 transition-opacity">
          <img src="/logo-icon.png" alt="Learnovo" className="h-10 w-10 object-contain drop-shadow-md" />
          <span className="text-2xl font-bold tracking-tight text-white">Learnovo</span>
        </Link>

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

        {/* Back to login */}
        <Link
          to="/login"
          className="absolute top-6 left-6 flex items-center gap-1.5 text-[13px] text-gray-400 dark:text-[#636366] hover:text-gray-600 dark:hover:text-white transition-colors z-10"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to login</span>
        </Link>

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
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.9, ease: [0.25, 0.4, 0.25, 1] }}
            className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-lg shadow-teal-100/40 dark:shadow-black/20 border border-gray-100 dark:border-[#38383A] px-6 sm:px-7 py-6 sm:py-7"
          >
            {success ? (
              /* Success state */
              <div className="text-center py-4">
                <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="h-7 w-7 text-green-500" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight mb-2">Password reset!</h2>
                <p className="text-[13px] text-gray-500 dark:text-[#8E8E93] mb-5 leading-relaxed">
                  Your password has been successfully reset. You can now sign in with your new password.
                </p>
                <button
                  onClick={() => navigate('/login')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-teal-200/60 active:scale-95"
                  style={{ background: 'linear-gradient(135deg, #3EC4B1 0%, #0ea5a3 60%, #0b8f8f 100%)' }}
                >
                  Sign in now
                </button>
              </div>
            ) : !token ? (
              /* No token state */
              <div className="text-center py-4">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight mb-2">Invalid link</h2>
                <p className="text-[13px] text-gray-500 dark:text-[#8E8E93] mb-5 leading-relaxed">
                  This password reset link is invalid or has expired. Please request a new one.
                </p>
                <Link
                  to="/forgot-password"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-teal-200/60 active:scale-95"
                  style={{ background: 'linear-gradient(135deg, #3EC4B1 0%, #0ea5a3 60%, #0b8f8f 100%)' }}
                >
                  Request new link
                </Link>
              </div>
            ) : (
              /* Form state */
              <>
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Reset password</h2>
                  <p className="text-gray-400 dark:text-[#8E8E93] text-[13px] mt-1">Enter your new password below</p>
                </div>

                <form className="space-y-4" onSubmit={handleSubmit}>
                  <div>
                    <label htmlFor="password" className="block text-[13px] font-medium text-gray-600 dark:text-[#8E8E93] mb-1">
                      New Password
                    </label>
                    <div className="relative">
                      <input
                        id="password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        autoFocus
                        required
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value)
                          if (error) setError('')
                        }}
                        className="input pr-10"
                        placeholder="Min. 6 characters"
                      />
                      <button
                        type="button"
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 dark:text-[#636366] hover:text-gray-600 dark:hover:text-white transition-colors"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="confirmPassword" className="block text-[13px] font-medium text-gray-600 dark:text-[#8E8E93] mb-1">
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <input
                        id="confirmPassword"
                        name="confirmPassword"
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        onChange={(e) => {
                          setConfirmPassword(e.target.value)
                          if (error) setError('')
                        }}
                        className="input pr-10"
                        placeholder="Confirm new password"
                      />
                      <button
                        type="button"
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 dark:text-[#636366] hover:text-gray-600 dark:hover:text-white transition-colors"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {passwordsMatch && (
                      <p className="mt-1 text-[11px] text-green-500 flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" /> Passwords match
                      </p>
                    )}
                  </div>

                  {error && (
                    <div className="rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 px-3.5 py-2.5">
                      <p className="text-[13px] font-medium text-red-600 dark:text-red-400">{error}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-2.5 rounded-full text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-teal-200/60 dark:hover:shadow-teal-900/40 active:scale-95 disabled:opacity-50 disabled:pointer-events-none mt-1"
                    style={{ background: 'linear-gradient(135deg, #3EC4B1 0%, #0ea5a3 60%, #0b8f8f 100%)' }}
                  >
                    {isLoading ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mx-auto" />
                    ) : 'Reset Password'}
                  </button>
                </form>
              </>
            )}
          </motion.div>
        </div>
      </motion.div>
    </div>
  )
}

export default ResetPassword
