import { isoDate } from '@/lib/calendarDate'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  MonthlyVolumeChart,
  volumePlotMaxKm,
  inProgressMonth,
} from '@/components/goals/MonthlyVolumeChart'
import type { MonthGoal } from '@/application/usecases/GetGoalsData'
import { monthName } from '@/lib/formatters'
import { monthInitials } from '@/components/goals/monthInitials'
import { t } from '@/i18n'

const s = t.goals.monthlyVolume

const NOW = new Date()
const TODAY = isoDate(NOW)
const THIS_YEAR = NOW.getFullYear()
const THIS_MONTH = NOW.getMonth() + 1

const DAYS_ELAPSED = NOW.getDate()
const PRO_RATA_KM = 87

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

describe('MonthlyVolumeChart (3.1)', () => {
  it('draws twelve columns under one target line, the months to come empty', () => {
    const { container } = render(<MonthlyVolumeChart monthlyGoals={goalsForThisYear()} year={THIS_YEAR} today={TODAY} />)
    expect(screen.getByText(s.target('165'))).toBeInTheDocument()
    expect(container.querySelectorAll('[data-testid="target-rule"]')).toHaveLength(1)
    // Every elapsed month has its bar, the running one included; none after it.
    expect(container.querySelectorAll('[title]')).toHaveLength(THIS_MONTH)
    expect(container.querySelector('[data-testid="monthly-volume"]')!.textContent).toContain(monthInitials().join(''))
  })

  it('fills the running month inside a dashed outline of its target, and says its pace', () => {
    render(<MonthlyVolumeChart monthlyGoals={goalsForThisYear()} year={THIS_YEAR} today={TODAY} />)
    const running = screen.getByTestId('running-month')
    expect(running.className).toContain('border-dashed')
    expect(running.querySelector('.bg-accent')).not.toBeNull()
    expect(screen.getByTestId('running-legend').textContent).toBe(s.running(monthName(THIS_MONTH), '40', s.pace.behind))
  })

  it('draws a short month in the accent at 40%, never a status colour', () => {
    const { container } = render(
      <MonthlyVolumeChart
        monthlyGoals={[{ month: 1, targetKm: 165, actualKm: 40, status: 'behind', progress: null }]}
        year={THIS_YEAR - 1}
        today={TODAY}
      />,
    )
    const bar = container.querySelector<HTMLElement>('[title]')!
    expect(bar.style.background).toBe('color-mix(in srgb, var(--accent) 40%, transparent)')
    expect(bar.dataset.status).toBe('short')
    expect(screen.queryByTestId('running-month')).toBeNull()
  })

  it('draws a hit month in the full accent', () => {
    const { container } = render(
      <MonthlyVolumeChart
        monthlyGoals={[{ month: 1, targetKm: 165, actualKm: 220, status: 'ahead', progress: null }]}
        year={THIS_YEAR - 1}
        today={TODAY}
      />,
    )
    const bar = container.querySelector<HTMLElement>('[title]')!
    expect(bar.style.background).toBe('var(--accent)')
  })
})
