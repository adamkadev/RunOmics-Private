import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { toActivitySummary } from '@/domain/activity/summary'
import { addDays, isoDate, isoWeekNumber, startOfWeek } from '@/lib/calendarDate'
import { round } from '@/lib/math'
import type {
  Activity,
  ActivityType,
  DashboardData,
  TypeDistribution,
  WeeklyVolume,
  WeekSummary,
} from '@/domain/activity/types'


const RECENT_ACTIVITY_COUNT = 8

export function buildWeekSummary(weekNumber: number, activities: Activity[]): WeekSummary {
  const totalDistanceKm = activities.reduce((s, a) => s + a.distanceKm, 0)
  const totalDurationSeconds = activities.reduce((s, a) => s + a.durationSeconds, 0)
  const hrs = activities.filter((a) => a.avgHeartRate !== null).map((a) => a.avgHeartRate!)
  const paces = activities.filter((a) => a.paceSecPerKm !== null).map((a) => a.paceSecPerKm!)

  return {
    weekNumber,
    totalDistanceKm: round(totalDistanceKm),
    totalDurationSeconds,
    sessionCount: activities.length,
    avgHeartRate: hrs.length ? Math.round(hrs.reduce((s, v) => s + v, 0) / hrs.length) : null,
    avgPaceSecPerKm: paces.length ? Math.round(paces.reduce((s, v) => s + v, 0) / paces.length) : null,
  }
}

export function buildTypeDistribution(activities: Activity[]): TypeDistribution[] {
  const total = activities.reduce((s, a) => s + a.distanceKm, 0)
  const map = new Map<ActivityType, { count: number; distanceKm: number }>()

  for (const a of activities) {
    const entry = map.get(a.type) ?? { count: 0, distanceKm: 0 }
    map.set(a.type, { count: entry.count + 1, distanceKm: entry.distanceKm + a.distanceKm })
  }

  return Array.from(map.entries())
    .map(([type, { count, distanceKm }]) => ({
      type,
      count,
      distanceKm: round(distanceKm),
      percent: total > 0 ? Math.round((distanceKm / total) * 100) : 0,
    }))
    .sort((a, b) => b.distanceKm - a.distanceKm)
}

export function computeStreaks(activities: Activity[]): { current: number; longest: number } {
  const dateSet = new Set(activities.map((a) => a.date.slice(0, 10)))

  // Local date components, not toISOString() - the latter converts to UTC and
  // shifts local midnight back a calendar day in UTC+ timezones, undercounting streaks.
  function fmt(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // A rest day today does not break the streak: fall back to counting from yesterday.
  let current = 0
  const cursor = new Date(today)
  while (dateSet.has(fmt(cursor))) {
    current++
    cursor.setDate(cursor.getDate() - 1)
  }
  if (current === 0) {
    cursor.setDate(cursor.getDate() - 1) // cursor is already today-1 after while loop miss
    while (dateSet.has(fmt(cursor))) {
      current++
      cursor.setDate(cursor.getDate() - 1)
    }
  }

  const sortedDays = Array.from(dateSet).sort()
  let longest = 0
  let run = 0
  let prev: string | null = null
  for (const day of sortedDays) {
    if (prev) {
      const diff = Math.round(
        (new Date(day).getTime() - new Date(prev).getTime()) / 86400000
      )
      run = diff === 1 ? run + 1 : 1
    } else {
      run = 1
    }
    if (run > longest) longest = run
    prev = day
  }

  return { current, longest }
}

/** Whether each day (Mon..Sun) of the week containing `now` has an activity. */
export function computeWeekActivityDays(activities: Activity[], now: Date): boolean[] {
  const dateSet = new Set(activities.map((a) => a.date.slice(0, 10)))
  const monday = startOfWeek(now)
  return Array.from({ length: 7 }, (_, i) => dateSet.has(isoDate(addDays(monday, i))))
}

export function getDashboardData(): DashboardData {
  const all = getAllActivities()

  const byWeek = new Map<number, Activity[]>()
  for (const a of all) {
    const w = a.week
    const list = byWeek.get(w) ?? []
    list.push(a)
    byWeek.set(w, list)
  }

  const todayWeekNum = isoWeekNumber(new Date())
  if (!byWeek.has(todayWeekNum)) byWeek.set(todayWeekNum, [])

  const sortedWeeks = Array.from(byWeek.keys()).sort((a, b) => a - b)
  const weeks = sortedWeeks.map((w) => buildWeekSummary(w, byWeek.get(w)!))

  // weeks is non-empty: today's week is always seeded into byWeek above.
  const currentWeek = weeks[weeks.length - 1]!
  const lastWeekSummary = weeks[weeks.length - 2] ?? currentWeek

  const weeklyVolume: WeeklyVolume[] = sortedWeeks.slice(-12).map((w) => {
    const acts = byWeek.get(w)!
    return {
      week: w,
      year: Math.floor(w / 100),
      label: `W${w % 100}`,
      distanceKm: round(acts.reduce((s, a) => s + a.distanceKm, 0)),
      sessionCount: acts.length,
    }
  })

  const typeDistribution = buildTypeDistribution(all)
  const streaks = computeStreaks(all)

  return {
    currentWeek,
    lastWeek: {
      totalDistanceKm: lastWeekSummary.totalDistanceKm,
      sessionCount: lastWeekSummary.sessionCount,
    },
    weeks,
    weeklyVolume,
    typeDistribution,
    recentActivities: all.slice(0, RECENT_ACTIVITY_COUNT).map(toActivitySummary),
    currentStreak: streaks.current,
    longestStreak: streaks.longest,
  }
}
