import { describe, expect, it } from 'vitest'
import type { Activity } from '@/domain/activity/types'
import { activityDetailView, shareActivity } from '../activityViews'

const ACTIVITY = {
  id: '90000273',
  week: 202639,
  date: '2026-09-24',
  dayOfWeek: 'Thursday',
  type: 'Base',
  description: 'Morning run',
  comment: 'legs heavy after the flight',
  durationSeconds: 3000,
  distanceKm: 10,
  paceSecPerKm: 300,
  hrZones: [],
  avgHeartRate: 140,
  rpe: 3,
  polyline: 'encoded-route',
  route: [[6.1, 49.6], [6.2, 49.7]],
  elevationGain: 80,
  aerTrainingEffect: 2.8,
  anaTrainingEffect: 0.4,
  hrSamples: [130, 140],
  elevationProfile: [300, 310],
  calories: 640,
  cadenceSpm: 172,
  groundContactMs: 240,
  verticalOscillationMm: 82,
  verticalRatioPct: 7.4,
  strideLengthM: 1.1,
  bestEfforts: null,
  splits: null,
  paceSamples: [300, 298],
  vo2maxGarmin: 54,
  avgTemperature: 18,
  cadenceSamples: [170, 174],
  gearId: 'gear-1',
  weather: null,
} satisfies Activity

describe('activityDetailView', () => {
  it('leaves out what no client component on the page draws', () => {
    const view = activityDetailView(ACTIVITY)

    for (const key of ['polyline', 'comment', 'description', 'calories', 'gearId', 'vo2maxGarmin', 'avgTemperature', 'week']) {
      expect(view, key).not.toHaveProperty(key)
    }
  })

  it('keeps the map, the samples and the stats', () => {
    const view = activityDetailView(ACTIVITY)

    expect(view.route).toBe(ACTIVITY.route)
    expect(view.hrSamples).toBe(ACTIVITY.hrSamples)
    expect(view.distanceKm).toBe(10)
    expect(view.bestEfforts).toBeNull()
  })
})

describe('shareActivity', () => {
  it('carries the card, the pace stream its route is coloured by and the zone times, nothing else', () => {
    expect(Object.keys(shareActivity(ACTIVITY)).sort()).toEqual(
      ['avgHeartRate', 'date', 'dayOfWeek', 'description', 'distanceKm', 'durationSeconds', 'elevationGain', 'hrZones', 'id', 'paceSamples', 'paceSecPerKm', 'route'].sort()
    )
  })
})
