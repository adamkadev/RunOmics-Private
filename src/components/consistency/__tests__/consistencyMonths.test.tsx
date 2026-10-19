import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { HeatmapDay } from '@/application/usecases/GetHeatmapData'
import { ACCENT_LIFT, consistencyMonths, dayLevel, LEVEL_FILL } from '@/components/consistency/consistencyMonthsView'
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
const KM = { '2026-09-02': 6, '2026-05-12': 10, '2026-09-20': 18 }
const YEAR = window('2025-09-22', TODAY, KM)

describe('dayLevel', () => {
  // v4.17: rest, under 8 km, 8 to 15 km, 15 km and more.
  it('steps the accent ramp at 8 and 15 km', () => {
    expect(dayLevel(undefined)).toBe(0)
    expect(dayLevel({ distanceKm: 0, sessionCount: 0 })).toBe(0)
    expect(dayLevel({ distanceKm: 7.9, sessionCount: 1 })).toBe(1)
    expect(dayLevel({ distanceKm: 8, sessionCount: 1 })).toBe(2)
    expect(dayLevel({ distanceKm: 15, sessionCount: 2 })).toBe(3)
    // v4.17.1: the rest fill and the two tints are per-theme tokens; 3.0: a
    // long day is the accent lifted towards the ink, so every accent and both themes work.
    expect(LEVEL_FILL[0]).toBe('var(--level-rest)')
    expect(LEVEL_FILL[1]).toBe('color-mix(in srgb, var(--accent) var(--level-low), transparent)')
    expect(LEVEL_FILL[2]).toBe('color-mix(in srgb, var(--accent) var(--level-mid), transparent)')
    expect(LEVEL_FILL[3]).toBe(ACCENT_LIFT)
    expect(ACCENT_LIFT).toContain('var(--accent)')
  })
})

describe('consistencyMonths', () => {
  // 3.0: the last 26 weeks as Monday-first columns, which fit a phone.
  it('lays the last six months out as 26 week columns to this one', () => {
    const view = consistencyMonths(YEAR, TODAY)
    expect(view.weeks).toHaveLength(26)
    expect(view.weeks[0]!.start).toBe('2026-03-30')
    expect(view.weeks.at(-1)!.start).toBe('2026-09-21')
    for (const week of view.weeks) expect(week.days).toHaveLength(7)
  })

  it('names each month over its real week, the one that holds its first day', () => {
    const view = consistencyMonths(YEAR, TODAY)
    const labelled = view.weeks.filter((w) => w.monthLabel).map((w) => [w.start, w.monthLabel])
    // Apr 1, 2026 was a Wednesday: its week starts Mar 30. Jun 1 was a Monday.
    expect(labelled).toEqual([
      ['2026-03-30', 'Apr'], ['2026-04-27', 'May'], ['2026-06-01', 'Jun'], ['2026-06-29', 'Jul'], ['2026-07-27', 'Aug'], ['2026-08-31', 'Sep'],
    ])
  })

  it('outlines today and leaves the rest of its week to come, and no week after it', () => {
    const view = consistencyMonths(YEAR, TODAY)
    const last = view.weeks.at(-1)!
    expect(last.days[5]).toMatchObject({ date: TODAY, today: true, state: 'rest' })
    expect(last.days[6]!.state).toBe('future')
  })

  it('reads each run day by its km, and counts active days per month', () => {
    const view = consistencyMonths(YEAR, TODAY, { streakWeeks: 4, bestStreakWeeks: 11 })
    const cell = (date: string) => view.weeks.flatMap((w) => w.days).find((d) => d.date === date)!
    expect(cell('2026-09-02')).toMatchObject({ state: 'run', level: 1, activityId: 'a-2026-09-02' })
    expect(cell('2026-05-12')).toMatchObject({ state: 'run', level: 2 })
    expect(cell('2026-09-20')).toMatchObject({ state: 'run', level: 3 })
    expect(view.months).toHaveLength(12)
    // Two active days in 26 so far: on course for 2 of 30.
    expect(view.months.at(-1)).toMatchObject({ key: '2026-09', activeDays: 2, days: 26, inProgress: true, projected: 2 })
    expect(view.months.at(-2)).toMatchObject({ inProgress: false, projected: null })
    expect(view.activeDays).toBe(3)
    // Oct 1 to today.
    expect(view.windowDays).toBe(361)
    expect(view.runsPerWeek).toBe(Math.round((3 / (361 / 7)) * 10) / 10)
    expect(view).toMatchObject({ streakWeeks: 4, bestStreakWeeks: 11 })
  })

  it('projects the month under way at its pace so far', () => {
    const ten = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`2026-09-${String(i * 2 + 1).padStart(2, '0')}`, 5]))
    const view = consistencyMonths(window('2025-09-22', TODAY, ten), TODAY)
    // 10 active days in 26: 12 over September's 30.
    expect(view.months.at(-1)).toMatchObject({ activeDays: 10, projected: 12 })
  })

  it('compares runs a week with the year before, over the part the history covers', () => {
    const runs = ['2025-06-01', '2025-06-03', '2025-08-10', '2026-02-10', '2026-09-02', '2026-09-20']
    const view = consistencyMonths(YEAR, TODAY, { runDates: runs })
    // History from Jun 1 to Sep 30, 2025: 3 runs in 122 days.
    const prior = 3 / (122 / 7)
    expect(view.prior).toMatchObject({ runsPerWeek: Math.round(prior * 10) / 10, fullYear: false, months: 4 })
    expect(view.prior!.delta).toBe(Math.round((3 / (361 / 7) - prior) * 10) / 10)

    const full = consistencyMonths(YEAR, TODAY, { runDates: ['2024-10-01', ...runs] })
    expect(full.prior!.fullYear).toBe(true)

    // Too short a history before the window says nothing.
    expect(consistencyMonths(YEAR, TODAY, { runDates: ['2025-09-20', '2026-02-10'] }).prior).toBeNull()
  })
})

describe('ConsistencyMonths', () => {
  it('states active days, runs a week and the streak, and the ramp in words', () => {
    render(<ConsistencyMonths view={consistencyMonths(YEAR, TODAY, { streakWeeks: 4, bestStreakWeeks: 11 })} />)
    const stats = screen.getByTestId('consistency-stats')
    expect(stats.textContent).toContain(t.consistency.activeDays)
    expect(stats.textContent).toContain(t.consistency.ofDays(361))
    expect(stats.textContent).toContain(t.consistency.runsPerWeek)
    expect(stats.textContent).toContain(t.consistency.best(11))
    for (const label of Object.values(t.consistency.levels)) expect(screen.getByText(label)).toBeInTheDocument()
    expect(screen.getAllByTestId('consistency-month').filter((m) => m.textContent)).toHaveLength(6)
    expect(screen.getAllByTestId('month-bar')).toHaveLength(12)
  })

  // 3.0: 26 columns of at most 10 px fit the card; no sideways swipe.
  it('fits the calendar to the width, with no scroller', () => {
    render(<ConsistencyMonths view={consistencyMonths(YEAR, TODAY)} />)
    const calendar = screen.getByTestId('consistency-calendar')
    expect(calendar.className).not.toContain('overflow-x-auto')
    expect((calendar.lastElementChild as HTMLElement).style.gridTemplateColumns).toBe('12px repeat(26, minmax(0, 10px))')
  })

  // v4.17.1: 16 active days or more is the full accent, fewer the ramp's lowest tint.
  it('draws a month of 16 active days or more in the full accent, against a dashed target line', () => {
    const sixteen = Object.fromEntries(Array.from({ length: 16 }, (_, i) => [`2026-08-${String(i + 1).padStart(2, '0')}`, 5]))
    const fifteen = Object.fromEntries(Array.from({ length: 15 }, (_, i) => [`2026-07-${String(i + 1).padStart(2, '0')}`, 5]))
    render(<ConsistencyMonths view={consistencyMonths(window('2025-09-22', TODAY, { ...fifteen, ...sixteen }), TODAY)} />)
    const bars = screen.getAllByTestId('month-bar')
    expect(bars.at(-2)!.dataset.strong).toBe('true')
    expect(bars.at(-2)!.style.background).toBe('var(--accent)')
    expect(bars.at(-3)!.dataset.strong).toBe('false')
    expect(bars.at(-3)!.style.background).toBe(LEVEL_FILL[1])
    expect(screen.getByTestId('month-target').style.bottom).toBe('48px')
    expect(screen.getByText(t.consistency.target(16))).toBeInTheDocument()
  })

  // 3.0: the month under way is filled for its days so far, its projection a dashed box on top.
  it('fills the month under way so far, with its projection dashed on top', () => {
    const ten = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`2026-09-${String(i * 2 + 1).padStart(2, '0')}`, 5]))
    render(<ConsistencyMonths view={consistencyMonths(window('2025-09-22', TODAY, ten), TODAY)} />)
    const now = screen.getAllByTestId('month-bar').at(-1)!
    expect(now.dataset.inProgress).toBe('true')
    expect(now.style.height).toBe('30px')
    const box = screen.getByTestId('month-projection')
    expect(box.style.height).toBe('6px')
    expect(box.className).toContain('border-dashed')
    expect(box.className).toContain('border-accent')
  })

  it('colours the change in runs a week by what it means', () => {
    const runs = ['2025-06-01', '2025-06-03', '2025-08-10', '2026-02-10', '2026-09-02', '2026-09-20']
    render(<ConsistencyMonths view={consistencyMonths(YEAR, TODAY, { runDates: runs })} />)
    const prior = screen.getByTestId('consistency-prior')
    // Fewer runs a week than the year before is a caution.
    expect(prior.textContent).toBe(t.consistency.vsMonths('−0.1', 4))
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
