import { describe, expect, it } from 'vitest'
import type { Activity } from '@/domain/activity/types'
import { buildCoachingContext, coachingContextHash, type CoachingContextInput } from '../context'
import { plan } from '@/domain/coaching/__tests__/fixtures'

function activity(id: string, date: string, distanceKm: number, type: Activity['type'] = 'Base'): Activity {
  return {
    id,
    date,
    type,
    distanceKm,
    durationSeconds: Math.round(distanceKm * 300),
    paceSecPerKm: 300,
    avgHeartRate: 145,
    rpe: 4,
    aerTrainingEffect: 2.5,
    anaTrainingEffect: 0.2,
    splits: null,
    route: [[1, 2]],
    paceSamples: [300, 301],
  } as Activity
}

function input(activities: Activity[]): CoachingContextInput {
  return {
    activities,
    plan: plan(),
    athlete: { thresholdPaceSecPerKm: 270, lthrBpm: 175, hrZoneBoundsBpm: [130, 145, 160, 175, 185], vmaKmh: 17 },
    trainingStatus: null,
    loadBalance: null,
    trainingZones: null,
    latestVo2max: 51,
    racePredictions: null,
    goals: [],
    personalBests: [],
    upcomingRaces: [],
  }
}

describe('buildCoachingContext', () => {
  it('computes fixed 7 and 28 day windows and recent gaps', () => {
    const context = buildCoachingContext(input([
      activity('today', '2026-09-20', 10),
      activity('six-days', '2026-09-14', 8),
      activity('seven-days', '2026-09-13', 7),
      activity('old', '2026-08-20', 20),
    ]), '2026-09-20')

    expect(context.volume).toEqual({ distance7DaysKm: 18, distance28DaysKm: 25, runs7Days: 2, runs28Days: 3 })
    expect(context.gaps).toEqual({ daysSinceLastRun: 0, longestGap28Days: 5 })
  })

  it('keeps the LLM context compact and excludes raw route/sample data', () => {
    const context = buildCoachingContext(input([activity('a', '2026-09-20', 10)]), '2026-09-20')
    const compact = context.recentActivities[0] as unknown as Record<string, unknown>
    expect(compact).not.toHaveProperty('route')
    expect(compact).not.toHaveProperty('paceSamples')
    expect(coachingContextHash(context)).toBe(coachingContextHash(structuredClone(context)))
  })

  it('uses explicit nulls when optional physiological inputs are unavailable', () => {
    const context = buildCoachingContext({ ...input([]), athlete: {}, plan: null }, '2026-09-20')
    expect(context.load.ctl).toBeNull()
    expect(context.athlete.thresholdPaceSecPerKm).toBeNull()
    expect(context.adherence).toBeNull()
  })
})
