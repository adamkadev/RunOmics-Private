import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { HeatmapDay } from '@/application/usecases/GetHeatmapData'
import { consistencyMonths } from '@/components/consistency/consistencyMonths'
import { ConsistencyMonths } from '@/components/consistency/ConsistencyMonths'
import { t } from '@/i18n'

/** Every day from `from` to `to`, running on the dates in `runs` (long if in `long`). */
function window(from: string, to: string, runs: string[] = [], long: string[] = []): HeatmapDay[] {
  const days: HeatmapDay[] = []
  for (let d = new Date(`${from}T00:00:00Z`); d <= new Date(`${to}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
    const date = d.toISOString().slice(0, 10)
    const ran = runs.includes(date) || long.includes(date)
    days.push({ date, distanceKm: ran ? 10 : 0, sessionCount: ran ? 1 : 0, longRun: long.includes(date), activityId: ran ? `a-${date}` : null })
  }
  return days
}

const TODAY = '2026-09-26'
const YEAR = window('2025-09-22', TODAY, ['2026-09-02', '2026-02-10'], ['2026-09-20'])

describe('consistencyMonths', () => {
  // C1: twelve rolling months as columns, oldest on the left; 31 day rows.
  it('lays the rolling year out as twelve month columns of 31 rows', () => {
    const view = consistencyMonths(YEAR, TODAY)
    expect(view.months.map((m) => m.key)).toEqual([
      '2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03',
      '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09',
    ])
    for (const month of view.months) expect(month.cells).toHaveLength(31)
  })

  it('leaves out the days a month does not have: 28, 30 and 31-day months', () => {
    const view = consistencyMonths(YEAR, TODAY)
    const month = (key: string) => view.months.find((m) => m.key === key)!
    expect(month('2026-02').cells.filter(Boolean)).toHaveLength(28)
    expect(month('2026-02').cells[28]).toBeNull()
    expect(month('2026-04').cells.filter(Boolean)).toHaveLength(30)
    expect(month('2025-12').cells.filter(Boolean)).toHaveLength(31)
  })

  it('draws the current month partial: today ringed, the days after it still to come', () => {
    const view = consistencyMonths(YEAR, TODAY)
    const september = view.months[11]!
    expect(september.cells[25]).toMatchObject({ date: TODAY, today: true, state: 'rest' })
    expect(september.cells[26]!.state).toBe('future')
    expect(september.cells[29]!.state).toBe('future')
    expect(september.cells[30]).toBeNull()
  })

  it('reads rest, run and long run, and counts active days per month', () => {
    const view = consistencyMonths(YEAR, TODAY, 4)
    const september = view.months[11]!
    expect(september.cells[1]!.state).toBe('run')
    expect(september.cells[1]!.activityId).toBe('a-2026-09-02')
    expect(september.cells[19]!.state).toBe('long')
    expect(september.cells[0]!.state).toBe('rest')
    expect(september.activeDays).toBe(2)
    expect(view.activeDays).toBe(3)
    expect(view.streakWeeks).toBe(4)
  })

  it('marks January as the column that starts the year', () => {
    const view = consistencyMonths(YEAR, TODAY)
    expect(view.months.filter((m) => m.startsYear).map((m) => m.key)).toEqual(['2026-01'])
  })
})

describe('ConsistencyMonths', () => {
  it('states active days, share and streak, and names every level in words', () => {
    render(<ConsistencyMonths view={consistencyMonths(YEAR, TODAY, 4)} />)
    expect(screen.getByText(t.consistency.activeDays)).toBeInTheDocument()
    expect(screen.getByText(t.consistency.share)).toBeInTheDocument()
    expect(screen.getByText(t.consistency.streakValue(4))).toBeInTheDocument()
    for (const label of Object.values(t.consistency.levels)) expect(screen.getByText(label)).toBeInTheDocument()
    expect(screen.getAllByTestId('consistency-month')).toHaveLength(12)
    expect(screen.getByTestId('consistency-counts').textContent).toContain('2')
  })

  // C1: a run day opens its activity; a rest day says so.
  it('opens a run day and names a rest day', async () => {
    render(<ConsistencyMonths view={consistencyMonths(YEAR, TODAY)} />)
    const run = document.querySelector('a[href="/activities/a-2026-09-02"]')
    expect(run).not.toBeNull()

    const rest = document.querySelectorAll<HTMLButtonElement>('button[data-state="rest"]')[0]!
    await userEvent.click(rest)
    expect(screen.getByTestId('consistency-rest-day').textContent).toContain('Rest day')
  })

  it('says so when there is nothing to show', () => {
    render(<ConsistencyMonths view={consistencyMonths(window('2026-09-01', '2026-09-05'), '2026-09-05')} />)
    expect(screen.getByText(t.consistency.empty)).toBeInTheDocument()
  })
})
