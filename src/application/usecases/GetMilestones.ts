import type { Activity } from '@/domain/activity/types'
import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { getAllPlannedWorkouts } from '@/infrastructure/repositories/JsonPlannedWorkoutRepository'
import { getRecords } from './GetRecords'
import { computeWeekActivityDays } from './GetDashboardData'
import { DAY_MS, isoWeekNumber, startOfWeek, addDays, appTodayIso, isoDate } from '@/lib/calendarDate'
import { formatDistance, formatDuration, formatKm } from '@/lib/formatters'
import { t } from '@/i18n'
import { WEEKLY_RUN_TARGET } from '@/domain/training/weeklyRunTarget'

const DISTANCE_TIERS_KM = [500, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 5000]
const MIN_STREAK_WEEKS = 8
const MAX_STREAK_WEEKS_TO_CHECK = 208

const LIFETIME_DISTANCE_TIERS_KM = [500, 1000, 1500, 2000, 3000, 4000, 5000, 7500, 10_000, 15_000, 20_000, 30_000, 40_075]
const EARTH_CIRCUMFERENCE_KM = 40_075
const MARATHON_KM = 42.195

const ACTIVITY_COUNT_TIERS = [25, 50, 100, 150, 200, 250, 300, 400, 500, 750, 1000]

export type MilestoneType = 'distance-tier' | 'streak' | 'record' | 'lifetime-distance' | 'activity-count' | 'first-activity'

export interface Milestone {
  type: MilestoneType
  date: string
  label: string
  detail?: string
}

export interface DistanceTierCrossing {
  year: number
  tierKm: number
  date: string
}

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

function weeksWith<T>(activities: Activity[], key: (a: Activity) => T, minRuns: number): Set<T> {
  const counts = new Map<T, number>()
  for (const a of activities) counts.set(key(a), (counts.get(key(a)) ?? 0) + 1)
  return new Set([...counts].filter(([, runs]) => runs >= minRuns).map(([week]) => week))
}

/** A week under way that has not reached `minRuns` yet carries the streak from the week before. */
export function currentWeekStreak(activities: Activity[], now: Date, minRuns = 1): WeekStreak | null {
  const activeWeeks = weeksWith(activities, (a) => a.week, minRuns)
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

export function longestWeekStreak(activities: Activity[], minRuns = 1): number {
  const weekStarts = weeksWith(activities, (a) => isoDate(startOfWeek(new Date(a.date + 'T00:00:00'))), minRuns)
  const sorted = Array.from(weekStarts).sort()

  let longest = 0
  let run = 0
  let prev: string | null = null
  for (const day of sorted) {
    const diffDays = prev ? Math.round((new Date(day + 'T00:00:00').getTime() - new Date(prev + 'T00:00:00').getTime()) / DAY_MS) : null
    run = diffDays === 7 ? run + 1 : 1
    if (run > longest) longest = run
    prev = day
  }
  return longest
}

export interface WeeklyStreakData {
  currentWeeks: number
  longestWeeks: number
  weekDays: boolean[]
  plannedDays: boolean[]
}

export function computeWeekPlannedDays(planned: { date: string }[], now: Date): boolean[] {
  const dateSet = new Set(planned.map((w) => w.date.slice(0, 10)))
  const monday = startOfWeek(now)
  return Array.from({ length: 7 }, (_, i) => dateSet.has(isoDate(addDays(monday, i))))
}

/**
 * The streak Today, the Progress hub and Consistency count. The milestone's
 * own streak stays a run every week, as its copy says.
 */
export function getWeeklyStreakData(now = new Date(`${appTodayIso()}T12:00:00`)): WeeklyStreakData | null {
  const activities = getAllActivities()
  if (!activities.length) return null
  const streak = currentWeekStreak(activities, now, WEEKLY_RUN_TARGET)
  return {
    currentWeeks: streak?.weeks ?? 0,
    longestWeeks: longestWeekStreak(activities, WEEKLY_RUN_TARGET),
    weekDays: computeWeekActivityDays(activities, now),
    plannedDays: computeWeekPlannedDays(getAllPlannedWorkouts(), now),
  }
}

export interface NextMilestone {
  kind: 'activity-count' | 'distance-tier'
  label: string
  /** What is left, in the milestone's own unit: runs or km. */
  remaining: number
  /** 0-1, measured from zero rather than from the last tier. */
  progress: number
}

export function findNextMilestones(
  activitiesAscByDate: { date: string; distanceKm: number }[],
  year: number,
  countTiers: number[] = ACTIVITY_COUNT_TIERS,
  distanceTiers: number[] = DISTANCE_TIERS_KM,
): NextMilestone[] {
  const next: NextMilestone[] = []

  const count = activitiesAscByDate.length
  const countTier = countTiers.find((tier) => tier > count)
  if (countTier !== undefined) {
    next.push({
      kind: 'activity-count',
      label: t.profile.milestones.activityCount(countTier),
      remaining: countTier - count,
      progress: count / countTier,
    })
  }

  const yearKm = activitiesAscByDate
    .filter((a) => Number(a.date.slice(0, 4)) === year)
    .reduce((sum, a) => sum + a.distanceKm, 0)
  const distanceTier = distanceTiers.find((tier) => tier > yearKm)
  if (distanceTier !== undefined) {
    next.push({
      kind: 'distance-tier',
      label: t.profile.milestones.distanceTier(formatKm(distanceTier)),
      // Rounded up: "0 to go" would be a milestone already passed.
      remaining: Math.ceil(distanceTier - yearKm),
      progress: yearKm / distanceTier,
    })
  }

  return next
}

export function getNextMilestones(today: string = appTodayIso()): NextMilestone[] {
  const ascending = [...getAllActivities()].sort((a, b) => a.date.localeCompare(b.date))
  return findNextMilestones(ascending, Number(today.slice(0, 4)))
}

export async function getMilestones(today: string = appTodayIso()): Promise<Milestone[]> {
  const activities = getAllActivities()
  const ascending = [...activities].sort((a, b) => a.date.localeCompare(b.date))

  const milestones: Milestone[] = []

  for (const crossing of findDistanceTierMilestones(ascending)) {
    milestones.push({
      type: 'distance-tier',
      date: crossing.date,
      label: t.profile.milestones.distanceTier(formatKm(crossing.tierKm)),
      // The month heading above says the year only when it is not this one.
      detail: String(crossing.year),
    })
  }

  if (ascending.length > 0) {
    const first = ascending[0] as Activity
    milestones.push({
      type: 'first-activity',
      date: first.date,
      label: t.profile.milestones.firstActivity,
      detail: t.profile.milestones.firstActivityDetail(formatKm(first.distanceKm, 1)),
    })
  }

  for (const crossing of findLifetimeDistanceMilestones(ascending)) {
    milestones.push({
      type: 'lifetime-distance',
      date: crossing.date,
      label: t.profile.milestones.lifetimeDistance(formatKm(crossing.tierKm)),
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
      detail: t.profile.milestones.activityCountDetail(formatKm(crossing.cumulativeKm)),
    })
  }

  const streak = currentWeekStreak(activities, new Date(`${today}T12:00:00`))
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
        // Longest Run is a distance record: its headline is how far, not how long.
        detail:
          r.distanceKm != null
            ? `${formatDistance(r.distanceKm)} ${t.units.km}`
            : formatDuration(r.seconds),
      })
    }
  }

  return milestones.sort((a, b) => b.date.localeCompare(a.date))
}
