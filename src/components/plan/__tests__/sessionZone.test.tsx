import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
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

function Week({ byDate }: { byDate: Map<string, ActivitySummary[]> }) {
  const [selected, setSelected] = useState(TODAY)
  return (
    <WeekView
      weekStart={new Date(2026, 8, 7)}
      byDate={byDate}
      byDatePlanned={new Map(PLANNED.map((p) => [p.date, p]))}
      coaching={null}
      selectedDate={selected}
      onSelectDate={setSelected}
      today={TODAY}
      atPresent
      onToday={() => {}}
      planPhaseRanges={[]}
      nextRace={null}
      trainingZones={null}
    />
  )
}

function renderWeek() {
  const byDate = new Map<string, ActivitySummary[]>()
  for (const a of RUNS) byDate.set(a.date, [a])
  return render(<Week byDate={byDate} />)
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
  // Redesign 3.0: every day's bar is its session's colour, run or still to
  // come - the same zone its type is drawn in on every other screen.
  it('colours every bar with zoneColor(sessionZone(session))', () => {
    const { container } = renderWeek()

    const bars = [...container.querySelectorAll<HTMLElement>('[data-bar-state="planned"], [data-bar-state="done"]')]
    const types = [...RUNS.map((r) => r.type), ...PLANNED.map((p) => p.type)]
    expect(bars.map((bar) => bar.style.background)).toEqual(types.map((type) => zoneColor(sessionZone({ type }))))
  })

  it('names the contradicting session after its type, not its label', async () => {
    const user = userEvent.setup()
    renderWeek()

    await user.click(screen.getByTestId('day-2026-09-10'))
    const card = screen.getByTestId(/^plan-workout-garmin:2026-09-10/)
    expect(within(card).getByRole('heading').textContent).toBe(t.activityTypes.VO2Max)
    expect(within(card).queryByText(/Threshold/)).not.toBeInTheDocument()
  })
})
