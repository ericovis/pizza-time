import type { MouseEvent } from 'react'
import { Link } from 'react-router'

import PizzaArt from '../components/PizzaArt'
import { useCart, menuKey } from '../state/cart'
import { useCatalog } from '../state/catalog'
import { useToast } from '../state/toast'
import { bump, flyToCart, tiltLeave, tiltMove } from '../lib/fx'
import { swatchFor } from '../lib/pizza-art'
import { DELIVERY_FEE, money, toNumber } from '../lib/pricing'
import type { Pizza } from '../api/pizzas'

import '../styles/pages/menu.css'

/** The pie on the "Build your own" card: the four-flavor custom from the seed. */
const BUILD_YOUR_OWN_SLICES = [
  'pepperoni', 'pepperoni', 'prosciutto', 'prosciutto',
  'broccoli', 'broccoli', 'mexican', 'mexican',
]

const SKELETON_KEYS = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8']

export function Menu() {
  const { pizzas, loading, error, reload } = useCatalog()
  const { addMenu, isFull, items } = useCart()
  const { show } = useToast()

  /* #menu is an id on this page, not a route, so the hash router must not see
     it: scroll instead of following an href. */
  function seeTheMenu() {
    const section = document.getElementById('menu')
    if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function add(pizza: Pizza, event: MouseEvent<HTMLButtonElement>) {
    const known = items.some((item) => item.key === menuKey(pizza.id))
    if (isFull && !known) {
      show('Your order is full · 20 pizzas max')
      return
    }
    addMenu(pizza)
    bump('[data-cart-badge]')
    show(`${pizza.name} added to your order`)
    const card = event.currentTarget.closest('[data-card]')
    const from = card?.querySelector('pizza-art') ?? event.currentTarget
    flyToCart(from, swatchFor(pizza.slug))
  }

  const countLabel = pizzas.length === 1 ? '1 pizza' : `${pizzas.length} pizzas`
  const fromPrice = pizzas.length
    ? money(Math.min(...pizzas.map((p) => toNumber(p.price))))
    : '$11.00'

  return (
    <main className="page page--wide">
      <section className="hero">
        <div>
          <p className="pill pill--magenta">Insert coin · open till late</p>
          <h1 className="display display--hero">
            Eight slices.
            <br />
            <span className="accent-lime">Your rules.</span>
          </h1>
          <p className="lede">
            Eleven pizzas straight from the oven, or build your own slice by slice — up to eight
            flavors on one pie, priced at the most expensive one you pick.
          </p>
          <div className="hero-actions">
            <Link className="btn btn-magenta" to="/build">Build your pizza</Link>
            <button type="button" className="btn btn-ghost" onClick={seeTheMenu}>See the menu</button>
          </div>
        </div>
        <div className="hero-art">
          <div className="hero-glow" />
          <div className="hero-orbit"><span className="hero-orbit-dot" /></div>
          <div className="hero-float">
            <div className="hero-spin">
              <PizzaArt slices="mexican" cuts className="hero-pizza" />
            </div>
          </div>
        </div>
      </section>

      <section className="menu-section" id="menu">
        <div className="menu-head">
          <h2 className="section-title">
            Select <span className="accent-magenta">your pizza</span>
          </h2>
          <span className="muted">
            {loading && !pizzas.length
              ? 'Loading the menu…'
              : error && !pizzas.length
                ? 'Menu unavailable'
                : `${countLabel} · $${DELIVERY_FEE} delivery`}
          </span>
        </div>

        <div className="menu-grid">
          {error && !pizzas.length && (
            <div className="panel panel--magenta panel--pad menu-wide">
              <p className="mono-label">The oven is not answering</p>
              <p className="muted-strong">{error}</p>
              <div className="wrap-actions menu-error-actions">
                <button type="button" className="btn btn-lime btn-sm" onClick={reload}>Try again</button>
              </div>
            </div>
          )}

          {loading && !pizzas.length && !error && SKELETON_KEYS.map((key) => (
            <article key={key} className="card menu-skeleton" aria-hidden="true">
              <div className="card-art">
                <div className="menu-skeleton-art" />
              </div>
              <div className="card-body">
                <div className="menu-skeleton-line menu-skeleton-line--title" />
                <div className="menu-skeleton-line" />
                <div className="card-foot">
                  <div className="menu-skeleton-line menu-skeleton-line--price" />
                  <div className="menu-skeleton-line menu-skeleton-line--btn" />
                </div>
              </div>
            </article>
          ))}

          {pizzas.map((pizza) => (
            <article
              key={pizza.id}
              className="card"
              data-card="1"
              onPointerMove={tiltMove}
              onPointerLeave={tiltLeave}
            >
              <div className="card-index">P{pizza.id}</div>
              <div className="card-art">
                <div className="card-art-glow" />
                <PizzaArt slices={pizza.slug} className="card-pizza" />
              </div>
              <div className="card-body">
                <h3 className="card-title">{pizza.name}</h3>
                <p className="card-text">{pizza.toppings}</p>
                <div className="card-foot">
                  <span className="price">{money(pizza.price)}</span>
                  <button
                    type="button"
                    className="btn btn-magenta btn-sm"
                    onClick={(event) => add(pizza, event)}
                    aria-label={`Add ${pizza.name} to your order`}
                  >
                    Add
                  </button>
                </div>
              </div>
            </article>
          ))}

          <Link className="card card--dashed" to="/build">
            <span className="card-index card-index--magenta">P{pizzas.length + 1} · YOU</span>
            <span className="card-art">
              <span className="card-art-glow card-art-glow--lime" />
              <span className="card-pizza-spin">
                <PizzaArt slices={BUILD_YOUR_OWN_SLICES} cuts className="card-pizza menu-own-pizza" />
              </span>
            </span>
            <span className="card-body">
              <span className="card-title card-title--lime">Build your own</span>
              <span className="card-text">8 slices, up to 8 flavors · priced at your top flavor</span>
              <span className="card-foot">
                <span className="card-price-muted">from {fromPrice}</span>
                <span className="card-cta">Start</span>
              </span>
            </span>
          </Link>
        </div>
      </section>
    </main>
  )
}

export default Menu
