import { request } from './client'
import type { Stage } from '../lib/config'

/** One line of an order as the API reads it back. `slices` holds eight pizza
 *  IDS; resolve them to slugs with useCatalog().slugsFor() before drawing. */
export interface OrderItem {
  name: string
  slices: number[]
  /** Distinct flavor names, in slice order. */
  flavors: string[]
  quantity: number
  unit_price: string
  line_total: string
  is_custom: boolean
}

/** The read shape, returned by the list, the detail AND the create call. */
export interface Order {
  id: number
  user: string
  /** Drive logic off this. Same text as status_label today. */
  status: Stage | string
  /** Display this. */
  status_label: string
  created_at: string
  items: OrderItem[]
  delivery_fee: string
  total: string
  url: string
}

/** POST /api/orders/new/ takes items only; anything else is silently ignored. */
export interface NewOrderItem {
  /** Exactly eight pizza ids. */
  slices: number[]
  /** 1 to 9. Defaults to 1 server-side. */
  quantity?: number
}

export interface NewOrderPayload {
  items: NewOrderItem[]
}

/** Newest first, already filtered to the signed-in customer. */
export function listOrders(signal?: AbortSignal): Promise<Order[]> {
  return request<Order[]>('/orders/get/', { requireAuth: true, signal })
}

/** Someone else's order is a 404 (ApiError.status === 404), never a 403. */
export function getOrder(id: number | string, signal?: AbortSignal): Promise<Order> {
  return request<Order>(`/orders/get/${id}/`, { requireAuth: true, signal })
}

/** Returns the created order in the read shape, so go straight to the tracker. */
export function createOrder(payload: NewOrderPayload): Promise<Order> {
  return request<Order>('/orders/new/', { method: 'POST', body: payload, requireAuth: true })
}
