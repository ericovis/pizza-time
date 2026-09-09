import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'

import Builder from './Builder'
import { CatalogProvider } from '../state/catalog'
import { CartProvider, useCart } from '../state/cart'
import { ToastProvider } from '../state/toast'

const ROWS = [
  { id: 5, slug: 'funghi', name: 'Funghi', price: '11.23', toppings: 'roasted mushrooms · thyme', description: '', url: '' },
  { id: 7, slug: 'broccoli', name: 'Broccoli', price: '11.00', toppings: 'charred broccoli · garlic', description: '', url: '' },
  { id: 11, slug: 'pepperoni', name: 'Pepperoni', price: '12.23', toppings: 'crisp pepperoni cups · oregano', description: '', url: '' },
]

function Probe() {
  const { items } = useCart()
  return (
    <ul data-testid="cart">
      {items.map((it) => (
        <li key={it.key}>{it.key}|{it.kind}|{it.name}|{it.quantity}</li>
      ))}
    </ul>
  )
}

function renderBuilder() {
  return render(
    <MemoryRouter>
      <CatalogProvider>
        <CartProvider>
          <ToastProvider>
            <Builder />
            <Probe />
          </ToastProvider>
        </CartProvider>
      </CatalogProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  window.sessionStorage.clear()
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(ROWS), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('<Builder>', () => {
  it('keeps the Add button disabled until all eight slices are painted', async () => {
    renderBuilder()
    // The palette, presets and default brush appear once the catalog lands.
    await screen.findByRole('button', { name: 'Whole Funghi' })
    const button = screen.getByRole('button', { name: '8 slices to go' })
    expect((button as HTMLButtonElement).disabled).toBe(true)

    // Paint seven slices with the default brush (Funghi).
    for (let i = 1; i <= 7; i++) {
      fireEvent.click(screen.getByRole('button', { name: `Slice ${i}: empty` }))
    }
    const oneLeft = await screen.findByRole('button', { name: '1 slice to go' })
    expect((oneLeft as HTMLButtonElement).disabled).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Slice 8: empty' }))
    const ready = await screen.findByRole('button', { name: 'Add to order · $11.23' })
    expect((ready as HTMLButtonElement).disabled).toBe(false)
  })

  it('adds a single-flavor pie as the menu pizza so it merges with a menu row', async () => {
    renderBuilder()
    fireEvent.click(await screen.findByRole('button', { name: 'Whole Funghi' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Add to order · $11.23' }))
    await waitFor(() => expect(screen.getByTestId('cart').textContent).toBe('p5|menu|Funghi|1'))

    // Adding the same whole pie again bumps the quantity instead of adding a row.
    fireEvent.click(screen.getByRole('button', { name: 'Add to order · $11.23' }))
    await waitFor(() => expect(screen.getByTestId('cart').textContent).toBe('p5|menu|Funghi|2'))
  })

  it('adds a mixed pie as a custom item priced at the top flavor', async () => {
    renderBuilder()
    fireEvent.click(await screen.findByRole('button', { name: 'Half & half' }))
    const add = await screen.findByRole('button', { name: /Add to order · \$/ })
    fireEvent.click(add)
    await waitFor(() => {
      const text = screen.getByTestId('cart').textContent ?? ''
      expect(text.startsWith('c')).toBe(true)
      expect(text).toContain('|custom|Your 2-flavor pizza|1')
    })
  })
})
