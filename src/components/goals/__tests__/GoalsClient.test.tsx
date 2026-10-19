import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GoalsClient, defaultGoalsYear } from '@/components/goals/GoalsClient'
import type { GoalsPageData, YearData } from '@/application/usecases/GetGoalsData'

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
  it('opens on 2026 in 2026 when 2027 has a race', () => {
    render(<GoalsClient data={data()} today={TODAY} />)
    expect(screen.getByRole('tab', { name: '2026' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByTestId('goal-card')).toBeTruthy()
  })
})
