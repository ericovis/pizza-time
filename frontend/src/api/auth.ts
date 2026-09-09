import { request, saveSession, clearSession, type Session } from './client'

/** POST /api/auth/ response. `is_staff` is always false on success — staff are
 *  refused at the token endpoint (plan Q4). */
export interface TokenResponse {
  access: string
  refresh: string
  username: string
  is_staff: boolean
}

export interface RefreshResponse {
  access: string
}

/**
 * Sign in. Rejects with an ApiError whose `detail` is the API's message:
 *   "No active account found with the given credentials"  (bad credentials)
 *   "Staff accounts sign in at /admin/."                  (a staff account)
 * Both must be displayed verbatim.
 */
export async function obtainToken(username: string, password: string): Promise<TokenResponse> {
  return request<TokenResponse>('/auth/', {
    method: 'POST',
    body: { username, password },
    auth: false,
  })
}

export async function refreshToken(refresh: string): Promise<RefreshResponse> {
  return request<RefreshResponse>('/auth/refresh/', {
    method: 'POST',
    body: { refresh },
    auth: false,
  })
}

export function sessionFromToken(token: TokenResponse): Session {
  return { access: token.access, refresh: token.refresh, username: token.username }
}

export { saveSession, clearSession }
export type { Session }
