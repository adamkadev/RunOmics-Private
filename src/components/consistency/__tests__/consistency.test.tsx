import { describe, it, expect, beforeEach } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { activeDaysInYear, dayLevel } from '@/components/consistency/consistencyRamp'
import { consistencyView, parseRange, sheetMonths, shiftMonth, weekSheet, type ConsistencyInput, type ConsistencyRange, type ConsistencyView } from '@/components/consistency/consistencyView'
import { Consistency, dotGeometry } from '@/components/consistency/Consistency'
import { t } from '@/i18n'

const run = (date: string, km = 8, seconds = 2400) => ({ date, distanceKm: km, durationSeconds: seconds })

/** `n` runs in the week of `monday`, from its Tuesday on. */
function week(monday: string, n: number) {
  return Array.from({ length: n }, (_, i) => run(new Date(Date.parse(`${monday}T00:00:00Z`) + (i + 1) * 86_400_000).toISOString().slice(0, 10)))
}

// A Monday, with nothing run yet.
const TODAY = '2026-10-19'
// Thirteen weeks done: three on target, then one under, then nine on target.
const MONDAYS = Array.from({ length: 13 }, (_, i) => new Date(Date.parse('2026-07-20T00:00:00Z') + i * 7 * 86_400_000).toISOString().slice(0, 10))
const RUNS = MONDAYS.flatMap((monday, i) => week(monday, i === 3 ? 1 : i % 2 ? 4 : 3))
const INPUT: ConsistencyInput = { runs: RUNS, today: TODAY, streakWeeks: 9, bestStreakWeeks: 9, plannedDates: ['2026-10-20', '2026-10-22', '2026-11-03'] }

describe('the ramp the Progress hub draws', () => {
  it('steps the accent ramp at 8 and 15 km', () => {
    expect(dayLevel(undefined)).toBe(0)
    expect(dayLevel({ distanceKm: 7.9, sessionCount: 1 })).toBe(1)
    expect(dayLevel({ distanceKm: 8, sessionCount: 1 })).toBe(2)
    expect(dayLevel({ distanceKm: 15, sessionCount: 2 })).toBe(3)
  })

  it('counts the days run over the twelve calendar months to this one', () => {
    const days = ['2025-10-31', '2025-11-01', '2026-10-19', '2026-10-20'].map((date) => ({ date, distanceKm: 5, sessionCount: 1, longRun: false, activityId: date }))
    expect(activeDaysInYear(days, TODAY)).toBe(2)
  })
})

describe('consistencyView', () => {
  it('reads the range from the URL, 6M by default', () => {
    expect(parseRange('3m')).toBe('3m')
    expect(parseRange('1y')).toBe('1y')
    expect(parseRange('5y')).toBe('6m')
    expect(parseRange(null)).toBe('6m')
  })

  it('counts the weeks done since the first run, then the week under way', () => {
    const view = consistencyView('6m', INPUT)
    expect(view.weeks).toHaveLength(14)
    expect(view.weeks.at(-1)).toMatchObject({ start: TODAY, current: true, runs: 0, planned: 2 })
    expect(view.weeksCounted).toBe(13)
    expect(view.weeksOnTarget).toBe(12)
    expect(view.runs).toBe(RUNS.length)
    expect(view.runsPerWeek).toBe(Math.round((RUNS.length / 13) * 10) / 10)
    expect(view.thisWeek).toEqual({ runs: 0, planned: 2 })
  })

  it('keeps to the window: 3M is the last 13 weeks', () => {
    const older = [...week('2026-01-05', 5), ...RUNS]
    const view = consistencyView('3m', { ...INPUT, runs: older })
    expect(view.weeksCounted).toBe(13)
    expect(view.weeks[0]!.start).toBe('2026-07-20')
  })

  it('underlines the streak back from last week while this one is under target', () => {
    const view = consistencyView('6m', INPUT)
    const streak = view.weeks.filter((w) => w.inStreak).map((w) => w.start)
    expect(streak).toEqual(MONDAYS.slice(4))
    // A streak longer than its weeks on target stops at the week under.
    expect(consistencyView('6m', { ...INPUT, streakWeeks: 40 }).weeks.filter((w) => w.inStreak)).toHaveLength(9)
  })

  it('names a month under the week that holds its first day', () => {
    const view = consistencyView('6m', INPUT)
    expect(view.weeks.filter((w) => w.month).map((w) => [w.start, w.month])).toEqual([
      ['2026-07-27', '2026-08-01'],
      ['2026-08-31', '2026-09-01'],
      ['2026-09-28', '2026-10-01'],
    ])
  })

  it('finds the anchor day and a weekday hardly run', () => {
    const view = consistencyView('6m', INPUT)
    // Every week runs Tuesday on; Monday never.
    expect(view.weekdays[1]).toBe(13)
    expect(view.weekdays[0]).toBe(0)
    expect(view.anchor).toBe(1)
    expect(view.restDay).toBe(0)
  })

  it('is empty without a run', () => {
    expect(consistencyView('6m', { ...INPUT, runs: [] }).weeks).toEqual([])
  })
})

describe('weekSheet', () => {
  it('lays out the month around the week, the week picked out with its runs', () => {
    const view = consistencyView('6m', INPUT)
    const sheet = weekSheet(view, '2026-10-12', TODAY)!
    expect(sheet.status).toBe('hit')
    expect(sheet.week.runs).toBe(3)
    expect(sheet.rows.map((row) => row.start)).toEqual(['2026-09-28', '2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26'])
    expect(sheet.rows.find((row) => row.selected)!.start).toBe('2026-10-12')
    expect(sheet.rows.map((row) => row.status)).toEqual(['hit', 'hit', 'hit', 'current', 'future'])
    const now = sheet.rows[3]!.days
    expect(now[0]).toMatchObject({ today: true, runs: 0 })
    expect(now.filter((day) => day.planned).map((day) => day.date)).toEqual(['2026-10-20', '2026-10-22'])
    expect(sheet.rows[0]!.days[0]).toMatchObject({ day: 28, inMonth: false })
  })

  it('shows another month around the same week, the week picked out only where it falls', () => {
    const view = consistencyView('6m', INPUT)
    const september = weekSheet(view, '2026-10-12', TODAY, '2026-09')!
    expect(september.month).toBe('2026-09')
    expect(september.week.start).toBe('2026-10-12')
    expect(september.rows.some((row) => row.selected)).toBe(false)
    expect(september.rows.at(-1)!.start).toBe('2026-09-28')
    expect(weekSheet(view, '2026-09-28', TODAY, '2026-10')!.rows[0]!.selected).toBe(true)
  })

  it('pages from the first week\'s month to this one', () => {
    expect(sheetMonths(consistencyView('6m', INPUT), TODAY)).toEqual({ first: '2026-07', last: '2026-10' })
    expect(sheetMonths(consistencyView('6m', { ...INPUT, runs: [] }), TODAY)).toBeNull()
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
  })

  it('reads a week under three as under target', () => {
    expect(weekSheet(consistencyView('6m', INPUT), MONDAYS[3]!, TODAY)!.status).toBe('under')
  })
})

describe('Consistency', () => {
  const views = Object.fromEntries((['3m', '6m', '1y'] as const).map((r) => [r, consistencyView(r, INPUT)])) as Record<ConsistencyRange, ConsistencyView>
  beforeEach(() => window.history.replaceState(null, '', '/consistency'))

  it('states the streak, this week against three and the window', () => {
    render(<Consistency views={views} today={TODAY} />)
    expect(screen.getByTestId('streak-weeks').textContent).toBe('9')
    expect(screen.getByText(t.consistency.streakRule(3, 9))).toBeTruthy()
    const thisWeek = screen.getByTestId('consistency-this-week')
    expect(thisWeek.querySelectorAll('[data-filled]')).toHaveLength(0)
    expect(thisWeek.textContent).toContain(`${t.consistency.thisWeekRuns(0, 3)} · ${t.consistency.planned(2)}`)
    expect(screen.getByTestId('consistency-stats').textContent).toContain('12/13')
  })

  it('draws a dot a run, on target in the accent, under it grey, the sessions to come dashed', () => {
    render(<Consistency views={views} today={TODAY} />)
    expect(screen.getAllByTestId('week-column')).toHaveLength(14)
    expect(screen.getAllByTestId('run-dot')).toHaveLength(RUNS.length)
    expect(screen.getAllByTestId('planned-dot')).toHaveLength(2)
    const under = screen.getAllByTestId('week-column')[3]!
    expect(under.querySelector('[data-testid="run-dot"]')!.getAttribute('fill')).toBe('var(--band)')
    expect(screen.getAllByTestId('week-column')[0]!.querySelector('[data-testid="run-dot"]')!.getAttribute('fill')).toBe('var(--accent)')
    expect(screen.getByTestId('target-line')).toBeTruthy()
    expect(screen.getByTestId('streak-underline')).toBeTruthy()
  })

  it('switches the window and keeps it in the URL', async () => {
    render(<Consistency views={views} today={TODAY} />)
    await userEvent.click(screen.getByRole('tab', { name: t.consistency.rangesSpoken['3m'] }))
    expect(window.location.search).toBe('?range=3m')
    await userEvent.click(screen.getByRole('tab', { name: t.consistency.rangesSpoken['6m'] }))
    expect(window.location.search).toBe('')
  })

  it('names the anchor day and the rest day', () => {
    render(<Consistency views={views} today={TODAY} />)
    const sentence = screen.getByTestId('weekday-sentence').textContent!
    expect(sentence).toContain(t.consistency.anchorWeeks(13, 13))
    expect(screen.getAllByTestId('weekday-bar').filter((bar) => bar.dataset.anchor)).toHaveLength(1)
    expect(screen.getAllByTestId('weekday-bar')[0]!.dataset.stub).toBe('true')
  })

  it('opens a tapped week in a sheet, with the way to its runs', async () => {
    render(<Consistency views={views} today={TODAY} />)
    await userEvent.click(screen.getAllByTestId('week-column')[12]!)
    const sheet = screen.getByTestId('week-sheet')
    expect(within(sheet).getByTestId('week-status').textContent).toBe(t.consistency.sheet.hit)
    expect(within(sheet).getByTestId('week-activities').getAttribute('href')).toBe('/activities?week=2026-10-12')
    const selected = within(sheet).getAllByTestId('calendar-row').find((row) => row.dataset.selected)
    expect(selected).toBeTruthy()
    expect(selected!.getAttribute('aria-label')).toBe('Oct 12 – 18')
    expect(screen.getByTestId('week-selected')).toBeTruthy()
  })

  it('pages the sheet\'s month with a swipe or its arrows, never past this month or before the first run', async () => {
    render(<Consistency views={views} today={TODAY} />)
    await userEvent.click(screen.getAllByTestId('week-column')[12]!)
    const calendar = screen.getByTestId('week-calendar')
    const next = screen.getByRole('button', { name: t.consistency.sheet.nextMonth })
    const prev = screen.getByRole('button', { name: t.consistency.sheet.prevMonth })
    expect(calendar.dataset.month).toBe('2026-10')
    expect((next as HTMLButtonElement).disabled).toBe(true)

    fireEvent.touchStart(calendar, { touches: [{ clientX: 100, clientY: 300 }] })
    fireEvent.touchEnd(calendar, { touches: [], changedTouches: [{ clientX: 220, clientY: 310 }] })
    expect(calendar.dataset.month).toBe('2026-09')
    expect(calendar.querySelector('[data-selected]')).toBeNull()

    await userEvent.click(prev)
    await userEvent.click(prev)
    expect(calendar.dataset.month).toBe('2026-07')
    expect((prev as HTMLButtonElement).disabled).toBe(true)
    fireEvent.touchStart(calendar, { touches: [{ clientX: 100, clientY: 300 }] })
    fireEvent.touchEnd(calendar, { touches: [], changedTouches: [{ clientX: 220, clientY: 300 }] })
    expect(calendar.dataset.month).toBe('2026-07')

    await userEvent.click(next)
    await userEvent.click(next)
    await userEvent.click(next)
    expect(calendar.dataset.month).toBe('2026-10')
    expect(calendar.querySelector('[data-selected]')!.getAttribute('aria-label')).toBe('Oct 12 – 18')
    expect(screen.getByTestId('week-activities').getAttribute('href')).toBe('/activities?week=2026-10-12')
  })

  it('marks other training on its own row and its own days, never as a run toward the target', async () => {
    const strength = { id: 'x1', date: '2026-10-14', kind: 'strength' as const, durationSeconds: 2700, distanceKm: null, sets: null }
    const view = consistencyView('6m', { ...INPUT, others: [strength] })
    const plain = consistencyView('6m', INPUT)
    render(<Consistency views={{ '3m': view, '6m': view, '1y': view }} today={TODAY} />)

    expect(view.weeks.map((w) => [w.runs, w.onTarget, w.inStreak])).toEqual(plain.weeks.map((w) => [w.runs, w.onTarget, w.inStreak]))
    expect(screen.getAllByTestId('other-mark')).toHaveLength(1)
    expect(screen.getAllByTestId('run-dot')).toHaveLength(RUNS.length)
    await userEvent.click(screen.getAllByTestId('week-column')[12]!)
    const sheet = screen.getByTestId('week-sheet')
    expect(sheet.querySelector('[data-others]')!.textContent).toBe('14')
    expect(within(sheet).getByTestId('week-cross-training').textContent).toContain(t.crossTraining.kinds.strength)
  })

  it('fits a year of weeks to the width', () => {
    const { dot, step } = dotGeometry(53)
    expect(dot).toBeLessThan(step)
    expect(dotGeometry(27).dot).toBe(9)
  })

  it('says so when there is nothing to show', () => {
    const empty = consistencyView('6m', { ...INPUT, runs: [] })
    render(<Consistency views={{ '3m': empty, '6m': empty, '1y': empty }} today={TODAY} />)
    expect(screen.getByText(t.consistency.empty)).toBeTruthy()
  })
})
