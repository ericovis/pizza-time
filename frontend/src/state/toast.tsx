import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

export interface ToastValue {
  message: string | null
  /** Show a message for 2.4s, replacing whatever is on screen. */
  show: (message: string) => void
  hide: () => void
}

const ToastContext = createContext<ToastValue | null>(null)

const DURATION = 2400

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const hide = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    setMessage(null)
  }, [])

  const show = useCallback((next: string) => {
    if (timer.current) clearTimeout(timer.current)
    setMessage(next)
    timer.current = setTimeout(() => {
      timer.current = null
      setMessage(null)
    }, DURATION)
  }, [])

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  const value = useMemo<ToastValue>(() => ({ message, show, hide }), [message, show, hide])
  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>
}

export function useToast(): ToastValue {
  const value = useContext(ToastContext)
  if (!value) throw new Error('useToast must be used inside <ToastProvider>')
  return value
}
