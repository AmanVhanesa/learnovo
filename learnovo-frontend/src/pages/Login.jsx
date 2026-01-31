import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Eye, EyeOff, GraduationCap } from 'lucide-react'

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    schoolCode: ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [loginMode, setLoginMode] = useState('school') // 'school' or 'direct'

  const { login, isAuthenticated, isLoading: authLoading, error, clearError } = useAuth()
  const navigate = useNavigate()

  // Redirect if already authenticated (but only after loading is complete)
  useEffect(() => {
    // Only redirect if we're fully authenticated and not currently loading
    if (isAuthenticated && !authLoading && !isLoading) {
      console.log('Redirecting to dashboard from useEffect')
      navigate('/app/dashboard', { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, authLoading, isLoading]) // Don't include navigate in deps

  // Clear errors when component mounts
  useEffect(() => {
    clearError()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run once on mount

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)

    const loginData = {
      email: formData.email,
      password: formData.password
    }

    // Include schoolCode if provided and not empty
    // For demo login, we can send 'demo' as schoolCode or leave it empty
    if (formData.schoolCode && formData.schoolCode.trim() !== '') {
      loginData.schoolCode = formData.schoolCode.trim()
    }

    console.log('Login data:', loginData)

    try {
      const result = await login(loginData)
      console.log('Login result:', result)

      // Only navigate if login was successful
      if (result && result.success) {
        console.log('Login successful, navigating to dashboard...')
        setIsLoading(false)
        // Small delay to allow state to update
        setTimeout(() => {
          navigate('/app/dashboard', { replace: true })
        }, 300)
      } else {
        // Login failed - keep form data visible
        console.log('Login failed, result:', result)
        setIsLoading(false)
      }
    } catch (error) {
      console.error('Login error in handleSubmit:', error)
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
    if (credentials) {
      setFormData(prev => ({
        ...prev,
        email: credentials.email,
        password: credentials.password,
        schoolCode: credentials.schoolCode
      }))
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 flex items-center justify-center">
            <GraduationCap className="h-10 w-10 text-primary-600" />
          </div>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-gray-900">
            Welcome back
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Sign in to your account
          </p>
        </div>

        <div className="mt-8">
          <div className="card py-8 px-4 sm:px-10">
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="schoolCode" className="block text-sm font-medium text-gray-700">
                  School Code
                </label>
                <div className="mt-1">
                  <input
                    id="schoolCode"
                    name="schoolCode"
                    type="text"
                    value={formData.schoolCode}
                    onChange={handleChange}
                    className="input"
                    placeholder="Enter school code"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email or Admission Number
                </label>
                <div className="mt-1">
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
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Students can login with admission number if email is not available
                </p>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <div className="mt-1 relative">
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
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <div className="rounded-md bg-red-50 p-3">
                  <div className="flex">
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-800">{error}</h3>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="btn btn-primary w-full py-2.5"
                >
                  {isLoading ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    'Sign in'
                  )}
                </button>
              </div>
            </form>

            <div className="mt-8">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="bg-white px-2 text-gray-500">Demo Access</span>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {['admin', 'teacher', 'student', 'parent'].map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => handleDemoLogin(role)}
                    className="btn btn-outline border-gray-200 text-gray-500 w-full hover:bg-gray-50 hover:text-primary-600 hover:border-primary-200 py-2 capitalize font-medium text-xs"
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login
