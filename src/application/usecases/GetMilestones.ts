import type { Activity } from '@/domain/activity/types'
import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { getRecords } from './GetRecords'
import { isoWeekNumber, startOfWeek, addDays, isoDate } from '@/lib/calendarDate'
import { formatDuration } from '@/lib/formatters'
import { t } from '@/i18n'

const DISTANCE_TIERS_KM = [500, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 5000]
const MIN_STREAK_WEEKS = 8
const MAX_STREAK_WEEKS_TO_CHECK = 208 // 4 years

export type MilestoneType = 'distance-tier' | 'streak' | 'record'

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

export interface WeekStreak {
  weeks: number
  startDate: string
}

/** Consecutive weeks (counting back from `now`) with at least one activity. Null if the current week is inactive. */
export function currentWeekStreak(activities: Activity[], now: Date): WeekStreak | null {
  const activeWeeks = new Set(activities.map((a) => a.week))
  let weeks = 0
  let cursor = now

  while (weeks < MAX_STREAK_WEEKS_TO_CHECK && activeWeeks.has(isoWeekNumber(cursor))) {
    weeks++
    cursor = addDays(cursor, -7)
  }
  if (weeks === 0) return null

  const streakStartWeek = addDays(cursor, 7)
  return { weeks, startDate: isoDate(startOfWeek(streakStartWeek)) }
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
