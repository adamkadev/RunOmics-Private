import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import type { Activity, ActivityType } from '@/domain/activity/types'
import { monthLabel } from '@/lib/formatters'
import { round } from '@/lib/math'

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

export interface DistanceBracket {
  label: string
  count: number
  km: number
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

export interface MonthlyRpe {
  month: string
  label: string
  avgRpe: number | null
}

export interface MonthlyTrainingEffect {
  month: string
  label: string
  aer: number | null
  ana: number | null
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
  distanceDistribution: DistanceBracket[]
  rpeTrend: MonthlyRpe[]
  trainingEffectTrend: MonthlyTrainingEffect[]
  typesPresent: ActivityType[]
}

export interface AnalyticsPageData {
  years: number[]
  byYear: Record<number, YearAnalytics>
}

// A value (possibly null) paired with a weight, averaged across activities.
function weightedAvg(
  activities: Activity[],
  value: (a: Activity) => number | null,
  weight: (a: Activity) => number,
  decimals = 1,
): number | null {
  let totalWeight = 0
  let weightedSum = 0
  for (const a of activities) {
    const v = value(a)
    const w = weight(a)
    if (v === null || w <= 0) continue
    totalWeight += w
    weightedSum += v * w
  }
  return totalWeight === 0 ? null : round(weightedSum / totalWeight, decimals)
}

// Simple mean of a (possibly null) field across activities; null when none present.
function avgField(activities: Activity[], pick: (a: Activity) => number | null): number | null {
  const vals = activities.map(pick).filter((v): v is number => v !== null)
  return vals.length ? round(vals.reduce((s, v) => s + v, 0) / vals.length) : null
}

const weightedPace = (acts: Activity[]) => weightedAvg(acts, (a) => a.paceSecPerKm, (a) => a.distanceKm, 0)
const weightedHr = (acts: Activity[]) => weightedAvg(acts, (a) => a.avgHeartRate, (a) => a.durationSeconds, 0)
const weightedCadence = (acts: Activity[]) => weightedAvg(acts, (a) => a.cadenceSpm, (a) => a.durationSeconds)

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
      percent: round((secs / total) * 100, 1),
    }))
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
  const easyPct = round((easy / total) * 100, 1)
  return { easyPct, hardPct: round(100 - easyPct) }
}

function efficiencyFactor(activities: Activity[]): number | null {
  const valid = activities.filter(
    (a) => a.paceSecPerKm !== null && a.avgHeartRate !== null && a.distanceKm >= 3
  )
  if (!valid.length) return null
  const efs = valid.map((a) => (1000 / a.paceSecPerKm!) * 60 / a.avgHeartRate!)
  return round((efs.reduce((s, v) => s + v, 0) / efs.length), 2)
}

const DISTANCE_BRACKETS = [
  { label: '< 5 km',   min: 0,  max: 5  },
  { label: '5–10 km',  min: 5,  max: 10 },
  { label: '10–15 km', min: 10, max: 15 },
  { label: '15–21 km', min: 15, max: 21 },
  { label: '21–42 km', min: 21, max: 42 },
  { label: '42+ km',   min: 42, max: Infinity },
]

function distanceDistribution(activities: Activity[]): DistanceBracket[] {
  return DISTANCE_BRACKETS
    .map(({ label, min, max }) => {
      const matching = activities.filter((a) => a.distanceKm >= min && a.distanceKm < max)
      return {
        label,
        count: matching.length,
        km: round(matching.reduce((s, a) => s + a.distanceKm, 0)),
      }
    })
    .filter((b) => b.count > 0)
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

  // Per-month series, all built in a single pass over the months.
  const monthlyVolume: MonthlyVolume[] = []
  const paceTrend: MonthlyPace[] = []
  const efficiencyTrend: MonthlyEfficiency[] = []
  const hrTrend: MonthlyHr[] = []
  const cadenceTrend: MonthlyCadence[] = []
  const longRuns: MonthlyLongRuns[] = []
  const easyHardSplit: MonthlyEasyHard[] = []
  const rpeTrend: MonthlyRpe[] = []
  const trainingEffectTrend: MonthlyTrainingEffect[] = []

  for (const m of months) {
    const acts = byMonth.get(m) ?? []
    const base = { month: `${year}-${String(m).padStart(2, '0')}`, label: monthLabel(m) }
    const easy = acts.filter((a) => EASY_TYPES.includes(a.type))
    const hard = acts.filter((a) => !EASY_TYPES.includes(a.type))

    const byType: Partial<Record<ActivityType, number>> = {}
    for (const a of acts) {
      byType[a.type] = round((byType[a.type] ?? 0) + a.distanceKm)
      typesPresent.add(a.type)
    }

    const { easyPct, hardPct } = easyHardShare(acts)

    monthlyVolume.push({ ...base, sessionCount: acts.length, totalKm: round(acts.reduce((s, a) => s + a.distanceKm, 0)), byType })
    paceTrend.push({ ...base, easyPace: weightedPace(easy), hardPace: weightedPace(hard) })
    efficiencyTrend.push({ ...base, ef: efficiencyFactor(easy) })
    hrTrend.push({ ...base, avgHr: weightedHr(acts) })
    cadenceTrend.push({ ...base, cadence: weightedCadence(acts) })
    longRuns.push({
      ...base,
      km10: acts.filter((a) => a.distanceKm >= 10 && a.distanceKm < 15).length,
      km15: acts.filter((a) => a.distanceKm >= 15).length,
    })
    easyHardSplit.push({ ...base, easyPct, hardPct })
    rpeTrend.push({ ...base, avgRpe: avgField(acts, (a) => a.rpe) })
    trainingEffectTrend.push({
      ...base,
      aer: avgField(acts, (a) => a.aerTrainingEffect),
      ana: avgField(acts, (a) => a.anaTrainingEffect),
    })
  }

  const distanceKm = round(activities.reduce((s, a) => s + a.distanceKm, 0))
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
      avgKmPerWeek: round((distanceKm / elapsedDays) * 7),
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
    distanceDistribution: distanceDistribution(activities),
    rpeTrend,
    trainingEffectTrend,
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
