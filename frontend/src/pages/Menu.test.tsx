import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'

import Menu from './Menu'
import { CatalogProvider } from '../state/catalog'
import { CartProvider, useCart } from '../state/cart'
import { ToastProvider, useToast } from '../state/toast'

const ROWS = [
  { id: 1, slug: 'cheese', name: 'Cheese', price: '11.23', toppings: 'three cheeses · oregano', description: '', url: '' },
  { id: 2, slug: 'mexican', name: 'Mexican', price: '13.23', toppings: 'jalapeño · corn', description: '', url: '' },
  { id: 3, slug: 'marinara', name: 'Marinara', price: '11.00', toppings: 'tomato · garlic', description: '', url: '' },
]

function Probe() {
  const { count } = useCart()
  const { message } = useToast()
  return <div data-testid="probe">{count}|{message ?? ''}</div>
}

function renderMenu() {
  return render(
    <MemoryRouter>
      <CatalogProvider>
        <CartProvider>
          <ToastProvider>
            <Menu />
            <Probe />
          </ToastProvider>
        </CartProvider>
      </CatalogProvider>
    </MemoryRouter>,
  )
}

function respondWith(rows: unknown, status = 200) {
  return vi.fn(async () => new Response(JSON.stringify(rows), {
    status,
    headers: { 'Content-Type': 'application/json' },
  }))
}

beforeEach(() => {
  window.sessionStorage.clear()
})

afterEach(() => {
  // vitest runs without globals, so testing-library's auto-cleanup is off.
  cleanup()
  vi.unstubAllGlobals()
})

describe('Menu', () => {
  it('renders the hero and one card per pizza plus the build-your-own card', async () => {
    vi.stubGlobal('fetch', respondWith(ROWS))
    renderMenu()

    expect(screen.getByText('Insert coin · open till late')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Build your pizza' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'See the menu' })).toBeTruthy()

    await waitFor(() => expect(screen.getByText('Cheese')).toBeTruthy())
    expect(screen.getByText('3 pizzas · $5 delivery')).toBeTruthy()
    expect(screen.getByText('P1')).toBeTruthy()
    expect(screen.getByText('P4 · YOU')).toBeTruthy()
    expect(screen.getByText('from $11.00')).toBeTruthy()
    expect(screen.getAllByRole('button', { name: /^Add / })).toHaveLength(3)
  })

  it('adds a pizza to the cart and toasts', async () => {
    vi.stubGlobal('fetch', respondWith(ROWS))
    renderMenu()
    await waitFor(() => expect(screen.getByText('Mexican')).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: 'Add Mexican to your order' }))

    await waitFor(() =>
      expect(screen.getByTestId('probe').textContent).toBe('1|Mexican added to your order'))
  })

  it('shows the error state and can retry', async () => {
    vi.stubGlobal('fetch', respondWith({ detail: 'Service unavailable' }, 503))
    renderMenu()

    await waitFor(() => expect(screen.getByText('The oven is not answering')).toBeTruthy())
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
    // The builder is still reachable while the catalog is down.
    expect(screen.getByText('Build your own')).toBeTruthy()
  })
})
