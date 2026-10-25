import { decodeIntegers, encodeIntegers } from '@/lib/polyline'
import type { Activity } from './types'

export const ROUTE_THUMB_BOX = 56
const PAD = 9
const MAX_POINTS = 60

type LonLat = [number, number]

function downsample(route: LonLat[], max: number): LonLat[] {
  if (route.length <= max) return route
  const step = (route.length - 1) / (max - 1)
  return Array.from({ length: max }, (_, i) => route[Math.round(i * step)] as LonLat)
}

/** North up, no map tiles: in a list the stored GPS is the whole picture. */
function thumbPoints(route: LonLat[] | null | undefined): [number, number][] | null {
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
  // Whole points: a 2.5 pt stroke on a 56 pt tile shows no finer, and the list ships one thumbnail per run.
  const points: [number, number][] = []
  for (const [x, y] of xy) {
    const at: [number, number] = [Math.round(ox + (x - minX) * scale), Math.round(oy + (y - minY) * scale)]
    const last = points[points.length - 1]
    if (!last || last[0] !== at[0] || last[1] !== at[1]) points.push(at)
  }
  return points.length < 2 ? null : points
}

/** The first point, then each step, as polyline-style integers: about a third of the SVG path's length. */
export function encodeRouteThumb(route: LonLat[] | null | undefined): string | null {
  const points = thumbPoints(route)
  if (!points) return null
  return encodeIntegers(points.flatMap(([x, y], i) => (i === 0 ? [x, y] : [x - points[i - 1]![0], y - points[i - 1]![1]])))
}

/** The SVG path an encoded thumbnail draws. */
export function routeThumbPath(encoded: string | null | undefined): string | null {
  if (!encoded) return null
  const values = decodeIntegers(encoded)
  let x = 0
  let y = 0
  const commands: string[] = []
  for (let k = 0; k + 1 < values.length; k += 2) {
    x += values[k]!
    y += values[k + 1]!
    commands.push(`${k === 0 ? 'M' : 'L'}${x} ${y}`)
  }
  return commands.length < 2 ? null : commands.join('')
}

// Keyed by the route array: a new commit brings new arrays, and the old ones are collected.
const cache = new WeakMap<object, string | null>()

export function activityRouteThumb(activity: Pick<Activity, 'id' | 'route'>): string | null {
  const { route } = activity
  if (!route) return null
  if (!cache.has(route)) cache.set(route, encodeRouteThumb(route))
  return cache.get(route) ?? null
}
