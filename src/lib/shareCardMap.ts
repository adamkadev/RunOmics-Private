export type LngLat = [number, number]

/**
 * The route's room on every side of the share card's map, in px (design
 * review, Oct 2026): the trace fills the map but never reaches its edge,
 * where the shared image read as cropped.
 */
export const ROUTE_INSET = 14

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

export function projectRoute(route: LngLat[], w: number, h: number): [number, number][] {
  const simplified = simplifyRoute(route)
  const pts = simplified.map(mercator)
  const xs = pts.map(p => p[0])
  const ys = pts.map(p => p[1])
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minY = Math.min(...ys), maxY = Math.max(...ys)

  const availW = w - ROUTE_INSET * 2
  const availH = h - ROUTE_INSET * 2
  const scale = Math.min(
    availW / Math.max(maxX - minX, MIN_EXTENT),
    availH / Math.max(maxY - minY, MIN_EXTENT),
  )
  const cx = w / 2
  const cy = h / 2
  const ox = cx - ((minX + maxX) / 2) * scale
  const oy = cy - ((minY + maxY) / 2) * scale
  return pts.map(([x, y]) => [x * scale + ox, y * scale + oy])
}
