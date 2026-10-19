import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { buildCoachingOverview, type CoachingOverview, type PrescriptionView } from '@/application/coaching/GetCoachingView'
import type { ActivitySummary, PlannedWorkout } from '@/domain/activity/types'
import type { TrainingZonesData } from '@/application/usecases/GetTrainingZones'
import type { CoachingPlan } from '@/domain/coaching/types'
import { plan } from '@/domain/coaching/__tests__/fixtures'
import { t } from '@/i18n'
import { formatDate, formatDurationWords, formatPace } from '@/lib/formatters'
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
    targetEvent: { ...base.targetEvent!, date: '2026-11-29', role: 'primary' },
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
      hrBounds={HR_BOUNDS}
      today={TODAY}
      atPresent
      onToday={() => {}}
      trainingZones={options.trainingZones ?? null}
    />
  )
}

describe('WeekView weekly metrics', () => {
  // H20: one line, and no load behind an info button.
  it('reads the week in one line, with no info button', () => {
    renderWeek({ activities: [TEMPO, RACE], coaching: overview() })

    expect(within(screen.getByTestId('week-summary')).queryByRole('button')).toBeNull()
  })

  it('shows the completed activities and the coach prescription side by side', () => {
    renderWeek({ activities: [TEMPO, RACE], coaching: overview() })

    expect(screen.getByLabelText(/3 × 8 min threshold/)).toBeInTheDocument()
    expect(screen.getByLabelText(/September 7/)).toBeInTheDocument()
    expect(screen.getByLabelText(/September 8/)).toBeInTheDocument()
  })
})

// Design review, Oct 2026: the phase moved into Plan's subtitle (planPhase.ts).
describe('WeekView without a phase card', () => {
  it('draws no phase card, phase track or Races section', () => {
    renderWeek({ coaching: overview({ coachingPlan: blockPlan() }) })

    expect(screen.queryByTestId('phase-line')).toBeNull()
    expect(screen.queryByTestId('phase-track')).toBeNull()
    expect(screen.queryByTestId('race-footer')).toBeNull()
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

  // Owner, Oct 2026: a rest day is a short row in the list, not a card.
  it('lists an empty day as a Rest row, with no day card', () => {
    renderWeek()

    expect(screen.getByTestId(`week-rest-${TODAY}`).textContent).toContain(t.sessionState.rest)
    expect(screen.getAllByTestId(/^week-rest-/)).toHaveLength(7)
    expect(screen.queryByTestId('selected-day-eyebrow')).toBeNull()
  })
})

describe('WeekView easy share', () => {
  // v4.17.1: the easy-time line under the stats ("100% if the week goes to
  // plan · guide 80%") read as a second adherence figure beside the Plan
  // adherence stat; the easy share lives on Activities and Analytics.
  it('prints no easy-time line under the week stats', () => {
    renderWeek({
      activities: [activity({ id: 'z', date: '2026-09-07', type: 'Tempo', durationSeconds: 1_800, hrZones: [
        { zone: 2, seconds: 900, percent: 50, minBpm: 0, maxBpm: null },
        { zone: 4, seconds: 900, percent: 50, minBpm: 0, maxBpm: null },
      ] })],
      planned: [{ date: '2026-09-10', name: 'Easy', type: 'Base', distanceM: 8_000, durationSecs: 1_800 }],
    })

    expect(screen.queryByTestId('week-easy')).toBeNull()
    expect(screen.getByTestId('week-summary').textContent).not.toMatch(/guide|goes to plan/)
  })
})

/** One of the week's figures: its bold number, and the words after it. */
function figure(testId: string): { value: string; unit: string } {
  const el = screen.getByTestId(testId)
  const value = el.querySelector('b')!.textContent ?? ''
  return { value, unit: (el.textContent ?? '').slice(value.length).trim() }
}

describe('the week summary against its plan', () => {
  // It added the run km to whatever was still planned and called the sum the
  // week, so Plan's "52 km" and Today's "6 of 23 km" read as two answers.
  // Design review, Oct 2026: one line - distance, sessions, adherence.
  it('reads what was run against what the plan scheduled, on one line', () => {
    renderWeek({
      activities: [TEMPO],
      planned: [
        { date: '2026-09-07', name: 'Tempo', distanceM: 5_000 },
        { date: '2026-09-10', name: 'Easy', distanceM: 8_000 },
      ],
    })

    const s = t.plan.stats
    expect(figure('week-distance')).toEqual({ value: '4.8', unit: s.ofKm('13') })
    expect(figure('week-sessions-count')).toEqual({ value: '1', unit: s.ofSessions(2) })
    // The one session due so far was run; Thursday's is still to come.
    expect(figure('week-adherence')).toEqual({ value: '100%', unit: s.adherence })
    expect(screen.getByTestId('week-summary').className).toContain('border-t')
    expect(screen.getByTestId('week-distance').querySelector('b')!.className).toContain('text-[17px]')
  })

  it('keeps the plain total for a week with no plan, and no adherence', () => {
    renderWeek({ activities: [TEMPO, RACE] })

    expect(figure('week-distance')).toEqual({ value: '10', unit: t.units.km })
    expect(figure('week-sessions-count')).toEqual({ value: '2', unit: t.plan.stats.sessions(2) })
    expect(screen.queryByTestId('week-adherence')).toBeNull()
  })

  it('reads a week not started as its plan', () => {
    render(
      <WeekView
        weekStart={new Date(2026, 8, 14)}
        byDate={new Map()}
        byDatePlanned={new Map([['2026-09-15', { date: '2026-09-15', name: 'Easy', distanceM: 8_000 }]])}
        today={TODAY}
        atPresent={false}
        onToday={() => {}}
      />
    )

    const s = t.plan.stats
    expect(figure('week-distance')).toEqual({ value: '8', unit: s.kmPlanned })
    expect(figure('week-sessions-count')).toEqual({ value: '1', unit: s.planned })
    expect(screen.queryByTestId('week-adherence')).toBeNull()
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

  // v4.17: of what was due, how much was run - the number alone.
  it('reads plan adherence off the sessions already due', () => {
    renderWeek({ planned, activities: [TEMPO] })

    expect(figure('week-adherence').value).toBe('50%')
  })

  it('draws a missed day as the negative status in the chart and names it in the list', () => {
    renderWeek({ planned, activities: [TEMPO] })

    const bar = screen.getByLabelText(/September 8/).querySelector<HTMLElement>('[data-bar-state]')!
    expect(bar.dataset.barState).toBe('missed')
    expect(bar.className).toContain('border-[var(--neg)]')
    expect(within(screen.getByTestId('week-session-garmin:2026-09-08:Tempo')).getByText(t.sessionState.missed).className).toContain('text-[var(--neg)]')
  })

  // H20: a check for done, the word only where it is news - missed.
  it('marks done with a check and names only a missed session', () => {
    renderWeek({ planned, activities: [TEMPO] })

    expect(within(screen.getByTestId('week-session-done:2026-09-07')).getByLabelText(t.sessionState.done)).toBeInTheDocument()
    expect(within(screen.getByTestId('week-session-garmin:2026-09-08:Tempo')).getByText(t.sessionState.missed)).toBeInTheDocument()
    expect(within(screen.getByTestId('week-session-garmin:2026-09-11:Long')).queryByText(t.sessionState.planned)).toBeNull()
  })

  // v4.17: today's row keeps its type's dot; its day label is the accent.
  it('marks today in the list with the accent', () => {
    renderWeek({ planned: [...planned, { date: TODAY, name: 'Easy', distanceM: 8_000 }] as PlannedWorkout[] })
    const days = screen.getAllByTestId('week-session-today-day')
    expect(days).toHaveLength(1)
    expect(days[0]!.className).toContain('text-accent-text')
    expect(days[0]!.nextElementSibling as HTMLElement).toHaveStyle({ background: 'var(--zone-2)' })
  })
})

describe('WeekView state legend', () => {
  // Kept at the owner's request: the key to the bars' done, planned, missed and today shapes.
  it('keys the week bars under them', () => {
    renderWeek({ activities: [TEMPO] })
    const legend = screen.getByTestId('day-state-legend')
    for (const label of [t.sessionState.done, t.plan.legend.plannedByType, t.sessionState.missed, t.sessionState.today]) {
      expect(legend.textContent).toContain(label)
    }
  })

  // v4.17: the swatches are the bars' shapes - done the accent, planned
  // dashed (its colour is the session's type), missed neg, today the outline.
  it('draws each swatch in the shape its bar has', () => {
    renderWeek({ activities: [TEMPO] })
    const legend = within(screen.getByTestId('day-state-legend'))
    const swatchOf = (label: string) => legend.getByText(label).firstElementChild as HTMLElement

    expect(swatchOf(t.sessionState.done).style.background).toBe('var(--accent)')
    expect(swatchOf(t.plan.legend.plannedByType).style.border).toContain('dashed')
    expect(swatchOf(t.sessionState.missed).className).toContain('border-[var(--neg)]')
    expect(swatchOf(t.sessionState.today).className).toContain('border-accent')
  })
})

describe('the session rows', () => {
  // v4.17: day · type dot · title over its target · km · chevron.
  it("writes a planned row's target as its zone, pace and recovery", () => {
    renderWeek({ coaching: overview(), trainingZones: ZONES })

    const row = screen.getByTestId('week-session-workout-threshold')
    const r = t.plan.row
    expect(row.textContent).toContain(`${t.trainingZones.zoneNumber(4)} · ${r.pace('4:25–4:30')} · ${r.recovery('2:00')}`)
    expect(row.textContent).toContain(t.units.km)
    expect(row.querySelector('svg')).not.toBeNull()
  })

  it("writes a run's row as its time and pace, with a check", () => {
    renderWeek({ activities: [TEMPO] })

    const row = screen.getByTestId('week-session-done:2026-09-07')
    expect(row.textContent).toContain(`${formatDurationWords(TEMPO.durationSeconds)} · ${formatPace(TEMPO.durationSeconds / TEMPO.distanceKm)}`)
    expect(within(row).getByLabelText(t.sessionState.done).className).toContain('text-[var(--pos)]')
  })
})

describe('the selected day', () => {
  // Design review, Oct 2026: the date inside the card; today's card in a 2 pt accent border.
  it('heads its card with its date, inside it, in the accent only for today', async () => {
    const user = userEvent.setup()
    renderWeek({ coaching: overview() })

    const card = screen.getByTestId('plan-workout-row-workout-threshold')
    const eyebrow = within(card).getByTestId('selected-day-eyebrow')
    expect(eyebrow.textContent).toBe(`${t.plan.today} · ${formatDate(TODAY)}`)
    expect(eyebrow.className).toContain('text-accent-text')
    expect(card.className).toContain('border-2')
    expect(card.className).toContain('border-[var(--accent)]')

    // A rest day selected has no card: its row in the list says it.
    await user.click(screen.getByLabelText(/September 10/))
    expect(screen.queryByTestId('selected-day-eyebrow')).toBeNull()
    expect(screen.getByTestId('week-rest-2026-09-10')).toBeInTheDocument()
  })

  it("puts today's border on a run done today, and today's rest row in the accent", () => {
    const today = activity({ id: 'a-today', date: TODAY, type: 'Base', distanceKm: 8 })
    const done = renderWeek({ activities: [today] })
    const link = screen.getByRole('link', { name: new RegExp(formatDate(TODAY)) })
    expect(within(link).getByTestId('selected-day-eyebrow')).toBeInTheDocument()
    expect(link.className).toContain('border-[var(--accent)]')
    done.unmount()

    renderWeek()
    expect(screen.getByTestId(`week-rest-${TODAY}`).firstElementChild!.className).toContain('text-accent-text')
  })

  it('lists rest days between the sessions, in day order', () => {
    renderWeek({ coaching: overview() })

    const rows = [...screen.getByTestId('week-sessions').children].map((row) => row.getAttribute('data-testid'))
    expect(rows[0]).toBe('week-rest-2026-09-07')
    expect(rows).toContain('week-session-workout-threshold')
    expect(rows.indexOf('week-rest-2026-09-07')).toBeLessThan(rows.indexOf('week-session-workout-threshold'))
  })
})

// Design review, Oct 2026: a row takes the coach's short name, where it
// wrote one; the day card has the room for the whole name; and an older name
// too long for its row keeps to two lines.
describe('the names a week shows', () => {
  function named(): CoachingPlan {
    const base = plan()
    const [threshold] = base.weeks[0]!.workouts
    base.weeks[0]!.workouts = [{ ...threshold!, title: 'Threshold · 3 × 8′ @ 4:28', shortName: 'Threshold 3×8′' }]
    return base
  }

  it("puts the short name in the week's rows and the whole one on the day's card", () => {
    renderWeek({ coaching: overview({ coachingPlan: named() }) })

    expect(screen.getByTestId('week-session-workout-threshold')).toHaveTextContent('Threshold 3×8′')
    expect(screen.getByTestId('week-session-workout-threshold')).not.toHaveTextContent('@ 4:28')
    expect(screen.getByTestId('plan-workout-row-workout-threshold')).toHaveTextContent('Threshold · 3 × 8′ @ 4:28')
  })

  it('keeps an older name to two lines in its row', () => {
    renderWeek({ planned: [{ date: TODAY, name: "Répétitions allure d'objectif - 4x3'@4:24", type: 'Threshold', durationSecs: 3_600 }] })

    const row = screen.getByTestId(/^week-session-garmin:/)
    expect(within(row).getByText("Répétitions allure d'objectif - 4x3'@4:24").className).toContain('line-clamp-2')
  })
})
