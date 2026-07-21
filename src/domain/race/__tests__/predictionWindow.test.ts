import { describe, it, expect } from 'vitest'
import {
  bestTrend,
  hasEarlierPoints,
  pointsInWindow,
  windowBounds,
  type DatedPaces,
} from '../predictionWindow'
import { RACE_DISTANCE_KM, type RaceDistanceKey } from '../distances'

const point = (date: string, paces: Partial<Record<RaceDistanceKey, number>> = {}): DatedPaces => ({
  date,
  '5k': paces['5k'] ?? null,
  '10k': paces['10k'] ?? null,
  half: paces.half ?? null,
  marathon: paces.marathon ?? null,
})

const ANCHOR = new Date(2026, 6, 21) // 2026-07-21

describe('windowBounds', () => {
  it('ends on the anchor day and spans the range inclusively', () => {
    // 28 days ending 21 Jul starts on 24 Jun, not 23 Jun.
    expect(windowBounds('4w', 0, ANCHOR)).toEqual({ from: '2026-06-24', to: '2026-07-21' })
  })

  it('steps back a whole range at a time without overlapping', () => {
    const current = windowBounds('4w', 0, ANCHOR)
    const previous = windowBounds('4w', 1, ANCHOR)

    // The two windows must be adjacent: no day falls between them, and none is
    // covered twice.
    expect(previous.to).toBe('2026-06-23')
    expect(current.from).toBe('2026-06-24')
  })

  it('scales with the selected range', () => {
    expect(windowBounds('6m', 0, ANCHOR).from).toBe('2026-01-20')
    expect(windowBounds('1y', 0, ANCHOR).from).toBe('2025-07-22')
  })
})

describe('pointsInWindow', () => {
  const points = [point('2026-06-01'), point('2026-07-01'), point('2026-07-21')]

  it('keeps both bounds', () => {
    const inside = pointsInWindow(points, { from: '2026-07-01', to: '2026-07-21' })
    expect(inside.map((p) => p.date)).toEqual(['2026-07-01', '2026-07-21'])
  })

  it('is empty for a window the history does not reach', () => {
    expect(pointsInWindow(points, { from: '2020-01-01', to: '2020-06-01' })).toEqual([])
  })
})

describe('hasEarlierPoints', () => {
  const points = [point('2026-06-01'), point('2026-07-21')]

  it('is true while older readings remain, so the back arrow leads somewhere', () => {
    expect(hasEarlierPoints(points, { from: '2026-07-01', to: '2026-07-21' })).toBe(true)
  })

  it('is false once the window reaches the start of the history', () => {
    expect(hasEarlierPoints(points, { from: '2026-05-01', to: '2026-07-21' })).toBe(false)
  })
})

describe('bestTrend', () => {
  it('reports the gain in finish-time seconds, not in pace seconds', () => {
    // 10 sec/km off a 5 km prediction is 50 s off the finish time.
    const points = [point('2026-01-01', { '5k': 250 }), point('2026-02-01', { '5k': 240 })]

    expect(bestTrend(points, ['5k'])).toEqual({
      distance: '5k',
      improvementSec: 50,
      currentSec: 240 * RACE_DISTANCE_KM['5k'],
    })
  })

  it('picks the distance that moved most, not the first one', () => {
    const points = [
      point('2026-01-01', { '5k': 250, marathon: 300 }),
      point('2026-02-01', { '5k': 248, marathon: 295 }),
    ]

    // 2 sec/km over 5 km is 10 s; 5 sec/km over 42.195 km is ~211 s.
    expect(bestTrend(points, ['5k', 'marathon'])?.distance).toBe('marathon')
  })

  it('reports a regression as a negative gain', () => {
    const points = [point('2026-01-01', { '5k': 240 }), point('2026-02-01', { '5k': 250 })]

    expect(bestTrend(points, ['5k'])?.improvementSec).toBe(-50)
  })

  it('compares the first and last readings, ignoring gaps in between', () => {
    const points = [
      point('2026-01-01', { '5k': 250 }),
      point('2026-01-15'),
      point('2026-02-01', { '5k': 240 }),
    ]

    expect(bestTrend(points, ['5k'])?.improvementSec).toBe(50)
  })

  it('is null when a distance never got two readings', () => {
    expect(bestTrend([point('2026-01-01', { '5k': 250 })], ['5k'])).toBeNull()
    expect(bestTrend([], ['5k'])).toBeNull()
  })
})
