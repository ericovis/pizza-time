/* <pizza-art slices="pepperoni,funghi,..." theme="neon" cuts="1">

   Procedural top-down pizza on a canvas. Eight wedges, each drawn from its
   flavor's topping recipe. Ported from the design prototype's pizza-art.js with
   one change (plan Q7): RECIPES is keyed by pizza SLUG instead of by database
   id, so adding a pizza in the admin cannot shift anyone's artwork. An unknown
   slug falls back to the cheese recipe.

   Importing this module registers the custom element. Use the typed React
   wrapper in components/PizzaArt.tsx rather than the element directly. */

export type ToppingType =
  | 'cheeseblob' | 'oregano' | 'beef' | 'jalapeno' | 'corn' | 'redpepper'
  | 'greenpepper' | 'garlic' | 'basil' | 'arugula' | 'tomato' | 'prosciutto'
  | 'ham' | 'parmesan' | 'mushroom' | 'anchovy' | 'caper' | 'olive'
  | 'broccoli' | 'egg' | 'onion' | 'pea' | 'artichoke' | 'zucchini'
  | 'pepperoni' | 'pineapple'

export interface Recipe {
  cheese: boolean
  toppings: [ToppingType, number][]
}

/** The eleven seeded slugs, in menu order. Also the seed order for the RNG, so
 *  a pizza keeps the artwork it had when recipes were keyed by id 1..11. */
export const SLUG_ORDER = [
  'cheese', 'mexican', 'marinara', 'prosciutto', 'funghi', 'napoletana',
  'broccoli', 'portuguesa', 'capricciosa', 'vegetarian', 'pepperoni',
] as const

export const FALLBACK_SLUG = 'cheese'

export const RECIPES: Record<string, Recipe> = {
  cheese: { cheese: true, toppings: [['cheeseblob', 3], ['oregano', 6]] },
  mexican: { cheese: true, toppings: [['beef', 4], ['jalapeno', 2], ['corn', 5], ['redpepper', 2]] },
  marinara: { cheese: false, toppings: [['garlic', 4], ['basil', 2], ['oregano', 7], ['tomato', 1]] },
  prosciutto: { cheese: true, toppings: [['prosciutto', 3], ['arugula', 4], ['parmesan', 3]] },
  funghi: { cheese: true, toppings: [['mushroom', 4], ['oregano', 3]] },
  napoletana: { cheese: true, toppings: [['anchovy', 2], ['caper', 4], ['olive', 2], ['oregano', 3]] },
  broccoli: { cheese: true, toppings: [['broccoli', 3], ['garlic', 2]] },
  portuguesa: { cheese: true, toppings: [['egg', 1], ['onion', 2], ['ham', 2], ['olive', 2], ['pea', 4]] },
  capricciosa: { cheese: true, toppings: [['artichoke', 2], ['ham', 2], ['mushroom', 2], ['olive', 2]] },
  vegetarian: { cheese: true, toppings: [['greenpepper', 2], ['zucchini', 2], ['onion', 1], ['tomato', 1], ['olive', 2]] },
  pepperoni: { cheese: true, toppings: [['pepperoni', 4], ['oregano', 3]] },
}

/** Deterministic per-slug seed, so the same pizza always looks the same. */
function seedFor(slug: string): number {
  const i = (SLUG_ORDER as readonly string[]).indexOf(slug)
  if (i >= 0) return i + 1
  let h = 0
  for (let k = 0; k < slug.length; k++) h = (h * 31 + slug.charCodeAt(k)) >>> 0
  return (h % 997) + 12
}

type Rand = () => number
const rng = (seed: number): Rand => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0
  return seed / 4294967296
}
const TAU = Math.PI * 2

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill?: string | null, stroke?: string | null, lw?: number) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU)
  if (fill) { ctx.fillStyle = fill; ctx.fill() }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke() }
}
function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rot: number, fill?: string | null, stroke?: string | null, lw?: number) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, TAU)
  if (fill) { ctx.fillStyle = fill; ctx.fill() }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke() }
}
function strip(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, rot: number, fill: string) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot)
  ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, h / 2); ctx.fillStyle = fill; ctx.fill(); ctx.restore()
}

type DrawFn = (c: CanvasRenderingContext2D, x: number, y: number, s: number, r: Rand) => void

const DRAW: Record<ToppingType, DrawFn> = {
  cheeseblob: (c, x, y, s, r) => ellipse(c, x, y, 7 * s, 5 * s, r() * 3, 'rgba(255,225,130,.95)'),
  oregano: (c, x, y, s, r) => strip(c, x, y, 2.2 * s, 1.1 * s, r() * 3, '#4b6b3a'),
  beef: (c, x, y, s) => { circle(c, x, y, 3.4 * s, '#6e4326'); circle(c, x + 2 * s, y - 1.5 * s, 2 * s, '#835335') },
  jalapeno: (c, x, y, s) => { circle(c, x, y, 4.2 * s, '#cfe79a', '#4d8a2f', 2.2 * s); circle(c, x, y, 1.2 * s, '#e9f5c9') },
  corn: (c, x, y, s) => circle(c, x, y, 2.2 * s, '#f4c534', '#d9a512', .6 * s),
  redpepper: (c, x, y, s, r) => strip(c, x, y, 12 * s, 3.4 * s, r() * 3, '#d1402c'),
  greenpepper: (c, x, y, s, r) => strip(c, x, y, 12 * s, 3.4 * s, r() * 3, '#3e8b3e'),
  garlic: (c, x, y, s, r) => strip(c, x, y, 5 * s, 2 * s, r() * 3, '#f2ecd8'),
  basil: (c, x, y, s, r) => {
    const a = r() * 3
    ellipse(c, x, y, 6.5 * s, 3.2 * s, a, '#3f7a3a')
    c.save(); c.translate(x, y); c.rotate(a); c.beginPath(); c.moveTo(-5 * s, 0); c.lineTo(5 * s, 0)
    c.strokeStyle = '#7fb56f'; c.lineWidth = .8 * s; c.stroke(); c.restore()
  },
  arugula: (c, x, y, s, r) => ellipse(c, x, y, 7 * s, 2.2 * s, r() * 3, '#4f8a3c'),
  tomato: (c, x, y, s) => {
    circle(c, x, y, 6 * s, '#d94f3a'); circle(c, x, y, 4 * s, '#e8735f')
    circle(c, x - 1.5 * s, y, 1 * s, '#f3c58e'); circle(c, x + 1.6 * s, y + .8 * s, 1 * s, '#f3c58e')
  },
  prosciutto: (c, x, y, s, r) => {
    const a = r() * 3
    strip(c, x, y, 14 * s, 6 * s, a, '#d98a8f'); strip(c, x, y, 12 * s, 1.4 * s, a, '#f3d9d6')
  },
  ham: (c, x, y, s, r) => {
    c.save(); c.translate(x, y); c.rotate(r() * 3); c.fillStyle = '#e59aa5'
    c.beginPath(); c.roundRect(-4 * s, -4 * s, 8 * s, 8 * s, 1.5 * s); c.fill(); c.restore()
  },
  parmesan: (c, x, y, s, r) => strip(c, x, y, 6 * s, 2 * s, r() * 3, '#f6f1e1'),
  mushroom: (c, x, y, s, r) => {
    const a = r() * 3
    c.save(); c.translate(x, y); c.rotate(a); c.fillStyle = '#efe3cf'
    c.beginPath(); c.roundRect(-1.6 * s, 0, 3.2 * s, 5.5 * s, 1 * s); c.fill()
    ellipse(c, 0, 0, 6 * s, 4.2 * s, 0, '#d9c3a3', '#b89b73', .8 * s); c.restore()
  },
  anchovy: (c, x, y, s, r) => {
    const a = r() * 3
    strip(c, x, y, 14 * s, 3 * s, a, '#7f8a93'); strip(c, x, y, 11 * s, .9 * s, a, '#b7c0c7')
  },
  caper: (c, x, y, s) => circle(c, x, y, 2.2 * s, '#5e7b3a', '#3f5a26', .6 * s),
  olive: (c, x, y, s) => circle(c, x, y, 3.8 * s, null, '#23262b', 2.4 * s),
  broccoli: (c, x, y, s) => {
    c.fillStyle = '#6ea45f'; c.fillRect(x - 1.2 * s, y, 2.4 * s, 5 * s)
    circle(c, x - 2.5 * s, y - 1, 3.4 * s, '#3e7d3a'); circle(c, x + 2.5 * s, y - .5 * s, 3.4 * s, '#3e7d3a')
    circle(c, x, y - 3 * s, 3.6 * s, '#468a42'); circle(c, x + 1 * s, y - 3.5 * s, 1.1 * s, '#2d5f2a')
    circle(c, x - 2 * s, y - 1.5 * s, .9 * s, '#2d5f2a')
  },
  egg: (c, x, y, s) => { circle(c, x, y, 7.5 * s, '#f7f2e5', '#e8dcc4', .8 * s); circle(c, x, y, 3.8 * s, '#f1b636') },
  onion: (c, x, y, s, r) => {
    c.beginPath(); c.arc(x, y, 5 * s, r() * 6, r() * 3 + 5)
    c.strokeStyle = '#a066a8'; c.lineWidth = 1.6 * s; c.stroke()
  },
  pea: (c, x, y, s) => circle(c, x, y, 2 * s, '#6aa84f', '#4e8a37', .5 * s),
  artichoke: (c, x, y, s, r) => {
    const a = r() * 3
    ellipse(c, x, y, 5 * s, 7.5 * s, a, '#a7b28d', '#7f8b67', .9 * s)
    c.save(); c.translate(x, y); c.rotate(a); c.strokeStyle = '#8b9a6d'; c.lineWidth = .8 * s
    c.beginPath(); c.moveTo(0, -6 * s); c.lineTo(0, 6 * s)
    c.moveTo(-2.5 * s, -4 * s); c.lineTo(-1.5 * s, 5 * s)
    c.moveTo(2.5 * s, -4 * s); c.lineTo(1.5 * s, 5 * s); c.stroke(); c.restore()
  },
  zucchini: (c, x, y, s) => { circle(c, x, y, 5.5 * s, '#c9dc9c', '#5f8a3a', 1.6 * s); circle(c, x, y, 1.5 * s, '#e6f0cf') },
  pepperoni: (c, x, y, s) => {
    circle(c, x, y, 7 * s, '#b8322a', '#8d2119', 1.2 * s)
    circle(c, x - 2 * s, y - 1.5 * s, 1 * s, '#7a1c14')
    circle(c, x + 2.2 * s, y + 1 * s, .9 * s, '#7a1c14')
    circle(c, x - .5 * s, y + 2.6 * s, .8 * s, '#7a1c14')
  },
  pineapple: (c, x, y, s, r) => {
    c.save(); c.translate(x, y); c.rotate(r() * 3); c.fillStyle = '#f5d15c'
    c.beginPath(); c.roundRect(-5 * s, -4 * s, 10 * s, 8 * s, 2 * s); c.fill()
    c.strokeStyle = '#e0b23a'; c.lineWidth = .9 * s; c.stroke()
    c.fillStyle = '#fbe58d'; c.beginPath(); c.roundRect(-3 * s, -2.2 * s, 6 * s, 4.4 * s, 1.5 * s); c.fill(); c.restore()
  },
}

/** Draw a whole pizza. `slices` holds eight slugs; an empty string is a bare
 *  slice (used by the builder before all eight are painted). */
export function drawPizza(ctx: CanvasRenderingContext2D, W: number, slices: string[], theme: string, cuts: boolean): void {
  const cx = W / 2, cy = W / 2, R = W * 0.47, s = R / 100
  ctx.clearRect(0, 0, W, W)

  // shadow
  ctx.save()
  ctx.shadowColor = theme === 'neon' ? 'rgba(249,60,240,.45)' : 'rgba(0,0,0,.35)'
  ctx.shadowBlur = 18 * s
  ctx.shadowOffsetY = 6 * s
  ctx.beginPath(); ctx.arc(cx, cy, R * 0.98, 0, TAU); ctx.fillStyle = '#c98a3f'; ctx.fill()
  ctx.restore()

  // crust (irregular)
  ctx.beginPath()
  for (let a = 0; a <= TAU + .01; a += TAU / 180) {
    const rr = R * (1 + 0.014 * Math.sin(7 * a) + 0.009 * Math.sin(13 * a + 1.3) + 0.006 * Math.sin(23 * a))
    const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr
    if (a === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
  }
  ctx.closePath()
  const g = ctx.createRadialGradient(cx, cy, R * .7, cx, cy, R)
  g.addColorStop(0, '#e6b366'); g.addColorStop(.75, '#d9a052'); g.addColorStop(1, '#a86a2c')
  ctx.fillStyle = g; ctx.fill()
  const cr = rng(99)
  for (let i = 0; i < 26; i++) {
    const a = cr() * TAU, rr = R * (0.9 + cr() * 0.08)
    circle(ctx, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, (1 + cr() * 2.2) * s, 'rgba(120,60,20,.28)')
  }

  // wedges
  for (let i = 0; i < 8; i++) {
    const slug = slices[i]
    const a0 = -Math.PI / 2 + i * (TAU / 8), a1 = a0 + TAU / 8
    ctx.save()
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R * 0.87, a0, a1); ctx.closePath(); ctx.clip()

    if (!slug) {
      const dg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R)
      dg.addColorStop(0, '#f1e4c8'); dg.addColorStop(1, '#e2cea6')
      ctx.fillStyle = dg; ctx.fillRect(0, 0, W, W)
      const fr = rng(i + 5)
      for (let k = 0; k < 10; k++) {
        const a = a0 + .06 + fr() * (TAU / 8 - .12), rr = (0.2 + fr() * .6) * R
        circle(ctx, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 1.2 * s, 'rgba(160,120,70,.25)')
      }
      ctx.restore()
      continue
    }

    const rec = RECIPES[slug] || RECIPES[FALLBACK_SLUG]
    const f = seedFor(slug)
    circle(ctx, cx, cy, R * 0.87, '#b53a2b')
    if (rec.cheese) {
      circle(ctx, cx, cy, R * 0.8, '#f2c85b')
      const br = rng(f * 31 + i * 7)
      for (let k = 0; k < 7; k++) {
        const a = a0 + .05 + br() * (TAU / 8 - .1), rr = (0.1 + br() * .65) * R
        ellipse(ctx, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, (5 + br() * 6) * s, (3 + br() * 4) * s, br() * 3,
          k % 3 ? 'rgba(255,230,150,.7)' : 'rgba(200,140,50,.45)')
      }
    } else {
      circle(ctx, cx, cy, R * 0.8, '#c0432f')
      const br = rng(f * 31 + i * 7)
      for (let k = 0; k < 6; k++) {
        const a = a0 + .05 + br() * (TAU / 8 - .1), rr = (0.1 + br() * .65) * R
        ellipse(ctx, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, (6 + br() * 6) * s, (4 + br() * 4) * s, br() * 3, 'rgba(160,40,25,.35)')
      }
    }

    const r = rng(f * 131 + i * 17 + 3)
    rec.toppings.forEach(([type, n]) => {
      for (let k = 0; k < n; k++) {
        const a = a0 + .09 + r() * (TAU / 8 - .18), rr = (0.16 + r() * .6) * R
        DRAW[type](ctx, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, s, r)
      }
    })
    ctx.restore()
  }

  if (cuts) {
    ctx.save()
    ctx.strokeStyle = theme === 'editorial' ? 'rgba(0,0,0,.55)' : 'rgba(40,15,5,.5)'
    ctx.lineWidth = Math.max(1, 1.2 * s)
    for (let i = 0; i < 4; i++) {
      const a = -Math.PI / 2 + i * (TAU / 8)
      ctx.beginPath()
      ctx.moveTo(cx + Math.cos(a) * R * .9, cy + Math.sin(a) * R * .9)
      ctx.lineTo(cx - Math.cos(a) * R * .9, cy - Math.sin(a) * R * .9)
      ctx.stroke()
    }
    ctx.restore()
  }
}

/** "pepperoni,funghi" -> eight slugs. A single value fills the whole pie;
 *  '', '0', '-' and 'null' mean an empty slice. */
export function parseSlices(value: string): string[] {
  let parts = String(value ?? '')
    .split(',')
    .map((x) => x.trim().toLowerCase())
    .map((x) => (x === '' || x === '0' || x === '-' || x === 'null' ? '' : x))
  if (parts.length === 1) parts = Array(8).fill(parts[0])
  while (parts.length < 8) parts.push('')
  return parts.slice(0, 8)
}

export class PizzaArtElement extends HTMLElement {
  static get observedAttributes() { return ['slices', 'theme', 'cuts'] }

  private _slices = FALLBACK_SLUG
  private _theme = ''
  private _cuts = ''
  private _canvas: HTMLCanvasElement
  private _ro: ResizeObserver | null = null

  constructor() {
    super()
    this._canvas = document.createElement('canvas')
    this._canvas.style.cssText = 'display:block;width:100%;height:100%'
  }

  connectedCallback() {
    if (!this.style.display) this.style.display = 'block'
    if (!this.style.aspectRatio && !this.style.height) this.style.aspectRatio = '1'
    if (!this._canvas.isConnected) this.appendChild(this._canvas)
    if (typeof ResizeObserver !== 'undefined') {
      this._ro = new ResizeObserver(() => this.draw())
      this._ro.observe(this)
    }
    this.draw()
  }

  disconnectedCallback() {
    this._ro?.disconnect()
    this._ro = null
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null) {
    if (name === 'slices') this._slices = value ?? ''
    else if (name === 'theme') this._theme = value ?? ''
    else if (name === 'cuts') this._cuts = value ?? ''
    this.draw()
  }

  get slices() { return this._slices }
  set slices(v: string) { this._slices = String(v ?? ''); this.draw() }
  get theme() { return this._theme }
  set theme(v: string) { this._theme = String(v ?? ''); this.draw() }
  get cuts() { return this._cuts }
  set cuts(v: string | boolean) { this._cuts = v ? '1' : ''; this.draw() }

  draw() {
    if (!this.isConnected) return
    const w = this.clientWidth || 200
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const c = this._canvas
    const px = Math.round(w * dpr)
    if (c.width !== px) { c.width = px; c.height = px }
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    drawPizza(ctx, w, parseSlices(this._slices), this._theme, !!this._cuts && this._cuts !== 'false')
  }
}

/** Registering twice throws, and Vite's HMR re-evaluates modules. */
export function registerPizzaArt(): void {
  if (typeof customElements === 'undefined') return
  if (!customElements.get('pizza-art')) customElements.define('pizza-art', PizzaArtElement)
}

registerPizzaArt()
