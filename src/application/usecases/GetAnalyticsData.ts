import { t } from '@/i18n'
import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import type { Activity, ActivityType, ActivityWeather } from '@/domain/activity/types'
import { heatAdjustedEf } from '@/domain/activity/heat'
import { easyHardShare } from '@/domain/training/easyHard'
import { sumDistanceKm } from '@/domain/activity/distance'
import { monthLabel } from '@/lib/formatters'
import { round } from '@/lib/math'

export { easyHardShare }

const EASY_TYPES: ActivityType[] = ['Base']

export interface MonthlyVolume {
  month: string
  label: string
  sessionCount: number
  totalKm: number
  byType: Partial<Record<ActivityType, number>>
}

export interface MonthlyLongRuns {
  month: string
  label: string
  longestKm: number
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

export interface WeeklyTrendPoint {
  date: string
  label: string
  /** Everything run that week. Summed, not averaged like the reads below it. */
  distanceKm: number
  sessionCount: number
  easyPace: number | null
  hardPace: number | null
  ef: number | null
  efAdjusted: number | null
  apparentTempC: number | null
  easyAvgHr: number | null
  hardAvgHr: number | null
  cadenceSpm: number | null
  groundContactMs: number | null
  verticalOscillationMm: number | null
  verticalRatioPct: number | null
  strideLengthM: number | null
  avgRpe: number | null
  aer: number | null
  ana: number | null
  zoneSeconds: Record<number, number>
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

export interface AnalyticsSeries {
  monthlyVolume: MonthlyVolume[]
  longRuns: MonthlyLongRuns[]
  easyHardSplit: MonthlyEasyHard[]
  distanceDistribution: DistanceBracket[]
  typesPresent: ActivityType[]
}

export interface YearAnalytics extends AnalyticsSeries {
  year: number
  totals: YearTotals
}

export interface AllTimeAnalytics extends AnalyticsSeries {
  totals: YearTotals
}

export interface DailyEfficiency {
  date: string
  label: string
  ef7: number | null    // 7-day rolling average
  ef30: number | null   // 30-day rolling average
}

export interface DailyRunningDynamics {
  date: string
  label: string
  cadence7: number | null
  cadence30: number | null
  groundContact7: number | null
  groundContact30: number | null
  verticalOscillation7: number | null
  verticalOscillation30: number | null
}

export interface AnalyticsPageData {
  years: number[]
  byYear: Record<number, YearAnalytics>
  weeklyTrends: WeeklyTrendPoint[]
  efficiencyDaily: DailyEfficiency[]
  runningDynamicsDaily: DailyRunningDynamics[]
  allTime: AllTimeAnalytics
}

export function weightedAvg(
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

export function avgField(activities: Activity[], pick: (a: Activity) => number | null): number | null {
  const vals = activities.map(pick).filter((v): v is number => v !== null)
  return vals.length ? round(vals.reduce((s, v) => s + v, 0) / vals.length) : null
}

const weightedPace = (acts: Activity[]) => weightedAvg(acts, (a) => a.paceSecPerKm, (a) => a.distanceKm, 0)
const weightedHr = (acts: Activity[]) => weightedAvg(acts, (a) => a.avgHeartRate, (a) => a.durationSeconds, 0)
const weightedCadence = (acts: Activity[]) => weightedAvg(acts, (a) => a.cadenceSpm, (a) => a.durationSeconds)
const weightedGroundContact = (acts: Activity[]) => weightedAvg(acts, (a) => a.groundContactMs, (a) => a.durationSeconds, 0)
const weightedVerticalOscillation = (acts: Activity[]) => weightedAvg(acts, (a) => a.verticalOscillationMm, (a) => a.durationSeconds)
const weightedVerticalRatio = (acts: Activity[]) => weightedAvg(acts, (a) => a.verticalRatioPct, (a) => a.durationSeconds)
const weightedStrideLength = (acts: Activity[]) => weightedAvg(acts, (a) => a.strideLengthM, (a) => a.durationSeconds, 2)

export function zoneDistribution(activities: Activity[]): ZoneShare[] {
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


export function recentZoneDistribution(activities: Activity[], days: number, now: Date = new Date()): ZoneShare[] {
  const cutoff = new Date(now.getTime() - days * 86_400_000)
  return zoneDistribution(activities.filter((a) => new Date(a.date + 'T00:00:00') >= cutoff))
}


function efSamples(activities: Activity[]): { ef: number; weather: ActivityWeather | null }[] {
  return activities
    .filter((a) => a.paceSecPerKm !== null && a.avgHeartRate !== null && a.distanceKm >= 3)
    .map((a) => ({ ef: (1000 / a.paceSecPerKm!) * 60 / a.avgHeartRate!, weather: a.weather }))
}

function meanEf(efs: number[]): number | null {
  return efs.length ? round(efs.reduce((s, v) => s + v, 0) / efs.length, 2) : null
}

export function efficiencyFactor(activities: Activity[]): number | null {
  return meanEf(efSamples(activities).map((s) => s.ef))
}

export function adjustedEfficiencyFactor(activities: Activity[]): number | null {
  return meanEf(efSamples(activities).map((s) => heatAdjustedEf(s.ef, s.weather)))
}

const DISTANCE_BRACKETS = [
  { label: '< 5 km',   min: 0,  max: 5  },
  { label: '5–10 km',  min: 5,  max: 10 },
  { label: '10–15 km', min: 10, max: 15 },
  { label: '15–21 km', min: 15, max: 21 },
  { label: '21–42 km', min: 21, max: 42 },
  { label: '42+ km',   min: 42, max: Infinity },
]

export function distanceDistribution(activities: Activity[]): DistanceBracket[] {
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

interface Bucket {
  id: string
  label: string
  acts: Activity[]
}

function buildSeries(buckets: Bucket[], scoped: Activity[]): AnalyticsSeries {
  const typesPresent = new Set<ActivityType>()
  const monthlyVolume: MonthlyVolume[] = []
  const longRuns: MonthlyLongRuns[] = []
  const easyHardSplit: MonthlyEasyHard[] = []

  for (const { id, label, acts } of buckets) {
    const base = { month: id, label }

    const byType: Partial<Record<ActivityType, number>> = {}
    for (const a of acts) {
      byType[a.type] = round((byType[a.type] ?? 0) + a.distanceKm)
      typesPresent.add(a.type)
    }

    const { easyPct, hardPct } = easyHardShare(acts)

    monthlyVolume.push({ ...base, sessionCount: acts.length, totalKm: round(acts.reduce((s, a) => s + a.distanceKm, 0)), byType })
    longRuns.push({
      ...base,
      longestKm: acts.length > 0 ? round(Math.max(...acts.map((a) => a.distanceKm))) : 0,
    })
    easyHardSplit.push({ ...base, easyPct, hardPct })
  }

  return {
    monthlyVolume,
    longRuns,
    easyHardSplit,
    distanceDistribution: distanceDistribution(scoped),
    typesPresent: Array.from(typesPresent),
  }
}

export function buildWeeklyTrends(all: Activity[]): WeeklyTrendPoint[] {
  const byWeek = new Map<string, Activity[]>()
  for (const a of all) {
    const monday = isoDate(startOfWeek(new Date(a.date + 'T12:00:00')))
    const list = byWeek.get(monday) ?? []
    list.push(a)
    byWeek.set(monday, list)
  }

  return Array.from(byWeek.keys())
    .sort()
    .map((monday) => {
      const acts = byWeek.get(monday)!
      const easy = acts.filter((a) => EASY_TYPES.includes(a.type))
      const hard = acts.filter((a) => !EASY_TYPES.includes(a.type))

      const zoneSeconds: Record<number, number> = {}
      for (const a of acts) {
        for (const z of a.hrZones) zoneSeconds[z.zone] = (zoneSeconds[z.zone] ?? 0) + z.seconds
      }

      return {
        date: monday,
        label: new Date(monday + 'T00:00:00').toLocaleDateString(t.locale, { day: 'numeric', month: 'short' }),
        distanceKm: sumDistanceKm(acts),
        sessionCount: acts.length,
        easyPace: weightedPace(easy),
        hardPace: weightedPace(hard),
        ef: efficiencyFactor(easy),
        efAdjusted: adjustedEfficiencyFactor(easy),
        apparentTempC: avgField(easy, (a) => a.weather?.apparentTempC ?? null),
        easyAvgHr: weightedHr(easy),
        hardAvgHr: weightedHr(hard),
        cadenceSpm: weightedCadence(acts),
        groundContactMs: weightedGroundContact(acts),
        verticalOscillationMm: weightedVerticalOscillation(acts),
        verticalRatioPct: weightedVerticalRatio(acts),
        strideLengthM: weightedStrideLength(acts),
        avgRpe: avgField(acts, (a) => a.rpe),
        aer: avgField(acts, (a) => a.aerTrainingEffect),
        ana: avgField(acts, (a) => a.anaTrainingEffect),
        zoneSeconds,
      }
    })
}

export function computeTotals(activities: Activity[], elapsedDays: number): YearTotals {
  // Round once to a whole km (shared selector) - not round(…, 1) then round
  // again at display, which pushed Analytics 1 km above Progress/Goals.
  const distanceKm = sumDistanceKm(activities)
  const calories = activities.reduce((s, a) => s + (a.calories ?? 0), 0)
  const days = Math.max(elapsedDays, 1)
  return {
    distanceKm,
    durationSeconds: activities.reduce((s, a) => s + a.durationSeconds, 0),
    sessionCount: activities.length,
    elevationM: Math.round(activities.reduce((s, a) => s + (a.elevationGain ?? 0), 0)),
    avgKmPerWeek: round((distanceKm / days) * 7),
    calories,
    caloriesPerWeek: Math.round((calories / days) * 7),
  }
}

function buildYearAnalytics(year: number, activities: Activity[], now: Date): YearAnalytics {
  const isCurrentYear = year === now.getFullYear()
  const lastMonth = isCurrentYear ? now.getMonth() + 1 : 12

  const byMonth = new Map<number, Activity[]>()
  for (const a of activities) {
    const m = Number(a.date.slice(5, 7))
    const list = byMonth.get(m) ?? []
    list.push(a)
    byMonth.set(m, list)
  }

  const buckets: Bucket[] = Array.from({ length: lastMonth }, (_, i) => i + 1).map((m) => ({
    id: `${year}-${String(m).padStart(2, '0')}`,
    label: monthLabel(m),
    acts: byMonth.get(m) ?? [],
  }))

  const elapsedDays = isCurrentYear
    ? Math.floor((now.getTime() - new Date(year, 0, 1).getTime()) / 86400000) + 1
    : Math.floor((new Date(year + 1, 0, 1).getTime() - new Date(year, 0, 1).getTime()) / 86400000)

  return { year, totals: computeTotals(activities, elapsedDays), ...buildSeries(buckets, activities) }
}

function startOfWeek(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7)) // back to Monday
  return x
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}


function buildAllTimeAnalytics(byYearMap: Map<number, Activity[]>, all: Activity[], now: Date): AllTimeAnalytics {
  const buckets: Bucket[] = Array.from(byYearMap.keys())
    .sort((a, b) => a - b)
    .map((year) => ({ id: String(year), label: String(year), acts: byYearMap.get(year)! }))

  const firstYear = buckets[0] ? Number(buckets[0].id) : now.getFullYear()
  const elapsedDays = Math.floor((now.getTime() - new Date(firstYear, 0, 1).getTime()) / 86400000) + 1

  return { totals: computeTotals(all, elapsedDays), ...buildSeries(buckets, all) }
}

const ROLLING_DAYS = 365

function trimLeadingEmpty<T>(points: T[], hasValue: (p: T) => boolean): T[] {
  const first = points.findIndex(hasValue)
  return first === -1 ? [] : points.slice(first)
}

function buildEfficiencyDaily(activities: Activity[], now: Date): DailyEfficiency[] {
  const EASY_TYPES_SET = new Set(EASY_TYPES)
  const DAY_MS = 86_400_000
  const easy = activities.filter((a) => EASY_TYPES_SET.has(a.type))
  const nowMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()

  const stamped = easy.map((a) => ({ a, ms: new Date(a.date + 'T00:00:00').getTime() }))

  const points = Array.from({ length: ROLLING_DAYS }, (_, i) => {
    const dayMs = nowMs - (ROLLING_DAYS - 1 - i) * DAY_MS
    const day = new Date(dayMs)
    const label = day.toLocaleDateString(t.locale, { day: 'numeric', month: 'short' })
    const date = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`

    const in7  = stamped.filter((x) => x.ms >= dayMs - 6 * DAY_MS && x.ms <= dayMs).map((x) => x.a)
    const in30 = stamped.filter((x) => x.ms >= dayMs - 29 * DAY_MS && x.ms <= dayMs).map((x) => x.a)

    return {
      date,
      label,
      ef7:  in7.length  >= 2 ? efficiencyFactor(in7)  : null,
      ef30: in30.length >= 5 ? efficiencyFactor(in30) : null,
    }
  })

  return trimLeadingEmpty(points, (p) => p.ef7 !== null || p.ef30 !== null)
}

function buildRunningDynamicsDaily(activities: Activity[], now: Date): DailyRunningDynamics[] {
  const DAY_MS = 86_400_000
  const nowMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const stamped = activities.map((a) => ({ a, ms: new Date(a.date + 'T00:00:00').getTime() }))

  const points = Array.from({ length: ROLLING_DAYS }, (_, i) => {
    const dayMs = nowMs - (ROLLING_DAYS - 1 - i) * DAY_MS
    const day = new Date(dayMs)
    const label = day.toLocaleDateString(t.locale, { day: 'numeric', month: 'short' })
    const date = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`

    const in7  = stamped.filter((x) => x.ms >= dayMs - 6 * DAY_MS && x.ms <= dayMs).map((x) => x.a)
    const in30 = stamped.filter((x) => x.ms >= dayMs - 29 * DAY_MS && x.ms <= dayMs).map((x) => x.a)

    return {
      date,
      label,
      cadence7:  in7.length  >= 2 ? weightedCadence(in7)  : null,
      cadence30: in30.length >= 5 ? weightedCadence(in30) : null,
      groundContact7:  in7.length  >= 2 ? weightedGroundContact(in7)  : null,
      groundContact30: in30.length >= 5 ? weightedGroundContact(in30) : null,
      verticalOscillation7:  in7.length  >= 2 ? weightedVerticalOscillation(in7)  : null,
      verticalOscillation30: in30.length >= 5 ? weightedVerticalOscillation(in30) : null,
    }
  })

  return trimLeadingEmpty(points, (p) => p.cadence7 !== null || p.cadence30 !== null)
}

export async function getAnalyticsData(): Promise<AnalyticsPageData> {
  const all = getAllActivities()
  const now = new Date()

  const byYearMap = new Map<number, Activity[]>()
  for (const a of all) {
    const y = Number(a.date.slice(0, 4))
    const list = byYearMap.get(y) ?? []
    list.push(a)
    byYearMap.set(y, list)
  }

  const years = Array.from(byYearMap.keys()).sort((a, b) => b - a)

  return {
    years,
    byYear: Object.fromEntries(years.map((y) => [y, buildYearAnalytics(y, byYearMap.get(y)!, now)])),
    weeklyTrends: buildWeeklyTrends(all),
    efficiencyDaily: buildEfficiencyDaily(all, now),
    runningDynamicsDaily: buildRunningDynamicsDaily(all, now),
    allTime: buildAllTimeAnalytics(byYearMap, all, now),
  }
}
