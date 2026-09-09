import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'

import { ApiError, errorMessage } from '../api/client'
import { getOrder, type Order as OrderRecord, type OrderItem } from '../api/orders'
import PizzaArt from '../components/PizzaArt'
import Tracker, { etaFor } from '../components/Tracker'
import { relativeDate } from '../lib/dates'
import { money } from '../lib/pricing'
import { useCatalog } from '../state/catalog'
import '../styles/pages/order.css'

/** Staff advance an order in the admin (plan Q3), so the tracking screen asks
 *  the API again every five seconds until the order is delivered. */
const POLL_MS = 5000

const DELIVERED = 'Delivered'

/** The row's second line: the distinct flavors, plus the quantity and unit
 *  price when the customer ordered the same pie more than once. The price
 *  column then shows the line total, so the rows add up to the order total. */
function detailFor(item: OrderItem): string {
  const flavors = item.flavors.join(' · ')
  return item.quantity > 1
    ? `${flavors} · ×${item.quantity} at ${money(item.unit_price)}`
    : flavors
}

/** The ORDER screen: the detail rows of one order, with the celebration header
 *  and the four-step tracker on top while it is still on its way (or when we
 *  have just arrived from checkout with ?placed=1). */
export function Order() {
  const { id } = useParams()
  const [search] = useSearchParams()
  const placed = search.get('placed') === '1'
  const { slugsFor } = useCatalog()

  const [order, setOrder] = useState<OrderRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  const reload = useCallback(() => setNonce((n) => n + 1), [])

  useEffect(() => {
    if (!id) return
    const controller = new AbortController()
    let alive = true
    let timer: number | undefined
    // The effect's own copy, so a failed poll can tell "never loaded" from
    // "loaded once and the network hiccuped" without re-running the effect.
    let current: OrderRecord | null = null

    setLoading(true)
    setNotFound(false)

    const schedule = () => {
      if (!alive || current?.status === DELIVERED) return
      timer = window.setTimeout(load, POLL_MS)
    }

    const load = () => {
      getOrder(id, controller.signal)
        .then((row) => {
          if (!alive) return
          current = row
          setOrder(row)
          setError(null)
          setNotFound(false)
          setLoading(false)
          schedule()
        })
        .catch((err: unknown) => {
          if (!alive || controller.signal.aborted) return
          setLoading(false)
          if (err instanceof ApiError && err.status === 404) {
            setOrder(null)
            setNotFound(true)
            return
          }
          // A 401 has already sent the browser to the sign-in screen.
          if (err instanceof ApiError && err.status === 401) return
          if (current) {
            // Keep what is on screen and try the next poll anyway.
            schedule()
            return
          }
          setError(errorMessage(err, 'That order could not be loaded.'))
        })
    }

    load()
    return () => {
      alive = false
      controller.abort()
      if (timer) window.clearTimeout(timer)
    }
  }, [id, nonce])

  if (loading) {
    return (
      <main className="page page--narrow">
        <Link className="link-back" to="/orders">← All orders</Link>
        <p className="muted-strong order-status">Loading order…</p>
      </main>
    )
  }

  if (notFound || !order) {
    return (
      <main className="page page--narrow">
        <Link className="link-back" to="/orders">← All orders</Link>
        <p className="pill pill--magenta">{notFound ? 'Not found' : 'No luck'}</p>
        <h1 className="display">{notFound ? 'No such order' : 'Something went wrong'}</h1>
        <p className="lede">
          {notFound
            ? `Order #${id} does not exist, or it belongs to somebody else.`
            : error}
        </p>
        <div className="actions-row">
          <Link className="btn btn-lime" to="/orders">All orders</Link>
          {notFound
            ? <Link className="btn btn-ghost" to="/">Back to the menu</Link>
            : <button type="button" className="btn btn-ghost" onClick={reload}>Try again</button>}
        </div>
      </main>
    )
  }

  const done = order.status === DELIVERED
  // ?placed=1 is the celebration state; an order still on its way gets the
  // tracker whenever it is opened.
  const tracking = placed || !done
  const when = relativeDate(order.created_at)

  return (
    <main className="page page--narrow">
      <Link className="link-back" to="/orders">← All orders</Link>

      {tracking && (
        <>
          <div className="confirm-grid">
            <div>
              <p className="pill">Order #{order.id} · {order.user}</p>
              <h1 className="display confirm-title">
                {done
                  ? <>Delivered.<br /><span className="accent-lime">You win.</span></>
                  : <>Hooray.<br /><span className="accent-magenta">It's in the oven.</span></>}
              </h1>
              <p className="confirm-eta">
                {done
                  ? <>Delivered · {money(order.total)}</>
                  : <>Arriving in <strong>{etaFor(order.status)}</strong> · {money(order.total)}</>}
              </p>
            </div>
            <div className="confirm-art">
              <div className="confirm-glow" />
              <div className="confirm-pizzas">
                {order.items.map((item, i) => (
                  <PizzaArt key={i} className="confirm-pizza" cuts slices={slugsFor(item.slices)} />
                ))}
              </div>
            </div>
          </div>

          <Tracker status={order.status} />

          <div className="actions-row">
            <Link className="btn btn-lime" to="/orders">All orders</Link>
            <Link className="btn btn-ghost" to="/">Back to the menu</Link>
          </div>
        </>
      )}

      <div className={`order-head${tracking ? ' order-head--after' : ''}`}>
        <div>
          <p className="mono-label">{order.user}{when ? ` · ${when}` : ''}</p>
          {tracking
            ? <h2 className="section-title">Order #{order.id}</h2>
            : <h1 className="display">Order #{order.id}</h1>}
        </div>
        <span className="status-pill">{order.status_label}</span>
      </div>

      <div className="item-list">
        {order.items.map((item, i) => (
          <div className="row" key={i}>
            <PizzaArt className="item-art" cuts slices={slugsFor(item.slices)} />
            <div className="grow">
              <div className="item-name">{item.name}</div>
              <div className="item-detail">{detailFor(item)}</div>
            </div>
            <div className="item-price">{money(item.line_total)}</div>
          </div>
        ))}
      </div>

      <div className="total-row">
        <span className="total-label">Total incl. delivery</span>
        <span className="total-figure">{money(order.total)}</span>
      </div>
    </main>
  )
}

export default Order
