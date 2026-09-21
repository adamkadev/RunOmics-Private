import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ProfileGoal } from '../ProfileGoal'
import type { ProfileGoal as ProfileGoalData } from '@/application/usecases/GetProfileData'
import { PROJECTION_TONE } from '@/lib/statusColors'
import { t } from '@/i18n'

function behindGoal(): ProfileGoalData {
  return {
    goalYear: { year: 2026, annualDistanceKm: 2000, targets: [] },
    totalDistanceKm: 1328,
    projection: {
      weeklyRate: 31,
      weeklyNeeded: 45,
      projectedYearKm: 1710,
      status: 'behind',
      deltaKm: -290,
    },
  }
}

describe('ProfileGoal', () => {
  it('leads with the projected number on one line and demotes the word to the caption', () => {
    render(<ProfileGoal goal={behindGoal()} />)

    const value = screen.getByText(t.goals.projection.projectedValue('1,710'))
    expect(value).toBeInTheDocument()
    expect(value.className).toContain('whitespace-nowrap')

    expect(
      screen.getByText(`${t.goals.projection.projectedLabel} · ${t.goals.projection.shortBy('290')}`),
    ).toBeInTheDocument()
    expect(screen.queryByText(t.goals.projection.projected('1,710'))).not.toBeInTheDocument()
  })

  it('draws a shortfall against a self-set target in the same tone the Goals screen uses', () => {
    render(<ProfileGoal goal={behindGoal()} />)

    const value = screen.getByText(t.goals.projection.projectedValue('1,710'))
    expect(value.className).toContain(PROJECTION_TONE.behind.split(' ')[0]!)
    expect(value.className).not.toContain('text-red')
  })
})
