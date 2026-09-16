import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { buildCoachingOverview, type CoachingOverview, type PrescriptionView } from '@/application/coaching/GetCoachingView'
import type { ActivitySummary, PlannedWorkout } from '@/domain/activity/types'
import type { PlanPhaseRange } from '@/application/usecases/GetTrainingPlan'
import type { UpcomingRace } from '@/application/usecases/GetGoalsData'
import type { TrainingZonesData } from '@/application/usecases/GetTrainingZones'
import type { CoachingPlan } from '@/domain/coaching/types'
import { plan } from '@/domain/coaching/__tests__/fixtures'
import { t } from '@/i18n'
import { WeekView } from '../WeekView'

const TODAY = '2026-09-09'
const WEEK_START = new Date(2026, 8, 7)
const HR_BOUNDS = { maxHr: 202, restingHr: 45 }

function activity(overrides: Partial<ActivitySummary> & Pick<ActivitySummary, 'id' | 'date' | 'type'>): ActivitySummary {
  return {
    dayOfWeek: 'Monday',
    description: '',
    comment: '',
    distanceKm: 5,
    durationSeconds: 1_500,
    paceSecPerKm: 300,
    avgHeartRate: 160,
    rpe: 5,
    hrZones: [],
    week: 202637,
    elevationGain: 12,
    ...overrides,
  }
}

const TEMPO = activity({ id: 'a-tempo', date: '2026-09-07', type: 'Tempo', distanceKm: 4.79, durationSeconds: 1_756, avgHeartRate: 160, elevationGain: 7 })
const RACE = activity({ id: 'a-race', date: '2026-09-08', type: 'Race', distanceKm: 5.25, durationSeconds: 1_310, avgHeartRate: 196, elevationGain: 19 })

function blockPlan(): CoachingPlan {
  const base = plan()
  return {
    ...base,
    macrocycleStartDate: '2026-09-07',
    targetEvent: { ...base.targetEvent, date: '2026-11-29', role: 'primary' },
  }
}

function overview(options: { garminPlanned?: PlannedWorkout[]; coachingPlan?: CoachingPlan } = {}): CoachingOverview {
  return buildCoachingOverview(options.coachingPlan ?? plan(), [], [], [], options.garminPlanned ?? [], TODAY)
}

function byDateCoach(coaching: CoachingOverview): Map<string, PrescriptionView[]> {
  const map = new Map<string, PrescriptionView[]>()
  for (const view of coaching.workouts) map.set(view.prescription.date, [...(map.get(view.prescription.date) ?? []), view])
  return map
}

const ZONES: TrainingZonesData = {
  thresholdPaceSecPerKm: 265,
  zones: [
    { key: 'easy', label: 'Easy', shortDesc: '', hrZone: 2, paceMinSecPerKm: 310, paceMaxSecPerKm: 387 },
    { key: 'threshold', label: 'Threshold', shortDesc: '', hrZone: 4, paceMinSecPerKm: 260, paceMaxSecPerKm: 270 },
  ],
}

function renderWeek(options: {
  coaching?: CoachingOverview
  planned?: PlannedWorkout[]
  activities?: ActivitySummary[]
  nextRace?: UpcomingRace | null
  planPhaseRanges?: PlanPhaseRange[]
  trainingZones?: TrainingZonesData | null
} = {}) {
  const activities = options.activities ?? []
  const byDate = new Map<string, ActivitySummary[]>()
  for (const a of activities) byDate.set(a.date, [...(byDate.get(a.date) ?? []), a])

  return render(
    <WeekView
      weekStart={WEEK_START}
      activities={activities}
      byDate={byDate}
      byDatePlanned={new Map((options.planned ?? []).map((p) => [p.date, p]))}
      byDateCoach={options.coaching ? byDateCoach(options.coaching) : undefined}
      coaching={options.coaching ?? null}
      hrBounds={HR_BOUNDS}
      today={TODAY}
      atPresent
      onToday={() => {}}
      statusByDate={{}}
      planPhaseRanges={options.planPhaseRanges ?? []}
      nextRace={options.nextRace ?? null}
      trainingZones={options.trainingZones ?? null}
    />
  )
}

async function expectStats(easyHardValue: string, load: string, climb: string) {
  await waitFor(() => {
    expect(screen.getByTestId('stat-load').textContent).toContain(load)
    expect(screen.getByTestId('stat-climb').textContent).toContain(climb)
    expect(screen.getByTestId('stat-easy-hard').textContent).toContain(easyHardValue)
  })
}

describe('WeekView weekly metrics', () => {
  it('reports Garmin activity metrics for a week with no coaching', async () => {
    renderWeek({ activities: [TEMPO, RACE] })

    await expectStats('–', '141', `26${t.units.m}`)
  })

  it('keeps those same metrics when a coaching block covers the week', async () => {
    renderWeek({ activities: [TEMPO, RACE], coaching: overview() })

    await expectStats('–', '141', `26${t.units.m}`)
  })

  it('shows the completed activities and the coach prescription side by side', () => {
    renderWeek({ activities: [TEMPO, RACE], coaching: overview() })

    expect(screen.getByLabelText(/3 × 8 min threshold/)).toBeInTheDocument()
    expect(screen.getByLabelText(/September 7/)).toBeInTheDocument()
    expect(screen.getByLabelText(/September 8/)).toBeInTheDocument()
  })
})

describe('WeekView progression card', () => {
  it('spans the macrocycle to the primary target, not the four block weeks', () => {
    renderWeek({ coaching: overview({ coachingPlan: blockPlan() }) })

    for (const label of [t.plan.phaseTrack.base, t.plan.phaseTrack.build, t.plan.phaseTrack.peak, t.plan.phaseTrack.raceDay]) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })

  it('counts the week toward the primary target in the macrocycle card', () => {
    renderWeek({ coaching: overview({ coachingPlan: blockPlan() }) })

    expect(screen.getByText(t.plan.weekPurpose.weekOfTarget(1, 12))).toBeInTheDocument()
  })

  it('leaves the macrocycle progress out of the race card', () => {
    renderWeek({ coaching: overview({ coachingPlan: blockPlan() }) })

    const footer = screen.getByTestId('race-footer')
    expect(footer.textContent).not.toContain(t.plan.weekPurpose.weekOfTarget(1, 12))
    expect(footer.textContent).not.toContain(t.plan.raceFooter.weeksInLabel)
  })

  it('keeps the Garmin phase track when there is no coaching', () => {
    renderWeek({
      planPhaseRanges: [
        { phase: 'base', startDate: '2026-08-01', endDate: '2026-09-06' },
        { phase: 'build', startDate: '2026-09-07', endDate: '2026-10-04' },
      ],
    })

    expect(screen.getByText(t.plan.phaseTrack.base)).toBeInTheDocument()
    expect(screen.getByText(t.plan.phaseTrack.build)).toBeInTheDocument()
  })

  it('adds no coaching header, block name or generated copy', () => {
    const coaching = overview({ coachingPlan: blockPlan() })
    const { container } = renderWeek({ coaching })

    expect(container.textContent).not.toContain(coaching.plan.block.name)
    expect(container.textContent).not.toContain('Post-race recovery')
    expect(screen.queryByTestId('coach-decision-row')).not.toBeInTheDocument()
  })
})

describe('WeekView coaching day cells and Today', () => {
  it('represents each coach workout once, in the day it falls on', () => {
    renderWeek({ coaching: overview() })

    expect(screen.getAllByTestId('coach-calendar-2026-09-09')).toHaveLength(1)
    expect(screen.getAllByTestId('plan-workout-row-workout-threshold')).toHaveLength(1)
    expect(screen.getAllByText(/3 × 8 min threshold/)).toHaveLength(1)
  })

  it('renders a coached session through the same row a Garmin session uses', () => {
    const coached = renderWeek({ coaching: overview() })
    const coachRow = screen.getByTestId('plan-workout-row-workout-threshold')
    coached.unmount()

    renderWeek({ planned: [{ date: TODAY, name: 'Track session', type: 'Threshold', durationSecs: 3_600 }] })
    const garminRow = screen.getByTestId(/^plan-workout-row-garmin:/)

    expect(coachRow.tagName).toBe(garminRow.tagName)
    expect(coachRow.className).toBe(garminRow.className)
  })

  it('states the effort band and the pace the coach prescribed', () => {
    renderWeek({ coaching: overview(), trainingZones: ZONES })

    const row = screen.getByTestId('plan-workout-row-workout-threshold')
    expect(row.textContent).toContain('3 × 8 min threshold')
    expect(row.textContent).toContain('1h00')
    expect(row.textContent).toContain('Threshold')
    expect(row.textContent).toContain(t.plan.targetPace('4:25–4:30/km'))
  })

  it('is a read-only card, not a control - no sheet opens on tap', async () => {
    const user = userEvent.setup()
    renderWeek({ coaching: overview() })

    const row = screen.getByTestId('plan-workout-row-workout-threshold')
    expect(row.tagName).toBe('DIV')

    await user.click(row)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('keeps time of day off the detail line - it is not a plan instruction and it costs the pace range a line', () => {
    renderWeek({
      coaching: overview({ garminPlanned: [{ date: TODAY, name: 'Track session', type: 'Threshold', durationSecs: 3_600 }] }),
      planned: [{ date: TODAY, name: 'Track session', type: 'Threshold', durationSecs: 3_600, scheduledTime: 'Evening' }],
    })

    const row = screen.getByTestId('plan-workout-row-workout-threshold')
    expect(row.textContent).not.toContain(t.plan.timeOfDay.Evening)
  })

  it('labels the effort blocks and names the recovery on the row', () => {
    renderWeek({ coaching: overview(), trainingZones: ZONES })

    const row = screen.getByTestId('plan-workout-row-workout-threshold')
    expect(within(row).getAllByText(t.plan.structure.min(8))).toHaveLength(3)
    // The caption reads clock notation (2:00 rec), consistent with the pace
    // ranges elsewhere - only the inline block labels keep the 8' shorthand.
    expect(row.textContent).toContain('2:00 rec')
  })

  it('shows one row for a session the coach prescribed and Garmin already holds', () => {
    const garmin: PlannedWorkout = { date: TODAY, name: 'Track session', type: 'Threshold', durationSecs: 3_600 }
    renderWeek({ coaching: overview({ garminPlanned: [garmin] }), planned: [garmin] })

    expect(screen.getAllByTestId(/^plan-workout-row-/)).toHaveLength(1)
    expect(screen.queryByText(/^Garmin ·/)).not.toBeInTheDocument()
  })

  it('drops the session row on a day that has none', async () => {
    const user = userEvent.setup()
    renderWeek({ coaching: overview() })

    await user.click(screen.getByLabelText(/September 10/))
    expect(screen.queryByTestId(/^plan-workout-row-/)).not.toBeInTheDocument()
  })
})

describe('WeekView target race', () => {
  it('uses the coaching target event in the existing compact card', () => {
    renderWeek({ coaching: overview() })

    expect(screen.getByText('Autumn 10K')).toBeInTheDocument()
  })

  it('names each race by its role, keeping the primary target clear', () => {
    const coaching = overview({ coachingPlan: blockPlan() })
    renderWeek({ coaching })

    const footer = screen.getByTestId('race-footer')
    expect(footer.textContent).toContain(t.plan.raceFooter.primaryTarget)
  })

  it('counts days, not block progress, for each listed race, in the same shape Today uses', () => {
    renderWeek({ coaching: overview() })

    expect(screen.getByText(t.nextRace.countdown(39))).toBeInTheDocument()
  })

  it('keeps the countdown in its own tier instead of letting the block status replace it', () => {
    const base = plan()
    const onBlockEnd: CoachingPlan = { ...base, targetEvent: { ...base.targetEvent, date: base.block.endDate } }
    renderWeek({ coaching: overview({ coachingPlan: onBlockEnd }) })

    // 2026-09-09 -> 2026-10-04.
    const countdown = screen.getByText(t.nextRace.countdown(25))
    expect(countdown.className).toContain('rounded-full')
    // The block status is a separate fact from the countdown, so both render.
    expect(screen.getByTestId('race-footer').textContent).toContain(t.plan.raceFooter.blockEndsHere)
  })

  it('keeps the Garmin race when there is no coaching', () => {
    renderWeek({ nextRace: { date: '2026-10-18', name: 'City Half', distance: '21K' } })

    expect(screen.getByText(/City Half/)).toBeInTheDocument()
  })
})

describe('WeekView without coaching', () => {
  it('keeps the original layout and adds no coaching placeholders', () => {
    renderWeek({ activities: [TEMPO, RACE], planned: [{ date: TODAY, name: 'Track session', type: 'Threshold', durationSecs: 3_600 }] })

    expect(screen.getByText(t.plan.weekSummary.load)).toBeInTheDocument()
    expect(screen.queryByTestId('coach-decision-row')).not.toBeInTheDocument()
    expect(screen.queryByTestId('coach-calendar-2026-09-09')).not.toBeInTheDocument()
  })

  it('still shows the Garmin planned workout on the selected day', () => {
    renderWeek({ planned: [{ date: TODAY, name: 'Track session', type: 'Threshold', durationSecs: 3_600 }] })

    expect(screen.getByText(/Track session/)).toBeInTheDocument()
  })

  it('falls back to the rest-day copy on an empty day', () => {
    renderWeek()

    expect(screen.getAllByText(t.plan.restDay).length).toBeGreaterThan(0)
  })
})
