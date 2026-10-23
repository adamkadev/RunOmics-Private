import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { seasonRaceRows } from '@/components/goals/SeasonRaces'
import { SeasonTimeline, stripLanes, targetsHit, yearFraction } from '@/components/goals/SeasonTimeline'
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
  it('lists the races ahead next first, then the ones done', () => {
    render(<SeasonTimeline yearData={yearData()} today={TODAY} block={BLOCK} />)
    const items = [...screen.getByTestId('season-card').querySelectorAll('li')].map((li) => li.getAttribute('data-testid'))
    // One row per target distance: the half is scheduled again, so the 5K is the one done.
    expect(items).toEqual(['timeline-upcoming', 'timeline-upcoming', 'timeline-done'])
    const upcoming = screen.getAllByTestId('timeline-upcoming')
    expect(upcoming[0]!.textContent).toContain('Harbor Lights 10K')
    expect(upcoming[1]!.textContent).toContain('Autumn Trail Half')
  })

  it('gives the next race its countdown, target, plan week and prediction', () => {
    render(<SeasonTimeline yearData={yearData()} today={TODAY} block={BLOCK} />)
    const next = screen.getAllByTestId('timeline-upcoming')[0]!
    expect(next.textContent).toContain(t.goals.season.inDays(21))
    expect(next.textContent).toContain(t.goals.season.target('40:30'))
    expect(next.textContent).toContain(t.goals.season.planWeek(9, 12))
    expect(within(next).getByText('39:46')).toBeInTheDocument()
    // 44 s inside the target: good news, in pos.
    const delta = within(next).getByTestId('timeline-delta')
    expect(delta.textContent).toBe(t.goals.season.predictedUnder('0:44'))
    expect(delta.dataset.tone).toBe('pos')
  })

  it('colours a prediction short of its target in warn', () => {
    const data = yearData()
    data.nextRaceSpotlight = { ...data.nextRaceSpotlight!, predictedSeconds: 2596 }
    render(<SeasonTimeline yearData={data} today={TODAY} block={BLOCK} />)
    const delta = within(screen.getAllByTestId('timeline-upcoming')[0]!).getByTestId('timeline-delta')
    expect(delta.textContent).toBe(t.goals.season.predictedOff('2:46'))
    expect(delta.dataset.tone).toBe('warn')
  })

  it('states a done race against its target, in pos when beaten', () => {
    render(<SeasonTimeline yearData={yearData()} today={TODAY} block={BLOCK} />)
    const done = screen.getByTestId('timeline-done')
    // Named by the race itself, not "5K · …".
    expect(done.textContent).toContain('5K')
    expect(done.textContent).not.toContain(`5K · `)
    const delta = within(done).getByTestId('timeline-delta')
    expect(delta.textContent).toBe(t.goals.season.underTarget('0:25'))
    expect(delta.className).toContain('text-[var(--pos)]')
  })

  it('draws the strip: the year so far to today, a done race and the ones ahead', () => {
    render(<SeasonTimeline yearData={yearData()} today={TODAY} block={BLOCK} />)
    expect(screen.getAllByTestId('season-marker-upcoming')).toHaveLength(2)
    expect(screen.getAllByTestId('season-marker-done')).toHaveLength(1)
    const at = `${(yearFraction(TODAY, 2026) * 100).toFixed(2)}%`
    expect(screen.getByTestId('season-today').style.left).toBe(at)
    expect(screen.getByTestId('season-done').style.width).toBe(at)
    expect(screen.getByTestId('season-done').className).toContain('bg-accent')
    expect(screen.getByTestId('season-marker-done').querySelector('.bg-foreground')).not.toBeNull()
  })

  it('leaves a goal with no date out', () => {
    const data = yearData()
    data.goals!.targets.push({ distance: 'Marathon', targetSeconds: null })
    render(<SeasonTimeline yearData={data} today={TODAY} block={BLOCK} />)
    expect(screen.getByTestId('season-card').textContent).not.toContain('Marathon')
    expect(screen.queryByTestId('season-no-date')).toBeNull()
  })
})

describe('stripLanes', () => {
  const at = (iso: string) => yearFraction(iso, 2026)

  it('keeps labels far apart above the line, Today among them', () => {
    expect(stripLanes([
      { at: at('2026-03-16'), label: '5K', prefer: 'above' },
      { at: at('2026-10-18'), label: 'Today', prefer: 'above', optional: true },
    ])).toEqual(['above', 'above'])
  })

  it('sends a race label under the line when it would touch its neighbour above', () => {
    const lanes = stripLanes([
      { at: at('2026-03-16'), label: '5K', prefer: 'above' },
      { at: at('2026-10-07'), label: 'Marathon', prefer: 'above' },
      { at: at('2026-11-08'), label: '10K', prefer: 'above' },
      { at: at('2026-12-20'), label: 'Half', prefer: 'above' },
      { at: at('2026-10-18'), label: 'Today', prefer: 'below', optional: true },
    ])
    expect(lanes.slice(0, 4)).toEqual(['above', 'above', 'below', 'above'])
    expect(lanes[4]).toBeNull()
  })
})

describe('targetsHit (3.1)', () => {
  it('counts the races run that met their target, out of those judged', () => {
    const rows = seasonRaceRows(yearData(), TODAY)
    expect(targetsHit(rows)).toEqual({ hit: 1, total: 1 })
    render(<SeasonTimeline yearData={yearData()} today={TODAY} block={BLOCK} />)
    expect(screen.getByTestId('season-tally').textContent).toBe(t.goals.season.targetsHit(1, 1))
  })

  it('has nothing to say before a race is run', () => {
    expect(targetsHit(seasonRaceRows(yearData({ pbs: [] }), TODAY))).toBeNull()
  })
})

describe('seasonRaceRows', () => {
  it('prints the watch prediction as predicted, even where the best is faster', () => {
    const rows = seasonRaceRows(yearData(), TODAY)
    const half = rows.find((row) => row.distance === 'Half-Marathon')!
    // Garmin predicts 1:28:20; the best (1:27:44) does not stand in for it.
    expect(half.value).toBe('1:28:20')
    expect(half.valueSub).toBe(t.goals.predictedTag)
    expect(half.title.startsWith(`${t.goals.half} · `)).toBe(true)
    expect(half.name).toBe('Autumn Trail Half')
  })

  it('states a done result against its target', () => {
    const five = seasonRaceRows(yearData(), TODAY).find((row) => row.distance === '5K')!
    expect(five.kind).toBe('done')
    expect(five.achieved).toBe(true)
    expect(five.valueSub).toBe(t.goals.beatenBy('0:25'))
  })
})
