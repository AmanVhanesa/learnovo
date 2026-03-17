import React from 'react'
import { cn } from '../utils/cn'

const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  disabled = false,
  loading = false,
  ...props
}) => {
  const baseClasses = 'inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97]'

  const variants = {
    primary: 'bg-primary-600 text-white hover:bg-primary-500 hover:shadow-lg shadow-md',
    secondary: 'bg-white dark:bg-[#1C1C1E] text-gray-700 border border-gray-200 hover:bg-gray-50 hover:border-gray-300 dark:bg-[#2C2C2E] dark:text-[#8E8E93] dark:border-[#38383A] dark:hover:bg-[#2C2C2E]',
    outline: 'bg-transparent text-primary-600 border border-primary-200 hover:bg-primary-50 hover:border-primary-300 dark:text-primary-400 dark:border-primary-800 dark:hover:bg-primary-900/20',
    ghost: 'bg-transparent text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-[#8E8E93] dark:hover:bg-[#2C2C2E] dark:hover:text-white',
    danger: 'bg-red-600 text-white hover:bg-red-500 hover:shadow-lg shadow-md',
    success: 'bg-emerald-600 text-white hover:bg-emerald-500 hover:shadow-lg shadow-md',
  }

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
    xl: 'px-8 py-4 text-lg',
  }

  return (
    <button
      className={cn(baseClasses, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      )}
      {children}
    </button>
  )
}

export default Button
