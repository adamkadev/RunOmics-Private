import type { Activity } from '@/domain/activity/types'
import { yearDistanceKm } from '@/domain/activity/distance'
import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { getUpcomingRaceYears } from '@/infrastructure/repositories/JsonUpcomingRaceRepository'
import { getGoalYears } from '@/infrastructure/repositories/JsonGoalRepository'
import { getPbYears } from '@/infrastructure/repositories/JsonPbRepository'
import { getGarminRacePredictions } from './GetGarminRacePredictions'
import { DISTANCE_KEY, getRecords } from './GetRecords'
import { RACE_DISTANCES, type RaceDistanceKey } from '@/domain/race/distances'
import { addDays, startOfWeek } from '@/lib/calendarDate'
import { round } from '@/lib/math'

export interface PbEntry {
  distance: string
  seconds: number
  activityId: string
}

export interface PbYear {
  year: number
  entries: PbEntry[]
}

export interface GoalTarget {
  distance: string
  targetSeconds: number | null
}

export interface GoalYear {
  year: number
  annualDistanceKm: number
  targets: GoalTarget[]
}

export interface UpcomingRace {
  date: string
  name: string
  distance: string
  location?: string
  targetSeconds?: number | null
}

export interface UpcomingRaceYear {
  year: number
  races: UpcomingRace[]
}

export interface PbData {
  entry: PbEntry
  activity: Activity
}

export interface GoalProjection {
  weeklyRate: number
  weeklyNeeded: number
  projectedYearKm: number
  status: 'ahead' | 'on_track' | 'behind'
  deltaKm: number
}

export interface MonthGoal {
  month: number
  targetKm: number
  actualKm: number
  status: 'ahead' | 'on_track' | 'behind' | 'pending'
}

export interface NextRaceSpotlight {
  race: UpcomingRace
  daysUntil: number
  predictedSeconds: number | null
  gapSeconds: number | null
  prSeconds: number | null
  prDate: string | null
}

/** A distance's predicted finish time, sourced from Garmin's own race predictor. */
export interface GoalRacePrediction {
  key: RaceDistanceKey
  predictedSeconds: number
  actualSeconds: number | null
  actualDate: string | null
}

export interface YearData {
  year: number
  totalDistanceKm: number
  goals: GoalYear | null
  pbs: PbData[]
  upcomingRaces: UpcomingRace[]
  projection: GoalProjection | null
  monthlyGoals: MonthGoal[]
  nextRaceSpotlight: NextRaceSpotlight | null
  predictions: GoalRacePrediction[]
}

export interface GoalTargetOutcome {
  distance: string
  targetSeconds: number | null
  pbSeconds: number | null
  achieved: boolean | null
}

export interface YearOutcome {
  year: number
  annualGoal: { targetKm: number; actualKm: number; achieved: boolean } | null
  targets: GoalTargetOutcome[]
}

export interface GoalsPageData {
  years: number[]
  byYear: Record<number, YearData>
  history: YearOutcome[]
}

export function computeProjection(
  activities: Activity[],
  year: number,
  totalDistanceKm: number,
  goals: GoalYear,
): GoalProjection | null {
  const goal = goals.annualDistanceKm
  if (goal <= 0 || totalDistanceKm >= goal) return null

  const now = new Date()
  const yearStart = new Date(year, 0, 1)
  const yearEnd = new Date(year + 1, 0, 1)
  const weeksElapsed = (now.getTime() - yearStart.getTime()) / (7 * 86_400_000)
  const remainingWeeks = (yearEnd.getTime() - now.getTime()) / (7 * 86_400_000)

  if (weeksElapsed < 4 || remainingWeeks <= 0) return null

  // Rolling 8-week rate: uses all activities (not filtered by year) for cross-year accuracy
  const cutoff = new Date(now.getTime() - 56 * 86_400_000)
  const recentKm = activities
    .filter((a) => new Date(a.date + 'T00:00:00') >= cutoff)
    .reduce((s, a) => s + a.distanceKm, 0)
  const weeklyRate = round(recentKm / 8, 1)

  const weeklyNeeded = round((goal - totalDistanceKm) / remainingWeeks, 1)
  const projectedYearKm = Math.round(totalDistanceKm + weeklyRate * remainingWeeks)
  const deltaKm = Math.abs(projectedYearKm - goal)

  const status: GoalProjection['status'] =
    weeklyRate > weeklyNeeded * 1.1 ? 'ahead' :
    weeklyRate < weeklyNeeded * 0.9 ? 'behind' : 'on_track'

  return { weeklyRate, weeklyNeeded, projectedYearKm, status, deltaKm }
}

// Each month's target is the annual goal pro-rated by its share of days in the year.
// Months are independent: a missed month does not raise the target for the next one.
export function computeMonthlyGoals(activities: Activity[], year: number, goals: GoalYear): MonthGoal[] {
  const annualKm = goals.annualDistanceKm
  const now = new Date()
  const daysInYear = (new Date(year + 1, 0, 1).getTime() - new Date(year, 0, 1).getTime()) / 86_400_000

  return Array.from({ length: 12 }, (_, i) => {
    const month = i + 1
    const monthStart = new Date(year, month - 1, 1)
    const monthEnd = new Date(year, month, 1)
    const daysInMonth = (monthEnd.getTime() - monthStart.getTime()) / 86_400_000
    const targetKm = round((annualKm * daysInMonth) / daysInYear, 1)

    const actualKm = round(
      activities
        .filter((a) => {
          const d = new Date(a.date + 'T00:00:00')
          return d >= monthStart && d < monthEnd
        })
        .reduce((s, a) => s + a.distanceKm, 0),
      1
    )

    let status: MonthGoal['status']
    if (monthStart > now) {
      status = 'pending'
    } else if (monthEnd <= now) {
      status = actualKm >= targetKm ? 'ahead' : 'behind'
    } else {
      const expectedFraction = (now.getTime() - monthStart.getTime()) / 86_400_000 / daysInMonth
      const actualFraction = targetKm > 0 ? actualKm / targetKm : 0
      status =
        actualFraction > expectedFraction * 1.1 ? 'ahead' :
        actualFraction < expectedFraction * 0.9 ? 'behind' : 'on_track'
    }

    return { month, targetKm, actualKm, status }
  })
}

export function computeNextRaceSpotlight(
  upcomingRaces: UpcomingRace[],
  predictions: GoalRacePrediction[],
  today: string,
): NextRaceSpotlight | null {
  const race = upcomingRaces.find((r) => r.date >= today)
  if (!race) return null

  const daysUntil = Math.round(
    (new Date(race.date + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime()) / 86_400_000
  )

  const predictionKey = DISTANCE_KEY[race.distance]
  const prediction = predictionKey ? predictions.find((p) => p.key === predictionKey) ?? null : null

  // Never predict slower than a PR already proven at this exact distance -
  // Garmin's model can undershoot when its own recent form estimate lags a fresh PR.
  const predictedSeconds =
    prediction?.predictedSeconds != null && prediction.actualSeconds != null
      ? Math.min(prediction.predictedSeconds, prediction.actualSeconds)
      : prediction?.predictedSeconds ?? null

  const gapSeconds =
    predictedSeconds !== null && race.targetSeconds ? predictedSeconds - race.targetSeconds : null

  return {
    race,
    daysUntil,
    predictedSeconds,
    gapSeconds,
    prSeconds: prediction?.actualSeconds ?? null,
    prDate: prediction?.actualDate ?? null,
  }
}

export function computeYearOutcome(yearData: YearData): YearOutcome | null {
  const { year, goals, totalDistanceKm, pbs } = yearData
  if (!goals) return null

  const annualGoal = goals.annualDistanceKm > 0
    ? {
        targetKm: goals.annualDistanceKm,
        actualKm: totalDistanceKm,
        achieved: totalDistanceKm >= goals.annualDistanceKm,
      }
    : null

  const targets: GoalTargetOutcome[] = goals.targets.map((target) => {
    const pbSeconds = pbs.find((p) => p.entry.distance === target.distance)?.entry.seconds ?? null
    const achieved =
      target.targetSeconds !== null && pbSeconds !== null ? pbSeconds <= target.targetSeconds : null
    return { distance: target.distance, targetSeconds: target.targetSeconds, pbSeconds, achieved }
  })

  return { year, annualGoal, targets }
}

export interface WeeklyGoal {
  targetKm: number
  actualKm: number
}

export function computeWeeklyGoal(activities: Activity[], year: number, goals: GoalYear, now = new Date()): WeeklyGoal | null {
  if (goals.annualDistanceKm <= 0) return null

  const daysInYear = (new Date(year + 1, 0, 1).getTime() - new Date(year, 0, 1).getTime()) / 86_400_000
  const targetKm = round((goals.annualDistanceKm * 7) / daysInYear, 1)

  const weekStart = startOfWeek(now)
  const weekEnd = addDays(weekStart, 7)
  const actualKm = round(
    activities
      .filter((a) => {
        const d = new Date(a.date + 'T00:00:00')
        return d >= weekStart && d < weekEnd
      })
      .reduce((s, a) => s + a.distanceKm, 0),
    1
  )

  return { targetKm, actualKm }
}

/** The current week's distance goal, prorated from the current year's annual target - null if no goal is set. */
export async function getCurrentWeeklyGoal(): Promise<WeeklyGoal | null> {
  const year = new Date().getFullYear()
  const goalYears = getGoalYears()
  const goals = goalYears.find((g) => g.year === year)
  if (!goals) return null
  return computeWeeklyGoal(getAllActivities(), year, goals)
}

// Garmin's `latest` finish-time estimate per distance, paired with the athlete's own
// PR at that distance (for the "never predict slower than a proven PR" cap below).
async function getGoalPredictions(): Promise<GoalRacePrediction[]> {
  const garmin = getGarminRacePredictions()
  if (!garmin) return []

  const records = await getRecords()
  const recordByKey = new Map(records.map((r) => [r.key, r]))

  return RACE_DISTANCES.filter((key) => garmin.latest[key] != null).map((key) => {
    const record = recordByKey.get(key)
    return {
      key,
      predictedSeconds: garmin.latest[key]!,
      actualSeconds: record?.seconds ?? null,
      actualDate: record?.date ?? null,
    }
  })
}

export async function getGoalsPageData(): Promise<GoalsPageData> {
  const activities = getAllActivities()
  const upcomingRaceYears = getUpcomingRaceYears()
  const goalYears = getGoalYears()
  const pbYears = getPbYears()
  const predictions = await getGoalPredictions()

  const activityMap = new Map(activities.map((a) => [a.id, a]))

  const allYears = Array.from(
    new Set([
      ...goalYears.map((g) => g.year),
      ...pbYears.map((p) => p.year),
      ...upcomingRaceYears.map((u) => u.year),
    ])
  ).sort((a, b) => b - a)

  const currentYear = new Date().getFullYear()
  const today = new Date().toISOString().slice(0, 10)
  const byYear: Record<number, YearData> = {}

  for (const year of allYears) {
    const goals = goalYears.find((g) => g.year === year) ?? null
    const pbYear = pbYears.find((p) => p.year === year)
    const upcomingRaces = (upcomingRaceYears.find((u) => u.year === year)?.races ?? [])
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))

    const pbs: PbData[] = (pbYear?.entries ?? [])
      .map((entry) => {
        const activity = activityMap.get(entry.activityId)
        if (!activity) return null
        return { entry, activity }
      })
      .filter((x): x is PbData => x !== null)

    const rawYearKm = activities
      .filter((a) => a.date.startsWith(String(year)))
      .reduce((sum, a) => sum + a.distanceKm, 0)
    // Displayed / compared value uses the shared whole-km selector so Goals
    // matches Progress and Analytics; the projection keeps the raw sum.
    const totalDistanceKm = yearDistanceKm(activities, year)

    const projection =
      year === currentYear && goals
        ? computeProjection(activities, year, rawYearKm, goals)
        : null

    const monthlyGoals = goals ? computeMonthlyGoals(activities, year, goals) : []

    const nextRaceSpotlight =
      year === currentYear ? computeNextRaceSpotlight(upcomingRaces, predictions, today) : null

    byYear[year] = {
      year,
      totalDistanceKm,
      goals,
      pbs,
      upcomingRaces,
      projection,
      monthlyGoals,
      nextRaceSpotlight,
      predictions: year === currentYear ? predictions : [],
    }
  }

  const history = allYears
    .filter((year) => year < currentYear)
    .map((year) => {
      const data = byYear[year]
      return data ? computeYearOutcome(data) : null
    })
    .filter((outcome): outcome is YearOutcome => outcome !== null)

  return { years: allYears, byYear, history }
}
