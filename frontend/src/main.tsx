import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Navigate, Outlet, Route, Routes, useLocation, useParams } from 'react-router'

import './styles/tokens.css'
import './styles/neon.css'

import Header from './components/Header'
import MobileNav from './components/MobileNav'
import Toast from './components/Toast'
import RequireAuth from './components/RequireAuth'
import { REPO_URL } from './lib/config'

import { AuthProvider } from './state/auth'
import { CatalogProvider } from './state/catalog'
import { CartProvider } from './state/cart'
import { ToastProvider } from './state/toast'

import Menu from './pages/Menu'
import Builder from './pages/Builder'
import Cart from './pages/Cart'
import SignIn from './pages/SignIn'
import Orders from './pages/Orders'
import Order from './pages/Order'
import About from './pages/About'

/** Every page starts at the top, as the prototype's go() did. */
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo({ top: 0 }) }, [pathname])
  return null
}

function Layout() {
  return (
    <div className="app">
      <ScrollToTop />
      <Header />
      <Outlet />
      <footer className="site-footer">
        <span>Pizza Time · wood-fired since the classroom days</span>
        <span>
          8 slices · up to 8 flavors · $5 delivery ·{' '}
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer">GitHub</a>
        </span>
      </footer>
      <Toast />
      <MobileNav />
    </div>
  )
}

/** The old AngularJS route #/orders/:id/:new used a path segment as a flag. */
function LegacyOrderRedirect() {
  const { id } = useParams()
  return <Navigate to={`/orders/${id ?? ''}?placed=1`} replace />
}

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Menu />} />
        <Route path="/build" element={<Builder />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/signin" element={<SignIn />} />
        <Route path="/orders" element={<RequireAuth><Orders /></RequireAuth>} />
        <Route path="/orders/:id" element={<RequireAuth><Order /></RequireAuth>} />
        <Route path="/orders/:id/:new" element={<LegacyOrderRedirect />} />
        <Route path="/about" element={<About />} />
        <Route path="/new-order" element={<Navigate to="/build" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

const container = document.getElementById('root')
if (!container) throw new Error('#root is missing from index.html')

createRoot(container).render(
  <StrictMode>
    <HashRouter>
      <AuthProvider>
        <CatalogProvider>
          <CartProvider>
            <ToastProvider>
              <App />
            </ToastProvider>
          </CartProvider>
        </CatalogProvider>
      </AuthProvider>
    </HashRouter>
  </StrictMode>,
)
