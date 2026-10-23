import type { Activity } from '@/domain/activity/types'
import { yearDistanceKm } from '@/domain/activity/distance'
import { getPlannedWorkouts } from './GetPlannedWorkouts'
import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { getUpcomingRaceYears } from '@/infrastructure/repositories/JsonUpcomingRaceRepository'
import { getGoalYears } from '@/infrastructure/repositories/JsonGoalRepository'
import { getPbYears } from '@/infrastructure/repositories/JsonPbRepository'
import { getGarminRacePredictions } from './GetGarminRacePredictions'
import { DISTANCE_KEY, getRecords } from './GetRecords'
import { RACE_DISTANCES, type RaceDistanceKey } from '@/domain/race/distances'
import { DAY_MS, addDays, appTodayIso, isoDate, startOfWeek } from '@/lib/calendarDate'
import { weeklyAverageKm } from '@/domain/training/weeklyAverage'
import { round } from '@/lib/math'
import type { PbEntry, GoalYear, UpcomingRace } from '@/domain/goals/types'

export type { PbEntry, PbYear, GoalTarget, GoalYear, UpcomingRace, UpcomingRaceYear } from '@/domain/goals/types'

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

export interface MonthProgress {
  daysElapsed: number
  daysInMonth: number
  proRataTargetKm: number
}

export interface MonthGoal {
  month: number
  targetKm: number
  actualKm: number
  status: 'ahead' | 'on_track' | 'behind' | 'pending'
  progress: MonthProgress | null
}

export interface NextRaceSpotlight {
  race: UpcomingRace
  daysUntil: number
  predictedSeconds: number | null
  gapSeconds: number | null
  prSeconds: number | null
  prDate: string | null
}

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
  /** The next race in any year; each year's own spotlight only sees that year's races. */
  nextRace: NextRaceSpotlight | null
}

export function computeProjection(
  activities: Activity[],
  year: number,
  totalDistanceKm: number,
  goals: GoalYear,
  now = new Date(),
): GoalProjection | null {
  const goal = goals.annualDistanceKm
  if (goal <= 0 || totalDistanceKm >= goal) return null

  const yearStart = new Date(year, 0, 1)
  const yearEnd = new Date(year + 1, 0, 1)
  const weeksElapsed = (now.getTime() - yearStart.getTime()) / (7 * DAY_MS)
  const remainingWeeks = (yearEnd.getTime() - now.getTime()) / (7 * DAY_MS)

  if (weeksElapsed < 4 || remainingWeeks <= 0) return null

  const weeklyRate = weeklyAverageKm(activities, isoDate(now))

  const weeklyNeeded = round((goal - totalDistanceKm) / remainingWeeks, 1)
  const projectedYearKm = Math.round(totalDistanceKm + weeklyRate * remainingWeeks)
  const deltaKm = Math.abs(projectedYearKm - goal)

  const status: GoalProjection['status'] =
    weeklyRate > weeklyNeeded * 1.1 ? 'ahead' :
    weeklyRate < weeklyNeeded * 0.9 ? 'behind' : 'on_track'

  return { weeklyRate, weeklyNeeded, projectedYearKm, status, deltaKm }
}

/** Planned km by "YYYY-MM" month. */
export type PlannedKmByMonth = ReadonlyMap<string, number>

export function plannedKmByMonth(planned: readonly { date: string; distanceM?: number }[]): PlannedKmByMonth {
  const byMonth = new Map<string, number>()
  for (const p of planned) {
    if (!p.distanceM) continue
    const key = p.date.slice(0, 7)
    byMonth.set(key, (byMonth.get(key) ?? 0) + p.distanceM / 1000)
  }
  return new Map([...byMonth].map(([key, km]) => [key, round(km, 1)]))
}

export function computeMonthlyGoals(
  activities: Activity[],
  year: number,
  goals: GoalYear,
  now = new Date(),
  planned: PlannedKmByMonth = new Map(),
): MonthGoal[] {
  // A month's target is what the plan asks of it, so Goals and Plan agree; a
  // month the plan does not cover keeps a twelfth of the year.
  const evenShare = round(goals.annualDistanceKm / 12, 1)

  return Array.from({ length: 12 }, (_, i) => {
    const month = i + 1
    const targetKm = planned.get(`${year}-${String(month).padStart(2, '0')}`) ?? evenShare
    const monthStart = new Date(year, month - 1, 1)
    const monthEnd = new Date(year, month, 1)
    const daysInMonth = Math.round((monthEnd.getTime() - monthStart.getTime()) / DAY_MS)

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
    let progress: MonthProgress | null = null
    if (monthStart > now) {
      status = 'pending'
    } else if (monthEnd <= now) {
      status = actualKm >= targetKm ? 'ahead' : 'behind'
    } else {
      const daysElapsed = now.getDate()
      const expectedFraction = daysElapsed / daysInMonth
      const actualFraction = targetKm > 0 ? actualKm / targetKm : 0
      status =
        actualFraction > expectedFraction * 1.1 ? 'ahead' :
        actualFraction < expectedFraction * 0.9 ? 'behind' : 'on_track'
      progress = {
        daysElapsed,
        daysInMonth,
        proRataTargetKm: round(targetKm * expectedFraction, 1),
      }
    }

    return { month, targetKm, actualKm, status, progress }
  })
}

export function nextRaceAcrossYears(
  upcomingRaceYears: readonly { year: number; races: UpcomingRace[] }[],
  currentYear: number,
  predictions: GoalRacePrediction[],
  today: string,
): NextRaceSpotlight | null {
  const races = upcomingRaceYears
    .filter((u) => u.year >= currentYear)
    .flatMap((u) => u.races)
    .sort((a, b) => a.date.localeCompare(b.date))
  return computeNextRaceSpotlight(races, predictions, today)
}

export function computeNextRaceSpotlight(
  upcomingRaces: UpcomingRace[],
  predictions: GoalRacePrediction[],
  today: string,
): NextRaceSpotlight | null {
  const race = upcomingRaces.find((r) => r.date >= today)
  if (!race) return null

  const daysUntil = Math.round(
    (new Date(race.date + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime()) / DAY_MS
  )

  const predictionKey = DISTANCE_KEY[race.distance]
  const prediction = predictionKey ? predictions.find((p) => p.key === predictionKey) ?? null : null

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

  const daysInYear = (new Date(year + 1, 0, 1).getTime() - new Date(year, 0, 1).getTime()) / DAY_MS
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

export async function getCurrentWeeklyGoal(today: string = appTodayIso()): Promise<WeeklyGoal | null> {
  const now = new Date(`${today}T12:00:00`)
  const year = now.getFullYear()
  const goalYears = getGoalYears()
  const goals = goalYears.find((g) => g.year === year)
  if (!goals) return null
  return computeWeeklyGoal(getAllActivities(), year, goals, now)
}

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

export async function getGoalsPageData(today: string = appTodayIso()): Promise<GoalsPageData> {
  const activities = getAllActivities()
  const upcomingRaceYears = getUpcomingRaceYears()
  const goalYears = getGoalYears()
  const pbYears = getPbYears()
  const predictions = await getGoalPredictions()
  const plannedByMonth = plannedKmByMonth(await getPlannedWorkouts())

  const activityMap = new Map(activities.map((a) => [a.id, a]))

  const allYears = Array.from(
    new Set([
      ...goalYears.map((g) => g.year),
      ...pbYears.map((p) => p.year),
      ...upcomingRaceYears.map((u) => u.year),
    ])
  ).sort((a, b) => b - a)

  const now = new Date(`${today}T12:00:00`)
  const currentYear = now.getFullYear()
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
    const totalDistanceKm = yearDistanceKm(activities, year)

    const projection =
      year === currentYear && goals
        ? computeProjection(activities, year, rawYearKm, goals, now)
        : null

    const monthlyGoals = goals ? computeMonthlyGoals(activities, year, goals, now, plannedByMonth) : []

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

  const nextRace = nextRaceAcrossYears(upcomingRaceYears, currentYear, predictions, today)

  return { years: allYears, byYear, history, nextRace }
}
