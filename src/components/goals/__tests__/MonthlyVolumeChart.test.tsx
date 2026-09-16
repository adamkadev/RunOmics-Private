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

/**
 * Every elapsed month up to and including the running one, plus the rest of the
 * year as `pending`. The first elapsed month beat its target, the running month
 * is only part-filled.
 */
function goalsForThisYear(): MonthGoal[] {
  return Array.from({ length: 12 }, (_, i) => {
    const month = i + 1
    if (month > THIS_MONTH) return { month, targetKm: 165, actualKm: 0, status: 'pending' as const }
    if (month === THIS_MONTH) return { month, targetKm: 165, actualKm: 40, status: 'behind' as const }
    return { month, targetKm: 165, actualKm: 220, status: 'ahead' as const }
  })
}

describe('volumePlotMaxKm', () => {
  it('spans the tallest thing drawn, so a month over target is not clipped to its target', () => {
    const months: MonthGoal[] = [
      { month: 1, targetKm: 100, actualKm: 160, status: 'ahead' },
      { month: 2, targetKm: 100, actualKm: 100, status: 'ahead' },
    ]
    const max = volumePlotMaxKm(months)
    expect(max).toBeGreaterThanOrEqual(160)
    expect(160 / max).toBeGreaterThan(100 / max)
  })

  it('never divides by zero when no target and no volume exist', () => {
    expect(volumePlotMaxKm([{ month: 1, targetKm: 0, actualKm: 0, status: 'behind' }])).toBe(1)
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
  it('labels every elapsed month and none of the pending ones', () => {
    render(<MonthlyVolumeChart monthlyGoals={goalsForThisYear()} year={THIS_YEAR} />)
    const initials = Array.from({ length: THIS_MONTH }, (_, i) => monthLabel(i + 1).slice(0, 1))
    for (const initial of initials) {
      expect(screen.getAllByText(initial).length).toBeGreaterThan(0)
    }
    // One label per elapsed month, plus the bar titles - never a 13th column.
    expect(screen.getAllByTitle(/:/)).toHaveLength(THIS_MONTH)
  })

  it('states the target the dashed rule stands for, and draws one rule per month', () => {
    const { container } = render(
      <MonthlyVolumeChart monthlyGoals={goalsForThisYear()} year={THIS_YEAR} />,
    )
    expect(screen.getByText(s.targetRule('165'))).toBeInTheDocument()
    expect(container.querySelectorAll('[data-testid="target-rule"]')).toHaveLength(THIS_MONTH)
  })

  it('outlines the running month instead of filling it, and names its pro-rated status', () => {
    const { container } = render(
      <MonthlyVolumeChart monthlyGoals={goalsForThisYear()} year={THIS_YEAR} />,
    )
    expect(screen.getByText(`${monthLabel(THIS_MONTH)} · ${s.status.behind}`)).toBeInTheDocument()

    const bars = Array.from(container.querySelectorAll<HTMLElement>('[title]'))
    const running = bars[bars.length - 1]!
    expect(running.style.border).toMatch(/1px solid/)
    expect(running.style.background).toMatch(/14%/)

    const finished = bars[0]!
    expect(finished.style.border).toBe('')
  })

  it('does not spend pink on the behind state, which is amber everywhere else in the card', () => {
    const { container } = render(
      <MonthlyVolumeChart
        monthlyGoals={[{ month: 1, targetKm: 165, actualKm: 40, status: 'behind' }]}
        year={THIS_YEAR - 1}
      />,
    )
    const bar = container.querySelector<HTMLElement>('[title]')!
    // amber-500, the same hue as the behind icon and the behind label.
    expect(bar.style.background).toBe('rgb(245, 158, 11)')
    // Not roPink #e5396b, and not Plan's missed-session token.
    expect(bar.style.background).not.toContain('229, 57, 107')
    expect(bar.style.background).not.toContain('color-missed')
  })
})
