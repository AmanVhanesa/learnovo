import React, { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'

/**
 * Custom Select component with viewport-aware dropdown positioning.
 * Fixes native <select> popover misposition on iPadOS/mobile inside modals.
 *
 * Usage:
 *   <Select value={val} onChange={handler} options={[{value, label}]} />
 *   <Select value={val} onChange={handler}>
 *     <Select.Option value="">Select...</Select.Option>
 *     <Select.Option value="a">Option A</Select.Option>
 *   </Select>
 */
const Select = ({
  value,
  onChange,
  options = [],
  children,
  placeholder = 'Select...',
  className = '',
  disabled = false,
  error = false,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)
  const dropdownRef = useRef(null)

  // Derive options from children if provided
  const derivedOptions = children
    ? React.Children.toArray(children)
        .filter(child => child.type === SelectOption)
        .map(child => ({ value: child.props.value, label: child.props.children, disabled: child.props.disabled }))
    : options

  const selectedOption = derivedOptions.find(o => o.value === value)
  const displayLabel = selectedOption?.label || placeholder

  // Close on outside click/touch
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

  // Position dropdown above/below based on available space
  useEffect(() => {
    if (isOpen && dropdownRef.current && containerRef.current) {
      const trigger = containerRef.current.getBoundingClientRect()
      const dropdown = dropdownRef.current
      const dropdownHeight = dropdown.scrollHeight
      const spaceBelow = window.innerHeight - trigger.bottom - 8
      const spaceAbove = trigger.top - 8

      if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
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

  // Scroll selected option into view when dropdown opens
  useEffect(() => {
    if (isOpen && dropdownRef.current && value) {
      const selected = dropdownRef.current.querySelector('[data-selected="true"]')
      if (selected) {
        selected.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [isOpen, value])

  const handleSelect = (optValue) => {
    onChange({ target: { value: optValue } })
    setIsOpen(false)
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`input flex items-center justify-between gap-2 cursor-pointer text-left ${
          error ? 'border-red-400 focus-visible:ring-red-400' : ''
        }`}
      >
        <span className={`truncate ${
          !value && value !== 0
            ? 'text-gray-400 dark:text-[#636366]'
            : 'text-gray-900 dark:text-white'
        }`}>
          {displayLabel}
        </span>
        <ChevronDown className={`h-4 w-4 flex-shrink-0 text-gray-400 dark:text-[#636366] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute left-0 right-0 z-[10000] bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#38383A] rounded-xl shadow-lg overflow-hidden"
          style={{ maxHeight: '240px' }}
        >
          <div className="overflow-y-auto" style={{ maxHeight: '240px' }}>
            {derivedOptions.map((option, idx) => {
              const isSelected = option.value === value
              return (
                <button
                  key={option.value ?? idx}
                  type="button"
                  data-selected={isSelected}
                  onClick={() => !option.disabled && handleSelect(option.value)}
                  disabled={option.disabled}
                  className={`w-full text-left px-3.5 py-2.5 text-sm flex items-center justify-between gap-2 transition-colors
                    ${isSelected
                      ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
                      : option.disabled
                        ? 'text-gray-300 dark:text-[#48484A] cursor-not-allowed'
                        : 'text-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-[#2C2C2E]'
                    }`}
                >
                  <span className="truncate">{option.label}</span>
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

// Sub-component for declarative option syntax
const SelectOption = ({ value, children, disabled }) => null
Select.Option = SelectOption

export default Select
