import { isoDate } from '@/lib/calendarDate'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { YearView } from '@/components/goals/YearView'
import type { GoalProjection, YearData } from '@/application/usecases/GetGoalsData'
import { STATUS } from '@/lib/statusColors'
import { t } from '@/i18n'

const p = t.goals.projection
const YEAR = new Date().getFullYear()
const TODAY = isoDate(new Date())

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
  it('fills with the accent regardless of projection status - the fill states progress, not a verdict', () => {
    const onTrack: GoalProjection = {
      weeklyRate: 30,
      weeklyNeeded: 30,
      projectedYearKm: 2000,
      status: 'on_track',
      deltaKm: 0,
    }
    for (const projection of [BEHIND, onTrack]) {
      const { container } = render(<YearView yearData={yearData(projection)} today={TODAY} />)
      const fill = container.querySelector<HTMLElement>('.rounded-full.transition-all')
      // A progress fill is the accent's job; amber would fire in January on a
      // healthy year, and the verdict lives only in the projection headline.
      expect(fill!.style.background).toBe('var(--accent)')
    }
  })

  it('marks the projection on the bar with a labelled tick', () => {
    const { container } = render(<YearView yearData={yearData(BEHIND)} today={TODAY} />)
    const marker = container.querySelector<HTMLElement>('[aria-label*="1,705"]')
    expect(marker).not.toBeNull()
    expect(marker!.style.left).toBe('85.25%')
    // C3: no "proj." label under it; the sentence below names the projection.
    expect(screen.queryByText(p.projectedTick)).toBeNull()
  })

  it('names the projection as the headline under the bar, in the shortfall tone', () => {
    const { container } = render(<YearView yearData={yearData(BEHIND)} today={TODAY} />)

    // C3: only the short verdict is in the tone; the need follows muted.
    const headline = screen.getByTestId('projection-verdict')
    expect(headline.textContent).toBe(`${p.projected('1,705')} · ${p.shortBy('295')}.`)
    expect(headline.className).toContain(STATUS.warning.text)
    expect(screen.getByTestId('projection-line').textContent).toContain(p.needsWeeklyDetail('29', '25'))
    // No small top-right chip repeating the same verdict a second time.
    expect(container.textContent).not.toContain(p.status.behind)
  })

  it('states what the goal still needs per week, muted beneath the projection', () => {
    const { container } = render(<YearView yearData={yearData(BEHIND)} today={TODAY} />)
    expect(container.textContent).toContain(p.needsWeeklyDetail('29', '25'))
  })

  it('groups thousands the same way everywhere in the card', () => {
    const { container } = render(<YearView yearData={yearData(BEHIND)} today={TODAY} />)
    expect(container.textContent).toContain(t.goals.ofKm('2,000'))
    expect(container.textContent).not.toContain('1705')
    expect(container.textContent).not.toContain('2000')
  })

  it('has no second progress readout competing with the bar', () => {
    const { container } = render(<YearView yearData={yearData(BEHIND)} today={TODAY} />)
    // The emerald "66%" duplicated the bar and clashed with the amber verdict.
    expect(container.textContent).not.toContain('%')
  })

  it('signs the outcome from the projection, not from the status', () => {
    const surplus: GoalProjection = {
      weeklyRate: 41,
      weeklyNeeded: 35,
      projectedYearKm: 2030,
      status: 'on_track',
      deltaKm: 30,
    }
    const { container } = render(<YearView yearData={yearData(surplus)} today={TODAY} />)
    // 2030 against a 2000 goal is a surplus; reading the sign off `status`
    // (which is merely 'on_track' here) would have called this "short" instead.
    expect(container.textContent).toContain(p.overBy('30'))
    expect(container.textContent).not.toContain(p.shortBy('30'))
  })

  // R7d: a reached goal says so, with the surplus.
  it('marks a reached goal with a chip and names the year it is for', () => {
    const data = yearData(BEHIND)
    const { container } = render(<YearView yearData={{ ...data, totalDistanceKm: 2047 }} today={TODAY} />)
    expect(container.textContent).toContain(t.goals.reached('47'))
    expect(container.textContent).toContain(t.goals.volumeGoal(data.year))
  })
})

