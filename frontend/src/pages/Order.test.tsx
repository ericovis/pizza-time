import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'

import OrderPage from './Order'
import { clearSession, saveSession } from '../api/client'
import { AuthProvider } from '../state/auth'
import { CatalogProvider } from '../state/catalog'
import type { Order } from '../api/orders'

const CHEESE = {
  id: 1,
  slug: 'cheese',
  name: 'Cheese',
  price: '11.23',
  toppings: 'three cheeses · oregano',
  description: 'Three cheeses, one very good decision.',
  url: 'http://localhost:8000/api/pizzas/get/1/',
}

const order: Order = {
  id: 4,
  user: 'jklimber',
  status: 'Out for delivery',
  status_label: 'Out for delivery',
  created_at: '2026-09-09T14:33:23Z',
  items: [
    { name: 'Your 2-flavor pizza', slices: [11, 11, 11, 11, 1, 1, 1, 1], flavors: ['Pepperoni', 'Cheese'], quantity: 1, unit_price: '12.23', line_total: '12.23', is_custom: true },
  ],
  delivery_fee: '5.00',
  total: '17.23',
  url: 'http://localhost:8000/api/orders/get/4/',
}

/** The order the API hands back can change between polls. */
let served: Order | number = order
const calls = { orders: 0 }

function stubFetch() {
  calls.orders = 0
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (!url.includes('/orders/get/')) {
      return new Response(JSON.stringify([CHEESE]), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
    calls.orders += 1
    if (typeof served === 'number') {
      return new Response(JSON.stringify({ detail: 'Not found.' }), { status: served, headers: { 'Content-Type': 'application/json' } })
    }
    return new Response(JSON.stringify(served), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }))
}

function renderOrder(path = '/orders/4') {
  stubFetch()
  saveSession({ access: 'a', refresh: 'r', username: 'jklimber' })
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <CatalogProvider>
          <Routes>
            <Route path="/orders/:id" element={<OrderPage />} />
            <Route path="/orders" element={<p>orders screen</p>} />
          </Routes>
        </CatalogProvider>
      </AuthProvider>
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  clearSession()
  window.sessionStorage.clear()
  vi.unstubAllGlobals()
  served = order
})

describe('<Order>', () => {
  it('shows the tracking header and the tracker while the order is on its way', async () => {
    renderOrder()
    expect(await screen.findByText(/It's in the oven/)).toBeTruthy()
    expect(screen.getByText('Order #4 · jklimber')).toBeTruthy()
    expect(screen.getByText('~10 min')).toBeTruthy()
    expect(screen.getByText('NOW')).toBeTruthy()
    expect(screen.getByText('Your 2-flavor pizza')).toBeTruthy()
    expect(screen.getByText('Pepperoni · Cheese')).toBeTruthy()
    expect(screen.getByText('Total incl. delivery')).toBeTruthy()
    expect(screen.getByText('$17.23')).toBeTruthy()
  })

  it('shows the line total for a repeated pie, with the unit price in the detail line', async () => {
    served = {
      ...order,
      items: [
        { name: 'Cheese', slices: [1, 1, 1, 1, 1, 1, 1, 1], flavors: ['Cheese'], quantity: 2, unit_price: '11.23', line_total: '22.46', is_custom: false },
      ],
      total: '27.46',
    }
    renderOrder()
    expect(await screen.findByText('$22.46')).toBeTruthy()
    expect(screen.getByText('Cheese · ×2 at $11.23')).toBeTruthy()
    expect(screen.queryByText('$11.23')).toBeNull()
  })

  it('is a plain detail screen for a delivered order', async () => {
    served = { ...order, status: 'Delivered', status_label: 'Delivered' }
    renderOrder()
    expect(await screen.findByText('Order #4')).toBeTruthy()
    expect(screen.queryByText(/It's in the oven/)).toBeNull()
    expect(screen.queryByText('NOW')).toBeNull()
  })

  it('celebrates a delivered order that was just placed', async () => {
    served = { ...order, status: 'Delivered', status_label: 'Delivered' }
    renderOrder('/orders/4?placed=1')
    expect(await screen.findByText(/You win/)).toBeTruthy()
  })

  it('polls every five seconds until the order is delivered', async () => {
    vi.useFakeTimers()
    renderOrder('/orders/4?placed=1')
    await act(async () => { await Promise.resolve() })
    expect(calls.orders).toBe(1)
    expect(screen.getByText(/It's in the oven/)).toBeTruthy()

    served = { ...order, status: 'Delivered', status_label: 'Delivered' }
    await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
    expect(calls.orders).toBe(2)
    // the header follows the status without a reload
    expect(screen.getByText(/You win/)).toBeTruthy()

    // Delivered is the end of the line: no further requests.
    await act(async () => { await vi.advanceTimersByTimeAsync(20000) })
    expect(calls.orders).toBe(2)
  })

  it('stops polling once the screen is gone', async () => {
    vi.useFakeTimers()
    const view = renderOrder()
    await act(async () => { await Promise.resolve() })
    expect(calls.orders).toBe(1)
    view.unmount()
    await act(async () => { await vi.advanceTimersByTimeAsync(20000) })
    expect(calls.orders).toBe(1)
  })

  it('shows a not-found state for somebody else’s order', async () => {
    served = 404
    renderOrder('/orders/99')
    expect(await screen.findByText('No such order')).toBeTruthy()
    expect(screen.getByText('All orders')).toBeTruthy()
  })
})
