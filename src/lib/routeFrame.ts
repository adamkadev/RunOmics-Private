export interface LngLatBounds {
  minLon: number
  maxLon: number
  minLat: number
  maxLat: number
}

/**
 * Keeps every route clear of the glass over a map. The hero's buttons sit in
 * its top corners, so a route reaches them only at a corner of its own;
 * districtsFullscreen clears the ~190 pt stack at its foot plus a name's height.
 */
export const MAP_PADDING = {
  hero: { top: 32, right: 24, bottom: 36, left: 24 },
  fullscreen: { top: 80, right: 24, bottom: 124, left: 24 },
  card: { top: 64, right: 16, bottom: 52, left: 16 },
  districtsFullscreen: { top: 80, right: 24, bottom: 216, left: 24 },
} as const

/** CSS pixels. */
export interface CameraPadding {
  top: number
  right: number
  bottom: number
  left: number
}

export const FRAME_TRIM = 0.04

function quantile(sorted: number[], p: number): number {
  return sorted[Math.floor(p * (sorted.length - 1))]!
}

/** Percentiles, so one long run out of town doesn't zoom the map out until the usual streets fill a twentieth of it. */
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
