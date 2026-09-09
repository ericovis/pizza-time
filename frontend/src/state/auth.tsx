import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { obtainToken, sessionFromToken } from '../api/auth'
import { clearSession, loadSession, onSessionChange, saveSession, type Session } from '../api/client'

export interface AuthValue {
  session: Session | null
  /** The username the API sent back, not what the user typed. */
  username: string | null
  isAuthed: boolean
  /** Rejects with an ApiError; show `error.detail` verbatim. */
  signIn: (username: string, password: string) => Promise<Session>
  signOut: () => void
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => loadSession())

  // api/client.ts owns the session: it clears it when a refresh fails, and this
  // keeps the header and the route guards in step with that.
  useEffect(() => onSessionChange(setSession), [])

  const signIn = useCallback(async (username: string, password: string) => {
    const token = await obtainToken(username, password)
    const next = sessionFromToken(token)
    saveSession(next)
    return next
  }, [])

  const signOut = useCallback(() => {
    clearSession()
  }, [])

  const value = useMemo<AuthValue>(() => ({
    session,
    username: session?.username ?? null,
    isAuthed: !!session,
    signIn,
    signOut,
  }), [session, signIn, signOut])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>')
  return value
}
