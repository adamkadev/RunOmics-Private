import { describe, expect, it } from 'vitest'
import { formatCountdown, formatDate, formatDateRange, formatMonthShortYear } from '@/lib/formatters'
import { t } from '@/i18n'

const now = new Date('2026-09-16T00:00:00')

describe('formatDate', () => {
  it('omits the year for a date in the current year', () => {
    expect(formatDate('2026-06-27', { now })).toBe('Sat, Jun 27')
  })

  it('names the year for a date outside it, because the archive spans years', () => {
    expect(formatDate('2025-06-27', { now })).toBe('Fri, Jun 27, 2025')
  })

  /*
   * The formatter this replaces fell back to `{month, year:'2-digit'}` for
   * prior years, which dropped the day: a record set in March 2023 rendered
   * `Mar 23` and read as the 23rd of March. Whatever else a past date loses,
   * it keeps its day.
   */
  it('never drops the day from a prior-year date', () => {
    for (const options of [{ now }, { now, style: 'bare' as const }, { now, style: 'full' as const }]) {
      expect(formatDate('2023-03-04', options)).toMatch(/\b4\b/)
    }
  })

  it('drops the weekday when asked, and nothing else', () => {
    expect(formatDate('2026-06-27', { now, style: 'bare' })).toBe('Jun 27')
    expect(formatDate('2025-06-27', { now, style: 'bare' })).toBe('Jun 27, 2025')
  })

  it('spells the date out for speech, so an aria-label is not read as abbreviations', () => {
    expect(formatDate('2026-06-27', { now, style: 'full' })).toBe('Saturday, June 27')
  })

  it('stays silent about the year when a heading already states it', () => {
    expect(formatDate('2019-06-27', { now, year: 'never' })).toBe('Thu, Jun 27')
  })

  it('states the year on every tick of a multi-year axis, so the ticks compare', () => {
    expect(formatDate('2026-09-01', { now, precision: 'month', year: 'always' })).toBe('Sep 2026')
  })

  it('names the month alone when the day is not the point', () => {
    expect(formatDate('2026-05-13', { now, precision: 'month' })).toBe('May')
    expect(formatDate('2025-05-13', { now, precision: 'month' })).toBe('May 2025')
  })
})

describe('formatDateRange', () => {
  it('names both years, because the heatmap window straddles new year', () => {
    const label = formatDateRange('2025-09-15', '2026-09-16', { now, precision: 'month' })
    expect(label).toMatch(/Sep 2025/)
    expect(label).toMatch(/Sep 2026/)
  })

  it('collapses what the two ends share', () => {
    expect(formatDateRange('2026-09-01', '2026-09-16', { now, precision: 'month' })).toBe('Sep')
  })

  /*
   * formatRange repeats every field on both sides, so a weekday would be paid
   * for twice - `Mon, Sep 7 - Sun, Sep 13` for what `Sep 7 - 13` already says.
   */
  it('carries no weekday, even at the default style', () => {
    expect(formatDateRange('2026-09-07', '2026-09-13', { now })).not.toMatch(/Mon|Sun/)
  })

  // Screen audit, Oct 2026: the week spanning new year read "Dec 29, 2025 –
  // Jan 4, 2026" under a month heading that names the year.
  it('leaves the years out when told never, even across new year', () => {
    const label = formatDateRange('2025-12-29', '2026-01-04', { now, year: 'never' })
    expect(label).not.toMatch(/2025|2026/)
    expect(label).toMatch(/Dec 29/)
    expect(label).toMatch(/Jan 4/)
  })
})

describe('formatCountdown', () => {
  it('is the one future format: D-minus the day count', () => {
    expect(formatCountdown(39)).toBe(t.nextRace.countdown(39))
  })

  it('says the two ends of the count in words, because nobody says D-0', () => {
    expect(formatCountdown(0)).toBe(t.nextRace.today)
    expect(formatCountdown(1)).toBe(t.nextRace.tomorrow)
  })

  it('clamps a race already run, so no call site has to', () => {
    expect(formatCountdown(-4)).toBe(t.nextRace.today)
  })
})

describe('formatMonthShortYear', () => {
  it('fits a month and a year into a narrow cell', () => {
    expect(formatMonthShortYear('2025-05-14')).toBe('May ’25')
    expect(formatMonthShortYear('2025-12-01')).toBe('Dec ’25')
  })

  it('prints the year whatever year it is read in, unlike the auto rule', () => {
    expect(formatMonthShortYear('2026-09-16', { now })).toBe('Sep ’26')
  })

  it('never renders as a day of the month', () => {
    expect(formatMonthShortYear('2025-03-04')).not.toMatch(/^[A-Za-z]+ \d/)
  })
})
