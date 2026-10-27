import type { ShareActivity } from '@/lib/shareCardStats'

export type LngLat = [number, number]

/** The route's room on each side of the card's map, in px. */
export interface RouteFrame {
  top: number
  right: number
  bottom: number
  left: number
}

/** Wide enough that an end marker centred on the frame's edge still clears the card's 16 px text margin. */
export const ROUTE_INSET = 27

export const ROUTE_TEXT_GAP = 16

const MAX_POINTS = 150

export function simplifyRoute(coords: LngLat[], maxPoints = MAX_POINTS): LngLat[] {
  if (coords.length <= maxPoints) return coords
  const step = Math.ceil(coords.length / maxPoints)
  return coords.filter((_, i) => i % step === 0 || i === coords.length - 1)
}

function mercator([lng, lat]: LngLat): [number, number] {
  const s = Math.sin((lat * Math.PI) / 180)
  return [(lng + 180) / 360, 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)]
}

const MIN_EXTENT = 1e-7

const UNIFORM: RouteFrame = { top: ROUTE_INSET, right: ROUTE_INSET, bottom: ROUTE_INSET, left: ROUTE_INSET }

export function projectRoute(route: LngLat[], w: number, h: number, frame: RouteFrame = UNIFORM): [number, number][] {
  const simplified = simplifyRoute(route)
  const pts = simplified.map(mercator)
  const xs = pts.map(p => p[0])
  const ys = pts.map(p => p[1])
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minY = Math.min(...ys), maxY = Math.max(...ys)

  const availW = w - frame.left - frame.right
  const availH = h - frame.top - frame.bottom
  const scale = Math.min(
    availW / Math.max(maxX - minX, MIN_EXTENT),
    availH / Math.max(maxY - minY, MIN_EXTENT),
  )
  const cx = frame.left + availW / 2
  const cy = frame.top + availH / 2
  const ox = cx - ((minX + maxX) / 2) * scale
  const oy = cy - ((minY + maxY) / 2) * scale
  return pts.map(([x, y]) => [x * scale + ox, y * scale + oy])
}

/**
 * An invisible icon on each point, placed above the place names, makes a name
 * that would touch the route collide and be dropped. Vertices are kept, so a
 * corner is fenced too.
 */
export function routeFencePoints(pts: readonly [number, number][], step = 6): [number, number][] {
  const out: [number, number][] = []
  for (let i = 0; i < pts.length; i++) {
    const [x2, y2] = pts[i]!
    if (i > 0) {
      const [x1, y1] = pts[i - 1]!
      const length = Math.hypot(x2 - x1, y2 - y1)
      for (let d = step; d < length; d += step) out.push([x1 + ((x2 - x1) * d) / length, y1 + ((y2 - y1) * d) / length])
    }
    out.push([x2, y2])
  }
  return out
}

/** A name cut by either band's fade is dropped, as one cut by the canvas edge is. */
export function bandFencePoints(w: number, ys: readonly number[], step = 16): [number, number][] {
  const out: [number, number][] = []
  for (const y of ys) {
    for (let x = 0; x < w; x += step) out.push([x, y])
    out.push([w, y])
  }
  return out
}

/** The card leaves out the first and last 250 m by default, so a shared image does not show the door the run left from. */
export const SHARE_TRIM_M = 250

const EARTH_M = 6_371_000

export function metresBetween([lng1, lat1]: LngLat, [lng2, lat2]: LngLat): number {
  const rad = Math.PI / 180
  const dLat = (lat2 - lat1) * rad
  const dLng = (lng2 - lng1) * rad
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_M * Math.asin(Math.min(1, Math.sqrt(a)))
}

interface Exit { index: number; point: LngLat; along: number }

function lerp([x1, y1]: LngLat, [x2, y2]: LngLat, k: number): LngLat {
  return [x1 + (x2 - x1) * k, y1 + (y2 - y1) * k]
}

/** Where the line first leaves the circle; kept on its outer side, so the cut is never nearer the centre than the radius. */
function exitCircle(route: LngLat[], radius: number): Exit | null {
  const centre = route[0]!
  let along = 0
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1]!
    const b = route[i]!
    const span = metresBetween(a, b)
    if (metresBetween(centre, b) >= radius) {
      let lo = 0
      let hi = 1
      for (let n = 0; n < 24; n++) {
        const mid = (lo + hi) / 2
        if (metresBetween(centre, lerp(a, b, mid)) >= radius) hi = mid
        else lo = mid
      }
      return { index: i, point: lerp(a, b, hi), along: along + span * hi }
    }
    along += span
  }
  return null
}

export interface TrimmedRoute {
  route: LngLat[]
  /** The kept part, as shares of the recorded line's length. */
  from: number
  to: number
}

/** A run that never strays far keeps the outer half of its reach. */
export function trimRouteEnds(route: LngLat[], metres = SHARE_TRIM_M): TrimmedRoute {
  const whole = { route, from: 0, to: 1 }
  if (route.length < 2) return whole
  let total = 0
  for (let i = 1; i < route.length; i++) total += metresBetween(route[i - 1]!, route[i]!)
  const reversed = [...route].reverse()
  const reach = (line: LngLat[]) => Math.max(...line.map((c) => metresBetween(line[0]!, c)))
  const start = exitCircle(route, Math.min(metres, reach(route) / 2))
  const end = exitCircle(reversed, Math.min(metres, reach(reversed) / 2))
  if (total <= 0 || !start || !end) return whole
  const endAlong = total - end.along
  if (endAlong <= start.along) return { route: [start.point, end.point], from: start.along / total, to: start.along / total }
  const inner = route.slice(start.index, route.length - end.index)
  return { route: [start.point, ...inner, end.point], from: start.along / total, to: endAlong / total }
}

/** The reps' shares follow the trimmed line, so each rep stays on the road it was run on. */
export function trimShareRoute(activity: ShareActivity, metres = SHARE_TRIM_M): ShareActivity {
  if (!activity.route || activity.route.length < 2) return activity
  const { route, from, to } = trimRouteEnds(activity.route, metres)
  if (!activity.reps) return { ...activity, route }
  const span = to - from
  const share = (f: number) => (span > 0 ? Math.min(Math.max((f - from) / span, 0), 1) : 0)
  const windows = activity.reps.windows
    .map(([a, b]): [number, number] => [share(a), share(b)])
    .filter(([a, b]) => b > a)
  return { ...activity, route, reps: { ...activity.reps, windows } }
}
