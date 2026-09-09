/* Runtime configuration. Vite bakes import.meta.env in at build time, which
   would break the "one image, any API URL" rule, so the API base comes from
   window.PIZZA_API_URL — set by /config.js, which the container entrypoint
   regenerates from $API_URL on boot. */

declare global {
  interface Window {
    PIZZA_API_URL?: string
  }
}

const FALLBACK_API = 'http://localhost:8000'

/** Origin of the API, never with a trailing slash. */
export function apiBase(): string {
  const configured = typeof window !== 'undefined' ? window.PIZZA_API_URL : undefined
  const base = (configured && configured.trim()) || FALLBACK_API
  return base.replace(/\/+$/, '')
}

/** Printed on the sign-in screen and the about page. Matches seed_demo. */
export const DEMO_LOGIN = { username: 'jklimber', password: 'start123' } as const

/** The four stages of Order.status, in order. Same strings as the API. */
export const STAGES = ['Ordered', 'In the oven', 'Out for delivery', 'Delivered'] as const
export type Stage = (typeof STAGES)[number]

/** Shown next to the tracker, indexed by stage. */
export const ETA_LABELS = ['~35 min', '~25 min', '~10 min', 'Delivered'] as const

/** The server refuses an order with more than this many item rows. */
export const MAX_ORDER_ITEMS = 20

/** The server refuses a quantity outside this range. */
export const MIN_QUANTITY = 1
export const MAX_QUANTITY = 9

export function stageIndex(status: string): number {
  const i = (STAGES as readonly string[]).indexOf(status)
  return i < 0 ? 0 : i
}
