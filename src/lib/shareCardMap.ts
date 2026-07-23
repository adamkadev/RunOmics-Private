/** GPS coordinates in Garmin/GeoJSON order. */
export type LngLat = [number, number]

/**
 * Empty margin kept around the route's bounding box, as a fraction of the
 * frame's short side. Fed to MapLibre's `fitBounds` when the basemap renders,
 * and reused by `projectRoute` for the provisional framing we draw while that
 * render is still in flight - so the trace barely moves when the map lands.
 */
export const ROUTE_PADDING = 0.12

/** `fitBounds` takes pixels, not a fraction; one value for all four sides. */
export function routePaddingPx(w: number, h: number): number {
  return Math.round(Math.min(w, h) * ROUTE_PADDING)
}

export interface RoutePadding { top: number; right: number; bottom: number; left: number }

/**
 * Per-side padding for the `route` design's `fitBounds`. On the tall share card
 * the top and bottom are opened up so the trace sits in the band between the
 * title and the stats panel rather than running full-bleed under both - which
 * also zooms it out a touch. Square frames (the thumbnail) stay symmetric.
 */
export function routePadding(w: number, h: number): RoutePadding {
  const base = routePaddingPx(w, h)
  const tall = h > w * 1.3
  if (!tall) return { top: base, right: base, bottom: base, left: base }
  return {
    top: Math.round(h * 0.18),
    bottom: Math.round(h * 0.24),
    left: Math.round(w * 0.14),
    right: Math.round(w * 0.14),
  }
}

/** Cap on the points we keep: enough shape to read, cheap enough to reproject. */
const MAX_POINTS = 150

/** Thins a route to at most `maxPoints`, keeping the last point so the finish
 *  marker stays put. Deterministic - every caller thins alike. */
export function simplifyRoute(coords: LngLat[], maxPoints = MAX_POINTS): LngLat[] {
  if (coords.length <= maxPoints) return coords
  const step = Math.ceil(coords.length / maxPoints)
  return coords.filter((_, i) => i % step === 0 || i === coords.length - 1)
}

/** Normalized Web Mercator - the unit square MapLibre renders the world into. */
function mercator([lng, lat]: LngLat): [number, number] {
  const s = Math.sin((lat * Math.PI) / 180)
  return [(lng + 180) / 360, 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)]
}

// A route that never moves would divide by zero; clamp the extent to roughly a
// four-metre box so the projection stays finite.
const MIN_EXTENT = 1e-7

/**
 * Where the route falls on a `w` x `h` canvas, framed the way MapLibre's
 * `fitBounds` frames it: bounding box scaled to fit, then centered in the frame
 * minus `routePadding` (which reserves room for the title and stats on the tall
 * card, so the trace lands in the band between them).
 *
 * Once the basemap has rendered we use MapLibre's own `map.project()` instead,
 * which is exact by construction; this is the stand-in until then.
 */
export function projectRoute(route: LngLat[], w: number, h: number): [number, number][] {
  const simplified = simplifyRoute(route)
  const pts = simplified.map(mercator)
  const xs = pts.map(p => p[0])
  const ys = pts.map(p => p[1])
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minY = Math.min(...ys), maxY = Math.max(...ys)

  // Match MapLibre's fitBounds: fit the box into the frame minus the per-side
  // padding, then center it in that padded rectangle (which for the tall card
  // is offset from the frame center, keeping the trace between title and stats).
  const p = routePadding(w, h)
  const availW = w - p.left - p.right
  const availH = h - p.top - p.bottom
  const scale = Math.min(
    availW / Math.max(maxX - minX, MIN_EXTENT),
    availH / Math.max(maxY - minY, MIN_EXTENT),
  )
  const cx = (p.left + (w - p.right)) / 2
  const cy = (p.top + (h - p.bottom)) / 2
  const ox = cx - ((minX + maxX) / 2) * scale
  const oy = cy - ((minY + maxY) / 2) * scale
  return pts.map(([x, y]) => [x * scale + ox, y * scale + oy])
}
