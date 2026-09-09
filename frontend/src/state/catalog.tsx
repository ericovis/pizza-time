import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { listPizzas, type Pizza } from '../api/pizzas'
import { errorMessage } from '../api/client'
import { FALLBACK_SLUG } from '../lib/pizza-art'

export interface CatalogValue {
  pizzas: Pizza[]
  loading: boolean
  error: string | null
  /** Undefined for an id that is not on the menu any more. */
  byId: (id: number) => Pizza | undefined
  bySlug: (slug: string) => Pizza | undefined
  /** Ids -> slugs for <PizzaArt slices=...>. An id that cannot be resolved
   *  falls back to the cheese recipe (plan 3.6); 0 stays an empty slice. */
  slugsFor: (ids: readonly number[]) => string[]
  reload: () => void
}

const CatalogContext = createContext<CatalogValue | null>(null)

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [pizzas, setPizzas] = useState<Pizza[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    let alive = true
    setLoading(true)
    listPizzas(controller.signal)
      .then((rows) => {
        if (!alive) return
        setPizzas(rows)
        setError(null)
      })
      .catch((err: unknown) => {
        if (!alive || controller.signal.aborted) return
        setError(errorMessage(err, 'The menu could not be loaded.'))
      })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false; controller.abort() }
  }, [nonce])

  const value = useMemo<CatalogValue>(() => {
    const byIdMap = new Map(pizzas.map((p) => [p.id, p]))
    const bySlugMap = new Map(pizzas.map((p) => [p.slug, p]))
    return {
      pizzas,
      loading,
      error,
      byId: (id: number) => byIdMap.get(id),
      bySlug: (slug: string) => bySlugMap.get(slug),
      slugsFor: (ids: readonly number[]) =>
        Array.from(ids ?? [], (id) => (id ? (byIdMap.get(id)?.slug ?? FALLBACK_SLUG) : '')),
      reload: () => setNonce((n) => n + 1),
    }
  }, [pizzas, loading, error])

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>
}

export function useCatalog(): CatalogValue {
  const value = useContext(CatalogContext)
  if (!value) throw new Error('useCatalog must be used inside <CatalogProvider>')
  return value
}
