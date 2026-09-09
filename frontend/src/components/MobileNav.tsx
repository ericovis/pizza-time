import { NavLink } from 'react-router'

/** Same three destinations as the header nav; CSS shows this one under 760px. */
const LINKS = [
  { to: '/', label: 'Menu', end: true },
  { to: '/orders', label: 'Orders', end: false },
  { to: '/about', label: 'About', end: false },
]

export function MobileNav() {
  return (
    <nav className="mobile-nav" aria-label="Primary">
      {LINKS.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end={link.end}
          className={({ isActive }) => `mobile-nav-item${isActive ? ' is-active' : ''}`}
        >
          {link.label}
        </NavLink>
      ))}
    </nav>
  )
}

export default MobileNav
