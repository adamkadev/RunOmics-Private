import { isoDate } from '@/lib/calendarDate'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { YearView } from '@/components/goals/YearView'
import type { GoalProjection, YearData } from '@/application/usecases/GetGoalsData'
import { t } from '@/i18n'

const p = t.goals.projection
const YEAR = new Date().getFullYear()
const TODAY = isoDate(new Date())

/** No targets and no races, so the season timeline and the monthly chart stay out of the tree. */
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
  it('fills in the accent regardless of projection status - the fill states progress, not a verdict', () => {
    const onTrack: GoalProjection = {
      weeklyRate: 30,
      weeklyNeeded: 30,
      projectedYearKm: 2000,
      status: 'on_track',
      deltaKm: 0,
    }
    for (const projection of [BEHIND, onTrack]) {
      const { container } = render(<YearView yearData={yearData(projection)} today={TODAY} />)
      const fill = container.querySelector<HTMLElement>('[data-testid="goal-fill"]')
      expect(fill!.className).toContain('bg-accent')
    }
  })

  it('marks the projection on the bar with a labelled tick', () => {
    const { container } = render(<YearView yearData={yearData(BEHIND)} today={TODAY} />)
    const marker = container.querySelector<HTMLElement>('[aria-label*="1,705"]')
    expect(marker).not.toBeNull()
    expect(marker!.style.left).toBe('85.25%')
    expect(marker!.style.background).toBe('var(--warn)')
    expect(screen.getByText(p.projectedMark('1,705')).getAttribute('style')).toContain('var(--warn)')
  })

  it('names the projection as the headline under the bar, in the shortfall tone', () => {
    render(<YearView yearData={yearData(BEHIND)} today={TODAY} />)

    // Only the short verdict is in the tone; the need follows in text-2.
    const headline = screen.getByTestId('projection-verdict')
    expect(headline.textContent).toBe(p.shortAtPace('295'))
    expect(headline.getAttribute('style')).toContain('var(--warn)')
    expect(screen.getByTestId('projection-line').textContent).toContain(p.closes('29', '25'))
    expect(screen.getByTestId('goal-left').textContent).toBe(p.toGo('679'))
  })

  it('states what the goal still needs per week, muted beneath the projection', () => {
    const { container } = render(<YearView yearData={yearData(BEHIND)} today={TODAY} />)
    expect(container.textContent).toContain(p.closes('29', '25'))
  })

  it('groups thousands the same way everywhere in the card', () => {
    const { container } = render(<YearView yearData={yearData(BEHIND)} today={TODAY} />)
    expect(container.textContent).toContain(t.goals.ofKm('2,000'))
    expect(container.textContent).not.toContain('1705')
    expect(container.textContent).not.toContain('2000')
  })

  it('has no second progress readout competing with the bar', () => {
    const { container } = render(<YearView yearData={yearData(BEHIND)} today={TODAY} />)
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
    // 2030 against a 2000 goal is a surplus, though `status` is merely 'on_track'.
    expect(container.textContent).toContain(p.overAtPace('30'))
    expect(container.textContent).not.toContain(p.shortAtPace('30'))
    expect(screen.getByTestId('projection-verdict').getAttribute('style')).toContain('var(--pos)')
  })

  it('marks a reached goal with a pill', () => {
    const data = yearData(BEHIND)
    const { container } = render(<YearView yearData={{ ...data, totalDistanceKm: 2047 }} today={TODAY} />)
    expect(screen.getByText(t.goals.reached('47')).dataset.tone).toBe('pos')
    expect(container.textContent).toContain(t.goals.distanceGoal)
  })
})

describe('a year that is over (3.1)', () => {
  it('states the final km against the goal, with no projection', () => {
    const past = { ...yearData(BEHIND), year: YEAR - 1, projection: null }
    render(<YearView yearData={past} today={TODAY} />)
    expect(screen.getByTestId('goal-left').textContent).toBe(p.finalShort('679'))
    expect(screen.queryByTestId('projection-line')).toBeNull()
    expect(screen.queryByTestId('goal-projection')).toBeNull()
  })
})

describe('a year not yet started (3.0)', () => {
  it('draws no "0 of 2,500 km" goal card', () => {
    const next = { ...yearData(BEHIND), year: YEAR + 1, totalDistanceKm: 0, projection: null }
    render(<YearView yearData={next} today={TODAY} />)
    expect(screen.queryByTestId('goal-card')).toBeNull()
  })
})

describe('YearView, a year with only a race', () => {
  const race = { date: '2027-03-22', name: 'Spring Half', distance: 'Half-Marathon', targetSeconds: 5999 }
  const raceOnly: YearData = {
    year: 2027,
    totalDistanceKm: 0,
    goals: null,
    pbs: [],
    upcomingRaces: [race],
    projection: null,
    monthlyGoals: [],
    nextRaceSpotlight: null,
    predictions: [],
  }

  it('shows the race, not the PB empty state', () => {
    render(<YearView yearData={raceOnly} today="2026-10-19" />)
    expect(screen.getByTestId('season-card').textContent).toContain('Spring Half')
    expect(screen.queryByText(t.goals.emptyPbs(2027))).toBeNull()
  })
})
