import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { computeProjection, computeYearOutcome, computeNextRaceSpotlight } from '../GetGoalsData'
import type { Activity } from '@/domain/activity/types'
import type { GoalYear, YearData, UpcomingRace, GoalRacePrediction } from '../GetGoalsData'

const act = (date: string, km: number): Activity => ({ date, distanceKm: km }) as Activity

const goal = (annualDistanceKm: number): GoalYear => ({ year: 2024, annualDistanceKm, targets: [] })

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
    vi.setSystemTime(new Date('2024-01-15T00:00:00'))
    expect(computeProjection([], 2024, 0, goal(1000))).toBeNull()
  })

  it('returns null for a past year with no remaining weeks', () => {
    expect(computeProjection([], 2023, 0, goal(1000))).toBeNull()
  })

  it('projects ahead when the recent weekly rate beats what is needed by >10%', () => {
    const activities = Array.from({ length: 8 }, () => act('2024-06-01', 40))
    const result = computeProjection(activities, 2024, 500, goal(800))
    expect(result?.weeklyRate).toBe(40)
    expect(result?.status).toBe('ahead')
  })

  it('marks status behind when the weekly rate is well under what is needed', () => {
    const result = computeProjection([], 2024, 100, goal(2000))
    expect(result?.weeklyRate).toBe(0)
    expect(result?.status).toBe('behind')
  })

  it('marks status on_track when the rate roughly matches what is needed', () => {
    const activities = Array.from({ length: 8 }, () => act('2024-06-20', 34.4))
    const result = computeProjection(activities, 2024, 100, goal(1000))
    expect(result?.status).toBe('on_track')
  })

  it('only counts activities within the last 8 weeks for the rate', () => {
    const old = act('2023-01-01', 1000)
    const result = computeProjection([old], 2024, 100, goal(2000))
    expect(result?.weeklyRate).toBe(0)
  })
})

const yearData = (overrides: Partial<YearData> = {}): YearData => ({
  year: 2024,
  totalDistanceKm: 0,
  goals: null,
  pbs: [],
  upcomingRaces: [],
  projection: null,
  monthlyGoals: [],
  nextRaceSpotlight: null,
  predictions: [],
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
        pbs: [{ entry: { distance: '10K', seconds: 2300, activityId: 'a1' }, activity: {} as Activity }],
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
        pbs: [{ entry: { distance: '10K', seconds: 2500, activityId: 'a1' }, activity: {} as Activity }],
      })
    )
    expect(outcome?.targets[0]?.achieved).toBe(false)
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

const race = (overrides: Partial<UpcomingRace> = {}): UpcomingRace => ({
  date: '2024-09-05',
  name: 'Kulturlaf',
  distance: '5K',
  targetSeconds: 1200,
  ...overrides,
})

const prediction = (overrides: Partial<GoalRacePrediction> = {}): GoalRacePrediction => ({
  key: '5k',
  predictedSeconds: 1290,
  actualSeconds: null,
  actualDate: null,
  ...overrides,
})

describe('computeNextRaceSpotlight', () => {
  it('returns null when there are no races on or after today', () => {
    expect(computeNextRaceSpotlight([race({ date: '2024-01-01' })], [], '2024-07-01')).toBeNull()
  })

  it('picks the earliest race on or after today', () => {
    const races = [race({ date: '2024-06-01', name: 'Old' }), race({ date: '2024-09-05', name: 'Kulturlaf' })]
    const result = computeNextRaceSpotlight(races, [], '2024-07-01')
    expect(result?.race.name).toBe('Kulturlaf')
    expect(result?.daysUntil).toBe(66)
  })

  it('matches the prediction by distance and computes the gap vs the target', () => {
    const result = computeNextRaceSpotlight([race({ targetSeconds: 1200 })], [prediction({ predictedSeconds: 1290 })], '2024-07-01')
    expect(result?.predictedSeconds).toBe(1290)
    expect(result?.gapSeconds).toBe(90)
  })

  it('leaves predictedSeconds/gapSeconds null when no prediction matches the distance', () => {
    const result = computeNextRaceSpotlight([race({ distance: 'Marathon' })], [prediction()], '2024-07-01')
    expect(result?.predictedSeconds).toBeNull()
    expect(result?.gapSeconds).toBeNull()
  })

  it('leaves gapSeconds null when the race has no target time', () => {
    const result = computeNextRaceSpotlight([race({ targetSeconds: null })], [prediction()], '2024-07-01')
    expect(result?.predictedSeconds).toBe(1290)
    expect(result?.gapSeconds).toBeNull()
  })

  it('caps predictedSeconds at the PR already set at that distance', () => {
    const result = computeNextRaceSpotlight(
      [race({ targetSeconds: 1200 })],
      [prediction({ predictedSeconds: 1291, actualSeconds: 1238, actualDate: '2024-05-16' })],
      '2024-07-01'
    )
    expect(result?.predictedSeconds).toBe(1238)
    expect(result?.gapSeconds).toBe(38)
    expect(result?.prSeconds).toBe(1238)
    expect(result?.prDate).toBe('2024-05-16')
  })

  it('leaves predictedSeconds uncapped when it is already faster than the PR', () => {
    const result = computeNextRaceSpotlight(
      [race({ targetSeconds: 1200 })],
      [prediction({ predictedSeconds: 1210, actualSeconds: 1238, actualDate: '2024-05-16' })],
      '2024-07-01'
    )
    expect(result?.predictedSeconds).toBe(1210)
  })
})
