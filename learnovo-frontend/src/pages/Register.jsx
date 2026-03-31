import React, { useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, CheckCircle, XCircle, ArrowRight, ArrowLeft, RefreshCw } from 'lucide-react'
import { motion } from 'framer-motion'
import { useTheme } from '../contexts/ThemeContext'
import { tenantService } from '../services/tenantService'
import { HeroGeometric } from '../components/ui/ShapeLandingHero'
import { Sun, Moon } from 'lucide-react'

const Register = () => {
  const navigate = useNavigate()
  const { theme, toggleMode } = useTheme()
  const isDark = theme?.mode === 'dark'
  const formRef = useRef(null)

  const [formData, setFormData] = useState({
    schoolName: '',
    email: '',
    password: '',
    confirmPassword: '',
    schoolCode: '',
    subdomain: '',
    phone: '',
    address: {
      street: '',
      city: '',
      state: '',
      country: '',
      zipCode: ''
    }
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [errors, setErrors] = useState({})
  const [availability, setAvailability] = useState({})
  const [checkingAvailability, setCheckingAvailability] = useState({})

  const handleInputChange = (e) => {
    const { name, value } = e.target

    if (name.startsWith('address.')) {
      const addressField = name.split('.')[1]
      setFormData(prev => ({
        ...prev,
        address: {
          ...prev.address,
          [addressField]: value
        }
      }))
    } else if (name === 'schoolCode') {
      // Auto-lowercase and restrict to valid characters
      const cleaned = value.toLowerCase().replace(/[^a-z0-9-]/g, '')
      setFormData(prev => ({
        ...prev,
        schoolCode: cleaned,
        // Auto-fill subdomain if user hasn't manually edited it
        subdomain: prev.subdomain === prev.schoolCode || prev.subdomain === '' ? cleaned : prev.subdomain
      }))
    } else if (name === 'subdomain') {
      const cleaned = value.toLowerCase().replace(/[^a-z0-9-]/g, '')
      setFormData(prev => ({ ...prev, subdomain: cleaned }))
    } else {
      setFormData(prev => ({ ...prev, [name]: value }))
    }

    // Clear field error when user types
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  const generateSchoolCode = () => {
    if (!formData.schoolName.trim()) return
    const code = formData.schoolName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 20)

    setFormData(prev => ({
      ...prev,
      schoolCode: code,
      subdomain: prev.subdomain === prev.schoolCode || prev.subdomain === '' ? code : prev.subdomain
    }))

    // Check availability after generating
    if (code.length >= 3) {
      checkAvailability('schoolCode', code)
    }
  }

  const checkAvailability = async (field, value) => {
    if (!value || value.length < 3) {
      setAvailability(prev => ({ ...prev, [field]: undefined }))
      return
    }

    setCheckingAvailability(prev => ({ ...prev, [field]: true }))

    try {
      const data = await tenantService.checkAvailability({ [field]: value })
      if (data.success) {
        setAvailability(prev => ({
          ...prev,
          [field]: data.data[field]
        }))
        if (data.data[field] === false) {
          setErrors(prev => ({
            ...prev,
            [field]: field === 'schoolCode'
              ? 'This school code is already taken'
              : 'This subdomain is already taken'
          }))
        }
      }
    } catch (err) {
      // Silently handle availability check failures
    } finally {
      setCheckingAvailability(prev => ({ ...prev, [field]: false }))
    }
  }

  const validateForm = () => {
    const newErrors = {}

    // School name
    if (!formData.schoolName.trim()) {
      newErrors.schoolName = 'School name is required'
    } else if (formData.schoolName.trim().length < 3) {
      newErrors.schoolName = 'School name must be at least 3 characters'
    } else if (formData.schoolName.trim().length > 100) {
      newErrors.schoolName = 'School name must be under 100 characters'
    }

    // Email
    if (!formData.email.trim()) {
      newErrors.email = 'Please enter a valid email'
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email'
    }

    // Phone (optional but validate if filled)
    if (formData.phone.trim() && !/^[\d+\-() ]{7,15}$/.test(formData.phone.trim())) {
      newErrors.phone = 'Please enter a valid phone number'
    }

    // School code
    if (!formData.schoolCode.trim()) {
      newErrors.schoolCode = 'School code is required'
    } else if (formData.schoolCode.length < 3) {
      newErrors.schoolCode = 'School code must be at least 3 characters'
    } else if (formData.schoolCode.length > 20) {
      newErrors.schoolCode = 'School code must be under 20 characters'
    } else if (!/^[a-z0-9-]+$/.test(formData.schoolCode)) {
      newErrors.schoolCode = 'Only lowercase letters, numbers, and hyphens allowed'
    }

    // Subdomain (optional)
    if (formData.subdomain.trim() && formData.subdomain.length < 3) {
      newErrors.subdomain = 'Subdomain must be at least 3 characters'
    } else if (formData.subdomain.trim() && !/^[a-z0-9-]+$/.test(formData.subdomain)) {
      newErrors.subdomain = 'Only lowercase letters, numbers, and hyphens allowed'
    }

    // Password
    const pwdKey = 'password'
    if (!formData[pwdKey]) {
      newErrors[pwdKey] = 'Password is required'
    } else if (formData[pwdKey].length < 6) {
      newErrors[pwdKey] = 'Password must be at least 6 characters'
    }

    // Confirm password
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password'
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match'
    }

    // Address: street max length
    if (formData.address.street && formData.address.street.length > 200) {
      newErrors['address.street'] = 'Street address must be under 200 characters'
    }

    // Terms acceptance
    if (!agreeTerms) {
      newErrors.agreeTerms = 'You must agree to the Terms & Conditions and Privacy Policy'
    }

    setErrors(newErrors)

    // Scroll to first error field
    if (Object.keys(newErrors).length > 0) {
      const firstErrorField = Object.keys(newErrors)[0]
      const fieldId = firstErrorField.startsWith('address.') ? firstErrorField : firstErrorField
      const element = document.getElementById(fieldId)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' })
        element.focus()
      }
    }

    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setIsLoading(true)
    setErrors({})

    try {
      const registrationData = {
        schoolName: formData.schoolName.trim(),
        email: formData.email.trim(),
        password: formData.password,
        schoolCode: formData.schoolCode.trim(),
        subdomain: formData.subdomain.trim() || undefined,
        phone: formData.phone.trim() || '',
        address: formData.address.street ? {
          street: formData.address.street.trim(),
          city: formData.address.city.trim(),
          state: formData.address.state.trim(),
          country: formData.address.country.trim(),
          zipCode: formData.address.zipCode.trim()
        } : undefined
      }

      const data = await tenantService.register(registrationData)

      if (data.success) {
        localStorage.setItem('token', data.data.token)
        localStorage.setItem('user', JSON.stringify(data.data.user))
        localStorage.setItem('tenant', JSON.stringify(data.data.tenant))
        navigate('/app/dashboard')
      } else {
        setErrors({ submit: data.message })
      }
    } catch (error) {
      let errorMessage = 'Registration failed. Please try again.'

      if (error.response?.data) {
        if (error.response.data.errors && Array.isArray(error.response.data.errors)) {
          const backendErrors = {}
          error.response.data.errors.forEach(err => {
            const fieldName = err.field || err.path || err.param
            backendErrors[fieldName] = err.message || err.msg
          })
          setErrors(backendErrors)
          // Scroll to first backend error field
          const firstField = Object.keys(backendErrors)[0]
          const element = document.getElementById(firstField)
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }
          return
        }

        if (error.response.data.message) {
          errorMessage = error.response.data.message
        } else if (error.response.data.error) {
          errorMessage = error.response.data.error
        }
      } else if (error.message) {
        errorMessage = error.message
      }

      setErrors({ submit: errorMessage })
    } finally {
      setIsLoading(false)
    }
  }

  const inputClass = (fieldName) =>
    `input ${errors[fieldName] ? '!border-red-400 !ring-red-400 focus-visible:!ring-red-400' : ''}`

  const passwordsMatch = formData.password && formData.confirmPassword && formData.password === formData.confirmPassword

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
          title1="Create your"
          title2="school."
          description="Start your free 14-day trial. Set up your school in minutes — no credit card required."
        >
          {/* Feature pills */}
          <div className="flex flex-wrap gap-2 justify-center">
            {['Multi-tenant', 'Role-based Access', 'Custom Branding', 'Analytics'].map(f => (
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
        className="flex-1 flex flex-col px-4 sm:px-6 md:px-12 py-8 sm:py-10 relative overflow-y-auto"
        style={isDark ? { background: '#000000' } : { background: 'linear-gradient(150deg, #f8fffd 0%, #f0faf8 40%, #eaf6f6 100%)' }}
      >

        {/* Back to login button */}
        <Link
          to="/login"
          className="flex items-center gap-1.5 text-[13px] text-gray-400 dark:text-[#636366] hover:text-gray-600 dark:hover:text-white transition-colors mb-4 w-fit"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to login</span>
        </Link>

        {/* Dark/Light mode toggle */}
        <button
          type="button"
          onClick={toggleMode}
          className="absolute top-6 right-6 p-2 rounded-full border transition-all duration-200 hover:scale-105 active:scale-95 z-10"
          style={isDark
            ? { background: '#1C1C1E', borderColor: '#38383A', color: '#FFD60A' }
            : { background: '#ffffff', borderColor: '#e5e7eb', color: '#6b7280', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }
          }
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        {/* Mobile-only logo */}
        <div className="flex lg:hidden items-center gap-2 mb-6">
          <img src="/logo-icon.png" alt="Learnovo" className="h-9 w-9 object-contain" />
          <span className="text-xl font-bold text-gray-900 dark:text-white">Learnovo</span>
        </div>

        <div className="w-full max-w-2xl mx-auto" ref={formRef}>

          {/* Card wrapper */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.9, ease: [0.25, 0.4, 0.25, 1] }}
            className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-lg shadow-teal-100/40 dark:shadow-black/20 border border-gray-100 dark:border-[#38383A] px-6 sm:px-7 py-6 sm:py-7"
          >

            {/* Heading */}
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Create your school account</h2>
              <p className="text-gray-400 dark:text-[#8E8E93] text-[13px] mt-1">Start your free 14-day trial today</p>
            </div>

            <form className="space-y-5" onSubmit={handleSubmit}>

              {/* -- School Information -- */}
              <div className="space-y-3.5">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200/80 dark:border-[#38383A]" />
                  </div>
                  <div className="relative flex justify-start">
                    <span
                      className="pr-3 text-[11px] text-gray-400 dark:text-[#636366] uppercase tracking-widest font-medium"
                      style={isDark ? { background: '#1C1C1E' } : { background: '#ffffff' }}
                    >
                      School Information
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="sm:col-span-2">
                    <label htmlFor="schoolName" className="block text-[13px] font-medium text-gray-600 dark:text-[#8E8E93] mb-1">
                      School Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="schoolName"
                      name="schoolName"
                      type="text"
                      required
                      maxLength={100}
                      value={formData.schoolName}
                      onChange={handleInputChange}
                      className={inputClass('schoolName')}
                      placeholder="Enter your school name"
                    />
                    {errors.schoolName && <p className="mt-1 text-[11px] text-red-500">{errors.schoolName}</p>}
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-[13px] font-medium text-gray-600 dark:text-[#8E8E93] mb-1">
                      Admin Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="off"
                      required
                      value={formData.email}
                      onChange={handleInputChange}
                      onBlur={() => {
                        if (formData.email && /\S+@\S+\.\S+/.test(formData.email)) {
                          checkAvailability('email', formData.email)
                        }
                      }}
                      className={inputClass('email')}
                      placeholder="admin@yourschool.com"
                    />
                    {errors.email && <p className="mt-1 text-[11px] text-red-500">{errors.email}</p>}
                    {availability.email === false && !errors.email && (
                      <p className="mt-1 text-[11px] text-red-500">This email is already registered</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="phone" className="block text-[13px] font-medium text-gray-600 dark:text-[#8E8E93] mb-1">
                      Phone Number
                    </label>
                    <input
                      id="phone"
                      name="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={handleInputChange}
                      className={inputClass('phone')}
                      placeholder="+91 98765 43210"
                    />
                    {errors.phone && <p className="mt-1 text-[11px] text-red-500">{errors.phone}</p>}
                  </div>
                </div>
              </div>

              {/* -- School Access -- */}
              <div className="space-y-3.5">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200/80 dark:border-[#38383A]" />
                  </div>
                  <div className="relative flex justify-start">
                    <span
                      className="pr-3 text-[11px] text-gray-400 dark:text-[#636366] uppercase tracking-widest font-medium"
                      style={isDark ? { background: '#1C1C1E' } : { background: '#ffffff' }}
                    >
                      School Access
                    </span>
                  </div>
                </div>

                <div>
                  <label htmlFor="schoolCode" className="block text-[13px] font-medium text-gray-600 dark:text-[#8E8E93] mb-1">
                    School Code <span className="text-red-500">*</span>
                  </label>
                  <div className="flex">
                    <input
                      id="schoolCode"
                      name="schoolCode"
                      type="text"
                      required
                      maxLength={20}
                      value={formData.schoolCode}
                      onChange={handleInputChange}
                      onBlur={() => checkAvailability('schoolCode', formData.schoolCode)}
                      className={`${inputClass('schoolCode')} !rounded-r-none`}
                      placeholder="myschool"
                    />
                    <button
                      type="button"
                      onClick={generateSchoolCode}
                      title="Generate from school name"
                      className="flex items-center px-3 border border-l-0 border-gray-200 dark:border-[#38383A] rounded-r-xl bg-gray-50 dark:bg-[#2C2C2E] hover:bg-gray-100 dark:hover:bg-[#3A3A3C] transition-colors"
                    >
                      {checkingAvailability.schoolCode ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
                      ) : availability.schoolCode === true ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : availability.schoolCode === false ? (
                        <XCircle className="h-4 w-4 text-red-500" />
                      ) : (
                        <RefreshCw className="h-4 w-4 text-gray-400 dark:text-[#636366]" />
                      )}
                    </button>
                  </div>
                  <p className="mt-1 text-[11px] text-gray-400 dark:text-[#636366]">
                    Your unique school identifier. Use this code to login.
                  </p>
                  {errors.schoolCode && <p className="mt-1 text-[11px] text-red-500">{errors.schoolCode}</p>}
                </div>

                <div>
                  <label htmlFor="subdomain" className="block text-[13px] font-medium text-gray-600 dark:text-[#8E8E93] mb-1">
                    Subdomain <span className="text-gray-400 dark:text-[#636366] font-normal">(Optional)</span>
                  </label>
                  <div className="flex">
                    <input
                      id="subdomain"
                      name="subdomain"
                      type="text"
                      value={formData.subdomain}
                      onChange={handleInputChange}
                      onBlur={() => {
                        if (formData.subdomain.length >= 3) {
                          checkAvailability('subdomain', formData.subdomain)
                        }
                      }}
                      placeholder="myschool"
                      className={`${inputClass('subdomain')} !rounded-r-none`}
                    />
                    <div className="flex items-center px-3 border border-l-0 border-gray-200 dark:border-[#38383A] rounded-r-xl bg-gray-50 dark:bg-[#2C2C2E]">
                      <span className="text-[11px] text-gray-400 dark:text-[#636366] whitespace-nowrap">.learnovoportal.com</span>
                    </div>
                  </div>
                  <p className="mt-1 text-[11px] text-gray-400 dark:text-[#636366]">
                    If left empty, your school code will be used as subdomain.
                  </p>
                  {errors.subdomain && <p className="mt-1 text-[11px] text-red-500">{errors.subdomain}</p>}
                </div>
              </div>

              {/* -- Password -- */}
              <div className="space-y-3.5">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200/80 dark:border-[#38383A]" />
                  </div>
                  <div className="relative flex justify-start">
                    <span
                      className="pr-3 text-[11px] text-gray-400 dark:text-[#636366] uppercase tracking-widest font-medium"
                      style={isDark ? { background: '#1C1C1E' } : { background: '#ffffff' }}
                    >
                      Admin Password
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label htmlFor="password" className="block text-[13px] font-medium text-gray-600 dark:text-[#8E8E93] mb-1">
                      Password <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        id="password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        required
                        value={formData.password}
                        onChange={handleInputChange}
                        className={`${inputClass('password')} !pr-10`}
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
                    {errors.password && <p className="mt-1 text-[11px] text-red-500">{errors.password}</p>}
                  </div>

                  <div>
                    <label htmlFor="confirmPassword" className="block text-[13px] font-medium text-gray-600 dark:text-[#8E8E93] mb-1">
                      Confirm Password <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        id="confirmPassword"
                        name="confirmPassword"
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        value={formData.confirmPassword}
                        onChange={handleInputChange}
                        className={`${inputClass('confirmPassword')} !pr-10`}
                        placeholder="Confirm password"
                      />
                      <button
                        type="button"
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 dark:text-[#636366] hover:text-gray-600 dark:hover:text-white transition-colors"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {errors.confirmPassword ? (
                      <p className="mt-1 text-[11px] text-red-500">{errors.confirmPassword}</p>
                    ) : passwordsMatch ? (
                      <p className="mt-1 text-[11px] text-green-500 flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" /> Passwords match
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* -- Address (Optional) -- */}
              <div className="space-y-3.5">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200/80 dark:border-[#38383A]" />
                  </div>
                  <div className="relative flex justify-start">
                    <span
                      className="pr-3 text-[11px] text-gray-400 dark:text-[#636366] uppercase tracking-widest font-medium"
                      style={isDark ? { background: '#1C1C1E' } : { background: '#ffffff' }}
                    >
                      School Address (Optional)
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label htmlFor="address.street" className="block text-[13px] font-medium text-gray-600 dark:text-[#8E8E93] mb-1">
                      Street Address
                    </label>
                    <input
                      id="address.street"
                      name="address.street"
                      type="text"
                      maxLength={200}
                      value={formData.address.street}
                      onChange={handleInputChange}
                      className="input"
                      placeholder="123 Main St"
                    />
                  </div>

                  <div>
                    <label htmlFor="address.city" className="block text-[13px] font-medium text-gray-600 dark:text-[#8E8E93] mb-1">
                      City
                    </label>
                    <input
                      id="address.city"
                      name="address.city"
                      type="text"
                      value={formData.address.city}
                      onChange={handleInputChange}
                      className="input"
                      placeholder="New York"
                    />
                  </div>

                  <div>
                    <label htmlFor="address.state" className="block text-[13px] font-medium text-gray-600 dark:text-[#8E8E93] mb-1">
                      State / Province
                    </label>
                    <input
                      id="address.state"
                      name="address.state"
                      type="text"
                      value={formData.address.state}
                      onChange={handleInputChange}
                      className="input"
                      placeholder="NY"
                    />
                  </div>

                  <div>
                    <label htmlFor="address.country" className="block text-[13px] font-medium text-gray-600 dark:text-[#8E8E93] mb-1">
                      Country
                    </label>
                    <input
                      id="address.country"
                      name="address.country"
                      type="text"
                      value={formData.address.country}
                      onChange={handleInputChange}
                      className="input"
                      placeholder="India"
                    />
                  </div>

                  <div>
                    <label htmlFor="address.zipCode" className="block text-[13px] font-medium text-gray-600 dark:text-[#8E8E93] mb-1">
                      ZIP / PIN Code
                    </label>
                    <input
                      id="address.zipCode"
                      name="address.zipCode"
                      type="text"
                      value={formData.address.zipCode}
                      onChange={handleInputChange}
                      className="input"
                      placeholder="110001"
                    />
                  </div>
                </div>
              </div>

              {/* Terms & Conditions acceptance */}
              <div className="space-y-1">
                <label htmlFor="agreeTerms" className="flex items-start gap-2.5 cursor-pointer group py-0.5">
                  <div className="relative flex-shrink-0 flex items-center mt-0.5">
                    <input
                      id="agreeTerms"
                      name="agreeTerms"
                      type="checkbox"
                      checked={agreeTerms}
                      onChange={(e) => {
                        setAgreeTerms(e.target.checked)
                        if (errors.agreeTerms) setErrors(prev => ({ ...prev, agreeTerms: '' }))
                      }}
                      className="peer sr-only"
                    />
                    <div className={`h-[16px] w-[16px] rounded-md border-2 ${errors.agreeTerms ? 'border-red-400' : 'border-gray-300 dark:border-[#48484A]'} bg-white dark:bg-[#2C2C2E] peer-checked:border-[#3EC4B1] peer-checked:bg-[#3EC4B1] transition-all duration-150 flex items-center justify-center peer-focus-visible:ring-2 peer-focus-visible:ring-[#3EC4B1]/40 peer-focus-visible:ring-offset-1`}>
                      {agreeTerms && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </div>
                  <span className="text-[12px] text-gray-500 dark:text-[#8E8E93] leading-relaxed">
                    I agree to the{' '}
                    <Link to="/terms-and-conditions" target="_blank" className="text-[#0ea5a3] dark:text-[#3EC4B1] hover:underline font-medium">Terms & Conditions</Link>
                    {' '}and{' '}
                    <Link to="/privacy-policy" target="_blank" className="text-[#0ea5a3] dark:text-[#3EC4B1] hover:underline font-medium">Privacy Policy</Link>
                  </span>
                </label>
                {errors.agreeTerms && <p className="text-[11px] text-red-500 pl-[26px]">{errors.agreeTerms}</p>}
              </div>

              {/* Error display */}
              {errors.submit && (
                <div className="rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 px-3.5 py-2.5">
                  <p className="text-[13px] font-medium text-red-600 dark:text-red-400">{errors.submit}</p>
                </div>
              )}

              {/* Submit — sticky on scroll */}
              <div className="sticky bottom-0 pt-3 pb-1 -mx-6 sm:-mx-7 px-6 sm:px-7"
                style={isDark
                  ? { background: 'linear-gradient(to top, #1C1C1E 70%, transparent)' }
                  : { background: 'linear-gradient(to top, #ffffff 70%, transparent)' }
                }
              >
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 rounded-full text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-teal-200/60 dark:hover:shadow-teal-900/40 active:scale-95 disabled:opacity-50 disabled:pointer-events-none inline-flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(135deg, #3EC4B1 0%, #0ea5a3 60%, #0b8f8f 100%)' }}
                >
                  {isLoading ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <>
                      Create School Account
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>

          {/* Sign in link */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.2, ease: [0.25, 0.4, 0.25, 1] }}
            className="mt-6 text-center space-y-3"
          >
            <p className="text-[13px] text-gray-500 dark:text-[#8E8E93]">
              Already have an account?{' '}
              <Link to="/login" className="font-semibold text-[#0ea5a3] dark:text-[#3EC4B1] hover:underline transition-colors">
                Sign in &rarr;
              </Link>
            </p>
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

export default Register
