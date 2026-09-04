import { describe, expect, it } from 'vitest'
import { parseCoachDecision, parseCoachingPlan, parseWorkoutPrescription } from '../validation'
import { keepDecision, plan, workout } from './fixtures'

describe('coaching validation', () => {
  it('parses a structured 3 × 8 minute prescription', () => {
    const parsed = parseWorkoutPrescription(workout())
    expect(parsed.blocks[1]).toMatchObject({ kind: 'repeat', repetitions: 3 })
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
