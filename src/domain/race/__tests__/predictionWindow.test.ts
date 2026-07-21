import { describe, it, expect } from 'vitest'
import { bestTrend, type DatedPaces } from '../predictionWindow'
import { RACE_DISTANCE_KM, type RaceDistanceKey } from '../distances'

const point = (date: string, paces: Partial<Record<RaceDistanceKey, number>> = {}): DatedPaces => ({
  date,
  '5k': paces['5k'] ?? null,
  '10k': paces['10k'] ?? null,
  half: paces.half ?? null,
  marathon: paces.marathon ?? null,
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
