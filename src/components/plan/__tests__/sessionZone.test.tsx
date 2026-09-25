import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ActivitySummary, PlannedWorkout } from '@/domain/activity/types'
import { sessionZone, zoneColor } from '@/lib/colors'
import { t } from '@/i18n'
import { sessionTitle } from '../sessionTitle'
import { WeekView } from '../WeekView'

const TODAY = '2026-09-09'

function activity(overrides: Partial<ActivitySummary> & Pick<ActivitySummary, 'id' | 'date' | 'type'>): ActivitySummary {
  return {
    dayOfWeek: 'Monday', description: '', comment: '', distanceKm: 8, durationSeconds: 2_400, paceSecPerKm: 300,
    avgHeartRate: 160, rpe: 5, hrZones: [], week: 202637, elevationGain: 12, ...overrides,
  }
}

// A Garmin workout named after one type and typed as another: the case that
// drew "Threshold" in Z5 red.
const PLANNED: PlannedWorkout[] = [
  { date: '2026-09-10', name: 'Threshold', type: 'VO2Max', distanceM: 10_000, durationSecs: 3_000 },
  { date: '2026-09-11', name: '3 × 8 min threshold', type: 'Threshold', distanceM: 9_000, durationSecs: 3_000 },
  { date: '2026-09-12', name: 'Tempo', type: 'Tempo', distanceM: 8_000, durationSecs: 2_700 },
]
const RUNS = [activity({ id: 'a1', date: '2026-09-07', type: 'Tempo' }), activity({ id: 'a2', date: '2026-09-08', type: 'Threshold' })]

function renderWeek() {
  const byDate = new Map<string, ActivitySummary[]>()
  for (const a of RUNS) byDate.set(a.date, [a])
  return render(
    <WeekView
      weekStart={new Date(2026, 8, 7)}
      byDate={byDate}
      byDatePlanned={new Map(PLANNED.map((p) => [p.date, p]))}
      coaching={null}
      hrBounds={{ maxHr: 202, restingHr: 45 }}
      today={TODAY}
      atPresent
      onToday={() => {}}
      planPhaseRanges={[]}
      nextRace={null}
      trainingZones={null}
    />,
  )
}

describe('sessionZone', () => {
  it('is the zone of the session type', () => {
    expect(sessionZone({ type: 'Threshold' })).toBe(4)
    expect(sessionZone({ type: 'Tempo' })).toBe(3)
    expect(sessionZone({ type: 'VO2Max' })).toBe(5)
    expect(sessionZone({ type: null })).toBe(2)
  })
})

describe('sessionTitle', () => {
  it('names the type when a bare type word contradicts it', () => {
    expect(sessionTitle('Threshold', 'VO2Max')).toBe(t.activityTypes.VO2Max)
    expect(sessionTitle('Tempo', 'Tempo')).toBe('Tempo')
  })

  it('keeps a real title and fills an empty one', () => {
    expect(sessionTitle('3 × 8 min threshold', 'Threshold')).toBe('3 × 8 min threshold')
    expect(sessionTitle('', 'Base')).toBe(t.activityTypes.Base)
    expect(sessionTitle(null, null)).toBeNull()
  })
})

describe('one session colour across the week', () => {
  it('colours every bar and list dot with zoneColor(sessionZone(session))', () => {
    const { container } = renderWeek()
    const types = [...RUNS.map((r) => r.type), ...PLANNED.map((p) => p.type)]
    const expected = new Set(types.map((type) => zoneColor(sessionZone({ type }))))

    const barColors = [...container.querySelectorAll<HTMLElement>('[style*="--state-color"]')].map((el) =>
      el.style.getPropertyValue('--state-color'),
    )
    expect(barColors.length).toBeGreaterThanOrEqual(5)
    for (const color of barColors) expect(expected).toContain(color)

    for (const row of screen.getAllByTestId(/^week-session-/)) {
      const dot = row.querySelector<HTMLElement>('span.rounded-\\[4px\\]')!
      expect(expected).toContain(dot.style.background)
    }
  })

  it('names the contradicting session after its type, not its label', () => {
    renderWeek()
    const rows = screen.getAllByTestId(/^week-session-/)
    const wed = rows.find((row) => row.textContent?.includes(t.activityTypes.VO2Max))
    expect(wed).toBeDefined()
    expect(within(wed!).queryByText(/Threshold/)).not.toBeInTheDocument()
  })
})

describe('planned km from the plan (G04)', () => {
  it('writes a done row as ran / planned, the planned value from the plan', () => {
    const byDate = new Map<string, ActivitySummary[]>([
      ['2026-09-10', [activity({ id: 'long', date: '2026-09-10', type: 'VO2Max', distanceKm: 12.4 })]],
    ])
    render(
      <WeekView
        weekStart={new Date(2026, 8, 7)}
        byDate={byDate}
        byDatePlanned={new Map(PLANNED.map((p) => [p.date, p]))}
        coaching={null}
        hrBounds={{ maxHr: 202, restingHr: 45 }}
        today={TODAY}
        atPresent
        onToday={() => {}}
        planPhaseRanges={[]}
        nextRace={null}
        trainingZones={null}
      />,
    )
    const row = screen.getAllByTestId(/^week-session-/).find((r) => r.textContent?.includes('12.4'))!
    expect(row.textContent).toContain(`12.4 / 10 ${t.units.km}`)
  })
})
