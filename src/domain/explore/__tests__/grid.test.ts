import { describe, it, expect } from 'vitest'
import {
  BREAK_M,
  CELL_M,
  MAX_STEP_M,
  cellCentre,
  cellIndices,
  cellKey,
  cellOf,
  cellOfXY,
  projectX,
  projectY,
  projection,
  sampleLine,
  unproject,
  type Projection,
} from '../grid'
import { PROJ, track } from './areaFixture'

/**
 * A projection of one metre per degree, so the sampling tests read in exact
 * metres: with a real one, a 300 m segment comes back 300.00000001 m long.
 */
const METRES: Projection = { lon0: 0, lat0: 0, kx: 1, ky: 1, cellM: CELL_M }

function samples(pointsM: [number, number][]) {
  const out: { x: number; y: number; step: number }[] = []
  sampleLine(pointsM.flat(), METRES, MAX_STEP_M, BREAK_M, (x, y, step) => out.push({ x, y, step }))
  return out
}

describe('projection', () => {
  it('scales longitude by the cosine of the origin latitude', () => {
    const p = projection({ origin: [0, 60], cellM: CELL_M })

    expect(p.kx).toBeCloseTo(111_320 / 2, 6)
    expect(p.ky).toBe(111_320)
  })

  it('round-trips a point through metres and back', () => {
    for (const [lon, lat] of [[-150, 45], [-149.97, 45.02], [-150.05, 44.96]] as const) {
      const [lon2, lat2] = unproject(PROJ, projectX(PROJ, lon), projectY(PROJ, lat))

      expect(lon2).toBeCloseTo(lon, 10)
      expect(lat2).toBeCloseTo(lat, 10)
    }
  })

  it('puts the origin at 0, 0', () => {
    expect(projectX(PROJ, -150)).toBe(0)
    expect(projectY(PROJ, 45)).toBe(0)
  })
})

describe('cellKey', () => {
  it('round-trips indices, negative ones and the extremes included', () => {
    for (const [i, j] of [[0, 0], [-1, 5], [5, -1], [-1, -1], [123, -456], [-32_768, -32_768], [32_767, 32_767]] as const) {
      expect(cellIndices(cellKey(i, j))).toEqual([i, j])
    }
  })

  it('is a non-negative integer below 2^32', () => {
    expect(cellKey(-32_768, -32_768)).toBe(0)
    expect(cellKey(32_767, 32_767)).toBe(2 ** 32 - 1)
    expect(Number.isInteger(cellKey(-7, 9))).toBe(true)
  })

  it('sorts by column, then row', () => {
    expect(cellKey(0, 5)).toBeLessThan(cellKey(1, -5))
    expect(cellKey(1, 2)).toBeLessThan(cellKey(1, 3))
  })
})

describe('cellOf', () => {
  it('puts an exact multiple of 150 m in the cell it starts', () => {
    expect(cellOfXY(CELL_M, 150, 0)).toBe(cellKey(1, 0))
    expect(cellOfXY(CELL_M, 0, 300)).toBe(cellKey(0, 2))
    expect(cellOfXY(CELL_M, -150, -150)).toBe(cellKey(-1, -1))
    expect(cellOfXY(CELL_M, 0, 0)).toBe(cellKey(0, 0))
  })

  it('keeps everything short of the next multiple in the cell before', () => {
    expect(cellOfXY(CELL_M, 149.999, 0)).toBe(cellKey(0, 0))
    expect(cellOfXY(CELL_M, -0.001, -0.001)).toBe(cellKey(-1, -1))
    expect(cellOfXY(CELL_M, -150.001, 0)).toBe(cellKey(-2, 0))
  })

  it('finds the cell of a lon/lat point', () => {
    const [lon, lat] = unproject(PROJ, 225, -75)

    expect(cellOf(PROJ, lon, lat)).toBe(cellKey(1, -1))
  })

  it('maps every cell centre back to its own cell', () => {
    for (let i = -20; i <= 20; i += 3) {
      for (let j = -20; j <= 20; j += 7) {
        const [lon, lat] = cellCentre(PROJ, cellKey(i, j))

        expect(cellOf(PROJ, lon, lat)).toBe(cellKey(i, j))
      }
    }
  })
})

describe('sampleLine', () => {
  it('visits nothing for an empty line', () => {
    expect(samples([])).toEqual([])
  })

  it('reads lon/lat through the projection', () => {
    const out: number[] = []
    sampleLine(track([[10, 20]]), PROJ, MAX_STEP_M, BREAK_M, (x, y) => out.push(x, y))

    expect(out[0]).toBeCloseTo(10, 6)
    expect(out[1]).toBeCloseTo(20, 6)
  })

  it('visits a single point once, with step 0', () => {
    const out = samples([[10, 20]])

    expect(out).toHaveLength(1)
    expect(out[0]).toEqual({ x: 10, y: 20, step: 0 })
  })

  it('keeps samples at most 75 m apart, and the steps add up to the length', () => {
    const points: [number, number][] = [[0, 0], [290, 0], [290, 200], [100, 50], [101, 50]]
    const out = samples(points)
    const length = 290 + 200 + Math.hypot(190, 150) + 1

    for (let k = 1; k < out.length; k++) {
      const gap = Math.hypot(out[k]!.x - out[k - 1]!.x, out[k]!.y - out[k - 1]!.y)
      expect(gap).toBeLessThanOrEqual(MAX_STEP_M + 1e-6)
      expect(out[k]!.step).toBeCloseTo(gap, 6)
    }
    expect(out.reduce((sum, s) => sum + s.step, 0)).toBeCloseTo(length, 6)
  })

  it('splits a segment into equal pieces', () => {
    const out = samples([[0, 0], [300, 0]])

    expect(out.map((s) => s.x)).toEqual([0, 75, 150, 225, 300])
    expect(out.map((s) => s.step)).toEqual([0, 75, 75, 75, 75])
  })

  it('interpolates a segment of exactly 300 m, and breaks one just over', () => {
    expect(samples([[0, 0], [0, 300]])).toHaveLength(5)
    expect(samples([[0, 0], [0, 300.01]])).toHaveLength(2)
  })

  it('skips a jump over 300 m and restarts at its end with step 0', () => {
    const out = samples([[0, 0], [50, 0], [450, 0], [500, 0]])

    expect(out.map((s) => s.x)).toEqual([0, 50, 450, 500])
    expect(out.map((s) => s.step)).toEqual([0, 50, 0, 50])
  })

  it('ignores a repeated point', () => {
    const out = samples([[0, 0], [0, 0], [30, 0]])

    expect(out.map((s) => s.step)).toEqual([0, 30])
  })
})
