/* CART (plan 3.9). Ported from the "isCart" block of the Neon Slice artboard.

   Placing the order is the one branch the prototype faked: signed in it posts
   /api/orders/new/ and lands on the tracker, signed out it hands the job to
   the sign-in screen through ?next=/cart&place=1. */

import { useCallback, useState } from 'react'
import { Link, useNavigate } from 'react-router'

import PizzaArt from '../components/PizzaArt'
import { createOrder } from '../api/orders'
import { errorMessage } from '../api/client'
import { MAX_QUANTITY } from '../lib/config'
import { money } from '../lib/pricing'
import { useAuth } from '../state/auth'
import { useCart } from '../state/cart'
import { useCatalog } from '../state/catalog'
import { useToast } from '../state/toast'

import '../styles/pages/cart.css'

export function Cart() {
  const { items, isEmpty, subtotal, deliveryFee, total, inc, dec, clear, toPayload } = useCart()
  const { slugsFor } = useCatalog()
  const { isAuthed } = useAuth()
  const { show } = useToast()
  const navigate = useNavigate()

  const [placing, setPlacing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const place = useCallback(async () => {
    if (placing || isEmpty) return
    if (!isAuthed) {
      // The sign-in screen places the order for us and goes to the tracker.
      navigate('/signin?next=/cart&place=1')
      return
    }
    setPlacing(true)
    setError(null)
    try {
      const order = await createOrder(toPayload())
      clear()
      navigate(`/orders/${order.id}?placed=1`, { replace: true })
    } catch (err) {
      const message = errorMessage(err, 'The order could not be placed.')
      setError(message)
      show(message)
      setPlacing(false)
    }
  }, [placing, isEmpty, isAuthed, navigate, toPayload, clear, show])

  return (
    <main className="page page--narrow">
      <p className="pill">Your order</p>
      <h1 className="display cart-title">Almost <span>dinner</span></h1>

      {isEmpty ? (
        <div className="empty-state">
          <p>Nothing here yet. The oven is warm, though.</p>
          <div className="empty-actions">
            <Link className="btn btn-lime btn-sm" to="/">Browse the menu</Link>
            <Link className="btn btn-ghost btn-sm" to="/build">Build your own</Link>
          </div>
        </div>
      ) : (
        <>
          <div className="cart-items">
            {items.map((item) => (
              <div className="row" key={item.key}>
                <PizzaArt slices={slugsFor(item.slices)} cuts className="item-art" />
                <div className="grow">
                  <div className="item-name">{item.name}</div>
                  <div className="item-detail">{item.detail}</div>
                </div>
                <div className="qty">
                  <button
                    type="button"
                    className="qty-btn qty-btn--minus"
                    aria-label={`Fewer ${item.name}`}
                    onClick={() => dec(item.key)}
                  >
                    −
                  </button>
                  <span className="qty-value">{item.quantity}</span>
                  <button
                    type="button"
                    className="qty-btn"
                    aria-label={`More ${item.name}`}
                    onClick={() => inc(item.key)}
                    disabled={item.quantity >= MAX_QUANTITY}
                  >
                    +
                  </button>
                </div>
                <div className="item-price">{money(item.unitPrice * item.quantity)}</div>
              </div>
            ))}
          </div>

          <div className="summary-panel">
            <div className="summary-line"><span>Pizzas</span><span>{money(subtotal)}</span></div>
            <div className="summary-line"><span>Delivery</span><span>{money(deliveryFee)}</span></div>
            <div className="summary-total">
              <span>Total</span>
              <span className="total-figure">{money(total)}</span>
            </div>
            <button
              type="button"
              className="btn btn-magenta cart-place"
              onClick={place}
              disabled={placing}
            >
              {placing ? 'Placing the order…' : 'Place the order'}
            </button>
            {error && <p className="field-error cart-error" role="alert">{error}</p>}
            {!isAuthed && <p className="cart-note">You'll sign in on the next step.</p>}
          </div>
        </>
      )}
    </main>
  )
}

export default Cart
