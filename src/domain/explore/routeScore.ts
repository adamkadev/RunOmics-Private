import type { AreaIndex } from './coverage'
import { MAX_STEP_M, cellIndices, cellCentre, cellOf, cellOfXY, projectX, projectY, sampleLine } from './grid'
import type { RouteCandidate, RoutePreferences, ScoredRoute } from './types'

/**
 * score = |d − target|/target + wNew·(1 − new) + wBusy·busy, and with "Flat for the reps" + wClimb·hilly + wTraffic·(1 − trafficFree).
 * The toggles only move weights, so every candidate stays comparable and Regenerate walks one ranking.
 */

export const ROUTE_W_DISTANCE = 1
/** Weight on known ground with "New streets first" on, and with it off. */
export const ROUTE_W_NEW_ON = 0.6
export const ROUTE_W_NEW_OFF = 0.15
/** Weight on busy roads with "Avoid busy roads" on; off, they are not scored at all. */
export const ROUTE_W_BUSY_ON = 0.8
/** With "Flat for the reps": weight on climb, full at this many metres a km, and on ground shared with traffic. */
export const ROUTE_W_CLIMB = 0.5
export const ROUTE_CLIMB_FULL_M_PER_KM = 20
export const ROUTE_W_TRAFFIC = 0.4

/** ORS waytypes: 1 state road, 2 road; streets (3) and everything quieter count nothing. */
const BUSY_WEIGHT: Readonly<Record<number, number>> = { 1: 1, 2: 0.5 }
/** ORS waytypes with no traffic to cross: path, track, cycleway, footway. */
const TRAFFIC_FREE: Readonly<Record<number, number>> = { 4: 1, 5: 1, 6: 1, 7: 1 }

export interface RouteMeasure {
  /** Measured on the area grid, which is what the shares are fractions of. */
  lengthM: number
  newShare: number
  busyShare: number
  /** Share of the length on paths, tracks, cycleways and footways. */
  trafficFreeShare: number
  newSteps: boolean[]
}

/**
 * Per-step busy weights from the ORS `waytype` ranges. A range
 * [from, to, value] covers coordinates from..to, so steps from..to−1.
 */
function stepWeights(steps: number, waytypes: RouteCandidate['waytypes'], weightOf: Readonly<Record<number, number>> = BUSY_WEIGHT): Float64Array {
  const weights = new Float64Array(steps)
  for (const [from, to, value] of waytypes) {
    const w = weightOf[value] ?? 0
    if (!w) continue
    const end = Math.min(steps, Math.floor(to))
    for (let s = Math.max(0, Math.floor(from)); s < end; s++) weights[s] = w
  }
  return weights
}

/**
 * A piece is new when the cell of its midpoint holds no sample of any run.
 * Unlike a run there is no gap rule: the provider draws a long straight avenue
 * as one step, and it is still a street.
 */
export function measureRoute(index: AreaIndex, visited: ReadonlySet<number>, candidate: RouteCandidate): RouteMeasure {
  const { proj } = index
  const cellM = proj.cellM
  const coords = candidate.coordinates
  const steps = Math.max(0, coords.length - 1)
  const busy = stepWeights(steps, candidate.waytypes)
  const free = stepWeights(steps, candidate.waytypes, TRAFFIC_FREE)
  const newSteps = new Array<boolean>(steps).fill(false)
  const pair = new Float64Array(4)
  let lengthM = 0
  let newM = 0
  let busyM = 0
  let freeM = 0

  for (let s = 0; s < steps; s++) {
    const a = coords[s]!
    const b = coords[s + 1]!
    pair[0] = a[0]!
    pair[1] = a[1]!
    pair[2] = b[0]!
    pair[3] = b[1]!
    if (!pair.every(Number.isFinite)) continue

    let stepM = 0
    let stepNewM = 0
    let px = 0
    let py = 0
    sampleLine(pair, proj, MAX_STEP_M, Infinity, (x, y, piece) => {
      if (piece > 0) {
        stepM += piece
        if (!visited.has(cellOfXY(cellM, (px + x) / 2, (py + y) / 2))) stepNewM += piece
      }
      px = x
      py = y
    })

    // A zero-length step (a repeated vertex) takes the flag of where it stands.
    newSteps[s] = stepM > 0 ? stepNewM >= stepM / 2 : !visited.has(cellOf(proj, pair[0]!, pair[1]!))
    lengthM += stepM
    newM += stepNewM
    busyM += busy[s]! * stepM
    freeM += free[s]! * stepM
  }

  return {
    lengthM,
    newShare: lengthM > 0 ? newM / lengthM : 0,
    busyShare: lengthM > 0 ? busyM / lengthM : 0,
    trafficFreeShare: lengthM > 0 ? freeM / lengthM : 0,
    newSteps,
  }
}

export function routeScore(
  measure: Pick<RouteMeasure, 'newShare' | 'busyShare' | 'trafficFreeShare'>,
  distanceM: number,
  targetM: number,
  prefs: RoutePreferences,
  climbM: number | null = null,
): number {
  const wNew = prefs.newStreetsFirst ? ROUTE_W_NEW_ON : ROUTE_W_NEW_OFF
  const wBusy = prefs.avoidBusyRoads ? ROUTE_W_BUSY_ON : 0
  const off = targetM > 0 ? Math.abs(distanceM - targetM) / targetM : 0
  const base = ROUTE_W_DISTANCE * off + wNew * (1 - measure.newShare) + wBusy * measure.busyShare
  if (!prefs.flatForReps) return base
  const climbPerKm = climbM !== null && distanceM > 0 ? climbM / (distanceM / 1000) : 0
  const hilly = Math.min(1, climbPerKm / ROUTE_CLIMB_FULL_M_PER_KM)
  return base + ROUTE_W_CLIMB * hilly + ROUTE_W_TRAFFIC * (1 - measure.trafficFreeShare)
}

/**
 * `visited` holds every run's cells, whatever the map filters say: new ground
 * means ground never run. Ties keep the lower seed first, so a ranking never
 * reshuffles between renders.
 */
export function scoreRoutes(
  index: AreaIndex,
  visited: ReadonlySet<number>,
  candidates: readonly RouteCandidate[],
  targetM: number,
  prefs: RoutePreferences,
): ScoredRoute[] {
  return candidates
    .map((candidate): ScoredRoute => {
      const measure = measureRoute(index, visited, candidate)
      // The provider's own distance is what the card shows, so it is what
      // has to match the target; ours is only the fallback.
      const distanceM =
        Number.isFinite(candidate.distanceM) && candidate.distanceM > 0 ? candidate.distanceM : measure.lengthM
      return {
        candidate,
        score: routeScore(measure, distanceM, targetM, prefs, candidate.ascentM),
        newShare: measure.newShare,
        busyShare: measure.busyShare,
        newSteps: measure.newSteps,
      }
    })
    .sort((a, b) => a.score - b.score || a.candidate.seed - b.candidate.seed)
}

/**
 * The centre of the runnable cell nearest the unit's label: a public grid point
 * on a way the provider can route from. Privacy: home is deliberately not a
 * parameter, since starts that lean towards home pin it down across requests;
 * the label says only which quartier the athlete wants to run in.
 */
export function routeStart(index: AreaIndex, unitId: string): [number, number] | null {
  const unit = index.units.find((u) => u.id === unitId)
  if (!unit || unit.runnable.size === 0) return null

  const { proj } = index
  const [lon, lat] = unit.label
  const rx = projectX(proj, lon)
  const ry = projectY(proj, lat)
  let nearest = -1
  let nearestD = Infinity
  // The cells arrive sorted, so a tie keeps the lowest key.
  for (const cell of unit.runnable) {
    const [i, j] = cellIndices(cell)
    const d = Math.hypot((i + 0.5) * proj.cellM - rx, (j + 0.5) * proj.cellM - ry)
    if (d < nearestD) {
      nearestD = d
      nearest = cell
    }
  }
  return cellCentre(proj, nearest)
}
