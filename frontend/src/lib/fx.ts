/* The design's little motion flourishes, ported verbatim in behaviour.
   All of them are no-ops when the Web Animations API is missing (jsdom) and
   respect the user's reduced-motion setting. */

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function canAnimate(el: Element | null | undefined): el is Element {
  return !!el && typeof (el as HTMLElement).animate === 'function' && !prefersReducedMotion()
}

/** Scale-bump every element matching `selector` (the cart badge, the pizza). */
export function bump(selector: string): void {
  if (typeof document === 'undefined' || prefersReducedMotion()) return
  document.querySelectorAll(selector).forEach((el) => {
    if (!canAnimate(el)) return
    el.animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(1.35)' }, { transform: 'scale(1)' }],
      { duration: 380, easing: 'cubic-bezier(.2,.8,.2,1)' },
    )
  })
}

/** Fly a coloured dot from an element to a screen point ("add to cart", "paint slice"). */
export function fly(fromEl: Element | null | undefined, x1: number, y1: number, color: string): void {
  if (!canAnimate(fromEl) || typeof document === 'undefined') return
  const a = fromEl.getBoundingClientRect()
  const size = 20
  const d = document.createElement('div')
  d.style.cssText =
    `position:fixed;left:0;top:0;width:${size}px;height:${size}px;border-radius:50%;background:${color};`
    + 'pointer-events:none;z-index:9999;box-shadow:0 6px 18px rgba(0,0,0,.35);will-change:transform'
  document.body.appendChild(d)
  const x0 = a.left + a.width / 2 - size / 2
  const y0 = a.top + a.height / 2 - size / 2
  const tx = x1 - size / 2
  const ty = y1 - size / 2
  const anim = d.animate(
    [
      { transform: `translate(${x0}px,${y0}px) scale(1)`, opacity: 1 },
      { transform: `translate(${(x0 + tx) / 2}px,${Math.min(y0, ty) - 70}px) scale(1.5)`, opacity: 1, offset: 0.5 },
      { transform: `translate(${tx}px,${ty}px) scale(.3)`, opacity: 0.2 },
    ],
    { duration: 480, easing: 'cubic-bezier(.3,.7,.3,1)' },
  )
  anim.onfinish = () => d.remove()
}

/** Convenience: fly from `fromEl` to the centre of the cart badge. */
export function flyToCart(fromEl: Element | null | undefined, color: string): void {
  if (typeof document === 'undefined') return
  const badge = document.querySelector('[data-cart-badge]')
  if (!badge) return
  const r = badge.getBoundingClientRect()
  fly(fromEl, r.left + r.width / 2, r.top + r.height / 2, color)
}

interface TiltEvent {
  pointerType?: string
  clientX: number
  clientY: number
  currentTarget: EventTarget | null
}

/** 3D tilt on a menu card. Desktop pointers only; touch is left alone. */
export function tiltMove(e: TiltEvent): void {
  if (e.pointerType === 'touch' || prefersReducedMotion()) return
  const el = e.currentTarget as HTMLElement | null
  if (!el) return
  const r = el.getBoundingClientRect()
  const px = (e.clientX - r.left) / r.width - 0.5
  const py = (e.clientY - r.top) / r.height - 0.5
  el.style.transition = 'transform .08s'
  el.style.transform =
    `perspective(900px) rotateX(${(-py * 9).toFixed(2)}deg) rotateY(${(px * 11).toFixed(2)}deg) translateY(-4px)`
  const art = el.querySelector('pizza-art') as HTMLElement | null
  if (art) {
    art.style.transition = 'transform .12s'
    art.style.transform = `translate(${px * 12}px,${py * 12}px) rotate(${px * 14}deg) scale(1.04)`
  }
}

export function tiltLeave(e: { currentTarget: EventTarget | null }): void {
  const el = e.currentTarget as HTMLElement | null
  if (!el) return
  el.style.transition = 'transform .6s cubic-bezier(.2,.8,.2,1)'
  el.style.transform = ''
  const art = el.querySelector('pizza-art') as HTMLElement | null
  if (art) {
    art.style.transition = 'transform .6s cubic-bezier(.2,.8,.2,1)'
    art.style.transform = ''
  }
}
