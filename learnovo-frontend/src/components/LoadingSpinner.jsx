import React from 'react'

const LoadingSpinner = ({ size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'h-5 w-5 border-[1.5px]',
    md: 'h-8 w-8 border-2',
    lg: 'h-12 w-12 border-2',
  }

  return (
    <div className={`flex items-center justify-center py-16 ${className}`}>
      <div className={`animate-spin rounded-full border-gray-200 border-t-primary-500 dark:border-[#38383A] dark:border-t-primary-400 ${sizeClasses[size] || sizeClasses.md}`} />
    </div>
  )
}

export default LoadingSpinner
