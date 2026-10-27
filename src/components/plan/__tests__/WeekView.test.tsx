import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildCoachingOverview, type CoachingOverview, type PrescriptionView } from '@/application/coaching/GetCoachingView'
import type { PlannedWorkout } from '@/domain/activity/types'
import type { CrossTrainingEntry } from '@/domain/activity/crossTraining'
import type { PlanRun } from '../planRun'
import type { PlanPhaseRange } from '@/application/usecases/GetTrainingPlan'
import type { UpcomingRace } from '@/application/usecases/GetGoalsData'
import type { TrainingZonesData } from '@/application/usecases/GetTrainingZones'
import type { CoachingPlan } from '@/domain/coaching/types'
import { plan, workout } from '@/domain/coaching/__tests__/fixtures'
import { t } from '@/i18n'
import type { CoachWords } from '@/application/coaching/GetCoachWords'
import { forgetCoachWords } from '@/components/coaching/useCoachWords'
import { WeekView } from '../WeekView'

const TODAY = '2026-09-09'
const WEEK_START = new Date(2026, 8, 7)

function activity(overrides: Partial<PlanRun> & Pick<PlanRun, 'id' | 'date' | 'type'>): PlanRun {
  return {
    description: '',
    distanceKm: 5,
    durationSeconds: 1_500,
    paceSecPerKm: 300,
    avgHeartRate: 160,
    zonePercents: [],
    shownType: overrides.type,
    ...overrides,
  }
}

const TEMPO = activity({ id: 'a-tempo', date: '2026-09-07', type: 'Tempo', distanceKm: 4.79, durationSeconds: 1_756 })
const RACE = activity({ id: 'a-race', date: '2026-09-08', type: 'Race', distanceKm: 5.25, durationSeconds: 1_310 })

function blockPlan(): CoachingPlan {
  const base = plan()
  return {
    ...base,
    macrocycleStartDate: '2026-09-07',
    targetEvent: { ...base.targetEvent!, date: '2026-11-29', role: 'primary' },
  }
}

function overview(options: { coachingPlan?: CoachingPlan } = {}): CoachingOverview {
  return buildCoachingOverview(options.coachingPlan ?? plan(), [], [], TODAY)
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

interface Options {
  coaching?: CoachingOverview
  planned?: PlannedWorkout[]
  activities?: PlanRun[]
  nextRace?: UpcomingRace | null
  planPhaseRanges?: PlanPhaseRange[]
  trainingZones?: TrainingZonesData | null
  selected?: string
  onSelectDate?: (date: string) => void
  others?: CrossTrainingEntry[]
}

// The selected day lives in PlanClient's URL; a plain state stands in for it.
function Harness(options: Options) {
  const [selected, setSelected] = useState(options.selected ?? TODAY)
  const activities = options.activities ?? []
  const byDate = new Map<string, PlanRun[]>()
  for (const a of activities) byDate.set(a.date, [...(byDate.get(a.date) ?? []), a])
  return (
    <WeekView
      weekStart={WEEK_START}
      selectedDate={selected}
      onSelectDate={(date) => {
        setSelected(date)
        options.onSelectDate?.(date)
      }}
      byDate={byDate}
      byDateOther={new Map((options.others ?? []).map((entry) => [entry.date, [entry]]))}
      byDatePlanned={new Map((options.planned ?? []).map((p) => [p.date, p]))}
      byDateCoach={options.coaching ? byDateCoach(options.coaching) : undefined}
      coaching={options.coaching ?? null}
      today={TODAY}
      atPresent
      onToday={() => {}}
      planPhaseRanges={options.planPhaseRanges ?? []}
      nextRace={options.nextRace ?? null}
      trainingZones={options.trainingZones ?? null}
    />
  )
}

function renderWeek(options: Options = {}) {
  return render(<Harness {...options} />)
}

const day = (date: string) => screen.getByTestId(`day-${date}`)
const bar = (date: string) => day(date).querySelector<HTMLElement>('[data-bar-state]')!

describe('the phase card', () => {
  it('counts the block’s sessions so far run as planned', () => {
    const threshold = (distanceKm: number) => activity({ id: 'a-threshold', date: TODAY, type: 'Threshold', distanceKm, durationSeconds: distanceKm * 360 })
    const { unmount } = renderWeek({ coaching: overview({ coachingPlan: blockPlan() }), activities: [threshold(10)] })
    expect(screen.getByTestId('phase-tally').textContent).toBe(t.plan.phase.asPlanned(1, 1))
    unmount()

    renderWeek({ coaching: overview({ coachingPlan: blockPlan() }), activities: [threshold(6)] })
    expect(screen.getByTestId('phase-tally').textContent).toBe(t.plan.phase.asPlanned(0, 1))
  })


  it('names the phase, the week in it and the race it builds to', () => {
    renderWeek({ coaching: overview({ coachingPlan: blockPlan() }) })

    const card = screen.getByTestId('phase-line')
    expect(within(card).getByRole('heading').textContent).toBe(t.plan.weekPurpose.planPhase.base)
    const weekOf = t.plan.phase.weekOf(5)
    expect(card.textContent).toContain(`${weekOf.before} 1 ${weekOf.after}`)
    // Sep 9 to Nov 29 is 81 days: 12 weeks.
    expect(card.textContent).toContain(t.plan.phase.raceInWeeks('10K', 12))
    expect(within(card).queryByRole('link')).toBeNull()
  })

  it('draws a segment per week of the phase, the weeks so far in the accent', () => {
    renderWeek({ coaching: overview({ coachingPlan: blockPlan() }) })

    const segments = screen.getByTestId('phase-segments').children
    expect(segments).toHaveLength(5)
    expect([...segments].filter((s) => s.hasAttribute('data-done'))).toHaveLength(1)
  })

  it('counts general preparation to the end of the block when the plan has no race', () => {
    const general: CoachingPlan = { ...plan(), macrocycleStartDate: '2026-08-31', targetEvent: undefined }
    renderWeek({ coaching: overview({ coachingPlan: general }) })

    const card = screen.getByTestId('phase-line')
    expect(within(card).getByRole('heading').textContent).toBe(t.plan.weekPurpose.generalPreparation)
    // Aug 31 to the block's end on Oct 4: five weeks, this the second.
    const weekOf = t.plan.phase.weekOf(5)
    expect(card.textContent).toBe(`${t.plan.weekPurpose.generalPreparation}${weekOf.before} 2 ${weekOf.after}`)
    expect(within(card).getByRole('link').getAttribute('href')).toBe('/plan/checkpoint')
  })

  it("reads Garmin's phases and next race without coaching", () => {
    renderWeek({
      planPhaseRanges: [
        { phase: 'base', startDate: '2026-08-10', endDate: '2026-09-06' },
        { phase: 'build', startDate: '2026-09-07', endDate: '2026-10-04' },
      ],
      nextRace: { date: '2026-09-13', name: 'City 5K', distance: '5K' },
    })

    const card = screen.getByTestId('phase-line')
    expect(within(card).getByRole('heading').textContent).toBe(t.plan.weekPurpose.planPhase.build)
    expect(card.textContent).toContain(t.plan.phase.raceInDays('5K', 4))
  })

  it('is not drawn for a week no plan covers', () => {
    renderWeek()

    expect(screen.queryByTestId('phase-line')).toBeNull()
  })
})

describe('the week row', () => {
  it('reads what was run against what the plan scheduled, in km', () => {
    renderWeek({
      activities: [TEMPO],
      planned: [
        { date: '2026-09-07', name: 'Tempo', type: 'Tempo', distanceM: 5_000 },
        { date: '2026-09-10', name: 'Easy', type: 'Base', distanceM: 8_000 },
      ],
    })

    expect(screen.getByTestId('week-summary').textContent).toBe(`4.8 ${t.plan.weekRow.kmOf('13')}`)
  })

  it('keeps the plain totals for a week with no plan', () => {
    renderWeek({ activities: [TEMPO, RACE] })

    expect(screen.getByTestId('week-summary').textContent).toBe(`10 ${t.units.km}`)
  })
})

describe('the day selector', () => {
  it('has the seven days, today selected and in the accent', () => {
    renderWeek()

    expect(within(screen.getByTestId('day-selector')).getAllByRole('button')).toHaveLength(7)
    expect(day(TODAY).getAttribute('aria-pressed')).toBe('true')
    expect(day(TODAY).className).toContain('state-today')
  })

  it('draws each day as a bar as long as its km, in its colour, and rest as a stub', () => {
    renderWeek({ activities: [TEMPO], planned: [{ date: '2026-09-12', name: 'Long run', type: 'Base', distanceM: 18_000 }] })

    // 5 px a km, capped at 68 px.
    expect(bar('2026-09-07').style.height).toBe(`${Math.round(4.79 * 5)}px`)
    expect(bar('2026-09-07').style.background).toBe('var(--zone-3)')
    expect(bar('2026-09-12').style.height).toBe('68px')
    // The long run shares the easy blue.
    expect(bar('2026-09-12').style.background).toBe('var(--zone-2)')
    expect(bar('2026-09-10').getAttribute('data-bar-state')).toBe('rest')
    expect(bar('2026-09-10').style.height).toBe('5px')
  })

  it('names each day by its session letter, a dash on a rest day', () => {
    renderWeek({ activities: [TEMPO], planned: [{ date: '2026-09-12', name: 'Long run', type: 'Base', distanceM: 18_000 }] })

    expect(day('2026-09-07').textContent).toContain(t.plan.typeLetters.Tempo)
    expect(day('2026-09-12').textContent).toContain(t.plan.typeLetters.long)
    expect(day('2026-09-10').textContent).toContain('–')
  })

  it('draws a missed session as a dashed amber outline', () => {
    renderWeek({ planned: [{ date: '2026-09-08', name: 'Easy', type: 'Base', distanceM: 8_000 }] })

    expect(bar('2026-09-08').getAttribute('data-bar-state')).toBe('missed')
    expect(bar('2026-09-08').className).toContain('border-[var(--warn)]')
  })

  it('selects a day on tap', async () => {
    const user = userEvent.setup()
    const onSelectDate = vi.fn()
    renderWeek({ onSelectDate })

    await user.click(day('2026-09-11'))
    expect(onSelectDate).toHaveBeenCalledWith('2026-09-11')
    expect(day('2026-09-11').getAttribute('aria-pressed')).toBe('true')
  })
})

describe('a session still to come', () => {
  it('heads its card with the day and the session type, then its title and target', () => {
    renderWeek({ coaching: overview(), trainingZones: ZONES })

    const card = screen.getByTestId('plan-workout-workout-threshold')
    expect(card.textContent).toContain(t.activityTypes.Threshold)
    expect(within(card).getByRole('heading').textContent).toBe('3 × 8 min threshold')
    expect(card.textContent).toContain(`1:00 ${t.units.hour}`)
    expect(card.textContent).toContain(t.plan.session.targetPace('4:25–4:30'))
    expect(within(card).getByTestId('plan-status').textContent).toBe(t.coaching.states.prescribed)
  })

  it('titles it by its set under the naming rules, its type left to the eyebrow', () => {
    const coachingPlan = plan()
    coachingPlan.weeks[0]!.workouts[0]!.title = 'Threshold · 3 × 8′ @ 4:25'
    renderWeek({ coaching: overview({ coachingPlan }), trainingZones: ZONES })

    const card = screen.getByTestId('plan-workout-workout-threshold')
    expect(within(card).getByRole('heading').textContent).toBe('3 × 8′ @ 4:25')
    expect(card.textContent?.toUpperCase()).toContain(t.activityTypes.Threshold.toUpperCase())
  })

  it('draws its intensity profile step by step, work full height', () => {
    renderWeek({ coaching: overview() })

    const tones = [...screen.getByTestId('intensity-profile').children].map((block) => block.getAttribute('data-tone'))
    expect(tones).toEqual(['ease', 'work', 'recovery', 'work', 'recovery', 'work', 'recovery', 'ease'])
  })

  it('sits the profile 10 pt under the detail line and 14 pt over the steps, 44 pt tall', () => {
    renderWeek({ coaching: overview() })
    const profile = screen.getByTestId('intensity-profile')
    expect(profile.className).toContain('mt-2.5')
    expect(profile.className).toContain('h-[44px]')
    const work = [...profile.children].find((block) => block.getAttribute('data-tone') === 'work') as HTMLElement
    expect(work.style.height).toBe('44px')
    expect(screen.getByTestId('workout-steps').className).toContain('mt-3.5')
  })

  it('drops the structure bar for a one-step session and lists its targets', () => {
    const easy = workout({
      id: 'workout-easy-single',
      type: 'easy',
      title: 'Easy run',
      totalDurationSeconds: 3_600,
      blocks: [{ kind: 'effort', target: { durationSeconds: 3_600, paceSecPerKm: { min: 330, max: 384 } } }],
    })
    const single = plan({
      weeks: [{ id: 'week-1', index: 1, startDate: '2026-09-07', endDate: '2026-09-13', focus: 'Aerobic base', workouts: [easy] }],
    })
    renderWeek({ coaching: overview({ coachingPlan: single }), trainingZones: ZONES })

    const card = screen.getByTestId('plan-workout-workout-easy-single')
    expect(within(card).queryByTestId('intensity-profile')).toBeNull()
    const targets = within(card).getAllByTestId('plan-target')
    expect(targets[0]!.textContent).toBe(`${t.plan.session.paceTarget}5:30–6:24 ${t.units.perKm}`)
  })

  it('keeps the structure bar for a session of more than one step', () => {
    renderWeek({ coaching: overview() })

    expect(screen.getByTestId('plan-workout-workout-threshold')).toContainElement(screen.getByTestId('intensity-profile'))
  })

  it('lists its steps, the reps grouped', () => {
    renderWeek({ coaching: overview() })

    const rows = within(screen.getByTestId('workout-steps')).getAllByRole('listitem')
    expect(rows.map((row) => row.firstElementChild?.nextElementSibling?.firstElementChild?.textContent)).toEqual([
      t.plan.steps.warmup,
      t.plan.steps.reps(3, t.plan.steps.minutes(8), t.activityTypes.Threshold.toLowerCase()),
      t.plan.steps.cooldown,
    ])
    expect(rows[1]!.textContent).toContain('Z4 · 4:25–4:30 /km · 2:00 rec')
    expect(rows[1]!.textContent).toContain(t.plan.steps.minutes(28))
  })

  it('has no send-to-watch and no list of the week under it', () => {
    const { container } = renderWeek({ coaching: overview() })

    expect(container.textContent).not.toMatch(/watch/i)
    expect(screen.queryByTestId('week-sessions')).toBeNull()
  })
})

describe('a day that is over', () => {
  it('reads planned against done, with a way into the run', async () => {
    const user = userEvent.setup()
    renderWeek({
      activities: [activity({ ...TEMPO, zonePercents: [null, null, 68] })],
      planned: [{ date: '2026-09-07', name: 'Tempo', type: 'Tempo', distanceM: 5_000 }],
    })

    await user.click(day('2026-09-07'))
    const card = screen.getByTestId('plan-day-done-2026-09-07')
    // The run's title names the session already: the plan's line keeps to its amount.
    expect(within(card).getByTestId('planned-line').textContent).toBe(`${t.plan.dayCard.planned}5 ${t.units.km}`)
    const done = within(card).getByTestId('done-line').textContent
    expect(done).toContain(`4.8 ${t.units.km} · 5:00 /km · Z3 68%`)
    expect(within(card).getByRole('img', { name: t.plan.dayCard.asPlanned })).toBeInTheDocument()
    expect(within(card).getByRole('link', { name: t.plan.dayCard.viewActivity }).getAttribute('href')).toBe('/activities/a-tempo')
  })

  it('says how a run fell short of its session instead of calling it as planned', async () => {
    const user = userEvent.setup()
    renderWeek({
      activities: [activity({ ...TEMPO, distanceKm: 3.2 })],
      planned: [{ date: '2026-09-07', name: 'Tempo', type: 'Tempo', distanceM: 5_000 }],
    })

    await user.click(day('2026-09-07'))
    const card = screen.getByTestId('plan-day-done-2026-09-07')
    expect(within(card).queryByRole('img', { name: t.plan.dayCard.asPlanned })).toBeNull()
    expect(within(card).getByTestId('plan-fit').textContent).toBe(t.plan.dayCard.fit.shorter)
  })

  it('calls a quality run on an easy day harder than planned', async () => {
    const user = userEvent.setup()
    renderWeek({
      activities: [activity({ ...TEMPO, distanceKm: 5 })],
      planned: [{ date: '2026-09-07', name: 'Easy', type: 'Base', distanceM: 5_000 }],
    })

    await user.click(day('2026-09-07'))
    expect(within(screen.getByTestId('plan-day-done-2026-09-07')).getByTestId('plan-fit').textContent).toBe(t.plan.dayCard.fit.harder)
  })

  it('reads a session run the next day as done on both days', async () => {
    const user = userEvent.setup()
    renderWeek({
      activities: [activity({ id: 'a-moved', date: '2026-09-08', type: 'Base', distanceKm: 8 })],
      planned: [{ date: '2026-09-07', name: 'Easy', type: 'Base', distanceM: 8_000 }],
    })

    expect(bar('2026-09-07').getAttribute('data-bar-state')).toBe('done')
    await user.click(day('2026-09-07'))
    const planned = screen.getByTestId('plan-day-done-2026-09-07')
    expect(within(planned).getByTestId('done-line').textContent).toBe(`${t.plan.dayCard.done}${t.plan.dayCard.ranOn('Tue 8')}`)
    expect(within(planned).queryByTestId('skip-toggle')).toBeNull()

    await user.click(day('2026-09-08'))
    const ran = screen.getByTestId('plan-day-done-2026-09-08')
    expect(within(ran).getByTestId('planned-line').textContent).toBe(`${t.plan.dayCard.planned}${t.plan.dayCard.standsFor('Mon 7')} · 8 ${t.units.km} · Easy`)
    expect(within(ran).getByRole('img', { name: t.plan.dayCard.asPlanned })).toBeInTheDocument()
  })

  it("names a run by its session's set once, the plan's line its amount alone", async () => {
    const user = userEvent.setup()
    const name = "Threshold 3 x 7:15 - 3x7'@4:25"
    renderWeek({
      activities: [activity({ ...TEMPO, type: 'Threshold', description: name })],
      planned: [{ date: '2026-09-07', name, type: 'Threshold', distanceM: 10_000, durationSecs: 3_480 }],
    })

    await user.click(day('2026-09-07'))
    const card = screen.getByTestId('plan-day-done-2026-09-07')
    expect(within(card).getByRole('heading').textContent).toBe('3 × 7′ @ 4:25')
    expect(within(card).getByTestId('planned-line').textContent).toBe(`${t.plan.dayCard.planned}10 ${t.units.km} · 58 min`)
  })

  it("names the plan's session on its line when the run is called something else", async () => {
    const user = userEvent.setup()
    renderWeek({
      activities: [activity({ ...TEMPO, type: 'Threshold', description: 'Easy run' })],
      planned: [{ date: '2026-09-07', name: 'Threshold · 3 × 8′ @ 4:25', type: 'Threshold', distanceM: 10_000 }],
    })

    await user.click(day('2026-09-07'))
    const card = screen.getByTestId('plan-day-done-2026-09-07')
    expect(within(card).getByRole('heading').textContent).toBe('Easy run')
    expect(within(card).getByTestId('planned-line').textContent).toBe(`${t.plan.dayCard.planned}10 ${t.units.km} · 3 × 8′ @ 4:25`)
  })

  it('says a run nothing was planned for was not planned', async () => {
    const user = userEvent.setup()
    renderWeek({ activities: [RACE] })

    await user.click(day('2026-09-08'))
    const card = screen.getByTestId('plan-day-done-2026-09-08')
    expect(within(card).getByTestId('planned-line').textContent).toBe(`${t.plan.dayCard.planned}${t.plan.dayCard.notPlanned}`)
    expect(within(card).queryByRole('img', { name: t.plan.dayCard.asPlanned })).toBeNull()
  })

  it('names a missed session missed, with nothing to open', async () => {
    const user = userEvent.setup()
    renderWeek({ planned: [{ date: '2026-09-08', name: 'Easy', type: 'Base', distanceM: 8_000 }] })

    await user.click(day('2026-09-08'))
    const card = screen.getByTestId('plan-day-done-2026-09-08')
    expect(within(card).getByTestId('done-line').textContent).toContain(t.sessionState.missed)
    expect(within(card).queryByRole('link')).toBeNull()
  })
})

describe('a rest day', () => {
  it('says so, with the next session of the week', async () => {
    const user = userEvent.setup()
    renderWeek({ planned: [{ date: '2026-09-12', name: 'Long run', type: 'Base', distanceM: 18_000 }] })

    await user.click(day('2026-09-10'))
    const card = screen.getByTestId('plan-rest-day')
    expect(within(card).getByRole('heading').textContent).toBe(t.plan.restCard.title)
    expect(within(card).getByTestId('rest-next').textContent).toBe(`${t.plan.restCard.next('Sat')}Long run`)
  })

  it('lists the week’s sessions still to come, each selecting its day', async () => {
    const user = userEvent.setup()
    const onSelectDate = vi.fn()
    renderWeek({
      activities: [TEMPO],
      onSelectDate,
      planned: [
        { date: '2026-09-07', name: 'Tempo', type: 'Tempo', distanceM: 5_000 },
        { date: '2026-09-11', name: 'Threshold', type: 'Threshold', distanceM: 10_000, durationSecs: 3_480 },
        { date: '2026-09-12', name: 'Long run', type: 'Base', distanceM: 18_000 },
      ],
    })

    const rows = within(screen.getByTestId('coming-up')).getAllByTestId('coming-up-row')
    expect(rows.map((row) => row.textContent)).toEqual([
      `Threshold${'Fri 11'} · 10 ${t.units.km} · 58 min`,
      `Long run${'Sat 12'} · 18 ${t.units.km}`,
    ])
    expect(rows[0]!.querySelector<HTMLElement>('[aria-hidden]')!.style.background).toBe('var(--zone-4)')
    expect(rows[1]!.querySelector<HTMLElement>('[aria-hidden]')!.style.background).toBe('var(--zone-2)')

    await user.click(rows[1]!)
    expect(onSelectDate).toHaveBeenCalledWith('2026-09-12')
    expect(day('2026-09-12').getAttribute('aria-pressed')).toBe('true')
    expect(screen.queryByTestId('coming-up')).toBeNull()
  })

  it('lists nothing when the week has no session left', () => {
    renderWeek({ planned: [{ date: '2026-09-08', name: 'Easy', type: 'Base', distanceM: 8_000 }] })

    expect(screen.getByTestId('plan-rest-day')).toBeInTheDocument()
    expect(screen.queryByTestId('coming-up')).toBeNull()
  })
})

describe('the end of a block', () => {
  const ending = (endDate: string) => overview({ coachingPlan: plan({ block: { ...plan().block, endDate } }) })

  it('says when the block ends and that nothing follows it yet', () => {
    renderWeek({ coaching: ending('2026-09-13') })

    expect(screen.getByTestId('phase-note').textContent).toBe(t.plan.phase.blockEnds('Sun'))
  })

  it('says nothing on a week the block runs straight through', () => {
    renderWeek({ coaching: ending('2026-10-04') })

    expect(screen.queryByTestId('phase-note')).toBeNull()
  })

  it('counts the sessions done once the block is over, in place of a rest day', async () => {
    const user = userEvent.setup()
    const coaching = ending('2026-09-08')
    renderWeek({ coaching })

    await user.click(day('2026-09-11'))
    const card = screen.getByTestId('plan-block-finished')
    expect(within(card).getByRole('heading').textContent).toBe(t.plan.restCard.finished(0, coaching.workouts.length))
    expect(screen.queryByTestId('plan-rest-day')).toBeNull()
  })

  it('calls a day before the block nothing planned, not a rest day', async () => {
    const user = userEvent.setup()
    renderWeek({ coaching: overview({ coachingPlan: plan({ block: { ...plan().block, startDate: '2026-09-10' } }) }) })

    await user.click(day('2026-09-08'))
    expect(within(screen.getByTestId('plan-rest-day')).getByRole('heading').textContent).toBe(t.plan.dayCard.notPlanned)
  })
})

describe('other training', () => {
  const strength: CrossTrainingEntry = { id: 'x1', date: '2026-09-08', kind: 'strength', durationSeconds: 2700, distanceKm: null, sets: 12 }

  it('puts a chip on its day and lists it under the day, leaving the run and the week alone', () => {
    renderWeek({ activities: [TEMPO, RACE], others: [strength], selected: '2026-09-08' })

    expect(within(day('2026-09-08')).getByTestId('day-cross-training')).toBeTruthy()
    expect(day('2026-09-08').getAttribute('aria-label')).toContain(t.crossTraining.kinds.strength)
    expect(within(day('2026-09-07')).queryByTestId('day-cross-training')).toBeNull()
    expect(bar('2026-09-08').dataset.barState).toBe('done')
    expect(within(screen.getByTestId('plan-cross-training')).getByTestId('cross-training-row').textContent).toContain(t.crossTraining.sets(12))
  })
})

describe('the coach’s words', () => {
  const WORDS: CoachWords = {
    block: { name: 'Reprise en douceur', focus: 'Cinq semaines pour te réhabituer à courir.' },
    weeks: [{ startDate: '2026-09-07', endDate: '2026-09-13', focus: 'On démarre doucement.' }],
    sessions: { 'workout-threshold': { description: 'Course très lente, 1 minute de marche.', notes: ['Passe à la marche au moindre doute.'] } },
  }
  const serve = (words: CoachWords | null) => {
    const fetch = vi.fn(async () => Response.json(words ? { available: true, ...words } : { available: false }))
    vi.stubGlobal('fetch', fetch)
    return fetch
  }

  beforeEach(forgetCoachWords)
  afterEach(() => {
    forgetCoachWords()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('names general preparation after the coach’s block and adds the week’s focus', async () => {
    serve(WORDS)
    renderWeek({ coaching: overview({ coachingPlan: { ...plan(), macrocycleStartDate: '2026-08-31', targetEvent: undefined } }) })

    const card = screen.getByTestId('phase-line')
    expect(await within(card).findByText('Reprise en douceur')).toBeInTheDocument()
    expect(within(card).getByRole('heading').textContent).not.toContain(t.plan.weekPurpose.generalPreparation)
    expect(within(card).getByTestId('phase-focus').textContent).toBe('On démarre doucement.')
  })

  it('folds a long week focus to one line, its toggle outside the checkpoint link', async () => {
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(60)
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(20)
    serve(WORDS)
    renderWeek({ coaching: overview({ coachingPlan: { ...plan(), macrocycleStartDate: '2026-08-31', targetEvent: undefined } }) })

    const card = screen.getByTestId('phase-line')
    await within(card).findByTestId('phase-focus')
    const toggle = within(card).getByRole('button', { name: t.plan.session.coachNote })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(toggle.closest('a')).toBeNull()
    await userEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
  })

  it('keeps a race block’s phase name, with the week’s focus under it', async () => {
    serve(WORDS)
    renderWeek({ coaching: overview({ coachingPlan: blockPlan() }) })

    const card = screen.getByTestId('phase-line')
    expect(await within(card).findByTestId('phase-focus')).toHaveTextContent('On démarre doucement.')
    expect(within(card).getByRole('heading').textContent).toBe(t.plan.weekPurpose.planPhase.base)
  })

  it('puts the session’s description and notes on its card', async () => {
    serve(WORDS)
    renderWeek({ coaching: overview() })

    const note = await within(screen.getByTestId('plan-workout-workout-threshold')).findByTestId('coach-note')
    expect(note).toHaveTextContent(t.plan.session.coachNote)
    expect(note).toHaveTextContent('Course très lente, 1 minute de marche.')
    expect(note).toHaveTextContent('Passe à la marche au moindre doute.')
  })

  it('asks for nothing without a coach plan, and draws nothing when the server has none', async () => {
    const fetch = serve(null)
    renderWeek({ planPhaseRanges: [{ phase: 'build', startDate: '2026-09-07', endDate: '2026-10-04' }] })
    expect(fetch).not.toHaveBeenCalled()

    forgetCoachWords()
    renderWeek({ coaching: overview() })
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled())
    expect(screen.queryByTestId('coach-note')).toBeNull()
    expect(screen.queryByTestId('phase-focus')).toBeNull()
  })
})
