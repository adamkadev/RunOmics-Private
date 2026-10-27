import { describe, it, expect } from 'vitest'
import { buildAreaIndex } from '../coverage'
import {
  ROUTE_W_BUSY_ON,
  ROUTE_W_NEW_OFF,
  ROUTE_W_NEW_ON,
  ROUTE_W_TRAFFIC,
  measureRoute,
  routeStart,
  scoreRoutes,
} from '../routeScore'
import type { SessionDay } from '../climbBudget'
import type { RouteCandidate, RoutePreferences } from '../types'
import { projectX, projectY } from '../grid'
import { PROJ, areaFile, at, cells, rect, testArea, unit } from './areaFixture'

const index = buildAreaIndex(testArea())
/** Row 0 (y 0–150 m) has been run, from x 0 to 1200 m. */
const visited: ReadonlySet<number> = new Set(cells(0, 7, 0, 0))

const OFF: RoutePreferences = { avoidBusyRoads: false, newStreetsFirst: false, flatForReps: false }

type Ranges = [number, number, number][]

function candidate(
  seed: number,
  pointsM: [number, number][],
  {
    distanceM = 1200,
    waytypes = [] as Ranges,
    surfaces = [] as Ranges,
    steepness = [] as Ranges,
    ascentM = null as number | null,
    ele = false,
  } = {},
): RouteCandidate {
  return {
    seed,
    coordinates: pointsM.map(([x, y], k) => (ele ? [...at(x, y), 200 + k] : at(x, y))),
    distanceM,
    durationS: distanceM / 3,
    ascentM,
    descentM: null,
    waytypes,
    surfaces,
    steepness,
  }
}

/** Out along row 0 and back: all known ground. */
const known = (seed = 1, opts = {}) => candidate(seed, [[0, 75], [600, 75], [0, 75]], opts)
/** The same shape along row 6: all new. */
const fresh = (seed = 2, opts = {}) => candidate(seed, [[0, 975], [600, 975], [0, 975]], opts)
/**
 * A 300 × 890 m box: its first side runs along row 0, the rest through new
 * ground. The long sides are single 890 m steps, as a provider draws a
 * straight avenue; each is cut into 12 pieces, the first of them known.
 */
const box = (seed = 3, opts = {}) => candidate(seed, [[75, 75], [375, 75], [375, 965], [75, 965], [75, 75]], { distanceM: 2380, ...opts })
const BOX_NEW_SHARE = (2 * (890 - 890 / 12) + 300) / 2380

describe('measureRoute', () => {
  it('measures new ground by the cell of each piece midpoint', () => {
    expect(measureRoute(index, visited, known()).newShare).toBe(0)
    expect(measureRoute(index, visited, fresh()).newShare).toBe(1)
    expect(measureRoute(index, visited, box()).newShare).toBeCloseTo(BOX_NEW_SHARE, 6)
  })

  it('flags each step new when at least half of it is', () => {
    expect(measureRoute(index, visited, box()).newSteps).toEqual([false, true, true, true])
    expect(measureRoute(index, visited, known()).newSteps).toEqual([false, false])
  })

  it('interpolates long steps instead of treating them as gaps', () => {
    expect(measureRoute(index, visited, box()).lengthM).toBeCloseTo(2380, 6)
  })

  it('weighs state roads fully and roads by half, over the length', () => {
    expect(measureRoute(index, visited, known(1, { waytypes: [[0, 1, 1], [1, 2, 3]] })).busyShare).toBeCloseTo(0.5, 9)
    expect(measureRoute(index, visited, known(1, { waytypes: [[0, 2, 2]] })).busyShare).toBeCloseTo(0.5, 9)
    expect(measureRoute(index, visited, box(3, { waytypes: [[0, 1, 1], [1, 4, 4]] })).busyShare).toBeCloseTo(300 / 2380, 9)
    expect(measureRoute(index, visited, known()).busyShare).toBe(0)
  })

  it('reads [lon, lat, ele] coordinates', () => {
    expect(measureRoute(index, visited, box(3, { ele: true })).newShare).toBeCloseTo(BOX_NEW_SHARE, 6)
  })

  it('gives a repeated vertex the flag of where it stands', () => {
    const stutter = candidate(4, [[75, 75], [75, 75], [75, 965], [75, 965]])

    expect(measureRoute(index, visited, stutter).newSteps).toEqual([false, true, true])
  })

  it('measures an empty route as nothing', () => {
    expect(measureRoute(index, visited, candidate(5, []))).toEqual({
      lengthM: 0,
      newShare: 0,
      busyShare: 0,
      trafficFreeShare: 0,
      trailShare: 0,
      steepUpShare: 0,
      steepDownShare: 0,
      steepClimbM: 0,
      newSteps: [],
    })
  })

  it('counts paths and tracks without a paved surface, soft ground anywhere and steps as trail', () => {
    const trail = (waytype: number, surface: number) => measureRoute(index, visited, known(1, { waytypes: [[0, 2, waytype]], surfaces: [[0, 2, surface]] })).trailShare

    expect(trail(4, 0)).toBe(1)
    expect(trail(5, 12)).toBe(1)
    expect(trail(7, 17)).toBe(1)
    expect(trail(8, 3)).toBe(1)
    expect(trail(5, 10)).toBe(0.5)
    expect(trail(4, 3)).toBe(0)
    expect(trail(7, 0)).toBe(0)
    expect(trail(3, 0)).toBe(0)
  })

  it('measures steep climbs and descents from 7 %, in full from 10 %', () => {
    const measure = measureRoute(index, visited, known(1, { steepness: [[0, 1, 4], [1, 2, -3]] }))

    expect(measure.steepUpShare).toBeCloseTo(0.5, 9)
    expect(measure.steepDownShare).toBeCloseTo(0.25, 9)
    expect(measure.steepClimbM).toBeCloseTo(600, 6)
  })
})

describe('scoreRoutes', () => {
  it('scores |d − target| / target + wNew · (1 − new) + wBusy · busy', () => {
    const [scored] = scoreRoutes(index, visited, [known(1, { distanceM: 5500, waytypes: [[0, 2, 1]] })], 5000, {
      avoidBusyRoads: true,
      newStreetsFirst: true,
      flatForReps: false,
    })

    expect(scored!.score).toBeCloseTo(0.1 + ROUTE_W_NEW_ON * 1 + ROUTE_W_BUSY_ON * 1, 9)
    expect(scored!.newShare).toBe(0)
    expect(scored!.busyShare).toBeCloseTo(1, 9)
  })

  it('prefers the loop closest to the target distance', () => {
    const ranked = scoreRoutes(index, visited, [known(1, { distanceM: 5600 }), known(2, { distanceM: 4900 })], 5000, OFF)

    expect(ranked.map((r) => r.candidate.seed)).toEqual([2, 1])
    expect(ranked[1]!.score - ranked[0]!.score).toBeCloseTo(0.12 - 0.02, 9)
  })

  it('prefers new ground, more so with "New streets first"', () => {
    const ranked = scoreRoutes(index, visited, [known(1), fresh(2)], 1200, OFF)

    expect(ranked.map((r) => r.candidate.seed)).toEqual([2, 1])
    expect(ranked[1]!.score).toBeCloseTo(ROUTE_W_NEW_OFF, 9)
  })

  it('lets the toggles change the order', () => {
    const newButBusy = fresh(1, { distanceM: 1200, waytypes: [[0, 2, 1]] })
    const knownAndQuiet = known(2, { distanceM: 1200, waytypes: [[0, 2, 7]] })
    const order = (prefs: RoutePreferences) =>
      scoreRoutes(index, visited, [newButBusy, knownAndQuiet], 1200, prefs).map((r) => r.candidate.seed)

    expect(order({ avoidBusyRoads: true, newStreetsFirst: false, flatForReps: false })).toEqual([2, 1])
    expect(order({ avoidBusyRoads: false, newStreetsFirst: true, flatForReps: false })).toEqual([1, 2])
    expect(order({ avoidBusyRoads: false, newStreetsFirst: false, flatForReps: false })).toEqual([1, 2])
    expect(order({ avoidBusyRoads: true, newStreetsFirst: true, flatForReps: false })).toEqual([2, 1])
  })

  it('with Flat for the reps, puts a flat loop on paths before a hilly one on streets', () => {
    const hillyStreets = fresh(1, { distanceM: 1200, waytypes: [[0, 2, 3]] })
    const flatPaths = known(2, { distanceM: 1200, waytypes: [[0, 2, 7]] })
    hillyStreets.ascentM = 12
    flatPaths.ascentM = 2
    const order = (flatForReps: boolean) =>
      scoreRoutes(index, visited, [hillyStreets, flatPaths], 1200, { avoidBusyRoads: false, newStreetsFirst: false, flatForReps }).map((r) => r.candidate.seed)

    expect(order(false)).toEqual([1, 2])
    expect(order(true)).toEqual([2, 1])
  })

  it('puts a new loop on muddy forest tracks before a known street one in daylight, on any day, and after it in the dark', () => {
    const muddy = fresh(1, { waytypes: [[0, 2, 5]], surfaces: [[0, 2, 12]] })
    const streets = known(2, { waytypes: [[0, 2, 3]], surfaces: [[0, 2, 3]] })
    const order = (day: SessionDay, dark = false) =>
      scoreRoutes(index, visited, [muddy, streets], 1200, { ...OFF, newStreetsFirst: true }, { day, dark }).map((r) => r.candidate.seed)

    expect(order({ session: 'easy', beforeQuality: false })).toEqual([1, 2])
    expect(order({ session: 'easy', beforeQuality: true })).toEqual([1, 2])
    expect(order({ session: 'quality', beforeQuality: false })).toEqual([1, 2])
    expect(order({ session: 'easy', beforeQuality: false }, true)).toEqual([2, 1])
  })

  it('ignores a trailsOk field from an older client', () => {
    const muddy = fresh(1, { waytypes: [[0, 2, 5]], surfaces: [[0, 2, 12]] })
    const stale = { ...OFF, trailsOk: false } as RoutePreferences

    expect(scoreRoutes(index, visited, [muddy], 1200, stale)[0]!.score).toBe(scoreRoutes(index, visited, [muddy], 1200, OFF)[0]!.score)
  })

  it('with Flat for the reps, counts a path as traffic-free only when it is paved', () => {
    const unpaved = known(1, { waytypes: [[0, 2, 4]] })
    const paved = known(2, { waytypes: [[0, 2, 4]], surfaces: [[0, 2, 3]] })
    const [first, second] = scoreRoutes(index, visited, [unpaved, paved], 1200, { ...OFF, flatForReps: true })

    expect(first!.candidate.seed).toBe(2)
    expect(second!.score - first!.score).toBeCloseTo(ROUTE_W_TRAFFIC, 9)
  })

  it('puts a loop over the day’s climb budget behind one inside it with less new ground', () => {
    const hilly = fresh(1, { ascentM: 36 })
    const rolling = known(2, { ascentM: 12 })
    const order = (session: 'easy' | 'recovery') =>
      scoreRoutes(index, visited, [hilly, rolling], 1200, { ...OFF, newStreetsFirst: true }, { day: { session, beforeQuality: false }, dark: false }).map(
        (r) => r.candidate.seed,
      )

    expect(order('easy')).toEqual([2, 1])
    expect(scoreRoutes(index, visited, [fresh(1, { ascentM: 22 }), rolling], 1200, { ...OFF, newStreetsFirst: true }).map((r) => r.candidate.seed)).toEqual([1, 2])
    expect(order('recovery')).toEqual([2, 1])
  })

  it('keeps the lower seed first on a tie', () => {
    const ranked = scoreRoutes(index, visited, [known(9), known(4), known(7)], 1200, OFF)

    expect(ranked.map((r) => r.candidate.seed)).toEqual([4, 7, 9])
  })

  it('falls back to the measured length when the provider gives none', () => {
    const [scored] = scoreRoutes(index, visited, [known(1, { distanceM: 0 })], 1200, OFF)

    expect(scored!.score).toBeCloseTo(ROUTE_W_NEW_OFF, 6)
  })

  it('returns the new-step flags with each route', () => {
    const [scored] = scoreRoutes(index, visited, [box()], 2380, OFF)

    expect(scored!.newSteps).toEqual([false, true, true, true])
  })
})

describe('routeStart', () => {
  const area = buildAreaIndex(
    areaFile([
      unit('test-r', 'R', rect(0, 0, 600, 600), cells(0, 3, 0, 3, [[1, 0]]), { label: at(500, 500) }),
      unit('test-empty', 'Empty', rect(600, 0, 900, 300), []),
    ]),
  )

  function expectAt(point: [number, number] | null, x: number, y: number) {
    const [lon, lat] = at(x, y)
    expect(point![0]).toBeCloseTo(lon, 9)
    expect(point![1]).toBeCloseTo(lat, 9)
  }

  it('is the centre of the runnable cell nearest the label', () => {
    expectAt(routeStart(area, 'test-r'), 525, 525)
  })

  it('moves off a cell under a spot to the nearest clear one', () => {
    const start = routeStart(area, 'test-r', [[...at(525, 525), 40]])!
    const metres = Math.hypot(projectX(PROJ, start[0]) - 525, projectY(PROJ, start[1]) - 525)
    expect(metres).toBeCloseTo(150, 6)
  })

  it('keeps the nearest cell when every cell is under a spot', () => {
    expectAt(routeStart(area, 'test-r', [[...at(300, 300), 250]]), 525, 525)
  })

  it('skips the cells without a way, even the one holding the label', () => {
    // The label sits in (1,0), which is not runnable; (0,0) is the nearest that is.
    const offWay = buildAreaIndex(areaFile([unit('test-r', 'R', rect(0, 0, 600, 600), cells(0, 3, 0, 3, [[1, 0]]), { label: at(200, 60) })]))
    expectAt(routeStart(offWay, 'test-r'), 75, 75)
  })

  it('is not home’s cell in the quartier home is in: the provider is never sent home', () => {
    // Home (60, 60) is in R's runnable corner cell (0,0); the start is the label's cell, across the quartier.
    const start = routeStart(area, 'test-r')!
    const metres = Math.hypot(projectX(PROJ, start[0]) - 60, projectY(PROJ, start[1]) - 60)
    expect(metres).toBeGreaterThan(600)
  })

  it('is null for an unknown unit or one without runnable cells', () => {
    expect(routeStart(area, 'nope')).toBeNull()
    expect(routeStart(area, 'test-empty')).toBeNull()
  })
})
