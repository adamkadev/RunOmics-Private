import { describe, it, expect } from 'vitest'
import {
  hasEarlierPoints,
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
