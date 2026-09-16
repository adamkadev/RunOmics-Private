import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { YearView } from '@/components/goals/YearView'
import type { GoalProjection, YearData } from '@/application/usecases/GetGoalsData'
import { formatDelta, MINUS } from '@/lib/formatters'
import { STATUS } from '@/lib/statusColors'
import { t } from '@/i18n'

const p = t.goals.projection
const YEAR = new Date().getFullYear()

/**
 * The annual goal card on its own: no targets and no races, so the season
 * timeline and the monthly chart stay out of the tree.
 */
function yearData(projection: GoalProjection): YearData {
  return {
    year: YEAR,
    totalDistanceKm: 1321,
    goals: { year: YEAR, annualDistanceKm: 2000, targets: [] },
    pbs: [],
    upcomingRaces: [],
    projection,
    monthlyGoals: [],
    nextRaceSpotlight: null,
    predictions: [],
  }
}

const BEHIND: GoalProjection = {
  weeklyRate: 25.3,
  weeklyNeeded: 29.4,
  projectedYearKm: 1705,
  status: 'behind',
  deltaKm: 295,
}

describe('YearView annual goal card', () => {
  it('renders the projection as the card answer, not as its smallest line', () => {
    render(<YearView yearData={yearData(BEHIND)} />)
    const projected = screen.getByText(p.projected('1,705'))
    // text-body (17px), one step under the running total - it used to be
    // text-caption (11px), the smallest type on the card.
    expect(projected.className).toContain('text-body')
    expect(projected.className).toContain(STATUS.warning.text)
  })

  it('states what the goal still needs per week, muted beneath the projection', () => {
    const { container } = render(<YearView yearData={yearData(BEHIND)} />)
    expect(container.textContent).toContain(p.needsWeekly('29'))
    expect(container.textContent).toContain(p.rate('25'))
  })

  it('groups thousands the same way everywhere in the card', () => {
    const { container } = render(<YearView yearData={yearData(BEHIND)} />)
    expect(container.textContent).toContain(`/ 2,000 ${t.units.km}`)
    expect(container.textContent).not.toContain('1705')
    expect(container.textContent).not.toContain('2000')
  })

  it('has no second progress readout competing with the bar', () => {
    const { container } = render(<YearView yearData={yearData(BEHIND)} />)
    // The emerald "66%" duplicated the bar and clashed with the amber verdict.
    expect(container.textContent).not.toContain('%')
  })

  it('signs the verdict delta from the projection, not from the status', () => {
    const surplus: GoalProjection = {
      weeklyRate: 41,
      weeklyNeeded: 35,
      projectedYearKm: 2030,
      status: 'on_track',
      deltaKm: 30,
    }
    const { container } = render(<YearView yearData={yearData(surplus)} />)
    // 2030 against a 2000 goal is a surplus; reading the sign off `status`
    // rendered this as "On track −30 km".
    expect(container.textContent).toContain(formatDelta(30, t.units.km))
    expect(container.textContent).not.toContain(`${MINUS}30`)
  })
})
