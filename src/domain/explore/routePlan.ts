import { nearAvoidCircle, type AvoidCircle } from './avoidSpots'
import type { AreaIndex } from './coverage'
import { cellIndices, projectX, projectY, unproject } from './grid'

export type LonLat = [number, number]
type Point = [number, number]

/** The planner never picks a via closer to home than this: the runner chose the start, not the vias. */
export const HOME_GUARD_M = 600
/** A run on streets is about this much longer than the straight lines between its points. */
export const STREET_DETOUR = 1.3
const DRAWS = 96
/** Two legs closer than this in bearing make an out-and-back. */
const MIN_SPREAD_RAD = Math.PI / 6
const OUT_AND_BACK_COST = 0.5
const OUTSIDE_UNIT_COST = 0.1

export interface RoutePlanRequest {
  unitId: string
  /** The point tapped on the map: the loop starts and ends there. */
  origin: LonLat
  home: LonLat | null
  distanceM: number
  seeds: number[]
  /** No via is picked inside one or by its edge. */
  avoid?: readonly AvoidCircle[]
}

/** `vias[k]` is for `seeds[k]`; an empty list asks for a plain round trip from the origin. */
export type RoutePlan = { kind: 'tour'; vias: LonLat[][] } | { kind: 'tooFar'; minKm: number }

interface Cell {
  key: number
  at: Point
}

const dist = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1])

/** mulberry32: the same seed draws the same vias, so a batch can be asked for again. */
function random(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), a | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function tourCost(d: Point, a: Point, b: Point, perimeter: number, cellM: number): number {
  const length = dist(d, a) + dist(a, b) + dist(b, d)
  const cost = Math.abs(length - perimeter) / perimeter
  const ax = a[0] - d[0]
  const ay = a[1] - d[1]
  const bx = b[0] - d[0]
  const by = b[1] - d[1]
  const spread = Math.abs(Math.atan2(ax * by - ay * bx, ax * bx + ay * by))
  const outAndBack = spread < MIN_SPREAD_RAD && dist(d, a) > cellM && dist(d, b) > cellM
  return outAndBack ? cost + OUT_AND_BACK_COST : cost
}

export function planRoute(index: AreaIndex, visited: ReadonlySet<number>, request: RoutePlanRequest): RoutePlan | null {
  const unitIdx = index.units.findIndex((u) => u.id === request.unitId)
  const unit = index.units[unitIdx]
  if (!unit || unit.runnable.size === 0) return null

  const { proj } = index
  const xy = ([lon, lat]: LonLat): Point => [projectX(proj, lon), projectY(proj, lat)]
  const cellAt = (key: number): Cell => {
    const [i, j] = cellIndices(key)
    return { key, at: [(i + 0.5) * proj.cellM, (j + 0.5) * proj.cellM] }
  }
  const toLonLat = ([x, y]: Point): LonLat => unproject(proj, x, y)

  const departure = xy(request.origin)
  const home = request.home ? xy(request.home) : null
  const avoid = request.avoid ?? []
  const allowed = (cell: Cell) => (!home || dist(cell.at, home) >= HOME_GUARD_M) && !nearAvoidCircle(toLonLat(cell.at), avoid)
  const inUnit = [...unit.runnable].map(cellAt).filter(allowed)
  if (inUnit.length === 0) return { kind: 'tour', vias: request.seeds.map(() => []) }

  const perimeter = request.distanceM / STREET_DETOUR
  const nearest = Math.min(...inUnit.map((cell) => dist(departure, cell.at)))
  if (2 * nearest > perimeter) {
    return { kind: 'tooFar', minKm: Math.ceil(((2 * nearest + 2 * proj.cellM) * STREET_DETOUR) / 500) / 2 }
  }

  const fresh = inUnit.filter((cell) => !visited.has(cell.key))
  const unitPool = fresh.length >= 2 ? fresh : inUnit
  // A quartier too small for the distance stretches the loop through new ground around it.
  const around: Cell[] = []
  for (const [key, owner] of index.runnableUnit) {
    if (owner === unitIdx || visited.has(key)) continue
    const cell = cellAt(key)
    if (dist(departure, cell.at) <= perimeter / 2 && allowed(cell)) around.push(cell)
  }

  const vias = request.seeds.map((seed): LonLat[] => {
    const next = random(seed)
    const pick = <T>(list: readonly T[]): T => list[Math.floor(next() * list.length)]!
    let best: [Cell, Cell] | null = null
    let bestCost = Infinity
    for (let k = 0; k < DRAWS; k++) {
      const a = pick(unitPool)
      const outside = around.length > 0 && next() < 0.5
      const b = outside ? pick(around) : pick(unitPool)
      if (a.key === b.key) continue
      const cost = tourCost(departure, a.at, b.at, perimeter, proj.cellM) + (outside ? OUTSIDE_UNIT_COST : 0)
      if (cost < bestCost) {
        bestCost = cost
        best = [a, b]
      }
    }
    return (best ?? [unitPool[0]!]).map((cell) => toLonLat(cell.at))
  })
  return { kind: 'tour', vias }
}
