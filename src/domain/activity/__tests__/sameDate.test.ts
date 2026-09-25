import { describe, expect, it } from 'vitest'
import { sameDateLastYear, yearToDate } from '../sameDate'

describe('sameDateLastYear', () => {
  it('is today one year earlier', () => {
    expect(sameDateLastYear('2026-09-25')).toBe('2025-09-25')
  })

  it('falls back to Feb 28 from a leap day', () => {
    expect(sameDateLastYear('2028-02-29')).toBe('2027-02-28')
  })
})

describe('yearToDate', () => {
  it('keeps a year up to and including the cut-off', () => {
    const runs = [{ date: '2025-04-03' }, { date: '2025-09-25' }, { date: '2025-09-26' }, { date: '2026-01-02' }]
    expect(yearToDate(runs, 2025, '2025-09-25').map((r) => r.date)).toEqual(['2025-04-03', '2025-09-25'])
  })
})
