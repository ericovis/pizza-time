/* The one place that talks to the API.

   - Base URL comes from window.PIZZA_API_URL at runtime (see lib/config.ts).
   - The signed-in session (access, refresh, username) lives in sessionStorage
     and is owned by this module, so the 401 handler can refresh or clear it
     without importing React state (and without a circular import).
   - On a 401 with a refresh token the request is retried exactly once after a
     refresh; if that fails the session is cleared and the app is sent to
     #/signin?expired=1&next=<where the user was>. */

import { apiBase } from '../lib/config'

export { apiBase }

const SESSION_KEY = 'pizzatime.session'

export interface Session {
  access: string
  refresh: string
  username: string
}

type SessionListener = (session: Session | null) => void
const listeners = new Set<SessionListener>()

function readStorage(): Session | null {
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Session>
    if (typeof parsed?.access !== 'string' || typeof parsed?.refresh !== 'string') return null
    return { access: parsed.access, refresh: parsed.refresh, username: String(parsed.username ?? '') }
  } catch {
    return null
  }
}

let current: Session | null = typeof window === 'undefined' ? null : readStorage()

export function loadSession(): Session | null {
  return current
}

export function saveSession(session: Session): void {
  current = session
  try {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch { /* private mode: keep it in memory only */ }
  listeners.forEach((fn) => fn(current))
}

export function clearSession(): void {
  current = null
  try {
    window.sessionStorage.removeItem(SESSION_KEY)
  } catch { /* ignore */ }
  listeners.forEach((fn) => fn(null))
}

/** Subscribe to sign-in / sign-out / expiry. Returns an unsubscribe function. */
export function onSessionChange(fn: SessionListener): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

/** Everything the API can say back when a request fails. */
export class ApiError extends Error {
  readonly status: number
  /** The API's own "detail" string when it sent one, else a readable fallback. */
  readonly detail: string
  /** The parsed response body, for field-level errors such as
   *  {"items": {"0": {"slices": ["Ensure this field has at least 8 elements."]}}} */
  readonly data: unknown

  constructor(status: number, detail: string, data: unknown) {
    super(detail)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
    this.data = data
  }
}

/** First human-readable string anywhere in a DRF error body. */
function firstMessage(value: unknown, depth = 0): string | null {
  if (depth > 6) return null
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = firstMessage(entry, depth + 1)
      if (found) return found
    }
    return null
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    if (typeof record.detail === 'string') return record.detail
    for (const entry of Object.values(record)) {
      const found = firstMessage(entry, depth + 1)
      if (found) return found
    }
  }
  return null
}

/** Message to show the user for any thrown value. */
export function errorMessage(error: unknown, fallback = 'Something went wrong.'): string {
  if (error instanceof ApiError) return error.detail || fallback
  if (error instanceof Error && error.message) return error.message
  return fallback
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  /** Serialized as JSON. */
  body?: unknown
  /** Send the Authorization header when a session exists. Default true. */
  auth?: boolean
  /** Refuse to run at all without a session (used by the order endpoints). */
  requireAuth?: boolean
  signal?: AbortSignal
}

function url(path: string): string {
  return apiBase() + '/api' + (path.startsWith('/') ? path : '/' + path)
}

async function parse(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined
  const text = await response.text()
  if (!text) return undefined
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function currentHash(): string {
  if (typeof window === 'undefined') return '/'
  const hash = window.location.hash.replace(/^#/, '')
  return hash || '/'
}

/** Session expired and could not be refreshed: drop it and ask for a sign-in. */
function bounceToSignIn(): void {
  clearSession()
  if (typeof window === 'undefined') return
  const here = currentHash()
  if (here.startsWith('/signin')) return
  window.location.hash = `#/signin?expired=1&next=${encodeURIComponent(here)}`
}

/** POST /api/auth/refresh/ directly, bypassing request() so a failing refresh
 *  cannot recurse back into the 401 handler. */
async function tryRefresh(session: Session): Promise<Session | null> {
  try {
    const response = await fetch(url('/auth/refresh/'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: session.refresh }),
    })
    if (!response.ok) return null
    const data = (await parse(response)) as { access?: string } | undefined
    if (!data?.access) return null
    const next: Session = { ...session, access: data.access }
    saveSession(next)
    return next
  } catch {
    return null
  }
}

async function send(path: string, options: RequestOptions, session: Session | null): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'
  if (options.auth !== false && session) headers.Authorization = `Bearer ${session.access}`
  return fetch(url(path), {
    method: options.method ?? (options.body === undefined ? 'GET' : 'POST'),
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
  })
}

/**
 * Make one API call. Resolves with the parsed JSON body, rejects with an
 * ApiError carrying the API's own message.
 *
 *   const pizzas = await request<Pizza[]>('/pizzas/get/', { auth: false })
 *   const order = await request<Order>('/orders/new/', { body: payload })
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const session = loadSession()

  if (options.requireAuth && !session) {
    bounceToSignIn()
    throw new ApiError(401, 'Authentication credentials were not provided.', null)
  }

  let response: Response
  try {
    response = await send(path, options, session)
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError(0, 'The API is unreachable. Is it running?', null)
  }

  // One refresh attempt, then give up and ask for a fresh sign-in.
  if (response.status === 401 && options.auth !== false && session) {
    const refreshed = await tryRefresh(session)
    if (refreshed) {
      response = await send(path, options, refreshed)
    }
    if (response.status === 401) {
      const data = await parse(response)
      bounceToSignIn()
      throw new ApiError(401, firstMessage(data) ?? 'Your session expired, sign in again.', data)
    }
  }

  const data = await parse(response)
  if (!response.ok) {
    throw new ApiError(response.status, firstMessage(data) ?? `Request failed (${response.status}).`, data)
  }
  return data as T
}
