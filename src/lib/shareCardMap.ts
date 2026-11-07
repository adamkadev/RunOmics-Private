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

type Px = [number, number]

export function pointInRing([x, y]: Px, ring: readonly Px[]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!
    const [xj, yj] = ring[j]!
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

function distanceToSegment([px, py]: Px, [x1, y1]: Px, [x2, y2]: Px): number {
  const dx = x2 - x1
  const dy = y2 - y1
  const length2 = dx * dx + dy * dy
  const k = length2 > 0 ? Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / length2)) : 0
  return Math.hypot(px - (x1 + k * dx), py - (y1 + k * dy))
}

export function distanceToLine(p: Px, line: readonly Px[]): number {
  if (line.length === 1) return Math.hypot(p[0] - line[0]![0], p[1] - line[0]![1])
  let best = Infinity
  for (let i = 1; i < line.length; i++) best = Math.min(best, distanceToSegment(p, line[i - 1]!, line[i]!))
  return best
}

/** The route's length, in px, over which `keep` holds at each step's middle. */
function routeLengthWhere(route: readonly Px[], keep: (p: Px) => boolean): number {
  let total = 0
  for (let i = 1; i < route.length; i++) {
    const [x1, y1] = route[i - 1]!
    const [x2, y2] = route[i]!
    if (keep([(x1 + x2) / 2, (y1 + y2) / 2])) total += Math.hypot(x2 - x1, y2 - y1)
  }
  return total
}

export function routeLength(route: readonly Px[]): number {
  return routeLengthWhere(route, () => true)
}

/** A polygon is its outer rings; a tile cuts one park into several. */
export interface GreenArea {
  name: string
  /** Where its name sits on the map. */
  at: Px
  rings: Px[][]
}

/** Below this share of the route, a park it only brushes past is not the run's landmark. */
const LANDMARK_MIN_SHARE = 0.15

/** The park the run spent most of its distance in, or the one a loop (`joined`) runs round. */
export function pickLandmark(route: readonly Px[], areas: readonly GreenArea[], joined: boolean): GreenArea | null {
  const total = routeLength(route)
  if (total <= 0) return null
  let best: { area: GreenArea; score: number } | null = null
  for (const area of areas) {
    const inside = routeLengthWhere(route, (p) => area.rings.some((ring) => pointInRing(p, ring)))
    const share = inside / total
    const circled = joined && pointInRing(area.at, route as Px[])
    const score = share >= LANDMARK_MIN_SHARE ? share : circled ? LANDMARK_MIN_SHARE : 0
    if (score > 0 && (!best || score > best.score)) best = { area, score }
  }
  return best?.area ?? null
}

export interface WaterLine {
  name: string
  lines: Px[][]
}

/** Px from the water's centre line: a riverside path runs a road's width off it. */
const ALONGSIDE_PX = 24
const WATER_MIN_SHARE = 0.15

/** The river or canal the route runs beside the longest, and the point beside the route to name it at. */
export function pickWater(route: readonly Px[], waters: readonly WaterLine[]): { name: string; at: Px } | null {
  const total = routeLength(route)
  if (total <= 0) return null
  let best: { name: string; at: Px; share: number } | null = null
  for (const water of waters) {
    const near = (p: Px) => water.lines.some((line) => distanceToLine(p, line) <= ALONGSIDE_PX)
    const share = routeLengthWhere(route, near) / total
    if (share < WATER_MIN_SHARE || (best && share <= best.share)) continue
    const beside = route.filter(near)
    best = { name: water.name, at: beside[Math.floor(beside.length / 2)] ?? route[0]!, share }
  }
  return best ? { name: best.name, at: best.at } : null
}
