import { describe, expect, it } from 'vitest'
import { MAX_BOOTSTRAP_WEEKS, isoWeekWindows, weekWindowIndex } from '../weekWindows'

describe('isoWeekWindows', () => {
  it('runs Monday to Sunday when planning starts on a Monday', () => {
    expect(isoWeekWindows('2026-09-07', '2026-09-27')).toEqual([
      { startDate: '2026-09-07', endDate: '2026-09-13' },
      { startDate: '2026-09-14', endDate: '2026-09-20' },
      { startDate: '2026-09-21', endDate: '2026-09-27' },
    ])
  })

  it('shortens only the first week when planning starts mid-week', () => {
    expect(isoWeekWindows('2026-09-09', '2026-09-20')).toEqual([
      { startDate: '2026-09-09', endDate: '2026-09-13' },
      { startDate: '2026-09-14', endDate: '2026-09-20' },
    ])
  })

  it('gives a Sunday start its own one-day week rather than bending the calendar', () => {
    expect(isoWeekWindows('2026-09-06', '2026-09-20')).toEqual([
      { startDate: '2026-09-06', endDate: '2026-09-06' },
      { startDate: '2026-09-07', endDate: '2026-09-13' },
      { startDate: '2026-09-14', endDate: '2026-09-20' },
    ])
  })

  it('clips the last week at the horizon, which is usually a race date', () => {
    expect(isoWeekWindows('2026-09-07', '2026-09-16')).toEqual([
      { startDate: '2026-09-07', endDate: '2026-09-13' },
      { startDate: '2026-09-14', endDate: '2026-09-16' },
    ])
  })

  it('collapses to a single window when the horizon lands inside the first week', () => {
    expect(isoWeekWindows('2026-09-09', '2026-09-11')).toEqual([
      { startDate: '2026-09-09', endDate: '2026-09-11' },
    ])
  })
})

describe('weekWindowIndex', () => {
  it('numbers weeks by position, not by dividing elapsed days by seven', () => {
    const windows = isoWeekWindows('2026-09-06', '2026-09-20')

    expect(weekWindowIndex(windows, '2026-09-06')).toBe(1)
    expect(weekWindowIndex(windows, '2026-09-07')).toBe(2)
    expect(weekWindowIndex(windows, '2026-09-14')).toBe(3)
  })

  it('reports an unknown start rather than guessing an index', () => {
    expect(weekWindowIndex(isoWeekWindows('2026-09-07', '2026-09-20'), '2026-09-10')).toBeNull()
  })
})

describe('MAX_BOOTSTRAP_WEEKS', () => {
  it('covers a 28-day horizon from any start weekday, so the schema cap never rejects a valid layout', () => {
    for (let offset = 0; offset < 7; offset += 1) {
      const start = new Date(Date.UTC(2026, 8, 6) + offset * 86_400_000)
      const startDate = start.toISOString().slice(0, 10)
      const endDate = new Date(start.getTime() + 27 * 86_400_000).toISOString().slice(0, 10)

      expect(isoWeekWindows(startDate, endDate).length, startDate).toBeLessThanOrEqual(MAX_BOOTSTRAP_WEEKS)
    }
  })

  it('needs the fifth week only because a mid-week start adds a short lead-in', () => {
    expect(isoWeekWindows('2026-09-07', '2026-10-04')).toHaveLength(4)
    expect(isoWeekWindows('2026-09-06', '2026-10-03')).toHaveLength(5)
  })
})

