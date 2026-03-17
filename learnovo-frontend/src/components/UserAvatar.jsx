import React, { useState } from 'react'

const UserAvatar = ({ photoUrl, initials, alt, size = 'md', className = '' }) => {
  const [imgFailed, setImgFailed] = useState(false)

  const sizeClasses = {
    sm: 'h-9 w-9 text-sm',
    md: 'h-10 w-10 text-sm',
    lg: 'h-11 w-11 text-sm',
  }

  const sizeClass = sizeClasses[size] || sizeClasses.md

  return (
    <div className={`${sizeClass} rounded-full overflow-hidden bg-primary-500 flex items-center justify-center flex-shrink-0 ${className}`}>
      {photoUrl && !imgFailed ? (
        <img
          src={photoUrl}
          alt={alt}
          className="h-full w-full object-cover"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <span className="font-semibold text-white flex items-center justify-center">
          {initials}
        </span>
      )}
    </div>
  )
}

export default UserAvatar
