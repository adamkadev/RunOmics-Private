export interface LngLatBounds {
  minLon: number
  maxLon: number
  minLat: number
  maxLat: number
}

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
