import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useAuth } from '../state/auth'

/** Route guard for the two order routes. Sends signed-out visitors to
 *  #/signin?next=<where they were heading>. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthed } = useAuth()
  const location = useLocation()

  if (!isAuthed) {
    const next = `${location.pathname}${location.search}`
    return <Navigate to={`/signin?next=${encodeURIComponent(next)}`} replace />
  }
  return <>{children}</>
}

export default RequireAuth
