import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
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
    days.push({ date, distanceKm: ran ? 10 : 0, sessionCount: ran ? 1 : 0, longRun: long.includes(date) })
  }
  return days
}

describe('consistencyMonths', () => {
  it('lays the rolling year out as one row per month, one cell per calendar day', () => {
    const view = consistencyMonths(window('2025-09-22', '2026-09-25'))
    expect(view.months.map((m) => m.key)).toHaveLength(13)
    expect(view.months[0]!.key).toBe('2025-09')
    expect(view.months.find((m) => m.key === '2026-02')!.cells).toHaveLength(28)
  })

  it('leaves days outside the window blank instead of calling them rest', () => {
    const view = consistencyMonths(window('2025-09-22', '2026-09-25'))
    const first = view.months[0]!
    expect(first.cells[20]!.level).toBeNull()
    expect(first.cells[21]!.level).toBe('rest')
    expect(view.months[view.months.length - 1]!.cells[25]!.level).toBeNull()
  })

  it('tells the two Septembers apart by giving the older one its year', () => {
    const view = consistencyMonths(window('2025-09-22', '2026-09-25'))
    expect(view.months[0]!.label).not.toBe(view.months[view.months.length - 1]!.label)
    expect(view.months[0]!.label).toContain('25')
  })

  it('uses three levels: rest, run and long run', () => {
    const view = consistencyMonths(window('2026-09-01', '2026-09-05', ['2026-09-02'], ['2026-09-04']))
    expect(view.months[0]!.cells.slice(0, 5).map((c) => c.level)).toEqual(['rest', 'run', 'rest', 'long', 'rest'])
    expect(view.activeDays).toBe(2)
    expect(view.sharePct).toBe(40)
    expect(view.months[0]!.longRuns).toBe(1)
  })
})

describe('ConsistencyMonths', () => {
  it('states active days and share of days, and names every level in words', () => {
    render(<ConsistencyMonths view={consistencyMonths(window('2026-09-01', '2026-09-05', ['2026-09-02'], ['2026-09-04']))} />)
    expect(screen.getByText(t.consistency.activeDays)).toBeInTheDocument()
    expect(screen.getByText('40%')).toBeInTheDocument()
    for (const label of Object.values(t.consistency.levels)) expect(screen.getByText(label)).toBeInTheDocument()
    expect(screen.getAllByTestId('consistency-month')).toHaveLength(1)
    expect(screen.getByRole('img', { name: /2 active days, 1 long run$/ })).toBeInTheDocument()
  })

  it('says so when there is nothing to show', () => {
    render(<ConsistencyMonths view={consistencyMonths([])} />)
    expect(screen.getByText(t.consistency.empty)).toBeInTheDocument()
  })
})
