import { describe, it, expect } from 'vitest'
import { bestTrend, downsamplePaces, type DatedPaces } from '../predictionWindow'
import { RACE_DISTANCE_KM, type RaceDistanceKey } from '../distances'

const point = (date: string, paces: Partial<Record<RaceDistanceKey, number>> = {}): DatedPaces => ({
  date,
  '5k': paces['5k'] ?? null,
  '10k': paces['10k'] ?? null,
  half: paces.half ?? null,
  marathon: paces.marathon ?? null,
})

const labelled = (date: string, paces: Partial<Record<RaceDistanceKey, number>> = {}) => ({
  ...point(date, paces),
  label: date,
})

describe('downsamplePaces', () => {
  it('collapses 4 weeks of daily readings to one point per week', () => {
    // Mon 1 Jun 2026 through Sun 14 Jun: two ISO weeks.
    const daily = Array.from({ length: 14 }, (_, i) =>
      labelled(`2026-06-${String(i + 1).padStart(2, '0')}`, { '5k': 240 + i }),
    )

    const result = downsamplePaces(daily, '4w')

    expect(result).toHaveLength(2)
    // Each point is anchored on the last day of its week.
    expect(result.map((p) => p.date)).toEqual(['2026-06-07', '2026-06-14'])
  })

  it('averages the readings inside a bucket', () => {
    const daily = [
      labelled('2026-06-01', { '5k': 240 }),
      labelled('2026-06-02', { '5k': 250 }),
      labelled('2026-06-03', { '5k': 260 }),
    ]

    expect(downsamplePaces(daily, '4w')[0]?.['5k']).toBe(250)
  })

  it('collapses longer ranges to one point per month', () => {
    const daily = [
      labelled('2026-05-02', { '5k': 240 }),
      labelled('2026-05-20', { '5k': 250 }),
      labelled('2026-06-10', { '5k': 260 }),
    ]

    const result = downsamplePaces(daily, '6m')

    expect(result.map((p) => p.date)).toEqual(['2026-05-20', '2026-06-10'])
    expect(result[0]?.['5k']).toBe(245)
  })

  it('keeps a distance null when a bucket has no reading for it', () => {
    const result = downsamplePaces([labelled('2026-06-01', { '5k': 240 })], '4w')

    expect(result[0]?.['5k']).toBe(240)
    expect(result[0]?.marathon).toBeNull()
  })

  it('is empty for an empty window', () => {
    expect(downsamplePaces([], '1y')).toEqual([])
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
