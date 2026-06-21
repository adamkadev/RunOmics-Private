import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import { computeProjection, computeYearOutcome, eventPhotoPath } from '../GetGoalsData'
import type { Activity } from '@/domain/activity/types'
import type { GoalYear, YearData } from '../GetGoalsData'

const act = (date: string, km: number): Activity => ({ date, distanceKm: km }) as Activity

const goal = (annualDistanceKm: number): GoalYear => ({ year: 2024, annualDistanceKm, targets: [] })

// ---------- eventPhotoPath ----------

describe('eventPhotoPath', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns null when no photo exists for any extension', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false)
    expect(eventPhotoPath('12345')).toBeNull()
  })

  it('returns the public path for the first matching extension', () => {
    vi.spyOn(fs, 'existsSync').mockImplementation((p) => String(p).endsWith('12345.png'))
    expect(eventPhotoPath('12345')).toBe('/events/12345.png')
  })

  it('prefers jpg over later extensions when both exist', () => {
    vi.spyOn(fs, 'existsSync').mockImplementation(
      (p) => String(p).endsWith('12345.jpg') || String(p).endsWith('12345.png')
    )
    expect(eventPhotoPath('12345')).toBe('/events/12345.jpg')
  })
})

// ---------- computeProjection ----------

describe('computeProjection', () => {
  beforeEach(() => {
    vi.setSystemTime(new Date('2024-07-01T00:00:00'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns null when the goal is already reached', () => {
    expect(computeProjection([], 2024, 1000, goal(1000))).toBeNull()
    expect(computeProjection([], 2024, 1500, goal(1000))).toBeNull()
  })

  it('returns null when the goal is zero or negative', () => {
    expect(computeProjection([], 2024, 0, goal(0))).toBeNull()
  })

  it('returns null before 4 weeks have elapsed in the year', () => {
    vi.setSystemTime(new Date('2024-01-15T00:00:00')) // ~2 weeks in
    expect(computeProjection([], 2024, 0, goal(1000))).toBeNull()
  })

  it('returns null for a past year with no remaining weeks', () => {
    expect(computeProjection([], 2023, 0, goal(1000))).toBeNull()
  })

  it('projects ahead when the recent weekly rate beats what is needed by >10%', () => {
    // 8 activities @ 40km within the 56-day cutoff → weeklyRate = 320/8 = 40
    // remaining goal = 300km over ~26.3 weeks → weeklyNeeded ≈ 11.4, well under 40
    const activities = Array.from({ length: 8 }, () => act('2024-06-01', 40))
    const result = computeProjection(activities, 2024, 500, goal(800))
    expect(result?.weeklyRate).toBe(40)
    expect(result?.status).toBe('ahead')
  })

  it('marks status behind when the weekly rate is well under what is needed', () => {
    // No recent activity at all → weeklyRate = 0, goal still far away
    const result = computeProjection([], 2024, 100, goal(2000))
    expect(result?.weeklyRate).toBe(0)
    expect(result?.status).toBe('behind')
  })

  it('marks status on_track when the rate roughly matches what is needed', () => {
    // remainingWeeks from 2024-07-01 to 2025-01-01 ≈ 26.14
    // need (1000-100)/26.14 ≈ 34.4 km/week; provide ~34.4 km/week over last 8 weeks
    const activities = Array.from({ length: 8 }, () => act('2024-06-20', 34.4))
    const result = computeProjection(activities, 2024, 100, goal(1000))
    expect(result?.status).toBe('on_track')
  })

  it('only counts activities within the last 8 weeks for the rate', () => {
    const old = act('2023-01-01', 1000) // way outside the 56-day cutoff
    const result = computeProjection([old], 2024, 100, goal(2000))
    expect(result?.weeklyRate).toBe(0)
  })
})

// ---------- computeYearOutcome ----------

const yearData = (overrides: Partial<YearData> = {}): YearData => ({
  year: 2024,
  totalDistanceKm: 0,
  goals: null,
  pbs: [],
  upcomingRaces: [],
  projection: null,
  monthlyGoals: [],
  ...overrides,
})

describe('computeYearOutcome', () => {
  it('returns null when the year has no goals set', () => {
    expect(computeYearOutcome(yearData({ goals: null }))).toBeNull()
  })

  it('marks the annual goal as achieved when total km meets or exceeds the target', () => {
    const outcome = computeYearOutcome(
      yearData({ totalDistanceKm: 1200, goals: { year: 2024, annualDistanceKm: 1000, targets: [] } })
    )
    expect(outcome?.annualGoal).toEqual({ targetKm: 1000, actualKm: 1200, achieved: true })
  })

  it('marks the annual goal as missed when total km falls short of the target', () => {
    const outcome = computeYearOutcome(
      yearData({ totalDistanceKm: 800, goals: { year: 2024, annualDistanceKm: 1000, targets: [] } })
    )
    expect(outcome?.annualGoal?.achieved).toBe(false)
  })

  it('returns a null annualGoal when no annual distance is set', () => {
    const outcome = computeYearOutcome(
      yearData({ goals: { year: 2024, annualDistanceKm: 0, targets: [] } })
    )
    expect(outcome?.annualGoal).toBeNull()
  })

  it('marks a race target as achieved when a PB beats the target time', () => {
    const outcome = computeYearOutcome(
      yearData({
        goals: { year: 2024, annualDistanceKm: 0, targets: [{ distance: '10K', targetSeconds: 2400 }] },
        pbs: [{ entry: { distance: '10K', seconds: 2300, activityId: 'a1' }, activity: {} as Activity, photoPath: null }],
      })
    )
    expect(outcome?.targets).toEqual([
      { distance: '10K', targetSeconds: 2400, pbSeconds: 2300, achieved: true },
    ])
  })

  it('marks a race target as missed when the PB is slower than the target', () => {
    const outcome = computeYearOutcome(
      yearData({
        goals: { year: 2024, annualDistanceKm: 0, targets: [{ distance: '10K', targetSeconds: 2400 }] },
        pbs: [{ entry: { distance: '10K', seconds: 2500, activityId: 'a1' }, activity: {} as Activity, photoPath: null }],
      })
    )
    expect(outcome?.targets[0].achieved).toBe(false)
  })

  it('leaves a race target unresolved when there is no PB for it', () => {
    const outcome = computeYearOutcome(
      yearData({
        goals: { year: 2024, annualDistanceKm: 0, targets: [{ distance: '10K', targetSeconds: 2400 }] },
      })
    )
    expect(outcome?.targets[0]).toEqual({ distance: '10K', targetSeconds: 2400, pbSeconds: null, achieved: null })
  })
})
