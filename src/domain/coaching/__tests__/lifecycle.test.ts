import { describe, expect, it } from 'vitest'
import { applyCoachDecision, getFutureSnapshot } from '../lifecycle'
import { keepDecision, plan, workout } from './fixtures'

describe('coaching plan lifecycle', () => {
  it('leaves the plan untouched for KEEP', () => {
    const current = plan()
    expect(applyCoachDecision(current, keepDecision())).toEqual(current)
  })

  it('applies an adjustment and increments both revisions once', () => {
    const current = plan()
    const before = current.weeks[1]!.workouts[0]!
    const after = workout({
      ...before,
      revision: 2,
      status: 'adjusted',
      totalDurationSeconds: 2_700,
      provenance: { ...before.provenance, trigger: 'weekly_review' },
    })
    const decision = keepDecision({
      id: 'decision-adjust',
      outcome: 'ADJUST',
      trigger: 'weekly_review',
      effectiveDate: '2026-09-12',
      resultPlanRevision: 2,
      changes: [{ kind: 'upsert_workout', before, after }],
    })

    const result = applyCoachDecision(current, decision)
    expect(result.revision).toBe(2)
    expect(result.weeks[1]!.workouts[0]).toMatchObject({ id: before.id, revision: 2, totalDurationSeconds: 2_700 })
    expect(result.provenance).toMatchObject({ decisionId: decision.id, parentRevision: 1 })
  })

  it('rejects stale revisions and changes to past prescriptions', () => {
    const current = plan()
    expect(() => applyCoachDecision(current, keepDecision({ basePlanRevision: 2, resultPlanRevision: 2 }))).toThrow(/stale plan revision/)

    const before = current.weeks[0]!.workouts[0]!
    const after = workout({ ...before, revision: 2, status: 'adjusted' })
    const decision = keepDecision({
      outcome: 'ADJUST',
      resultPlanRevision: 2,
      effectiveDate: '2026-09-10',
      changes: [{ kind: 'upsert_workout', before, after }],
    })
    expect(() => applyCoachDecision(current, decision)).toThrow(/past prescriptions are immutable/)
  })

  it('replaces only the future snapshot during REPLAN', () => {
    const current = plan()
    const effectiveDate = '2026-09-14'
    const replacement = [{
      ...current.weeks[1]!,
      focus: 'Reduced return week',
      workouts: [workout({ id: 'workout-return', date: '2026-09-16', type: 'recovery', title: 'Return run' })],
    }]
    const result = applyCoachDecision(current, keepDecision({
      id: 'decision-replan',
      outcome: 'REPLAN',
      trigger: 'weekly_review',
      effectiveDate,
      resultPlanRevision: 2,
      changes: [{
        kind: 'replace_future',
        effectiveDate,
        beforeWeeks: getFutureSnapshot(current, effectiveDate),
        afterWeeks: replacement,
      }],
    }))

    expect(result.weeks[0]).toEqual(current.weeks[0])
    expect(result.weeks[1]).toMatchObject({ focus: 'Reduced return week' })
  })

  it('retains past prescriptions when a replan omits the overlapping week', () => {
    const current = plan()
    const result = applyCoachDecision(current, keepDecision({
      id: 'decision-overlap',
      outcome: 'REPLAN',
      effectiveDate: '2026-09-10',
      resultPlanRevision: 2,
      changes: [{
        kind: 'replace_future',
        effectiveDate: '2026-09-10',
        beforeWeeks: getFutureSnapshot(current, '2026-09-10'),
        afterWeeks: [current.weeks[1]!],
      }],
    }))

    expect(result.weeks.flatMap((week) => week.workouts).find((item) => item.id === 'workout-threshold')).toEqual(current.weeks[0]!.workouts[0])
  })

  it('refuses a replacement that reuses the id of a past prescription', () => {
    // Past prescriptions are immutable here as they are for ADJUST.
    const current = plan()
    const reused = workout({ date: '2026-09-12', revision: 2, status: 'adjusted' })

    expect(() => applyCoachDecision(current, keepDecision({
      id: 'decision-reuse',
      outcome: 'REPLAN',
      effectiveDate: '2026-09-10',
      resultPlanRevision: 2,
      changes: [{
        kind: 'replace_future',
        effectiveDate: '2026-09-10',
        beforeWeeks: getFutureSnapshot(current, '2026-09-10'),
        afterWeeks: [{ ...current.weeks[0]!, workouts: [reused] }, current.weeks[1]!],
      }],
    }))).toThrow(/reuses the id of past prescription workout-threshold/)
  })
})
