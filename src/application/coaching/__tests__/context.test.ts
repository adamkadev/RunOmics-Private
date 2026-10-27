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
    trajectories: null,
    racePredictions: null,
    goals: [],
    personalBests: [],
    upcomingRaces: [],
    officialResults: [],
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

  it('sums other training apart from the running figures, and leaves a context without any as it was', () => {
    const runs = [activity('run', '2026-09-20', 10)]
    const strength = { id: 's', date: '2026-09-19', sport: 'strength_training', durationSeconds: 2700, distanceKm: null, avgHeartRate: 104, trainingLoad: 31.3, sets: [{ reps: 12 }, { reps: 10 }] }
    const ride = { id: 'b', date: '2026-09-01', sport: 'road_biking', durationSeconds: 5400, distanceKm: 40, avgHeartRate: 128, trainingLoad: null }
    const without = buildCoachingContext(input(runs), '2026-09-20')

    const context = buildCoachingContext({ ...input(runs), crossTraining: [strength, ride] }, '2026-09-20')

    expect(context.otherTraining).toEqual({
      minutes7Days: 45,
      minutes28Days: 135,
      sessions: [
        { date: '2026-09-19', kind: 'strength', minutes: 45, trainingLoad: 31, sets: 2 },
        { date: '2026-09-01', kind: 'cycling', minutes: 90 },
      ],
    })
    expect(context.volume).toEqual(without.volume)
    expect(coachingContextHash(buildCoachingContext({ ...input(runs), crossTraining: [] }, '2026-09-20'))).toBe(coachingContextHash(without))
  })

  it('carries the note and tags the athlete wrote, and omits the fields otherwise', () => {
    const context = buildCoachingContext({
      ...input([activity('sick-day', '2026-09-23', 10), activity('quiet', '2026-09-22', 8)]),
      activityNotes: new Map([
        ['sick-day', { note: 'Ill since Monday, felt hot throughout.', tags: ['sick'] }],
        ['quiet', { note: '', tags: [] }],
      ]),
    }, '2026-09-23')

    const [annotated, plain] = context.recentActivities
    expect(annotated).toMatchObject({ note: 'Ill since Monday, felt hot throughout.', tags: ['sick'] })
    // An empty note is the same as no note: a `note: ""` on every run is prompt noise.
    expect(plain).not.toHaveProperty('note')
    expect(plain).not.toHaveProperty('tags')
  })

  it('builds a context when no notes were read at all', () => {
    const context = buildCoachingContext(input([activity('a', '2026-09-20', 10)]), '2026-09-20')
    expect(context.recentActivities[0]).not.toHaveProperty('note')
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

  it('tells the planner of no controlled threshold ceiling for an athlete without an LTHR, whatever her zones', () => {
    const context = buildCoachingContext({ ...input([]), athlete: { maxHrBpm: 206, hrZoneBoundsBpm: [103, 124, 144, 165, 185] } }, '2026-10-25')
    expect(context.controlledThreshold).toBeNull()
  })

  it('carries the athlete facts a coach would ask for before prescribing', () => {
    const context = buildCoachingContext({
      ...input([]),
      athlete: { age: 41, sex: 'male', restingHrBpm: 48, weightKg: 72, heightCm: 178, maxHrBpm: 202 },
    }, '2026-09-05')

    expect(context.athlete).toMatchObject({ ageYears: 41, sex: 'male', restingHrBpm: 48, weightKg: 72, heightCm: 178 })
    // Age reaches the planner, so the one thing it must not be turned into does not.
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

describe('official race result overlay', () => {
  const lap = (durationSec: number, distanceM: number, avgHr: number) => ({
    type: 'lap' as const,
    durationSec,
    distanceM,
    avgSpeedMs: distanceM / durationSec,
    avgHr,
    laps: [],
  })

  const escher = {
    id: 'escher',
    date: '2026-09-05',
    type: 'Race',
    distanceKm: 5.25,
    durationSeconds: 1_310,
    paceSecPerKm: 249.5,
    avgHeartRate: 196,
    rpe: 10,
    aerTrainingEffect: 5,
    anaTrainingEffect: 3.1,
    splits: [
      lap(236, 1_000, 191),
      lap(245, 1_000, 196),
      lap(249, 1_000, 199),
      lap(253, 1_000, 197),
      lap(255, 1_000, 198),
      lap(71, 248.6, 197),
    ],
  } as unknown as Activity

  const officialResult = {
    activityId: 'escher',
    eventName: 'Escher Kulturlaf',
    date: '2026-09-05',
    distanceMeters: 5_000,
    chipTimeSeconds: 1_292,
    gunTimeSeconds: 1_293,
    overallPlace: 28,
  }

  const build = (officialResults: typeof officialResult[]) =>
    buildCoachingContext({ ...input([escher]), officialResults }, '2026-09-05').recentActivities[0]!

  it('resolves performance to the official result before the prompt is built', () => {
    expect(build([officialResult]).performance).toEqual({
      source: 'official',
      distanceKm: 5,
      durationSeconds: 1_292,
      paceSecPerKm: 258.4,
      eventName: 'Escher Kulturlaf',
      overallPlace: 28,
    })
  })

  it('keeps the raw Garmin measurement available separately', () => {
    const compact = build([officialResult])

    expect(compact.garminMeasured).toEqual({ distanceKm: 5.25, durationSeconds: 1_310, paceSecPerKm: 249.5 })
    expect(compact.distanceKm).toBe(5.3)
    expect(compact.durationSeconds).toBe(1_310)
    expect(compact.avgHeartRate).toBe(196)
    expect(compact.aerobicTrainingEffect).toBe(5)
  })

  it('falls back to Garmin measurements when no official result is linked', () => {
    const compact = build([])

    expect(compact.performance).toEqual({ source: 'garmin', distanceKm: 5.25, durationSeconds: 1_310, paceSecPerKm: 249.5 })
    expect(compact).not.toHaveProperty('garminMeasured')
  })

  it('ignores an official result linked to a different activity', () => {
    expect(build([{ ...officialResult, activityId: 'someone-else' }]).performance?.source).toBe('garmin')
  })

  it('exposes race pacing from the real laps without an official result present', () => {
    expect(build([]).raceExecution?.trend).toMatchObject({
      firstFullLapPaceSecPerKm: 236,
      lastFullLapPaceSecPerKm: 255,
      positiveSplitSecPerKm: 19,
      hrDriftBpm: 7,
    })
    expect(build([]).raceExecution?.partialLap?.distanceMeters).toBe(248.6)
  })

  it('leaves non-race activities exactly as before', () => {
    const compact = buildCoachingContext(
      { ...input([activity('easy', '2026-09-05', 10)]), officialResults: [officialResult] },
      '2026-09-05',
    ).recentActivities[0]!

    expect(compact).not.toHaveProperty('performance')
    expect(compact).not.toHaveProperty('garminMeasured')
    expect(compact).not.toHaveProperty('raceExecution')
    expect(compact.distanceKm).toBe(10)
  })

  it('does not classify race laps as an interval session', () => {
    expect(build([officialResult]).execution).toBeNull()
  })
})

describe('injury history', () => {
  it('carries a reviewed-but-empty history through as evidence of none', () => {
    const context = buildCoachingContext(
      { ...input([]), athlete: { injuryHistory: { reviewedOn: '2026-09-22', injuries: [] } } },
      '2026-09-22',
    )

    expect(context.athlete.injuryHistory).toEqual({ reviewedOn: '2026-09-22', injuries: [] })
  })

  it('distinguishes a history nobody has taken from one that is empty', () => {
    const context = buildCoachingContext({ ...input([]), athlete: {} }, '2026-09-22')

    expect(context.athlete.injuryHistory).toBeNull()
  })
})

describe('morning check-ins and training breaks', () => {
  it('carries the last 28 mornings newest first, and the niggles of 12 weeks, never a later morning', () => {
    const context = buildCoachingContext({
      ...input([]),
      wellness: new Map([
        ['2026-07-01', { niggle: { site: 'hip' as const, pain: 3 } }],
        ['2026-08-05', { niggle: { site: 'knee' as const, pain: 3 } }],
        ['2026-09-01', { sleep: 1 }],
        ['2026-10-20', { sleep: 4, soreness: 2, niggle: { site: 'calf' as const, side: 'left' as const, pain: 4, changesRun: true } }],
        ['2026-10-22', { ill: true }],
        ['2026-10-23', { skipped: 'ill' as const }],
        ['2026-10-26', { sleep: 5 }],
      ]),
    }, '2026-10-25')

    expect(context.wellness?.checkIns).toEqual([
      { date: '2026-10-23', skipped: 'ill' },
      { date: '2026-10-22', ill: true },
      { date: '2026-10-20', sleep: 4, soreness: 2, niggle: { site: 'calf', side: 'left', pain: 4, changesRun: true } },
    ])
    expect(context.wellness?.niggles.map((n) => `${n.site} ${n.from}`)).toEqual(['calf 2026-10-20', 'knee 2026-08-05'])
  })

  it('says nothing of check-ins it could not read, and keeps the breaks of the last year', () => {
    const context = buildCoachingContext({
      ...input([]),
      athlete: {
        trainingBreaks: [
          { start: '2025-06-01', end: '2025-06-20', reason: 'travel' },
          { start: '2026-08-10', end: '2026-08-24', reason: 'heat' },
        ],
      },
    }, '2026-10-25')

    expect(context).not.toHaveProperty('wellness')
    expect(context.athlete.trainingBreaks).toEqual([{ start: '2026-08-10', end: '2026-08-24', reason: 'heat' }])
  })
})
