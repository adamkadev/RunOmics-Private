import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Activity } from '@/domain/activity/types'

const { getAllActivities } = vi.hoisted(() => ({ getAllActivities: vi.fn() }))
vi.mock('@/infrastructure/repositories/JsonActivityRepository', () => ({ getAllActivities }))

const { getActivities, getActivitySummaries } = await import('../GetActivities')

function activity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: 'a1',
    date: '2026-07-20',
    dayOfWeek: 'Monday',
    type: 'Base',
    description: 'Morning run',
    comment: 'legs ok',
    distanceKm: 10,
    durationSeconds: 3000,
    paceSecPerKm: 300,
    avgHeartRate: 150,
    rpe: 4,
    hrZones: [{ zone: 2, seconds: 3000 }],
    week: 202630,
    elevationGain: 40,
    route: [
      [2.3, 48.8],
      [2.31, 48.81],
    ],
    paceSamples: [300, 305],
    hrSamples: [148, 152],
    cadenceSamples: [170, 172],
    elevationProfile: [30, 32],
    splits: [{ km: 1 }],
    ...overrides,
  } as unknown as Activity
}

describe('getActivities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('hands back the repository list as it stands', () => {
    const activities = [activity({ id: 'a' }), activity({ id: 'b' })]
    getAllActivities.mockReturnValue(activities)

    expect(getActivities()).toBe(activities)
  })
})

describe('getActivitySummaries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('keeps every scalar the list rows read', () => {
    getAllActivities.mockReturnValue([activity()])

    expect(getActivitySummaries()[0]).toEqual({
      id: 'a1',
      date: '2026-07-20',
      dayOfWeek: 'Monday',
      type: 'Base',
      description: 'Morning run',
      comment: 'legs ok',
      distanceKm: 10,
      durationSeconds: 3000,
      paceSecPerKm: 300,
      avgHeartRate: 150,
      routeThumb: expect.any(String),
      zones: [0, 3000],
    })
  })

  it('leaves the per-sample arrays behind so they never cross to the client', () => {
    getAllActivities.mockReturnValue([activity()])
    const summary = getActivitySummaries()[0]!

    for (const key of ['route', 'paceSamples', 'hrSamples', 'cadenceSamples', 'elevationProfile', 'splits']) {
      expect(summary).not.toHaveProperty(key)
    }
  })

  it('maps every activity, in repository order', () => {
    getAllActivities.mockReturnValue([activity({ id: 'a' }), activity({ id: 'b' }), activity({ id: 'c' })])

    expect(getActivitySummaries().map((s) => s.id)).toEqual(['a', 'b', 'c'])
  })

  it('returns nothing when there is no history yet', () => {
    getAllActivities.mockReturnValue([])
    expect(getActivitySummaries()).toEqual([])
  })
})
