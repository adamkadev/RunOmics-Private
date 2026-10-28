import { describe, expect, it } from 'vitest'
import type { CoachingPlan, WorkoutPrescription } from '@/domain/coaching/types'
import {
  garminWorkoutName,
  isCourseAwareRace,
  paceRangeToSpeedRange,
  toGarminWorkoutPayload,
  type GarminExecutableStep,
  type GarminRepeatStep,
} from '../garminWorkoutMapping'

function prescription(overrides: Partial<WorkoutPrescription>): WorkoutPrescription {
  return {
    id: 'plan:workout:1:1',
    revision: 1,
    date: '2026-09-08',
    type: 'easy',
    title: 'Aerobic Easy Run',
    description: 'Steady easy aerobic run.',
    status: 'prescribed',
    blocks: [],
    provenance: { source: 'gemini', trigger: 'bootstrap', createdAt: '2026-09-05T22:25:08.078Z' },
    ...overrides,
  }
}

const steps = (workout: WorkoutPrescription) => toGarminWorkoutPayload(workout).workoutSegments[0]!.workoutSteps
const executable = (step: unknown) => step as GarminExecutableStep

describe('pace to speed conversion', () => {
  it('turns the faster pace bound into the higher speed', () => {
    const { targetValueOne, targetValueTwo } = paceRangeToSpeedRange({ min: 260, max: 270 })

    expect(targetValueOne).toBeCloseTo(1_000 / 270, 6)
    expect(targetValueTwo).toBeCloseTo(1_000 / 260, 6)
    expect(targetValueTwo).toBeGreaterThan(targetValueOne)
  })

  it('orders the pair low-to-high however the range is given', () => {
    const forwards = paceRangeToSpeedRange({ min: 260, max: 270 })
    const backwards = paceRangeToSpeedRange({ min: 270, max: 260 })

    expect(backwards).toEqual(forwards)
  })

  it('keeps a single-pace range as one speed on both bounds', () => {
    const { targetValueOne, targetValueTwo } = paceRangeToSpeedRange({ min: 300, max: 300 })

    expect(targetValueOne).toBeCloseTo(1_000 / 300, 6)
    expect(targetValueTwo).toBeCloseTo(1_000 / 300, 6)
  })

  it('rejects a non-positive pace rather than dividing by zero', () => {
    expect(() => paceRangeToSpeedRange({ min: 0, max: 300 })).toThrow(/positive seconds/)
  })
})

describe('simple runs', () => {
  it('maps a distance easy run to one distance step with a pace target', () => {
    const workout = prescription({
      totalDistanceMeters: 6_000,
      blocks: [{ kind: 'effort', target: { distanceMeters: 6_000, paceSecPerKm: { min: 310, max: 387 } } }],
      notes: ['Maintain steady easy pace.'],
    })

    const payload = toGarminWorkoutPayload(workout)
    const step = executable(payload.workoutSegments[0]!.workoutSteps[0]!)

    expect(payload.workoutName).toBe('Aerobic Easy Run')
    expect(payload.sportType.sportTypeKey).toBe('running')
    expect(payload.estimatedDistanceInMeters).toBe(6_000)
    expect(step.stepType.stepTypeKey).toBe('interval')
    expect(step.endCondition.conditionTypeKey).toBe('distance')
    expect(step.endConditionValue).toBe(6_000)
    expect(step.targetType.workoutTargetTypeKey).toBe('pace.zone')
    expect(step.targetValueOne).toBeCloseTo(1_000 / 387, 6)
  })

  it('maps a duration run to a time step', () => {
    const workout = prescription({ blocks: [{ kind: 'effort', target: { durationSeconds: 2_400 } }] })
    const step = executable(steps(workout)[0]!)

    expect(step.endCondition.conditionTypeKey).toBe('time')
    expect(step.endConditionValue).toBe(2_400)
  })

  it('leads with distance when a segment prescribes both', () => {
    const workout = prescription({
      blocks: [{ kind: 'effort', target: { distanceMeters: 8_000, durationSeconds: 2_700 } }],
    })
    const step = executable(steps(workout)[0]!)

    expect(step.endCondition.conditionTypeKey).toBe('distance')
    expect(step.endConditionValue).toBe(8_000)
  })

  it('leaves a workout with no pace or heart-rate target on no.target', () => {
    const workout = prescription({ blocks: [{ kind: 'effort', target: { durationSeconds: 600 } }] })
    const step = executable(steps(workout)[0]!)

    expect(step.targetType.workoutTargetTypeKey).toBe('no.target')
    expect(step.targetValueOne).toBeUndefined()
    expect(step.targetValueTwo).toBeUndefined()
  })

  it('falls back to a lap-button step when neither distance nor duration is prescribed', () => {
    const workout = prescription({ blocks: [{ kind: 'effort', target: {} }] })
    const step = executable(steps(workout)[0]!)

    expect(step.endCondition.conditionTypeKey).toBe('lap.button')
    expect(step.endConditionValue).toBeNull()
  })
})

describe('warmup, cooldown and recovery', () => {
  it('maps each segment kind to its own Garmin step type', () => {
    const workout = prescription({
      blocks: [
        { kind: 'warmup', target: { distanceMeters: 2_000 } },
        { kind: 'effort', target: { distanceMeters: 5_000 } },
        { kind: 'recovery', target: { durationSeconds: 120 } },
        { kind: 'cooldown', target: { distanceMeters: 2_000 } },
      ],
    })

    expect(steps(workout).map((step) => executable(step).stepType.stepTypeKey)).toEqual([
      'warmup',
      'interval',
      'recovery',
      'cooldown',
    ])
  })

  it('numbers every step in order across the whole workout', () => {
    const workout = prescription({
      blocks: [
        { kind: 'warmup', target: { distanceMeters: 2_000 } },
        { kind: 'repeat', repetitions: 2, steps: [{ kind: 'effort', target: { distanceMeters: 400 } }] },
        { kind: 'cooldown', target: { distanceMeters: 1_000 } },
      ],
    })
    const mapped = steps(workout)
    const repeat = mapped[1]! as GarminRepeatStep

    expect(executable(mapped[0]!).stepOrder).toBe(1)
    expect(repeat.stepOrder).toBe(2)
    expect(repeat.workoutSteps[0]!.stepOrder).toBe(3)
    expect(executable(mapped[2]!).stepOrder).toBe(4)
  })
})

describe('heart-rate targets', () => {
  it('maps a bpm range to the heart-rate zone target', () => {
    const workout = prescription({
      blocks: [{ kind: 'effort', target: { durationSeconds: 1_800, hrBpm: { min: 140, max: 155 } } }],
    })
    const step = executable(steps(workout)[0]!)

    expect(step.targetType.workoutTargetTypeKey).toBe('heart.rate.zone')
    expect(step.targetValueOne).toBe(140)
    expect(step.targetValueTwo).toBe(155)
  })

  it('maps a zone number to zoneNumber rather than to a bpm pair', () => {
    const workout = prescription({ blocks: [{ kind: 'effort', target: { durationSeconds: 1_800, hrZone: 2 } }] })
    const step = executable(steps(workout)[0]!)

    expect(step.targetType.workoutTargetTypeKey).toBe('heart.rate.zone')
    expect(step.zoneNumber).toBe(2)
    expect(step.targetValueOne).toBeUndefined()
  })

  it('keeps pace as the executed target and preserves the heart-rate bound in the description', () => {
    const workout = prescription({
      type: 'threshold',
      blocks: [
        {
          kind: 'effort',
          target: { distanceMeters: 5_000, paceSecPerKm: { min: 260, max: 270 }, hrBpm: { min: 160, max: 172 } },
        },
      ],
    })
    const step = executable(steps(workout)[0]!)

    expect(step.targetType.workoutTargetTypeKey).toBe('pace.zone')
    expect(step.description).toContain('HR 160-172 bpm')
  })
})

describe('easy runs', () => {
  const zoned = { distanceMeters: 8_000, paceSecPerKm: { min: 300, max: 340 }, hrZone: 2 }

  it.each(['easy', 'recovery', 'long_run'] as const)('send a %s run paced, with no heart-rate target or note', (type) => {
    const step = executable(steps(prescription({ type, blocks: [{ kind: 'effort', target: zoned }] }))[0]!)

    expect(step.targetType.workoutTargetTypeKey).toBe('pace.zone')
    expect(step.zoneNumber).toBeUndefined()
    expect(step.description).toBe('')
  })

  it('send no heart rate and none of the coach’s notes', () => {
    const workout = prescription({
      description: 'Stay in Z2 throughout.',
      notes: ['Keep your HR under 145 bpm.', 'Relaxed shoulders.'],
      blocks: [
        { kind: 'warmup', target: { durationSeconds: 300 }, notes: ['1 minute de marche.'] },
        {
          kind: 'repeat',
          repetitions: 4,
          steps: [
            { kind: 'effort', target: { durationSeconds: 360, paceSecPerKm: { min: 470, max: 525 }, hrBpm: { min: 124, max: 144 } }, notes: ['Zone FC 2, au rythme où tu peux parler.', 'Course très lente.'] },
            { kind: 'recovery', target: { durationSeconds: 60 }, notes: ['Reste sous la fréquence cardiaque cible.'] },
          ],
        },
      ],
    })
    const payload = toGarminWorkoutPayload(workout)
    const [warmup, group] = payload.workoutSegments[0]!.workoutSteps as [GarminExecutableStep, GarminRepeatStep]

    expect(payload.description).toBeNull()
    expect(warmup.description).toBe('')
    expect(group.workoutSteps.map((step) => step.description)).toEqual(['', ''])
    expect(group.workoutSteps[0]!.targetType.workoutTargetTypeKey).toBe('pace.zone')
    expect(JSON.stringify(payload)).not.toMatch(/heart\.rate|zoneNumber|bpm|FC|Z2/)
  })

  it('keep a heart-rate zone that is the step’s only target', () => {
    const step = executable(steps(prescription({ blocks: [{ kind: 'effort', target: { durationSeconds: 1_800, hrZone: 2 } }] }))[0]!)

    expect(step.targetType.workoutTargetTypeKey).toBe('heart.rate.zone')
    expect(step.zoneNumber).toBe(2)
  })

  it('keep a quality session’s heart-rate bound, not its notes', () => {
    const workout = prescription({
      type: 'threshold',
      notes: ['Heart rate under the ceiling.'],
      blocks: [{ kind: 'effort', target: { durationSeconds: 360, paceSecPerKm: { min: 270, max: 280 }, hrBpm: { min: 150, max: 165 } } }],
    })
    const payload = toGarminWorkoutPayload(workout)

    expect(payload.description).toBeNull()
    expect(executable(payload.workoutSegments[0]!.workoutSteps[0]!).description).toBe('HR 150-165 bpm')
  })
})

describe('repeats', () => {
  it('maps 3 x 1600m threshold with jog recovery', () => {
    const workout = prescription({
      type: 'threshold',
      title: 'Threshold 3 x 1600m',
      blocks: [
        { kind: 'warmup', target: { distanceMeters: 2_000, paceSecPerKm: { min: 310, max: 387 } } },
        {
          kind: 'repeat',
          repetitions: 3,
          steps: [
            { kind: 'effort', target: { distanceMeters: 1_600, paceSecPerKm: { min: 260, max: 270 } } },
            { kind: 'recovery', target: { durationSeconds: 120, paceSecPerKm: { min: 350, max: 387 } } },
          ],
        },
        { kind: 'cooldown', target: { distanceMeters: 2_000, paceSecPerKm: { min: 310, max: 387 } } },
      ],
    })
    const repeat = steps(workout)[1]! as GarminRepeatStep

    expect(repeat.type).toBe('RepeatGroupDTO')
    expect(repeat.numberOfIterations).toBe(3)
    expect(repeat.endCondition.conditionTypeKey).toBe('iterations')
    expect(repeat.endConditionValue).toBe(3)
    expect(repeat.workoutSteps).toHaveLength(2)
    expect(repeat.workoutSteps[0]!.endCondition.conditionTypeKey).toBe('distance')
    expect(repeat.workoutSteps[0]!.endConditionValue).toBe(1_600)
    expect(repeat.workoutSteps[1]!.endCondition.conditionTypeKey).toBe('time')
    expect(repeat.workoutSteps[1]!.endConditionValue).toBe(120)
    expect(repeat.workoutSteps[1]!.stepType.stepTypeKey).toBe('recovery')
  })

  it('maps 5 x 800m at controlled 5K pace', () => {
    const workout = prescription({
      type: 'vo2max',
      title: 'Controlled 5K Specific 5 x 800m',
      blocks: [
        {
          kind: 'repeat',
          repetitions: 5,
          steps: [
            {
              kind: 'effort',
              target: { distanceMeters: 800, paceSecPerKm: { min: 240, max: 248 } },
              notes: ['Controlled target 5K effort. Not all-out.'],
            },
            { kind: 'recovery', target: { durationSeconds: 120 } },
          ],
        },
      ],
    })
    const repeat = steps(workout)[0]! as GarminRepeatStep

    expect(repeat.numberOfIterations).toBe(5)
    expect(repeat.workoutSteps[0]!.endConditionValue).toBe(800)
    expect(repeat.workoutSteps[0]!.targetValueTwo).toBeCloseTo(1_000 / 240, 6)
    expect(repeat.workoutSteps[0]!.description).toBe('')
    expect(repeat.workoutSteps[1]!.targetType.workoutTargetTypeKey).toBe('no.target')
  })

  it('maps a strides repeat onto timed interval steps without inventing a target', () => {
    const workout = prescription({
      title: 'Easy Run with Strides',
      blocks: [
        { kind: 'effort', target: { distanceMeters: 6_000, paceSecPerKm: { min: 310, max: 387 } } },
        {
          kind: 'repeat',
          repetitions: 4,
          steps: [
            { kind: 'strides', target: { durationSeconds: 20 }, notes: ['Smooth acceleration, focus on form.'] },
            { kind: 'recovery', target: { durationSeconds: 40 }, notes: ['Walk or easy jog recovery.'] },
          ],
        },
      ],
    })
    const repeat = steps(workout)[1]! as GarminRepeatStep

    expect(repeat.numberOfIterations).toBe(4)
    expect(repeat.workoutSteps[0]!.stepType.stepTypeKey).toBe('interval')
    expect(repeat.workoutSteps[0]!.endConditionValue).toBe(20)
    expect(repeat.workoutSteps[0]!.targetType.workoutTargetTypeKey).toBe('no.target')
    expect(repeat.workoutSteps[0]!.description).toBe('')
    expect(repeat.workoutSteps[1]!.endConditionValue).toBe(40)
  })
})

describe('descriptions', () => {
  it('leaves the coach’s description and notes in the plan, off the watch', () => {
    const workout = prescription({
      description: 'Steady easy aerobic run.',
      notes: ['Maintain steady easy pace.'],
      blocks: [{ kind: 'effort', target: { distanceMeters: 6_000 } }],
    })

    expect(toGarminWorkoutPayload(workout).description).toBeNull()
  })
})

describe('course-aware races', () => {
  const race = prescription({
    date: '2026-10-03',
    type: 'race',
    title: 'Broschtkriibslaf 5K Race',
    blocks: [{ kind: 'effort', target: { distanceMeters: 5_000 } }],
  })

  function planWith(courseContext: { pacingNotes: string[] } | undefined): CoachingPlan {
    return {
      schemaVersion: 1,
      id: 'plan',
      revision: 1,
      status: 'active',
      block: { id: 'b', name: 'Block', startDate: '2026-09-06', endDate: '2026-10-03', focus: 'Build' },
      targetEvent: { id: 'primary', name: '10 km', date: '2026-11-29', distanceMeters: 10_000 },
      tuneUpEvents: [
        { id: 'tune', name: 'Broschtkriibslaf', date: '2026-10-03', distanceMeters: 5_000, courseContext },
      ],
      goal: { kind: 'time', targetSeconds: 2_400, description: 'Sub 40' },
      weeks: [],
      provenance: { source: 'gemini', trigger: 'bootstrap', createdAt: '2026-09-05T22:25:08.078Z' },
    }
  }

  it('recognises a race whose event carries course context', () => {
    expect(isCourseAwareRace(planWith({ pacingNotes: ['hilly course'] }), race)).toBe(true)
  })

  it('treats a flat race with no course context as syncable', () => {
    expect(isCourseAwareRace(planWith(undefined), race)).toBe(false)
  })

  it('never treats a non-race prescription as course-aware', () => {
    const easy = prescription({ date: '2026-10-03', type: 'easy' })

    expect(isCourseAwareRace(planWith({ pacingNotes: ['hilly course'] }), easy)).toBe(false)
  })
})

describe('garminWorkoutName', () => {
  it('writes the primes as the apostrophe and quote a watch can draw', () => {
    expect(garminWorkoutName('Threshold · 3 × 8′ @ 4:25')).toBe("Threshold · 3 × 8' @ 4:25")
    expect(garminWorkoutName('Strides · 6 × 20″')).toBe('Strides · 6 × 20"')
  })

  it('leaves a name without them as it was, so nothing already pushed changes', () => {
    expect(garminWorkoutName("Threshold 3 x 7:40 - 3 x 8'@4:25")).toBe("Threshold 3 x 7:40 - 3 x 8'@4:25")
    expect(garminWorkoutName('Répétitions course très rapide')).toBe('Répétitions course très rapide')
  })
})
