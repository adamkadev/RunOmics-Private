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

  it('keeps each upcoming race goal independent', () => {
    const context = buildCoachingContext({
      ...input([]),
      upcomingRaces: [
        { date: '2026-09-27', name: 'Tune-up 10K', distance: '10K', targetSeconds: null },
        { date: '2026-11-29', name: 'Primary 10K', distance: '10K', targetSeconds: 2_400, isPrimaryEvent: true },
      ],
    }, '2026-09-20')

    expect(context.upcomingRaces[0]).not.toHaveProperty('targetSeconds')
    expect(context.upcomingRaces[1]?.targetSeconds).toBe(2_400)
    const changedGoal = structuredClone(context)
    changedGoal.upcomingRaces[1]!.targetSeconds = 2_390
    expect(coachingContextHash(changedGoal)).not.toBe(coachingContextHash(context))
  })

  it('removes a completed same-day race using race-type and distance evidence', () => {
    const context = buildCoachingContext({
      ...input([activity('completed-5k', '2026-09-05', 5.03, 'Race')]),
      upcomingRaces: [
        { date: '2026-09-05', name: 'Completed 5K', distance: '5K', targetSeconds: 1_200 },
        { date: '2026-09-05', name: 'Different same-day race', distance: '10K' },
        { date: '2026-10-03', name: 'Future 5K', distance: '5K' },
      ],
    }, '2026-09-05')

    expect(context.upcomingRaces.map((race) => race.name)).toEqual([
      'Different same-day race',
      'Future 5K',
    ])
  })

  it('keeps a same-day race when there is no completed matching race activity', () => {
    const context = buildCoachingContext({
      ...input([activity('morning-run', '2026-09-05', 3, 'Base')]),
      upcomingRaces: [
        { date: '2026-09-05', name: 'Later today 5K', distance: '5K' },
      ],
    }, '2026-09-05')

    expect(context.upcomingRaces).toMatchObject([
      { date: '2026-09-05', name: 'Later today 5K' },
    ])
  })

  it('preserves Garmin LTHR-based HR bounds without deriving them from max HR', () => {
    const context = buildCoachingContext({
      ...input([]),
      athlete: {
        lthrBpm: 187,
        maxHrBpm: 202,
        hrZoneBoundsBpm: [125, 150, 168, 178, 188],
      },
    }, '2026-09-05')

    expect(context.athlete.lthrBpm).toBe(187)
    expect(context.athlete.hrZoneBoundsBpm).toEqual([125, 150, 168, 178, 188])
    expect(context.athlete).not.toHaveProperty('maxHrBpm')
  })
})

it('includes recent running volume and old capacity without transmitting old activities', () => {
  const context = buildCoachingContext(input([
    activity('old-capacity', '2025-01-06', 60),
    activity('recent-run', '2026-09-20', 5),
    { ...activity('bike', '2026-09-20', 100), sport: 'cycling' },
  ]), '2026-09-20')
  expect(context.trainingHistory).toMatchObject({ historicalPeakWeekKm: 60, recent28DaysKm: 5, recent28DaysRuns: 1 })
  expect(context.volume.distance28DaysKm).toBe(5)
  expect(JSON.stringify(context)).not.toContain('old-capacity')
  expect(JSON.stringify(context)).not.toContain('bike')
})
