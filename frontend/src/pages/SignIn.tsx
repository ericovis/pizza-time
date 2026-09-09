/* SIGN IN (plan 3.9). Ported from the "isSignin" block of the Neon Slice
   artboard, with the real API behind it.

   Query parameters:
     ?place=1     came from the cart: sign in, post the order, land on the
                  tracker. The button then reads "Sign in & place order · $x".
     ?next=/path  where to go after a plain sign-in.
     ?expired=1   api/client.ts bounced us here after a failed refresh. */

import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router'

import { createOrder } from '../api/orders'
import { errorMessage } from '../api/client'
import { DEMO_LOGIN } from '../lib/config'
import { money } from '../lib/pricing'
import { useAuth } from '../state/auth'
import { useCart } from '../state/cart'
import { useToast } from '../state/toast'

import '../styles/pages/signin.css'

/** Only ever navigate inside the app: "//evil.example" is not a next target. */
function safeNext(value: string | null): string {
  if (!value) return '/'
  if (!value.startsWith('/') || value.startsWith('//')) return '/'
  return value
}

export function SignIn() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { signIn } = useAuth()
  const { isEmpty, total, clear, toPayload } = useCart()
  const { show } = useToast()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  const expired = params.get('expired') === '1'
  const placing = params.get('place') === '1' && !isEmpty
  const next = safeNext(params.get('next'))

  const label = placing ? `Sign in & place order · ${money(total)}` : 'Sign in'
  const pendingLabel = placing ? 'Placing the order…' : 'Signing in…'

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return

    const user = username.trim()
    if (!user || !password) {
      setError('Enter your username and password.')
      return
    }

    setPending(true)
    setError('')
    try {
      await signIn(user, password)
    } catch (err) {
      // "No active account found with the given credentials" or
      // "Staff accounts sign in at /admin/." — shown verbatim.
      setError(errorMessage(err, 'Sign in failed.'))
      setPending(false)
      return
    }

    if (placing) {
      try {
        const order = await createOrder(toPayload())
        clear()
        navigate(`/orders/${order.id}?placed=1`, { replace: true })
      } catch (err) {
        // Signed in, but the order did not go through: back to the cart with
        // the message, where "Place the order" can be pressed again.
        show(errorMessage(err, 'The order could not be placed.'))
        navigate('/cart', { replace: true })
      }
      return
    }

    navigate(next, { replace: true })
  }

  return (
    <main className="page page--form">
      <form className="form-card" onSubmit={onSubmit}>
        <p className="mono-label signin-kicker">Continue? 9… 8… 7…</p>
        <h1 className="display signin-title">Who's <span>hungry?</span></h1>

        {expired && <p className="signin-notice">Your session expired, sign in again.</p>}

        <label className="field">
          Username
          <input
            name="username"
            value={username}
            onChange={(e) => { setUsername(e.target.value); setError('') }}
            autoComplete="username"
            placeholder="pizza"
            autoCapitalize="none"
            spellCheck={false}
          />
        </label>
        <label className="field">
          Password
          <input
            type="password"
            name="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError('') }}
            autoComplete="current-password"
            placeholder="••••••••"
          />
        </label>

        {error && <p className="field-error" role="alert">{error}</p>}

        <button type="submit" className="btn btn-lime signin-submit" disabled={pending}>
          {pending ? pendingLabel : label}
        </button>

        <p className="field-note">Demo login: {DEMO_LOGIN.username} / {DEMO_LOGIN.password}</p>
      </form>
    </main>
  )
}

export default SignIn
