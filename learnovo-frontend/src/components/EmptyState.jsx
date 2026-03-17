import React from 'react'

const EmptyState = ({ icon: Icon, title, description, action }) => {
  return (
    <div className="text-center py-16 animate-fade-in">
      {Icon && (
        <div className="mx-auto w-14 h-14 rounded-2xl bg-gray-100 dark:bg-[#2C2C2E] flex items-center justify-center mb-4">
          <Icon className="h-7 w-7 text-gray-400 dark:text-[#636366]" />
        </div>
      )}
      <p className="text-sm font-medium text-gray-600 dark:text-[#8E8E93]">{title}</p>
      {description && <p className="text-xs text-gray-400 dark:text-[#636366] mt-1.5 max-w-xs mx-auto">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export default EmptyState
