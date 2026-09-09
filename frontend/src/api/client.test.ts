/* The 401 path is the one piece of token handling nothing else covers: it is
   what keeps a demo session alive for eight hours and what makes an expired one
   land on the sign-in screen instead of on a blank page. */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError, clearSession, loadSession, request, saveSession } from './client'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const SESSION = { access: 'old-access', refresh: 'a-refresh', username: 'pizza' }

function authHeader(call: [RequestInfo | URL, RequestInit | undefined]): string | undefined {
  return (call[1]?.headers as Record<string, string> | undefined)?.Authorization
}

beforeEach(() => {
  window.sessionStorage.clear()
  clearSession()
  window.location.hash = '#/orders/7'
})

afterEach(() => {
  clearSession()
  window.sessionStorage.clear()
})

describe('request()', () => {
  it('sends the access token as a Bearer header', async () => {
    saveSession(SESSION)
    const fetchMock = vi.fn(async () => json([{ id: 1 }]))
    vi.stubGlobal('fetch', fetchMock)

    await request('/orders/get/')

    expect(authHeader(fetchMock.mock.calls[0] as never)).toBe('Bearer old-access')
  })

  it('refreshes once on a 401 and replays the request', async () => {
    saveSession(SESSION)
    let orderCalls = 0
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes('/auth/refresh/')) return json({ access: 'new-access' })
      orderCalls += 1
      return orderCalls === 1
        ? json({ detail: 'Given token not valid for any token type' }, 401)
        : json({ id: 7 })
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(request('/orders/get/7/')).resolves.toEqual({ id: 7 })

    const urls = fetchMock.mock.calls.map((c) => String(c[0]))
    expect(urls[1]).toContain('/auth/refresh/')
    // The replay carries the refreshed token, and the session keeps it.
    expect(authHeader(fetchMock.mock.calls[2] as never)).toBe('Bearer new-access')
    expect(loadSession()?.access).toBe('new-access')
    // The location was never touched: the session never expired.
    expect(window.location.hash).toBe('#/orders/7')
  })

  it('clears the session and bounces to sign-in when the refresh fails', async () => {
    saveSession(SESSION)
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes('/auth/refresh/')) return json({ detail: 'Token is invalid' }, 401)
      return json({ detail: 'Given token not valid for any token type' }, 401)
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(request('/orders/get/7/')).rejects.toBeInstanceOf(ApiError)

    expect(loadSession()).toBeNull()
    expect(window.sessionStorage.getItem('pizzatime.session')).toBeNull()
    expect(window.location.hash).toBe('#/signin?expired=1&next=%2Forders%2F7')
  })

  it('never refreshes for a request that asked not to be authenticated', async () => {
    saveSession(SESSION)
    const fetchMock = vi.fn(async () => json({ detail: 'nope' }, 401))
    vi.stubGlobal('fetch', fetchMock)

    await expect(request('/pizzas/get/', { auth: false })).rejects.toBeInstanceOf(ApiError)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(loadSession()).not.toBeNull()
  })

  it('asks for a sign-in before calling an endpoint that requires one', async () => {
    const fetchMock = vi.fn(async () => json([]))
    vi.stubGlobal('fetch', fetchMock)

    await expect(request('/orders/get/', { requireAuth: true })).rejects.toBeInstanceOf(ApiError)

    expect(fetchMock).not.toHaveBeenCalled()
    expect(window.location.hash).toBe('#/signin?expired=1&next=%2Forders%2F7')
  })

  it('turns an unreachable API into a readable ApiError', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))

    await expect(request('/pizzas/get/', { auth: false })).rejects.toMatchObject({
      status: 0,
      detail: 'The API is unreachable. Is it running?',
    })
  })

  it('surfaces a field error from a DRF 400 body', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(
      { items: { 0: { slices: ['Ensure this field has at least 8 elements.'] } } },
      400,
    )))

    await expect(request('/orders/new/', { method: 'POST', body: {} })).rejects.toMatchObject({
      status: 400,
      detail: 'Ensure this field has at least 8 elements.',
    })
  })
})
