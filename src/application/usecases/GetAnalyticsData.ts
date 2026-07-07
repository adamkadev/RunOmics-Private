import { t } from '@/i18n'
import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { getAthleteFromFirestore } from '@/infrastructure/repositories/FirestoreConfigRepository'
import { buildTimeSeries, type HrBounds } from '@/application/usecases/GetTrainingLoad'
import type { Activity, ActivityType } from '@/domain/activity/types'
import { easyHardShare } from '@/domain/training/easyHard'
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
  easyAvgHr: number | null
  hardAvgHr: number | null
}

export interface MonthlyCadence {
  month: string
  label: string
  cadence: number | null
}

export interface MonthlyRunningForm {
  month: string
  label: string
  groundContactMs: number | null
  verticalOscillationMm: number | null
  strideLengthM: number | null
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

// Per-bucket trend series shared by both the yearly (monthly buckets) and the
// rolling-period (weekly buckets) views, so the same charts render either one.
export interface AnalyticsSeries {
  monthlyVolume: MonthlyVolume[]
  paceTrend: MonthlyPace[]
  efficiencyTrend: MonthlyEfficiency[]
  hrTrend: MonthlyHr[]
  cadenceTrend: MonthlyCadence[]
  runningFormTrend: MonthlyRunningForm[]
  longRuns: MonthlyLongRuns[]
  easyHardSplit: MonthlyEasyHard[]
  zoneDistribution: ZoneShare[]
  distanceDistribution: DistanceBracket[]
  rpeTrend: MonthlyRpe[]
  trainingEffectTrend: MonthlyTrainingEffect[]
  typesPresent: ActivityType[]
}

export interface YearAnalytics extends AnalyticsSeries {
  year: number
  totals: YearTotals
}

// Progression vs the previous equally long window.
export interface PeriodDelta {
  distancePct: number | null
  sessionsPct: number | null
  easyPaceSec: number | null // negative = faster
}

export interface PeriodAnalytics extends AnalyticsSeries {
  weeks: number
  totals: YearTotals
  delta: PeriodDelta | null
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

export interface TemperaturePoint {
  temp: number
  pace: number   // sec/km
  km: number
  date: string
}

export interface RpeLoadPoint {
  tsb: number          // form at the start of the day, before that day's load
  rpe: number
  rpeDelta: number     // rpe minus this session type's usual rpe, so types are comparable
  type: ActivityType
  temp: number | null
  date: string
}

export interface AnalyticsPageData {
  years: number[]
  byYear: Record<number, YearAnalytics>
  periodWeeks: number[]
  byPeriod: Record<number, PeriodAnalytics>
  efficiencyDaily: DailyEfficiency[]
  runningDynamicsDaily: DailyRunningDynamics[]
  allTime: AllTimeAnalytics
  temperatureScatter: TemperaturePoint[]
  rpeLoadCorrelation: RpeLoadPoint[]
}

// A value (possibly null) paired with a weight, averaged across activities.
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

// Simple mean of a (possibly null) field across activities; null when none present.
export function avgField(activities: Activity[], pick: (a: Activity) => number | null): number | null {
  const vals = activities.map(pick).filter((v): v is number => v !== null)
  return vals.length ? round(vals.reduce((s, v) => s + v, 0) / vals.length) : null
}

const weightedPace = (acts: Activity[]) => weightedAvg(acts, (a) => a.paceSecPerKm, (a) => a.distanceKm, 0)
const weightedHr = (acts: Activity[]) => weightedAvg(acts, (a) => a.avgHeartRate, (a) => a.durationSeconds, 0)
const weightedCadence = (acts: Activity[]) => weightedAvg(acts, (a) => a.cadenceSpm, (a) => a.durationSeconds)
const weightedGroundContact = (acts: Activity[]) => weightedAvg(acts, (a) => a.groundContactMs, (a) => a.durationSeconds, 0)
const weightedVerticalOscillation = (acts: Activity[]) => weightedAvg(acts, (a) => a.verticalOscillationMm, (a) => a.durationSeconds)
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


export function efficiencyFactor(activities: Activity[]): number | null {
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

// Build every per-bucket trend series in a single pass. `scoped` is the full set
// of activities the buckets cover (used for the distribution charts).
function buildSeries(buckets: Bucket[], scoped: Activity[]): AnalyticsSeries {
  const typesPresent = new Set<ActivityType>()
  const monthlyVolume: MonthlyVolume[] = []
  const paceTrend: MonthlyPace[] = []
  const efficiencyTrend: MonthlyEfficiency[] = []
  const hrTrend: MonthlyHr[] = []
  const cadenceTrend: MonthlyCadence[] = []
  const runningFormTrend: MonthlyRunningForm[] = []
  const longRuns: MonthlyLongRuns[] = []
  const easyHardSplit: MonthlyEasyHard[] = []
  const rpeTrend: MonthlyRpe[] = []
  const trainingEffectTrend: MonthlyTrainingEffect[] = []

  for (const { id, label, acts } of buckets) {
    const base = { month: id, label }
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
    hrTrend.push({ ...base, easyAvgHr: weightedHr(easy), hardAvgHr: weightedHr(hard) })
    cadenceTrend.push({ ...base, cadence: weightedCadence(acts) })
    runningFormTrend.push({
      ...base,
      groundContactMs: weightedGroundContact(acts),
      verticalOscillationMm: weightedVerticalOscillation(acts),
      strideLengthM: weightedStrideLength(acts),
    })
    longRuns.push({
      ...base,
      longestKm: acts.length > 0 ? round(Math.max(...acts.map((a) => a.distanceKm))) : 0,
    })
    easyHardSplit.push({ ...base, easyPct, hardPct })
    rpeTrend.push({ ...base, avgRpe: avgField(acts, (a) => a.rpe) })
    trainingEffectTrend.push({
      ...base,
      aer: avgField(acts, (a) => a.aerTrainingEffect),
      ana: avgField(acts, (a) => a.anaTrainingEffect),
    })
  }

  return {
    monthlyVolume,
    paceTrend,
    efficiencyTrend,
    hrTrend,
    cadenceTrend,
    runningFormTrend,
    longRuns,
    easyHardSplit,
    zoneDistribution: zoneDistribution(scoped),
    distanceDistribution: distanceDistribution(scoped),
    rpeTrend,
    trainingEffectTrend,
    typesPresent: Array.from(typesPresent),
  }
}

export function computeTotals(activities: Activity[], elapsedDays: number): YearTotals {
  const distanceKm = round(activities.reduce((s, a) => s + a.distanceKm, 0))
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

// Rolling window of the last `weeks` ISO weeks, bucketed by week, with a delta
// vs the previous equally long window.
function buildPeriodAnalytics(all: Activity[], weeks: number, now: Date): PeriodAnalytics {
  const thisMonday = startOfWeek(now)
  const buckets: Bucket[] = []
  for (let i = weeks - 1; i >= 0; i--) {
    const mon = new Date(thisMonday)
    mon.setDate(thisMonday.getDate() - i * 7)
    buckets.push({ id: isoDate(mon), label: mon.toLocaleDateString(t.locale, { day: 'numeric', month: 'short' }), acts: [] })
  }

  const windowActs: Activity[] = []
  const prevActs: Activity[] = []
  for (const a of all) {
    const aMonday = startOfWeek(new Date(a.date + 'T12:00:00'))
    const weeksAgo = Math.round((thisMonday.getTime() - aMonday.getTime()) / (7 * 86400000))
    if (weeksAgo >= 0 && weeksAgo < weeks) {
      buckets[weeks - 1 - weeksAgo]?.acts.push(a)
      windowActs.push(a)
    } else if (weeksAgo >= weeks && weeksAgo < weeks * 2) {
      prevActs.push(a)
    }
  }

  const pct = (cur: number, old: number) => (old > 0 ? Math.round(((cur - old) / old) * 100) : null)
  const easyOf = (acts: Activity[]) => acts.filter((a) => EASY_TYPES.includes(a.type))
  const easyPaceNow = weightedPace(easyOf(windowActs))
  const easyPacePrev = weightedPace(easyOf(prevActs))
  const delta: PeriodDelta | null = prevActs.length === 0 ? null : {
    distancePct: pct(windowActs.reduce((s, a) => s + a.distanceKm, 0), prevActs.reduce((s, a) => s + a.distanceKm, 0)),
    sessionsPct: pct(windowActs.length, prevActs.length),
    easyPaceSec: easyPaceNow != null && easyPacePrev != null ? Math.round(easyPaceNow - easyPacePrev) : null,
  }

  return { weeks, totals: computeTotals(windowActs, weeks * 7), delta, ...buildSeries(buckets, windowActs) }
}

// One bucket per calendar year across the whole history.
function buildAllTimeAnalytics(byYearMap: Map<number, Activity[]>, all: Activity[], now: Date): AllTimeAnalytics {
  const buckets: Bucket[] = Array.from(byYearMap.keys())
    .sort((a, b) => a - b)
    .map((year) => ({ id: String(year), label: String(year), acts: byYearMap.get(year)! }))

  const firstYear = buckets[0] ? Number(buckets[0].id) : now.getFullYear()
  const elapsedDays = Math.floor((now.getTime() - new Date(firstYear, 0, 1).getTime()) / 86400000) + 1

  return { totals: computeTotals(all, elapsedDays), ...buildSeries(buckets, all) }
}

function buildEfficiencyDaily(activities: Activity[], now: Date): DailyEfficiency[] {
  const EASY_TYPES_SET = new Set(EASY_TYPES)
  const DAY_MS = 86_400_000
  const easy = activities.filter((a) => EASY_TYPES_SET.has(a.type))
  const nowMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()

  // Pre-compute timestamps once
  const stamped = easy.map((a) => ({ a, ms: new Date(a.date + 'T00:00:00').getTime() }))

  return Array.from({ length: 90 }, (_, i) => {
    const dayMs = nowMs - (89 - i) * DAY_MS
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
}

function buildRunningDynamicsDaily(activities: Activity[], now: Date): DailyRunningDynamics[] {
  const DAY_MS = 86_400_000
  const nowMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const stamped = activities.map((a) => ({ a, ms: new Date(a.date + 'T00:00:00').getTime() }))

  return Array.from({ length: 90 }, (_, i) => {
    const dayMs = nowMs - (89 - i) * DAY_MS
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
}

export async function getAnalyticsData(): Promise<AnalyticsPageData> {
  const all = getAllActivities()
  const now = new Date()

  const athlete = await getAthleteFromFirestore()
  const hrBounds: HrBounds | undefined =
    athlete.maxHrBpm && athlete.restingHrBpm
      ? { maxHr: athlete.maxHrBpm, restingHr: athlete.restingHrBpm }
      : undefined

  const byYearMap = new Map<number, Activity[]>()
  for (const a of all) {
    const y = Number(a.date.slice(0, 4))
    const list = byYearMap.get(y) ?? []
    list.push(a)
    byYearMap.set(y, list)
  }

  const years = Array.from(byYearMap.keys()).sort((a, b) => b - a)
  const periodWeeks = [8, 12, 16]

  const temperatureScatter: TemperaturePoint[] = all
    .filter((a) => a.avgTemperature !== null && a.paceSecPerKm !== null && a.distanceKm >= 3)
    .map((a) => ({
      temp: a.avgTemperature!,
      pace: a.paceSecPerKm!,
      km: round(a.distanceKm, 1),
      date: a.date,
    }))

  // RPE is driven far more by session type (a sprint workout always reads
  // higher than an easy run) than by form, so we compare each run against the
  // usual RPE for its own type rather than the raw value. Types with too few
  // rated sessions don't get a reliable baseline and are left out.
  const rpeByType = new Map<ActivityType, number[]>()
  for (const a of all) {
    if (a.rpe === null) continue
    const list = rpeByType.get(a.type) ?? []
    list.push(a.rpe)
    rpeByType.set(a.type, list)
  }
  const avgRpeByType = new Map<ActivityType, number>()
  for (const [type, vals] of rpeByType) {
    if (vals.length >= 3) avgRpeByType.set(type, vals.reduce((s, v) => s + v, 0) / vals.length)
  }

  const loadSeries = buildTimeSeries(all, hrBounds)
  const rpeLoadCorrelation: RpeLoadPoint[] = all
    .filter((a) => a.rpe !== null && a.distanceKm >= 3 && loadSeries.has(a.date) && avgRpeByType.has(a.type))
    .map((a) => ({
      tsb: loadSeries.get(a.date)!.tsb,
      rpe: a.rpe!,
      rpeDelta: round(a.rpe! - avgRpeByType.get(a.type)!, 1),
      type: a.type,
      temp: a.avgTemperature,
      date: a.date,
    }))

  return {
    years,
    byYear: Object.fromEntries(years.map((y) => [y, buildYearAnalytics(y, byYearMap.get(y)!, now)])),
    periodWeeks,
    byPeriod: Object.fromEntries(periodWeeks.map((w) => [w, buildPeriodAnalytics(all, w, now)])),
    efficiencyDaily: buildEfficiencyDaily(all, now),
    runningDynamicsDaily: buildRunningDynamicsDaily(all, now),
    allTime: buildAllTimeAnalytics(byYearMap, all, now),
    temperatureScatter,
    rpeLoadCorrelation,
  }
}
