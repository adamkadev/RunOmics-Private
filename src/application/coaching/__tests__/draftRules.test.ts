import { describe, expect, it } from 'vitest'
import type { BootstrapWorkoutDraft } from '@/application/ports/CoachingAdvisor'
import { validateWorkoutDraft } from '../draftRules'

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
