import { describe, it, expect } from 'vitest'
import { buildAreaIndex } from '../coverage'
import { projectX, projectY } from '../grid'
import { HOME_GUARD_M, STREET_DETOUR, planRoute, type LonLat, type RoutePlan } from '../routePlan'
import { PROJ, areaFile, at, cells, rect, unit } from './areaFixture'

const index = buildAreaIndex(
  areaFile([
    unit('test-home', 'Home', rect(0, 0, 1500, 1500), cells(0, 9, 0, 9)),
    unit('test-mid', 'Mid', rect(1500, 0, 3000, 1500), cells(10, 19, 0, 9)),
    unit('test-far', 'Far', rect(3000, 0, 4500, 1500), cells(20, 29, 0, 9)),
  ]),
)
const NONE: ReadonlySet<number> = new Set()
const HOME = at(300, 300)
const SEEDS = [1, 2, 3, 4, 5]

const metres = ([lon, lat]: LonLat): [number, number] => [projectX(PROJ, lon), projectY(PROJ, lat)]
const between = (a: LonLat, b: LonLat) => {
  const [ax, ay] = metres(a)
  const [bx, by] = metres(b)
  return Math.hypot(ax - bx, ay - by)
}

function tour(plan: RoutePlan | null) {
  if (plan?.kind !== 'tour') throw new Error(`expected a tour, got ${JSON.stringify(plan)}`)
  return plan
}

describe('planRoute', () => {
  it('goes through the quartier and back to the origin, about the distance asked', () => {
    const origin = at(2250, 750)
    const plan = tour(planRoute(index, NONE, { unitId: 'test-far', origin, home: HOME, distanceM: 6000, seeds: SEEDS }))
    for (const vias of plan.vias) {
      expect(vias).toHaveLength(2)
      expect(metres(vias[0]!)[0]).toBeGreaterThan(3000)
      const crow = between(origin, vias[0]!) + between(vias[0]!, vias[1]!) + between(vias[1]!, origin)
      expect(crow * STREET_DETOUR).toBeGreaterThan(6000 * 0.8)
      expect(crow * STREET_DETOUR).toBeLessThan(6000 * 1.2)
    }
    expect(new Set(plan.vias.map((v) => JSON.stringify(v))).size).toBeGreaterThan(1)
    expect(planRoute(index, NONE, { unitId: 'test-far', origin, home: HOME, distanceM: 6000, seeds: SEEDS })).toEqual(plan)
  })

  it('sends no via within the guard of home, even in the quartier home is in', () => {
    const plan = tour(planRoute(index, NONE, { unitId: 'test-home', origin: at(2250, 750), home: HOME, distanceM: 6000, seeds: SEEDS }))
    for (const via of plan.vias.flat()) expect(between(via, HOME)).toBeGreaterThanOrEqual(HOME_GUARD_M)
  })

  it('prefers the quartier cells no run has visited', () => {
    const visited = new Set(cells(20, 29, 0, 9, [[25, 5], [26, 6]]))
    const plan = tour(planRoute(index, visited, { unitId: 'test-far', origin: at(2250, 750), home: HOME, distanceM: 4000, seeds: SEEDS }))
    const firstVias = plan.vias.map((v) => metres(v[0]!).map((m) => Math.floor(m / 150)).join(','))
    for (const cell of firstVias) expect(['25,5', '26,6']).toContain(cell)
  })

  it('says how far a loop must be when the quartier is out of reach, and that distance reaches it', () => {
    const origin = at(450, 750)
    const ask = (distanceM: number) => planRoute(index, NONE, { unitId: 'test-far', origin, home: at(450, 1650), distanceM, seeds: SEEDS })
    const tooFar = ask(3000)
    expect(tooFar).toEqual({ kind: 'tooFar', minKm: expect.any(Number) })
    const minKm = (tooFar as { minKm: number }).minKm
    expect(minKm % 0.5).toBe(0)
    expect(tour(ask(minKm * 1000)).vias[0]).toHaveLength(2)
  })

  it('is null for an unknown unit', () => {
    expect(planRoute(index, NONE, { unitId: 'nope', origin: HOME, home: HOME, distanceM: 6000, seeds: SEEDS })).toBeNull()
  })
})
