import {
  COACHING_SCHEMA_VERSION,
  type CoachDecision,
  type CoachingPlan,
  type CoachingProvenance,
  type WorkoutPrescription,
} from '../types'

export const createdAt = '2026-09-05T08:00:00.000Z'

export function provenance(trigger: CoachingProvenance['trigger'] = 'bootstrap'): CoachingProvenance {
  return { source: 'demo', trigger, createdAt }
}

export function workout(overrides: Partial<WorkoutPrescription> = {}): WorkoutPrescription {
  return {
    id: 'workout-threshold',
    revision: 1,
    date: '2026-09-09',
    type: 'threshold',
    title: '3 × 8 min threshold',
    description: 'Controlled threshold repetitions.',
    status: 'prescribed',
    totalDurationSeconds: 3_600,
    blocks: [
      { kind: 'warmup', target: { distanceMeters: 2_000 } },
      {
        kind: 'repeat',
        repetitions: 3,
        steps: [
          { kind: 'effort', target: { durationSeconds: 480, paceSecPerKm: { min: 265, max: 270 } } },
          { kind: 'recovery', target: { durationSeconds: 120 } },
        ],
      },
      { kind: 'cooldown', target: { durationSeconds: 600 } },
    ],
    provenance: provenance(),
    ...overrides,
  }
}

export function plan(overrides: Partial<CoachingPlan> = {}): CoachingPlan {
  return {
    schemaVersion: COACHING_SCHEMA_VERSION,
    id: 'plan-1',
    revision: 1,
    status: 'active',
    block: {
      id: 'block-1',
      name: 'Autumn 10K build',
      startDate: '2026-09-07',
      endDate: '2026-10-04',
      focus: 'Threshold durability',
    },
    targetEvent: {
      id: 'race-1',
      name: 'Autumn 10K',
      date: '2026-10-18',
      distanceLabel: '10K',
      distanceMeters: 10_000,
    },
    goal: { kind: 'time', targetSeconds: 2_400, description: 'Run under 40 minutes.' },
    weeks: [
      {
        id: 'week-1',
        index: 1,
        startDate: '2026-09-07',
        endDate: '2026-09-13',
        focus: 'Threshold introduction',
        workouts: [workout()],
      },
      {
        id: 'week-2',
        index: 2,
        startDate: '2026-09-14',
        endDate: '2026-09-20',
        focus: 'Aerobic support',
        workouts: [workout({ id: 'workout-easy', date: '2026-09-15', type: 'easy', title: 'Easy run', blocks: [{ kind: 'effort', target: { durationSeconds: 2_700, paceSecPerKm: { min: 330, max: 360 } } }] })],
      },
    ],
    provenance: provenance(),
    ...overrides,
  }
}

export function keepDecision(overrides: Partial<CoachDecision> = {}): CoachDecision {
  return {
    schemaVersion: COACHING_SCHEMA_VERSION,
    id: 'decision-keep',
    outcome: 'KEEP',
    trigger: 'post_activity',
    createdAt,
    effectiveDate: '2026-09-10',
    planId: 'plan-1',
    basePlanRevision: 1,
    resultPlanRevision: 1,
    reasonCodes: ['SESSION_COMPLETED'],
    summary: 'Session completed as intended.',
    evidence: [{ code: 'PACE_IN_RANGE', message: 'Average pace was inside the target range.' }],
    changes: [],
    provenance: provenance('post_activity'),
    ...overrides,
  }
}
