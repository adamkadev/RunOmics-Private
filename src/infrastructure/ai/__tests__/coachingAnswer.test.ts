import { describe, expect, it } from 'vitest'
import { parseRecommendation } from '../coachingAnswer'

const session = {
  date: '2026-09-15',
  type: 'easy',
  title: 'Easy run',
  description: 'Comfortable aerobic running.',
  blocks: [{ kind: 'effort', target: { distanceMeters: 6_000 } }],
}

const recommendation = (outcome: string, changes: unknown[]) => ({
  outcome,
  reasonCodes: ['FATIGUE'],
  summary: 'Ease the next run.',
  evidence: [{ code: 'HR_DRIFT', message: 'Heart rate drifted.', value: '6', unit: '' }],
  changes,
})

describe('reading an adaptation', () => {
  it('reads an adjustment into the port types', () => {
    const advice = parseRecommendation(recommendation('ADJUST', [
      { kind: 'upsert_workout', workoutId: 'w-1', workout: session },
      { kind: 'cancel_workout', workoutId: 'w-2' },
    ]), 'post_activity')

    expect(advice.outcome).toBe('ADJUST')
    expect(advice.evidence).toEqual([{ code: 'HR_DRIFT', message: 'Heart rate drifted.', value: '6' }])
    expect(advice.changes[0]).toMatchObject({ kind: 'upsert_workout', workoutId: 'w-1', workout: { id: 'draft-workout', revision: 1 } })
    expect(advice.changes[1]).toEqual({ kind: 'cancel_workout', workoutId: 'w-2' })
  })

  it('reads a replan into weeks, filling the ids the model left out', () => {
    const advice = parseRecommendation(recommendation('REPLAN', [{
      kind: 'replace_future',
      effectiveDate: '2026-09-14',
      weeks: [{ startDate: '2026-09-14', endDate: '2026-09-20', focus: 'Absorb', workouts: [session] }],
    }]), 'weekly_review')

    expect(advice.changes[0]).toMatchObject({
      kind: 'replace_future',
      weeks: [{ id: 'draft-week-1', index: 1, workouts: [{ id: 'draft-workout', date: '2026-09-15' }] }],
    })
  })

  it('refuses an outcome it does not know', () => {
    expect(() => parseRecommendation(recommendation('PANIC', []), 'weekly_review')).toThrow(/recommendation\.outcome/)
  })
})
