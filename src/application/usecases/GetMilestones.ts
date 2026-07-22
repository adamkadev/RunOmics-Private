import type { Activity } from '@/domain/activity/types'
import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { getAllPlannedWorkouts } from '@/infrastructure/repositories/JsonPlannedWorkoutRepository'
import { getRecords } from './GetRecords'
import { computeWeekActivityDays } from './GetDashboardData'
import { isoWeekNumber, startOfWeek, addDays, isoDate } from '@/lib/calendarDate'
import { formatDuration } from '@/lib/formatters'
import { t } from '@/i18n'

const DISTANCE_TIERS_KM = [500, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 5000]
const MIN_STREAK_WEEKS = 8
const MAX_STREAK_WEEKS_TO_CHECK = 208 // 4 years

// Never reset (unlike DISTANCE_TIERS_KM, which is per calendar year) - this
// is the "since day 1" lifetime odometer. Tops out at Earth's equatorial
// circumference, a fitting final tier for a distance that only ever grows.
const LIFETIME_DISTANCE_TIERS_KM = [500, 1000, 1500, 2000, 3000, 4000, 5000, 7500, 10_000, 15_000, 20_000, 30_000, 40_075]
const EARTH_CIRCUMFERENCE_KM = 40_075
const MARATHON_KM = 42.195

const ACTIVITY_COUNT_TIERS = [25, 50, 100, 150, 200, 250, 300, 400, 500, 750, 1000]

export type MilestoneType = 'distance-tier' | 'streak' | 'record' | 'lifetime-distance' | 'activity-count' | 'first-activity'

export interface Milestone {
  type: MilestoneType
  date: string
  label: string
  detail: string
}

export interface DistanceTierCrossing {
  year: number
  tierKm: number
  date: string
}

/** Annual cumulative distance tier crossings, in the order they happened. Resets each calendar year. */
export function findDistanceTierMilestones(
  activitiesAscByDate: { date: string; distanceKm: number }[],
  tiers: number[] = DISTANCE_TIERS_KM,
): DistanceTierCrossing[] {
  const results: DistanceTierCrossing[] = []
  let currentYear: number | null = null
  let cumulative = 0
  let tierIdx = 0

  for (const a of activitiesAscByDate) {
    const year = Number(a.date.slice(0, 4))
    if (year !== currentYear) {
      currentYear = year
      cumulative = 0
      tierIdx = 0
    }
    cumulative += a.distanceKm
    while (tierIdx < tiers.length && cumulative >= (tiers[tierIdx] as number)) {
      results.push({ year, tierKm: tiers[tierIdx] as number, date: a.date })
      tierIdx++
    }
  }

  return results
}

export interface LifetimeDistanceCrossing {
  tierKm: number
  date: string
  cumulativeKm: number
}

/** All-time cumulative distance tier crossings, in the order they happened. Unlike findDistanceTierMilestones, never resets. */
export function findLifetimeDistanceMilestones(
  activitiesAscByDate: { date: string; distanceKm: number }[],
  tiers: number[] = LIFETIME_DISTANCE_TIERS_KM,
): LifetimeDistanceCrossing[] {
  const results: LifetimeDistanceCrossing[] = []
  let cumulative = 0
  let tierIdx = 0

  for (const a of activitiesAscByDate) {
    cumulative += a.distanceKm
    while (tierIdx < tiers.length && cumulative >= (tiers[tierIdx] as number)) {
      results.push({ tierKm: tiers[tierIdx] as number, date: a.date, cumulativeKm: cumulative })
      tierIdx++
    }
  }

  return results
}

export interface ActivityCountCrossing {
  count: number
  date: string
  cumulativeKm: number
}

/** Every-Nth-session milestones ("100th run"), in the order they happened. */
export function findActivityCountMilestones(
  activitiesAscByDate: { date: string; distanceKm: number }[],
  tiers: number[] = ACTIVITY_COUNT_TIERS,
): ActivityCountCrossing[] {
  const results: ActivityCountCrossing[] = []
  let cumulative = 0
  let tierIdx = 0

  activitiesAscByDate.forEach((a, i) => {
    cumulative += a.distanceKm
    const count = i + 1
    if (tierIdx < tiers.length && count === tiers[tierIdx]) {
      results.push({ count, date: a.date, cumulativeKm: cumulative })
      tierIdx++
    }
  })

  return results
}

export interface WeekStreak {
  weeks: number
  startDate: string
}

export function currentWeekStreak(activities: Activity[], now: Date): WeekStreak | null {
  const activeWeeks = new Set(activities.map((a) => a.week))
  let cursor = activeWeeks.has(isoWeekNumber(now)) ? now : addDays(now, -7)

  let weeks = 0
  while (weeks < MAX_STREAK_WEEKS_TO_CHECK && activeWeeks.has(isoWeekNumber(cursor))) {
    weeks++
    cursor = addDays(cursor, -7)
  }
  if (weeks === 0) return null

  const streakStartWeek = addDays(cursor, 7)
  return { weeks, startDate: isoDate(startOfWeek(streakStartWeek)) }
}

export function longestWeekStreak(activities: Activity[]): number {
  const weekStarts = new Set(activities.map((a) => isoDate(startOfWeek(new Date(a.date + 'T00:00:00')))))
  const sorted = Array.from(weekStarts).sort()

  let longest = 0
  let run = 0
  let prev: string | null = null
  for (const day of sorted) {
    const diffDays = prev ? Math.round((new Date(day + 'T00:00:00').getTime() - new Date(prev + 'T00:00:00').getTime()) / 86_400_000) : null
    run = diffDays === 7 ? run + 1 : 1
    if (run > longest) longest = run
    prev = day
  }
  return longest
}

export interface WeeklyStreakData {
  currentWeeks: number
  longestWeeks: number
  weekDays: boolean[] // Mon..Sun
  plannedDays: boolean[] // Mon..Sun - a past day with no plan is rest, not missed
}

/** Days of the current week that carry a scheduled session (Mon..Sun). */
export function computeWeekPlannedDays(planned: { date: string }[], now: Date): boolean[] {
  const dateSet = new Set(planned.map((w) => w.date.slice(0, 10)))
  const monday = startOfWeek(now)
  return Array.from({ length: 7 }, (_, i) => dateSet.has(isoDate(addDays(monday, i))))
}

export function getWeeklyStreakData(now = new Date()): WeeklyStreakData | null {
  const activities = getAllActivities()
  if (!activities.length) return null
  const streak = currentWeekStreak(activities, now)
  return {
    currentWeeks: streak?.weeks ?? 0,
    longestWeeks: longestWeekStreak(activities),
    weekDays: computeWeekActivityDays(activities, now),
    plannedDays: computeWeekPlannedDays(getAllPlannedWorkouts(), now),
  }
}

export async function getMilestones(): Promise<Milestone[]> {
  const activities = getAllActivities() // newest first
  const ascending = [...activities].sort((a, b) => a.date.localeCompare(b.date))

  const milestones: Milestone[] = []

  for (const crossing of findDistanceTierMilestones(ascending)) {
    milestones.push({
      type: 'distance-tier',
      date: crossing.date,
      label: t.profile.milestones.distanceTier(crossing.tierKm),
      detail: t.profile.milestones.distanceTierDetail(crossing.year),
    })
  }

  if (ascending.length > 0) {
    const first = ascending[0] as Activity
    milestones.push({
      type: 'first-activity',
      date: first.date,
      label: t.profile.milestones.firstActivity,
      detail: t.profile.milestones.firstActivityDetail(first.distanceKm),
    })
  }

  for (const crossing of findLifetimeDistanceMilestones(ascending)) {
    milestones.push({
      type: 'lifetime-distance',
      date: crossing.date,
      label: t.profile.milestones.lifetimeDistance(crossing.tierKm),
      detail:
        crossing.tierKm >= EARTH_CIRCUMFERENCE_KM
          ? t.profile.milestones.lifetimeDistanceWorldTour
          : t.profile.milestones.lifetimeDistanceDetail(Math.round(crossing.cumulativeKm / MARATHON_KM)),
    })
  }

  for (const crossing of findActivityCountMilestones(ascending)) {
    milestones.push({
      type: 'activity-count',
      date: crossing.date,
      label: t.profile.milestones.activityCount(crossing.count),
      detail: t.profile.milestones.activityCountDetail(Math.round(crossing.cumulativeKm)),
    })
  }

  const streak = currentWeekStreak(activities, new Date())
  if (streak && streak.weeks >= MIN_STREAK_WEEKS) {
    milestones.push({
      type: 'streak',
      date: streak.startDate,
      label: t.profile.milestones.streak(streak.weeks),
      detail: t.profile.milestones.streakDetail,
    })
  }

  const records = await getRecords()
  for (const r of records) {
    if (r.date && r.seconds !== null) {
      milestones.push({
        type: 'record',
        date: r.date,
        label: t.profile.milestones.record(r.label),
        detail: formatDuration(r.seconds),
      })
    }
  }

  return milestones.sort((a, b) => b.date.localeCompare(a.date))
}
