import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Mail } from 'lucide-react'
import { motion } from 'framer-motion'
import { useTheme } from '../contexts/ThemeContext'
import { authService } from '../services/authService'
import { HeroGeometric } from '../components/ui/ShapeLandingHero'
import { Sun, Moon } from 'lucide-react'

const ForgotPassword = () => {
  const { theme, toggleMode } = useTheme()
  const isDark = theme?.mode === 'dark'

  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!email.trim()) {
      setError('Please enter your email address')
      return
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid email address')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      await authService.forgotPassword(email.trim())
      setSuccess(true)
    } catch (err) {
      const message = err.response?.data?.message || 'Something went wrong. Please try again.'
      setError(message)
    } finally {
      setIsLoading(false)
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
          title1="Reset your"
          title2="password."
          description="We'll send you a link to reset your password and get back to managing your school."
        >
          <div className="flex flex-wrap gap-2 justify-center">
            {['Secure', 'Quick Recovery', 'Email Verification'].map(f => (
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

        <p className="absolute bottom-6 left-8 text-white/30 text-sm z-20">&copy; 2025 Learnovo. All rights reserved.</p>
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
                <div className="w-14 h-14 rounded-full bg-[#3EC4B1]/10 flex items-center justify-center mx-auto mb-4">
                  <Mail className="h-7 w-7 text-[#3EC4B1]" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight mb-2">Check your email</h2>
                <p className="text-[13px] text-gray-500 dark:text-[#8E8E93] mb-5 leading-relaxed">
                  We've sent a password reset link to <strong className="text-gray-700 dark:text-white">{email}</strong>. Please check your inbox and follow the instructions.
                </p>
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#0ea5a3] dark:text-[#3EC4B1] hover:underline transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back to login
                </Link>
              </div>
            ) : (
              /* Form state */
              <>
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Forgot password?</h2>
                  <p className="text-gray-400 dark:text-[#8E8E93] text-[13px] mt-1">Enter your email and we'll send you a reset link</p>
                </div>

                <form className="space-y-4" onSubmit={handleSubmit}>
                  <div>
                    <label htmlFor="email" className="block text-[13px] font-medium text-gray-600 dark:text-[#8E8E93] mb-1">
                      Email Address
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoFocus
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value)
                        if (error) setError('')
                      }}
                      className={`input ${error ? '!border-red-400 !ring-red-400' : ''}`}
                      placeholder="Enter your email address"
                    />
                    {error && (
                      <p className="mt-1 text-[11px] text-red-500">{error}</p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-2.5 rounded-full text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-teal-200/60 dark:hover:shadow-teal-900/40 active:scale-95 disabled:opacity-50 disabled:pointer-events-none mt-1"
                    style={{ background: 'linear-gradient(135deg, #3EC4B1 0%, #0ea5a3 60%, #0b8f8f 100%)' }}
                  >
                    {isLoading ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mx-auto" />
                    ) : 'Send Reset Link'}
                  </button>
                </form>
              </>
            )}
          </motion.div>

          {/* Bottom link */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.2, ease: [0.25, 0.4, 0.25, 1] }}
            className="mt-6 text-center"
          >
            <p className="text-[13px] text-gray-500 dark:text-[#8E8E93]">
              Remember your password?{' '}
              <Link to="/login" className="font-semibold text-[#0ea5a3] dark:text-[#3EC4B1] hover:underline transition-colors">
                Sign in &rarr;
              </Link>
            </p>
          </motion.div>
        </div>
      </motion.div>
    </div>
  )
}

export default ForgotPassword
