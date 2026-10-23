import type { AreaIndex } from './coverage'
import { MAX_STEP_M, cellIndices, cellCentre, cellOf, cellOfXY, projectX, projectY, sampleLine } from './grid'
import type { RouteCandidate, RoutePreferences, ScoredRoute } from './types'

/**
 * Picks the loop to show from a batch the routing provider returned. Lower
 * scores are better:
 *
 *   score = |distance − target| / target
 *         + wNew · (1 − newShare)
 *         + wBusy · busyShare
 *
 * Distance always matters most: a loop 20% off target costs as much as one
 * entirely on known streets with "New streets first" on. The toggles only
 * move the weights, so every candidate stays comparable and Regenerate can
 * walk down the same ranking.
 */

export const ROUTE_W_DISTANCE = 1
/** Weight on known ground with "New streets first" on, and with it off. */
export const ROUTE_W_NEW_ON = 0.6
export const ROUTE_W_NEW_OFF = 0.15
/** Weight on busy roads with "Avoid busy roads" on; off, they are not scored at all. */
export const ROUTE_W_BUSY_ON = 0.8

/**
 * How busy each ORS waytype counts: a state road fully, a plain road half.
 * Streets (3) and everything quieter count nothing.
 */
const BUSY_WEIGHT: Readonly<Record<number, number>> = { 1: 1, 2: 0.5 }

export interface RouteMeasure {
  /** Measured on the area grid, which is what the shares are fractions of. */
  lengthM: number
  newShare: number
  busyShare: number
  newSteps: boolean[]
}

/**
 * Per-step busy weights from the ORS `waytype` ranges. A range
 * [from, to, value] covers coordinates from..to, so steps from..to−1.
 */
function busyWeights(steps: number, waytypes: RouteCandidate['waytypes']): Float64Array {
  const weights = new Float64Array(steps)
  for (const [from, to, value] of waytypes) {
    const w = BUSY_WEIGHT[value] ?? 0
    if (!w) continue
    const end = Math.min(steps, Math.floor(to))
    for (let s = Math.max(0, Math.floor(from)); s < end; s++) weights[s] = w
  }
  return weights
}

/**
 * How much of a loop is new ground and how much runs on busy roads.
 *
 * Each coordinate step is cut into pieces of at most 75 m, like a run's
 * track, and a piece is new when the cell of its midpoint holds no sample of
 * any run. Unlike a run there is no gap rule: the provider draws a long
 * straight avenue as one step, and it is still a street.
 */
export function measureRoute(index: AreaIndex, visited: ReadonlySet<number>, candidate: RouteCandidate): RouteMeasure {
  const { proj } = index
  const cellM = proj.cellM
  const coords = candidate.coordinates
  const steps = Math.max(0, coords.length - 1)
  const busy = busyWeights(steps, candidate.waytypes)
  const newSteps = new Array<boolean>(steps).fill(false)
  const pair = new Float64Array(4)
  let lengthM = 0
  let newM = 0
  let busyM = 0

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
  }

  return {
    lengthM,
    newShare: lengthM > 0 ? newM / lengthM : 0,
    busyShare: lengthM > 0 ? busyM / lengthM : 0,
    newSteps,
  }
}

/** The score of one measured loop; see the formula at the top. */
export function routeScore(
  measure: Pick<RouteMeasure, 'newShare' | 'busyShare'>,
  distanceM: number,
  targetM: number,
  prefs: RoutePreferences,
): number {
  const wNew = prefs.newStreetsFirst ? ROUTE_W_NEW_ON : ROUTE_W_NEW_OFF
  const wBusy = prefs.avoidBusyRoads ? ROUTE_W_BUSY_ON : 0
  const off = targetM > 0 ? Math.abs(distanceM - targetM) / targetM : 0
  return ROUTE_W_DISTANCE * off + wNew * (1 - measure.newShare) + wBusy * measure.busyShare
}

/**
 * Every candidate scored, best first. `visited` is the union of the cells of
 * every run (all of them, whatever the map filters say): new ground means
 * ground never run, not ground outside this year's runs. Ties keep the
 * lower seed first, so a ranking never reshuffles between renders.
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
        score: routeScore(measure, distanceM, targetM, prefs),
        newShare: measure.newShare,
        busyShare: measure.busyShare,
        newSteps: measure.newSteps,
      }
    })
    .sort((a, b) => a.score - b.score || a.candidate.seed - b.candidate.seed)
}

/**
 * Where a loop into a unit starts: the centre of its runnable cell nearest
 * the unit's label. A runnable cell is on a street or path, and its centre is
 * a point of the public grid, so the provider is sent somewhere inside the
 * quartier, on a way it can route from.
 *
 * It reads the area file and nothing else: home is not even a parameter.
 * Starting at the cell nearest home sent the provider home's own cell for
 * the quartier home is in, and for the others the edge cell facing home;
 * asked for one quartier after another, those edges pin home down (each says
 * on which side of that quartier home lies). The label is the same public
 * point for anyone, so a request says which quartier the athlete wants to
 * run in and nothing about where they live. The map draws the way from home
 * to the start on the device.
 *
 * Null for an unknown unit or one without a runnable cell.
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
