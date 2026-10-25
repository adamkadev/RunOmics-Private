import { describe, expect, it } from 'vitest'
import type { Activity, ActivitySplit } from '@/domain/activity/types'
import type { CoachingPlan } from '@/domain/coaching/types'
import { plan, workout } from '@/domain/coaching/__tests__/fixtures'
import { buildCycleCheckpoint, type CheckpointInputs } from '../GetCycleCheckpoint'

const GENERAL: CoachingPlan = { ...plan(), macrocycleStartDate: '2026-10-15', targetEvent: undefined, weeks: [] }
const GUIDE = { min: 268, max: 274 }

function run(date: string, overrides: Partial<Activity> = {}): Activity {
  return {
    id: `run-${date}`,
    date,
    type: 'Base',
    distanceKm: 10,
    durationSeconds: 3_500,
    paceSecPerKm: 350,
    avgHeartRate: 145,
    hrZones: [],
    splits: null,
    hrSamples: null,
    weather: null,
    ...overrides,
  } as Activity
}

function controlledRun(date: string, reps: number): Activity {
  const splits: ActivitySplit[] = [{ type: 'interval_warmup', durationSec: 600, distanceM: 1_700, avgSpeedMs: 2.8, avgHr: null, laps: [] }]
  for (let i = 0; i < reps; i += 1) {
    splits.push({ type: 'interval_active', durationSec: 300, distanceM: 1_100, avgSpeedMs: 3.7, avgHr: null, laps: [] })
    splits.push({ type: 'interval_recovery', durationSec: 90, distanceM: 230, avgSpeedMs: 2.6, avgHr: null, laps: [] })
  }
  const durationSeconds = splits.reduce((sum, split) => sum + split.durationSec, 0)
  return run(date, { type: 'Threshold', splits, durationSeconds, hrSamples: Array.from({ length: durationSeconds / 10 }, () => 160) })
}

const controlled = (date: string, reps: number) => workout({
  id: `threshold-${date}`,
  date,
  blocks: [{
    kind: 'repeat',
    repetitions: reps,
    steps: [
      { kind: 'effort', target: { durationSeconds: 300, paceSecPerKm: GUIDE, hrBpm: { min: 156, max: 173 } } },
      { kind: 'recovery', target: { durationSeconds: 90 } },
    ],
  }],
})

function inputs(overrides: Partial<CheckpointInputs> = {}): CheckpointInputs {
  return { activities: [], plans: [GENERAL], officialResults: [], vo2max: [], threshold: [], restingHr: [], hrBounds: { maxHr: 195, restingHr: 45 }, ...overrides }
}

describe('buildCycleCheckpoint', () => {
  it('rates this cycle over its weeks already over, and the one before from the first run on', () => {
    const activities = [run('2026-09-29', { distanceKm: 12 }), run('2026-10-05', { distanceKm: 8 }), run('2026-10-13'), run('2026-10-20'), run('2026-10-21'), run('2026-10-27', { distanceKm: 30 })]
    const checkpoint = buildCycleCheckpoint(inputs({ activities }), '2026-10-28')

    expect(checkpoint.generalPreparation).toBe(true)
    expect(checkpoint.cycle).toMatchObject({ week: 3, completeWeeks: 2 })
    expect(checkpoint.volume).toEqual({ kmPerWeek: { previous: 10, current: 15 }, runsPerWeek: { previous: 1, current: 1.5 } })
  })

  it('reads controlled threshold time from the laps, with the guide each length was run to', () => {
    const plans: CoachingPlan[] = [{ ...GENERAL, weeks: [{ ...plan().weeks[0]!, workouts: [controlled('2026-10-14', 4), controlled('2026-10-21', 5)] }] }]
    const checkpoint = buildCycleCheckpoint(inputs({ plans, activities: [run('2026-09-30'), controlledRun('2026-10-14', 4), controlledRun('2026-10-21', 5)] }), '2026-10-22')

    expect(checkpoint.threshold).toEqual({
      minutesPerWeek: { previous: 0, current: 20 },
      guides: [{ repClass: 'medium', previous: null, current: GUIDE }],
      soFar: { minutes: 45, sessions: 2 },
    })
  })

  it('times a 5K check by its chip, and leaves out what the watch never recorded', () => {
    const race = run('2026-09-05', { id: 'race', type: 'Race', distanceKm: 5.3, durationSeconds: 1_325 })
    const checkpoint = buildCycleCheckpoint(inputs({ activities: [race], officialResults: [{ activityId: 'race', distanceMeters: 5_000, chipTimeSeconds: 1_260 }] }), '2026-10-25')

    expect(checkpoint.fiveK).toEqual({ previous: { date: '2026-09-05', seconds: 1_260, vdot: 47 }, current: null })
    expect(checkpoint).toMatchObject({ threshold: null, efficiency: null, easyHr: null, vo2max: null, thresholdPace: null, lthr: null, restingHr: null })
  })

  it('reads Garmin’s estimates as they stood at each cycle’s end', () => {
    const threshold = [{ date: '2026-09-29', thresholdPaceSecPerKm: 263, lthrBpm: 183 }, { date: '2026-10-10', thresholdPaceSecPerKm: 261, lthrBpm: 179 }]
    const checkpoint = buildCycleCheckpoint(inputs({ threshold }), '2026-10-25')

    expect(checkpoint.thresholdPace).toEqual({ previous: { date: '2026-10-10', value: 261 }, current: { date: '2026-10-10', value: 261 } })
  })
})
