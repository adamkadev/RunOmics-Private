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
