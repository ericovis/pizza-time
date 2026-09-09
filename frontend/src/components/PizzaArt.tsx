import type { CSSProperties, Ref } from 'react'
import '../lib/pizza-art'

export interface PizzaArtProps {
  /** Eight slugs (or one, to fill the pie). Use useCatalog().slugsFor(ids) to
   *  turn the API's pizza ids into slugs; '' is an unpainted slice. */
  slices: string[] | string
  /** Only 'neon' matters here; the element also knows 'oven' and 'editorial'. */
  theme?: string
  /** Draw the four cut lines. */
  cuts?: boolean
  className?: string
  style?: CSSProperties
  /** Decorative by default; pass a label when the art is the only content. */
  title?: string
  /** fx.bump('[data-pizza]') targets this; the design puts it on the element. */
  'data-pizza'?: string
}

/** Thin wrapper around the <pizza-art> custom element. React 19 forwards the
 *  string props straight through as attributes, so there is nothing else to do. */
export function PizzaArt({
  slices, theme = 'neon', cuts = false, className, style, title,
  'data-pizza': dataPizza,
}: PizzaArtProps) {
  const value = Array.isArray(slices) ? slices.join(',') : slices
  return (
    <pizza-art
      slices={value}
      theme={theme}
      cuts={cuts ? '1' : undefined}
      className={className}
      style={style}
      title={title}
      data-pizza={dataPizza}
      aria-hidden={title ? undefined : true}
    />
  )
}

export default PizzaArt

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'pizza-art': {
        slices?: string
        theme?: string
        cuts?: string
        className?: string
        style?: CSSProperties
        title?: string
        'aria-hidden'?: boolean
        'data-pizza'?: string
        ref?: Ref<HTMLElement>
      }
    }
  }
}
