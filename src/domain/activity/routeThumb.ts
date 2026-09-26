import type { Activity } from './types'

/** The thumbnail's box: the list tiles draw it at 52 or 56 pt. */
export const ROUTE_THUMB_BOX = 56
const PAD = 9
const MAX_POINTS = 60

type LonLat = [number, number]

function downsample(route: LonLat[], max: number): LonLat[] {
  if (route.length <= max) return route
  const step = (route.length - 1) / (max - 1)
  return Array.from({ length: max }, (_, i) => route[Math.round(i * step)] as LonLat)
}

/**
 * The route as a static SVG path in a 56 × 56 box, about 60 points, north up
 * (H06, H09). No map tiles in a list: the stored GPS is the whole picture.
 * Null when there is nothing to draw - a treadmill run, or a GPS fix that
 * never moved - and the list shows the neutral tile.
 */
export function routeThumbPath(route: LonLat[] | null | undefined): string | null {
  if (!route || route.length < 2) return null
  const pts = downsample(route, MAX_POINTS)
  const lat0 = (pts.reduce((sum, p) => sum + p[1], 0) / pts.length) * (Math.PI / 180)
  const xy = pts.map(([lon, lat]) => [lon * Math.cos(lat0), -lat] as const)
  const xs = xy.map((p) => p[0])
  const ys = xy.map((p) => p[1])
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minY = Math.min(...ys), maxY = Math.max(...ys)
  const extent = Math.max(maxX - minX, maxY - minY)
  if (!Number.isFinite(extent) || extent < 1e-5) return null

  const scale = (ROUTE_THUMB_BOX - PAD * 2) / extent
  const ox = (ROUTE_THUMB_BOX - (maxX - minX) * scale) / 2
  const oy = (ROUTE_THUMB_BOX - (maxY - minY) * scale) / 2
  // Whole points: a 2.5 pt stroke on a 56 pt tile shows no finer, and the
  // Activities list ships one path per run.
  const cmds: string[] = []
  let last = ''
  for (const [x, y] of xy) {
    const at = `${Math.round(ox + (x - minX) * scale)} ${Math.round(oy + (y - minY) * scale)}`
    if (at === last) continue
    cmds.push(`${cmds.length === 0 ? 'M' : 'L'}${at}`)
    last = at
  }
  return cmds.length < 2 ? null : cmds.join('')
}

const cache = new Map<string, string | null>()

/** One path per activity, worked out once: the route never changes after sync. */
export function activityRouteThumb(activity: Pick<Activity, 'id' | 'route'>): string | null {
  const key = `${activity.id}:${activity.route?.length ?? 0}`
  if (!cache.has(key)) cache.set(key, routeThumbPath(activity.route))
  return cache.get(key) ?? null
}
