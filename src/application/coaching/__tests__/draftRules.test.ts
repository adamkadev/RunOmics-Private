import { describe, expect, it } from 'vitest'
import type { BootstrapWorkoutDraft } from '@/application/ports/CoachingAdvisor'
import type { CoachingPlan, WorkoutPrescription } from '@/domain/coaching/types'
import { plan, workout } from '@/domain/coaching/__tests__/fixtures'
import { buildCoachingContext } from '../context'
import { validateAdaptation, validateWorkoutDraft } from '../draftRules'

function session(overrides: Partial<BootstrapWorkoutDraft> = {}): BootstrapWorkoutDraft {
  return {
    date: '2026-09-08',
    type: 'easy',
    title: 'Easy run',
    description: 'A structurally valid session.',
    blocks: [{ kind: 'effort', target: { distanceMeters: 5_000 } }],
    ...overrides,
  }
}

const check = (workout: BootstrapWorkoutDraft) => () => validateWorkoutDraft(workout, 'plan.weeks[0].workouts[0]')

describe('how a session is written', () => {
  const strides = (stride: Record<string, unknown>, recovery = true) => session({
    title: 'Easy Run with Strides',
    blocks: [
      { kind: 'effort', target: { distanceMeters: 5_000 } },
      {
        kind: 'repeat',
        repetitions: 6,
        steps: [
          { kind: 'strides', target: { durationSeconds: 20, ...stride } },
          ...(recovery ? [{ kind: 'recovery' as const, target: { durationSeconds: 60 } }] : []),
        ],
      },
    ],
  })

  it('accepts strides written as a timed repeat group with recovery', () => {
    expect(check(strides({}))).not.toThrow()
  })

  it('requires strides to keep their recovery and to leave HR out of it', () => {
    expect(check(strides({}, false))).toThrow(/strides repeat group must include recovery/)
    expect(check(strides({ hrZone: 5 }))).toThrow(/strides must use pace, effort, or form guidance rather than an HR target/)
  })

  it('refuses strides outside a repeat group, or promised in prose and never prescribed', () => {
    expect(check(session({ blocks: [{ kind: 'strides', target: { durationSeconds: 20 } }] }))).toThrow(/standalone strides are not supported/)
    expect(check(session({ title: 'Easy run with strides' }))).toThrow(/strides must be prescribed as a repeat group/)
  })

  // A French deployment's coach calls them « accélérations » or « lignes droites ».
  it('holds French strides to the same rule', () => {
    expect(check(session({ title: 'Footing + accélérations' }))).toThrow(/strides must be prescribed as a repeat group/)
    expect(check(session({ title: 'Footing', notes: ['Finir par 6 lignes droites.'] }))).toThrow(/strides must be prescribed as a repeat group/)
    expect(check({ ...strides({}), title: 'Footing + accélérations 6 x 20 s' })).not.toThrow()
  })

  it('rejects rigid pace targets on hill repetitions', () => {
    const hills = (target: Record<string, unknown>) => session({
      type: 'vo2max',
      title: 'Hill intervals',
      description: 'Run six uphill repetitions at controlled effort.',
      blocks: [{
        kind: 'repeat',
        repetitions: 6,
        steps: [
          { kind: 'effort', target: { durationSeconds: 60, ...target }, notes: ['Strong uphill RPE; tall form.'] },
          { kind: 'recovery', target: { durationSeconds: 90 } },
        ],
      }],
    })

    expect(check(hills({ paceSecPerKm: { min: 220, max: 230 } }))).toThrow(/hill efforts must use effort\/RPE guidance/)
    expect(check(hills({ hrBpm: { min: 175, max: 185 } }))).not.toThrow()
  })

  it('requires a claimed progressive workout to contain structured progression', () => {
    const progressive = (blocks: BootstrapWorkoutDraft['blocks']) => session({
      type: 'long_run',
      title: 'Progressive Long Run',
      description: 'Build gradually through the run.',
      blocks,
    })

    expect(check(progressive([{ kind: 'effort', target: { durationSeconds: 3_600, hrZone: 2 } }])))
      .toThrow(/must contain an actual structured intensity progression/)
    expect(check(progressive([
      { kind: 'effort', target: { durationSeconds: 2_400, hrZone: 2 } },
      { kind: 'effort', target: { durationSeconds: 1_200, hrZone: 3 } },
    ]))).not.toThrow()
  })
})

describe('the speed weeks of a controlled threshold block', () => {
  it('accepts hill sprints written as the rules ask: strides by effort, a walk back down, no pace or heart rate', async () => {
    const { validateWorkoutName } = await import('../workoutNames')
    const hills: BootstrapWorkoutDraft = {
      date: '2026-11-19',
      type: 'easy',
      title: 'Easy · 8 km + 8 hill sprints',
      shortName: 'Easy + hills',
      structure: { extras: ['8 hill sprints'] },
      description: 'Easy running, then short hill sprints for strength and power.',
      blocks: [
        { kind: 'effort', target: { distanceMeters: 8_000, paceSecPerKm: { min: 330, max: 384 } } },
        {
          kind: 'repeat',
          repetitions: 8,
          steps: [
            { kind: 'strides', target: { durationSeconds: 10 }, notes: ['Up a steep hill, hard but relaxed: drive the arms, stay tall.'] },
            { kind: 'recovery', target: { durationSeconds: 90 }, notes: ['Walk back down.'] },
          ],
        },
      ],
    }
    expect(() => validateWorkoutDraft(hills, 'hills')).not.toThrow()
    expect(() => validateWorkoutName(hills, 'hills')).not.toThrow()
  })
})

describe('a change to the live plan', () => {
  // Tuesdays and Wednesdays, one run a week. Week 2 holds one run, Tuesday the 15th.
  const current = () => plan({ trainingPreferences: { availableWeekdays: [2, 3], runsPerWeek: 1 } })
  const context = buildCoachingContext({
    activities: [],
    plan: null,
    athlete: {},
    trainingStatus: null,
    loadBalance: null,
    trainingZones: null,
    trajectories: null,
    latestVo2max: null,
    racePredictions: null,
    goals: [],
    personalBests: [],
    upcomingRaces: [],
    officialResults: [],
  }, '2026-09-14')

  function changed(edit: (weekTwo: WorkoutPrescription[]) => WorkoutPrescription[], before = current()): CoachingPlan {
    const after = structuredClone(before)
    after.weeks[1]!.workouts = edit(after.weeks[1]!.workouts)
    return after
  }
  const rewrite = (overrides: Partial<WorkoutPrescription>) =>
    (workouts: WorkoutPrescription[]) => workouts.map((each) => ({ ...each, ...overrides, revision: 2, status: 'adjusted' as const }))
  const extra = (date: string) => workout({ id: 'workout-extra', date, type: 'easy', title: 'Extra run' })

  it('holds a moved session to the athlete\'s weekdays', () => {
    expect(() => validateAdaptation(current(), changed(rewrite({ date: '2026-09-19' })), context))
      .toThrow(/2026-09-19 is outside the available weekdays/)
  })

  it('holds a rewritten session to how a session is written', () => {
    const bare = rewrite({ blocks: [{ kind: 'strides', target: { durationSeconds: 20 } }] })

    expect(() => validateAdaptation(current(), changed(bare), context)).toThrow(/standalone strides are not supported/)
  })

  it('refuses a second run on a day that already has one', () => {
    expect(() => validateAdaptation(current(), changed((workouts) => [...workouts, extra('2026-09-15')]), context))
      .toThrow(/2026-09-15 already has a run/)
  })

  it('refuses a run beyond the athlete\'s weekly count', () => {
    expect(() => validateAdaptation(current(), changed((workouts) => [...workouts, extra('2026-09-16')]), context))
      .toThrow(/would hold 2 runs against 1 a week/)
  })

  it('always lets a change cancel a session, even one written before these rules', () => {
    const before = changed(rewrite({ date: '2026-09-19' }))
    const cancel = (workouts: WorkoutPrescription[]) => workouts.map((each) => ({ ...each, revision: 3, status: 'cancelled' as const }))

    expect(() => validateAdaptation(before, changed(cancel, before), context)).not.toThrow()
  })

  it('holds a title the change writes to the naming rules, and keeps one the plan held', () => {
    const before = current()
    const shortened = structuredClone(before)
    shortened.weeks[0]!.workouts = shortened.weeks[0]!.workouts.map((each) => ({ ...each, totalDurationSeconds: 3_000, revision: 2, status: 'adjusted' as const }))

    expect(shortened.weeks[0]!.workouts[0]!.title).toBe('3 × 8 min threshold')
    expect(() => validateAdaptation(before, shortened, context)).not.toThrow()
    expect(() => validateAdaptation(current(), changed(rewrite({ title: 'Easy run 3 x 8' })), context)).toThrow(/title "Easy run 3 x 8": write repetitions with ×/)
    expect(() => validateAdaptation(current(), changed(rewrite({ title: 'Easy run, shorter' })), context)).toThrow(/shortName: every workout carries one/)
    expect(() => validateAdaptation(current(), changed(rewrite({ title: 'Easy run, shorter', shortName: 'Easy run' })), context)).not.toThrow()
  })

  it('does not refuse a week for runs it held before the change', () => {
    const crowded = changed((workouts) => [...workouts, extra('2026-09-16')])

    expect(() => validateAdaptation(crowded, changed(rewrite({ title: 'Easy run, shortened', shortName: 'Easy run' }), crowded), context)).not.toThrow()
  })
})
