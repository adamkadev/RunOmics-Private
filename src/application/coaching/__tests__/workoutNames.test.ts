import { describe, expect, it } from 'vitest'
import type { BootstrapWorkoutDraft, CoachingPlanDraft } from '@/application/ports/CoachingAdvisor'
import type { WorkoutBlock, WorkoutTarget } from '@/domain/coaching/types'
import { validateDraftNames, validateWorkoutName, WORKOUT_NAME_MAX, WORKOUT_SHORT_NAME_MAX } from '../workoutNames'

// 3 × 7:40 at 4:22-4:28, 4:00 easy between.
const THRESHOLD: WorkoutBlock[] = [
  { kind: 'warmup', target: { distanceMeters: 2_000, paceSecPerKm: { min: 330, max: 384 } } },
  {
    kind: 'repeat',
    repetitions: 3,
    steps: [
      { kind: 'effort', target: { durationSeconds: 460, paceSecPerKm: { min: 262, max: 268 } } },
      { kind: 'recovery', target: { durationSeconds: 240, paceSecPerKm: { min: 360, max: 420 } } },
    ],
  },
  { kind: 'cooldown', target: { distanceMeters: 1_600, paceSecPerKm: { min: 330, max: 384 } } },
]

// 9 km at 5:30-6:24, about 54 minutes, then six strides.
const STRIDES: WorkoutBlock[] = [
  { kind: 'effort', target: { distanceMeters: 9_000, paceSecPerKm: { min: 330, max: 384 }, hrZone: 2 } },
  {
    kind: 'repeat',
    repetitions: 6,
    steps: [
      { kind: 'strides', target: { durationSeconds: 20, paceSecPerKm: { min: 215, max: 230 } } },
      { kind: 'recovery', target: { durationSeconds: 60, paceSecPerKm: { min: 360, max: 420 } } },
    ],
  },
]

const continuous = (target: WorkoutTarget): WorkoutBlock[] => [{ kind: 'effort', target }]

function threshold(overrides: Partial<BootstrapWorkoutDraft> = {}): BootstrapWorkoutDraft {
  return {
    date: '2026-10-06',
    type: 'threshold',
    title: 'Threshold · 3 × 8′ @ 4:25',
    shortName: 'Threshold 3×8′',
    structure: { reps: 3, repMinutes: 8, targetPace: '4:25' },
    description: 'The longest repetitions of the block.',
    blocks: THRESHOLD,
    ...overrides,
  }
}

function easy(overrides: Partial<BootstrapWorkoutDraft> = {}): BootstrapWorkoutDraft {
  return {
    date: '2026-10-08',
    type: 'easy',
    title: 'Easy · 54 min + 6 strides',
    shortName: 'Easy + strides',
    structure: { extras: ['6 strides'] },
    description: 'Easy running with six short accelerations.',
    blocks: STRIDES,
    ...overrides,
  }
}

const check = (workout: BootstrapWorkoutDraft) => () => validateWorkoutName(workout, 'plan.weeks[2].workouts[0]')

describe('a workout name (design review, Oct 2026)', () => {
  it('takes the type, then " · " and the structure, or the type alone', () => {
    expect(check(threshold())).not.toThrow()
    expect(check(easy())).not.toThrow()
    expect(check(easy({ title: 'Recovery run', shortName: 'Recovery run', structure: undefined, blocks: continuous({ distanceMeters: 9_046, paceSecPerKm: { min: 330, max: 384 } }) }))).not.toThrow()
    expect(check(easy({ type: 'long_run', title: 'Long run', shortName: 'Long run', structure: undefined, blocks: continuous({ distanceMeters: 13_000 }) }))).not.toThrow()
  })

  it('fits 28 characters, and says how to make it fit', () => {
    expect(WORKOUT_NAME_MAX).toBe(28)
    expect(check(threshold({ title: 'Threshold · 3 × 7′40″ @ 4:25' }))).not.toThrow()
    expect(check(threshold({ title: 'Threshold · 3 × 7′40″ @ 4:25 ' }))).toThrow(/29 characters, over 28: shorten it, dropping the pace first/)
  })

  it('never takes " - ", and the type comes first, sentence-cased', () => {
    expect(check(threshold({ title: 'Threshold - 3 × 8′' }))).toThrow(/never " - "/)
    expect(check(threshold({ title: 'Threshold 3 × 8′' }))).toThrow(/the type first, then " · "/)
    expect(check(threshold({ title: '3 × 8′ threshold' }))).toThrow(/start with the session type/)
    expect(check(easy({ title: 'Long Run', type: 'long_run', structure: undefined }))).toThrow(/sentence case/)
    expect(check(easy({ title: 'easy run', structure: undefined }))).toThrow(/start with the session type/)
    expect(check(threshold({ title: 'Threshold · 3 × 8′ · 4:25' }))).toThrow(/one " · "/)
  })

  it('writes repetitions with × and minutes with the prime, a pace only after " @ "', () => {
    expect(check(threshold({ title: 'Threshold · 3 x 8′' }))).toThrow(/×/)
    expect(check(threshold({ title: "Threshold · 3 × 8'" }))).toThrow(/the prime/)
    expect(check(threshold({ title: 'Threshold · 3×8′' }))).toThrow(/a space either side of ×/)
    expect(check(threshold({ title: 'Threshold · 3 × 7:40' }))).toThrow(/a repetition's length in minutes with ′/)
    expect(check(threshold({ title: 'Threshold · 3 × 8′ @4:25' }))).toThrow(/a pace only after " @ "/)
    expect(check(threshold({ title: 'Threshold · 3 × 8′ @ 4:25/km' }))).toThrow(/a pace only after " @ "/)
  })

  it('leaves the zone and the pace range to their own fields', () => {
    expect(check(easy({ title: 'Easy run · Z2', structure: undefined }))).toThrow(/zone and the pace range/)
    expect(check(threshold({ title: 'Threshold · 4:22–4:28' }))).toThrow(/zone and the pace range/)
  })

  it('never repeats the total distance or duration', () => {
    const fiftyFour = continuous({ durationSeconds: 3_240, paceSecPerKm: { min: 330, max: 384 } })
    expect(check(easy({ title: 'Easy run · 54 min', structure: undefined, blocks: fiftyFour }))).toThrow(/total distance and duration/)
    expect(check(easy({ title: 'Long run · 13 km', type: 'long_run', structure: undefined, blocks: continuous({ distanceMeters: 13_000 }) }))).toThrow(/total distance and duration/)
    expect(check(easy({ title: 'Long run · 1h30', type: 'long_run', structure: undefined, blocks: continuous({ durationSeconds: 5_400 }) }))).toThrow(/total distance and duration/)
  })

  it('says what the blocks say: their repetitions, their pace and their lengths', () => {
    expect(check(threshold({ title: 'Threshold · 4 × 8′ @ 4:25' }))).toThrow(/"4 ×" is not a repetition count/)
    expect(check(threshold({ title: 'Threshold · 3 × 10′ @ 4:25' }))).toThrow(/"3 × 10′" is not the repetitions the blocks prescribe/)
    expect(check(easy({ title: 'Easy · 54 min + 6 × 20″' }))).not.toThrow()
    expect(check(easy({ title: 'Easy · 54 min + 6 × 30″' }))).toThrow(/"6 × 30″" is not the repetitions/)
    expect(check(threshold({ title: 'Threshold · 3 × 8′ @ 4:10' }))).toThrow(/@ 4:10 is not a pace the blocks prescribe/)
    // 8.5 km is about 51 minutes: "54 min" belongs to the 9 km body.
    const shorter: WorkoutBlock[] = [{ kind: 'effort', target: { distanceMeters: 8_500, paceSecPerKm: { min: 330, max: 384 } } }, STRIDES[1]!]
    expect(check(easy({ blocks: shorter }))).toThrow(/54 min is not the length of a block/)
    expect(check(easy({ title: 'Easy · 51 min + 6 strides', blocks: shorter }))).not.toThrow()
    expect(check(easy({ title: 'Easy · 9 km + 6 strides', blocks: shorter }))).toThrow(/9 km is not the distance of a block/)
    expect(check(easy({ title: 'Easy · 8.5 km + 6 strides', blocks: shorter }))).not.toThrow()
  })

  it("lets a race keep its event's name, within the length", () => {
    const race = (title: string) => threshold({ type: 'race', title, shortName: 'Tune-up race', structure: undefined, blocks: continuous({ distanceMeters: 10_000 }) })
    expect(check(race('Wine Route - Luxemburg'))).not.toThrow()
    expect(check(race('10K de Metz'))).not.toThrow()
    expect(check(race('Route du Vin Half Marathon Luxembourg'))).toThrow(/over 28/)
  })
})

describe('the short name', () => {
  it('is on every workout named under the rules, at most 18 characters', () => {
    expect(WORKOUT_SHORT_NAME_MAX).toBe(18)
    expect(check(threshold({ shortName: undefined }))).toThrow(/shortName: every workout carries one/)
    expect(check(threshold({ shortName: 'Threshold · 3 × 8′' }))).not.toThrow()
    expect(check(threshold({ shortName: 'Threshold · 3 × 8′ @' }))).toThrow(/shortName "Threshold · 3 × 8′ @": 20 characters, over 18/)
  })

  it('is written by the same signs', () => {
    expect(check(threshold({ shortName: 'Threshold 3x8' }))).toThrow(/shortName .*×/)
    expect(check(threshold({ shortName: 'Threshold - 3×8′' }))).toThrow(/shortName .*never " - "/)
    expect(check(easy({ shortName: 'Easy + Strides' }))).toThrow(/shortName .*sentence case/)
  })
})

describe('the structure a name states', () => {
  it('agrees with the blocks, to the minute the name rounds a repetition to', () => {
    expect(check(threshold({ structure: { reps: 3, repMinutes: 8, targetPace: '4:25' } }))).not.toThrow()
    expect(check(threshold({ structure: { reps: 4 } }))).toThrow(/structure: reps 4 is not a repetition count/)
    expect(check(threshold({ structure: { reps: 3, repMinutes: 9 } }))).toThrow(/structure: repMinutes 9 is not a repetition/)
    expect(check(threshold({ structure: { reps: 3, targetPace: '4:40' } }))).toThrow(/structure: targetPace 4:40 is not a pace/)
  })

  it('takes a single block of work for a continuous session', () => {
    const tempo: WorkoutBlock[] = [
      { kind: 'warmup', target: { durationSeconds: 900 } },
      { kind: 'effort', target: { durationSeconds: 1_200, paceSecPerKm: { min: 275, max: 285 } } },
      { kind: 'cooldown', target: { durationSeconds: 600 } },
    ]
    expect(check(threshold({ type: 'tempo', title: 'Tempo · 20′ @ 4:40', shortName: 'Tempo 20′', structure: { repMinutes: 20, targetPace: '4:40' }, blocks: tempo }))).not.toThrow()
  })

  it('keeps its extras to a few words', () => {
    expect(check(easy({ structure: { extras: ['6 strides - relaxed'] } }))).toThrow(/each extra is a few words/)
  })
})

describe('a title written before the naming rules', () => {
  it('is left as it was, while what is added to it still answers to the rules', () => {
    const legacy = threshold({ title: 'Threshold 3 x 7:40', shortName: undefined, structure: undefined })
    expect(() => validateWorkoutName(legacy, 'workout w', { titleAsWritten: true })).not.toThrow()
    expect(() => validateWorkoutName({ ...legacy, shortName: 'Threshold 3 x 8' }, 'workout w', { titleAsWritten: true })).toThrow(/shortName/)
    expect(() => validateWorkoutName(legacy, 'workout w')).toThrow(/title "Threshold 3 x 7:40"/)
  })
})

describe('a block being written', () => {
  it('names the workout that broke a rule', () => {
    const draft: CoachingPlanDraft = {
      name: 'Base block',
      focus: 'Aerobic volume',
      weeks: [{ startDate: '2026-10-05', endDate: '2026-10-11', focus: 'Peak week', workouts: [threshold(), easy({ title: 'Easy 54 min - 6 × 20s strides' })] }],
    }
    expect(() => validateDraftNames(draft)).toThrow(/^plan\.weeks\[0\]\.workouts\[1\]\.title "Easy 54 min - 6 × 20s strides"/)
  })
})
