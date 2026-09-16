import { describe, expect, it } from 'vitest'
import { formatDate, monthRangeLabel } from '@/lib/formatters'

describe('formatDate', () => {
  const now = new Date('2026-09-16T00:00:00')

  it('omits the year for a date in the current year', () => {
    expect(formatDate('2026-06-27', now)).not.toMatch(/2026/)
  })

  it('names the year for a date outside it, because the archive spans years', () => {
    expect(formatDate('2025-06-27', now)).toMatch(/2025/)
  })

  it('still carries weekday, month and day either way', () => {
    expect(formatDate('2026-06-27', now)).toBe('Sat, Jun 27')
    expect(formatDate('2025-06-27', now)).toBe('Fri, Jun 27, 2025')
  })
})

describe('monthRangeLabel', () => {
  it('names both years, because the heatmap window straddles new year', () => {
    expect(monthRangeLabel('2025-09-15', '2026-09-16')).toMatch(/2025/)
    expect(monthRangeLabel('2025-09-15', '2026-09-16')).toMatch(/2026/)
  })

  it('collapses a range that opens and closes in the same month', () => {
    expect(monthRangeLabel('2026-09-01', '2026-09-16')).toBe('Sep 2026')
  })
})
