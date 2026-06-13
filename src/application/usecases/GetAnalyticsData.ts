import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import type { Activity, ActivityType } from '@/domain/activity/types'

const EASY_TYPES: ActivityType[] = ['Base']

export interface MonthlyVolume {
  month: string
  label: string
  sessionCount: number
  totalKm: number
  byType: Partial<Record<ActivityType, number>>
}

export interface MonthlyPace {
  month: string
  label: string
  easyPace: number | null
  hardPace: number | null
}

export interface MonthlyEfficiency {
  month: string
  label: string
  ef: number | null
}

export interface MonthlyHr {
  month: string
  label: string
  avgHr: number | null
}

export interface MonthlyCadence {
  month: string
  label: string
  cadence: number | null
}

export interface MonthlyLongRuns {
  month: string
  label: string
  km10: number
  km15: number
}

export interface MonthlyEasyHard {
  month: string
  label: string
  easyPct: number | null
  hardPct: number | null
}

export interface ZoneShare {
  zone: number
  seconds: number
  percent: number
}

export interface YearTotals {
  distanceKm: number
  durationSeconds: number
  sessionCount: number
  elevationM: number
  avgKmPerWeek: number
  calories: number
  caloriesPerWeek: number
}

export interface YearAnalytics {
  year: number
  totals: YearTotals
  monthlyVolume: MonthlyVolume[]
  paceTrend: MonthlyPace[]
  efficiencyTrend: MonthlyEfficiency[]
  hrTrend: MonthlyHr[]
  cadenceTrend: MonthlyCadence[]
  longRuns: MonthlyLongRuns[]
  easyHardSplit: MonthlyEasyHard[]
  zoneDistribution: ZoneShare[]
  typesPresent: ActivityType[]
}

export interface AnalyticsPageData {
  years: number[]
  byYear: Record<number, YearAnalytics>
}

function monthLabel(month: number): string {
  return new Date(2000, month - 1, 1).toLocaleString('en', { month: 'short' }).toUpperCase()
}

function weightedPace(activities: Activity[]): number | null {
  const valid = activities.filter((a) => a.paceSecPerKm !== null && a.distanceKm > 0)
  if (!valid.length) return null
  const totalKm = valid.reduce((s, a) => s + a.distanceKm, 0)
  const totalSec = valid.reduce((s, a) => s + a.paceSecPerKm! * a.distanceKm, 0)
  return Math.round(totalSec / totalKm)
}

function weightedHr(activities: Activity[]): number | null {
  const valid = activities.filter((a) => a.avgHeartRate !== null && a.durationSeconds > 0)
  if (!valid.length) return null
  const totalSec = valid.reduce((s, a) => s + a.durationSeconds, 0)
  return Math.round(valid.reduce((s, a) => s + a.avgHeartRate! * a.durationSeconds, 0) / totalSec)
}

function zoneDistribution(activities: Activity[]): ZoneShare[] {
  const seconds = new Map<number, number>()
  for (const a of activities) {
    for (const z of a.hrZones) {
      seconds.set(z.zone, (seconds.get(z.zone) ?? 0) + z.seconds)
    }
  }
  const total = Array.from(seconds.values()).reduce((s, v) => s + v, 0)
  if (total === 0) return []
  return Array.from(seconds.entries())
    .sort(([a], [b]) => a - b)
    .map(([zone, secs]) => ({
      zone,
      seconds: secs,
      percent: Math.round((secs / total) * 1000) / 10,
    }))
}

function weightedCadence(activities: Activity[]): number | null {
  const valid = activities.filter((a) => a.cadenceSpm !== null && a.durationSeconds > 0)
  if (!valid.length) return null
  const totalSec = valid.reduce((s, a) => s + a.durationSeconds, 0)
  return (
    Math.round(
      (valid.reduce((s, a) => s + a.cadenceSpm! * a.durationSeconds, 0) / totalSec) * 10
    ) / 10
  )
}

function easyHardShare(activities: Activity[]): { easyPct: number | null; hardPct: number | null } {
  let easy = 0
  let total = 0
  for (const a of activities) {
    for (const z of a.hrZones) {
      total += z.seconds
      if (z.zone <= 2) easy += z.seconds
    }
  }
  if (total === 0) return { easyPct: null, hardPct: null }
  const easyPct = Math.round((easy / total) * 1000) / 10
  return { easyPct, hardPct: Math.round((100 - easyPct) * 10) / 10 }
}

function efficiencyFactor(activities: Activity[]): number | null {
  const valid = activities.filter(
    (a) => a.paceSecPerKm !== null && a.avgHeartRate !== null && a.distanceKm >= 3
  )
  if (!valid.length) return null
  const efs = valid.map((a) => (1000 / a.paceSecPerKm!) * 60 / a.avgHeartRate!)
  return Math.round((efs.reduce((s, v) => s + v, 0) / efs.length) * 100) / 100
}

function buildYearAnalytics(year: number, activities: Activity[], now: Date): YearAnalytics {
  const isCurrentYear = year === now.getFullYear()
  const lastMonth = isCurrentYear ? now.getMonth() + 1 : 12
  const months = Array.from({ length: lastMonth }, (_, i) => i + 1)

  const byMonth = new Map<number, Activity[]>()
  for (const a of activities) {
    const m = Number(a.date.slice(5, 7))
    const list = byMonth.get(m) ?? []
    list.push(a)
    byMonth.set(m, list)
  }

  const typesPresent = new Set<ActivityType>()

  const monthlyVolume: MonthlyVolume[] = months.map((m) => {
    const acts = byMonth.get(m) ?? []
    const byType: Partial<Record<ActivityType, number>> = {}
    for (const a of acts) {
      byType[a.type] = Math.round(((byType[a.type] ?? 0) + a.distanceKm) * 10) / 10
      typesPresent.add(a.type)
    }
    return {
      month: `${year}-${String(m).padStart(2, '0')}`,
      label: monthLabel(m),
      sessionCount: acts.length,
      totalKm: Math.round(acts.reduce((s, a) => s + a.distanceKm, 0) * 10) / 10,
      byType,
    }
  })

  const paceTrend: MonthlyPace[] = months.map((m) => {
    const acts = byMonth.get(m) ?? []
    return {
      month: `${year}-${String(m).padStart(2, '0')}`,
      label: monthLabel(m),
      easyPace: weightedPace(acts.filter((a) => EASY_TYPES.includes(a.type))),
      hardPace: weightedPace(acts.filter((a) => !EASY_TYPES.includes(a.type))),
    }
  })

  const efficiencyTrend: MonthlyEfficiency[] = months.map((m) => {
    const acts = byMonth.get(m) ?? []
    return {
      month: `${year}-${String(m).padStart(2, '0')}`,
      label: monthLabel(m),
      ef: efficiencyFactor(acts.filter((a) => EASY_TYPES.includes(a.type))),
    }
  })

  const hrTrend: MonthlyHr[] = months.map((m) => ({
    month: `${year}-${String(m).padStart(2, '0')}`,
    label: monthLabel(m),
    avgHr: weightedHr(byMonth.get(m) ?? []),
  }))

  const cadenceTrend: MonthlyCadence[] = months.map((m) => ({
    month: `${year}-${String(m).padStart(2, '0')}`,
    label: monthLabel(m),
    cadence: weightedCadence(byMonth.get(m) ?? []),
  }))

  const longRuns: MonthlyLongRuns[] = months.map((m) => {
    const acts = byMonth.get(m) ?? []
    return {
      month: `${year}-${String(m).padStart(2, '0')}`,
      label: monthLabel(m),
      km10: acts.filter((a) => a.distanceKm >= 10 && a.distanceKm < 15).length,
      km15: acts.filter((a) => a.distanceKm >= 15).length,
    }
  })

  const easyHardSplit: MonthlyEasyHard[] = months.map((m) => {
    const { easyPct, hardPct } = easyHardShare(byMonth.get(m) ?? [])
    return {
      month: `${year}-${String(m).padStart(2, '0')}`,
      label: monthLabel(m),
      easyPct,
      hardPct,
    }
  })

  const distanceKm = Math.round(activities.reduce((s, a) => s + a.distanceKm, 0) * 10) / 10
  const calories = activities.reduce((s, a) => s + (a.calories ?? 0), 0)
  const elapsedDays = isCurrentYear
    ? Math.floor((now.getTime() - new Date(year, 0, 1).getTime()) / 86400000) + 1
    : Math.floor((new Date(year + 1, 0, 1).getTime() - new Date(year, 0, 1).getTime()) / 86400000)

  return {
    year,
    totals: {
      distanceKm,
      durationSeconds: activities.reduce((s, a) => s + a.durationSeconds, 0),
      sessionCount: activities.length,
      elevationM: Math.round(activities.reduce((s, a) => s + (a.elevationGain ?? 0), 0)),
      avgKmPerWeek: Math.round((distanceKm / elapsedDays) * 7 * 10) / 10,
      calories,
      caloriesPerWeek: Math.round((calories / elapsedDays) * 7),
    },
    monthlyVolume,
    paceTrend,
    efficiencyTrend,
    hrTrend,
    cadenceTrend,
    longRuns,
    easyHardSplit,
    zoneDistribution: zoneDistribution(activities),
    typesPresent: Array.from(typesPresent),
  }
}

export function getAnalyticsData(): AnalyticsPageData {
  const all = getAllActivities()
  const now = new Date()

  const byYear = new Map<number, Activity[]>()
  for (const a of all) {
    const y = Number(a.date.slice(0, 4))
    const list = byYear.get(y) ?? []
    list.push(a)
    byYear.set(y, list)
  }

  const years = Array.from(byYear.keys()).sort((a, b) => b - a)

  return {
    years,
    byYear: Object.fromEntries(
      years.map((y) => [y, buildYearAnalytics(y, byYear.get(y)!, now)])
    ),
  }
}
