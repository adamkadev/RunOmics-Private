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
