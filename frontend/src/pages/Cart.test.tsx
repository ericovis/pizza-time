import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'

import Cart from './Cart'
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

function seedCart(items: CartItem[]) {
  window.sessionStorage.setItem('pizzatime.cart', JSON.stringify({ items }))
}

const cheeseRow: CartItem = {
  key: 'p1',
  kind: 'menu',
  name: 'Cheese',
  detail: 'three cheeses · oregano',
  unitPrice: 11.23,
  quantity: 2,
  slices: [1, 1, 1, 1, 1, 1, 1, 1],
}

function stubFetch() {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/pizzas/get/')) {
      return new Response(JSON.stringify([CHEESE]), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
    return new Response('{}', { status: 404, headers: { 'Content-Type': 'application/json' } })
  }))
}

function Location() {
  const { pathname, search } = useLocation()
  return <div data-testid="loc">{pathname + search}</div>
}

function renderCart() {
  stubFetch()
  return render(
    <MemoryRouter initialEntries={['/cart']}>
      <AuthProvider>
        <CatalogProvider>
          <CartProvider>
            <ToastProvider>
              <Location />
              <Routes>
                <Route path="/cart" element={<Cart />} />
                <Route path="/signin" element={<p>sign-in screen</p>} />
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

describe('<Cart>', () => {
  it('shows the empty state with both ways out', () => {
    renderCart()
    expect(screen.getByText('Nothing here yet. The oven is warm, though.')).toBeTruthy()
    expect(screen.getByText('Browse the menu')).toBeTruthy()
    expect(screen.getByText('Build your own')).toBeTruthy()
  })

  it('lists the rows with their line total and the summary', () => {
    seedCart([cheeseRow])
    renderCart()
    expect(screen.getByText('Cheese')).toBeTruthy()
    // once as the line total, once as the "Pizzas" subtotal
    expect(screen.getAllByText('$22.46')).toHaveLength(2) // 11.23 × 2
    expect(screen.getByText('$27.46')).toBeTruthy() // + $5 delivery
    expect(screen.getByText("You'll sign in on the next step.")).toBeTruthy()
  })

  it('steps the quantity and drops the row at zero', () => {
    seedCart([{ ...cheeseRow, quantity: 1 }])
    renderCart()
    fireEvent.click(screen.getByLabelText('More Cheese'))
    expect(screen.getByText('2')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Fewer Cheese'))
    fireEvent.click(screen.getByLabelText('Fewer Cheese'))
    expect(screen.getByText('Nothing here yet. The oven is warm, though.')).toBeTruthy()
  })

  it('sends a signed-out customer to sign in with place=1', async () => {
    seedCart([cheeseRow])
    renderCart()
    fireEvent.click(screen.getByText('Place the order'))
    await waitFor(() => {
      expect(screen.getByTestId('loc').textContent).toBe('/signin?next=/cart&place=1')
    })
  })
})
