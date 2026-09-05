import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { buildCoachingOverview, type CoachingOverview, type PrescriptionView } from '@/application/coaching/GetCoachingView'
import type { ActivitySummary, PlannedWorkout } from '@/domain/activity/types'
import type { PlanPhaseRange } from '@/application/usecases/GetTrainingPlan'
import type { UpcomingRace } from '@/application/usecases/GetGoalsData'
import type { CoachingPlan } from '@/domain/coaching/types'
import { plan } from '@/domain/coaching/__tests__/fixtures'
import { t } from '@/i18n'
import { WeekView } from '../WeekView'

// The grid week runs Mon 2026-09-07 -> Sun 2026-09-13, with today on the Wednesday.
const TODAY = '2026-09-09'
const WEEK_START = new Date(2026, 8, 7)
const HR_BOUNDS = { maxHr: 202, restingHr: 45 }

/** Shaped like the real September activities: HR, duration and climb all present. */
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

/**
 * A rolling 4-week block inside a 12-week macrocycle: training starts Sep 7 and
 * the primary target is Nov 29, well beyond the block's own Oct 4 end.
 */
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

function renderWeek(options: {
  coaching?: CoachingOverview
  planned?: PlannedWorkout[]
  activities?: ActivitySummary[]
  nextRace?: UpcomingRace | null
  planPhaseRanges?: PlanPhaseRange[]
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
    />
  )
}

/** The three stat tiles, once their count-up animation has settled. */
async function expectStats(easyHard: string, load: string, climb: string) {
  const read = (label: string) =>
    screen.getByText(label).parentElement!.textContent!.replace(label, '').trim()
  await waitFor(() => {
    expect([read(t.plan.weekSummary.easyHard), read(t.plan.weekSummary.load), read(t.plan.weekSummary.climb)])
      .toEqual([easyHard, load, climb])
  })
}

describe('WeekView weekly metrics', () => {
  // The fixture activities carry no hrZones, so the easy/hard split is unknown -
  // load and climb still come straight off what was run.
  it('reports Garmin activity metrics for a week with no coaching', async () => {
    renderWeek({ activities: [TEMPO, RACE] })

    await expectStats('–', '141', `26 ${t.units.m}`)
  })

  it('keeps those same metrics when a coaching block covers the week', async () => {
    renderWeek({ activities: [TEMPO, RACE], coaching: overview() })

    // Coach prescriptions must not displace what the athlete actually ran.
    await expectStats('–', '141', `26 ${t.units.m}`)
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

    // Sep 7 -> Nov 29 is 12 weeks; today (Sep 9) is in the first of them.
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

    // The day cell carries it via its type tile and label; the detail is the
    // only place the session is spelled out. No third copy anywhere.
    expect(screen.getAllByTestId('coach-calendar-2026-09-09')).toHaveLength(1)
    expect(screen.getAllByTestId('coach-prescription-detail')).toHaveLength(1)
    expect(screen.getAllByText('3 × 8 min threshold')).toHaveLength(1)
  })

  it('uses todays prescription for the Today card', () => {
    renderWeek({ coaching: overview() })

    const detail = screen.getByTestId('coach-prescription-detail')
    expect(within(detail).getByText('3 × 8 min threshold')).toBeInTheDocument()
    expect(within(detail).getByText(t.coaching.states.prescribed)).toBeInTheDocument()
    expect(detail.textContent).toContain('4:25–4:30/km')
  })

  it('keeps the structure collapsed so the Today card stays short', () => {
    renderWeek({ coaching: overview() })

    const detail = screen.getByTestId('coach-prescription-detail')
    expect(within(detail).getByText(t.coaching.showStructure).closest('details')!.open).toBe(false)
    // The Today slot shows the session, not the rest-day fallback.
    expect(within(detail.parentElement!).queryByText(t.plan.restDay)).not.toBeInTheDocument()
  })

  it('keeps Garmin out of the card while the session is synced as prescribed', () => {
    renderWeek({
      coaching: overview({ garminPlanned: [{ date: TODAY, name: 'Track session', type: 'Threshold', durationSecs: 3_600 }] }),
    })

    expect(screen.getByTestId('coach-prescription-detail').textContent).not.toMatch(/Garmin out of date/i)
  })

  it('surfaces an out-of-date Garmin session, which the athlete must act on', () => {
    renderWeek({
      coaching: overview({ garminPlanned: [{ date: TODAY, name: 'Easy jog', type: 'Base', durationSecs: 3_600 }] }),
    })

    expect(within(screen.getByTestId('coach-prescription-detail')).getByText(t.coaching.garminOutOfDate)).toBeInTheDocument()
  })

  it('still distinguishes the Garmin planned workout sharing the day', () => {
    const garmin: PlannedWorkout = { date: TODAY, name: 'Track session', type: 'Threshold', durationSecs: 3_600 }
    renderWeek({ coaching: overview({ garminPlanned: [garmin] }), planned: [garmin] })

    expect(screen.getByText(t.coaching.garminSession('Track session'))).toBeInTheDocument()
  })

  it('drops the prescription card on a day that has none', async () => {
    const user = userEvent.setup()
    renderWeek({ coaching: overview() })

    await user.click(screen.getByLabelText(/September 10/))
    expect(screen.queryByTestId('coach-prescription-detail')).not.toBeInTheDocument()
  })
})

describe('WeekView Coming Up', () => {
  it('lists future prescriptions without repeating todays', () => {
    renderWeek({ coaching: overview() })

    expect(screen.getByText(t.plan.comingUp)).toBeInTheDocument()
    expect(screen.getByTestId('coach-coming-up-workout-easy')).toBeInTheDocument()
    // Today's threshold session is the Today card, so it must not reappear here.
    expect(screen.queryByTestId('coach-coming-up-workout-threshold')).not.toBeInTheDocument()
  })

  it('falls back to Garmin planned workouts when there is no coaching', () => {
    renderWeek({ planned: [{ date: '2026-09-11', name: 'Long run', type: 'Base' }] })

    expect(screen.getByText(t.plan.comingUp)).toBeInTheDocument()
    expect(screen.getByText('Long run')).toBeInTheDocument()
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

  it('counts days, not block progress, for each listed race', () => {
    renderWeek({ coaching: overview() })

    expect(screen.getByText(t.plan.raceFooter.daysAway(39))).toBeInTheDocument()
  })

  it('keeps the Garmin race when there is no coaching', () => {
    renderWeek({ nextRace: { date: '2026-10-18', name: 'City Half', distance: '21K' } })

    expect(screen.getByText('City Half')).toBeInTheDocument()
  })
})

describe('WeekView without coaching', () => {
  it('keeps the original layout and adds no coaching placeholders', () => {
    renderWeek({ activities: [TEMPO, RACE], planned: [{ date: TODAY, name: 'Track session', type: 'Threshold', durationSecs: 3_600 }] })

    expect(screen.getByText(t.plan.weekSummary.easyHard)).toBeInTheDocument()
    expect(screen.queryByTestId('coach-prescription-detail')).not.toBeInTheDocument()
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
