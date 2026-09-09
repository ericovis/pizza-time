/* The builder: eight wedges over the pizza art, a flavor brush, drag-to-spin
   with inertia, and the presets. Ported from the design prototype's builder
   artboard and the `vals()` builder block in pizza-app.js.

   All of this state is local to the page and resets on navigation, as plan 3.7
   says. Slices are pizza IDS (what POST /api/orders/new/ wants); the art is fed
   slugs through useCatalog().slugsFor(). */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react'

import PizzaArt from '../components/PizzaArt'
import { customKey, useCart } from '../state/cart'
import { useCatalog } from '../state/catalog'
import { useToast } from '../state/toast'
import { SLICE_COUNT, WEDGES, angleDelta, angleTo } from '../lib/geometry'
import {
  breakdown as breakdownOf, distinctFlavors, emptySlices, fillWith, flavorCounts,
  isComplete, money, priceForSlices, remainingSlices,
} from '../lib/pricing'
import { bump, fly } from '../lib/fx'
import { swatchFor } from '../lib/pizza-art'

import '../styles/pages/builder.css'

/** The brush the builder starts on, and the four flavors the palette promotes
 *  into the presets, in the prototype's order (funghi, broccoli, prosciutto,
 *  mexican). Slugs, because ids belong to the database. */
const DEFAULT_BRUSH_SLUG = 'funghi'
const DEFAULT_RECENT_SLUGS = ['funghi', 'broccoli', 'prosciutto', 'mexican']

function reducedMotion(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** The wedge's little scale pulse, 300ms after the paint dot lands. */
function pulse(el: Element | null): void {
  if (!el || typeof (el as HTMLElement).animate !== 'function' || reducedMotion()) return
  el.animate(
    [{ transform: 'scale(1)' }, { transform: 'scale(1.08)' }, { transform: 'scale(1)' }],
    { duration: 360, delay: 300, easing: 'cubic-bezier(.2,.8,.2,1)' },
  )
}

interface Drag {
  /** Last pointer angle in degrees. */
  a: number
  x: number
  y: number
  /** Angular velocity in degrees per frame, for the inertia. */
  v: number
  t: number
  id: number
}

export function Builder() {
  const { pizzas, loading, error, byId, bySlug, slugsFor, reload } = useCatalog()
  const { addCustom, isFull, items } = useCart()
  const { show } = useToast()

  const [slices, setSlices] = useState<number[]>(emptySlices)
  const [brush, setBrush] = useState(0)
  const [recent, setRecent] = useState<number[]>([])
  const [rotation, setRotation] = useState(0)

  /* The catalog arrives after the first render, so the default brush and the
     recent list are seeded from slugs once, when it lands. */
  useEffect(() => {
    if (brush || pizzas.length === 0) return
    const ids = DEFAULT_RECENT_SLUGS
      .map((slug) => bySlug(slug)?.id)
      .filter((id): id is number => typeof id === 'number')
    setBrush(bySlug(DEFAULT_BRUSH_SLUG)?.id ?? pizzas[0].id)
    setRecent(ids.length ? ids : pizzas.slice(0, 4).map((p) => p.id))
  }, [pizzas, brush, bySlug])

  const filledCount = slices.filter(Boolean).length
  const remaining = remainingSlices(slices)
  const complete = isComplete(slices)
  const counts = useMemo(() => flavorCounts(slices), [slices])
  const flavorCount = distinctFlavors(slices).length
  const price = priceForSlices(slices, byId)
  const priceStr = money(price)
  const breakdown = breakdownOf(slices, byId)
  const brushPizza = brush ? byId(brush) : undefined
  const brushName = brushPizza?.name ?? ''
  const brushSwatch = swatchFor(brushPizza?.slug)

  /* Presets fill from the brush first, then the recently used flavors, then the
     rest of the menu — the prototype's `others`. */
  const others = useMemo(() => {
    const seen: number[] = []
    for (const id of [brush, ...recent, ...pizzas.map((p) => p.id)]) {
      if (id && !seen.includes(id)) seen.push(id)
    }
    return seen
  }, [brush, recent, pizzas])

  /* ------------------------------ spin ------------------------------ */

  const dragRef = useRef<Drag | null>(null)
  const draggedRef = useRef(false)
  const inertiaRef = useRef(0)
  const rotationRef = useRef(0)

  useEffect(() => () => cancelAnimationFrame(inertiaRef.current), [])

  const spinDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    cancelAnimationFrame(inertiaRef.current)
    dragRef.current = {
      a: angleTo(e.currentTarget, e.clientX, e.clientY),
      x: e.clientX,
      y: e.clientY,
      v: 0,
      t: performance.now(),
      id: e.pointerId,
    }
    draggedRef.current = false
  }, [])

  const spinMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current
    if (!d) return
    const el = e.currentTarget
    if (!draggedRef.current) {
      // Under 7px of travel is still a tap, not a spin.
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) <= 7) return
      draggedRef.current = true
      try { el.setPointerCapture(d.id) } catch { /* capture is a nicety */ }
    }
    const a = angleTo(el, e.clientX, e.clientY)
    const da = angleDelta(d.a, a)
    const now = performance.now()
    d.v = (da / Math.max(1, now - d.t)) * 16
    d.t = now
    d.a = a
    rotationRef.current += da
    setRotation(rotationRef.current)
  }, [])

  const spinUp = useCallback(() => {
    const d = dragRef.current
    dragRef.current = null
    if (!d || !draggedRef.current) return
    let v = d.v
    const step = () => {
      v *= 0.94
      rotationRef.current += v
      setRotation(rotationRef.current)
      if (Math.abs(v) > 0.05) inertiaRef.current = requestAnimationFrame(step)
    }
    inertiaRef.current = requestAnimationFrame(step)
    // Let the click that follows the drag see the flag, then clear it.
    setTimeout(() => { draggedRef.current = false }, 0)
  }, [])

  /* ----------------------------- painting ----------------------------- */

  const pickBrush = (id: number) => () => {
    setBrush(id)
    setRecent((prev) => [id, ...prev.filter((x) => x !== id)].slice(0, 4))
  }

  const tapSlice = (i: number) => (e: ReactMouseEvent<HTMLButtonElement>) => {
    if (draggedRef.current || !brush) return
    setSlices((prev) => prev.map((v, k) => (k === i ? brush : v)))
    const el = e.currentTarget
    const r = el.getBoundingClientRect()
    const a = ((WEDGES[i].mid + rotationRef.current) * Math.PI) / 180
    fly(
      document.querySelector('[data-brush-active]'),
      r.left + r.width / 2 + Math.cos(a) * r.width * 0.3,
      r.top + r.height / 2 + Math.sin(a) * r.height * 0.3,
      brushSwatch,
    )
    pulse(el)
  }

  const applyPreset = (ids: number[]) => () => {
    if (!ids.length) return
    setSlices(fillWith(ids))
    bump('[data-pizza]')
  }

  const startOver = () => setSlices(emptySlices())

  const addBuilder = () => {
    if (!complete) {
      show('Fill all 8 slices first')
      return
    }
    const key = customKey(slices)
    if (isFull && !items.some((it) => it.key === key)) {
      show('Your order is full — 20 pizzas max')
      return
    }
    const name = flavorCount === 1
      ? `Whole ${byId(distinctFlavors(slices)[0])?.name ?? 'pizza'}`
      : `Your ${flavorCount}-flavor pizza`
    addCustom(slices, { name, detail: breakdown })
    bump('[data-cart-badge]')
    show(`Custom pizza added · ${priceStr}`)
  }

  return (
    <main className="page page--wide page--builder">
      <div className="builder-head">
        <div>
          <p className="pill">Player 1 · build mode</p>
          <h1 className="display">
            Paint your <span className="builder-accent">slices</span>
          </h1>
        </div>
        <p className="muted-strong builder-lede">
          Pick a flavor, then tap the slices you want it on. Drag the pizza to spin it.
          The whole pie is priced at your most expensive flavor.
        </p>
      </div>

      <div className="builder-grid">
        <div className="builder-stage">
          <div className="stage-glow" />
          <div className="stage-orbit" />
          <div
            className="pizza-spin"
            style={{ transform: `rotate(${rotation.toFixed(2)}deg)` }}
            onPointerDown={spinDown}
            onPointerMove={spinMove}
            onPointerUp={spinUp}
            onPointerCancel={spinUp}
          >
            <PizzaArt className="stage-pizza" slices={slugsFor(slices)} cuts data-pizza="1" />
            {WEDGES.map((w, i) => (
              <button
                key={i}
                type="button"
                className="wedge"
                style={{ clipPath: w.clip }}
                aria-label={`Slice ${i + 1}: ${slices[i] ? (byId(slices[i])?.name ?? 'pizza') : 'empty'}`}
                onClick={tapSlice(i)}
              />
            ))}
          </div>
          <div className="stage-caption">{filledCount} / {SLICE_COUNT} slices · drag to spin</div>
        </div>

        <div className="stack-lg">
          <div className="panel">
            <div className="row-between palette-head">
              <h2 className="palette-title">Flavors</h2>
              <span className="palette-brush">brush: <strong>{brushName}</strong></span>
            </div>

            {error ? (
              <div className="stack">
                <p className="muted palette-note">{error}</p>
                <button type="button" className="btn btn-chip" onClick={reload}>Try again</button>
              </div>
            ) : loading && pizzas.length === 0 ? (
              <p className="muted palette-note">Loading flavors…</p>
            ) : (
              <div className="palette-grid">
                {pizzas.map((p) => {
                  const count = counts.get(p.id) ?? 0
                  const isBrush = p.id === brush
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className="flavor"
                      data-brush-active={isBrush ? 'true' : undefined}
                      aria-pressed={isBrush}
                      onClick={pickBrush(p.id)}
                    >
                      {isBrush && <span className="flavor-ring" />}
                      <PizzaArt className="flavor-art" slices={p.slug} />
                      <span className="flavor-text">
                        <span className="flavor-name">{p.name}</span>
                        <span className="flavor-price">{money(p.price)}</span>
                      </span>
                      {count > 0 && <span className="flavor-count">{count}</span>}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="presets">
            <button type="button" className="btn btn-chip" onClick={applyPreset(others.slice(0, 1))}>
              Whole {brushName}
            </button>
            <button type="button" className="btn btn-chip" onClick={applyPreset(others.slice(0, 2))}>
              Half &amp; half
            </button>
            <button type="button" className="btn btn-chip" onClick={applyPreset(others.slice(0, 4))}>
              Quarters
            </button>
            <button type="button" className="btn btn-quiet" onClick={startOver}>
              Start over
            </button>
          </div>

          <div className="summary">
            <div className="summary-copy">
              <p className="mono-label">Your pizza</p>
              <p className="builder-breakdown">
                {breakdown || 'Pick a flavor, then tap the slices.'}
              </p>
            </div>
            <div className="summary-price">
              <div className="total-figure total-figure--lg">{priceStr}</div>
              <div className="summary-price-note">priced at the top flavor</div>
            </div>
            <button type="button" className="btn btn-magenta btn-block" onClick={addBuilder}>
              {complete ? `Add to order · ${priceStr}` : `${remaining} slices to go`}
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}

export default Builder
