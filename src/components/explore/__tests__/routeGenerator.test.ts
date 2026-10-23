import { describe, expect, it } from 'vitest'
import type { ScoredRoute } from '@/domain/explore/types'
import { ROUTE_KM_MAX, ROUTE_KM_MIN } from '../exploreHref'
import {
  FALLBACK_ROUTE_KM,
  ROUTE_BATCH,
  batchSeeds,
  canStepDown,
  canStepUp,
  generatorBack,
  generatorPlan,
  generatorTarget,
  lineBounds,
  medianOf,
  routeStats,
  stepRouteKm,
  unionBounds,
  type ExplorePlan,
} from '../routeGenerator'

const PLAN: ExplorePlan = { date: '2026-10-22', label: 'Easy · 8 km + 6 strides', distanceM: 9462, paceSecPerKm: 353 }

describe('generatorTarget: what the generator opens on', () => {
  it('takes the link’s quartier, distance, pace and origin first', () => {
    expect(generatorTarget({ quartier: 'metz-1', km: 10.5, pace: 310, from: 'plan' }, { plan: PLAN, medianKm: 7, medianPace: 340 })).toEqual({
      unitId: 'metz-1',
      km: 10.5,
      pace: 310,
      from: 'plan',
    })
  })

  it('then today’s plan: its whole distance on the 0.5 km grid, its pace', () => {
    expect(generatorTarget({ quartier: null, km: null, pace: null, from: null }, { plan: PLAN, medianKm: 7, medianPace: 340 })).toEqual({
      unitId: null,
      km: 9.5,
      pace: 353,
      from: null,
    })
  })

  it('then the usual run here, then 8 km; "Plan a run" names its quartier', () => {
    expect(generatorTarget(null, { unitId: 'metz-2', plan: null, medianKm: 6.3, medianPace: 345 })).toEqual({ unitId: 'metz-2', km: 6.5, pace: 345, from: null })
    expect(generatorTarget(null, { plan: null, medianKm: null, medianPace: null })).toEqual({ unitId: null, km: FALLBACK_ROUTE_KM, pace: null, from: null })
    // A plan with no distance gives no distance; its pace still counts.
    expect(generatorTarget(null, { plan: { ...PLAN, distanceM: null }, medianKm: 5, medianPace: 300 })).toMatchObject({ km: 5, pace: 353 })
  })

  it('keeps the distance inside the stepper’s bounds', () => {
    expect(generatorTarget(null, { plan: null, medianKm: 0.8, medianPace: null }).km).toBe(ROUTE_KM_MIN)
    expect(generatorTarget(null, { plan: { ...PLAN, distanceM: 42195 }, medianKm: null, medianPace: null }).km).toBe(ROUTE_KM_MAX)
  })
})

describe('generatorPlan: the session the generator plans for', () => {
  const SAT: ExplorePlan = { date: '2026-10-24', label: 'Long run', distanceM: 16000, paceSecPerKm: 345 }
  it('is the linked day’s, else today’s, else none', () => {
    expect(generatorPlan([PLAN, SAT], { date: '2026-10-24', km: 16 }, '2026-10-22')).toBe(SAT)
    expect(generatorPlan([PLAN, SAT], null, '2026-10-22')).toBe(PLAN)
    expect(generatorPlan([PLAN, SAT], { date: null, km: null }, '2026-10-22')).toBe(PLAN)
    // A linked day with nothing planned is not today's plan.
    expect(generatorPlan([PLAN, SAT], { date: '2026-10-30', km: 16 }, '2026-10-22')).toBeNull()
    expect(generatorPlan([PLAN], null, null)).toBeNull()
  })

  it('is none for a link with a distance but no day: never another session’s name or pace', () => {
    expect(generatorPlan([PLAN, SAT], { date: null, km: 16 }, '2026-10-22')).toBeNull()
  })
})

describe('the stepper', () => {
  it('moves by 0.5 km within 2–30 km', () => {
    expect(stepRouteKm(8, 1)).toBe(8.5)
    expect(stepRouteKm(8, -1)).toBe(7.5)
    expect(stepRouteKm(ROUTE_KM_MIN, -1)).toBe(ROUTE_KM_MIN)
    expect(stepRouteKm(ROUTE_KM_MAX, 1)).toBe(ROUTE_KM_MAX)
    expect([canStepDown(ROUTE_KM_MIN), canStepDown(2.5), canStepUp(ROUTE_KM_MAX), canStepUp(29.5)]).toEqual([false, true, false, true])
  })
})

describe('batchSeeds', () => {
  it('is five seeds from the base', () => {
    expect(batchSeeds(1)).toEqual([1, 2, 3, 4, 5])
    expect(batchSeeds(1 + ROUTE_BATCH)).toEqual([6, 7, 8, 9, 10])
  })
})

describe('medianOf', () => {
  it('is the median of the runs picked, skipping missing and empty values', () => {
    const runs = [{ v: 5 }, { v: null }, { v: 7 }, { v: 0 }, { v: 6 }]
    expect(medianOf(runs, [0, 1, 2, 3, 4], (r) => r.v)).toBe(6)
    expect(medianOf(runs, [1, 3, 9], (r) => r.v)).toBeNull()
  })
})

describe('generatorBack: the back button', () => {
  it('goes back through history to the page just left, when it is the origin', () => {
    expect(generatorBack('plan', { path: '/plan', isImmediate: true })).toEqual({ kind: 'back' })
    expect(generatorBack('profile', { path: '/profile?x=1', isImmediate: true })).toEqual({ kind: 'back' })
  })

  it('opens the page otherwise: a cold start, or another page in between', () => {
    expect(generatorBack('plan', null)).toEqual({ kind: 'push', href: '/plan' })
    expect(generatorBack('plan', { path: '/plan', isImmediate: false })).toEqual({ kind: 'push', href: '/plan' })
    expect(generatorBack('profile', { path: '/plan', isImmediate: true })).toEqual({ kind: 'push', href: '/profile' })
  })

  it('closes the generator in place when it was opened on the map', () => {
    expect(generatorBack(null, { path: '/plan', isImmediate: true })).toEqual({ kind: 'close' })
  })
})

describe('routeStats', () => {
  const route = (over: Partial<ScoredRoute['candidate']> = {}, newShare = 0.936): ScoredRoute => ({
    candidate: { seed: 1, coordinates: [], distanceM: 8100, durationS: 0, ascentM: 23.6, descentM: 23.6, waytypes: [], ...over },
    score: 0,
    newShare,
    busyShare: 0,
    newSteps: [],
  })

  it('gives the loop’s distance, its time at the pace, its climb and how new it is', () => {
    expect(routeStats(route(), 350)).toEqual({ distanceKm: 8.1, timeSeconds: 2835, climbM: 24, newPct: 94 })
  })

  it('leaves the time and climb out when unknown', () => {
    expect(routeStats(route({ ascentM: null }), null)).toMatchObject({ timeSeconds: null, climbM: null })
  })
})

describe('bounds', () => {
  it('boxes a line and joins two boxes', () => {
    const line = lineBounds([[1, 2], [3, 0, 120], [2, 5]])
    expect(line).toEqual({ minLon: 1, minLat: 0, maxLon: 3, maxLat: 5 })
    expect(lineBounds([])).toBeNull()
    expect(unionBounds(line, { minLon: 0, minLat: 1, maxLon: 2, maxLat: 6 })).toEqual({ minLon: 0, minLat: 0, maxLon: 3, maxLat: 6 })
    expect(unionBounds(null, line)).toBe(line)
    expect(unionBounds(line, null)).toBe(line)
  })
})
