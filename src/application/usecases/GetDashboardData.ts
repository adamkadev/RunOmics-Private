import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { round } from '@/lib/math'
import type {
  Activity,
  ActivityType,
  DashboardData,
  TypeDistribution,
  WeeklyVolume,
  WeekSummary,
} from '@/domain/activity/types'


function buildWeekSummary(weekNumber: number, activities: Activity[]): WeekSummary {
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
    activities: activities,
  }
}

function buildTypeDistribution(activities: Activity[]): TypeDistribution[] {
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

function computeStreaks(activities: Activity[]): { current: number; longest: number } {
  const dateSet = new Set(activities.map((a) => a.date.slice(0, 10)))

  function fmt(d: Date) {
    return d.toISOString().slice(0, 10)
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Current streak - count back from today, or from yesterday if today is rest
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

  // Longest streak over all history
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

export function getDashboardData(): DashboardData {
  const all = getAllActivities()

  const byWeek = new Map<number, Activity[]>()
  for (const a of all) {
    const w = a.week
    const list = byWeek.get(w) ?? []
    list.push(a)
    byWeek.set(w, list)
  }

  const sortedWeeks = Array.from(byWeek.keys()).sort((a, b) => a - b)
  const latestWeek = sortedWeeks[sortedWeeks.length - 1]
  const prevWeek = sortedWeeks[sortedWeeks.length - 2]

  const currentWeekActivities = byWeek.get(latestWeek) ?? []
  const lastWeekActivities = byWeek.get(prevWeek) ?? []

  const currentWeek = buildWeekSummary(latestWeek, currentWeekActivities)
  const lastWeekSummary = buildWeekSummary(prevWeek ?? latestWeek, lastWeekActivities)

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
    weeklyVolume,
    typeDistribution,
    recentActivities: all.slice(0, 8),
    currentStreak: streaks.current,
    longestStreak: streaks.longest,
  }
}
