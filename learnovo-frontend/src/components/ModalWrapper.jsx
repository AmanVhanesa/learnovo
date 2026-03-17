import React from 'react'
import { X } from 'lucide-react'

const ModalWrapper = ({ title, onClose, maxWidth = 'max-w-2xl', children }) => {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className={`bg-white dark:bg-[#1C1C1E] rounded-none sm:rounded-2xl shadow-glass-lg ring-1 ring-black/[0.03] dark:ring-white/[0.06] ${maxWidth} w-full sm:mx-4 md:mx-auto h-full sm:h-auto sm:max-h-[90vh] overflow-y-auto animate-scale-in`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-[#2C2C2E] px-4 sm:px-6 py-3 sm:py-4 sticky top-0 bg-white dark:bg-[#1C1C1E] z-10">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white truncate pr-2">{title}</h3>
          <button onClick={onClose} className="btn-close flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export default ModalWrapper
