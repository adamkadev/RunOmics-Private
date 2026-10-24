import { describe, it, expect } from 'vitest'
import {
  NO_UNIT,
  activityCells,
  aggregateCoverage,
  buildAreaIndex,
  cellOwner,
  unitState,
  type ActivityCoverageInput,
} from '../coverage'
import { cellKey, CELL_M } from '../grid'
import type { ExploreUnitFeature } from '../types'
import { areaFile, at, cells, line, rect, testArea, track, unit } from './areaFixture'

function run(id: string, date: string, pointsM: [number, number][], index = buildAreaIndex(testArea())): ActivityCoverageInput {
  return { id, date, ...activityCells(index, track(pointsM)) }
}

describe('buildAreaIndex', () => {
  it('maps every runnable cell to its unit', () => {
    const index = buildAreaIndex(testArea())

    expect(index.units.map((u) => u.runnable.size)).toEqual([14, 4, 0, 10])
    expect(index.runnableUnit.get(cellKey(0, 0))).toBe(0)
    expect(index.runnableUnit.get(cellKey(5, 0))).toBe(1)
    expect(index.runnableUnit.get(cellKey(5, 2))).toBe(3)
    expect(index.runnableUnit.has(cellKey(1, 0))).toBe(false)
  })

  it('keeps a cell listed twice with the first unit only', () => {
    const area = areaFile([
      unit('test-a', 'A', rect(0, 0, 300, 300), cells(0, 1, 0, 1)),
      unit('test-b', 'B', rect(300, 0, 600, 300), [...cells(0, 0, 0, 0), ...cells(2, 3, 0, 1)].sort((a, b) => a - b)),
    ])
    const index = buildAreaIndex(area)

    expect(index.runnableUnit.get(cellKey(0, 0))).toBe(0)
    expect(index.units[1]!.runnable.has(cellKey(0, 0))).toBe(false)
    expect(index.units[1]!.runnable.size).toBe(4)
  })
})

describe('cellOwner', () => {
  it('gives a runnable cell to the unit that lists it', () => {
    const index = buildAreaIndex(testArea())

    expect(cellOwner(index, cellKey(3, 1))).toBe(0)
  })

  it('gives any other cell to the unit holding its centre', () => {
    const index = buildAreaIndex(testArea())

    expect(cellOwner(index, cellKey(1, 0))).toBe(0)
    expect(cellOwner(index, cellKey(7, 3))).toBe(3)
    expect(cellOwner(index, cellKey(2, 4))).toBe(2)
  })

  it('gives a cell outside every unit to none', () => {
    const index = buildAreaIndex(testArea())

    expect(cellOwner(index, cellKey(-3, 0))).toBe(NO_UNIT)
    expect(cellOwner(index, cellKey(2, 40))).toBe(NO_UNIT)
  })

  it('gives a cell centred on a shared edge to exactly one unit', () => {
    // The edge at x = 75 m runs through the centres of column 0.
    const west = unit('test-west', 'West', rect(-300, 0, 75, 300), cells(-2, -1, 0, 1))
    const east = unit('test-east', 'East', rect(75, 0, 450, 300), cells(1, 2, 0, 1))
    const index = buildAreaIndex(areaFile([west, east]))

    for (const j of [0, 1]) {
      const owner = cellOwner(index, cellKey(0, j))
      expect([0, 1]).toContain(owner)
    }

    // And a run inside that cell is credited to that one unit only.
    const { metresByUnit } = activityCells(index, track(line(10, 75, 140, 75, 10)))
    const credited = Array.from(metresByUnit).filter((m) => m > 0)
    expect(credited).toHaveLength(1)
    expect(credited[0]).toBeCloseTo(130, 6)
  })
})

describe('activityCells', () => {
  it('lists every cell a sample falls in, inside the area or not, sorted', () => {
    const index = buildAreaIndex(testArea())
    const { cells: visited } = activityCells(index, track(line(-200, 75, 200, 75, 10)))

    expect(visited).toEqual([cellKey(-2, 0), cellKey(-1, 0), cellKey(0, 0), cellKey(1, 0)])
  })

  it('fills in a straight segment of (just under) 300 m', () => {
    // Exactly 300 m is on the limit, where a rounding in the projection
    // decides; real tracks never land on it.
    const index = buildAreaIndex(testArea())
    const { cells: visited } = activityCells(index, track([[10, 525], [309, 525]]))

    expect(visited).toEqual([cellKey(0, 3), cellKey(1, 3), cellKey(2, 3)])
  })

  it('does not fill a 400 m jump, nor credit it', () => {
    const index = buildAreaIndex(testArea())
    const { cells: visited, metresByUnit } = activityCells(index, track([[10, 525], [410, 525]]))

    expect(visited).toEqual([cellKey(0, 3), cellKey(2, 3)])
    expect(Array.from(metresByUnit)).toEqual([0, 0, 0, 0])
  })

  it('credits each step to the unit of its midpoint, and nothing outside the area', () => {
    const index = buildAreaIndex(testArea())
    const { metresByUnit } = activityCells(index, track(line(-170, 75, 1170, 75, 10)))

    expect(metresByUnit[0]).toBeCloseTo(600, 6)
    expect(metresByUnit[1]).toBeCloseTo(570, 6)
    expect(metresByUnit[2]).toBe(0)
    expect(metresByUnit[3]).toBe(0)
  })

  it('handles an empty or one-point track', () => {
    const index = buildAreaIndex(testArea())

    expect(activityCells(index, new Float64Array(0)).cells).toEqual([])
    expect(activityCells(index, track([[75, 75]])).cells).toEqual([cellKey(0, 0)])
  })
})

describe('aggregateCoverage', () => {
  const index = buildAreaIndex(testArea())
  const runs = [
    // Along row 0, through Alpha (whose (1,0) is not runnable) into Bravo.
    run('a1', '2026-05-01', line(30, 75, 1170, 75, 10), index),
    // Up column 0 of Alpha.
    run('a2', '2026-06-15', line(75, 30, 75, 570, 10), index),
    // A few metres inside Delta's (4,1).
    run('a3', '2026-04-02', line(630, 225, 700, 225, 10), index),
  ]
  const home = at(0, 0)

  it('counts visited runnable cells, percentage and state per unit', () => {
    const coverage = aggregateCoverage(index, runs, home)
    const byId = Object.fromEntries(coverage.units.map((u) => [u.id, u]))

    expect(byId['test-alpha']).toMatchObject({ visited: 6, total: 14, pct: 42, state: 'partly' })
    expect(byId['test-bravo']).toMatchObject({ visited: 4, total: 4, pct: 100, state: 'complete' })
    expect(byId['test-delta']).toMatchObject({ visited: 1, total: 10, pct: 10, state: 'fog' })
  })

  it('adds up kilometres and keeps the latest run date per unit', () => {
    const coverage = aggregateCoverage(index, runs, home)
    const byId = Object.fromEntries(coverage.units.map((u) => [u.id, u]))

    expect(byId['test-alpha']!.kmRun).toBeCloseTo(0.57 + 0.54, 6)
    expect(byId['test-bravo']!.kmRun).toBeCloseTo(0.57, 6)
    expect(byId['test-delta']!.kmRun).toBeCloseTo(0.07, 6)
    expect(byId['test-alpha']!.lastRunDate).toBe('2026-06-15')
    expect(byId['test-bravo']!.lastRunDate).toBe('2026-05-01')
    expect(byId['test-delta']!.lastRunDate).toBe('2026-04-02')
  })

  it('drops units without a runnable cell and sums the rest', () => {
    const coverage = aggregateCoverage(index, runs, home)

    expect(coverage.units.map((u) => u.id)).toEqual(['test-alpha', 'test-bravo', 'test-delta'])
    expect(coverage.unitCount).toBe(3)
    expect(coverage.completeCount).toBe(1)
    // floor(100 · 11 / 28)
    expect(coverage.exploredPct).toBe(39)
    expect(coverage).toMatchObject({ areaId: 'test', version: 'test-20261022-abcdef12', home })
  })

  it('measures from home to each label and picks the next unit', () => {
    const coverage = aggregateCoverage(index, runs, home)
    const alpha = coverage.units.find((u) => u.id === 'test-alpha')!

    expect(alpha.distanceKm).toBeCloseTo(Math.hypot(300, 300) / 1000, 6)
    expect(coverage.nextId).toBe('test-alpha')
  })

  it('counts a cell visited by two runs once', () => {
    const twice = aggregateCoverage(index, [...runs, run('a4', '2026-07-01', line(75, 30, 75, 570, 10), index)], home)

    expect(twice.units.find((u) => u.id === 'test-alpha')!.visited).toBe(6)
    expect(twice.units.find((u) => u.id === 'test-alpha')!.lastRunDate).toBe('2026-07-01')
  })

  it('counts only the activities it is given', () => {
    const coverage = aggregateCoverage(index, [runs[2]!], null)

    expect(coverage.units.map((u) => u.visited)).toEqual([0, 0, 1])
    expect(coverage.units.every((u) => u.distanceKm === null)).toBe(true)
    expect(coverage.nextId).toBe('test-delta')
  })

  it('is all fog with no runs', () => {
    const coverage = aggregateCoverage(index, [], home)

    expect(coverage.exploredPct).toBe(0)
    expect(coverage.units.every((u) => u.state === 'fog' && u.kmRun === 0 && u.lastRunDate === null)).toBe(true)
  })

  it('reads the date from an ISO timestamp', () => {
    const coverage = aggregateCoverage(index, [{ ...runs[2]!, date: '2026-04-02T06:30:00Z' }], home)

    expect(coverage.units.find((u) => u.id === 'test-delta')!.lastRunDate).toBe('2026-04-02')
  })
})

describe('unitState', () => {
  it('follows the floored percentage', () => {
    expect(unitState(90)).toBe('complete')
    expect(unitState(89)).toBe('partly')
    expect(unitState(15)).toBe('partly')
    expect(unitState(14)).toBe('fog')
  })
})

/** Deterministic, so a slow run is the code's fault and not the dice's. */
function mulberry32(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe('performance', () => {
  it('reduces 317 runs of ~650 points over a 6 × 7 km area in under a second', () => {
    const rng = mulberry32(20261022)
    const W = 6000
    const H = 7000

    // 42 units of 1 km², 70% of their cells runnable.
    const runnable = new Map<string, number[]>()
    for (let i = 0; i < W / CELL_M; i++) {
      for (let j = 0; j < Math.ceil(H / CELL_M); j++) {
        const cx = (i + 0.5) * CELL_M
        const cy = (j + 0.5) * CELL_M
        if (cy > H || rng() > 0.7) continue
        const id = `perf-${Math.floor(cx / 1000)}-${Math.floor(cy / 1000)}`
        runnable.set(id, [...(runnable.get(id) ?? []), cellKey(i, j)])
      }
    }
    const features: ExploreUnitFeature[] = []
    for (let ux = 0; ux < 6; ux++) {
      for (let uy = 0; uy < 7; uy++) {
        const id = `perf-${ux}-${uy}`
        const keys = (runnable.get(id) ?? []).sort((a, b) => a - b)
        features.push(unit(id, id, rect(ux * 1000, uy * 1000, ux * 1000 + 1000, uy * 1000 + 1000), keys))
      }
    }
    const index = buildAreaIndex(areaFile(features))

    // Random walks from near the middle: ~11 m between points, like the real tracks.
    const tracks = Array.from({ length: 317 }, () => {
      const n = 600 + Math.floor(rng() * 100)
      const points: [number, number][] = []
      let x = 2500 + rng() * 1000
      let y = 3000 + rng() * 1000
      let heading = rng() * 2 * Math.PI
      for (let k = 0; k < n; k++) {
        points.push([x, y])
        heading += (rng() - 0.5) * 0.6
        x = Math.min(W - 1, Math.max(1, x + Math.cos(heading) * (6 + rng() * 10)))
        y = Math.min(H - 1, Math.max(1, y + Math.sin(heading) * (6 + rng() * 10)))
      }
      return track(points)
    })

    const start = performance.now()
    const results = tracks.map((coords, k) => ({ id: `r${k}`, date: '2026-10-01', ...activityCells(index, coords) }))
    const coverage = aggregateCoverage(index, results, at(3000, 3500))
    const elapsed = performance.now() - start

    console.log(`[explore] 317 runs → coverage in ${elapsed.toFixed(1)} ms`)
    expect(coverage.unitCount).toBe(42)
    expect(coverage.exploredPct).toBeGreaterThan(0)
    expect(elapsed).toBeLessThan(1000)
  })
})
