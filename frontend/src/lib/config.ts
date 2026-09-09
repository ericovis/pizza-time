/* Runtime configuration. Vite bakes import.meta.env in at build time, which
   would break the "one image, any API URL" rule, so the API base comes from
   window.PIZZA_API_URL — set by /config.js, which the container entrypoint
   regenerates from $API_URL on boot. */

declare global {
  interface Window {
    PIZZA_API_URL?: string
  }
}

const API_PORT = '8000'

/** Origin of the API, never with a trailing slash.

    With API_URL unset the API is assumed to live on the same host the page was
    loaded from, on port 8000. That is what Docker Compose publishes, and it
    keeps a phone on the same network working: it opened http://<laptop-ip>:8080,
    so it calls http://<laptop-ip>:8000, where "localhost" would have pointed
    the phone at itself. */
export function apiBase(): string {
  const configured = typeof window !== 'undefined' ? window.PIZZA_API_URL : undefined
  if (configured && configured.trim()) return configured.trim().replace(/\/+$/, '')
  if (typeof window !== 'undefined' && window.location && window.location.hostname) {
    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:'
    return `${protocol}//${window.location.hostname}:${API_PORT}`
  }
  return `http://localhost:${API_PORT}`
}

/** Where the code lives. Linked from the About page and the footer. */
export const REPO_URL = 'https://github.com/ericovis/pizza-time'

/** Printed on the sign-in screen. Matches seed_demo. */
export const DEMO_LOGIN = { username: 'pizza', password: 'pizza' } as const

/** The four stages of Order.status, in order. Same strings as the API. */
export const STAGES = ['Ordered', 'In the oven', 'Out for delivery', 'Delivered'] as const
export type Stage = (typeof STAGES)[number]

/** Shown next to the tracker, indexed by stage. */
export const ETA_LABELS = ['~35 min', '~25 min', '~10 min', 'Delivered'] as const

/** The server refuses an order with more than this many item rows. */
export const MAX_ORDER_ITEMS = 20

/** Shown when a 21st distinct pizza is added. One string, so the menu and the
 *  builder say the same thing. */
export const CART_FULL_MESSAGE = `Your order is full · ${MAX_ORDER_ITEMS} pizzas max`

/** The server refuses a quantity outside this range. */
export const MIN_QUANTITY = 1
export const MAX_QUANTITY = 9

export function stageIndex(status: string): number {
  const i = (STAGES as readonly string[]).indexOf(status)
  return i < 0 ? 0 : i
}
