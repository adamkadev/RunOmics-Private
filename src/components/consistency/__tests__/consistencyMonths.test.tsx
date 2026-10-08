import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { HeatmapDay } from '@/application/usecases/GetHeatmapData'
import { consistencyMonths, dayLevel, LEVEL_FILL } from '@/components/consistency/consistencyMonths'
import { ConsistencyMonths } from '@/components/consistency/ConsistencyMonths'
import { t } from '@/i18n'

/** Every day from `from` to `to`, running `km[date]` km on the dates it names. */
function window(from: string, to: string, km: Record<string, number> = {}): HeatmapDay[] {
  const days: HeatmapDay[] = []
  for (let d = new Date(`${from}T00:00:00Z`); d <= new Date(`${to}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
    const date = d.toISOString().slice(0, 10)
    const ran = km[date] !== undefined
    days.push({ date, distanceKm: km[date] ?? 0, sessionCount: ran ? 1 : 0, longRun: false, activityId: ran ? `a-${date}` : null })
  }
  return days
}

// A Saturday.
const TODAY = '2026-09-26'
const KM = { '2026-09-02': 6, '2026-02-10': 10, '2026-09-20': 18 }
const YEAR = window('2025-09-22', TODAY, KM)

describe('dayLevel', () => {
  // v4.17: rest, under 8 km, 8 to 15 km, 15 km and more.
  it('steps the accent ramp at 8 and 15 km', () => {
    expect(dayLevel(undefined)).toBe(0)
    expect(dayLevel({ distanceKm: 0, sessionCount: 0 })).toBe(0)
    expect(dayLevel({ distanceKm: 7.9, sessionCount: 1 })).toBe(1)
    expect(dayLevel({ distanceKm: 8, sessionCount: 1 })).toBe(2)
    expect(dayLevel({ distanceKm: 15, sessionCount: 2 })).toBe(3)
    // v4.17.1: the rest fill and the two tints are per-theme tokens.
    expect(LEVEL_FILL[0]).toBe('var(--level-rest)')
    expect(LEVEL_FILL[1]).toBe('color-mix(in srgb, var(--accent) var(--level-low), transparent)')
    expect(LEVEL_FILL[2]).toBe('color-mix(in srgb, var(--accent) var(--level-mid), transparent)')
    expect(LEVEL_FILL[3]).toBe('var(--accent)')
  })
})

describe('consistencyMonths', () => {
  // v4.17: the twelve calendar months to this one, as Monday-first week columns.
  it('lays the rolling year out as week columns from the Monday before its first day', () => {
    const view = consistencyMonths(YEAR, TODAY)
    // Oct 1, 2025 was a Wednesday; its week starts Sep 29.
    expect(view.weeks[0]!.start).toBe('2025-09-29')
    expect(view.weeks.at(-1)!.start).toBe('2026-09-28')
    expect(view.weeks).toHaveLength(53)
    for (const week of view.weeks) expect(week.days).toHaveLength(7)
    // The days before the window are blank, not rest.
    expect(view.weeks[0]!.days.slice(0, 2).map((d) => d.state)).toEqual(['none', 'none'])
    expect(view.weeks[0]!.days[2]).toMatchObject({ date: '2025-10-01', state: 'rest' })
  })

  it('names each month over the column it starts, the first for the window', () => {
    const view = consistencyMonths(YEAR, TODAY)
    const labelled = view.weeks.filter((w) => w.monthLabel).map((w) => w.monthLabel)
    expect(labelled).toEqual(['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'])
  })

  it('outlines today and leaves the days after it to come', () => {
    const view = consistencyMonths(YEAR, TODAY)
    const lastFull = view.weeks.at(-2)!
    expect(lastFull.days[5]).toMatchObject({ date: TODAY, today: true, state: 'rest' })
    expect(lastFull.days[6]!.state).toBe('future')
    expect(view.weeks.at(-1)!.days.every((d) => d.state === 'future')).toBe(true)
  })

  it('reads each run day by its km, and counts active days per month', () => {
    const view = consistencyMonths(YEAR, TODAY, { streakWeeks: 4, bestStreakWeeks: 11 })
    const cell = (date: string) => view.weeks.flatMap((w) => w.days).find((d) => d.date === date)!
    expect(cell('2026-09-02')).toMatchObject({ state: 'run', level: 1, activityId: 'a-2026-09-02' })
    expect(cell('2026-02-10')).toMatchObject({ state: 'run', level: 2 })
    expect(cell('2026-09-20')).toMatchObject({ state: 'run', level: 3 })
    expect(view.months).toHaveLength(12)
    expect(view.months.at(-1)).toMatchObject({ key: '2026-09', activeDays: 2, days: 26 })
    expect(view.activeDays).toBe(3)
    // Oct 1 to today.
    expect(view.windowDays).toBe(361)
    expect(view).toMatchObject({ streakWeeks: 4, bestStreakWeeks: 11 })
  })

  it('compares the share with the year before, over the part the history covers', () => {
    const runs = ['2025-06-01', '2025-06-03', '2025-08-10', '2026-02-10', '2026-09-02', '2026-09-20']
    const view = consistencyMonths(YEAR, TODAY, { runDates: runs })
    // History from Jun 1 to Sep 30, 2025: 3 of 122 days, 2% against 1% now.
    expect(view.prior).toMatchObject({ sharePct: 2, fullYear: false })
    expect(view.prior!.deltaPts).toBe(Math.round((3 / 361 - 3 / 122) * 100))

    const full = consistencyMonths(YEAR, TODAY, { runDates: ['2024-10-01', ...runs] })
    expect(full.prior!.fullYear).toBe(true)

    // Too short a history before the window says nothing.
    expect(consistencyMonths(YEAR, TODAY, { runDates: ['2025-09-20', '2026-02-10'] }).prior).toBeNull()
  })
})

describe('ConsistencyMonths', () => {
  it('states active days, the share and the streak, and the ramp in words', () => {
    render(<ConsistencyMonths view={consistencyMonths(YEAR, TODAY, { streakWeeks: 4, bestStreakWeeks: 11 })} />)
    const stats = screen.getByTestId('consistency-stats')
    expect(stats.textContent).toContain(t.consistency.activeDays)
    // v4.17.2: the days it counts of, and from when - the first of October,
    // with its year (design review, Oct 2026: "since Nov 1" named none).
    expect(stats.textContent).toContain(t.consistency.ofDays(361, 'Oct 1, 2025'))
    expect(stats.textContent).toContain(t.consistency.share)
    expect(stats.textContent).toContain(t.consistency.best(11))
    for (const label of Object.values(t.consistency.levels)) expect(screen.getByText(label)).toBeInTheDocument()
    expect(screen.getAllByTestId('consistency-month').filter((m) => m.textContent)).toHaveLength(12)
    expect(screen.getAllByTestId('month-bar')).toHaveLength(12)
  })

  // v4.17.1: 16 active days or more is the full accent, fewer the ramp's lowest tint.
  it('draws a month of 16 active days or more in the full accent', () => {
    const sixteen = Object.fromEntries(Array.from({ length: 16 }, (_, i) => [`2026-08-${String(i + 1).padStart(2, '0')}`, 5]))
    const fifteen = Object.fromEntries(Array.from({ length: 15 }, (_, i) => [`2026-07-${String(i + 1).padStart(2, '0')}`, 5]))
    render(<ConsistencyMonths view={consistencyMonths(window('2025-09-22', TODAY, { ...fifteen, ...sixteen }), TODAY)} />)
    const bars = screen.getAllByTestId('month-bar')
    expect(bars.at(-2)!.dataset.strong).toBe('true')
    expect(bars.at(-2)!.style.background).toBe('var(--accent)')
    expect(bars.at(-3)!.dataset.strong).toBe('false')
    expect(bars.at(-3)!.style.background).toBe(LEVEL_FILL[1])
  })

  // Design review, Oct 2026: five days into October, its 5 read as a weak month.
  it('draws the month under way dashed, neither strong nor weak', () => {
    const sixteen = Object.fromEntries(Array.from({ length: 16 }, (_, i) => [`2026-09-${String(i + 1).padStart(2, '0')}`, 5]))
    render(<ConsistencyMonths view={consistencyMonths(window('2025-09-22', TODAY, sixteen), TODAY)} />)
    const now = screen.getAllByTestId('month-bar').at(-1)!
    expect(now.dataset.inProgress).toBe('true')
    expect(now.dataset.strong).toBe('false')
    expect(now.style.background).toBe('transparent')
    expect(now.style.border).toContain('dashed')
    expect(screen.getByText(t.consistency.monthLegend.soFar)).toBeInTheDocument()
  })

  it('colours the change in the share by what it means', () => {
    const runs = ['2025-06-01', '2025-06-03', '2025-08-10', '2026-02-10', '2026-09-02', '2026-09-20']
    render(<ConsistencyMonths view={consistencyMonths(YEAR, TODAY, { runDates: runs })} />)
    const prior = screen.getByTestId('consistency-prior')
    // Fewer days run than the year before is a caution.
    expect(prior.textContent).toBe(t.consistency.vsMonths('−2', 4))
    expect(prior.parentElement!.className).toContain('text-[var(--warn)]')
  })

  // C1: a run day opens its activity; a rest day says so.
  it('opens a run day and names a rest day', async () => {
    render(<ConsistencyMonths view={consistencyMonths(YEAR, TODAY)} />)
    const run = document.querySelector('a[href="/activities/a-2026-09-02"]')
    expect(run).not.toBeNull()
    expect(run!.getAttribute('aria-label')).toContain('6.0 km')

    const rest = document.querySelectorAll<HTMLButtonElement>('button[data-state="rest"]')[0]!
    await userEvent.click(rest)
    expect(screen.getByTestId('consistency-rest-day').textContent).toContain('Rest day')
  })

  it('says so when there is nothing to show', () => {
    render(<ConsistencyMonths view={consistencyMonths(window('2026-09-01', '2026-09-05'), '2026-09-05')} />)
    expect(screen.getByText(t.consistency.empty)).toBeInTheDocument()
  })
})
