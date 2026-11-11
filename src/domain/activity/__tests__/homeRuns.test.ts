import { describe, it, expect } from 'vitest'
import { cumulativeMetres, finishBins, headAt, homeSpots, pointSeconds, thinIndices, warpSeconds, type LngLat } from '../homeRuns'

const HOME: LngLat = [6.1, 49.6]
const near = (dLon: number): LngLat => [HOME[0] + dLon, HOME[1]]

describe('homeSpots', () => {
  it('groups the starts within the radius and leaves the far one out', () => {
    const starts = [near(0), near(0.0005), near(-0.0005), [7.7, 48.6] as LngLat]

    const spots = homeSpots(starts, 200, 2)

    expect(spots).toHaveLength(1)
    expect(spots[0]!.members.sort()).toEqual([0, 1, 2])
  })

  it('finds a second spot and orders the spots by size', () => {
    const away: LngLat = [7.7, 48.6]
    const starts = [near(0), near(0.0001), near(0.0002), away, [away[0] + 0.0001, away[1]] as LngLat]

    const spots = homeSpots(starts, 200, 2)

    expect(spots.map((s) => s.members.length)).toEqual([3, 2])
  })

  it('skips a run without a start and keeps no spot under the minimum', () => {
    expect(homeSpots([null, near(0)], 200, 2)).toEqual([])
  })
})

describe('pointSeconds', () => {
  const route: LngLat[] = [near(0), near(0.01), near(0.02)]

  it('spreads the time by distance at an even pace', () => {
    const times = pointSeconds(route, [300, 300, 300, 300], 1000)

    expect(times[0]).toBe(0)
    expect(times[1]).toBeCloseTo(500, 0)
    expect(times[2]).toBeCloseTo(1000, 0)
  })

  it('gives the slow half of the run more of the time', () => {
    const times = pointSeconds(route, [600, 600, 300, 300], 900)

    expect(times[1]).toBeGreaterThan(450)
    expect(times[2]).toBeCloseTo(900, 0)
  })

  it('falls back to an even pace without samples', () => {
    expect(pointSeconds(route, null, 100)[1]).toBeCloseTo(50, 0)
  })

  it('gives a route without length no time', () => {
    expect(pointSeconds([HOME, HOME], [300, 300], 100)).toEqual([0, 0])
  })
})

describe('cumulativeMetres', () => {
  it('starts at zero and grows with each step', () => {
    const metres = cumulativeMetres([near(0), near(0.01)])

    expect(metres[0]).toBe(0)
    expect(metres[1]).toBeGreaterThan(700)
  })
})

describe('thinIndices', () => {
  it('keeps a short route whole', () => {
    expect(thinIndices(3, 5)).toEqual([0, 1, 2])
  })

  it('keeps both ends and no more than the cap', () => {
    const kept = thinIndices(1000, 100)

    expect(kept[0]).toBe(0)
    expect(kept[kept.length - 1]).toBe(999)
    expect(kept.length).toBeLessThanOrEqual(100)
  })
})

describe('warpSeconds', () => {
  it('runs from zero to the longest run', () => {
    expect(warpSeconds(0, 3600)).toBe(0)
    expect(warpSeconds(1, 3600)).toBeCloseTo(3600)
  })

  it('spends the first half of the replay on well under half the time', () => {
    expect(warpSeconds(0.5, 3600)).toBeLessThan(1000)
  })
})

describe('headAt', () => {
  const times = [0, 10, 20]

  it('is before the first point until its time', () => {
    expect(headAt([5, 10], 2).index).toBe(-1)
  })

  it('sits between two points', () => {
    expect(headAt(times, 15)).toEqual({ index: 1, within: 0.5 })
  })

  it('stays on the last point after the finish', () => {
    expect(headAt(times, 99)).toEqual({ index: 2, within: 0 })
  })
})

describe('finishBins', () => {
  it('counts only the runs finished so far, the long ones in the last bin', () => {
    expect(finishBins([100, 700, 5000], 1000, 600, 3)).toEqual([1, 1, 0])
    expect(finishBins([100, 700, 5000], 9999, 600, 3)).toEqual([1, 1, 1])
  })
})
