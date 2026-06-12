import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
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
    totalDistanceKm: Math.round(totalDistanceKm * 10) / 10,
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
      distanceKm: Math.round(distanceKm * 10) / 10,
      percent: total > 0 ? Math.round((distanceKm / total) * 100) : 0,
    }))
    .sort((a, b) => b.distanceKm - a.distanceKm)
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
      distanceKm: Math.round(acts.reduce((s, a) => s + a.distanceKm, 0) * 10) / 10,
      sessionCount: acts.length,
    }
  })

  const typeDistribution = buildTypeDistribution(all)

  return {
    currentWeek,
    lastWeek: {
      totalDistanceKm: lastWeekSummary.totalDistanceKm,
      sessionCount: lastWeekSummary.sessionCount,
    },
    weeklyVolume,
    typeDistribution,
    recentActivities: all.slice(0, 8),
  }
}
