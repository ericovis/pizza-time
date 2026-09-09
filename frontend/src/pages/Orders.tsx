import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'

import { errorMessage } from '../api/client'
import { listOrders, type Order } from '../api/orders'
import PizzaArt from '../components/PizzaArt'
import StatusBadge from '../components/StatusBadge'
import { relativeDate } from '../lib/dates'
import { money } from '../lib/pricing'
import { useCatalog } from '../state/catalog'
import '../styles/pages/orders.css'

/** The row stacks its thumbnails with a negative margin, so a twenty-item
 *  order would push the username out of the row. Show the first few. */
const MAX_THUMBS = 4

/** Pizzas, not rows: an item with quantity 3 is three pizzas. */
function pizzaCount(order: Order): number {
  return order.items.reduce((n, item) => n + (item.quantity || 1), 0)
}

function countLabel(n: number): string {
  return `${n} ${n === 1 ? 'pizza' : 'pizzas'}`
}

/** The ORDERS screen: every order this customer has placed, newest first.
 *  The API filters by owner, so there is nothing to filter here. */
export function Orders() {
  const navigate = useNavigate()
  const { slugsFor } = useCatalog()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  const reload = useCallback(() => setNonce((n) => n + 1), [])

  useEffect(() => {
    const controller = new AbortController()
    let alive = true
    setLoading(true)
    listOrders(controller.signal)
      .then((rows) => {
        if (!alive) return
        setOrders(rows)
        setError(null)
      })
      .catch((err: unknown) => {
        if (!alive || controller.signal.aborted) return
        setError(errorMessage(err, 'Your orders could not be loaded.'))
      })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false; controller.abort() }
  }, [nonce])

  return (
    <main className="page page--narrow">
      <p className="pill">High scores</p>
      <h1 className="display orders-heading">Orders</h1>

      {loading && <p className="muted-strong orders-status">Loading your orders…</p>}

      {!loading && error && (
        <div className="empty-state">
          <p>{error}</p>
          <div className="empty-actions">
            <button type="button" className="btn btn-lime" onClick={reload}>Try again</button>
            <Link className="btn btn-ghost" to="/">Back to the menu</Link>
          </div>
        </div>
      )}

      {!loading && !error && orders.length === 0 && (
        <div className="empty-state">
          <p>No orders yet. The oven is waiting.</p>
          <div className="empty-actions">
            <Link className="btn btn-lime" to="/">Browse the menu</Link>
            <Link className="btn btn-ghost" to="/build">Build your own</Link>
          </div>
        </div>
      )}

      {!loading && !error && orders.length > 0 && (
        <div className="order-list">
          {orders.map((order) => {
            const count = pizzaCount(order)
            const when = relativeDate(order.created_at)
            return (
              <button
                key={order.id}
                type="button"
                className="order-row"
                onClick={() => navigate(`/orders/${order.id}`)}
                aria-label={`Order #${order.id}, ${countLabel(count)}, ${money(order.total)}, ${order.status_label}`}
              >
                <span className="order-id">#{order.id}</span>
                <span className="order-thumbs">
                  {order.items.slice(0, MAX_THUMBS).map((item, i) => (
                    <PizzaArt key={i} className="order-thumb" slices={slugsFor(item.slices)} />
                  ))}
                </span>
                <span className="order-main">
                  <span className="order-user">{order.user}</span>
                  <span className="order-meta">
                    {countLabel(count)}{when ? ` · ${when}` : ''}
                  </span>
                </span>
                <span className="order-right">
                  <span className="price-sm">{money(order.total)}</span>
                  <StatusBadge status={order.status} label={order.status_label} />
                </span>
              </button>
            )
          })}
        </div>
      )}
    </main>
  )
}

export default Orders
