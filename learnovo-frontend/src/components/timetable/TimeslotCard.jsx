import React from 'react'
import { AlertTriangle, Lock } from 'lucide-react'

const SUBJECT_COLORS = [
  '#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444',
  '#06B6D4', '#EC4899', '#84CC16', '#F97316', '#14B8A6',
  '#A855F7', '#78716C'
]

function getSubjectColor(subjectName) {
  if (!subjectName) return SUBJECT_COLORS[0]
  let hash = 0
  for (let i = 0; i < subjectName.length; i++) {
    hash = ((hash << 5) - hash) + subjectName.charCodeAt(i)
  }
  return SUBJECT_COLORS[Math.abs(hash) % SUBJECT_COLORS.length]
}

const TimeslotCard = ({
  entry,
  isSubstituted = false,
  substituteInfo = null,
  hasConflict = false,
  isLocked = false,
  onClick,
  compact = false
}) => {
  if (!entry) return null

  const subjectName = entry.subject?.name || entry.subjectName || 'Unknown Subject'
  const teacherName = isSubstituted && substituteInfo?.teacherName
    ? substituteInfo.teacherName
    : entry.teacher?.name || entry.teacherName || ''
  const displaySubject = isSubstituted && substituteInfo?.subjectName
    ? substituteInfo.subjectName
    : subjectName
  const roomName = entry.room?.name || entry.roomName || ''
  const borderColor = isSubstituted ? '#F59E0B' : getSubjectColor(subjectName)

  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        group relative w-full text-left rounded-lg p-2 transition-all duration-150
        bg-white dark:bg-[#1C1C1E]
        hover:shadow-md hover:scale-[1.02]
        focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1
        ${hasConflict ? 'border border-dashed border-red-400' : 'border border-gray-100 dark:border-[#38383A]'}
        ${compact ? 'p-1.5' : 'p-2'}
      `}
      style={{ borderLeftWidth: '3px', borderLeftColor: borderColor, borderLeftStyle: 'solid' }}
    >
      {/* Subject name */}
      <p className={`font-semibold text-gray-900 dark:text-white truncate ${compact ? 'text-[11px] leading-tight' : 'text-[13px]'}`}>
        {displaySubject}
      </p>

      {/* Teacher name */}
      {teacherName && (
        <p className={`text-gray-600 dark:text-[#8E8E93] truncate ${compact ? 'text-[10px]' : 'text-[11px] mt-0.5'}`}>
          {teacherName}
        </p>
      )}

      {/* Room */}
      {roomName && !compact && (
        <p className="text-[10px] text-gray-400 dark:text-[#636366] truncate mt-0.5">
          {roomName}
        </p>
      )}

      {/* Indicators */}
      <div className="absolute top-1 right-1 flex items-center gap-0.5">
        {isSubstituted && (
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-100 dark:bg-amber-900/30 text-[10px]" title="Substituted">
            &#x1F504;
          </span>
        )}
        {hasConflict && (
          <span className="inline-flex items-center justify-center w-4 h-4" title="Conflict detected">
            <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
          </span>
        )}
        {isLocked && (
          <span className="inline-flex items-center justify-center w-4 h-4" title="Locked">
            <Lock className="w-3 h-3 text-gray-400 dark:text-[#636366]" />
          </span>
        )}
      </div>
    </button>
  )
}

export { getSubjectColor, SUBJECT_COLORS }
export default TimeslotCard
