import { describe, expect, it } from 'vitest'
import {
  cartCount, cartPayload, cartReducer, cartSubtotal, cartTotal, customKey, emptyCart, menuKey,
  type CartItem, type CartState,
} from './cart'
import { MAX_ORDER_ITEMS, MAX_QUANTITY } from '../lib/config'

const cheese: Omit<CartItem, 'quantity'> = {
  key: menuKey(1),
  kind: 'menu',
  name: 'Cheese',
  detail: 'three cheeses · oregano',
  unitPrice: 11.23,
  slices: [1, 1, 1, 1, 1, 1, 1, 1],
}

const custom: Omit<CartItem, 'quantity'> = {
  key: customKey([11, 11, 4, 4, 7, 7, 2, 2]),
  kind: 'custom',
  name: 'Your 4-flavor pizza',
  detail: 'Pepperoni ×2 · Prosciutto ×2 · Broccoli ×2 · Mexican ×2',
  unitPrice: 13.23,
  slices: [11, 11, 4, 4, 7, 7, 2, 2],
}

const add = (state: CartState, item: Omit<CartItem, 'quantity'>, quantity?: number) =>
  cartReducer(state, { type: 'add', item, quantity })

describe('cartReducer', () => {
  it('adds a new row with quantity 1', () => {
    const state = add(emptyCart, cheese)
    expect(state.items).toHaveLength(1)
    expect(state.items[0]).toMatchObject({ key: 'p1', name: 'Cheese', quantity: 1 })
  })

  it('bumps the quantity instead of adding a second row for the same key', () => {
    const state = add(add(emptyCart, cheese), cheese)
    expect(state.items).toHaveLength(1)
    expect(state.items[0].quantity).toBe(2)
  })

  it('keeps a custom pizza separate from a menu pizza', () => {
    const state = add(add(emptyCart, cheese), custom)
    expect(state.items.map((it) => it.key)).toEqual(['p1', 'c11-11-4-4-7-7-2-2'])
  })

  it('gives two differently painted customs their own rows', () => {
    const other = { ...custom, key: customKey([1, 1, 1, 1, 2, 2, 2, 2]), slices: [1, 1, 1, 1, 2, 2, 2, 2] }
    const state = add(add(emptyCart, custom), other)
    expect(state.items).toHaveLength(2)
  })

  it('never lets a quantity exceed what the API accepts', () => {
    let state = add(emptyCart, cheese, MAX_QUANTITY)
    state = cartReducer(state, { type: 'inc', key: 'p1' })
    expect(state.items[0].quantity).toBe(MAX_QUANTITY)
  })

  it('increments and decrements one row', () => {
    let state = add(emptyCart, cheese)
    state = cartReducer(state, { type: 'inc', key: 'p1' })
    expect(state.items[0].quantity).toBe(2)
    state = cartReducer(state, { type: 'dec', key: 'p1' })
    expect(state.items[0].quantity).toBe(1)
  })

  it('drops the row when the quantity reaches zero', () => {
    const state = cartReducer(add(emptyCart, cheese), { type: 'dec', key: 'p1' })
    expect(state.items).toEqual([])
  })

  it('removes and clears', () => {
    const two = add(add(emptyCart, cheese), custom)
    expect(cartReducer(two, { type: 'remove', key: 'p1' }).items).toHaveLength(1)
    expect(cartReducer(two, { type: 'clear' }).items).toEqual([])
  })

  it('ignores an unknown key', () => {
    const state = add(emptyCart, cheese)
    expect(cartReducer(state, { type: 'inc', key: 'nope' })).toEqual(state)
  })

  it('refuses a 21st row, because the API caps an order at 20 items', () => {
    let state = emptyCart
    for (let i = 1; i <= MAX_ORDER_ITEMS; i++) {
      state = add(state, { ...cheese, key: `p${i}`, slices: [i, i, i, i, i, i, i, i] })
    }
    expect(state.items).toHaveLength(MAX_ORDER_ITEMS)
    const overflowed = add(state, { ...cheese, key: 'p999', slices: [9, 9, 9, 9, 9, 9, 9, 9] })
    expect(overflowed.items).toHaveLength(MAX_ORDER_ITEMS)
    expect(overflowed).toBe(state)
  })

  it('still bumps an existing row when the cart is full', () => {
    let state = emptyCart
    for (let i = 1; i <= MAX_ORDER_ITEMS; i++) {
      state = add(state, { ...cheese, key: `p${i}`, slices: [i, i, i, i, i, i, i, i] })
    }
    const bumped = add(state, { ...cheese, key: 'p1' })
    expect(bumped.items[0].quantity).toBe(2)
  })

  it('does not mutate the state it is given', () => {
    const state = add(emptyCart, cheese)
    const snapshot = JSON.parse(JSON.stringify(state))
    cartReducer(state, { type: 'inc', key: 'p1' })
    expect(state).toEqual(snapshot)
  })
})

describe('cart selectors', () => {
  const state = cartReducer(add(add(emptyCart, cheese), custom), { type: 'inc', key: 'p1' })

  it('counts quantities, not rows', () => {
    expect(state.items).toHaveLength(2)
    expect(cartCount(state)).toBe(3)
  })

  it('sums unit price times quantity', () => {
    expect(cartSubtotal(state)).toBeCloseTo(11.23 * 2 + 13.23, 10)
  })

  it('adds the delivery fee only when there is something to deliver', () => {
    expect(cartTotal(state)).toBeCloseTo(11.23 * 2 + 13.23 + 5, 10)
    expect(cartTotal(emptyCart)).toBe(0)
  })

  it('builds the order payload as ids in slices plus a quantity', () => {
    expect(cartPayload(state)).toEqual({
      items: [
        { slices: [1, 1, 1, 1, 1, 1, 1, 1], quantity: 2 },
        { slices: [11, 11, 4, 4, 7, 7, 2, 2], quantity: 1 },
      ],
    })
  })
})
