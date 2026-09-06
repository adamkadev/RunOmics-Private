import type { Activity } from './types'

export interface OfficialRaceResult {
  activityId: string
  eventName: string
  date: string
  distanceMeters: number
  chipTimeSeconds: number
  gunTimeSeconds?: number
  overallPlace?: number
  finisherCount?: number
  source?: string
}

export interface ResolvedPerformance {
  source: 'official' | 'garmin'
  distanceKm: number
  durationSeconds: number
  paceSecPerKm: number | null
  eventName?: string
  overallPlace?: number
  finisherCount?: number
}

export interface GarminMeasured {
  distanceKm: number
  durationSeconds: number
  paceSecPerKm: number | null
}

type MeasuredActivity = Pick<Activity, 'distanceKm' | 'durationSeconds' | 'paceSecPerKm'>

const CERTIFIED_DISTANCE_TOLERANCE_RATIO = 0.001

function rounded(value: number): number {
  return Math.round(value * 10) / 10
}

export function garminMeasured(activity: MeasuredActivity): GarminMeasured {
  return {
    distanceKm: activity.distanceKm,
    durationSeconds: activity.durationSeconds,
    paceSecPerKm: activity.paceSecPerKm,
  }
}

export function resolvePerformance(
  activity: MeasuredActivity,
  official: OfficialRaceResult | null,
): ResolvedPerformance {
  if (!official) return { source: 'garmin', ...garminMeasured(activity) }

  const distanceKm = official.distanceMeters / 1_000
  return {
    source: 'official',
    distanceKm,
    durationSeconds: official.chipTimeSeconds,
    paceSecPerKm: distanceKm > 0 ? rounded(official.chipTimeSeconds / distanceKm) : null,
    eventName: official.eventName,
    ...(official.overallPlace === undefined ? {} : { overallPlace: official.overallPlace }),
    ...(official.finisherCount === undefined ? {} : { finisherCount: official.finisherCount }),
  }
}

export function topPercentile(overallPlace: number | undefined, finisherCount: number | undefined): number | null {
  if (overallPlace === undefined || finisherCount === undefined) return null
  if (overallPlace < 1 || finisherCount < 1 || overallPlace > finisherCount) return null
  return Math.min(100, Math.max(1, Math.ceil((overallPlace / finisherCount) * 100)))
}

export function officialResultsByActivityId(results: OfficialRaceResult[]): Map<string, OfficialRaceResult> {
  return new Map(results.map((result) => [result.activityId, result]))
}

export function matchesEffortDistance(result: OfficialRaceResult, km: number): boolean {
  const meters = km * 1_000
  return Math.abs(result.distanceMeters - meters) <= meters * CERTIFIED_DISTANCE_TOLERANCE_RATIO
}

export function creditedEffortSeconds(
  activity: Pick<Activity, 'id' | 'bestEfforts'>,
  key: string,
  km: number,
  officialByActivityId: Map<string, OfficialRaceResult>,
): number | null {
  const official = officialByActivityId.get(activity.id)
  if (official && matchesEffortDistance(official, km)) return official.chipTimeSeconds
  return activity.bestEfforts?.[key] ?? null
}
