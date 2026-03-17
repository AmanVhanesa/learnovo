import { useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { SERVER_URL } from '../constants/config'

export function useUserDisplay() {
  const { user } = useAuth()

  return useMemo(() => {
    const raw = user?.avatar || user?.photo
    const photoUrl = raw
      ? (raw.startsWith('http') ? raw : `${SERVER_URL}${raw}`)
      : null

    const displayName = user?.fullName || user?.name || ''
    const initials = displayName
      ? displayName.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase()
      : '?'

    return { photoUrl, displayName, initials, role: user?.role }
  }, [user?.avatar, user?.photo, user?.fullName, user?.name, user?.role])
}
