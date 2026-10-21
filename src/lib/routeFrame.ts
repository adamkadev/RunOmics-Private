export interface LngLatBounds {
  minLon: number
  maxLon: number
  minLat: number
  maxLat: number
}

/**
 * Camera padding that keeps every route clear of the glass over a map
 * (Liquid Glass v3, README §6.12.1), for each fitBounds / easeTo.
 * - hero: the 12 pt gap, the 44 pt buttons and 12 pt of air at the top; the
 *   64 pt fade and 16 more at the foot.
 * - fullscreen: the row of controls at the top; the legend card and its
 *   24 pt inset at the foot.
 * - card: the Activities map card's controls and legend capsule.
 */
export const MAP_PADDING = {
  hero: { top: 68, right: 24, bottom: 80, left: 24 },
  fullscreen: { top: 80, right: 24, bottom: 124, left: 24 },
  card: { top: 64, right: 16, bottom: 52, left: 16 },
} as const

/** The share of points each side of the heatmap's frame leaves out. */
export const FRAME_TRIM = 0.04

function quantile(sorted: number[], p: number): number {
  return sorted[Math.floor(p * (sorted.length - 1))]!
}

/**
 * The box the heatmap opens on (v4.17): the 4th to 96th percentile of every
 * point's longitude and latitude, so one long run out of town doesn't zoom
 * the area out until the streets run most fill a twentieth of the map.
 * Null when there is no point.
 */
export function percentileBounds(tracks: Iterable<readonly (readonly [number, number])[]>, trim = FRAME_TRIM): LngLatBounds | null {
  const lons: number[] = []
  const lats: number[] = []
  for (const track of tracks) {
    for (const [lon, lat] of track) {
      lons.push(lon)
      lats.push(lat)
    }
  }
  if (!lons.length) return null
  lons.sort((a, b) => a - b)
  lats.sort((a, b) => a - b)
  return {
    minLon: quantile(lons, trim),
    maxLon: quantile(lons, 1 - trim),
    minLat: quantile(lats, trim),
    maxLat: quantile(lats, 1 - trim),
  }
}
