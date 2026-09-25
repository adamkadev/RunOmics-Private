import { DAY_MS } from '@/lib/calendarDate'
import type { Activity } from './types'
import { EFFORTS } from './effort'
import { creditedEffortSeconds, officialResultsByActivityId, type OfficialRaceResult } from './raceResult'

const BASELINE_LOOKBACK_DAYS = 90
const BASELINE_RUNS = 5
const BASELINE_MIN_RUNS = 3

const STANDING_MIN_DAYS = 60

const HARD_ZONE = 4

export interface TypeBaseline {
  runs: number
  paceSecPerKm: number
  avgHr: number | null
}

export interface EffortStanding {
  label: string
  daysSinceBetter: number | null
}

export interface RunHistory {
  baseline: TypeBaseline | null
  standing: EffortStanding | null
  hardMinutes: number | null
  runsInPast7Days: number
  daysSinceLastRun: number | null
}

function dayNumber(date: string): number {
  return Math.floor(new Date(date.slice(0, 10) + 'T00:00:00Z').getTime() / DAY_MS)
}

function typeBaseline(activity: Activity, before: Activity[], day: number): TypeBaseline | null {
  const peers = before
    .filter(
      (a) => a.type === activity.type && a.distanceKm > 0 && day - dayNumber(a.date) <= BASELINE_LOOKBACK_DAYS
    )
    .slice(0, BASELINE_RUNS)
  if (peers.length < BASELINE_MIN_RUNS) return null

  const seconds = peers.reduce((sum, a) => sum + a.durationSeconds, 0)
  const km = peers.reduce((sum, a) => sum + a.distanceKm, 0)
  const heartRates = peers.map((a) => a.avgHeartRate).filter((hr): hr is number => hr !== null)

  return {
    runs: peers.length,
    paceSecPerKm: Math.round(seconds / km),
    avgHr: heartRates.length ? Math.round(heartRates.reduce((sum, hr) => sum + hr, 0) / heartRates.length) : null,
  }
}

const ALL_TIME = Number.MAX_SAFE_INTEGER

function effortStanding(
  activity: Activity,
  before: Activity[],
  day: number,
  official: Map<string, OfficialRaceResult>,
): EffortStanding | null {
  const candidates = [...EFFORTS]
    .reverse()
    .flatMap(({ key, label, km }) => {
      const seconds = creditedEffortSeconds(activity, key, km, official)
      if (seconds == null) return []
      if (!before.some((a) => creditedEffortSeconds(a, key, km, official) != null)) return []

      const better = before.find((a) => (creditedEffortSeconds(a, key, km, official) ?? Infinity) < seconds)
      const daysSinceBetter = better ? day - dayNumber(better.date) : null
      if (daysSinceBetter !== null && daysSinceBetter < STANDING_MIN_DAYS) return []
      return [{ label, daysSinceBetter }]
    })
    .sort((a, b) => (b.daysSinceBetter ?? ALL_TIME) - (a.daysSinceBetter ?? ALL_TIME))

  return candidates[0] ?? null
}

function hardMinutes(activity: Activity): number | null {
  if (!activity.hrZones.length) return null
  const seconds = activity.hrZones.filter((z) => z.zone >= HARD_ZONE).reduce((sum, z) => sum + z.seconds, 0)
  return Math.round(seconds / 60)
}

export function runHistory(activity: Activity, activities: Activity[], officialResults: OfficialRaceResult[] = []): RunHistory {
  const day = dayNumber(activity.date)
  const official = officialResultsByActivityId(officialResults)
  const before = activities
    .filter((a) => a.id !== activity.id && dayNumber(a.date) <= day)
    .sort((a, b) => b.date.localeCompare(a.date))
  const last = before[0]

  return {
    baseline: typeBaseline(activity, before, day),
    standing: effortStanding(activity, before, day, official),
    hardMinutes: hardMinutes(activity),
    runsInPast7Days: before.filter((a) => day - dayNumber(a.date) < 7).length + 1,
    daysSinceLastRun: last ? day - dayNumber(last.date) : null,
  }
}
