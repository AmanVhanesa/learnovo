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
    <div className="min-h-screen bg-gradient-to-br from-primary-500 to-secondary-600 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-white rounded-full flex items-center justify-center shadow-lg overflow-hidden">
            <img 
              src="/learnovo.png" 
              alt="Learnovo Logo" 
              className="h-full w-full object-contain p-2"
              onError={(e) => {
                // Fallback to icon if logo fails to load
                e.target.style.display = 'none';
                const iconDiv = document.createElement('div');
                iconDiv.className = 'flex items-center justify-center h-full w-full';
                iconDiv.innerHTML = '<svg class="h-8 w-8 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 14l9-5-9-5-9 5 9 5z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 14l0 0M12 19l0 0M12 9l0 0M5 19l6-2 6 2M5 14l6-2 6 2" /></svg>';
                e.target.parentElement.appendChild(iconDiv);
              }}
            />
          </div>
          <h2 className="mt-6 text-3xl font-bold text-white">
            Learnovo
          </h2>
          <p className="mt-2 text-sm text-primary-100">
            Student Management System
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-xl p-8">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="schoolCode" className="block text-sm font-medium text-gray-700">
                School Code
              </label>
              <input
                id="schoolCode"
                name="schoolCode"
                type="text"
                value={formData.schoolCode}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                placeholder="Enter your school code"
              />
              <p className="mt-1 text-sm text-gray-500">
                Enter your school's unique code to access your dashboard
              </p>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={formData.email}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                placeholder="Enter your email"
              />
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
                  className="block w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
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
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="loading-spinner"></div>
                ) : (
                  'Sign In'
                )}
              </button>
            </div>

            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">Demo Login</span>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <button
                  type="button"
                  onClick={() => handleDemoLogin('admin')}
                  className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                >
                  Admin
                </button>
                <button
                  type="button"
                  onClick={() => handleDemoLogin('teacher')}
                  className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                >
                  Teacher
                </button>
                <button
                  type="button"
                  onClick={() => handleDemoLogin('student')}
                  className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                >
                  Student
                </button>
                <button
                  type="button"
                  onClick={() => handleDemoLogin('parent')}
                  className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                >
                  Parent
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default Login
