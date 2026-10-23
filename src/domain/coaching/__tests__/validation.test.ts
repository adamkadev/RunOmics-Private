import { describe, expect, it } from 'vitest'
import { parseCoachDecision, parseCoachingPlan, parseWorkoutPrescription } from '../validation'
import { keepDecision, plan, workout } from './fixtures'

describe('coaching validation', () => {
  it('parses a structured 3 × 8 minute prescription', () => {
    const parsed = parseWorkoutPrescription(workout())
    expect(parsed.blocks[1]).toMatchObject({ kind: 'repeat', repetitions: 3 })
  })

  it('reads a short name and a structure, and a plan without them as before', () => {
    const named = parseWorkoutPrescription(workout({
      title: 'Threshold · 3 × 8′ @ 4:28',
      shortName: 'Threshold 3×8′',
      structure: { reps: 3, repMinutes: 8, targetPace: '4:28', extras: ['6 strides'] },
    }))
    expect(named).toMatchObject({ shortName: 'Threshold 3×8′', structure: { reps: 3, repMinutes: 8, targetPace: '4:28', extras: ['6 strides'] } })

    const legacy = parseWorkoutPrescription(workout())
    expect(legacy).not.toHaveProperty('shortName')
    expect(legacy).not.toHaveProperty('structure')
    expect(JSON.stringify(legacy)).toBe(JSON.stringify(workout()))
  })

  it('refuses a structure that states nothing, or a pace that is not a clock', () => {
    expect(() => parseWorkoutPrescription(workout({ structure: {} }))).toThrow(/structure: states nothing/)
    expect(() => parseWorkoutPrescription(workout({ structure: { targetPace: '4.25' } }))).toThrow(/targetPace: expected M:SS/)
    expect(() => parseWorkoutPrescription(workout({ structure: { reps: 0 } }))).toThrow(/reps: expected a finite number >= 1/)
    expect(() => parseWorkoutPrescription(workout({ structure: { repMinutes: 0 } }))).toThrow(/repMinutes: expected a number > 0/)
    expect(() => parseWorkoutPrescription(workout({ shortName: ' ' }))).toThrow(/shortName: expected a non-empty string/)
  })

  it('rejects an inverted pace range', () => {
    const invalid = workout()
    const repeat = invalid.blocks[1]
    if (repeat?.kind === 'repeat') repeat.steps[0]!.target.paceSecPerKm = { min: 270, max: 265 }
    expect(() => parseWorkoutPrescription(invalid)).toThrow(/min must be <= max/)
  })

  it('rejects duplicate workout ids across weeks', () => {
    const invalid = plan()
    invalid.weeks[1]!.workouts[0]!.id = invalid.weeks[0]!.workouts[0]!.id
    expect(() => parseCoachingPlan(invalid)).toThrow(/duplicate workout id/)
  })

  it('rejects duplicate week ids and indexes', () => {
    const duplicateId = plan()
    duplicateId.weeks[1]!.id = duplicateId.weeks[0]!.id
    expect(() => parseCoachingPlan(duplicateId)).toThrow(/duplicate id/)

    const duplicateIndex = plan()
    duplicateIndex.weeks[1]!.index = duplicateIndex.weeks[0]!.index
    expect(() => parseCoachingPlan(duplicateIndex)).toThrow(/duplicate week index/)
  })

  it('rejects a training block that continues beyond its primary target', () => {
    const invalid = plan({
      targetEvent: { id: 'race-1', name: 'Early 10K', date: '2026-09-27', role: 'primary' },
    })
    expect(() => parseCoachingPlan(invalid)).toThrow(/cannot extend beyond the primary target event/)
  })

  it('validates explicit primary and tune-up event roles', () => {
    const parsed = parseCoachingPlan(plan({
      targetEvent: { id: 'race-primary', name: 'Autumn 10K', date: '2026-10-18', role: 'primary', targetSeconds: 2_400 },
      tuneUpEvents: [{ id: 'race-tune-up', name: 'Tune-up 5K', date: '2026-09-20', role: 'tune_up', targetSeconds: 1_200 }],
    }))
    expect(parsed.tuneUpEvents?.[0]?.role).toBe('tune_up')
    expect(parsed.targetEvent?.targetSeconds).toBe(2_400)
    expect(parsed.tuneUpEvents?.[0]?.targetSeconds).toBe(1_200)

    const invalid = plan({
      targetEvent: { id: 'race-primary', name: 'Autumn 10K', date: '2026-10-18', role: 'primary' },
      tuneUpEvents: [{ id: 'race-tune-up', name: 'Tune-up 5K', date: '2026-09-20', role: 'primary' }],
    })
    expect(() => parseCoachingPlan(invalid)).toThrow(/must be tune_up/)

    expect(() => parseCoachingPlan(plan({
      targetEvent: { id: 'race-primary', name: 'Autumn 10K', date: '2026-10-18', role: 'primary', targetSeconds: 0 },
    }))).toThrow(/targetSeconds/)
  })

  it('rejects unsupported schema versions', () => {
    expect(() => parseCoachingPlan({ ...plan(), schemaVersion: 2 })).toThrow(/unsupported schema version/)
  })

  it('enforces KEEP semantics', () => {
    const invalid = keepDecision({ resultPlanRevision: 2 })
    expect(() => parseCoachDecision(invalid)).toThrow(/KEEP must preserve/)
  })

  it('enforces ADJUST and REPLAN change kinds', () => {
    const existing = workout()
    const changed = workout({ revision: 2, totalDurationSeconds: 3_300, status: 'adjusted' })
    expect(() => parseCoachDecision(keepDecision({
      outcome: 'ADJUST',
      resultPlanRevision: 2,
      changes: [{ kind: 'replace_future', effectiveDate: '2026-09-10', beforeWeeks: [], afterWeeks: [] }],
    }))).toThrow(/ADJUST cannot replace/)
    expect(() => parseCoachDecision(keepDecision({
      outcome: 'REPLAN',
      resultPlanRevision: 2,
      changes: [{ kind: 'upsert_workout', before: existing, after: changed }],
    }))).toThrow(/REPLAN must use/)
  })
})
