export type LngLat = [number, number]

export const ROUTE_PADDING = 0.12

export function routePaddingPx(w: number, h: number): number {
  return Math.round(Math.min(w, h) * ROUTE_PADDING)
}

export interface RoutePadding { top: number; right: number; bottom: number; left: number }

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
