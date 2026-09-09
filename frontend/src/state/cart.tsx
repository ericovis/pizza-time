/* The cart: the reducer from the design prototype, typed, capped at the 20 item
   rows the API accepts, and persisted in sessionStorage so the sign-in detour
   does not lose the order.

   The reducer is exported on its own and is pure, so it is unit-tested without
   React (src/state/cart.test.ts). */

import {
  createContext, useCallback, useContext, useEffect, useMemo, useReducer, type ReactNode,
} from 'react'
import type { Pizza } from '../api/pizzas'
import type { NewOrderPayload } from '../api/orders'
import { MAX_ORDER_ITEMS, MAX_QUANTITY } from '../lib/config'
import { SLICE_COUNT } from '../lib/geometry'
import { DELIVERY_FEE, breakdown, itemName, priceForSlices, toNumber } from '../lib/pricing'
import { useCatalog, type CatalogValue } from './catalog'

export interface CartItem {
  /** Stable identity: "p7" for a menu pizza, "c11-11-4-4-7-7-2-2" for a custom. */
  key: string
  kind: 'menu' | 'custom'
  name: string
  /** The toppings line for a menu pizza, the flavor breakdown for a custom. */
  detail: string
  unitPrice: number
  quantity: number
  /** Exactly eight pizza ids — what POST /api/orders/new/ wants. */
  slices: number[]
}

export interface CartState {
  items: CartItem[]
}

export type CartAction =
  | { type: 'add'; item: Omit<CartItem, 'quantity'>; quantity?: number }
  | { type: 'inc'; key: string }
  | { type: 'dec'; key: string }
  | { type: 'remove'; key: string }
  | { type: 'clear' }
  | { type: 'replace'; items: CartItem[] }

export const emptyCart: CartState = { items: [] }

export function menuKey(pizzaId: number): string {
  return `p${pizzaId}`
}

export function customKey(slices: number[]): string {
  return `c${slices.join('-')}`
}

export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'add': {
      const quantity = Math.max(1, action.quantity ?? 1)
      const existing = state.items.find((it) => it.key === action.item.key)
      if (existing) {
        return {
          items: state.items.map((it) =>
            it.key === action.item.key
              ? { ...it, quantity: Math.min(MAX_QUANTITY, it.quantity + quantity) }
              : it),
        }
      }
      // The API refuses an order with more than MAX_ORDER_ITEMS rows.
      if (state.items.length >= MAX_ORDER_ITEMS) return state
      return { items: [...state.items, { ...action.item, quantity: Math.min(MAX_QUANTITY, quantity) }] }
    }
    case 'inc':
      return {
        items: state.items.map((it) =>
          it.key === action.key ? { ...it, quantity: Math.min(MAX_QUANTITY, it.quantity + 1) } : it),
      }
    case 'dec':
      return {
        items: state.items
          .map((it) => (it.key === action.key ? { ...it, quantity: it.quantity - 1 } : it))
          .filter((it) => it.quantity > 0),
      }
    case 'remove':
      return { items: state.items.filter((it) => it.key !== action.key) }
    case 'clear':
      return emptyCart
    case 'replace':
      return { items: action.items }
    default:
      return state
  }
}

export function cartCount(state: CartState): number {
  return state.items.reduce((n, it) => n + it.quantity, 0)
}

export function cartSubtotal(state: CartState): number {
  return state.items.reduce((n, it) => n + it.unitPrice * it.quantity, 0)
}

/** Delivery is only charged on a non-empty order, as in the design. */
export function cartTotal(state: CartState, fee: number = DELIVERY_FEE): number {
  return state.items.length ? cartSubtotal(state) + fee : 0
}

export function cartPayload(state: CartState): NewOrderPayload {
  return { items: state.items.map((it) => ({ slices: it.slices, quantity: it.quantity })) }
}

/* ------------------------------ persistence ------------------------------ */

const CART_KEY = 'pizzatime.cart'

function isCartItem(value: unknown): value is CartItem {
  if (!value || typeof value !== 'object') return false
  const it = value as Record<string, unknown>
  return typeof it.key === 'string'
    && (it.kind === 'menu' || it.kind === 'custom')
    && typeof it.name === 'string'
    && typeof it.unitPrice === 'number'
    && typeof it.quantity === 'number'
    && Array.isArray(it.slices)
    && it.slices.length === SLICE_COUNT
    && it.slices.every((s) => typeof s === 'number')
}

function loadCart(): CartState {
  if (typeof window === 'undefined') return emptyCart
  try {
    const raw = window.sessionStorage.getItem(CART_KEY)
    if (!raw) return emptyCart
    const parsed = JSON.parse(raw) as { items?: unknown }
    const items = Array.isArray(parsed?.items) ? parsed.items.filter(isCartItem) : []
    return { items: items.slice(0, MAX_ORDER_ITEMS) }
  } catch {
    return emptyCart
  }
}

/* -------------------------------- context -------------------------------- */

export interface CartValue extends CartState {
  /** Sum of the quantities — the number on the cart badge. */
  count: number
  /** Number of rows; the API caps this at MAX_ORDER_ITEMS. */
  rowCount: number
  subtotal: number
  deliveryFee: number
  total: number
  isEmpty: boolean
  /** True when another distinct pizza would exceed the API's 20-row cap. */
  isFull: boolean
  addMenu: (pizza: Pizza, quantity?: number) => void
  /** Eight pizza ids. Name, detail and price are derived from the catalog. */
  addCustom: (slices: number[], overrides?: Partial<Pick<CartItem, 'name' | 'detail' | 'unitPrice'>>) => void
  inc: (key: string) => void
  dec: (key: string) => void
  remove: (key: string) => void
  clear: () => void
  /** Body for POST /api/orders/new/. */
  toPayload: () => NewOrderPayload
}

const CartContext = createContext<CartValue | null>(null)

function buildCustom(slices: number[], catalog: CatalogValue): Omit<CartItem, 'quantity'> {
  const lookup = (id: number) => catalog.byId(id)
  return {
    key: customKey(slices),
    kind: 'custom',
    name: itemName(slices, lookup),
    detail: breakdown(slices, lookup),
    unitPrice: priceForSlices(slices, lookup),
    slices: [...slices],
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const catalog = useCatalog()
  const [state, dispatch] = useReducer(cartReducer, undefined, loadCart)

  useEffect(() => {
    try {
      window.sessionStorage.setItem(CART_KEY, JSON.stringify(state))
    } catch { /* private mode: the cart just does not survive a reload */ }
  }, [state])

  const addMenu = useCallback((pizza: Pizza, quantity = 1) => {
    dispatch({
      type: 'add',
      quantity,
      item: {
        key: menuKey(pizza.id),
        kind: 'menu',
        name: pizza.name,
        detail: pizza.toppings,
        unitPrice: toNumber(pizza.price),
        slices: Array<number>(SLICE_COUNT).fill(pizza.id),
      },
    })
  }, [])

  const addCustom = useCallback((slices: number[], overrides?: Partial<CartItem>) => {
    dispatch({ type: 'add', item: { ...buildCustom(slices, catalog), ...overrides } })
  }, [catalog])

  const inc = useCallback((key: string) => dispatch({ type: 'inc', key }), [])
  const dec = useCallback((key: string) => dispatch({ type: 'dec', key }), [])
  const remove = useCallback((key: string) => dispatch({ type: 'remove', key }), [])
  const clear = useCallback(() => dispatch({ type: 'clear' }), [])

  const value = useMemo<CartValue>(() => ({
    items: state.items,
    count: cartCount(state),
    rowCount: state.items.length,
    subtotal: cartSubtotal(state),
    deliveryFee: DELIVERY_FEE,
    total: cartTotal(state),
    isEmpty: state.items.length === 0,
    isFull: state.items.length >= MAX_ORDER_ITEMS,
    addMenu,
    addCustom,
    inc,
    dec,
    remove,
    clear,
    toPayload: () => cartPayload(state),
  }), [state, addMenu, addCustom, inc, dec, remove, clear])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart(): CartValue {
  const value = useContext(CartContext)
  if (!value) throw new Error('useCart must be used inside <CartProvider>')
  return value
}
