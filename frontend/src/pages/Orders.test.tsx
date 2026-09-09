import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'

import Orders from './Orders'
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

const delivered: Order = {
  id: 3,
  user: 'jklimber',
  status: 'Delivered',
  status_label: 'Delivered',
  created_at: '2026-09-08T18:41:00Z',
  items: [
    { name: 'Cheese', slices: [1, 1, 1, 1, 1, 1, 1, 1], flavors: ['Cheese'], quantity: 2, unit_price: '11.23', line_total: '22.46', is_custom: false },
  ],
  delivery_fee: '5.00',
  total: '27.46',
  url: 'http://localhost:8000/api/orders/get/3/',
}

const live: Order = { ...delivered, id: 4, status: 'Out for delivery', status_label: 'Out for delivery', total: '18.23' }

function stubFetch(orders: Order[]) {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    const body = url.includes('/orders/get/') ? orders : [CHEESE]
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }))
}

function Location() {
  const { pathname } = useLocation()
  return <div data-testid="loc">{pathname}</div>
}

function renderOrders(orders: Order[]) {
  stubFetch(orders)
  saveSession({ access: 'a', refresh: 'r', username: 'jklimber' })
  return render(
    <MemoryRouter initialEntries={['/orders']}>
      <AuthProvider>
        <CatalogProvider>
          <Location />
          <Routes>
            <Route path="/orders" element={<Orders />} />
            <Route path="/orders/:id" element={<p>order screen</p>} />
          </Routes>
        </CatalogProvider>
      </AuthProvider>
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
  clearSession()
  window.sessionStorage.clear()
  vi.unstubAllGlobals()
})

describe('<Orders>', () => {
  it('lists a row per order with its count, total and status', async () => {
    renderOrders([live, delivered])
    expect(screen.getByText('High scores')).toBeTruthy()
    await screen.findByText('#4')
    expect(screen.getAllByText('jklimber')).toHaveLength(2)
    expect(screen.getAllByText(/2 pizzas ·/)).toHaveLength(2)
    expect(screen.getByText('$18.23')).toBeTruthy()
    expect(screen.getByText('Out for delivery')).toBeTruthy()
    expect(screen.getByText('Delivered')).toBeTruthy()
  })

  it('opens the order the customer clicks', async () => {
    renderOrders([live])
    const row = await screen.findByLabelText(/Order #4/)
    row.click()
    await waitFor(() => expect(screen.getByTestId('loc').textContent).toBe('/orders/4'))
  })

  it('shows the empty state with both ways out', async () => {
    renderOrders([])
    expect(await screen.findByText('No orders yet. The oven is waiting.')).toBeTruthy()
    expect(screen.getByText('Browse the menu')).toBeTruthy()
    expect(screen.getByText('Build your own')).toBeTruthy()
  })
})
