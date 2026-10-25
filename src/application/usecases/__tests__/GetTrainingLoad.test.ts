import { describe, it, expect } from 'vitest'
import { buildTimeSeries, trimp } from '../GetTrainingLoad'
import type { Activity } from '@/domain/activity/types'

const act = (hr: number | null, durationSeconds: number): Activity =>
  ({ avgHeartRate: hr, durationSeconds }) as Activity

describe('trimp', () => {
  it('returns 0 when no heart rate', () => {
    expect(trimp(act(null, 3600))).toBe(0)
  })

  it('returns 0 when no duration', () => {
    expect(trimp(act(150, 0))).toBe(0)
  })

  it('calculates correctly at moderate intensity (HR 120, 60 min)', () => {
    expect(trimp(act(120, 3600))).toBeCloseTo(50.1, 0)
  })

  it('calculates correctly at high intensity (HR 165, 60 min)', () => {
    expect(trimp(act(165, 3600))).toBeCloseTo(142.8, 0)
  })

  it('clamps hrr to 0 when HR below resting (HR 30)', () => {
    expect(trimp(act(30, 3600))).toBe(0)
  })

  it('clamps hrr to 1 when HR above max (HR 220)', () => {
    expect(trimp(act(220, 3600))).toBeCloseTo(261.9, 0)
  })

  it('scales linearly with duration', () => {
    const half = trimp(act(120, 1800))
    const full = trimp(act(120, 3600))
    expect(full).toBeCloseTo(half * 2, 5)
  })
})

describe('buildTimeSeries', () => {
  it('is worked out once per activity list, bounds and day', () => {
    const activities = [{ date: '2026-01-05', avgHeartRate: 150, durationSeconds: 3600 }] as Activity[]
    const series = buildTimeSeries(activities)

    expect(buildTimeSeries(activities)).toBe(series)
    expect(buildTimeSeries(activities, { maxHr: 190, restingHr: 50 })).not.toBe(series)
    expect(buildTimeSeries([...activities])).not.toBe(series)
  })
})
