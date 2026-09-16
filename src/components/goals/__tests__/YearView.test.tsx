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
  it('marks the projection on the bar the progress is drawn on', () => {
    const { container } = render(<YearView yearData={yearData(BEHIND)} />)

    const marker = container.querySelector<HTMLElement>('[aria-label*="1,705"]')
    expect(marker).not.toBeNull()
    // 1,705 of 2,000 is 85.25% of the way along the same track as the fill.
    expect(marker!.style.left).toBe('85.25%')

    // No second picture of the year: the dashed projection sparkline is gone.
    expect(container.querySelector('path[stroke-dasharray]')).toBeNull()
  })

  it('names the projection once, in the shortfall tone, with the date it lands', () => {
    const { container } = render(<YearView yearData={yearData(BEHIND)} />)

    const projected = screen.getByText(p.projectedBy('1,705', 'Dec 31'))
    expect(projected.className).toContain(STATUS.warning.text)
    expect(container.textContent).not.toContain(p.projected('1,705'))
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
