/* The order list and detail show "Today, 6:41 pm", "Yesterday", "Aug 30".
   `now` is injectable so the tests do not depend on the wall clock. */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/** "6:41 pm" — lowercase meridiem, as in the design. */
export function formatTime(date: Date): string {
  const h24 = date.getHours()
  const h = h24 % 12 === 0 ? 12 : h24 % 12
  const m = String(date.getMinutes()).padStart(2, '0')
  return `${h}:${m} ${h24 < 12 ? 'am' : 'pm'}`
}

/**
 * Today       -> "Today, 6:41 pm"
 * Yesterday   -> "Yesterday"
 * This year   -> "Aug 30"
 * Older       -> "Aug 30, 2024"
 * Unparseable -> ""
 */
export function relativeDate(value: string | number | Date | null | undefined, now: Date = new Date()): string {
  if (value === null || value === undefined || value === '') return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000)
  if (days === 0) return `Today, ${formatTime(date)}`
  if (days === 1) return 'Yesterday'
  if (days === -1) return `Tomorrow, ${formatTime(date)}`

  const label = `${MONTHS[date.getMonth()]} ${date.getDate()}`
  return date.getFullYear() === now.getFullYear() ? label : `${label}, ${date.getFullYear()}`
}
