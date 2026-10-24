import { describe, it, expect } from 'vitest'
import { closingPace, evenSplit, pacingCheckpoints, predictionChange } from '../pacing'

describe('pacingCheckpoints', () => {
  it('splits a half every 5 km and ends on the line', () => {
    expect(pacingCheckpoints(21.0975)).toEqual([5, 10, 15, 20, 21.0975])
  })

  it('splits a 10K every km', () => {
    expect(pacingCheckpoints(10)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  })
})

describe('evenSplit', () => {
  it('is the clock at that distance at one pace', () => {
    expect(evenSplit(5700, 21.0975, 10)).toBe(2702)
    expect(evenSplit(5700, 21.0975, 21.0975)).toBe(5700)
  })
})

describe('predictionChange', () => {
  const points = [
    { date: '2026-07-01', seconds: 5800 },
    { date: '2026-08-01', seconds: 5790 },
    { date: '2026-09-23', seconds: 5760 },
    { date: '2026-10-21', seconds: 5730 },
  ]

  it('compares the latest with the first point inside the window, over the weeks it spans', () => {
    expect(predictionChange(points, 84)).toEqual({ seconds: -60, perWeek: -5, weeks: 12 })
    expect(predictionChange(points.slice(-2), 84)).toEqual({ seconds: -30, perWeek: -7.5, weeks: 4 })
    expect(predictionChange([{ date: '2026-10-20', seconds: 5760 }, { date: '2026-10-24', seconds: 5748 }], 84)).toEqual({ seconds: -12, perWeek: -12, weeks: 1 })
  })

  it('is null without an earlier point in the window', () => {
    expect(predictionChange(points.slice(-1), 84)).toBeNull()
    expect(predictionChange([], 84)).toBeNull()
  })
})

describe('closingPace', () => {
  it('spreads the gap over the weeks it prints, rounded up', () => {
    expect(closingPace(100, 70)).toEqual({ perWeek: 10, weeks: 10 })
    expect(closingPace(101, 70)).toEqual({ perWeek: 11, weeks: 10 })
    expect(closingPace(30, 9)).toEqual({ perWeek: 30, weeks: 1 })
  })

  it('is null inside the target or under half a week out', () => {
    expect(closingPace(-5, 70)).toBeNull()
    expect(closingPace(30, 3)).toBeNull()
  })
})
