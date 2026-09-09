import { describe, expect, it } from 'vitest'
import {
  DELIVERY_FEE, breakdown, distinctFlavors, emptySlices, fillWith, flavorCounts, isComplete,
  itemName, money, orderTotal, priceForSlices, remainingSlices, toNumber, type PricedPizza,
} from './pricing'

const CATALOG: PricedPizza[] = [
  { id: 1, name: 'Cheese', price: '11.23' },
  { id: 2, name: 'Mexican', price: '13.23' },
  { id: 4, name: 'Prosciutto', price: '13.23' },
  { id: 7, name: 'Broccoli', price: '11.00' },
  { id: 11, name: 'Pepperoni', price: '12.23' },
]
const lookup = (id: number) => CATALOG.find((p) => p.id === id)

describe('money', () => {
  it('formats the API money strings and plain numbers alike', () => {
    expect(money('11.23')).toBe('$11.23')
    expect(money(5)).toBe('$5.00')
    expect(money('40.69')).toBe('$40.69')
  })

  it('falls back to zero for junk', () => {
    expect(money(null)).toBe('$0.00')
    expect(money('')).toBe('$0.00')
    expect(toNumber('nope')).toBe(0)
  })
})

describe('priceForSlices', () => {
  it('prices a whole menu pizza at its own price', () => {
    expect(priceForSlices([1, 1, 1, 1, 1, 1, 1, 1], lookup)).toBe(11.23)
  })

  it('prices a mixed pie at its most expensive flavor', () => {
    expect(priceForSlices([11, 11, 4, 4, 7, 7, 2, 2], lookup)).toBe(13.23)
    expect(priceForSlices([11, 11, 11, 11, 7, 7, 7, 7], lookup)).toBe(12.23)
  })

  it('ignores empty slices and unknown ids', () => {
    expect(priceForSlices([0, 0, 7, 7, 0, 0, 0, 0], lookup)).toBe(11)
    expect(priceForSlices([999, 999, 999, 999, 7, 7, 7, 7], lookup)).toBe(11)
    expect(priceForSlices(emptySlices(), lookup)).toBe(0)
  })
})

describe('itemName', () => {
  it('names a single-flavor pie after the pizza, like the server does', () => {
    expect(itemName([1, 1, 1, 1, 1, 1, 1, 1], lookup)).toBe('Cheese')
  })

  it('counts distinct flavors above one', () => {
    expect(itemName([11, 11, 4, 4, 7, 7, 2, 2], lookup)).toBe('Your 4-flavor pizza')
    expect(itemName([11, 11, 11, 11, 7, 7, 7, 7], lookup)).toBe('Your 2-flavor pizza')
  })

  it('handles an empty pie', () => {
    expect(itemName(emptySlices(), lookup)).toBe('Empty pizza')
  })
})

describe('flavor helpers', () => {
  it('lists distinct flavors in slice order', () => {
    expect(distinctFlavors([11, 11, 4, 4, 7, 7, 2, 2])).toEqual([11, 4, 7, 2])
  })

  it('counts each flavor', () => {
    expect([...flavorCounts([11, 11, 11, 11, 7, 7, 7, 7]).entries()]).toEqual([[11, 4], [7, 4]])
  })

  it('writes the builder breakdown line', () => {
    expect(breakdown([11, 11, 11, 11, 7, 7, 7, 7], lookup)).toBe('Pepperoni ×4 · Broccoli ×4')
  })
})

describe('slice bookkeeping', () => {
  it('knows when the pie is finished', () => {
    expect(isComplete([1, 1, 1, 1, 1, 1, 1, 1])).toBe(true)
    expect(isComplete([1, 1, 0, 0, 0, 0, 0, 0])).toBe(false)
    expect(remainingSlices([1, 1, 0, 0, 0, 0, 0, 0])).toBe(6)
    expect(emptySlices()).toEqual([0, 0, 0, 0, 0, 0, 0, 0])
  })

  it('fills whole, halves and quarters', () => {
    expect(fillWith([1])).toEqual([1, 1, 1, 1, 1, 1, 1, 1])
    expect(fillWith([1, 2])).toEqual([1, 1, 1, 1, 2, 2, 2, 2])
    expect(fillWith([1, 2, 4, 7])).toEqual([1, 1, 2, 2, 4, 4, 7, 7])
    expect(fillWith([])).toEqual(emptySlices())
  })
})

describe('orderTotal', () => {
  it('charges delivery only on a non-empty order', () => {
    expect(orderTotal(22.46, 1)).toBeCloseTo(27.46, 10)
    expect(orderTotal(0, 0)).toBe(0)
    expect(DELIVERY_FEE).toBe(5)
  })

  it('accepts a server-sent fee', () => {
    expect(orderTotal(10, 1, 7.5)).toBe(17.5)
  })
})
