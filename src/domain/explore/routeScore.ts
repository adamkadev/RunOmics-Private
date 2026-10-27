import { nearAvoidCircle, type AvoidCircle } from './avoidSpots'
import { climbBudget, climbPerKm, NO_SESSION, type SessionDay } from './climbBudget'
import type { AreaIndex } from './coverage'
import { MAX_STEP_M, cellIndices, cellCentre, cellOf, cellOfXY, projectX, projectY, sampleLine } from './grid'
import type { RouteCandidate, RoutePreferences, ScoredRoute } from './types'

/** The terms are in docs/interface.md; the toggles only move weights, so Regenerate walks one ranking. */

export const ROUTE_W_DISTANCE = 1
/** Weight on known ground with "New streets first" on, and with it off. */
export const ROUTE_W_NEW_ON = 0.6
export const ROUTE_W_NEW_OFF = 0.15
/** Weight on busy roads with "Avoid busy roads" on; off, they are not scored at all. */
export const ROUTE_W_BUSY_ON = 0.8
/** Trails cost nothing in daylight; when the run starts or ends in the dark, a km of them outweighs any new ground. */
export const ROUTE_W_TRAIL_DARK = 6
/** On the share at 7 % or steeper, counted half below 10 %; descents too on a long run. */
export const ROUTE_W_STEEP = 1
/** Climb, full at ROUTE_CLIMB_FULL_M_PER_KM: light on every loop, heavier with "Flat for the reps". */
export const ROUTE_W_CLIMB = 0.25
export const ROUTE_W_CLIMB_FLAT = 0.5
export const ROUTE_CLIMB_FULL_M_PER_KM = 20
/** Per m/km over the day's budget: 3 m/km over outweighs all the new ground a loop can bring. */
export const ROUTE_W_OVER_BUDGET = 0.2
export const ROUTE_W_TRAFFIC = 0.4

const WAY_PATH = 4
const WAY_TRACK = 5
const WAY_STEPS = 8
const SURFACE_UNKNOWN = 0
/** ORS surfaces that turn to mud or give underfoot: unpaved, dirt, ground, ice, sand, woodchips, grass. */
const SOFT_SURFACES: ReadonlySet<number> = new Set([2, 11, 12, 13, 15, 16, 17])
/** Compacted and loose gravel: firm, but a forest track all the same. */
const FIRM_UNPAVED: ReadonlySet<number> = new Set([8, 10])

/** ORS waytypes: 1 state road, 2 road; streets (3) and everything quieter count nothing. */
const BUSY_WEIGHT: Readonly<Record<number, number>> = { 1: 1, 2: 0.5 }
/** ORS waytypes with no traffic to cross: path, track, cycleway, footway. */
const TRAFFIC_FREE: Readonly<Record<number, number>> = { 4: 1, 5: 1, 6: 1, 7: 1 }

/** Path or track with no surface tag counts as trail: a paved one is tagged, a forest one rarely is. */
export function trailWeight(waytype: number, surface: number): number {
  if (waytype === WAY_STEPS || SOFT_SURFACES.has(surface)) return 1
  if (waytype !== WAY_PATH && waytype !== WAY_TRACK) return 0
  if (surface === SURFACE_UNKNOWN) return 1
  return FIRM_UNPAVED.has(surface) ? 0.5 : 0
}

function steepWeight(grade: number): number {
  return grade >= 4 ? 1 : grade === 3 ? 0.5 : 0
}

export interface RouteMeasure {
  /** Measured on the area grid, which is what the shares are fractions of. */
  lengthM: number
  newShare: number
  busyShare: number
  /** Share of the length on paths, tracks, cycleways and footways that are not trail. */
  trafficFreeShare: number
  trailShare: number
  steepUpShare: number
  steepDownShare: number
  steepClimbM: number
  newSteps: boolean[]
}

/** One value per step from ORS ranges: [from, to, value] covers coordinates from..to, so steps from..to−1. */
function stepValues(steps: number, ranges: readonly (readonly [number, number, number])[] = []): Int8Array {
  const values = new Int8Array(steps)
  for (const [from, to, value] of ranges) {
    const end = Math.min(steps, Math.floor(to))
    for (let s = Math.max(0, Math.floor(from)); s < end; s++) values[s] = value
  }
  return values
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
  const ways = stepValues(steps, candidate.waytypes)
  const surfaces = stepValues(steps, candidate.surfaces)
  const grades = stepValues(steps, candidate.steepness)
  const newSteps = new Array<boolean>(steps).fill(false)
  const pair = new Float64Array(4)
  let lengthM = 0
  let newM = 0
  let busyM = 0
  let freeM = 0
  let trailM = 0
  let upM = 0
  let downM = 0
  let steepClimbM = 0

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
    const way = ways[s]!
    const trail = trailWeight(way, surfaces[s]!)
    lengthM += stepM
    newM += stepNewM
    busyM += (BUSY_WEIGHT[way] ?? 0) * stepM
    freeM += (TRAFFIC_FREE[way] ?? 0) * (1 - trail) * stepM
    trailM += trail * stepM
    upM += steepWeight(grades[s]!) * stepM
    downM += steepWeight(-grades[s]!) * stepM
    if (grades[s]! >= 4) steepClimbM += stepM
  }

  const share = (metres: number) => (lengthM > 0 ? metres / lengthM : 0)
  return {
    lengthM,
    newShare: share(newM),
    busyShare: share(busyM),
    trafficFreeShare: share(freeM),
    trailShare: share(trailM),
    steepUpShare: share(upM),
    steepDownShare: share(downM),
    steepClimbM,
    newSteps,
  }
}

export interface RouteContext {
  day: SessionDay
  dark: boolean
}

export const NO_ROUTE_CONTEXT: RouteContext = { day: NO_SESSION, dark: false }

export function routeScore(
  measure: Pick<RouteMeasure, 'newShare' | 'busyShare' | 'trafficFreeShare' | 'trailShare' | 'steepUpShare' | 'steepDownShare'>,
  distanceM: number,
  targetM: number,
  prefs: RoutePreferences,
  climbM: number | null = null,
  context: RouteContext = NO_ROUTE_CONTEXT,
): number {
  const budget = climbBudget(context.day)
  const wNew = prefs.newStreetsFirst ? ROUTE_W_NEW_ON : ROUTE_W_NEW_OFF
  const wBusy = prefs.avoidBusyRoads ? ROUTE_W_BUSY_ON : 0
  const wTrail = context.dark ? ROUTE_W_TRAIL_DARK : 0
  const off = targetM > 0 ? Math.abs(distanceM - targetM) / targetM : 0
  const perKm = climbPerKm(climbM, distanceM)
  const hilly = Math.min(1, perKm / ROUTE_CLIMB_FULL_M_PER_KM)
  const over = budget.maxMPerKm === null ? 0 : Math.max(0, perKm - budget.maxMPerKm)
  const steep = measure.steepUpShare + (budget.steepDescents ? measure.steepDownShare : 0)
  const base =
    ROUTE_W_DISTANCE * off +
    wNew * (1 - measure.newShare) +
    wBusy * measure.busyShare +
    wTrail * measure.trailShare +
    ROUTE_W_STEEP * steep +
    ROUTE_W_OVER_BUDGET * over
  if (!prefs.flatForReps) return base + ROUTE_W_CLIMB * hilly
  return base + ROUTE_W_CLIMB_FLAT * hilly + ROUTE_W_TRAFFIC * (1 - measure.trafficFreeShare)
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
  context: RouteContext = NO_ROUTE_CONTEXT,
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
        score: routeScore(measure, distanceM, targetM, prefs, candidate.ascentM, context),
        newShare: measure.newShare,
        busyShare: measure.busyShare,
        trailShare: measure.trailShare,
        steepClimbM: measure.steepClimbM,
        newSteps: measure.newSteps,
      }
    })
    .sort((a, b) => a.score - b.score || a.candidate.seed - b.candidate.seed)
}

/**
 * The centre of the runnable cell nearest the unit's label, clear of the spots: a public grid point
 * on a way the provider can route from. Privacy: home is deliberately not a
 * parameter, since starts that lean towards home pin it down across requests;
 * the label says only which quartier the athlete wants to run in.
 */
export function routeStart(index: AreaIndex, unitId: string, avoid: readonly AvoidCircle[] = []): [number, number] | null {
  const unit = index.units.find((u) => u.id === unitId)
  if (!unit || unit.runnable.size === 0) return null

  const { proj } = index
  const [lon, lat] = unit.label
  const rx = projectX(proj, lon)
  const ry = projectY(proj, lat)
  let nearest = -1
  let nearestD = Infinity
  let clear = -1
  let clearD = Infinity
  // The cells arrive sorted, so a tie keeps the lowest key.
  for (const cell of unit.runnable) {
    const [i, j] = cellIndices(cell)
    const d = Math.hypot((i + 0.5) * proj.cellM - rx, (j + 0.5) * proj.cellM - ry)
    if (d < nearestD) {
      nearestD = d
      nearest = cell
    }
    if (d < clearD && !nearAvoidCircle(cellCentre(proj, cell), avoid)) {
      clearD = d
      clear = cell
    }
  }
  // A quartier all under spots still gets its start: the loops that run through them are dropped afterwards.
  return cellCentre(proj, clear >= 0 ? clear : nearest)
}
