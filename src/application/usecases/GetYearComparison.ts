import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { round } from '@/lib/math'

export interface YearMetrics {
  year: number
  distanceKm: number
  sessionCount: number
  durationSeconds: number
  avgKmPerWeek: number
  avgPaceSecPerKm: number | null
  avgHeartRate: number | null
  elevationM: number
}

export interface YearComparisonData {
  years: [number, number]   // [newer, older]
  newer: YearMetrics
  older: YearMetrics
}

export function avgWeightedPace(activities: ReturnType<typeof getAllActivities>): number | null {
  const valid = activities.filter((a) => a.paceSecPerKm != null && a.distanceKm > 0)
  if (!valid.length) return null
  const totalKm = valid.reduce((s, a) => s + a.distanceKm, 0)
  const totalSec = valid.reduce((s, a) => s + a.paceSecPerKm! * a.distanceKm, 0)
  return Math.round(totalSec / totalKm)
}

export function avgWeightedHR(activities: ReturnType<typeof getAllActivities>): number | null {
  const valid = activities.filter((a) => a.avgHeartRate != null && a.durationSeconds > 0)
  if (!valid.length) return null
  const totalDur = valid.reduce((s, a) => s + a.durationSeconds, 0)
  const totalHR = valid.reduce((s, a) => s + a.avgHeartRate! * a.durationSeconds, 0)
  return Math.round(totalHR / totalDur)
}

export function buildMetrics(year: number, activities: ReturnType<typeof getAllActivities>): YearMetrics {
  const distanceKm = activities.reduce((s, a) => s + a.distanceKm, 0)
  const durationSeconds = activities.reduce((s, a) => s + a.durationSeconds, 0)
  const elevationM = activities.reduce((s, a) => s + (a.elevationGain ?? 0), 0)

  const weeks = new Set(activities.map((a) => a.week)).size
  const avgKmPerWeek = weeks > 0 ? round(distanceKm / weeks) : 0

  return {
    year,
    distanceKm: round(distanceKm),
    sessionCount: activities.length,
    durationSeconds: Math.round(durationSeconds),
    avgKmPerWeek,
    avgPaceSecPerKm: avgWeightedPace(activities),
    avgHeartRate: avgWeightedHR(activities),
    elevationM: Math.round(elevationM),
  }
}

export function getYearComparison(): YearComparisonData | null {
  const all = getAllActivities()

  const byYear = new Map<number, typeof all>()
  for (const a of all) {
    const y = Number(a.date.slice(0, 4))
    byYear.set(y, [...(byYear.get(y) ?? []), a])
  }

  const years = Array.from(byYear.keys()).sort((a, b) => b - a)
  const [newer, older] = years
  if (newer === undefined || older === undefined) return null

  return {
    years: [newer, older],
    newer: buildMetrics(newer, byYear.get(newer)!),
    older: buildMetrics(older, byYear.get(older)!),
  }
}
