import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { School, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react'
import { tenantService } from '../services/tenantService'

const Register = () => {
  const navigate = useNavigate()
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
  const [errors, setErrors] = useState({})
  const [availability, setAvailability] = useState({})

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
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }))
    }

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }))
    }
  }

  const checkAvailability = async (field, value) => {
    if (!value || value.length < 3) return

    try {
      const data = await tenantService.checkAvailability({ [field]: value })

      if (data.success) {
        setAvailability(prev => ({
          ...prev,
          [field]: data.data[field]
        }))
      }
    } catch (error) {
      console.error('Error checking availability:', error)
    }
  }

  const validateForm = () => {
    const newErrors = {}

    console.log('Validating form data:', formData)

    if (!formData.schoolName.trim()) {
      newErrors.schoolName = 'School name is required'
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required'
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid'
    }

    const pwdField = 'password'
    if (!formData[pwdField]) {
      newErrors[pwdField] = 'Password is required'
    } else if (formData[pwdField].length < 6) {
      newErrors[pwdField] = 'Password must be at least 6 characters'
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match'
    }

    if (!formData.schoolCode.trim()) {
      newErrors.schoolCode = 'School code is required'
    } else if (formData.schoolCode.length < 3) {
      newErrors.schoolCode = 'School code must be at least 3 characters'
    }

    // Subdomain is optional - validate only if provided
    if (formData.subdomain.trim() && formData.subdomain.length < 3) {
      newErrors.subdomain = 'Subdomain must be at least 3 characters'
    } else if (formData.subdomain.trim() && !/^[a-z0-9-]+$/.test(formData.subdomain)) {
      newErrors.subdomain = 'Subdomain can only contain lowercase letters, numbers, and hyphens'
    }

    console.log('Validation errors:', newErrors)
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    console.log('Form submitted with data:', formData)

    if (!validateForm()) {
      console.log('Form validation failed')
      return
    }

    setIsLoading(true)
    setErrors({}) // Clear previous errors

    try {
      // Only send required fields to backend
      // Note: subdomain is optional - backend will auto-generate from schoolCode if not provided
      const registrationData = {
        schoolName: formData.schoolName,
        email: formData.email,
        password: formData.password,
        schoolCode: formData.schoolCode,
        subdomain: formData.subdomain || undefined, // Send undefined if empty, backend will auto-generate
        phone: formData.phone || '',
        address: formData.address.street ? {
          street: formData.address.street,
          city: formData.address.city,
          state: formData.address.state,
          country: formData.address.country,
          zipCode: formData.address.zipCode
        } : undefined
      }

      console.log('Submitting registration data:', registrationData)
      const data = await tenantService.register(registrationData)
      console.log('Registration response:', data)

      if (data.success) {
        // Store token and user data
        localStorage.setItem('token', data.data.token)
        localStorage.setItem('user', JSON.stringify(data.data.user))
        localStorage.setItem('tenant', JSON.stringify(data.data.tenant))

        // Redirect to dashboard
        navigate('/app/dashboard')
      } else {
        setErrors({ submit: data.message })
      }
    } catch (error) {
      console.error('Registration error:', error)
      console.error('Error response:', error.response?.data)
      console.error('Error status:', error.response?.status)
      console.error('Error message:', error.message)

      let errorMessage = 'Registration failed. Please try again.'

      if (error.response?.data) {
        // Handle validation errors from backend
        if (error.response.data.errors && Array.isArray(error.response.data.errors)) {
          const backendErrors = {}
          error.response.data.errors.forEach(err => {
            const fieldName = err.field || err.path || err.param
            backendErrors[fieldName] = err.message || err.msg
          })
          setErrors(backendErrors)
          return // Don't set submit error if we have field errors
        }

        // Single error message
        if (error.response.data.message) {
          errorMessage = error.response.data.message
        } else if (error.response.data.error) {
          errorMessage = error.response.data.error
        }
      } else if (error.message) {
        errorMessage = error.message
      }

      setErrors({ submit: errorMessage })

      // Also show in console for debugging
      console.error('Final error message shown to user:', errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#000000] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <School className="h-12 w-12 text-primary-600" />
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
          Create Your School Account
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600 dark:text-[#8E8E93]">
          Start your free 14-day trial today
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-2xl">
        <div className="bg-white dark:bg-[#1C1C1E] py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* School Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">School Information</h3>

              <div>
                <label htmlFor="schoolName" className="block text-sm font-medium text-gray-700 dark:text-white">
                  School Name *
                </label>
                <input
                  id="schoolName"
                  name="schoolName"
                  type="text"
                  required
                  value={formData.schoolName}
                  onChange={handleInputChange}
                  className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-[#1C1C1E] dark:text-white dark:placeholder-[#636366] ${errors.schoolName ? 'border-red-300' : 'border-gray-300 dark:border-[#38383A]'
                    }`}
                  placeholder="Enter your school name"
                />
                {errors.schoolName && (
                  <p className="mt-1 text-sm text-red-600">{errors.schoolName}</p>
                )}
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-white">
                  Admin Email *
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={handleInputChange}
                  className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-[#1C1C1E] dark:text-white dark:placeholder-[#636366] ${errors.email ? 'border-red-300' : 'border-gray-300 dark:border-[#38383A]'
                    }`}
                  placeholder="admin@yourschool.com"
                />
                {errors.email && (
                  <p className="mt-1 text-sm text-red-600">{errors.email}</p>
                )}
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 dark:text-white">
                  Phone Number
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleInputChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-[#38383A] rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-[#1C1C1E] dark:text-white dark:placeholder-[#636366]"
                  placeholder="+1 (555) 123-4567"
                />
              </div>
            </div>

            {/* School Access */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">School Access</h3>

              <div>
                <label htmlFor="schoolCode" className="block text-sm font-medium text-gray-700 dark:text-white">
                  School Code *
                </label>
                <div className="mt-1 flex">
                  <input
                    id="schoolCode"
                    name="schoolCode"
                    type="text"
                    required
                    value={formData.schoolCode}
                    onChange={handleInputChange}
                    onBlur={() => checkAvailability('schoolCode', formData.schoolCode)}
                    className={`flex-1 px-3 py-2 border rounded-l-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-[#1C1C1E] dark:text-white dark:placeholder-[#636366] ${errors.schoolCode ? 'border-red-300' : 'border-gray-300 dark:border-[#38383A]'
                      }`}
                    placeholder="myschool"
                  />
                  <div className="flex items-center px-3 py-2 border border-l-0 border-gray-300 dark:border-[#38383A] rounded-r-md bg-gray-50 dark:bg-[#2C2C2E]">
                    {availability.schoolCode === true && (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    )}
                    {availability.schoolCode === false && (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                  </div>
                </div>
                <p className="mt-1 text-sm text-gray-500 dark:text-[#8E8E93]">
                  Your unique school identifier. Use this code to login.
                </p>
                {errors.schoolCode && (
                  <p className="mt-1 text-sm text-red-600">{errors.schoolCode}</p>
                )}
              </div>

              <div>
                <label htmlFor="subdomain" className="block text-sm font-medium text-gray-700 dark:text-white">
                  Subdomain (Optional - Auto-filled from School Code)
                </label>
                <div className="mt-1 flex">
                  <input
                    id="subdomain"
                    name="subdomain"
                    type="text"
                    value={formData.subdomain}
                    onChange={handleInputChange}
                    placeholder="myschool"
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-[#38383A] rounded-l-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-[#1C1C1E] dark:text-white dark:placeholder-[#636366]"
                  />
                  <div className="flex items-center px-3 py-2 border border-l-0 border-gray-300 dark:border-[#38383A] rounded-r-md bg-gray-50 dark:bg-[#2C2C2E]">
                    <span className="text-sm text-gray-500 dark:text-[#8E8E93]">.learnovo.com</span>
                  </div>
                </div>
                <p className="mt-1 text-sm text-gray-500 dark:text-[#8E8E93]">
                  Optional: Custom subdomain. If left empty, your school code will be used.
                </p>
              </div>
            </div>

            {/* Password */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Admin Password</h3>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-white">
                  Password *
                </label>
                <div className="mt-1 relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={formData.password}
                    onChange={handleInputChange}
                    className={`block w-full px-3 py-2 pr-10 border rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-[#1C1C1E] dark:text-white dark:placeholder-[#636366] ${errors.password ? 'border-red-300' : 'border-gray-300 dark:border-[#38383A]'
                      }`}
                    placeholder="Enter password"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5 text-gray-400 dark:text-[#636366]" />
                    ) : (
                      <Eye className="h-5 w-5 text-gray-400 dark:text-[#636366]" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-1 text-sm text-red-600">{errors.password}</p>
                )}
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-white">
                  Confirm Password *
                </label>
                <div className="mt-1 relative">
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    className={`block w-full px-3 py-2 pr-10 border rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-[#1C1C1E] dark:text-white dark:placeholder-[#636366] ${errors.confirmPassword ? 'border-red-300' : 'border-gray-300 dark:border-[#38383A]'
                      }`}
                    placeholder="Confirm password"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-5 w-5 text-gray-400 dark:text-[#636366]" />
                    ) : (
                      <Eye className="h-5 w-5 text-gray-400 dark:text-[#636366]" />
                    )}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>
                )}
              </div>
            </div>

            {/* Address (Optional) */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">School Address (Optional)</h3>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="address.street" className="block text-sm font-medium text-gray-700 dark:text-white">
                    Street Address
                  </label>
                  <input
                    id="address.street"
                    name="address.street"
                    type="text"
                    value={formData.address.street}
                    onChange={handleInputChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-[#38383A] rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-[#1C1C1E] dark:text-white dark:placeholder-[#636366]"
                    placeholder="123 Main St"
                  />
                </div>

                <div>
                  <label htmlFor="address.city" className="block text-sm font-medium text-gray-700 dark:text-white">
                    City
                  </label>
                  <input
                    id="address.city"
                    name="address.city"
                    type="text"
                    value={formData.address.city}
                    onChange={handleInputChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-[#38383A] rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-[#1C1C1E] dark:text-white dark:placeholder-[#636366]"
                    placeholder="New York"
                  />
                </div>

                <div>
                  <label htmlFor="address.state" className="block text-sm font-medium text-gray-700 dark:text-white">
                    State/Province
                  </label>
                  <input
                    id="address.state"
                    name="address.state"
                    type="text"
                    value={formData.address.state}
                    onChange={handleInputChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-[#38383A] rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-[#1C1C1E] dark:text-white dark:placeholder-[#636366]"
                    placeholder="NY"
                  />
                </div>

                <div>
                  <label htmlFor="address.country" className="block text-sm font-medium text-gray-700 dark:text-white">
                    Country
                  </label>
                  <input
                    id="address.country"
                    name="address.country"
                    type="text"
                    value={formData.address.country}
                    onChange={handleInputChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-[#38383A] rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-[#1C1C1E] dark:text-white dark:placeholder-[#636366]"
                    placeholder="United States"
                  />
                </div>
              </div>
            </div>

            {errors.submit && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
                <p className="text-sm text-red-600 dark:text-red-400">{errors.submit}</p>
              </div>
            )}

            {Object.keys(errors).length > 0 && !errors.submit && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
                <p className="text-sm text-red-600 dark:text-red-400 font-medium">Please fix the following errors:</p>
                <ul className="mt-2 text-sm text-red-600 dark:text-red-400 list-disc list-inside">
                  {Object.entries(errors).map(([field, error]) => (
                    <li key={field}>{error}</li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
              >
                {isLoading ? 'Creating Account...' : 'Create School Account'}
              </button>
            </div>

            <div className="text-center">
              <p className="text-sm text-gray-600 dark:text-[#8E8E93]">
                Already have an account?{' '}
                <Link to="/login" className="font-medium text-primary-600 hover:text-primary-500">
                  Sign in to your school
                </Link>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default Register
