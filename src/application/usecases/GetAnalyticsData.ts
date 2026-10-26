import { getActivitiesWithEffectiveTypes } from '@/application/coaching/GetCoachingView'
import type { Activity, ActivityType, ActivityWeather } from '@/domain/activity/types'
import { heatAdjustedEf } from '@/domain/activity/heat'
import { easyHardShare } from '@/domain/training/easyHard'
import { sumDistanceKm } from '@/domain/activity/distance'
import { round } from '@/lib/math'
import { DAY_MS, isoDate } from '@/lib/calendarDate'
import { qualityKind } from '@/domain/training/qualitySession'
import { DEFAULT_Z4_FLOOR_BPM, repPaceSecPerKm } from '@/domain/training/repPace'
import { getAthleteProfile } from '@/infrastructure/repositories/JsonAthleteRepository'

export { easyHardShare }

const EASY_TYPES: ActivityType[] = ['Base']

export interface ZoneShare {
  zone: number
  seconds: number
  percent: number
}

/** What the Analytics cards draw, a week at a time: it crosses to the browser, so a field nothing draws is not here. */
export interface WeeklyTrendPoint {
  date: string
  distanceKm: number
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
  zoneSeconds: Record<number, number>
  longestKm: number
  longestDate: string | null
  thresholdSessions: number
  intervalSessions: number
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

export interface AnalyticsPageData {
  weeklyTrends: WeeklyTrendPoint[]
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
  const cutoff = new Date(now.getTime() - days * DAY_MS)
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
  // No unit in the label: "5–10 km" wraps to two lines under its bar.
  { label: '< 5',   min: 0,  max: 5  },
  { label: '5–10',  min: 5,  max: 10 },
  { label: '10–15', min: 10, max: 15 },
  { label: '15–21', min: 15, max: 21 },
  { label: '21–42', min: 21, max: 42 },
  { label: '42+',   min: 42, max: Infinity },
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

export function buildWeeklyTrends(all: Activity[], z4FloorBpm = DEFAULT_Z4_FLOOR_BPM): WeeklyTrendPoint[] {
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

      const longest = acts.reduce<Activity | null>((max, a) => (!max || a.distanceKm > max.distanceKm ? a : max), null)

      return {
        date: monday,
        // One decimal: the week under way reads "27.3 of 48", as Today's ring does.
        distanceKm: round(acts.reduce((s, a) => s + a.distanceKm, 0)),
        easyPace: weightedPace(easy),
        hardPace: repPaceSecPerKm(hard, z4FloorBpm),
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
        zoneSeconds,
        longestKm: longest ? round(longest.distanceKm) : 0,
        longestDate: longest?.date.slice(0, 10) ?? null,
        thresholdSessions: acts.filter((a) => qualityKind(a.type) === 'threshold').length,
        intervalSessions: acts.filter((a) => qualityKind(a.type) === 'intervals').length,
      }
    })
}

export function computeTotals(activities: Activity[], elapsedDays: number): YearTotals {
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

function startOfWeek(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  return x
}

export async function getAnalyticsData(): Promise<AnalyticsPageData> {
  return { weeklyTrends: buildWeeklyTrends(getActivitiesWithEffectiveTypes(), getAthleteProfile().hrZoneBoundsBpm?.[3] ?? DEFAULT_Z4_FLOOR_BPM) }
}
