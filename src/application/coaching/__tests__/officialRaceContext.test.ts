import { describe, expect, it } from 'vitest'
import type { Activity, ActivitySplit } from '@/domain/activity/types'
import { sessionExecution } from '@/domain/activity/sessionExecution'
import { raceExecution } from '@/domain/activity/raceExecution'
import { buildCoachingContext, type CoachingContextInput } from '../context'

function lap(durationSec: number, distanceM: number, avgHr: number): ActivitySplit {
  return {
    type: 'lap',
    durationSec,
    distanceM,
    avgSpeedMs: distanceM / durationSec,
    avgHr,
    laps: [],
  }
}

function escher(): Activity {
  return {
    id: '24249913094',
    week: 36,
    date: '2026-09-05T18:15:00+02:00',
    dayOfWeek: 'Saturday',
    type: 'Race',
    description: 'Escher Kulturlaf',
    durationSeconds: 1310,
    distanceKm: 5.2486,
    paceSecPerKm: 249.5,
    hrZones: [],
    avgHeartRate: 196,
    rpe: 10,
    comment: 'Official result: 21:32',
    polyline: null,
    route: null,
    elevationGain: null,
    aerTrainingEffect: 5,
    anaTrainingEffect: 2.5,
    hrSamples: null,
    elevationProfile: null,
    calories: null,
    cadenceSpm: null,
    groundContactMs: null,
    verticalOscillationMm: null,
    verticalRatioPct: null,
    strideLengthM: null,
    bestEfforts: { '5k': 1237.6 },
    splits: [
      lap(236, 1000, 191),
      lap(245, 1000, 196),
      lap(249, 1000, 199),
      lap(253, 1000, 197),
      lap(255, 1000, 198),
      lap(72, 248.6, 199),
    ],
    paceSamples: null,
    vo2maxGarmin: null,
    avgTemperature: null,
    cadenceSamples: null,
    gearId: null,
    weather: null,
  }
}

function input(activity: Activity): CoachingContextInput {
  return {
    activities: [activity],
    plan: null,
    athlete: {},
    trainingStatus: null,
    loadBalance: null,
    trainingZones: null,
    latestVo2max: null,
    racePredictions: null,
    goals: [],
    personalBests: [],
    upcomingRaces: [],
  }
}

describe('official race performance coaching context', () => {
  it('uses the structured official result for performance and keeps Garmin measurements separately', () => {
    const activity = escher()
    const context = buildCoachingContext({
      ...input(activity),
      officialRaceResults: [{
        activityId: activity.id,
        eventName: 'Escher Kulturlaf',
        date: '2026-09-05',
        distanceMeters: 5000,
        chipTimeSeconds: 1292,
        gunTimeSeconds: 1293,
        overallPlace: 28,
        source: 'official-results',
      }],
    }, '2026-09-05')

    const compact = context.recentActivities[0]!
    expect(compact).toMatchObject({
      distanceKm: 5,
      durationSeconds: 1292,
      paceSecPerKm: 258.4,
      performance: {
        source: 'official',
        eventName: 'Escher Kulturlaf',
        distanceKm: 5,
        durationSeconds: 1292,
        paceSecPerKm: 258.4,
        gunTimeSeconds: 1293,
        overallPlace: 28,
        provenance: 'official-results',
      },
      garmin: {
        distanceKm: 5.249,
        durationSeconds: 1310,
        paceSecPerKm: 249.5,
        avgHeartRate: 196,
      },
    })
  })

  it('does not parse free-text notes as an official result', () => {
    const context = buildCoachingContext(input(escher()), '2026-09-05')
    const compact = context.recentActivities[0]!

    expect(compact.distanceKm).toBe(5.2)
    expect(compact.durationSeconds).toBe(1310)
    expect(compact.paceSecPerKm).toBe(250)
    expect(compact).not.toHaveProperty('performance')
    expect(compact).not.toHaveProperty('garmin')
  })

  it('keeps interval execution semantics untouched and exposes real race laps separately', () => {
    const activity = escher()

    expect(sessionExecution(activity)).toBeNull()
    expect(raceExecution(activity)).toEqual({
      fullLaps: [
        { distanceMeters: 1000, durationSeconds: 236, paceSecPerKm: 236, avgHr: 191 },
        { distanceMeters: 1000, durationSeconds: 245, paceSecPerKm: 245, avgHr: 196 },
        { distanceMeters: 1000, durationSeconds: 249, paceSecPerKm: 249, avgHr: 199 },
        { distanceMeters: 1000, durationSeconds: 253, paceSecPerKm: 253, avgHr: 197 },
        { distanceMeters: 1000, durationSeconds: 255, paceSecPerKm: 255, avgHr: 198 },
      ],
      partialLap: {
        distanceMeters: 248.6,
        durationSeconds: 72,
        paceSecPerKm: 290,
        avgHr: 199,
      },
      trend: {
        firstFullLapPaceSecPerKm: 236,
        lastFullLapPaceSecPerKm: 255,
        positiveSplitSecondsPerKm: 19,
      },
    })
  })
})
