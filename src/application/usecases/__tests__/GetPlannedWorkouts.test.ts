import { describe, it, expect } from 'vitest'
import { buildTypeLoadStats, estimatePlannedLoad } from '../GetPlannedWorkouts'
import type { Activity, PlannedWorkout } from '@/domain/activity/types'

// Fixed HR bounds so trimp() math is deterministic regardless of athlete profile.
const HR_BOUNDS = { maxHr: 190, restingHr: 50 }

const act = (type: Activity['type'], durationSeconds: number, distanceKm: number, avgHeartRate = 150): Activity =>
  ({ type, durationSeconds, distanceKm, avgHeartRate, date: '2026-01-01' }) as Activity

describe('buildTypeLoadStats', () => {
  it('groups trimp/minute, pace and avg duration by type', () => {
    const activities = [
      act('Base', 1800, 5),
      act('Base', 3600, 10),
      act('Threshold', 1200, 4),
    ]
    const { byType } = buildTypeLoadStats(activities, HR_BOUNDS)

    expect(byType.Base).toBeDefined()
    expect(byType.Base?.avgDurationMinutes).toBe(45)
    expect(byType.Base?.paceSecPerKm).toBeCloseTo((1800 + 3600) / 15, 5)
    expect(byType.Threshold).toBeDefined()
    expect(byType.Threshold?.avgDurationMinutes).toBe(20)
  })

  it('ignores activities without a duration', () => {
    const activities = [act('Base', 0, 5)]
    const { byType } = buildTypeLoadStats(activities, HR_BOUNDS)
    expect(byType.Base).toBeUndefined()
  })

  it('falls back to a flat default when there is no history at all', () => {
    const { overall } = buildTypeLoadStats([], HR_BOUNDS)
    expect(overall.trimpPerMinute).toBe(0)
    expect(overall.avgDurationMinutes).toBe(40)
  })

  it('computes a non-zero overall fallback from all activities regardless of type', () => {
    const activities = [act('Base', 1800, 5), act('Threshold', 1200, 4)]
    const { overall } = buildTypeLoadStats(activities, HR_BOUNDS)
    expect(overall.trimpPerMinute).toBeGreaterThan(0)
  })
})

describe('estimatePlannedLoad', () => {
  const byType = {
    Base: { trimpPerMinute: 2, paceSecPerKm: 300, avgDurationMinutes: 45 },
  }
  const overall = { trimpPerMinute: 1, paceSecPerKm: 280, avgDurationMinutes: 40 }

  const plan = (over: Partial<PlannedWorkout>): PlannedWorkout => ({ date: '2026-07-01', name: 'test', ...over })

  it('uses durationSecs directly when present', () => {
    const w = estimatePlannedLoad(plan({ type: 'Base', durationSecs: 1800 }), byType, overall)
    expect(w.estimatedLoad).toBe(60)
    expect(w.isEstimated).toBe(true)
  })

  it('derives duration from distance and the type pace when durationSecs is absent', () => {
    const w = estimatePlannedLoad(plan({ type: 'Base', distanceM: 5000 }), byType, overall)
    expect(w.estimatedLoad).toBe(50)
  })

  it('falls back to the type average duration with neither distance nor duration', () => {
    const w = estimatePlannedLoad(plan({ type: 'Base' }), byType, overall)
    expect(w.estimatedLoad).toBe(90)
  })

  it('falls back to overall stats for an unknown/untracked type', () => {
    const w = estimatePlannedLoad(plan({ type: 'Race' }), byType, overall)
    expect(w.estimatedLoad).toBe(40)
  })
})
