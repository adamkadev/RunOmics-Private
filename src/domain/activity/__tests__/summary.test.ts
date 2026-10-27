import { describe, it, expect } from 'vitest'
import { toActivitySummary } from '../summary'
import type { Activity } from '../types'

const HEAVY_FIELDS = [
  'route',
  'paceSamples',
  'hrSamples',
  'cadenceSamples',
  'elevationProfile',
  'splits',
  'bestEfforts',
] as const

const activity = {
  id: 'a1',
  date: '2026-07-20T08:00:00',
  dayOfWeek: 'Monday',
  type: 'Base',
  description: 'Morning run',
  comment: 'felt easy',
  distanceKm: 10.2,
  durationSeconds: 3000,
  paceSecPerKm: 294,
  avgHeartRate: 148,
  rpe: 4,
  hrZones: [{ zone: 2, seconds: 1800, percent: 60, minBpm: 120, maxBpm: 140 }],
  route: [[6.1, 49.6], [6.2, 49.7]],
  paceSamples: [300, 295],
  hrSamples: [140, 150],
  cadenceSamples: [170, 172],
  elevationProfile: [200, 210],
  splits: [],
  bestEfforts: { '5k': 1400 },
} as unknown as Activity

describe('toActivitySummary', () => {
  it('keeps the fields a list row renders', () => {
    expect(toActivitySummary(activity)).toEqual({
      id: 'a1',
      date: '2026-07-20T08:00:00',
      dayOfWeek: 'Monday',
      type: 'Base',
      description: 'Morning run',
      comment: 'felt easy',
      distanceKm: 10.2,
      durationSeconds: 3000,
      paceSecPerKm: 294,
      avgHeartRate: 148,
      routeThumb: expect.any(String),
      zones: [0, 1800],
    })
  })

  it.each(HEAVY_FIELDS)('drops %s, which must never cross to the client', (field) => {
    expect(toActivitySummary(activity)).not.toHaveProperty(field)
  })
})
