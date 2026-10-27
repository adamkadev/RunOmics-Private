import { describe, it, expect } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { GoalsClient, defaultGoalsYear } from '@/components/goals/GoalsClient'
import type { GoalsPageData, YearData } from '@/application/usecases/GetGoalsData'
import { t } from '@/i18n'

const TODAY = '2026-10-19'

function year(y: number, overrides: Partial<YearData> = {}): YearData {
  return {
    year: y,
    totalDistanceKm: 0,
    goals: null,
    pbs: [],
    upcomingRaces: [],
    projection: null,
    monthlyGoals: [],
    nextRaceSpotlight: null,
    predictions: [],
    ...overrides,
  }
}

const RACE_2027 = { date: '2027-03-22', name: 'Spring Half', distance: 'Half-Marathon', targetSeconds: 5999 }

function data(): GoalsPageData {
  return {
    years: [2027, 2026, 2025],
    byYear: {
      2027: year(2027, { upcomingRaces: [RACE_2027] }),
      2026: year(2026, { goals: { year: 2026, annualDistanceKm: 2000, targets: [] }, totalDistanceKm: 1500 }),
      2025: year(2025),
    },
    history: [],
    nextRace: null,
    missingGoalYear: null,
  }
}

describe('defaultGoalsYear', () => {
  it('opens on the current year even when a later year has a race', () => {
    expect(defaultGoalsYear([2027, 2026, 2025], TODAY)).toBe(2026)
  })

  it('falls back to the newest year when the current one has no data', () => {
    expect(defaultGoalsYear([2025, 2024], TODAY)).toBe(2025)
    expect(defaultGoalsYear([], TODAY)).toBeUndefined()
  })
})

describe('GoalsClient', () => {
  it('says where a goal is set when there is none, and links to the editor', () => {
    render(<GoalsClient data={{ years: [], byYear: {}, history: [], nextRace: null, missingGoalYear: null }} today={TODAY} />)
    expect(screen.getByTestId('goals-empty')).toHaveTextContent(t.goals.emptyHow)
    expect(screen.getByTestId('goals-empty-action')).toHaveAttribute('href', '/settings#goals-races')
  })

  it('says the new year has no goal yet above the last year’s page', () => {
    render(<GoalsClient data={{ ...data(), years: [2026, 2025], missingGoalYear: 2027 }} today="2027-01-02" />)
    const card = screen.getByTestId('goals-missing-year')
    expect(card).toHaveTextContent(t.goals.noGoalYear(2027))
    expect(card.querySelector('a')).toHaveAttribute('href', '/settings#goals-races')
    expect(t.goals.noGoalYear(2027)).toBe('No goal set for 2027')
  })

  it('puts the year stepper in the button row, the title on its own row', () => {
    render(<GoalsClient data={data()} today={TODAY} back={<button type="button">Back</button>} />)
    const title = screen.getByRole('heading', { level: 1 })
    const row = screen.getByTestId('year-stepper').parentElement!
    expect(row.contains(title)).toBe(false)
    expect(row.firstElementChild!.textContent).toBe('Back')
    expect(row.lastElementChild).toBe(screen.getByTestId('year-stepper'))
    expect(row.className).toContain('justify-between')
    expect(title.parentElement!.children).toHaveLength(2)
    expect(title.previousElementSibling).toBe(row)
  })

  it('steps through the years, past ones included', () => {
    render(<GoalsClient data={data()} today={TODAY} />)
    fireEvent.click(screen.getByRole('button', { name: t.goals.prevYear }))
    expect(screen.getByTestId('year-stepper').textContent).toBe('2025')
    expect(screen.getByRole('button', { name: t.goals.prevYear })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: t.goals.nextYear }))
    fireEvent.click(screen.getByRole('button', { name: t.goals.nextYear }))
    expect(screen.getByTestId('year-stepper').textContent).toBe('2027')
    expect(screen.getByRole('button', { name: t.goals.nextYear })).toBeDisabled()
    expect(screen.getByTestId('season-card').textContent).toContain('Spring Half')
  })
})
