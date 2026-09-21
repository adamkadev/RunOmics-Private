import { describe, it, expect } from 'vitest'
import {
  buildRouteCellSet,
  isSimilarDistance,
  routeSimilarity,
  ROUTE_GRID,
  SIMILAR_ROUTE_MIN_SIMILARITY,
} from '../routeMatch'

function line(start: [number, number], steps: number, dLon: number, dLat: number): [number, number][] {
  return Array.from({ length: steps }, (_, i) => [start[0] + i * dLon, start[1] + i * dLat])
}

describe('routeSimilarity', () => {
  it('is 1 for an identical trace', () => {
    const a = buildRouteCellSet(line([20.00, 35.00], 200, ROUTE_GRID, 0))
    expect(routeSimilarity(a, a)).toBe(1)
  })

  it('tolerates one-cell GPS jitter between two passes of the same street', () => {
    const a = buildRouteCellSet(line([20.00, 35.00], 200, ROUTE_GRID, 0))
    const jittered = buildRouteCellSet(line([20.00, 35.00 + ROUTE_GRID], 200, ROUTE_GRID, 0))
    expect(routeSimilarity(a, jittered)).toBeGreaterThanOrEqual(SIMILAR_ROUTE_MIN_SIMILARITY)
  })

  it('rejects a distinct parallel route a few streets away', () => {
    const a = buildRouteCellSet(line([20.00, 35.00], 200, ROUTE_GRID, 0))
    const parallel = buildRouteCellSet(line([20.00, 35.00 + 10 * ROUTE_GRID], 200, ROUTE_GRID, 0))
    expect(routeSimilarity(a, parallel)).toBe(0)
  })

  it('rejects a long run that merely passes through a short loop', () => {
    const shortLoop = buildRouteCellSet(line([20.00, 35.00], 50, ROUTE_GRID, 0))
    const longRun = buildRouteCellSet(line([19.98, 35.00], 400, ROUTE_GRID, 0))
    expect(routeSimilarity(shortLoop, longRun)).toBeLessThan(SIMILAR_ROUTE_MIN_SIMILARITY)
  })

  it('handles empty traces without matching anything', () => {
    const empty = buildRouteCellSet([])
    const a = buildRouteCellSet(line([20.00, 35.00], 50, ROUTE_GRID, 0))
    expect(routeSimilarity(empty, a)).toBe(0)
    expect(routeSimilarity(empty, empty)).toBe(0)
  })
})

describe('isSimilarDistance', () => {
  it('accepts distances within 15%', () => {
    expect(isSimilarDistance(10, 11)).toBe(true)
    expect(isSimilarDistance(11, 10)).toBe(true)
  })

  it('rejects the same loop run twice (double distance)', () => {
    expect(isSimilarDistance(10, 20)).toBe(false)
  })

  it('rejects zero/negative distances', () => {
    expect(isSimilarDistance(0, 10)).toBe(false)
  })
})
