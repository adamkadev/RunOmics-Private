import { describe, expect, it } from 'vitest'
import { monthLabel, monthName } from '@/lib/formatters'

describe('monthName', () => {
  // The month is 1-based because it is fed straight into an ISO string:
  // monthName(0) would build "2000-00-01" and render "Invalid Date".
  it('takes a 1-based month', () => {
    expect(monthName(1)).toBe('Jan')
    expect(monthName(12)).toBe('Dec')
  })

  it('names all twelve months without producing an invalid date', () => {
    const names = Array.from({ length: 12 }, (_, i) => monthName(i + 1))
    expect(names).toHaveLength(12)
    for (const name of names) expect(name).not.toMatch(/invalid/i)
    expect(new Set(names).size).toBe(12)
  })

  it('never emits a year, so it cannot repeat one already on the axis', () => {
    for (let m = 1; m <= 12; m += 1) expect(monthName(m)).not.toMatch(/\d{4}/)
  })
})

describe('monthLabel', () => {
  it('is monthName uppercased, so both share one vocabulary', () => {
    for (let m = 1; m <= 12; m += 1) expect(monthLabel(m)).toBe(monthName(m).toUpperCase())
  })
})
