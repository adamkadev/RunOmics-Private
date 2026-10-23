/**
 * Shared by the boundary build script, the coverage worker and route scoring,
 * so a cell key means the same square everywhere. Each area file's `origin` is
 * a public point such as the commune centre, never home. Equirectangular about
 * the origin, as `distanceKm`: Web Mercator units would make a "150 m" cell
 * about 98 m on the ground at 49°N.
 */

export const CELL_M = 150
/** Interpolate track segments so samples are at most this far apart. */
export const MAX_STEP_M = 75
/**
 * A longer step is a GPS dropout, not a street, so it is not interpolated into
 * a straight line of cells. Real tracks top out around 160 m.
 */
export const BREAK_M = 300
export const M_PER_DEGREE = 111_320

export interface GridSpec {
  /** [lon, lat] of the projection origin. */
  origin: [number, number]
  cellM: number
}

export interface Projection {
  lon0: number
  lat0: number
  /** Metres per degree of longitude at the origin. */
  kx: number
  /** Metres per degree of latitude. */
  ky: number
  cellM: number
}

export function projection(grid: GridSpec): Projection {
  const [lon0, lat0] = grid.origin
  return {
    lon0,
    lat0,
    kx: M_PER_DEGREE * Math.cos((lat0 * Math.PI) / 180),
    ky: M_PER_DEGREE,
    cellM: grid.cellM,
  }
}

export function projectX(p: Projection, lon: number): number {
  return (lon - p.lon0) * p.kx
}

export function projectY(p: Projection, lat: number): number {
  return (lat - p.lat0) * p.ky
}

export function unproject(p: Projection, x: number, y: number): [number, number] {
  return [p.lon0 + x / p.kx, p.lat0 + y / p.ky]
}

const OFFSET = 32_768
const SPAN = 65_536

/**
 * One number per cell: `(i + 2^15) * 2^16 + (j + 2^15)`. Indices run from
 * -32 768 to 32 767, about ±4 900 km of 150 m cells around the origin, and
 * every key is a non-negative integer below 2^32.
 */
export function cellKey(i: number, j: number): number {
  return (i + OFFSET) * SPAN + (j + OFFSET)
}

export function cellIndices(key: number): [number, number] {
  return [Math.floor(key / SPAN) - OFFSET, (key % SPAN) - OFFSET]
}

/** The cell holding a point given in projected metres. */
export function cellOfXY(cellM: number, x: number, y: number): number {
  return cellKey(Math.floor(x / cellM), Math.floor(y / cellM))
}

export function cellOf(p: Projection, lon: number, lat: number): number {
  return cellOfXY(p.cellM, projectX(p, lon), projectY(p, lat))
}

/** The cell's centre as [lon, lat]. */
export function cellCentre(p: Projection, key: number): [number, number] {
  const [i, j] = cellIndices(key)
  return unproject(p, (i + 0.5) * p.cellM, (j + 0.5) * p.cellM)
}

/**
 * `coords` is flat [lon, lat, lon, lat, …]; samples come back in projected
 * metres. `step` is the distance from the previous sample, 0 where a run of
 * samples starts: a segment longer than `breakM` starts a new run, so nothing is
 * drawn across the gap.
 */
export function sampleLine(
  coords: ArrayLike<number>,
  p: Projection,
  maxStepM: number,
  breakM: number,
  visit: (x: number, y: number, step: number) => void,
): void {
  const n = Math.floor(coords.length / 2)
  if (n === 0) return

  let px = projectX(p, coords[0]!)
  let py = projectY(p, coords[1]!)
  visit(px, py, 0)

  for (let k = 1; k < n; k++) {
    const x = projectX(p, coords[2 * k]!)
    const y = projectY(p, coords[2 * k + 1]!)
    const length = Math.hypot(x - px, y - py)

    if (length > breakM) {
      visit(x, y, 0)
    } else if (length > 0) {
      const pieces = Math.max(1, Math.ceil(length / maxStepM))
      const step = length / pieces
      for (let s = 1; s <= pieces; s++) {
        const f = s / pieces
        visit(px + (x - px) * f, py + (y - py) * f, step)
      }
    }

    px = x
    py = y
  }
}
