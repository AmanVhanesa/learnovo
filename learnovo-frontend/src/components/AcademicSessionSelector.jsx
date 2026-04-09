import { useQuery } from '@tanstack/react-query'
import { Calendar, Lock, ChevronDown } from 'lucide-react'
import { academicSessionsService } from '../services/academicsService'

/**
 * Academic Session Selector — allows switching between sessions on finance pages.
 *
 * Props:
 * - selectedSessionId: current selected session _id
 * - onSessionChange: (session) => void — called with the full session object
 * - className: optional wrapper className
 */
const AcademicSessionSelector = ({ selectedSessionId, onSessionChange, className = '' }) => {
  const { data: sessions = [] } = useQuery({
    queryKey: ['academic-sessions-list'],
    queryFn: async () => {
      const res = await academicSessionsService.list()
      return res.data || []
    },
    staleTime: 5 * 60 * 1000,
  })

  const selectedSession = sessions.find(s => s._id === selectedSessionId)

  if (sessions.length <= 1) return null

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <div className="relative">
        <select
          value={selectedSessionId || ''}
          onChange={(e) => {
            const session = sessions.find(s => s._id === e.target.value)
            if (session) onSessionChange(session)
          }}
          className="input !py-1.5 !pl-8 !pr-8 text-sm font-medium appearance-none cursor-pointer"
        >
          {sessions.map(s => (
            <option key={s._id} value={s._id}>
              {s.name}{s.isActive ? ' (Active)' : ''}{s.isLocked ? ' 🔒' : ''}
            </option>
          ))}
        </select>
        <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
      </div>
      {selectedSession && !selectedSession.isActive && (
        <span className="ml-2 inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-2 py-1 rounded-full">
          <Lock className="h-3 w-3" />
          View Only
        </span>
      )}
    </div>
  )
}

export default AcademicSessionSelector
