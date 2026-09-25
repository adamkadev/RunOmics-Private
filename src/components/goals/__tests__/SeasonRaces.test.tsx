import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { SeasonRaces, seasonRaceRows } from '@/components/goals/SeasonRaces'
import type { YearData, PbData } from '@/application/usecases/GetGoalsData'
import type { Activity } from '@/domain/activity/types'
import { t } from '@/i18n'

const TODAY = '2026-09-25'

function pb(distance: string, seconds: number, date: string): PbData {
  return {
    entry: { distance, seconds, activityId: `a-${distance}` },
    activity: { id: `a-${distance}`, date, description: '' } as unknown as Activity,
  }
}

function yearData(overrides: Partial<YearData> = {}): YearData {
  const tenK = { date: '2026-10-16', name: 'Harbor Lights 10K', distance: '10K' } as YearData['upcomingRaces'][number]
  return {
    year: 2026,
    totalDistanceKm: 1247,
    goals: {
      year: 2026,
      annualDistanceKm: 1200,
      targets: [
        { distance: '10K', targetSeconds: 2430 },
        { distance: '5K', targetSeconds: 1170 },
        { distance: 'Half-Marathon', targetSeconds: 5400 },
      ],
    },
    pbs: [pb('5K', 1145, '2026-02-21'), pb('Half-Marathon', 5264, '2026-05-10')],
    upcomingRaces: [tenK, { date: '2026-11-27', name: 'Autumn Trail Half', distance: 'Half-Marathon' }],
    projection: null,
    monthlyGoals: [],
    nextRaceSpotlight: { race: tenK, daysUntil: 21, predictedSeconds: 2386, gapSeconds: -44, prSeconds: null, prDate: null },
    predictions: [
      { key: 'half', predictedSeconds: 5300, actualSeconds: 5264, actualDate: '2026-05-10' },
      { key: '10k', predictedSeconds: 2386, actualSeconds: null, actualDate: null },
    ],
    ...overrides,
  }
}

describe('SeasonRaces', () => {
  it('puts upcoming races first, soonest first, then what is done', () => {
    render(<SeasonRaces yearData={yearData()} today={TODAY} />)
    const sections = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(sections).toEqual([t.goals.upcoming, t.goals.doneHeading])

    const upcoming = within(screen.getByTestId('season-upcoming')).getAllByTestId('race-scheduled')
    expect(upcoming.map((row) => row.textContent)).toEqual([
      expect.stringContaining('Harbor Lights 10K'),
      expect.stringContaining('Autumn Trail Half'),
    ])
    expect(within(screen.getByTestId('season-done')).getByText('19:05')).toBeInTheDocument()
  })

  it('shows the Garmin prediction with its target and countdown, one row per race', () => {
    render(<SeasonRaces yearData={yearData()} today={TODAY} />)
    const row = screen.getAllByTestId('race-scheduled')[0]!
    expect(within(row).getByText('39:46')).toBeInTheDocument()
    expect(within(row).getByText(t.goals.predictedTag)).toBeInTheDocument()
    expect(row.textContent).toContain(t.goals.targetTime('40:30'))
    expect(row.textContent).toContain('D-21')
  })

  // R7d: the column is the prediction, labelled as one, and the half is "Half".
  it('prints the watch prediction as predicted, even where the best is faster', () => {
    const rows = seasonRaceRows(yearData(), TODAY)
    const half = rows.find((row) => row.distance === 'Half-Marathon')!
    // Garmin predicts 1:28:20; the best (1:27:44) no longer stands in for it.
    expect(half.value).toBe('1:28:20')
    expect(half.valueSub).toBe(t.goals.predictedTag)
    expect(half.title.startsWith(`${t.goals.half} · `)).toBe(true)
  })

  it('states a done result against its target', () => {
    const five = seasonRaceRows(yearData(), TODAY).find((row) => row.distance === '5K')!
    expect(five.kind).toBe('done')
    expect(five.achieved).toBe(true)
    expect(five.valueSub).toBe(t.goals.beatenBy('0:25'))
  })
})
