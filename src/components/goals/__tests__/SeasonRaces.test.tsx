import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { seasonRaceRows } from '@/components/goals/SeasonRaces'
import { SeasonTimeline, yearFraction } from '@/components/goals/SeasonTimeline'
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

const BLOCK = { startDate: '2026-07-24', raceDate: '2026-10-16', week: 9, weeks: 12 }

describe('SeasonTimeline', () => {
  // C3: newest first - what is ahead, then today, then what is done.
  it('lists the races newest first with today between ahead and done', () => {
    render(<SeasonTimeline yearData={yearData()} today={TODAY} block={BLOCK} />)
    const items = [...screen.getByTestId('season-card').querySelectorAll('li')].map((li) => li.getAttribute('data-testid'))
    // One row per target distance: the half is scheduled again, so the 5K is the one done.
    expect(items).toEqual(['timeline-upcoming', 'timeline-upcoming', 'timeline-today', 'timeline-done'])
    const upcoming = screen.getAllByTestId('timeline-upcoming')
    expect(upcoming[0]!.textContent).toContain('Autumn Trail Half')
    expect(upcoming[1]!.textContent).toContain('Harbor Lights 10K')
  })

  it('gives the next race its countdown, target, block week and prediction', () => {
    render(<SeasonTimeline yearData={yearData()} today={TODAY} block={BLOCK} />)
    const next = screen.getAllByTestId('timeline-upcoming')[1]!
    expect(next.textContent).toContain('D-\u206021')
    expect(next.textContent).toContain(t.goals.targetTime('40:30'))
    expect(next.textContent).toContain(t.goals.season.blockWeek('10K', 9, 12))
    expect(within(next).getByText('39:46')).toBeInTheDocument()
    expect(within(next).getByText(t.goals.predictedTag)).toBeInTheDocument()
  })

  it('states a done race against its target, in the accent when beaten', () => {
    render(<SeasonTimeline yearData={yearData()} today={TODAY} block={BLOCK} />)
    const deltas = screen.getAllByTestId('timeline-delta')
    expect(deltas.map((d) => d.textContent)).toEqual(['−0:25'])
    for (const d of deltas) expect(d.className).toContain('text-accent-text')
  })

  it('draws the strip: races, the block band from its start to race day, and today', () => {
    render(<SeasonTimeline yearData={yearData()} today={TODAY} block={BLOCK} />)
    expect(screen.getAllByTestId('season-marker-upcoming')).toHaveLength(2)
    expect(screen.getAllByTestId('season-marker-done')).toHaveLength(1)
    const band = screen.getByTestId('season-block')
    expect(band.style.left).toBe(`${(yearFraction('2026-07-24', 2026) * 100).toFixed(2)}%`)
  })

  it('puts a race with no date in its own card, off the timeline', () => {
    const data = yearData()
    data.goals!.targets.push({ distance: 'Marathon', targetSeconds: null })
    render(<SeasonTimeline yearData={data} today={TODAY} block={BLOCK} />)
    expect(within(screen.getByTestId('season-no-date')).getByText(t.goals.season.noDate)).toBeInTheDocument()
    expect(screen.getByTestId('season-card').textContent).not.toContain('Marathon')
  })
})

describe('seasonRaceRows', () => {
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
