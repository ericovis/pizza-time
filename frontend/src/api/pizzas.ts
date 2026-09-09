import { request } from './client'

/** GET /api/pizzas/get/ — public, ordered by id, inactive pizzas hidden.
 *  `price` is a string, as every money field in this API is. */
export interface Pizza {
  id: number
  slug: string
  name: string
  price: string
  toppings: string
  description: string
  url: string
}

export function listPizzas(signal?: AbortSignal): Promise<Pizza[]> {
  return request<Pizza[]>('/pizzas/get/', { auth: false, signal })
}
