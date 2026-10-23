import { median } from '@/lib/math'

/**
 * Home as Explore measures it: the median longitude and the median latitude,
 * taken separately, of where the runs start. The same rule as the map's
 * `computeAreaTerritory`, so the Progress card and the map agree on which
 * quartier is "next" and how far each one is.
 *
 * A median, not a mean, so the odd run started from the office or a holiday
 * flat moves it nowhere. The result only ever feeds distances on the device;
 * it is never sent anywhere or written down.
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
