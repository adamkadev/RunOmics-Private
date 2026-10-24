import { describe, expect, it } from 'vitest'
import {
  formatClock,
  formatDistance,
  formatDuration,
  formatKm,
  formatPace,
  parseTimeInput,
} from '@/lib/formatters'

describe('formatDuration', () => {
  it('formats seconds as m:ss under an hour', () => {
    expect(formatDuration(125)).toBe('2:05')
  })

  it('formats seconds as h:mm:ss past an hour', () => {
    expect(formatDuration(3725)).toBe('1:02:05')
  })
})

describe('formatKm', () => {
  it('groups thousands so 1705 never renders as 1705', () => {
    expect(formatKm(1705)).toBe('1,705')
  })

  it('rounds to whole kilometres by default', () => {
    expect(formatKm(29.4)).toBe('29')
  })

  it('keeps the requested decimals, grouped', () => {
    expect(formatKm(1234.56, 1)).toBe('1,234.6')
  })
})

describe('formatClock', () => {
  it('formats seconds as m:ss', () => {
    expect(formatClock(305)).toBe('5:05')
  })
})

describe('formatPace', () => {
  it('appends the /km unit to a clock-formatted pace', () => {
    expect(formatPace(330)).toBe('5:30 /km')
  })
})

describe('formatDistance', () => {
  it('shows 1 decimal at 10 km, and none from 100 km', () => {
    expect(formatDistance(10.567)).toBe('10.6')
    expect(formatDistance(123.4)).toBe('123')
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
