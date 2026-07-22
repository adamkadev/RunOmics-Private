import { encodePolyline, maptilerStaticMapUrl } from '@/lib/maptiler'
import type { ThemeMode } from '@/lib/shareCardPalette'

/** GPS coordinates in Garmin/GeoJSON order. */
export type LngLat = [number, number]

/**
 * Empty margin kept around the route's bounding box, as a fraction of each
 * axis. MapTiler applies it when it auto-frames the static image and
 * `routeProjector` applies the same one, so the trace we paint on the canvas
 * lands exactly where the basemap put it.
 */
export const ROUTE_PADDING = 0.12

/** Cap on the points we keep: enough shape to read, short enough for a URL. */
const MAX_POINTS = 150

/** Thins a route to at most `maxPoints`, keeping the last point so the finish
 *  marker stays put. Deterministic - the URL and the canvas simplify alike. */
export function simplifyRoute(coords: LngLat[], maxPoints = MAX_POINTS): LngLat[] {
  if (coords.length <= maxPoints) return coords
  const step = Math.ceil(coords.length / maxPoints)
  return coords.filter((_, i) => i % step === 0 || i === coords.length - 1)
}

/** Normalized Web Mercator - the unit square MapTiler renders the world into. */
function mercator([lng, lat]: LngLat): [number, number] {
  const s = Math.sin((lat * Math.PI) / 180)
  return [(lng + 180) / 360, 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)]
}

// A route that never moves would divide by zero; clamp the extent to roughly a
// four-metre box so the projection stays finite.
const MIN_EXTENT = 1e-7

/**
 * Maps route coordinates onto a `w` x `h` canvas the way MapTiler's `auto`
 * framing maps them onto the static image: the bounding box centered in the
 * frame, scaled to fit, with ROUTE_PADDING left empty on every side.
 */
export function routeProjector(route: LngLat[], w: number, h: number): (p: LngLat) => [number, number] {
  const pts = route.map(mercator)
  const xs = pts.map(p => p[0])
  const ys = pts.map(p => p[1])
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minY = Math.min(...ys), maxY = Math.max(...ys)
  const scale = Math.min(
    (w * (1 - 2 * ROUTE_PADDING)) / Math.max(maxX - minX, MIN_EXTENT),
    (h * (1 - 2 * ROUTE_PADDING)) / Math.max(maxY - minY, MIN_EXTENT),
  )
  const ox = w / 2 - ((minX + maxX) / 2) * scale
  const oy = h / 2 - ((minY + maxY) / 2) * scale
  return (p) => {
    const [x, y] = mercator(p)
    return [x * scale + ox, y * scale + oy]
  }
}

/** Projects the whole route in one pass, thinning it first. */
export function projectRoute(route: LngLat[], w: number, h: number): [number, number][] {
  const simplified = simplifyRoute(route)
  const project = routeProjector(simplified, w, h)
  return simplified.map(project)
}

/**
 * The basemap image behind the `route` design, framed on the activity. Returns
 * null when no MapTiler token is configured, which the caller reads as "fall
 * back to the drawn map".
 */
export function routeMapUrl(route: LngLat[], theme: ThemeMode, width: number, height: number): string | null {
  const token = process.env.NEXT_PUBLIC_MAPTILER_TOKEN
  if (!token) return null
  return maptilerStaticMapUrl({
    isDark: theme === 'dark',
    token,
    width,
    height,
    encodedPath: encodePolyline(simplifyRoute(route)),
    padding: ROUTE_PADDING,
  })
}
