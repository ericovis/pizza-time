/* Wedge geometry for the builder, ported from the design prototype.
   Wedge 0 starts at -90deg (12 o'clock) and each wedge spans 45deg, which is
   the same order the canvas in pizza-art.ts draws them in, so slice index i in
   the `slices` array is the wedge the user tapped. */

export interface Wedge {
  /** CSS clip-path polygon in % coordinates, for an absolutely positioned button. */
  clip: string
  /** Angle of the wedge's midpoint in degrees, 0 = 3 o'clock. */
  mid: number
}

export const SLICE_COUNT = 8

export const WEDGES: Wedge[] = Array.from({ length: SLICE_COUNT }, (_, i) => {
  const a0 = ((-90 + i * 45) * Math.PI) / 180
  const pts = ['50% 50%']
  for (let t = 0; t <= 1.0001; t += 0.125) {
    const a = a0 + (t * Math.PI) / 4
    pts.push(`${(50 + 52 * Math.cos(a)).toFixed(1)}% ${(50 + 52 * Math.sin(a)).toFixed(1)}%`)
  }
  return { clip: `polygon(${pts.join(',')})`, mid: -90 + i * 45 + 22.5 }
})

/** Shortest signed difference between two angles in degrees. */
export function angleDelta(from: number, to: number): number {
  let d = to - from
  if (d > 180) d -= 360
  if (d < -180) d += 360
  return d
}

/** Angle in degrees from an element's centre to a pointer position. */
export function angleTo(el: Element, clientX: number, clientY: number): number {
  const r = el.getBoundingClientRect()
  return (Math.atan2(clientY - (r.top + r.height / 2), clientX - (r.left + r.width / 2)) * 180) / Math.PI
}
