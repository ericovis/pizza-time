import { afterEach, describe, expect, it } from 'vitest'

import { apiBase } from './config'

afterEach(() => {
  delete window.PIZZA_API_URL
})

describe('apiBase', () => {
  it('uses the configured URL, without a trailing slash', () => {
    window.PIZZA_API_URL = 'https://api.example.com/'
    expect(apiBase()).toBe('https://api.example.com')
  })

  it('falls back to the host the page was loaded from, on port 8000', () => {
    window.PIZZA_API_URL = ''
    // jsdom serves the tests from http://localhost:3000 by default.
    expect(apiBase()).toBe(`http://${window.location.hostname}:8000`)
    expect(apiBase()).not.toContain(':3000')
  })

  it('treats whitespace as unset', () => {
    window.PIZZA_API_URL = '   '
    expect(apiBase()).toBe(`http://${window.location.hostname}:8000`)
  })
})
