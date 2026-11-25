import { median } from '@/lib/math'

/**
 * Same rule as the map's `computeAreaTerritory`, so the Progress card and the
 * map agree on which quartier is "next". A median, not a mean, so the odd run
 * started from the office moves it nowhere. Privacy: it only feeds distances on
 * the device and is never sent anywhere or written down.
 */
export function medianStart(firstPoints: readonly (readonly [number, number])[]): [number, number] | null {
  const lons: number[] = []
  const lats: number[] = []
  for (const [lon, lat] of firstPoints) {
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue
    lons.push(lon)
    lats.push(lat)
  }
  if (lons.length === 0) return null
  return [median(lons), median(lats)]
}

/** Starts this close count as the same place: a doorstep and the corner beyond it. */
export const USUAL_START_RADIUS_M = 150

const M_PER_DEG = 111_320

/**
 * Where most runs set off: the start with the most others within the radius, then the median of that group. Unlike the
 * median start, this one is the loop's default start and goes to the routing service.
 */
export function usualStart(firstPoints: readonly (readonly [number, number])[], radiusM = USUAL_START_RADIUS_M): [number, number] | null {
  const points = firstPoints.filter(([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat))
  if (points.length === 0) return null
  const lat0 = median(points.map(([, lat]) => lat))
  const xy = points.map(([lon, lat]) => [lon * M_PER_DEG * Math.cos((lat0 * Math.PI) / 180), lat * M_PER_DEG] as const)
  const cells = new Map<string, number[]>()
  const cellOf = (x: number, y: number) => [Math.floor(x / radiusM), Math.floor(y / radiusM)] as const
  xy.forEach(([x, y], i) => {
    const [cx, cy] = cellOf(x, y)
    const key = `${cx},${cy}`
    const bucket = cells.get(key)
    if (bucket) bucket.push(i)
    else cells.set(key, [i])
  })
  const near = (i: number): number[] => {
    const [x, y] = xy[i]!
    const [cx, cy] = cellOf(x, y)
    const found: number[] = []
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const j of cells.get(`${cx + dx},${cy + dy}`) ?? []) {
          if (Math.hypot(xy[j]![0] - x, xy[j]![1] - y) <= radiusM) found.push(j)
        }
      }
    }
    return found
  }
  let best: number[] = []
  for (let i = 0; i < points.length; i++) {
    const group = near(i)
    if (group.length > best.length) best = group
  }
  return [median(best.map((j) => points[j]![0])), median(best.map((j) => points[j]![1]))]
}
