/* Cart and builder arithmetic. The server is authoritative — it recomputes
   every total and names every item — so everything here is a preview that has
   to agree with delivery/serializers.py:
     unit_price = max(price of the distinct flavors on the pie)
     name       = the pizza's name for one flavor, "Your N-flavor pizza" above one
     total      = sum(unit_price * quantity) + DELIVERY_FEE, fee only if non-empty */

import { SLICE_COUNT } from './geometry'

/** Preview value only; every order response carries the server's delivery_fee. */
export const DELIVERY_FEE = 5

/** Anything with an id and a price string, i.e. a Pizza from the catalog. */
export interface PricedPizza {
  id: number
  name: string
  price: string | number
}

export type PizzaLookup = (id: number) => PricedPizza | undefined

export function toNumber(value: string | number | null | undefined): number {
  if (typeof value === 'number') return value
  const n = Number.parseFloat(String(value ?? ''))
  return Number.isFinite(n) ? n : 0
}

/** "$11.23". Accepts the API's money strings as well as numbers. */
export function money(value: string | number | null | undefined): string {
  return '$' + toNumber(value).toFixed(2)
}

/** Distinct pizza ids in slice order, ignoring empty slices. */
export function distinctFlavors(slices: number[]): number[] {
  const seen: number[] = []
  for (const id of slices) {
    if (!id) continue
    if (!seen.includes(id)) seen.push(id)
  }
  return seen
}

/** Count of each flavor on the pie, keyed by pizza id. */
export function flavorCounts(slices: number[]): Map<number, number> {
  const counts = new Map<number, number>()
  for (const id of slices) {
    if (!id) continue
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  return counts
}

/** A pie is priced at its most expensive flavor. Empty pie costs nothing. */
export function priceForSlices(slices: number[], lookup: PizzaLookup): number {
  let max = 0
  for (const id of distinctFlavors(slices)) {
    const price = toNumber(lookup(id)?.price)
    if (price > max) max = price
  }
  return max
}

/** Same names the server snapshots: "Cheese", "Your 3-flavor pizza". */
export function itemName(slices: number[], lookup: PizzaLookup): string {
  const flavors = distinctFlavors(slices)
  if (flavors.length === 0) return 'Empty pizza'
  if (flavors.length === 1) return lookup(flavors[0])?.name ?? 'Pizza'
  return `Your ${flavors.length}-flavor pizza`
}

/** The builder's "Pepperoni ×4 · Funghi ×4" line. */
export function breakdown(slices: number[], lookup: PizzaLookup): string {
  const counts = flavorCounts(slices)
  return [...counts.entries()]
    .map(([id, n]) => `${lookup(id)?.name ?? `#${id}`} ×${n}`)
    .join(' · ')
}

export function isComplete(slices: number[]): boolean {
  return slices.filter(Boolean).length === SLICE_COUNT
}

export function remainingSlices(slices: number[]): number {
  return SLICE_COUNT - slices.filter(Boolean).length
}

/** Repeat `ids` evenly around the pie: 1 id = whole, 2 = halves, 4 = quarters. */
export function fillWith(ids: number[]): number[] {
  if (!ids.length) return emptySlices()
  const per = Math.max(1, Math.floor(SLICE_COUNT / ids.length))
  const out: number[] = []
  for (const id of ids) {
    for (let k = 0; k < per && out.length < SLICE_COUNT; k++) out.push(id)
  }
  while (out.length < SLICE_COUNT) out.push(ids[ids.length - 1])
  return out.slice(0, SLICE_COUNT)
}

export function emptySlices(): number[] {
  return Array<number>(SLICE_COUNT).fill(0)
}

/** Cart total: the delivery fee only applies to a non-empty order. */
export function orderTotal(subtotal: number, itemCount: number, fee: number = DELIVERY_FEE): number {
  return itemCount > 0 ? subtotal + fee : 0
}
