import React, { useState, useRef, useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'

const CONFLICT_TYPE_LABELS = {
  teacher_overlap: 'Teacher Overlap',
  room_overlap: 'Room Overlap',
  class_overlap: 'Class Overlap',
  constraint_violation: 'Constraint Violation',
  capacity_exceeded: 'Room Capacity Exceeded'
}

const ConflictBadge = ({ conflicts = [] }) => {
  const [showTooltip, setShowTooltip] = useState(false)
  const badgeRef = useRef(null)
  const tooltipRef = useRef(null)

  // Position tooltip to stay in viewport
  useEffect(() => {
    if (showTooltip && tooltipRef.current && badgeRef.current) {
      const badge = badgeRef.current.getBoundingClientRect()
      const tooltip = tooltipRef.current
      const tooltipRect = tooltip.getBoundingClientRect()

      // Horizontal: try to center, but keep in viewport
      const left = badge.left + badge.width / 2 - tooltipRect.width / 2
      if (left < 8) {
        tooltip.style.left = '0'
        tooltip.style.transform = 'none'
      } else if (left + tooltipRect.width > window.innerWidth - 8) {
        tooltip.style.left = 'auto'
        tooltip.style.right = '0'
        tooltip.style.transform = 'none'
      }

      // Vertical: show above if no space below
      const spaceBelow = window.innerHeight - badge.bottom - 8
      if (spaceBelow < tooltipRect.height + 8) {
        tooltip.style.bottom = '100%'
        tooltip.style.top = 'auto'
        tooltip.style.marginBottom = '6px'
        tooltip.style.marginTop = '0'
      }
    }
  }, [showTooltip])

  if (!conflicts || conflicts.length === 0) return null

  return (
    <div
      ref={badgeRef}
      className="relative inline-flex"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onFocus={() => setShowTooltip(true)}
      onBlur={() => setShowTooltip(false)}
      tabIndex={0}
      role="status"
      aria-label={`${conflicts.length} conflict${conflicts.length !== 1 ? 's' : ''} detected`}
    >
      {/* Badge */}
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-xs font-semibold ring-1 ring-inset ring-red-200 dark:ring-red-800 cursor-default">
        <AlertTriangle className="w-3 h-3" />
        <span>{conflicts.length}</span>
      </span>

      {/* Tooltip */}
      {showTooltip && (
        <div
          ref={tooltipRef}
          className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 z-50 w-64 bg-gray-900 dark:bg-[#2C2C2E] text-white rounded-lg shadow-xl border border-gray-700 dark:border-[#38383A] overflow-hidden"
        >
          <div className="px-3 py-2 border-b border-gray-700 dark:border-[#38383A]">
            <p className="text-xs font-semibold">
              {conflicts.length} Conflict{conflicts.length !== 1 ? 's' : ''} Detected
            </p>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {conflicts.map((conflict, idx) => (
              <div
                key={idx}
                className={`px-3 py-2 text-xs ${idx < conflicts.length - 1 ? 'border-b border-gray-800 dark:border-[#38383A]' : ''}`}
              >
                <p className="font-medium text-red-300">
                  {CONFLICT_TYPE_LABELS[conflict.type] || conflict.type || 'Conflict'}
                </p>
                {conflict.message && (
                  <p className="text-gray-300 dark:text-[#8E8E93] mt-0.5 leading-relaxed">
                    {conflict.message}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default ConflictBadge
