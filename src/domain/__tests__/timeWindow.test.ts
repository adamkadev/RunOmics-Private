import { describe, it, expect } from 'vitest'
import { hasEarlierPoints, pointsInWindow, windowBounds } from '../timeWindow'

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
