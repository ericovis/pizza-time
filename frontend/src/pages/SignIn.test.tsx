import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'

import SignIn from './SignIn'
import { AuthProvider } from '../state/auth'
import { CartProvider } from '../state/cart'
import { CatalogProvider } from '../state/catalog'
import { ToastProvider } from '../state/toast'
import type { CartItem } from '../state/cart'

const CHEESE = {
  id: 1,
  slug: 'cheese',
  name: 'Cheese',
  price: '11.23',
  toppings: 'three cheeses · oregano',
  description: 'Three cheeses, one very good decision.',
  url: 'http://localhost:8000/api/pizzas/get/1/',
}

const cheeseRow: CartItem = {
  key: 'p1',
  kind: 'menu',
  name: 'Cheese',
  detail: 'three cheeses · oregano',
  unitPrice: 11.23,
  quantity: 1,
  slices: [1, 1, 1, 1, 1, 1, 1, 1],
}

function seedCart(items: CartItem[]) {
  window.sessionStorage.setItem('pizzatime.cart', JSON.stringify({ items }))
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

/** Catalog always answers; /auth/ and /orders/new/ answer as told. */
function stubFetch(options: { auth?: () => Response; order?: () => Response } = {}) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
    const url = String(input)
    if (url.includes('/pizzas/get/')) return json([CHEESE])
    if (url.includes('/auth/')) {
      return options.auth ? options.auth() : json({ access: 'a', refresh: 'r', username: 'pizza', is_staff: false })
    }
    if (url.includes('/orders/new/')) {
      return options.order ? options.order() : json({ id: 7, user: 'pizza', items: [], total: '16.23' }, 201)
    }
    return json({ detail: 'not stubbed' }, 404)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function Location() {
  const { pathname, search } = useLocation()
  return <div data-testid="loc">{pathname + search}</div>
}

function renderSignIn(entry: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <AuthProvider>
        <CatalogProvider>
          <CartProvider>
            <ToastProvider>
              <Location />
              <Routes>
                <Route path="/signin" element={<SignIn />} />
                <Route path="/" element={<p>menu screen</p>} />
                <Route path="/cart" element={<p>cart screen</p>} />
                <Route path="/orders/:id" element={<p>tracker screen</p>} />
              </Routes>
            </ToastProvider>
          </CartProvider>
        </CatalogProvider>
      </AuthProvider>
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
  window.sessionStorage.clear()
  vi.unstubAllGlobals()
})

describe('<SignIn>', () => {
  it('reads "Sign in" on its own and carries the total when placing', () => {
    stubFetch()
    renderSignIn('/signin')
    expect(screen.getByText('Sign in')).toBeTruthy()
    cleanup()

    seedCart([cheeseRow])
    renderSignIn('/signin?next=/cart&place=1')
    expect(screen.getByText('Sign in & place order · $16.23')).toBeTruthy()
    expect(screen.getByText('Demo login: pizza / pizza')).toBeTruthy()
  })

  it('explains an expired session', () => {
    stubFetch()
    renderSignIn('/signin?expired=1&next=/orders')
    expect(screen.getByText('Your session expired, sign in again.')).toBeTruthy()
  })

  it('asks for both fields before calling the API', () => {
    const fetchMock = stubFetch()
    renderSignIn('/signin')
    fireEvent.click(screen.getByText('Sign in'))
    expect(screen.getByText('Enter your username and password.')).toBeTruthy()
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('/auth/'))).toBe(false)
  })

  it('shows the API error verbatim, staff refusal included', async () => {
    stubFetch({ auth: () => json({ detail: 'Staff accounts sign in at /admin/.' }, 401) })
    renderSignIn('/signin')
    fireEvent.change(screen.getByPlaceholderText('pizza'), { target: { value: 'admin' } })
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'pizza-admin' } })
    fireEvent.click(screen.getByText('Sign in'))
    await waitFor(() => {
      expect(screen.getByText('Staff accounts sign in at /admin/.')).toBeTruthy()
    })
  })

  it('places the order and lands on the tracker', async () => {
    seedCart([cheeseRow])
    const fetchMock = stubFetch()
    renderSignIn('/signin?next=/cart&place=1')
    fireEvent.change(screen.getByPlaceholderText('pizza'), { target: { value: 'pizza' } })
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'pizza' } })
    fireEvent.click(screen.getByText('Sign in & place order · $16.23'))

    await waitFor(() => {
      expect(screen.getByTestId('loc').textContent).toBe('/orders/7?placed=1')
    })
    const posted = fetchMock.mock.calls.find(([u]) => String(u).includes('/orders/new/'))
    expect(posted).toBeTruthy()
    expect(JSON.parse(String(posted?.[1]?.body))).toEqual({
      items: [{ slices: [1, 1, 1, 1, 1, 1, 1, 1], quantity: 1 }],
    })
    expect(window.sessionStorage.getItem('pizzatime.cart')).toBe('{"items":[]}')
  })

  it('follows next when there is nothing to place', async () => {
    stubFetch()
    renderSignIn('/signin?next=/cart')
    fireEvent.change(screen.getByPlaceholderText('pizza'), { target: { value: 'pizza' } })
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'pizza' } })
    fireEvent.click(screen.getByText('Sign in'))
    await waitFor(() => {
      expect(screen.getByTestId('loc').textContent).toBe('/cart')
    })
  })
})
