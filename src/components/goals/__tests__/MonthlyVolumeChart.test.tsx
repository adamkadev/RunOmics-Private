import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  MonthlyVolumeChart,
  volumePlotMaxKm,
  inProgressMonth,
} from '@/components/goals/MonthlyVolumeChart'
import type { MonthGoal } from '@/application/usecases/GetGoalsData'
import { monthLabel } from '@/lib/formatters'
import { t } from '@/i18n'

const s = t.goals.monthlyVolume

const NOW = new Date()
const THIS_YEAR = NOW.getFullYear()
const THIS_MONTH = NOW.getMonth() + 1

const DAYS_ELAPSED = NOW.getDate()
const PRO_RATA_KM = 87

/**
 * Every elapsed month up to and including the running one, plus the rest of the
 * year as `pending`. The first elapsed month beat its target, the running month
 * is only part-filled.
 */
function goalsForThisYear(): MonthGoal[] {
  return Array.from({ length: 12 }, (_, i) => {
    const month = i + 1
    if (month > THIS_MONTH) return { month, targetKm: 165, actualKm: 0, status: 'pending' as const, progress: null }
    if (month === THIS_MONTH) {
      return {
        month,
        targetKm: 165,
        actualKm: 40,
        status: 'behind' as const,
        progress: { daysElapsed: DAYS_ELAPSED, daysInMonth: 30, proRataTargetKm: PRO_RATA_KM },
      }
    }
    return { month, targetKm: 165, actualKm: 220, status: 'ahead' as const, progress: null }
  })
}

describe('volumePlotMaxKm', () => {
  it('spans the tallest thing drawn, so a month over target is not clipped to its target', () => {
    const months: MonthGoal[] = [
      { month: 1, targetKm: 100, actualKm: 160, status: 'ahead', progress: null },
      { month: 2, targetKm: 100, actualKm: 100, status: 'ahead', progress: null },
    ]
    const max = volumePlotMaxKm(months)
    expect(max).toBeGreaterThanOrEqual(160)
    expect(160 / max).toBeGreaterThan(100 / max)
  })

  it('never divides by zero when no target and no volume exist', () => {
    expect(volumePlotMaxKm([{ month: 1, targetKm: 0, actualKm: 0, status: 'behind', progress: null }])).toBe(1)
    expect(volumePlotMaxKm([])).toBe(1)
  })
})

describe('inProgressMonth', () => {
  const months = goalsForThisYear()

  it('finds the running month in the current year', () => {
    expect(inProgressMonth(months, THIS_YEAR)?.month).toBe(THIS_MONTH)
  })

  it('returns null for a year that is over, so no bar is drawn as unfinished', () => {
    expect(inProgressMonth(months, THIS_YEAR - 1)).toBeNull()
  })
})

describe('MonthlyVolumeChart collapsed axis', () => {
  it('names its months in full, and thins the axis rather than truncating it', () => {
    render(<MonthlyVolumeChart monthlyGoals={goalsForThisYear()} year={THIS_YEAR} />)

    // A single initial cannot name the month it sits under: J is January, June
    // and July. So the axis prints the whole abbreviation and drops every other
    // label once the row is too narrow to carry them all.
    const shown = Array.from({ length: THIS_MONTH }, (_, i) => monthLabel(i + 1))
      .filter((label) => screen.queryAllByText(label).length > 0)

    expect(shown.length).toBeGreaterThan(0)
    for (const label of shown) expect(label.length).toBeGreaterThan(1)
    if (THIS_MONTH > 6) expect(shown.length).toBeLessThan(THIS_MONTH)
    else expect(shown).toHaveLength(THIS_MONTH)

    // Every elapsed month still has its own bar, labelled or not - never a 13th.
    expect(screen.getAllByTitle(/:/)).toHaveLength(THIS_MONTH)
  })

  it('states the target the dashed rule stands for, and draws one rule per month', () => {
    const { container } = render(
      <MonthlyVolumeChart monthlyGoals={goalsForThisYear()} year={THIS_YEAR} />,
    )
    expect(screen.getByText(s.targetRule)).toBeInTheDocument()
    expect(container.querySelectorAll('[data-testid="target-rule"]')).toHaveLength(THIS_MONTH)
  })

  it('outlines the running month instead of filling it, and states how far into it we are', () => {
    const { container } = render(
      <MonthlyVolumeChart monthlyGoals={goalsForThisYear()} year={THIS_YEAR} />,
    )
    expect(
      screen.getByText(
        `${s.daysIn(monthLabel(THIS_MONTH), DAYS_ELAPSED)} · ${s.proRata(40, PRO_RATA_KM)}`,
      ),
    ).toBeInTheDocument()
    expect(
      screen.queryByText(`${monthLabel(THIS_MONTH)} · ${s.status.behind}`),
    ).not.toBeInTheDocument()

    const bars = Array.from(container.querySelectorAll<HTMLElement>('[title]'))
    const running = bars[bars.length - 1]!
    expect(running.style.border).toMatch(/1px solid/)
    expect(running.style.background).toMatch(/14%/)

    const finished = bars[0]!
    expect(finished.style.border).toBe('')
  })

  it('draws behind in one hue the bar, the icon and the label all share', () => {
    const { container } = render(
      <MonthlyVolumeChart
        monthlyGoals={[{ month: 1, targetKm: 165, actualKm: 40, status: 'behind', progress: null }]}
        year={THIS_YEAR - 1}
      />,
    )
    const bar = container.querySelector<HTMLElement>('[title]')!
    // red-500, matching STATUS.danger which the behind icon and label now use.
    expect(bar.style.background).toBe('rgb(239, 68, 68)')
    // Not roPink #e5396b, and not Plan's missed-session token.
    expect(bar.style.background).not.toContain('229, 57, 107')
    expect(bar.style.background).not.toContain('color-missed')
    // Not amber: `ahead` is var(--accent), and the motivation accent is orange,
    // so an amber `behind` and an `ahead` drew the same bar on that theme.
    expect(bar.style.background).not.toBe('rgb(245, 158, 11)')
  })
})
