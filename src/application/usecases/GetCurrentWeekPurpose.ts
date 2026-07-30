import { getActivitySummaries } from './GetActivities'
import { getPlannedWorkouts } from './GetPlannedWorkouts'
import { getTrainingPlan, type TrainingPlanPhase } from './GetTrainingPlan'
import { getAthleteProfile } from '@/infrastructure/repositories/JsonAthleteRepository'
import {
  compareWeekLoad,
  computeWeekAdherence,
  summarizePlannedWeek,
  summarizeWeek,
  weeklyTrimpTotals,
  type PlannedWeek,
  type WeekAdherence,
  type WeekLoadComparison,
} from '@/domain/training/weekSummary'
import { weekPlanPhase } from '@/domain/training/weekPlanPhase'
import type { ActivitySummary, ActivityType } from '@/domain/activity/types'
import type { HrBounds } from '@/domain/training/trimp'
import { addDays, isoDate, isoWeekNumber, startOfWeek } from '@/lib/calendarDate'
import { round } from '@/lib/math'

const TREND_WEEKS = 8

export interface RemainingSession {
  date: string
  name: string
  type: ActivityType | null
}

export interface CurrentWeekPurpose {
  weekStart: string
  planPhase: TrainingPlanPhase | null
  planned: PlannedWeek | null
  adherence: WeekAdherence | null
  comparison: WeekLoadComparison | null
  distanceKm: number
  sessions: number
  keySessions: number
  hardPct: number | null
  /** The sessions the plan still holds for the days left, in day order. */
  remaining: RemainingSession[]
}

/**
 * The running week as the plan banner reads it, computed server-side. WeekView
 * derives the same numbers for whichever week is being browsed; this covers the
 * one week worth spending a generated line on - the one the athlete is in.
 */
export async function getCurrentWeekPurpose(now = new Date()): Promise<CurrentWeekPurpose | null> {
  const activities = getActivitySummaries()
  if (!activities.length) return null

  const monday = startOfWeek(new Date(isoDate(now) + 'T00:00:00'))
  const days = Array.from({ length: 7 }, (_, i) => isoDate(addDays(monday, i)))

  const athlete = getAthleteProfile()
  const hrBounds: HrBounds | undefined =
    athlete.maxHrBpm && athlete.restingHrBpm
      ? { maxHr: athlete.maxHrBpm, restingHr: athlete.restingHrBpm }
      : undefined

  const byDate = new Map<string, ActivitySummary[]>()
  for (const activity of activities) {
    const list = byDate.get(activity.date) ?? []
    list.push(activity)
    byDate.set(activity.date, list)
  }

  const weekActivities = days.flatMap((date) => byDate.get(date) ?? [])
  const summary = summarizeWeek(weekActivities, hrBounds)

  const byWeekNumber = new Map<number, ActivitySummary[]>()
  for (const activity of activities) {
    const list = byWeekNumber.get(activity.week) ?? []
    list.push(activity)
    byWeekNumber.set(activity.week, list)
  }
  const trendWeeks = Array.from({ length: TREND_WEEKS }, (_, i) =>
    isoWeekNumber(addDays(monday, (i - (TREND_WEEKS - 1)) * 7))
  )
  const trendTotals = weeklyTrimpTotals(trendWeeks, byWeekNumber, hrBounds)

  const plannedWorkouts = await getPlannedWorkouts()
  const plannedByDate = new Set(plannedWorkouts.map((workout) => workout.date))
  const weekPlanned = plannedWorkouts.filter((workout) => days.includes(workout.date))

  return {
    weekStart: days[0]!,
    planPhase: weekPlanPhase(days, getTrainingPlan()?.ranges ?? []),
    planned: weekPlanned.length ? summarizePlannedWeek(weekPlanned.map((workout) => workout.type)) : null,
    adherence: computeWeekAdherence(
      days.map((date) => ({
        date,
        planned: plannedByDate.has(date),
        completed: (byDate.get(date)?.length ?? 0) > 0,
      }))
    ),
    comparison: compareWeekLoad(summary.totalTrimp, trendTotals.slice(0, -1)),
    distanceKm: round(weekActivities.reduce((sum, a) => sum + a.distanceKm, 0), 1),
    sessions: weekActivities.length,
    keySessions: summary.keySessionsCount,
    hardPct: summary.hardPct,
    remaining: weekPlanned
      .filter((workout) => workout.date >= isoDate(now) && !byDate.has(workout.date))
      .map((workout) => ({ date: workout.date, name: workout.name, type: workout.type ?? null })),
  }
}
