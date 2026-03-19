import React, { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check, FileText } from 'lucide-react'

const STATUS_BADGE = {
  draft: 'bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-[#8E8E93]',
  published: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400',
  archived: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
}

const TemplateSelector = ({
  templates = [],
  selectedId,
  onChange,
  loading = false
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)
  const dropdownRef = useRef(null)

  const selectedTemplate = templates.find((t) => t._id === selectedId)

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handler)
      document.addEventListener('touchstart', handler)
    }
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [isOpen])

  // Viewport-aware positioning
  useEffect(() => {
    if (isOpen && dropdownRef.current && containerRef.current) {
      const trigger = containerRef.current.getBoundingClientRect()
      const dropdown = dropdownRef.current
      const dropdownHeight = dropdown.scrollHeight
      const spaceBelow = window.innerHeight - trigger.bottom - 8

      if (spaceBelow < dropdownHeight) {
        dropdown.style.bottom = '100%'
        dropdown.style.top = 'auto'
        dropdown.style.marginBottom = '4px'
        dropdown.style.marginTop = '0'
      } else {
        dropdown.style.top = '100%'
        dropdown.style.bottom = 'auto'
        dropdown.style.marginTop = '4px'
        dropdown.style.marginBottom = '0'
      }
    }
  }, [isOpen])

  if (loading) {
    return (
      <div className="flex items-center space-x-2">
        <FileText className="h-4 w-4 text-gray-400 dark:text-[#636366]" />
        <span className="text-sm text-gray-500 dark:text-[#8E8E93]">Loading templates...</span>
      </div>
    )
  }

  if (templates.length === 0) {
    return (
      <div className="flex items-center space-x-2">
        <FileText className="h-4 w-4 text-gray-400 dark:text-[#636366]" />
        <span className="text-sm text-gray-500 dark:text-[#8E8E93]">No templates available</span>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#38383A] rounded-xl shadow-sm hover:bg-gray-50 dark:hover:bg-[#2C2C2E] focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all max-w-xs"
      >
        <FileText className="h-4 w-4 text-gray-400 dark:text-[#636366] flex-shrink-0" />
        <span className="text-sm font-medium text-gray-700 dark:text-white truncate">
          {selectedTemplate?.name || 'Select Template'}
        </span>
        {selectedTemplate?.status && (
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold capitalize ${STATUS_BADGE[selectedTemplate.status] || STATUS_BADGE.draft}`}>
            {selectedTemplate.status}
          </span>
        )}
        <ChevronDown className={`h-4 w-4 text-gray-400 dark:text-[#636366] flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute left-0 min-w-[260px] bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#38383A] rounded-xl shadow-lg z-[10000] overflow-hidden"
          style={{ maxHeight: '300px' }}
        >
          <div className="overflow-y-auto py-1" style={{ maxHeight: '300px' }}>
            {templates.map((template) => {
              const isSelected = selectedId === template._id
              const statusClass = STATUS_BADGE[template.status] || STATUS_BADGE.draft
              return (
                <button
                  key={template._id}
                  type="button"
                  onClick={() => {
                    onChange?.(template._id)
                    setIsOpen(false)
                  }}
                  className={`w-full text-left px-3.5 py-2.5 text-sm flex items-center justify-between gap-2 transition-colors ${
                    isSelected
                      ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
                      : 'text-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-[#2C2C2E]'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium truncate">{template.name}</span>
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold capitalize flex-shrink-0 ${statusClass}`}>
                      {template.status}
                    </span>
                  </div>
                  {isSelected && <Check className="h-4 w-4 flex-shrink-0 text-primary-500" />}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default TemplateSelector
