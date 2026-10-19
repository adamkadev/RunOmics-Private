import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  computeProjection,
  computeYearOutcome,
  computeNextRaceSpotlight, nextRaceAcrossYears,
  computeMonthlyGoals,
} from '../GetGoalsData'
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
    const activities = Array.from({ length: 12 }, () => act('2024-06-01', 40))
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
    const activities = Array.from({ length: 12 }, () => act('2024-06-20', 34.4))
    const result = computeProjection(activities, 2024, 100, goal(1000))
    expect(result?.status).toBe('on_track')
  })

  // v4.6: the app's one weekly average - the last 12 complete weeks, the
  // week under way (from Monday Jul 1) left out.
  it('reads the rate over the last 12 complete weeks only', () => {
    const old = act('2024-04-07', 1000)
    const thisWeek = act('2024-07-01', 1000)
    const counted = act('2024-04-08', 120)
    const result = computeProjection([old, thisWeek, counted], 2024, 100, goal(2000))
    expect(result?.weeklyRate).toBe(10)
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

describe('nextRaceAcrossYears', () => {
  it('finds the next race in a later year when this one has none left', () => {
    const years = [
      { year: 2026, races: [race({ date: '2026-03-16', name: 'Spring 5K' })] },
      { year: 2027, races: [race({ date: '2027-04-25', name: 'City Marathon', distance: 'Marathon' })] },
    ]
    const result = nextRaceAcrossYears(years, 2026, [], '2026-10-18')
    expect(result?.race.name).toBe('City Marathon')
    expect(result?.daysUntil).toBe(189)
  })

  it('takes the earliest across years, and ignores years already past', () => {
    const years = [
      { year: 2025, races: [race({ date: '2025-12-31', name: 'Old' })] },
      { year: 2027, races: [race({ date: '2027-02-01', name: 'Later' })] },
      { year: 2026, races: [race({ date: '2026-11-08', name: 'Sooner' })] },
    ]
    expect(nextRaceAcrossYears(years, 2026, [], '2026-10-18')?.race.name).toBe('Sooner')
    expect(nextRaceAcrossYears([], 2026, [], '2026-10-18')).toBeNull()
  })
})

describe('computeMonthlyGoals', () => {
  beforeEach(() => {
    vi.setSystemTime(new Date('2024-09-16T12:00:00'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('carries a pro-rata target for the month still being run', () => {
    const months = computeMonthlyGoals([act('2024-09-05', 58)], 2024, goal(2000))
    const september = months[8]!

    expect(september.progress).not.toBeNull()
    expect(september.progress!.daysElapsed).toBe(16)
    expect(september.progress!.daysInMonth).toBe(30)
    expect(september.progress!.proRataTargetKm).toBeLessThan(september.targetKm)
    expect(Math.round(september.progress!.proRataTargetKm)).toBe(89)
  })

  // 3.1: one target line on the chart, so one target for every month.
  it('asks a twelfth of the year of every month', () => {
    const months = computeMonthlyGoals([], 2024, goal(2000))
    expect(new Set(months.map((mg) => mg.targetKm))).toEqual(new Set([166.7]))
  })

  it('leaves finished and future months with nothing to pro-rate', () => {
    const months = computeMonthlyGoals([act('2024-08-05', 100)], 2024, goal(2000))

    expect(months[7]!.progress).toBeNull()
    expect(months[9]!.progress).toBeNull()
    expect(months[9]!.status).toBe('pending')
  })
})

describe('computeMonthlyGoals across a DST boundary', () => {
  beforeEach(() => {
    vi.setSystemTime(new Date('2024-03-20T12:00:00'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('counts whole days in a month that loses an hour', () => {
    const march = computeMonthlyGoals([act('2024-03-02', 40)], 2024, goal(2000))[2]!

    expect(march.progress!.daysInMonth).toBe(31)
    expect(march.progress!.daysElapsed).toBe(20)
  })
})
