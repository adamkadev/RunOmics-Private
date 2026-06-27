import { describe, expect, it } from 'vitest'
import {
  formatClock,
  formatDate,
  formatDateWithYear,
  formatDistance,
  formatDuration,
  formatPace,
  monthLabel,
  parseTimeInput,
} from '@/lib/formatters'

describe('formatDuration', () => {
  it('formats seconds as m:ss under an hour', () => {
    expect(formatDuration(125)).toBe('2:05')
  })

  it('formats seconds as h:mm:ss past an hour', () => {
    expect(formatDuration(3725)).toBe('1:02:05')
  })

  it('pads minutes and seconds under 10', () => {
    expect(formatDuration(3605)).toBe('1:00:05')
  })
})

describe('formatClock', () => {
  it('formats seconds as m:ss', () => {
    expect(formatClock(305)).toBe('5:05')
  })

  it('rounds to the nearest second', () => {
    expect(formatClock(305.6)).toBe('5:06')
  })

  it('pads seconds under 10', () => {
    expect(formatClock(60)).toBe('1:00')
  })
})

describe('formatPace', () => {
  it('appends the /km unit to a clock-formatted pace', () => {
    expect(formatPace(330)).toBe('5:30 /km')
  })
})

describe('formatDistance', () => {
  it('shows 2 decimals under 10 km', () => {
    expect(formatDistance(5.123)).toBe('5.12')
  })

  it('shows 1 decimal at 10 km and above', () => {
    expect(formatDistance(10.567)).toBe('10.6')
  })
})

describe('formatDate', () => {
  it('formats an ISO date as a short weekday/month/day', () => {
    expect(formatDate('2026-03-28')).toBe('Sat, Mar 28')
  })
})

describe('formatDateWithYear', () => {
  it('formats an ISO date with month/day/year', () => {
    expect(formatDateWithYear('2025-03-28')).toBe('Mar 28, 2025')
  })
})

describe('monthLabel', () => {
  it('returns the 3-letter uppercase month for a 1-based month number', () => {
    expect(monthLabel(1)).toBe('JAN')
    expect(monthLabel(12)).toBe('DEC')
  })
})

describe('parseTimeInput', () => {
  it('parses m:ss', () => {
    expect(parseTimeInput('5:30')).toBe(330)
  })

  it('parses h:mm:ss', () => {
    expect(parseTimeInput('1:02:05')).toBe(3725)
  })

  it('returns null for invalid input', () => {
    expect(parseTimeInput('abc')).toBeNull()
    expect(parseTimeInput('1:2:3:4')).toBeNull()
    expect(parseTimeInput('')).toBeNull()
  })
})
