import { render, screen, within } from '@testing-library/react'
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
      byDate={byDate}
      byDatePlanned={new Map((options.planned ?? []).map((p) => [p.date, p]))}
      byDateCoach={options.coaching ? byDateCoach(options.coaching) : undefined}
      coaching={options.coaching ?? null}
      hrBounds={HR_BOUNDS}
      today={TODAY}
      atPresent
      onToday={() => {}}
      planPhaseRanges={options.planPhaseRanges ?? []}
      nextRace={options.nextRace ?? null}
      trainingZones={options.trainingZones ?? null}
    />
  )
}

describe('WeekView weekly metrics', () => {
  // H20: one line - volume left, easy share right - and no load (i).
  it('reads the week in one line, with no load behind an info button', () => {
    renderWeek({ activities: [TEMPO, RACE], coaching: overview() })

    expect(screen.getByTestId('week-summary')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: t.plan.weekSummary.aboutLoad })).toBeNull()
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

    // M11: phase and week on the left, the race as "10K · D-n" on the right.
    const line = screen.getByTestId('phase-line').textContent ?? ''
    expect(line).toContain(t.plan.weekPurpose.weekOfTarget(1, 12))
    expect(line).toMatch(/· D-\d+/)
  })

  // H20: the race is on the phase line; the Races section is gone from Week.
  it('draws no Races section under the week', () => {
    renderWeek({ coaching: overview({ coachingPlan: blockPlan() }) })

    expect(screen.queryByTestId('race-footer')).toBeNull()
  })

  it('keeps the Garmin phase track when there is no coaching', () => {
    renderWeek({
      planPhaseRanges: [
        { phase: 'base', startDate: '2026-08-01', endDate: '2026-09-06' },
        { phase: 'build', startDate: '2026-09-07', endDate: '2026-10-04' },
      ],
    })

    expect(screen.getAllByText(t.plan.phaseTrack.base).length).toBeGreaterThan(0)
    expect(screen.getAllByText(t.plan.phaseTrack.build).length).toBeGreaterThan(0)
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
    // The detail pane (today's own session) and the "this week" list (every
    // day, today included) each show it exactly once - two sections, not a
    // duplicate within either one.
    expect(screen.getAllByTestId('plan-workout-row-workout-threshold')).toHaveLength(1)
    expect(screen.getAllByTestId('week-session-workout-threshold')).toHaveLength(1)
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
    // The zone/type word ("Threshold") is deliberately left out of the meta
    // line - the title already names the session, so repeating it there was
    // the same fact stated twice on one card.
    // The work pace by name, from workoutSummary: the same reading Today prints.
    expect(row.textContent).toContain(t.plan.session.targetPace('4:25–4:30'))
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
  // H20: the race rides on the phase line as its distance and a countdown.
  it('puts the coaching target race on the phase line as a countdown', () => {
    renderWeek({ coaching: overview() })

    expect(screen.getByTestId('phase-line').textContent).toContain('D-39')
  })

  it('keeps the Garmin race when there is no coaching', () => {
    renderWeek({ nextRace: { date: '2026-10-18', name: 'City Half', distance: '21K' } })

    expect(screen.getByTestId('phase-line').textContent).toContain('21K · D-39')
  })
})

describe('WeekView without coaching', () => {
  it('keeps the original layout and adds no coaching placeholders', () => {
    renderWeek({ activities: [TEMPO, RACE], planned: [{ date: TODAY, name: 'Track session', type: 'Threshold', durationSecs: 3_600 }] })

    expect(screen.queryByTestId('coach-decision-row')).not.toBeInTheDocument()
    expect(screen.queryByTestId('coach-calendar-2026-09-09')).not.toBeInTheDocument()
  })

  it('still shows the Garmin planned workout on the selected day', () => {
    renderWeek({ planned: [{ date: TODAY, name: 'Track session', type: 'Threshold', durationSecs: 3_600 }] })

    // It appears twice by design: once in the detail pane for the selected
    // day, once in the "this week" list a few sections down.
    expect(screen.getAllByText(/Track session/).length).toBeGreaterThan(0)
  })

  it('falls back to the rest-day copy on an empty day', () => {
    renderWeek()

    expect(screen.getByText(t.plan.restCard.title)).toBeInTheDocument()
  })
})

describe('WeekView easy share', () => {
  // Two easy-type runs whose heart rate spent half their time above zone 2.
  const zones = [
    { zone: 2, seconds: 900, percent: 50, minBpm: 120, maxBpm: 145 },
    { zone: 3, seconds: 900, percent: 50, minBpm: 146, maxBpm: 160 },
  ]
  const lastWeek = [
    activity({ id: 'b1', date: '2026-08-31', type: 'Base', durationSeconds: 1_800, hrZones: zones }),
    activity({ id: 'b2', date: '2026-09-02', type: 'Base', durationSeconds: 1_800, hrZones: zones }),
  ]

  function renderPastWeek() {
    const byDate = new Map(lastWeek.map((a) => [a.date, [a]]))
    return render(
      <WeekView
        weekStart={new Date(2026, 7, 31)}
        byDate={byDate}
        byDatePlanned={new Map()}
        today={TODAY}
        atPresent={false}
        onToday={() => {}}
        planPhaseRanges={[]}
      />
    )
  }

  // The session types said 100 % easy while the activity list, reading heart
  // rate, said 50 % for the same week.
  it('reads a finished week by heart rate, as the activity list does', () => {
    renderPastWeek()

    const summary = screen.getByTestId('week-summary').textContent
    expect(summary).toContain(t.plan.weekSummary.easyOfTarget(50, 80))
    expect(summary).not.toContain(t.plan.weekSummary.easyOfTarget(100, 80))
  })

  // G09: easy is Z1-Z2 time everywhere. A session still to run has no heart
  // rate yet and counts at its type's zone for its planned time.
  it('pools a week underway: zone time for runs, type zone for sessions ahead', () => {
    renderWeek({
      activities: [activity({ id: 'z', date: '2026-09-07', type: 'Tempo', durationSeconds: 1_800, hrZones: [
        { zone: 2, seconds: 900, percent: 50, minBpm: 0, maxBpm: null },
        { zone: 4, seconds: 900, percent: 50, minBpm: 0, maxBpm: null },
      ] })],
      planned: [{ date: '2026-09-10', name: 'Easy', type: 'Base', distanceM: 8_000, durationSecs: 1_800 }],
    })

    expect(screen.getByTestId('week-summary').textContent).toContain(t.plan.weekSummary.easyOfTarget(75, 80))
  })

  it('says nothing about easy time for runs without heart-rate zones', () => {
    renderWeek({ activities: [TEMPO, RACE] })

    expect(screen.getByTestId('week-summary').textContent).not.toContain('%')
  })
})


describe('the week summary against its plan', () => {
  // It added the run km to whatever was still planned and called the sum the
  // week, so Plan's "52 km" and Today's "6 of 23 km" read as two answers.
  it('reads what was run against what the plan scheduled', () => {
    renderWeek({
      activities: [TEMPO],
      planned: [
        { date: '2026-09-07', name: 'Tempo', distanceM: 5_000 },
        { date: '2026-09-10', name: 'Easy', distanceM: 8_000 },
      ],
    })

    const summary = screen.getByTestId('week-summary').textContent
    expect(summary).toContain(t.plan.weekSummary.ranOfPlan('4.8', '13'))
    expect(summary).toContain(t.plan.weekSummary.sessionsOfPlan(1, 2))
  })

  it('keeps the plain total for a week with no plan', () => {
    renderWeek({ activities: [TEMPO, RACE] })

    expect(screen.getByTestId('week-summary').textContent).toContain(`10 ${t.units.km} · ${t.plan.weekSummary.sessionsCount(2)}`)
  })
})

describe('missed sessions', () => {
  // Planned and not run drew as the same solid bar as a session still to come,
  // and the summary never counted them.
  const planned: PlannedWorkout[] = [
    { date: '2026-09-07', name: 'Easy', distanceM: 8_000 },
    { date: '2026-09-08', name: 'Tempo', distanceM: 9_000 },
    { date: '2026-09-11', name: 'Long', distanceM: 14_000 },
  ]

  it('counts them in the summary', () => {
    renderWeek({ planned })

    expect(screen.getByTestId('week-summary').textContent).toContain(t.plan.weekSummary.missed(2))
  })

  // H20: a check for done, the word only where it is news - missed.
  it('marks done with a check and names only a missed session', () => {
    renderWeek({ planned, activities: [TEMPO] })

    expect(within(screen.getByTestId('week-session-done:2026-09-07')).getByLabelText(t.sessionState.done)).toBeInTheDocument()
    expect(within(screen.getByTestId('week-session-garmin:2026-09-08:Tempo')).getByText(t.sessionState.missed)).toBeInTheDocument()
    expect(within(screen.getByTestId('week-session-garmin:2026-09-11:Long')).queryByText(t.sessionState.planned)).toBeNull()
  })

  // v4.3.1: today's row wears an 8 px accent dot and an accent day label.
  it('marks today in the list with the accent', () => {
    renderWeek({ planned: [...planned, { date: TODAY, name: 'Easy', distanceM: 8_000 }] as PlannedWorkout[] })
    const dots = screen.getAllByTestId('week-session-today-dot')
    expect(dots).toHaveLength(1)
    expect(dots[0]!.style.background).toBe('var(--accent)')
    expect(dots[0]!.parentElement!.querySelector('.text-accent-text')).not.toBeNull()
  })
})

describe('the week summary in plain words', () => {
  // "0/100 easy planned" read as 0 of 100 km.
  it('writes the easy share as a sentence with its guide', () => {
    renderWeek({ activities: [TEMPO], planned: [{ date: '2026-09-10', name: 'Intervals', type: 'VO2Max', distanceM: 6_000, durationSecs: 1_800 }] })

    expect(screen.getByTestId('week-summary')).toHaveTextContent(t.plan.weekSummary.easyOfTarget(0, 80))
  })

  // "Load 19/297 pts" was never explained.
})

describe('WeekView state legend', () => {
  // Kept at the owner's request: the key to the bars' done, planned, missed and today shapes.
  it('keys the week bars under them', () => {
    renderWeek({ activities: [TEMPO] })
    const legend = screen.getByTestId('day-state-legend')
    for (const label of [t.sessionState.done, t.sessionState.planned, t.sessionState.missed, t.sessionState.today]) {
      expect(legend.textContent).toContain(label)
    }
  })

  // v4.3.1: the swatches are the bars' shapes in neutral ink, today the accent.
  it('draws each swatch in the shape its bar has', () => {
    renderWeek({ activities: [TEMPO] })
    const swatch = (key: string) => screen.getByTestId('day-state-legend').querySelector<HTMLElement>(`[data-legend-swatch="${key}"]`)!
    expect(swatch('done').className).toContain('state-done')
    expect(swatch('done').style.getPropertyValue('--state-color')).toBe('var(--faint-strong)')
    expect(swatch('planned').className).toContain('state-planned')
    expect(swatch('planned').style.getPropertyValue('--state-color')).toBe('var(--muted-foreground)')
    expect(swatch('missed').className).toContain('state-missed')
    expect(swatch('missed').style.getPropertyValue('--state-color')).toBe('var(--muted-foreground)')
    expect(swatch('today').className).toContain('today-bar')
  })
})
