import { describe, expect, it } from 'vitest'
import { formatTime, relativeDate } from './dates'

// A fixed "now" so these never depend on the wall clock. Local time throughout,
// which is what the user sees.
const now = new Date(2026, 8, 9, 20, 15) // 9 Sep 2026, 8:15 pm

describe('formatTime', () => {
  it('uses a 12 hour clock with a lowercase meridiem', () => {
    expect(formatTime(new Date(2026, 8, 9, 18, 41))).toBe('6:41 pm')
    expect(formatTime(new Date(2026, 8, 9, 9, 5))).toBe('9:05 am')
  })

  it('shows midnight and noon as 12', () => {
    expect(formatTime(new Date(2026, 8, 9, 0, 0))).toBe('12:00 am')
    expect(formatTime(new Date(2026, 8, 9, 12, 30))).toBe('12:30 pm')
  })
})

describe('relativeDate', () => {
  it('shows the time for today', () => {
    expect(relativeDate(new Date(2026, 8, 9, 18, 41), now)).toBe('Today, 6:41 pm')
  })

  it('counts calendar days, not 24 hour blocks', () => {
    // 11:59 pm yesterday is "Yesterday" even though it is minutes ago.
    expect(relativeDate(new Date(2026, 8, 8, 23, 59), now)).toBe('Yesterday')
  })

  it('shows a month and day earlier in the same year', () => {
    expect(relativeDate(new Date(2026, 7, 30, 12, 0), now)).toBe('Aug 30')
    expect(relativeDate(new Date(2026, 8, 5, 9, 0), now)).toBe('Sep 5')
  })

  it('adds the year for anything older', () => {
    expect(relativeDate(new Date(2024, 7, 30, 12, 0), now)).toBe('Aug 30, 2024')
  })

  it('parses the API timestamps', () => {
    const iso = new Date(2026, 8, 9, 17, 33, 23).toISOString()
    expect(relativeDate(iso, now)).toBe('Today, 5:33 pm')
  })

  it('returns an empty string for nothing usable', () => {
    expect(relativeDate(null, now)).toBe('')
    expect(relativeDate(undefined, now)).toBe('')
    expect(relativeDate('', now)).toBe('')
    expect(relativeDate('not a date', now)).toBe('')
  })
})
