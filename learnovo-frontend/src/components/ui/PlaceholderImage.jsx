import { useState } from 'react'

export default function PlaceholderImage({ src, alt, className = '', style = {} }) {
  const [failed, setFailed] = useState(false)
  const filename = src?.split('/').pop() || 'image'

  if (failed || !src) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-100 dark:bg-[#2C2C2E] border border-gray-200 dark:border-[#38383A] rounded-xl text-xs text-gray-400 dark:text-[#636366] font-medium select-none ${className}`}
        style={{ minHeight: 120, ...style }}
      >
        {filename}
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt || filename}
      className={className}
      style={style}
      onError={() => setFailed(true)}
    />
  )
}
