import { describe, it, expect } from 'vitest'
import {
  fillWeeklyGaps,
  hasEarlierPoints,
  monthStartTicks,
  pickForRange,
  pointsInWindow,
  sampleForRange,
  windowBounds,
} from '../timeWindow'

const point = (date: string) => ({ date })

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

describe('sampleForRange', () => {
  const daily = (count: number, value: (i: number) => number) =>
    Array.from({ length: count }, (_, i) => ({
      date: `2026-01-${String(i + 1).padStart(2, '0')}`,
      value: value(i),
    }))

  it('gives each range its point budget: 4 for 4w, 6 for 6m, 12 for 1y', () => {
    const points = daily(60, (i) => i)

    expect(sampleForRange(points, '4w')).toHaveLength(4)
    expect(sampleForRange(points, '6m')).toHaveLength(6)
    expect(sampleForRange(points, '1y')).toHaveLength(12)
  })

  it('averages each bucket and anchors it on the bucket last date', () => {
    // 10, 20, ... 80 in pairs -> 15, 35, 55, 75.
    const sampled = sampleForRange(daily(8, (i) => (i + 1) * 10), '4w')
    expect(sampled).toHaveLength(4)
    expect(sampled[0]).toEqual({ date: '2026-01-02', value: 15 })
    expect(sampled[3]).toEqual({ date: '2026-01-08', value: 75 })
  })

  it('keeps fractional values by default so small metrics survive', () => {
    // Stride length ~1.2 m would collapse to 1 under whole-number rounding.
    const points = daily(8, (i) => 1.2 + i * 0.02)

    expect(sampleForRange(points, '4w').map((p) => p.value)).toEqual([1.21, 1.25, 1.29, 1.33])
    expect(sampleForRange(points, '4w', 0).map((p) => p.value)).toEqual([1, 1, 1, 1])
  })

  it('is a no-op when the window already holds fewer points than the budget', () => {
    const points = daily(3, (i) => i)

    expect(sampleForRange(points, '1y')).toBe(points)
  })
})

describe('pickForRange', () => {
  const daily = (count: number) =>
    Array.from({ length: count }, (_, i) => ({
      date: `2026-01-${String(i + 1).padStart(2, '0')}`,
    }))

  it('keeps every day over four weeks', () => {
    const points = daily(28)

    expect(pickForRange(points, '4w')).toBe(points)
  })

  it('thins to one day a week over the longer windows', () => {
    const picked = pickForRange(daily(28), '6m')

    expect(picked.map((p) => p.date)).toEqual(['2026-01-07', '2026-01-14', '2026-01-21', '2026-01-28'])
  })

  it('always plots the freshest day, whatever the remainder', () => {
    for (const count of [26, 27, 28, 29, 30]) {
      const points = daily(count)
      const picked = pickForRange(points, '1y')

      expect(picked[picked.length - 1]).toBe(points[count - 1])
    }
  })

  it('returns untouched points, so a tooltip reports the day it names', () => {
    const points = daily(20)

    expect(pickForRange(points, '1y').every((p) => points.includes(p))).toBe(true)
  })
})

describe('monthStartTicks', () => {
  // Consecutive Mondays, which is what the weekly volume chart plots.
  const mondays = (count: number, from = '2026-01-05') => {
    const start = Date.parse(from + 'T00:00:00Z')
    return Array.from({ length: count }, (_, i) => ({
      date: new Date(start + i * 7 * 86_400_000).toISOString().slice(0, 10),
    }))
  }

  it('marks the first point of each month, not every nth point', () => {
    const ticks = monthStartTicks(mondays(13))

    // Jan 5, Feb 2, Mar 2 - the first Monday to land in each month.
    expect([...ticks]).toEqual(['2026-01-05', '2026-02-02', '2026-03-02'])
  })

  it('marks the window edge even when it opens mid-month', () => {
    expect(monthStartTicks(mondays(3, '2026-01-19')).has('2026-01-19')).toBe(true)
  })

  it('thins to the label budget so a year does not collide on a phone', () => {
    const ticks = monthStartTicks(mondays(53))

    expect(ticks.size).toBeLessThanOrEqual(7)
  })

  it('keeps every month when they already fit', () => {
    // Six months of weeks: six labels, no thinning.
    expect(monthStartTicks(mondays(26)).size).toBe(6)
  })

  it('is empty for no points', () => {
    expect(monthStartTicks([]).size).toBe(0)
  })
})

describe('fillWeeklyGaps', () => {
  const blank = (monday: string) => ({ date: monday, km: 0 })
  const week = (date: string, km: number) => ({ date, km })

  it('inserts the weeks that carry no run at all', () => {
    // 8 Dec ran, then nothing until 12 Jan: four weeks off, absent from the series.
    const filled = fillWeeklyGaps([week('2025-12-08', 40), week('2026-01-12', 30)], blank)

    expect(filled.map((w) => w.date)).toEqual([
      '2025-12-08',
      '2025-12-15',
      '2025-12-22',
      '2025-12-29',
      '2026-01-05',
      '2026-01-12',
    ])
    expect(filled.filter((w) => w.km === 0)).toHaveLength(4)
  })

  it('leaves a series with no gap untouched', () => {
    const points = [week('2026-01-05', 10), week('2026-01-12', 20), week('2026-01-19', 30)]

    expect(fillWeeklyGaps(points, blank)).toEqual(points)
  })

  // A gap before the first run is history the athlete never had, and one after
  // the last is a week that has not happened yet.
  it('does not pad outside the recorded span', () => {
    expect(fillWeeklyGaps([week('2026-03-02', 25)], blank)).toEqual([week('2026-03-02', 25)])
    expect(fillWeeklyGaps([], blank)).toEqual([])
  })

  it('keeps the real weeks as they were, not copies', () => {
    const first = week('2026-01-05', 10)
    const second = week('2026-01-26', 20)

    const filled = fillWeeklyGaps([first, second], blank)

    expect(filled[0]).toBe(first)
    expect(filled[filled.length - 1]).toBe(second)
  })

  it('crosses a DST boundary without drifting off Monday', () => {
    // Europe springs forward on 29 Mar 2026; stepping in local time would slide
    // the inserted weeks to Sunday.
    const filled = fillWeeklyGaps([week('2026-03-16', 30), week('2026-04-13', 30)], blank)

    expect(filled.map((w) => w.date)).toEqual([
      '2026-03-16',
      '2026-03-23',
      '2026-03-30',
      '2026-04-06',
      '2026-04-13',
    ])
  })
})
