import { describe, it, expect } from 'vitest'
import { level, daysElapsedInWeek } from '../GetWeeklyLoadComparison'

describe('level', () => {
  it('low below 70%', () => {
    expect(level(69)).toBe('low')
  })

  it('normal between 70% and 130%', () => {
    expect(level(70)).toBe('normal')
    expect(level(100)).toBe('normal')
    expect(level(130)).toBe('normal')
  })

  it('high above 130%', () => {
    expect(level(131)).toBe('high')
  })
})

describe('daysElapsedInWeek', () => {
  it('Monday is day 1', () => {
    expect(daysElapsedInWeek(new Date('2024-06-10T09:00:00'))).toBe(1) // Monday
  })

  it('Tuesday is day 2', () => {
    expect(daysElapsedInWeek(new Date('2024-06-11T23:59:00'))).toBe(2)
  })

  it('Sunday is day 7', () => {
    expect(daysElapsedInWeek(new Date('2024-06-16T00:00:00'))).toBe(7)
  })

  it('is stable across different times of day on the same date', () => {
    const morning = daysElapsedInWeek(new Date('2024-06-13T00:05:00'))
    const evening = daysElapsedInWeek(new Date('2024-06-13T23:55:00'))
    expect(morning).toBe(evening)
    expect(morning).toBe(4) // Thursday
  })
})
