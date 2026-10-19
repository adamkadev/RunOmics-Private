import { describe, it, expect } from 'vitest'
import { buildWeekSummary, buildTypeDistribution, computeStreaks } from '../GetDashboardData'
import type { Activity } from '@/domain/activity/types'

const act = (overrides: Partial<Activity>): Activity =>
  ({
    distanceKm: 0,
    durationSeconds: 0,
    avgHeartRate: null,
    paceSecPerKm: null,
    type: 'Base',
    date: '2026-01-01',
    ...overrides,
  } as Activity)

describe('buildWeekSummary', () => {
  it('aggregates distance, duration and session count', () => {
    const summary = buildWeekSummary(202601, [
      act({ distanceKm: 10, durationSeconds: 3000 }),
      act({ distanceKm: 5, durationSeconds: 1500 }),
    ])
    expect(summary).toMatchObject({
      weekNumber: 202601,
      totalDistanceKm: 15,
      totalDurationSeconds: 4500,
      sessionCount: 2,
    })
  })

  it('averages HR and pace only over activities that have them', () => {
    const summary = buildWeekSummary(202601, [
      act({ avgHeartRate: 140, paceSecPerKm: 300 }),
      act({ avgHeartRate: null, paceSecPerKm: null }),
      act({ avgHeartRate: 160, paceSecPerKm: 320 }),
    ])
    expect(summary.avgHeartRate).toBe(150)
    expect(summary.avgPaceSecPerKm).toBe(310)
  })

  it('returns null averages when no activity has HR/pace', () => {
    const summary = buildWeekSummary(202601, [act({})])
    expect(summary.avgHeartRate).toBeNull()
    expect(summary.avgPaceSecPerKm).toBeNull()
  })
})

describe('buildTypeDistribution', () => {
  it('groups by type and sorts by distance descending', () => {
    const dist = buildTypeDistribution([
      act({ type: 'Base', distanceKm: 5 }),
      act({ type: 'Race', distanceKm: 20 }),
      act({ type: 'Base', distanceKm: 5 }),
    ])
    expect(dist[0]).toMatchObject({ type: 'Race', count: 1, distanceKm: 20, percent: 67 })
    expect(dist[1]).toMatchObject({ type: 'Base', count: 2, distanceKm: 10, percent: 33 })
  })

  it('returns an empty array with no activities', () => {
    expect(buildTypeDistribution([])).toEqual([])
  })
})

describe('computeStreaks', () => {
  const TODAY = '2026-07-20'
  const today = new Date(`${TODAY}T12:00:00`)
  const daysAgo = (n: number) => {
    const d = new Date(today)
    d.setDate(d.getDate() - n)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  it('counts the current streak back from today', () => {
    const activities = [act({ date: daysAgo(0) }), act({ date: daysAgo(1) }), act({ date: daysAgo(2) })]
    expect(computeStreaks(activities, TODAY).current).toBe(3)
  })

  it('still counts a streak ending yesterday if today is a rest day', () => {
    const activities = [act({ date: daysAgo(1) }), act({ date: daysAgo(2) })]
    expect(computeStreaks(activities, TODAY).current).toBe(2)
  })

  it('returns 0 current streak when the last activity was 2+ days ago', () => {
    const activities = [act({ date: daysAgo(3) })]
    expect(computeStreaks(activities, TODAY).current).toBe(0)
  })

  it('finds the longest streak across all history, not just the current one', () => {
    const activities = [
      act({ date: '2026-01-01' }),
      act({ date: '2026-01-02' }),
      act({ date: '2026-01-03' }),
      act({ date: '2026-01-04' }),
      act({ date: daysAgo(0) }),
    ]
    expect(computeStreaks(activities, TODAY).longest).toBe(4)
  })
})
