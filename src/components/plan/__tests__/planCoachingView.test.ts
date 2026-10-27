import { describe, expect, it } from 'vitest'
import { buildCoachingOverview } from '@/application/coaching/GetCoachingView'
import type { Activity } from '@/domain/activity/types'
import { COACHING_SCHEMA_VERSION, type WorkoutEvaluation } from '@/domain/coaching/types'
import { plan, workout } from '@/domain/coaching/__tests__/fixtures'
import { coachWorkoutView, heroWorkoutView } from '../planWorkoutView'
import { planCoachingView } from '../planCoachingView'

const evaluation: WorkoutEvaluation = {
  schemaVersion: COACHING_SCHEMA_VERSION,
  id: 'evaluation-1',
  activityId: 'activity-1',
  activityDate: '2026-09-09',
  prescriptionId: 'workout-threshold',
  planId: 'plan-1',
  planRevision: 1,
  matchStatus: 'matched',
  decisionId: 'decision-keep',
  summary: 'Heart rate ran high for the pace; the athlete tagged the run sick.',
  createdAt: '2026-09-09T18:00:00Z',
  contextHash: 'hash',
  provenance: { source: 'demo', trigger: 'post_activity', createdAt: '2026-09-09T18:00:00Z' },
}

const withNotes = workout({
  notes: ['Back off if the cough returns.'],
  blocks: [
    { kind: 'warmup', target: { durationSeconds: 900 }, notes: ['Keep it conversational.'] },
    { kind: 'effort', target: { durationSeconds: 1200, paceSecPerKm: { min: 265, max: 270 } } },
  ],
})

const overview = buildCoachingOverview(
  plan({
    tuneUpEvents: [{ id: 'race-2', name: 'Park 5K', date: '2026-09-27', role: 'tune_up', courseContext: { pacingNotes: ['Hilly'] } }],
    weeks: [{ id: 'week-1', index: 1, startDate: '2026-09-07', endDate: '2026-09-13', focus: 'Threshold introduction', workouts: [withNotes] }],
  }),
  [evaluation],
  // The prescription reads as completed only when its matched run is on record.
  [{ id: 'activity-1' } as Activity],
  '2026-09-09',
)

describe('planCoachingView', () => {
  const view = planCoachingView(overview)
  const payload = JSON.stringify(view)

  it('carries none of the coach decision or evaluation', () => {
    expect(view).not.toHaveProperty('latestDecision')
    expect(view).not.toHaveProperty('latestEvaluation')
    for (const text of ['Session completed as intended.', 'PACE_IN_RANGE', 'tagged the run sick']) {
      expect(payload).not.toContain(text)
    }
  })

  it("carries no focus, goal, description, notes or provenance", () => {
    for (const text of [
      'Threshold durability',
      'Threshold introduction',
      'Run under 40 minutes.',
      'Controlled threshold repetitions.',
      'Back off if the cough returns.',
      'Keep it conversational.',
      'Hilly',
      'provenance',
    ]) {
      expect(payload).not.toContain(text)
    }
  })

  it('keeps what the week and month views draw', () => {
    expect(view.plan).toEqual({
      block: { startDate: '2026-09-07', endDate: '2026-10-04' },
      targetEvent: { date: '2026-10-18', name: 'Autumn 10K', distanceLabel: '10K' },
      tuneUpEvents: [{ date: '2026-09-27', name: 'Park 5K', role: 'tune_up' }],
    })
    const [only] = view.workouts
    expect(only?.state).toBe('completed')
    expect(only?.activityId).toBe('activity-1')
    expect(only?.prescription.title).toBe('3 × 8 min threshold')
    expect(only?.prescription.blocks[0]).toEqual({ kind: 'warmup', target: { durationSeconds: 900 } })
  })

  it('draws the same session row from the trimmed view as from the full one', () => {
    const full = coachWorkoutView(overview.workouts[0]!)
    const trimmed = coachWorkoutView(view.workouts[0]!)

    expect({ ...trimmed, description: full.description, notes: full.notes }).toEqual(full)
  })
})

describe('heroWorkoutView', () => {
  it("keeps the coach's description and notes off the dashboard", () => {
    const hero = heroWorkoutView(coachWorkoutView(overview.workouts[0]!))

    // What the hero's session row needs ("25 min Z4", "planned 6 km"); the
    // prose stays behind.
    expect(hero).toEqual({
      key: 'workout-threshold',
      state: 'completed',
      title: '3 × 8 min threshold',
      type: 'Threshold',
      duration: { seconds: 3600, estimated: false },
      distanceM: expect.any(Number),
      target: expect.any(String),
      activityId: 'activity-1',
      // The steps, so the hero's bar and Plan's are drawn from the same session.
      structure: expect.any(Array),
      hr: null,
    })
    expect(JSON.stringify(hero)).not.toContain('cough')
  })
})
