// Route similarity via grid-cell overlap - the same ~30m binning the frequency
// heatmap uses (buildHeatGeoJSON), reused to answer "is this the same loop?"
// for matched runs (activity page) and personal segments (map).

// Grid cell size in degrees (~30m). Kept wider than raw GPS noise (~5-15m) so
// repeated passes down the same street land in one cell instead of scattering
// across several low-count cells.
export const ROUTE_GRID = 0.0003

export function routeCellKey(lon: number, lat: number): string {
  return `${Math.round(lon / ROUTE_GRID)}:${Math.round(lat / ROUTE_GRID)}`
}

export interface RouteCellSet {
  cells: Set<string>
  // Cells plus their 8 neighbours: membership here means "within ~one cell of
  // the trace", which absorbs run-to-run GPS jitter across cell boundaries.
  dilated: Set<string>
}

export function buildRouteCellSet(coords: [number, number][]): RouteCellSet {
  const cells = new Set<string>()
  for (const [lon, lat] of coords) cells.add(routeCellKey(lon, lat))

  const dilated = new Set<string>()
  for (const key of cells) {
    const [x, y] = key.split(':').map(Number) as [number, number]
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) dilated.add(`${x + dx}:${y + dy}`)
    }
  }
  return { cells, dilated }
}

function coverage(of: RouteCellSet, within: RouteCellSet): number {
  if (of.cells.size === 0) return 0
  let hits = 0
  for (const cell of of.cells) if (within.dilated.has(cell)) hits++
  return hits / of.cells.size
}

// Symmetric similarity in [0,1]: the worse of "how much of A lies on B's trace"
// and the reverse, so a short out-and-back doesn't "match" a long run that
// merely passes through it.
export function routeSimilarity(a: RouteCellSet, b: RouteCellSet): number {
  return Math.min(coverage(a, b), coverage(b, a))
}

export const SIMILAR_ROUTE_MIN_SIMILARITY = 0.85

// Same cells but twice the distance = same loop run twice, not the same outing.
export const SIMILAR_ROUTE_MAX_DISTANCE_DELTA = 0.15

export function isSimilarDistance(aKm: number, bKm: number): boolean {
  if (aKm <= 0 || bKm <= 0) return false
  return Math.abs(aKm - bKm) / Math.max(aKm, bKm) <= SIMILAR_ROUTE_MAX_DISTANCE_DELTA
}
