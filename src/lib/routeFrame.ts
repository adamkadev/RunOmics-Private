export interface LngLatBounds {
  minLon: number
  maxLon: number
  minLat: number
  maxLat: number
}

/**
 * Camera padding that keeps every route clear of the glass over a map
 * (Liquid Glass v3, README §6.12.1), for each fitBounds / easeTo.
 * - hero: 3.0's frame (round 2, the owner's ask): 68 and 80 pt kept the
 *   route clear of the buttons and the foot's fade but drew it at about
 *   60 % of its size in a 300 pt hero. The buttons sit in the top corners,
 *   so a route reaches them only at a corner of its own.
 * - fullscreen: the row of controls at the top; the legend card and its
 *   24 pt inset at the foot.
 * - card: the Activities map card's controls and legend capsule.
 */
export const MAP_PADDING = {
  hero: { top: 32, right: 24, bottom: 36, left: 24 },
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
