import { Link, NavLink, useNavigate } from 'react-router'
import { useAuth } from '../state/auth'
import { useCart } from '../state/cart'

/** Q9: no "Build your own" here — the builder is reached from the menu hero,
 *  the dashed menu card and the cart's empty state. */
const LINKS = [
  { to: '/', label: 'Menu', end: true },
  { to: '/orders', label: 'Orders', end: false },
  { to: '/about', label: 'About', end: false },
]

export function Header() {
  const { isAuthed, username, signOut } = useAuth()
  const { count } = useCart()
  const navigate = useNavigate()

  return (
    <header className="site-header">
      <div className="header-inner">
        <Link to="/" className="brand">
          Pizza Time
          <span className="brand-dot" aria-hidden="true" />
        </Link>

        <nav className="nav">
          {LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) => `nav-link${isActive ? ' is-active' : ''}`}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="header-actions">
          {isAuthed && (
            <button
              type="button"
              className="signout"
              onClick={() => { signOut(); navigate('/') }}
            >
              {username} · sign out
            </button>
          )}
          <button
            type="button"
            className="cart-button"
            aria-label="Your order"
            onClick={() => navigate('/cart')}
          >
            <span>Order</span>
            <span data-cart-badge="1" className="cart-badge">{count}</span>
          </button>
        </div>
      </div>
    </header>
  )
}

export default Header
